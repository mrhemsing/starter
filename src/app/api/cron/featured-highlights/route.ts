import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { HOME_BEST_STARTS_CACHE_TAG } from "@/lib/data/home-best-starts-service";
import { addDays, getArchivedSeasonStartSummaries, getHomeSlateDate } from "@/lib/data/start-service";
import { isRankedRegularStart } from "@/lib/start-classification";
import { compareRankedStarts } from "@/lib/start-ranking";
import type { StartSummary } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const MLB_CHANNEL_HANDLE = "MLB";
const MLB_CHANNEL_PREFIX = "UCoLrcjPV5";
const HIGHLIGHTS_TABLE = "toetheslab_featured_start_highlights";
const DEFAULT_LOOKBACK_DAYS = 1;
const DEFAULT_CANDIDATE_LIMIT = 8;
const DEFAULT_MIN_SCORE = 58;
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

type HighlightRow = {
  start_id: string;
  video_id: string;
  is_short: boolean;
  source: "youtube-search";
  title: string;
  resolved_at: string;
  updated_at: string;
};

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  const supabaseUrl = process.env.THE_BUMP_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.THE_BUMP_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!youtubeApiKey || !supabaseUrl || !serviceKey) {
    return NextResponse.json({
      error: "Missing YOUTUBE_API_KEY or Supabase service env",
      hasYouTubeApiKey: Boolean(youtubeApiKey),
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceKey: Boolean(serviceKey),
    }, { status: 500 });
  }

  const url = new URL(request.url);
  const endDate = readDateParam(url, "date") ?? readDateParam(url, "end") ?? addDays(getHomeSlateDate(), -1);
  const lookbackDays = readNumberParam(url, "lookbackDays", Number(process.env.THE_BUMP_HIGHLIGHT_LOOKBACK_DAYS ?? DEFAULT_LOOKBACK_DAYS));
  const startDate = readDateParam(url, "date") ?? readDateParam(url, "start") ?? addDays(endDate, -(lookbackDays - 1));
  const candidateLimit = readNumberParam(url, "limit", Number(process.env.THE_BUMP_HIGHLIGHT_CANDIDATE_LIMIT ?? DEFAULT_CANDIDATE_LIMIT));
  const minScore = readNumberParam(url, "minScore", Number(process.env.THE_BUMP_HIGHLIGHT_MIN_SCORE ?? DEFAULT_MIN_SCORE));

  if (startDate > endDate) {
    return NextResponse.json({ error: `start must be on or before end, got ${startDate} > ${endDate}` }, { status: 400 });
  }

  const mlbChannelId = await resolveMlbChannelId(youtubeApiKey);
  if (!mlbChannelId) {
    return NextResponse.json({ error: "Could not resolve the official MLB YouTube channel" }, { status: 502 });
  }

  const starts = await rankedCandidateStarts({ startDate, endDate, candidateLimit, minScore });
  const existing = await readStoredHighlightStartIds(supabaseUrl, serviceKey, starts.map((start) => start.id));
  const rows: HighlightRow[] = [];
  const skipped: string[] = [];
  const missed: string[] = [];

  for (const start of starts) {
    if (existing.has(start.id)) {
      skipped.push(start.id);
      continue;
    }

    const highlight = await resolveYouTubeHighlight({ start, youtubeApiKey, mlbChannelId });
    if (!highlight) {
      missed.push(start.id);
      continue;
    }

    rows.push({
      start_id: start.id,
      video_id: highlight.videoId,
      is_short: highlight.durationSeconds !== null && highlight.durationSeconds < 60,
      source: "youtube-search",
      title: highlight.title,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  if (rows.length > 0) {
    await upsertHighlights(supabaseUrl, serviceKey, rows);
    revalidateTag(HOME_BEST_STARTS_CACHE_TAG, "max");
    revalidatePath("/");
    revalidatePath("/api/home/best-starts");
  }

  return NextResponse.json({
    ok: true,
    dateRange: { start: startDate, end: endDate },
    candidateCount: starts.length,
    matched: rows.map((row) => ({ startId: row.start_id, videoId: row.video_id, title: row.title })),
    skipped,
    missed,
    revalidated: rows.length > 0,
    generatedAt: new Date().toISOString(),
  });
}

async function rankedCandidateStarts({
  startDate,
  endDate,
  candidateLimit,
  minScore,
}: {
  startDate: string;
  endDate: string;
  candidateLimit: number;
  minScore: number;
}) {
  const startsById = new Map<string, StartSummary>();

  for (const season of seasonsInRange(startDate, endDate)) {
    const seasonStarts = await getArchivedSeasonStartSummaries(season);
    for (const start of seasonStarts) {
      if (start.date < startDate || start.date > endDate) continue;
      if (start.source?.line === "fixture" || !isRankedRegularStart(start) || start.gameScorePlus < minScore) continue;
      startsById.set(start.id, start);
    }
  }

  return Array.from(startsById.values())
    .sort(compareBestStarts)
    .slice(0, candidateLimit);
}

async function resolveYouTubeHighlight({
  start,
  youtubeApiKey,
  mlbChannelId,
}: {
  start: StartSummary;
  youtubeApiKey: string;
  mlbChannelId: string;
}) {
  const candidates = await searchHighlightCandidates({ start, youtubeApiKey, mlbChannelId });
  if (candidates.length === 0) return null;

  const durations = await fetchVideoDurations(youtubeApiKey, candidates.map((candidate) => candidate.videoId));
  return candidates
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
  start: StartSummary;
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
    if (!response.ok) continue;

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

async function fetchVideoDurations(youtubeApiKey: string, videoIds: string[]) {
  const durations = new Map<string, number>();
  if (videoIds.length === 0) return durations;

  const params = new URLSearchParams({
    part: "contentDetails",
    id: videoIds.join(","),
    key: youtubeApiKey,
  });
  const response = await fetch(`${YOUTUBE_API_BASE}/videos?${params.toString()}`);
  if (!response.ok) return durations;

  const body = await response.json();
  for (const item of body.items ?? []) {
    if (!item.id || !item.contentDetails?.duration) continue;
    durations.set(item.id, parseIsoDurationSeconds(item.contentDetails.duration));
  }

  return durations;
}

async function resolveMlbChannelId(youtubeApiKey: string) {
  const params = new URLSearchParams({
    part: "id",
    forHandle: MLB_CHANNEL_HANDLE,
    key: youtubeApiKey,
  });
  const response = await fetch(`${YOUTUBE_API_BASE}/channels?${params.toString()}`);
  if (!response.ok) return null;

  const body = await response.json();
  const channelId = body.items?.[0]?.id;
  return typeof channelId === "string" && channelId.startsWith(MLB_CHANNEL_PREFIX) ? channelId : null;
}

async function readStoredHighlightStartIds(supabaseUrl: string, serviceKey: string, startIds: string[]) {
  const stored = new Set<string>();
  if (startIds.length === 0) return stored;

  const url = new URL(`/rest/v1/${HIGHLIGHTS_TABLE}`, supabaseUrl);
  url.searchParams.set("select", "start_id");
  url.searchParams.set("start_id", `in.(${startIds.join(",")})`);

  const response = await fetch(url, {
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!response.ok) throw new Error(`${HIGHLIGHTS_TABLE} read failed with HTTP ${response.status}: ${await response.text()}`);

  const rows = await response.json();
  for (const row of rows ?? []) {
    if (typeof row.start_id === "string") stored.add(row.start_id);
  }
  return stored;
}

async function upsertHighlights(supabaseUrl: string, serviceKey: string, rows: HighlightRow[]) {
  const url = new URL(`/rest/v1/${HIGHLIGHTS_TABLE}`, supabaseUrl);
  url.searchParams.set("on_conflict", "start_id");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });

  if (!response.ok) throw new Error(`${HIGHLIGHTS_TABLE} upsert failed with HTTP ${response.status}: ${await response.text()}`);
}

function compareBestStarts(a: StartSummary, b: StartSummary) {
  return (
    compareRankedStarts(a, b) ||
    b.date.localeCompare(a.date)
  );
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

function seasonsInRange(startDate: string, endDate: string) {
  const seasons: string[] = [];
  for (let year = Number(startDate.slice(0, 4)); year <= Number(endDate.slice(0, 4)); year += 1) {
    seasons.push(String(year));
  }
  return seasons;
}

function publishWindow(date: string) {
  const dateStart = new Date(`${date}T00:00:00.000Z`).getTime();
  return {
    publishedAfter: new Date(dateStart - 6 * 60 * 60 * 1000).toISOString(),
    publishedBefore: new Date(dateStart + 42 * 60 * 60 * 1000).toISOString(),
  };
}

function readDateParam(url: URL, name: string) {
  const value = url.searchParams.get(name);
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function readNumberParam(url: URL, name: string, fallback: number) {
  const value = url.searchParams.get(name);
  const number = value === null ? fallback : Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : fallback;
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

function isAuthorizedCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}
