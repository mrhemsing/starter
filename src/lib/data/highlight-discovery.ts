import type { StartSummary } from "@/lib/types";
import { selectMlbGameContentActionCandidate, selectMlbImageCut, isOfficialMlbPitchingHighlight } from "@/lib/data/top-performer-image-service";

// Reuse the existing exact-game MLB pitching asset selector, not a second finder.
export function resolveMlbGameContentHighlight(start: StartSummary, content: Parameters<typeof selectMlbGameContentActionCandidate>[0]) {
  const montage = selectMlbGameContentActionCandidate(content, start, item =>
    isOfficialMlbPitchingHighlight(item) && Boolean(item.playbacks?.some(row => row.name === "mp4Avc" &&
      /^https:\/\/mlb-cuts-diamond\.mlb\.com\/FORGE\/.+\.mp4$/.test(row.url ?? ""))))?.item;
  const item = montage ?? selectMlbGameContentActionCandidate(content, start, item =>
    isOfficialMlbPitchingHighlight(item) && Boolean(item.playbacks?.some(row => row.name === "mp4Avc" &&
      /^https:\/\/bdata-producedclips\.mlb\.com\/[a-f0-9-]+\.mp4$/.test(row.url ?? ""))))?.item;
  const thumbnailUrl = selectMlbImageCut(item ?? null)?.src;
  const playback = item?.playbacks?.find(row => row.name === "mp4Avc" &&
    /^https:\/\/(?:mlb-cuts-diamond\.mlb\.com\/FORGE\/.+|bdata-producedclips\.mlb\.com\/[a-f0-9-]+)\.mp4$/.test(row.url ?? ""));
  if (!item?.slug || !/^[a-z0-9-]+$/.test(item.slug) || !thumbnailUrl || !playback?.url) return null;
  return { videoId: item.slug, source: "mlb-game-content" as const, isShort: false,
    embedUrl: playback.url, thumbnailUrl, watchUrl: `https://www.mlb.com/video/${item.slug}`,
    title: item.headline ?? item.title ?? start.pitcher.name };
}

type HighlightStart = Pick<StartSummary, "id" | "date" | "pitcher">;
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const MLB_CHANNEL_HANDLE = "MLB";
const MLB_CHANNEL_PREFIX = "UCoLrcjPV5";
const SEARCH_RESULT_LIMIT = 5;
const ALL_GAME_HIGHLIGHTS_TITLE_PATTERN = /\ball\s+games(?:\s+highlights?)?\b/i;
const NON_START_TITLE_PATTERN = /\b(condensed game|game recap|game highlights|all games|interview|press conference|pregame|preview)\b/i;

type HighlightCandidate = {
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  hoursFromStartDateNoon: number;
  lastNameInTitle: boolean;
  strikeoutInTitle: boolean;
  teamInTitle: boolean;
  durationSeconds: number | null;
};


export async function resolveYouTubeHighlight({
  start,
  youtubeApiKey,
  mlbChannelId,
}: {
  start: HighlightStart;
  youtubeApiKey: string;
  mlbChannelId: string;
}) {
  const candidates = await searchHighlightCandidates({ start, youtubeApiKey, mlbChannelId });
  if (candidates.length === 0) return null;

  const durations = await fetchVideoDurations(youtubeApiKey, candidates.map((candidate) => candidate.videoId), mlbChannelId);
  return candidates
    .filter(candidate => durations.has(candidate.videoId))
    .map((candidate) => ({
      ...candidate,
      durationSeconds: durations.get(candidate.videoId) ?? null,
    }))
    .sort((a, b) => candidateScore(b) - candidateScore(a))[0] ?? null;
}

async function searchHighlightCandidates({
  start,
  youtubeApiKey,
  mlbChannelId,
}: {
  start: HighlightStart;
  youtubeApiKey: string;
  mlbChannelId: string;
}) {
  const { publishedAfter, publishedBefore } = publishWindow(start.date);
  const queries = [
    `${start.pitcher.name} strikeouts`,
    `${start.pitcher.name} ${start.pitcher.team} highlight`,
  ];
  const items: Array<{
    id?: { videoId?: string };
    snippet?: {
      channelId?: string;
      title?: string;
      description?: string;
      publishedAt?: string;
    };
  }> = [];

  for (const query of queries) {
    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      channelId: mlbChannelId,
      q: query,
      publishedAfter,
      publishedBefore,
      maxResults: String(SEARCH_RESULT_LIMIT),
      order: "relevance",
      key: youtubeApiKey,
    });
    const response = await fetch(`${YOUTUBE_API_BASE}/search?${params.toString()}`);
    if (!response.ok) throw new Error(`YouTube search HTTP ${response.status}`);

    const body = await response.json();
    items.push(...(body.items ?? []));
  }

  const lastNamePattern = new RegExp(`\\b${escapeRegExp(lastName(start.pitcher.name))}\\b`, "i");
  const seenVideoIds = new Set<string>();

  return items
    .map((item): HighlightCandidate | null => {
      const videoId = item.id?.videoId;
      const title = item.snippet?.title ?? "";
      const description = item.snippet?.description ?? "";
      const publishedAt = item.snippet?.publishedAt ?? "";
      const publishedTime = Date.parse(publishedAt);

      if (!videoId || !Number.isFinite(publishedTime) || seenVideoIds.has(videoId)) return null;
      if (item.snippet?.channelId !== mlbChannelId) return null;
      if (ALL_GAME_HIGHLIGHTS_TITLE_PATTERN.test(title) || NON_START_TITLE_PATTERN.test(title)) return null;
      if (!lastNamePattern.test(`${title} ${description}`)) return null;

      seenVideoIds.add(videoId);
      return {
        videoId,
        title,
        description,
        publishedAt,
        hoursFromStartDateNoon: Math.abs(publishedTime - new Date(`${start.date}T12:00:00.000Z`).getTime()) / (60 * 60 * 1000),
        lastNameInTitle: lastNamePattern.test(title),
        strikeoutInTitle: /\b(k|ks|strikeout|strikeouts|fans?)\b/i.test(title),
        teamInTitle: new RegExp(`\\b${escapeRegExp(start.pitcher.team)}\\b`, "i").test(title),
        durationSeconds: null,
      };
    })
    .filter((candidate): candidate is HighlightCandidate => Boolean(candidate));
}

async function fetchVideoDurations(youtubeApiKey: string, videoIds: string[], mlbChannelId: string) {
  const durations = new Map<string, number>();
  if (videoIds.length === 0) return durations;

  const params = new URLSearchParams({
    part: "contentDetails,snippet,status",
    id: videoIds.join(","),
    key: youtubeApiKey,
  });
  const response = await fetch(`${YOUTUBE_API_BASE}/videos?${params.toString()}`);
  if (!response.ok) throw new Error(`YouTube video validation HTTP ${response.status}`);

  const body = await response.json();
  for (const item of body.items ?? []) {
    if (!item.id || !item.contentDetails?.duration) continue;
    if (item.snippet?.channelId !== mlbChannelId || item.status?.embeddable !== true) continue;
    durations.set(item.id, parseIsoDurationSeconds(item.contentDetails.duration));
  }

  return durations;
}

export async function resolveMlbChannelId(youtubeApiKey: string) {
  const params = new URLSearchParams({
    part: "id",
    forHandle: MLB_CHANNEL_HANDLE,
    key: youtubeApiKey,
  });
  const response = await fetch(`${YOUTUBE_API_BASE}/channels?${params.toString()}`);
  if (!response.ok) throw new Error(`YouTube channel resolution HTTP ${response.status}`);

  const body = await response.json();
  const channelId = body.items?.[0]?.id;
  return typeof channelId === "string" && channelId.startsWith(MLB_CHANNEL_PREFIX) ? channelId : null;
}

function candidateScore(candidate: HighlightCandidate) {
  let score = 0;
  if (candidate.lastNameInTitle) score += 100;
  if (candidate.strikeoutInTitle) score += 35;
  if (candidate.teamInTitle) score += 10;
  if (candidate.durationSeconds !== null && candidate.durationSeconds < 60) score += 15;
  score -= candidate.hoursFromStartDateNoon;
  return score;
}

function publishWindow(date: string) {
  const dateStart = new Date(`${date}T00:00:00.000Z`).getTime();
  return {
    publishedAfter: new Date(dateStart - 6 * 60 * 60 * 1000).toISOString(),
    publishedBefore: new Date(dateStart + 42 * 60 * 60 * 1000).toISOString(),
  };
}

function parseIsoDurationSeconds(duration: string) {
  const match = duration.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;

  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
  return Number(days) * 86400 + Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function lastName(name: string) {
  return name.trim().split(/\s+/).at(-1) ?? name;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
