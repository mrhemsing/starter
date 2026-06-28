import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const MLB_CHANNEL_HANDLE = "MLB";
const MLB_CHANNEL_PREFIX = "UCoLrcjPV5";
const HIGHLIGHTS_TABLE = "toetheslab_featured_start_highlights";
const DEFAULT_SEASON = "2026";
const DEFAULT_LOOKBACK_DAYS = 30;
const DEFAULT_CANDIDATE_LIMIT = 16;
const DEFAULT_MIN_SCORE = 58;
const SEARCH_RESULT_LIMIT = 5;
const ALL_GAME_HIGHLIGHTS_TITLE_PATTERN = /\ball\s+games(?:\s+highlights?)?\b/i;
const NON_START_TITLE_PATTERN = /\b(condensed game|game recap|game highlights|all games|interview|press conference|pregame|preview)\b/i;

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

const season = readArg("season", process.env.THE_BUMP_ARCHIVE_SEASON ?? DEFAULT_SEASON);
const today = toTimeZoneIsoDate(new Date(), process.env.THE_BUMP_TIME_ZONE ?? "America/Los_Angeles");
const defaultEndDate = addDays(today, -1);
const lookbackDays = numberArg("lookback-days", Number(process.env.THE_BUMP_HIGHLIGHT_LOOKBACK_DAYS ?? DEFAULT_LOOKBACK_DAYS));
const explicitDate = readArg("date", process.env.THE_BUMP_HIGHLIGHT_DATE);
const startDate = explicitDate ?? readArg("start", process.env.THE_BUMP_HIGHLIGHT_START ?? addDays(defaultEndDate, -(lookbackDays - 1)));
const endDate = explicitDate ?? readArg("end", process.env.THE_BUMP_HIGHLIGHT_END ?? defaultEndDate);
const archiveRoot = readArg("dir", process.env.THE_BUMP_ARCHIVE_DIR ?? path.join("data", "mlb-archive", season));
const candidateLimit = numberArg("limit", Number(process.env.THE_BUMP_HIGHLIGHT_CANDIDATE_LIMIT ?? DEFAULT_CANDIDATE_LIMIT));
const minScore = numberArg("min-score", Number(process.env.THE_BUMP_HIGHLIGHT_MIN_SCORE ?? DEFAULT_MIN_SCORE));
const dryRun = hasFlag("dry-run") || process.env.THE_BUMP_HIGHLIGHT_DRY_RUN === "1";
const youtubeApiKey = process.env.YOUTUBE_API_KEY;
const supabaseUrl = process.env.THE_BUMP_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.THE_BUMP_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

assertDate(startDate, "start");
assertDate(endDate, "end");
if (startDate > endDate) throw new Error(`start must be on or before end, got ${startDate} > ${endDate}`);
if (!youtubeApiKey) throw new Error("Set YOUTUBE_API_KEY before ingesting featured start highlights");
if (!supabaseUrl || !serviceKey) {
  throw new Error("Set THE_BUMP_SUPABASE_URL and THE_BUMP_SUPABASE_SERVICE_ROLE_KEY before ingesting featured start highlights");
}

const mlbChannelId = await resolveMlbChannelId();
if (!mlbChannelId) throw new Error("Could not resolve the official MLB YouTube channel");

const starts = (await readArchivedStartsInRange())
  .filter((start) => isRankedRegularStart(start) && start.score >= minScore)
  .sort(compareRankedStarts)
  .slice(0, candidateLimit);
const existing = await readStoredHighlightStartIds(starts.map((start) => start.id));
const rows = [];
const misses = [];

for (const start of starts) {
  if (existing.has(start.id)) {
    console.log(`skip stored: ${start.id} ${start.pitcherName}`);
    continue;
  }

  const highlight = await resolveYouTubeHighlight(start);
  if (!highlight) {
    misses.push(start);
    console.log(`no highlight: ${start.id} ${start.pitcherName} GS+ ${start.score}`);
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
  console.log(`matched: ${start.id} ${start.pitcherName} -> ${highlight.videoId} (${highlight.title})`);
}

if (rows.length > 0 && !dryRun) {
  await upsertHighlights(rows);
}

console.log(
  `featured highlight ingest ${dryRun ? "dry-run " : ""}ok: ${startDate}..${endDate}, candidates ${starts.length}, matched ${rows.length}, missed ${misses.length}`,
);

function numberArg(name, fallback) {
  const value = readArg(name, undefined);
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${name} must be a non-negative number`);
  return Math.trunc(number);
}

async function readArchivedStartsInRange() {
  const datesDir = path.join(archiveRoot, "dates");
  const files = (await readdir(datesDir)).filter((file) => file.endsWith(".json")).sort();
  const starts = [];

  for (const file of files) {
    const date = file.replace(/\.json$/, "");
    if (date < startDate || date > endDate) continue;
    const archive = JSON.parse(await readFile(path.join(datesDir, file), "utf8"));
    for (const game of archive.games ?? []) {
      if (!isFinalGame(game)) continue;
      for (const start of game.starts ?? []) {
        const mapped = mapArchivedStart(archive.date, game, start);
        if (mapped) starts.push(mapped);
      }
    }
  }

  return starts;
}

function mapArchivedStart(date, game, start) {
  if (!start?.pitcherMlbId || !start.pitcherName || !start.line) return null;
  const score = scoreCompletedLine(start.line, game.venue, start.opponent);
  return {
    id: `${date}-${start.team.toLowerCase()}-${start.opponent.toLowerCase()}-${start.pitcherMlbId}`,
    date,
    gamePk: start.gamePk,
    pitcherMlbId: start.pitcherMlbId,
    pitcherName: start.pitcherName,
    team: start.team,
    opponent: start.opponent,
    line: start.line,
    score,
  };
}

function scoreCompletedLine(line, venue, opponent) {
  const innings = inningsFromIP(line.inningsPitched);
  const base = 50
    + innings * 2.2
    + line.strikeouts * 1.5
    - line.earnedRuns * 4
    - line.hits * 0.9
    - line.walks * 1.2
    + parkAdjustment(venue)
    + opponentQualityAdjustment(opponent);
  return Math.max(20, Math.min(80, Math.round(base)));
}

function parkAdjustment(venue) {
  const runFactor = {
    "Coors Field": 1.16,
    "Great American Ball Park": 1.08,
    "Fenway Park": 1.05,
    "Wrigley Field": 1.04,
    "Yankee Stadium": 1.03,
    "T-Mobile Park": 0.95,
    "Petco Park": 0.95,
    "Oracle Park": 0.94,
  }[venue] ?? 1;
  return Number(((runFactor - 1) * 10).toFixed(1));
}

function opponentQualityAdjustment(opponent) {
  return {
    ATL: 2.2,
    LAD: 2.5,
    NYY: 2,
    PHI: 1.8,
    HOU: 1.6,
    BAL: 1.4,
    SD: 1.3,
    CHC: 1.1,
    BOS: 0.9,
    TEX: 0.8,
  }[opponent] ?? 0;
}

function isRankedRegularStart(start) {
  return inningsFromIP(start.line.inningsPitched) >= 2;
}

function compareRankedStarts(a, b) {
  return (
    b.score - a.score ||
    inningsFromIP(b.line.inningsPitched) - inningsFromIP(a.line.inningsPitched) ||
    a.line.earnedRuns - b.line.earnedRuns ||
    b.line.strikeouts - a.line.strikeouts ||
    a.line.walks - b.line.walks ||
    a.line.hits - b.line.hits ||
    a.date.localeCompare(b.date) ||
    a.gamePk - b.gamePk ||
    a.pitcherName.localeCompare(b.pitcherName)
  );
}

async function resolveYouTubeHighlight(start) {
  const candidates = await searchHighlightCandidates(start);
  if (candidates.length === 0) return null;

  const durations = await fetchVideoDurations(candidates.map((candidate) => candidate.videoId));
  return candidates
    .map((candidate) => ({
      ...candidate,
      durationSeconds: durations.get(candidate.videoId) ?? null,
    }))
    .sort((a, b) => candidateScore(b, start) - candidateScore(a, start))[0] ?? null;
}

async function searchHighlightCandidates(start) {
  const { publishedAfter, publishedBefore } = publishWindow(start.date);
  const queries = [
    `${start.pitcherName} strikeouts`,
    `${start.pitcherName} ${start.team} highlight`,
  ];
  const items = [];

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
    if (!response.ok) {
      console.warn(`youtube search failed for ${start.id}: HTTP ${response.status}`);
      continue;
    }

    const body = await response.json();
    items.push(...(body.items ?? []));
  }

  const lastNamePattern = new RegExp(`\\b${escapeRegExp(lastName(start.pitcherName))}\\b`, "i");
  const seenVideoIds = new Set();

  return items
    .map((item) => {
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
        teamInTitle: new RegExp(`\\b${escapeRegExp(start.team)}\\b`, "i").test(title),
      };
    })
    .filter(Boolean);
}

async function fetchVideoDurations(videoIds) {
  const durations = new Map();
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

function candidateScore(candidate) {
  let score = 0;
  if (candidate.lastNameInTitle) score += 100;
  if (candidate.strikeoutInTitle) score += 35;
  if (candidate.teamInTitle) score += 10;
  if (candidate.durationSeconds !== null && candidate.durationSeconds < 60) score += 15;
  score -= candidate.hoursFromStartDateNoon;
  return score;
}

async function resolveMlbChannelId() {
  const params = new URLSearchParams({
    part: "id",
    forHandle: MLB_CHANNEL_HANDLE,
    key: youtubeApiKey,
  });
  const response = await fetch(`${YOUTUBE_API_BASE}/channels?${params.toString()}`);
  if (!response.ok) return null;

  const body = await response.json();
  const channelId = body.items?.[0]?.id;
  return channelId?.startsWith(MLB_CHANNEL_PREFIX) ? channelId : null;
}

async function readStoredHighlightStartIds(startIds) {
  const stored = new Set();
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
    if (row.start_id) stored.add(row.start_id);
  }
  return stored;
}

async function upsertHighlights(rows) {
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

function publishWindow(date) {
  const dateStart = new Date(`${date}T00:00:00.000Z`).getTime();
  return {
    publishedAfter: new Date(dateStart - 6 * 60 * 60 * 1000).toISOString(),
    publishedBefore: new Date(dateStart + 42 * 60 * 60 * 1000).toISOString(),
  };
}

function inningsFromIP(value) {
  const whole = Math.trunc(value);
  return whole + (Math.round((value - whole) * 10) / 3);
}

function parseIsoDurationSeconds(duration) {
  const match = duration.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;

  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
  return Number(days) * 86400 + Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function isFinalGame(game) {
  return game.status?.abstract === "Final" || game.status?.detailed === "Final" || game.status?.detailed === "Completed Early";
}

function lastName(name) {
  return name.trim().split(/\s+/).at(-1) ?? name;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD, got ${value}`);
  }
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function toTimeZoneIsoDate(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? String(date.getUTCFullYear());
  const month = parts.find((part) => part.type === "month")?.value ?? String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = parts.find((part) => part.type === "day")?.value ?? String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
