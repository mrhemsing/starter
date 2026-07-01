import type { FeaturedStartHighlight, StartSummary } from "@/lib/types";
import { readSupabaseFeaturedStartHighlight } from "@/lib/data/supabase-archive";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const MLB_CHANNEL_HANDLE = "MLB";
const MLB_CHANNEL_PREFIX = "UCoLrcjPV5";
const SEARCH_RESULT_LIMIT = 5;
const CACHE_TTL_MS = 18 * 60 * 60 * 1000;
const YOUTUBE_REVALIDATE_SECONDS = 18 * 60 * 60;
const YOUTUBE_SEARCH_ENABLED = process.env.YOUTUBE_SEARCH_ENABLED === "1";
const ALL_GAME_HIGHLIGHTS_TITLE_PATTERN = /\ball\s+games(?:\s+highlights?)?\b/i;
const MANUAL_HIGHLIGHT_VIDEO_IDS_BY_START_ID: Record<string, string> = {
  "2026-06-12-mil-phi-694819": "MaAOy8pY36c",
  "2026-06-14-sf-chc-657277": "WfT4TJqUs_E",
  "2026-06-19-nyy-cin-693645": "JkWrVSnrgB4",
  "2026-06-22-mil-cin-605540": "oHw4ASegTcI",
  "2026-06-25-hou-det-837227": "fSu5y2kmChE",
  "2026-06-28-bos-nyy-543243": "C-uwf39UDjw",
  "2026-06-29-det-nyy-663554": "Z1ZawNQNDh8",
};

type CachedResolution = {
  value: FeaturedStartHighlight | null;
  expiresAt: number;
};

type CachedChannelId = {
  value: string | null;
  expiresAt: number;
};

type YouTubeSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    channelId?: string;
  };
};

type YouTubeVideoItem = {
  id?: string;
  contentDetails?: {
    duration?: string;
  };
};

type HighlightStart = Pick<StartSummary, "id" | "date" | "pitcher" | "highlightVideoId">;

const resolutionCache = new Map<string, CachedResolution>();
let cachedMlbChannelId: CachedChannelId | null = null;

export async function resolveFeaturedStartHighlight(start: HighlightStart | null): Promise<FeaturedStartHighlight | null> {
  if (!start) return null;

  const cached = resolutionCache.get(start.id);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  if (start.highlightVideoId) {
    return cacheResolution(start.id, highlightFromVideoId(start.highlightVideoId, "manual", false));
  }

  const manualVideoId = MANUAL_HIGHLIGHT_VIDEO_IDS_BY_START_ID[start.id];
  if (manualVideoId) {
    return cacheResolution(start.id, highlightFromVideoId(manualVideoId, "manual", false));
  }

  const stored = await readSupabaseFeaturedStartHighlight(start.id);
  if (stored) return cacheResolution(start.id, stored);

  if (!YOUTUBE_SEARCH_ENABLED) return cacheResolution(start.id, null);

  const resolved = await resolveYouTubeHighlight(start).catch(() => null);
  return cacheResolution(start.id, resolved);
}

function cacheResolution(startId: string, value: FeaturedStartHighlight | null) {
  resolutionCache.set(startId, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return value;
}

async function resolveYouTubeHighlight(start: HighlightStart): Promise<FeaturedStartHighlight | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  const channelId = await resolveMlbChannelId(apiKey);
  if (!channelId) return null;

  const candidates = await searchHighlightCandidates(start, channelId, apiKey);
  if (candidates.length === 0) return null;

  const videoIds = candidates.map((candidate) => candidate.videoId);
  const durations = await fetchVideoDurations(videoIds, apiKey);
  const ranked = candidates
    .map((candidate) => ({
      ...candidate,
      durationSeconds: durations.get(candidate.videoId) ?? null,
    }))
    .sort((a, b) => candidateScore(b, start) - candidateScore(a, start));

  const winner = ranked[0];
  if (!winner) return null;

  return highlightFromVideoId(winner.videoId, "youtube-search", Boolean(winner.durationSeconds && winner.durationSeconds < 60));
}

async function resolveMlbChannelId(apiKey: string) {
  if (cachedMlbChannelId && cachedMlbChannelId.expiresAt > Date.now()) return cachedMlbChannelId.value;

  const params = new URLSearchParams({
    part: "id",
    forHandle: MLB_CHANNEL_HANDLE,
    key: apiKey,
  });
  const response = await fetch(`${YOUTUBE_API_BASE}/channels?${params.toString()}`, { next: { revalidate: YOUTUBE_REVALIDATE_SECONDS } });
  if (!response.ok) return cacheMlbChannelId(null);

  const body = await response.json() as { items?: Array<{ id?: string }> };
  const channelId = body.items?.[0]?.id;
  const value = channelId?.startsWith(MLB_CHANNEL_PREFIX) ? channelId : null;

  return cacheMlbChannelId(value);
}

function cacheMlbChannelId(value: string | null) {
  cachedMlbChannelId = {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
  return value;
}

async function searchHighlightCandidates(start: HighlightStart, channelId: string, apiKey: string) {
  const { publishedAfter, publishedBefore } = publishWindow(start.date);
  const queries = [
    `${start.pitcher.name} strikeouts start`,
    `${start.pitcher.name} highlight`,
    `${start.pitcher.name} ${start.pitcher.team}`,
  ];
  const items: YouTubeSearchItem[] = [];

  for (const query of queries) {
    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      channelId,
      q: query,
      publishedAfter,
      publishedBefore,
      maxResults: String(SEARCH_RESULT_LIMIT),
      order: "relevance",
      key: apiKey,
    });
    const response = await fetch(`${YOUTUBE_API_BASE}/search?${params.toString()}`, { next: { revalidate: YOUTUBE_REVALIDATE_SECONDS } });
    if (!response.ok) continue;

    const body = await response.json() as { items?: YouTubeSearchItem[] };
    items.push(...(body.items ?? []));
  }

  const lastNamePattern = new RegExp(`\\b${escapeRegExp(lastName(start.pitcher.name))}\\b`, "i");
  const startTime = new Date(`${start.date}T12:00:00.000Z`).getTime();
  const seenVideoIds = new Set<string>();

  return items
    .map((item) => {
      const videoId = item.id?.videoId;
      const title = item.snippet?.title ?? "";
      const description = item.snippet?.description ?? "";
      const publishedAt = item.snippet?.publishedAt ?? "";
      const publishedTime = Date.parse(publishedAt);

      if (!videoId || !Number.isFinite(publishedTime)) return null;
      if (seenVideoIds.has(videoId)) return null;
      const lastNameInTitle = lastNamePattern.test(title);
      if (isAllGameHighlightsTitle(title)) return null;
      if (!lastNamePattern.test(`${title} ${description}`)) return null;
      seenVideoIds.add(videoId);

      return {
        videoId,
        title,
        description,
        publishedAt,
        hoursFromStartDateNoon: Math.abs(publishedTime - startTime) / (60 * 60 * 1000),
        lastNameInTitle,
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
}

async function fetchVideoDurations(videoIds: string[], apiKey: string) {
  const durations = new Map<string, number>();
  if (videoIds.length === 0) return durations;

  const params = new URLSearchParams({
    part: "contentDetails",
    id: videoIds.join(","),
    key: apiKey,
  });
  const response = await fetch(`${YOUTUBE_API_BASE}/videos?${params.toString()}`, { next: { revalidate: YOUTUBE_REVALIDATE_SECONDS } });
  if (!response.ok) return durations;

  const body = await response.json() as { items?: YouTubeVideoItem[] };
  for (const item of body.items ?? []) {
    if (!item.id || !item.contentDetails?.duration) continue;
    durations.set(item.id, parseIsoDurationSeconds(item.contentDetails.duration));
  }

  return durations;
}

function highlightFromVideoId(videoId: string, source: FeaturedStartHighlight["source"], isShort: boolean): FeaturedStartHighlight {
  return {
    videoId,
    source,
    isShort,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

function publishWindow(date: string) {
  const dateStart = new Date(`${date}T00:00:00.000Z`).getTime();
  return {
    publishedAfter: new Date(dateStart - 6 * 60 * 60 * 1000).toISOString(),
    publishedBefore: new Date(dateStart + 42 * 60 * 60 * 1000).toISOString(),
  };
}

function candidateScore(
  candidate: {
    durationSeconds: number | null;
    hoursFromStartDateNoon: number;
    lastNameInTitle: boolean;
  },
  start: HighlightStart,
) {
  let score = 0;
  if (candidate.lastNameInTitle) score += 100;
  if (candidate.durationSeconds !== null && candidate.durationSeconds < 60) score += 30;
  score -= candidate.hoursFromStartDateNoon;
  if (start.pitcher.team) score += 1;
  return score;
}

function parseIsoDurationSeconds(duration: string) {
  const match = duration.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;

  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
  return Number(days) * 86400 + Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function isAllGameHighlightsTitle(title: string) {
  return ALL_GAME_HIGHLIGHTS_TITLE_PATTERN.test(title);
}

function lastName(name: string) {
  return name.trim().split(/\s+/).at(-1) ?? name;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
