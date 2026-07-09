import type { ArchivedCompletedStartSummary } from "@/lib/data/mlb-archive";
import { readCompleteCanonicalSlateStateDates } from "@/lib/data/canonical-start-store";
import type { ArchivedPitcherRecentArsenal, ArsenalPitchSummary, FeaturedStartHighlight, PitchEvent, StartLine, TeamSummary } from "@/lib/types";

type SupabaseCompletedStartRow = {
  date: string;
  game_pk: number;
  game_date: string;
  venue: string;
  away_team: Pick<TeamSummary, "abbreviation" | "name">;
  home_team: Pick<TeamSummary, "abbreviation" | "name">;
  pitcher_mlb_id: number;
  pitcher_name: string;
  team: string;
  opponent: string;
  side: "home" | "away";
  result: ArchivedCompletedStartSummary["result"];
  line: StartLine;
  pitch_event_count?: number | null;
  arsenal?: ArsenalPitchSummary[] | null;
  pitch_events?: PitchEvent[] | null;
  archived_at?: string | null;
};

type SupabaseFeaturedStartHighlightRow = {
  start_id: string;
  video_id: string;
  is_short: boolean | null;
};

type SupabasePitcherArchiveArsenalRow = {
  season: string;
  pitcher_mlb_id: number;
  pitcher_name: string;
  team: string;
  arsenal: ArsenalPitchSummary[];
  starts: number;
  pitch_events: number;
  first_start_date: string;
  last_start_date: string;
  start_date: string;
  end_date: string;
  archived_at: string;
  source: "mlb-stats-api";
};

type SupabaseArchiveManifestRow = {
  season: string;
  start_date: string;
  end_date: string;
  counts: {
    starts?: number;
  } | null;
  synced_at?: string | null;
};

const COMPLETED_STARTS_TABLE = "toetheslab_mlb_completed_starts";
const PITCHER_ARCHIVE_ARSENALS_TABLE = "toetheslab_pitcher_archive_arsenals";
const FEATURED_START_HIGHLIGHTS_TABLE = "toetheslab_featured_start_highlights";
const ARCHIVE_MANIFESTS_TABLE = "toetheslab_mlb_archive_manifests";
const PAGE_SIZE = 1000;
const SUPABASE_ARCHIVE_REVALIDATE_SECONDS = 15 * 60;
const COMPLETED_STARTS_SELECT = "date,game_pk,game_date,venue,away_team,home_team,pitcher_mlb_id,pitcher_name,team,opponent,side,result,line";
const PITCHER_ARCHIVE_ARSENAL_SELECT = "season,pitcher_mlb_id,pitcher_name,team,arsenal,starts,pitch_events,first_start_date,last_start_date,start_date,end_date,archived_at,source";
const FEATURED_START_HIGHLIGHT_SELECT = "start_id,video_id,is_short";
export const ARCHIVE_FRESHNESS_MAX_LAG_DAYS = 2;

type SupabaseArchiveStatusOptions = {
  expectedLastCompletedDate?: string;
};

export function isSupabaseArchiveConfigured() {
  return Boolean(supabaseUrl() && supabaseServiceKey());
}

export async function getSupabaseArchiveStatus(season: string, options: SupabaseArchiveStatusOptions = {}) {
  const configured = isSupabaseArchiveConfigured();
  const env = {
    THE_BUMP_SUPABASE_URL: Boolean(process.env.THE_BUMP_SUPABASE_URL),
    SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    THE_BUMP_SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.THE_BUMP_SUPABASE_SERVICE_ROLE_KEY),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    THE_BUMP_SUPABASE_SECRET_KEY: Boolean(process.env.THE_BUMP_SUPABASE_SECRET_KEY),
    SUPABASE_SECRET_KEY: Boolean(process.env.SUPABASE_SECRET_KEY),
  };

  if (!configured) {
    return {
      configured,
      env,
      starts: 0,
      firstDate: null,
      lastDate: null,
      freshness: archiveFreshness(null, options.expectedLastCompletedDate),
      settledSlateGap: archiveSettledSlateGap(null, null),
      error: null,
    };
  }

  try {
    const manifest = await readSupabaseArchiveManifest(season);
    const starts = manifest ? [] : await readSupabaseArchivedSeasonCompletedStarts(season);
    const firstDate = manifest?.start_date ?? starts[0]?.date ?? null;
    const lastDate = manifest?.end_date ?? starts.at(-1)?.date ?? null;
    const startCount = manifest?.counts?.starts ?? starts.length;
    const freshness = archiveFreshness(lastDate, options.expectedLastCompletedDate);
    const completeSlateDates = await readCompleteCanonicalSlateStateDates(season);
    const latestCompleteSlateDate = latestCanonicalCompleteSlateDate(completeSlateDates, options.expectedLastCompletedDate);
    const settledSlateGap = archiveSettledSlateGap(lastDate, latestCompleteSlateDate);
    if (freshness.stale) {
      console.error("[supabase-archive] archive freshness lag exceeds threshold", {
        expectedLastCompletedDate: freshness.expectedLastCompletedDate,
        lastDate,
        lagDays: freshness.lagDays,
        maxLagDays: ARCHIVE_FRESHNESS_MAX_LAG_DAYS,
      });
    }
    if (settledSlateGap.stale) {
      console.error("[supabase-archive] archive trails canonical complete slate", {
        latestCompleteSlateDate: settledSlateGap.latestCompleteSlateDate,
        lastDate,
        lagDays: settledSlateGap.lagDays,
      });
    }

    return {
      configured,
      env,
      starts: startCount,
      firstDate,
      lastDate,
      freshness,
      settledSlateGap,
      error: null,
    };
  } catch (error) {
    return {
      configured,
      env,
      starts: 0,
      firstDate: null,
      lastDate: null,
      freshness: archiveFreshness(null, options.expectedLastCompletedDate),
      settledSlateGap: archiveSettledSlateGap(null, null),
      error: error instanceof Error ? error.message : "Unknown Supabase archive error",
    };
  }
}

export async function readSupabaseArchivedCompletedStarts(date: string): Promise<ArchivedCompletedStartSummary[]> {
  if (!isSupabaseArchiveConfigured()) return [];

  const rows = await fetchCompletedStartRows({
    select: COMPLETED_STARTS_SELECT,
    date: `eq.${date}`,
    order: "game_pk.asc,pitcher_mlb_id.asc",
  });

  return rows.map(rowToCompletedStart);
}

export async function readSupabaseArchivedSeasonCompletedStarts(season: string): Promise<ArchivedCompletedStartSummary[]> {
  if (!isSupabaseArchiveConfigured()) return [];

  return readSupabaseArchivedCompletedStartsRange(`${season}-01-01`, `${season}-12-31`);
}

export async function readSupabaseArchivedCompletedStartsRange(startDate: string, endDate: string): Promise<ArchivedCompletedStartSummary[]> {
  if (!isSupabaseArchiveConfigured()) return [];

  const rows = await fetchCompletedStartRows({
    select: COMPLETED_STARTS_SELECT,
    date: [`gte.${startDate}`, `lte.${endDate}`],
    order: "date.asc,game_pk.asc,pitcher_mlb_id.asc",
  });

  return rows.map(rowToCompletedStart);
}

export async function readSupabaseArchivedPitcherRecentArsenal(pitcherMlbId: number, season: string, maxStarts = 5): Promise<ArchivedPitcherRecentArsenal | null> {
  if (!isSupabaseArchiveConfigured()) return null;

  const rows = await fetchSupabaseRows<SupabasePitcherArchiveArsenalRow>(
    PITCHER_ARCHIVE_ARSENALS_TABLE,
    {
      select: PITCHER_ARCHIVE_ARSENAL_SELECT,
      season: `eq.${season}`,
      pitcher_mlb_id: `eq.${pitcherMlbId}`,
      limit: "1",
    },
    0,
    0,
  );
  const row = rows[0];
  if (!row || row.starts <= 0 || row.pitch_events <= 0 || !Array.isArray(row.arsenal) || row.arsenal.length === 0) return null;

  return {
    source: "archive-gamefeed",
    arsenal: row.arsenal,
    pitchEvents: [],
    archiveArsenal: {
      season,
      startDate: row.start_date,
      endDate: row.end_date,
      archivedAt: row.archived_at,
      source: row.source,
      starts: Math.min(row.starts, maxStarts),
      pitchEvents: row.pitch_events,
      firstStartDate: row.first_start_date,
      lastStartDate: row.last_start_date,
    },
  };
}

export async function readSupabaseFeaturedStartHighlight(startId: string): Promise<FeaturedStartHighlight | null> {
  if (!isSupabaseArchiveConfigured()) return null;

  const rows = await fetchSupabaseRows<SupabaseFeaturedStartHighlightRow>(
    FEATURED_START_HIGHLIGHTS_TABLE,
    {
      select: FEATURED_START_HIGHLIGHT_SELECT,
      start_id: `eq.${startId}`,
      limit: "1",
    },
    0,
    0,
  );
  const row = rows[0];
  if (!row?.video_id) return null;

  return highlightFromStoredVideoId(row.video_id, Boolean(row.is_short));
}

type SupabaseRowFilters = Record<string, string | string[]> & {
  select: string;
};

async function fetchCompletedStartRows(filters: SupabaseRowFilters) {
  const rows: SupabaseCompletedStartRow[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const batch = await fetchSupabaseRows<SupabaseCompletedStartRow>(COMPLETED_STARTS_TABLE, filters, offset, offset + PAGE_SIZE - 1);
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}

function highlightFromStoredVideoId(videoId: string, isShort: boolean): FeaturedStartHighlight {
  return {
    videoId,
    source: "stored",
    isShort,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

async function readSupabaseArchiveManifest(season: string): Promise<SupabaseArchiveManifestRow | null> {
  const rows = await fetchSupabaseRows<SupabaseArchiveManifestRow>(
    ARCHIVE_MANIFESTS_TABLE,
    {
      season: `eq.${season}`,
      select: "season,start_date,end_date,counts,synced_at",
      limit: "1",
    },
    0,
    0,
  );
  return rows[0] ?? null;
}

async function fetchSupabaseRows<T>(table: string, filters: SupabaseRowFilters, from: number, to: number): Promise<T[]> {
  const baseUrl = supabaseUrl();
  const key = supabaseServiceKey();
  if (!baseUrl || !key) return [];

  const url = new URL(`/rest/v1/${table}`, baseUrl);
  url.searchParams.set("select", filters.select);

  for (const [name, value] of Object.entries(filters)) {
    if (name === "select") continue;
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      url.searchParams.append(name, item);
    }
  }

  try {
    const response = await fetch(url, {
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        range: `${from}-${to}`,
      },
      next: { revalidate: SUPABASE_ARCHIVE_REVALIDATE_SECONDS },
    });

    if (!response.ok) return [];
    return await response.json() as T[];
  } catch {
    return [];
  }
}

function rowToCompletedStart(row: SupabaseCompletedStartRow): ArchivedCompletedStartSummary {
  return {
    date: row.date,
    gamePk: row.game_pk,
    gameDate: row.game_date,
    venue: row.venue,
    awayTeam: row.away_team,
    homeTeam: row.home_team,
    pitcherMlbId: row.pitcher_mlb_id,
    pitcherName: row.pitcher_name,
    team: row.team,
    opponent: row.opponent,
    side: row.side,
    result: row.result,
    line: row.line,
  };
}

function archiveFreshness(lastDate: string | null, expectedLastCompletedDate: string | undefined) {
  const lagDays = lastDate && expectedLastCompletedDate ? Math.max(0, daysBetween(lastDate, expectedLastCompletedDate)) : null;

  return {
    expectedLastCompletedDate: expectedLastCompletedDate ?? null,
    lagDays,
    maxLagDays: ARCHIVE_FRESHNESS_MAX_LAG_DAYS,
    stale: typeof lagDays === "number" && lagDays > ARCHIVE_FRESHNESS_MAX_LAG_DAYS,
  };
}

function latestCanonicalCompleteSlateDate(dates: string[], expectedLastCompletedDate: string | undefined) {
  const eligibleDates = expectedLastCompletedDate ? dates.filter((date) => date <= expectedLastCompletedDate) : dates;
  return eligibleDates.at(-1) ?? null;
}

function archiveSettledSlateGap(lastDate: string | null, latestCompleteSlateDate: string | null) {
  const lagDays = lastDate && latestCompleteSlateDate ? Math.max(0, daysBetween(lastDate, latestCompleteSlateDate)) : null;

  return {
    latestCompleteSlateDate,
    lagDays,
    stale: typeof lagDays === "number" && lagDays > 0,
  };
}

function daysBetween(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / 86_400_000);
}

function supabaseUrl() {
  return process.env.THE_BUMP_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

function supabaseServiceKey() {
  return process.env.THE_BUMP_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.THE_BUMP_SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "";
}
