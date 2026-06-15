import type { ArchivedCompletedStartSummary } from "@/lib/data/mlb-archive";
import type { StartLine, TeamSummary } from "@/lib/types";

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

const COMPLETED_STARTS_TABLE = "frontfive_mlb_completed_starts";
const PAGE_SIZE = 1000;

export function isSupabaseArchiveConfigured() {
  return Boolean(supabaseUrl() && supabaseServiceKey());
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

async function fetchCompletedStartRows(filters: Record<string, string | string[]>) {
  const rows: SupabaseCompletedStartRow[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const batch = await fetchSupabaseRows<SupabaseCompletedStartRow>(COMPLETED_STARTS_TABLE, filters, offset, offset + PAGE_SIZE - 1);
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
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
  return process.env.THE_BUMP_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
}

function supabaseServiceKey() {
  return process.env.THE_BUMP_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}
