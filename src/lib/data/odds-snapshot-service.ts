import { readRuntimeState, writeRuntimeState } from "@/lib/data/runtime-state-store";
import { fetchMlbOddsMarketContextsWithDiagnostics, isOddsEligibleDate, normalizeOddsName, type MlbOddsGameMarketContext } from "@/lib/data/odds-client";
import { getHomeSlateDate, getSlateSchedule } from "@/lib/data/start-service";
import type { MlbScheduleGame } from "@/lib/types";

export const ODDS_SYNC_CADENCE_LABEL = "probables-confirm-midday-pre-first-pitch";
const ODDS_SNAPSHOT_VERSION = 1;

type StoredLine = {
  name: string;
  normalizedName: string;
  line: number;
};

type StoredStarterSnapshot = {
  pitcherId: number | null;
  name: string | null;
  normalizedName: string | null;
  side: "home" | "away";
  team: string;
  strikeoutPropLine: number | null;
};

type StoredGameSnapshot = {
  gamePk: string;
  eventId: string;
  firstPitch: string;
  capturedAt: string;
  source: "the-odds-api";
  frozen: boolean;
  gameTotal: number | null;
  teamTotals: StoredLine[];
  pitcherStrikeouts: StoredLine[];
  starters: StoredStarterSnapshot[];
};

type OddsSnapshotState = {
  version: number;
  date: string;
  capturedAt: string;
  cadence: typeof ODDS_SYNC_CADENCE_LABEL;
  source: "the-odds-api";
  games: StoredGameSnapshot[];
};

export type OddsSnapshotSyncResult = {
  date: string;
  attempted: boolean;
  reason?: string;
  capturedAt: string;
  games: number;
  updatedGames: number;
  frozenGames: number;
  credits: {
    used: string | null;
    remaining: string | null;
  };
  persisted: boolean;
  diagnostics: {
    requestedGames: number;
    eventsSeen: number;
    matchedGames: number;
    marketFetches: number;
    error: string | null;
  };
};

export async function readOddsSnapshotMarketContexts(date: string): Promise<Map<string, MlbOddsGameMarketContext>> {
  const snapshot = await readRuntimeState<OddsSnapshotState>(oddsSnapshotStateKey(date));
  if (!isOddsSnapshotState(snapshot)) return new Map();
  return storedSnapshotToContexts(snapshot);
}

export async function syncOddsSnapshotsForDefaultDates() {
  const today = getHomeSlateDate();
  const dates = [today, addDays(today, 1)];
  const uniqueDates = [...new Set(dates)].filter(isOddsEligibleDate);
  return Promise.all(uniqueDates.map((date) => syncOddsSnapshotForDate(date)));
}

export async function syncOddsSnapshotForDate(date: string): Promise<OddsSnapshotSyncResult> {
  const capturedAt = new Date().toISOString();
  if (!process.env.THE_BUMP_ODDS_API_KEY) {
    return emptySyncResult(date, capturedAt, "missing-api-key");
  }
  if (!isOddsEligibleDate(date)) {
    return emptySyncResult(date, capturedAt, "date-outside-odds-window");
  }

  const schedule = await getSlateSchedule({ window: "today", date });
  if (schedule.games.length === 0) {
    return emptySyncResult(date, capturedAt, "no-games");
  }

  const previous = await readRuntimeState<OddsSnapshotState>(oddsSnapshotStateKey(date));
  const previousGames = new Map(isOddsSnapshotState(previous) ? previous.games.map((game) => [game.gamePk, game]) : []);
  const pregameGames = schedule.games.filter((game) => !hasGameStarted(game));
  const diagnostics = await fetchMlbOddsMarketContextsWithDiagnostics(pregameGames);
  const nextGames: StoredGameSnapshot[] = [];
  let updatedGames = 0;
  let frozenGames = 0;

  for (const game of schedule.games) {
    const previousGame = previousGames.get(String(game.gamePk));
    if (hasGameStarted(game)) {
      if (previousGame) {
        nextGames.push({ ...previousGame, frozen: true });
        frozenGames += 1;
      }
      continue;
    }

    const context = diagnostics.contexts.get(String(game.gamePk));
    if (context) {
      nextGames.push(contextToStoredGame(game, context, diagnostics.capturedAt));
      updatedGames += 1;
    } else if (previousGame) {
      nextGames.push(previousGame);
    }
  }

  const snapshot: OddsSnapshotState = {
    version: ODDS_SNAPSHOT_VERSION,
    date,
    capturedAt: diagnostics.capturedAt,
    cadence: ODDS_SYNC_CADENCE_LABEL,
    source: "the-odds-api",
    games: nextGames,
  };
  const persisted = await writeRuntimeState(oddsSnapshotStateKey(date), snapshot);

  console.log("[odds-sync] snapshot", {
    date,
    cadence: ODDS_SYNC_CADENCE_LABEL,
    capturedAt: diagnostics.capturedAt,
    games: schedule.games.length,
    updatedGames,
    frozenGames,
    creditsUsed: diagnostics.credits.used,
    creditsRemaining: diagnostics.credits.remaining,
    requestedGames: diagnostics.requestedGames,
    eventsSeen: diagnostics.eventsSeen,
    matchedGames: diagnostics.matchedGames,
    marketFetches: diagnostics.marketFetches,
    error: diagnostics.error,
    persisted,
  });

  return {
    date,
    attempted: true,
    capturedAt: diagnostics.capturedAt,
    games: schedule.games.length,
    updatedGames,
    frozenGames,
    credits: diagnostics.credits,
    persisted,
    diagnostics: {
      requestedGames: diagnostics.requestedGames,
      eventsSeen: diagnostics.eventsSeen,
      matchedGames: diagnostics.matchedGames,
      marketFetches: diagnostics.marketFetches,
      error: diagnostics.error,
    },
  };
}

function contextToStoredGame(game: MlbScheduleGame, context: MlbOddsGameMarketContext, capturedAt: string): StoredGameSnapshot {
  return {
    gamePk: String(game.gamePk),
    eventId: context.eventId,
    firstPitch: game.gameDate,
    capturedAt,
    source: "the-odds-api",
    frozen: false,
    gameTotal: context.gameTotal,
    teamTotals: mapToStoredLines(context.teamTotals),
    pitcherStrikeouts: mapToStoredLines(context.pitcherStrikeouts),
    starters: [
      starterSnapshot(game.probableAwayPitcher?.id ?? null, game.probableAwayPitcher?.fullName ?? null, "away", game.awayTeam.abbreviation, context),
      starterSnapshot(game.probableHomePitcher?.id ?? null, game.probableHomePitcher?.fullName ?? null, "home", game.homeTeam.abbreviation, context),
    ],
  };
}

function starterSnapshot(pitcherId: number | null, name: string | null, side: "home" | "away", team: string, context: MlbOddsGameMarketContext): StoredStarterSnapshot {
  const normalizedName = name ? normalizeOddsName(name) : null;
  return {
    pitcherId,
    name,
    normalizedName,
    side,
    team,
    strikeoutPropLine: normalizedName ? context.pitcherStrikeouts.get(normalizedName) ?? null : null,
  };
}

function storedSnapshotToContexts(snapshot: OddsSnapshotState) {
  const contexts = new Map<string, MlbOddsGameMarketContext>();
  for (const game of snapshot.games) {
    contexts.set(game.gamePk, {
      source: "the-odds-api",
      eventId: game.eventId,
      gameTotal: game.gameTotal,
      teamTotals: storedLinesToMap(game.teamTotals),
      pitcherStrikeouts: storedLinesToMap(game.pitcherStrikeouts),
      capturedAt: game.capturedAt,
    });
  }
  return contexts;
}

function mapToStoredLines(map: Map<string, number>): StoredLine[] {
  return [...map.entries()].map(([normalizedName, line]) => ({
    name: normalizedName,
    normalizedName,
    line,
  }));
}

function storedLinesToMap(lines: StoredLine[]) {
  return new Map(lines.map((line) => [line.normalizedName, line.line]));
}

function hasGameStarted(game: MlbScheduleGame) {
  const raw = `${game.status} ${game.detailedState}`.trim().toLowerCase();
  return raw.includes("live") || raw.includes("in progress") || raw.includes("final") || raw.includes("game over");
}

function isOddsSnapshotState(value: unknown): value is OddsSnapshotState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<OddsSnapshotState>;
  return candidate.version === ODDS_SNAPSHOT_VERSION && typeof candidate.date === "string" && Array.isArray(candidate.games);
}

function oddsSnapshotStateKey(date: string) {
  return `odds-snapshot:${date}`;
}

function emptySyncResult(date: string, capturedAt: string, reason: string): OddsSnapshotSyncResult {
  console.log("[odds-sync] skipped", { date, reason, capturedAt });
  return {
    date,
    attempted: false,
    reason,
    capturedAt,
    games: 0,
    updatedGames: 0,
    frozenGames: 0,
    credits: { used: null, remaining: null },
    persisted: false,
    diagnostics: {
      requestedGames: 0,
      eventsSeen: 0,
      matchedGames: 0,
      marketFetches: 0,
      error: reason,
    },
  };
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
