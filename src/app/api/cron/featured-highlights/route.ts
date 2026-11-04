import { resolveMlbChannelId, resolveYouTubeHighlight } from "@/lib/data/highlight-discovery";
import { skipSeasonJob } from "@/lib/season-state";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { HOME_BEST_STARTS_CACHE_TAG } from "@/lib/data/home-best-starts-service";
import { addDays, getArchivedSeasonStartSummaries, getHomeSlateDate } from "@/lib/data/start-service";
import { isRankedRegularStart } from "@/lib/start-classification";
import { compareRankedStarts } from "@/lib/start-ranking";
import type { StartSummary } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HIGHLIGHTS_TABLE = "toetheslab_featured_start_highlights";
const DEFAULT_LOOKBACK_DAYS = 30;
const DEFAULT_CANDIDATE_LIMIT = 16;
const DEFAULT_MIN_SCORE = 58;

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
  if (await skipSeasonJob("featured-highlights")) return NextResponse.json({ ok: true, skipped: "season complete" });

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

function seasonsInRange(startDate: string, endDate: string) {
  const seasons: string[] = [];
  for (let year = Number(startDate.slice(0, 4)); year <= Number(endDate.slice(0, 4)); year += 1) {
    seasons.push(String(year));
  }
  return seasons;
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

function isAuthorizedCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}
