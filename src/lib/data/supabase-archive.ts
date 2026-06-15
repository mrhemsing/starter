import type { ArchivedCompletedStartSummary } from "@/lib/data/mlb-archive";
import type { FeaturedStartHighlight, StartLine, TeamSummary } from "@/lib/types";

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
};

type SupabaseFeaturedStartHighlightRow = {
  start_id: string;
  video_id: string;
  is_short: boolean | null;
};

const COMPLETED_STARTS_TABLE = "frontfive_mlb_completed_starts";
const FEATURED_START_HIGHLIGHTS_TABLE = "frontfive_featured_start_highlights";
const PAGE_SIZE = 1000;

export function isSupabaseArchiveConfigured() {
  return Boolean(supabaseUrl() && supabaseServiceKey());
}

export async function getSupabaseArchiveStatus(season: string) {
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
    return { configured, env, starts: 0, firstDate: null, lastDate: null, error: null };
  }

  try {
    const starts = await readSupabaseArchivedSeasonCompletedStarts(season);
    return {
      configured,
      env,
      starts: starts.length,
      firstDate: starts[0]?.date ?? null,
      lastDate: starts.at(-1)?.date ?? null,
      error: null,
    };
  } catch (error) {
    return {
      configured,
      env,
      starts: 0,
      firstDate: null,
      lastDate: null,
      error: error instanceof Error ? error.message : "Unknown Supabase archive error",
    };
  }
}

export async function readSupabaseArchivedCompletedStarts(date: string): Promise<ArchivedCompletedStartSummary[]> {
  if (!isSupabaseArchiveConfigured()) return [];

  const rows = await fetchCompletedStartRows({
    date: `eq.${date}`,
    order: "game_pk.asc,pitcher_mlb_id.asc",
  });

  return rows.map(rowToCompletedStart);
}

export async function readSupabaseArchivedSeasonCompletedStarts(season: string): Promise<ArchivedCompletedStartSummary[]> {
  if (!isSupabaseArchiveConfigured()) return [];

  const rows = await fetchCompletedStartRows({
    date: [`gte.${season}-01-01`, `lte.${season}-12-31`],
    order: "date.asc,game_pk.asc,pitcher_mlb_id.asc",
  });

  return rows.map(rowToCompletedStart);
}

export async function readSupabaseFeaturedStartHighlight(startId: string): Promise<FeaturedStartHighlight | null> {
  if (!isSupabaseArchiveConfigured()) return null;

  const rows = await fetchSupabaseRows<SupabaseFeaturedStartHighlightRow>(
    FEATURED_START_HIGHLIGHTS_TABLE,
    {
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

async function fetchCompletedStartRows(filters: Record<string, string | string[]>) {
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

async function fetchSupabaseRows<T>(table: string, filters: Record<string, string | string[]>, from: number, to: number): Promise<T[]> {
  const baseUrl = supabaseUrl();
  const key = supabaseServiceKey();
  if (!baseUrl || !key) return [];

  const url = new URL(`/rest/v1/${table}`, baseUrl);
  url.searchParams.set("select", "*");

  for (const [name, value] of Object.entries(filters)) {
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
      next: { revalidate: 15 * 60 },
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

function supabaseUrl() {
  return process.env.THE_BUMP_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

function supabaseServiceKey() {
  return process.env.THE_BUMP_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.THE_BUMP_SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "";
}
