import { unstable_cache } from "next/cache";
import { fetchMlbLivePitchingLines, fetchMlbSchedule } from "@/lib/data/mlb-stats-client";
import { getDailySlate, getHomeSlateDate, scoreCompletedLine } from "@/lib/data/start-service";
import { getTonightMustWatch } from "@/lib/data/tonight-service";
import { inningsFromIP } from "@/lib/innings";
import { liveDateHref, sourceParams, startHref } from "@/lib/routes";
import { normalizeScheduleStatus } from "@/lib/slate-state";
import type { MlbLivePitchingLine, MlbScheduleGame, StartLine, StartSummary, TonightResponse } from "@/lib/types";

export const LIVE_SCOREBOARD_REVALIDATE_SECONDS = 30;
const LIVE_LEADER_MIN_INNINGS = 4;

export type LiveScoreboardStatus = "live" | "final" | "warming" | "delay";

export type LiveScoreboardRow = {
  id: string;
  startId: string;
  gamePk: number;
  pitcherId: string;
  pitcherMlbId: number;
  pitcherName: string;
  team: string;
  opponent: string;
  side: "home" | "away";
  firstPitch: string;
  status: LiveScoreboardStatus;
  line: StartLine;
  gsPlus: number | null;
  projectedGsPlus: number | null;
  scoreLabel: "PROJ" | "PROV" | "FINAL";
  qualityLabel: "Elite" | "Plus" | "Solid" | "Below" | "Poor" | null;
  provisional: boolean;
  inningLabel: string | null;
  pitchCount: number | null;
  startHref: string;
  liveHref: string;
};

export type LiveScoreboard = {
  date: string;
  generatedAt: string;
  hasGames: boolean;
  hasActiveStarts: boolean;
  totalStarts: number;
  liveStarts: number;
  finalStarts: number;
  warmingStarts: number;
  delayStarts: number;
  rows: LiveScoreboardRow[];
  leader: LiveScoreboardRow | null;
};

const getCachedLiveScoreboard = unstable_cache(
  async (date: string) => buildLiveScoreboard(date),
  ["live-scoreboard", "v4"],
  { revalidate: LIVE_SCOREBOARD_REVALIDATE_SECONDS },
);

export async function getLiveScoreboard({ date = getHomeSlateDate() }: { date?: string } = {}): Promise<LiveScoreboard> {
  return getCachedLiveScoreboard(date);
}

async function buildLiveScoreboard(date: string): Promise<LiveScoreboard> {
  const [slate, schedule, upcoming] = await Promise.all([
    getDailySlate({ window: "today", date }),
    fetchMlbSchedule(date, { fetchLive: true, gamefeedRevalidateSeconds: LIVE_SCOREBOARD_REVALIDATE_SECONDS }),
    getTonightMustWatch({ date, window: 5 }),
  ]);

  const liveLinesByStart = await getLiveLinesByStart(schedule.games);
  const gamesByPk = new Map(schedule.games.map((game) => [game.gamePk, game]));
  const projectionsByStart = getUpcomingProjectionMap(upcoming);

  const rows = slate.flatMap((start) => {
    const game = gamesByPk.get(start.gamePk);
    if (game && normalizeScheduleStatus(game) === "ppd") return [];

    const liveLine = liveLinesByStart.get(lineKey(start.gamePk, start.pitcher.mlbId));
    return [buildLiveRow(date, start, liveLine, game, projectionsByStart)];
  });

  rows.sort(compareLiveRows);

  const scoredRows = rows.filter(isScoredRow);
  const leaderRows = scoredRows.filter(isLiveLeaderEligibleRow);
  const liveStarts = rows.filter((row) => row.status === "live").length;
  const finalStarts = rows.filter((row) => row.status === "final").length;
  const warmingStarts = rows.filter((row) => row.status === "warming").length;
  const delayStarts = rows.filter((row) => row.status === "delay").length;

  return {
    date,
    generatedAt: new Date().toISOString(),
    hasGames: rows.length > 0,
    hasActiveStarts: liveStarts > 0 || delayStarts > 0,
    totalStarts: rows.length,
    liveStarts,
    finalStarts,
    warmingStarts,
    delayStarts,
    rows,
    leader: leaderRows[0] ?? null,
  };
}

async function getLiveLinesByStart(games: MlbScheduleGame[]) {
  const liveGames = games.filter((game) => {
    const status = normalizeScheduleStatus(game);
    return status === "live" || status === "delayed" || status === "final" || status === "suspended";
  });
  const lineGroups = await Promise.all(
    liveGames.map((game) => fetchMlbLivePitchingLines(game.gamePk, { fetchLive: true, gamefeedRevalidateSeconds: LIVE_SCOREBOARD_REVALIDATE_SECONDS })),
  );
  const lines = new Map<string, MlbLivePitchingLine>();

  for (const line of lineGroups.flat()) {
    lines.set(lineKey(line.gamePk, line.pitcherMlbId), line);
  }

  return lines;
}

function buildLiveRow(
  date: string,
  start: StartSummary,
  liveLine: MlbLivePitchingLine | undefined,
  game: MlbScheduleGame | undefined,
  projectionsByStart: Map<string, number | null>,
): LiveScoreboardRow {
  const scheduleStatus = game ? normalizeScheduleStatus(game) : "pregame";
  const rawStatus = normalizeLiveStatus(liveLine?.gameStatus, scheduleStatus);
  const status = !liveLine && rawStatus === "live" ? "warming" : rawStatus;
  const line = liveLine?.line ?? start.line;
  const projectedGsPlus = projectionsByStart.get(lineKey(start.gamePk, start.pitcher.mlbId)) ?? null;
  const hasRealLine = Boolean(liveLine && status !== "warming" && hasNonEmptyLine(line));
  const scoreLabel = !hasRealLine ? "PROJ" : status === "final" ? "FINAL" : "PROV";
  const gsPlus = hasRealLine ? scoreCompletedLine(line, start.context) : null;
  const pitchCount = hasRealLine ? line.pitches : null;

  return {
    id: `${start.gamePk}-${start.pitcher.mlbId}`,
    startId: start.id,
    gamePk: start.gamePk,
    pitcherId: start.pitcher.id,
    pitcherMlbId: start.pitcher.mlbId,
    pitcherName: start.pitcher.name,
    team: start.pitcher.team,
    opponent: start.opponent,
    side: start.side ?? "away",
    firstPitch: game?.gameDate ?? start.date,
    status,
    line,
    gsPlus,
    projectedGsPlus,
    scoreLabel,
    qualityLabel: gsPlus === null ? null : qualityLabel(gsPlus),
    provisional: scoreLabel === "PROV",
    inningLabel: liveLine?.inningLabel ?? null,
    pitchCount,
    startHref: startHref(start, sourceParams("live")),
    liveHref: liveDateHref(date),
  };
}

function getUpcomingProjectionMap(upcoming: TonightResponse) {
  const projections = new Map<string, number | null>();

  for (const game of upcoming.games) {
    for (const starter of game.starters) {
      if (!starter.pitcherId) continue;
      projections.set(lineKey(Number(game.gamePk), Number(starter.pitcherId)), starter.projection?.projectedGsPlus ?? null);
    }
  }

  return projections;
}

function hasNonEmptyLine(line: StartLine) {
  return line.pitches > 0 || line.inningsPitched > 0 || line.hits > 0 || line.earnedRuns > 0 || line.walks > 0 || line.strikeouts > 0;
}

function normalizeLiveStatus(liveStatus: MlbLivePitchingLine["gameStatus"] | undefined, scheduleStatus: ReturnType<typeof normalizeScheduleStatus>): LiveScoreboardStatus {
  if (liveStatus === "delay" || scheduleStatus === "delayed" || scheduleStatus === "suspended") return "delay";
  if (liveStatus === "final" || scheduleStatus === "final") return "final";
  if (liveStatus === "live" || scheduleStatus === "live") return "live";
  return "warming";
}

function compareLiveRows(a: LiveScoreboardRow, b: LiveScoreboardRow) {
  const aScored = isScoredRow(a);
  const bScored = isScoredRow(b);
  if (aScored && !bScored) return -1;
  if (!aScored && bScored) return 1;

  if (aScored && bScored) {
    if (a.gsPlus !== null && b.gsPlus !== null && b.gsPlus !== a.gsPlus) return b.gsPlus - a.gsPlus;
    if (a.gsPlus !== null && b.gsPlus === null) return -1;
    if (a.gsPlus === null && b.gsPlus !== null) return 1;
  }

  return new Date(a.firstPitch).getTime() - new Date(b.firstPitch).getTime();
}

function isScoredRow(row: LiveScoreboardRow) {
  return row.scoreLabel !== "PROJ";
}

function isLiveLeaderEligibleRow(row: LiveScoreboardRow) {
  return isScoredRow(row) && row.gsPlus !== null && inningsFromIP(row.line.inningsPitched) >= LIVE_LEADER_MIN_INNINGS;
}

function qualityLabel(gsPlus: number): LiveScoreboardRow["qualityLabel"] {
  if (gsPlus >= 70) return "Elite";
  if (gsPlus >= 60) return "Plus";
  if (gsPlus >= 50) return "Solid";
  if (gsPlus >= 40) return "Below";
  return "Poor";
}

function lineKey(gamePk: number, pitcherMlbId: number) {
  return `${gamePk}:${pitcherMlbId}`;
}
