import { unstable_cache } from "next/cache";
import { LIVE_CACHE_TAG, SLATE_CACHE_TAG } from "@/lib/data/cache-tags";
import { fetchMlbLivePitchingLines, fetchMlbSchedule } from "@/lib/data/mlb-stats-client";
import { addDays, getDailySlate, getHomeSlateDate, scoreCompletedLine } from "@/lib/data/start-service";
import { getTonightMustWatch } from "@/lib/data/tonight-service";
import { inningsFromIP } from "@/lib/innings";
import { liveDateHref, pitcherHref, sourceParams, startHref } from "@/lib/routes";
import { formatFirstPitchCountdown, getSlateProgressState, normalizeScheduleStatus, summarizeSlateStartBuckets, type SlateProgressState, type SlateStartBucketCounts } from "@/lib/slate-state";
import type { MlbLivePitchingLine, MlbScheduleGame, StartLine, StartSummary, TonightResponse } from "@/lib/types";

export const LIVE_SCOREBOARD_REVALIDATE_SECONDS = 30;
const LIVE_LEADER_MIN_INNINGS = 3;
const LIVE_WARMING_LEAD_MS = 30 * 60 * 1000;

export type LiveScoreboardStatus = "live" | "final" | "warming" | "scheduled" | "delay";

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
  pitcherHref: string;
  startHref: string;
  liveHref: string;
};

export type LiveScoreboard = SlateStartBucketCounts & {
  date: string;
  generatedAt: string;
  hasGames: boolean;
  hasActiveStarts: boolean;
  slateProgress: SlateProgressState;
  pregameSlate: LivePregameSlate | null;
  nextSlateDate: string | null;
  nextSlateFirstPitchAt: string | null;
  nextSlateTopGame: TonightResponse["games"][number] | null;
  rows: LiveScoreboardRow[];
  leader: LiveScoreboardRow | null;
};

export type LivePregameSlate = {
  date: string;
  headerLabel: "FIRST UP" | "NEXT SLATE";
  firstPitchAt: string | null;
  marqueeGame: TonightResponse["games"][number] | null;
  nextUpGames: TonightResponse["games"][number][];
  leagueMeanGS: number;
  starterCount: number;
  upcomingHref: string;
};

const getCachedLiveScoreboard = unstable_cache(
  async (date: string) => buildLiveScoreboard(date),
  ["live-scoreboard", "v10"],
  { revalidate: LIVE_SCOREBOARD_REVALIDATE_SECONDS, tags: [LIVE_CACHE_TAG, SLATE_CACHE_TAG] },
);

export async function getLiveScoreboard({ date = getHomeSlateDate() }: { date?: string } = {}): Promise<LiveScoreboard> {
  return normalizeCachedLiveScoreboard(await getCachedLiveScoreboard(date), date);
}

async function buildLiveScoreboard(date: string): Promise<LiveScoreboard> {
  const [slate, schedule] = await Promise.all([
    getDailySlate({ window: "today", date }),
    fetchMlbSchedule(date, { fetchLive: true, gamefeedRevalidateSeconds: LIVE_SCOREBOARD_REVALIDATE_SECONDS }),
  ]);

  const liveLinesByStart = await getLiveLinesByStart(schedule.games);
  const gamesByPk = new Map(schedule.games.map((game) => [game.gamePk, game]));
  const generatedAt = new Date();
  const buildRows = (projectionsByStart: Map<string, number | null>) => slate.flatMap((start) => {
      const game = gamesByPk.get(start.gamePk);
      if (game && normalizeScheduleStatus(game) === "ppd") return [];

      const liveLine = liveLinesByStart.get(lineKey(start.gamePk, start.pitcher.mlbId));
      return [buildLiveRow(date, start, liveLine, game, projectionsByStart, generatedAt)];
    })
    .sort(compareLiveRows);

  let rows = buildRows(new Map());
  let scoredRows = rows.filter(isScoredRow);
  let startCounts = summarizeSlateStartBuckets(rows);
  const pregame =
    rows.length > 0 &&
    startCounts.finalStarts === 0 &&
    startCounts.liveStarts === 0 &&
    startCounts.warmingStarts === 0 &&
    startCounts.delayStarts === 0;
  const slateComplete = rows.length > 0 && startCounts.totalStarts > 0 && startCounts.finalStarts === startCounts.totalStarts;

  if (((!pregame && !slateComplete) || slateComplete) && rows.some((row) => row.scoreLabel === "PROJ" || row.projectedGsPlus === null)) {
    const upcoming = await getTonightMustWatch({ date, window: 5 });
    rows = buildRows(getUpcomingProjectionMap(upcoming));
    scoredRows = rows.filter(isScoredRow);
    startCounts = summarizeSlateStartBuckets(rows);
  }

  const slateProgress = getSlateProgressState(schedule, startCounts.finalStarts, generatedAt);
  const currentPregameWatch = pregame ? await getTonightMustWatch({ date, window: 5 }).catch(() => null) : null;
  const nextSlate = slateComplete || rows.length === 0 ? await resolveNextSlate(date) : null;
  const pregameSlate = currentPregameWatch
    ? buildLivePregameSlate(date, currentPregameWatch, "FIRST UP")
    : rows.length === 0 && nextSlate?.watch
      ? buildLivePregameSlate(nextSlate.date, nextSlate.watch, "NEXT SLATE")
      : null;

  return {
    date,
    generatedAt: generatedAt.toISOString(),
    hasGames: rows.length > 0,
    hasActiveStarts: startCounts.liveStarts > 0 || startCounts.warmingStarts > 0 || startCounts.delayStarts > 0,
    slateProgress,
    pregameSlate,
    nextSlateDate: nextSlate?.date ?? null,
    nextSlateFirstPitchAt: nextSlate?.firstPitchAt ?? null,
    nextSlateTopGame: nextSlate?.topGame ?? null,
    ...startCounts,
    rows,
    leader: scoredRows.filter(isLiveLeaderEligibleRow)[0] ?? null,
  };
}

async function resolveNextSlate(date: string) {
  for (let offset = 1; offset <= 7; offset += 1) {
    const nextDate = addDays(date, offset);
    const [schedule, watch] = await Promise.all([
      fetchMlbSchedule(nextDate, { fetchLive: false }),
      getTonightMustWatch({ date: nextDate, window: 5 }).catch(() => null),
    ]);
    const firstPitchAt = schedule.games
      .filter((game) => normalizeScheduleStatus(game) !== "ppd")
      .map((game) => ({ iso: game.gameDate, ms: new Date(game.gameDate).getTime() }))
      .filter((game) => Number.isFinite(game.ms))
      .sort((a, b) => a.ms - b.ms)[0]?.iso ?? null;

    if (firstPitchAt) return { date: nextDate, firstPitchAt, topGame: watch?.games[0] ?? null, watch };
  }

  return null;
}

function buildLivePregameSlate(date: string, watch: TonightResponse, headerLabel: LivePregameSlate["headerLabel"]): LivePregameSlate {
  const marqueeGame = watch.games
    .filter((game) => game.status === "pregame")
    .map((game) => ({ game, firstPitchMs: new Date(game.firstPitch).getTime() }))
    .filter((entry) => Number.isFinite(entry.firstPitchMs))
    .sort((a, b) => a.firstPitchMs - b.firstPitchMs)[0]?.game ?? null;
  const nextUpGames = watch.games
    .filter((game) => game.status === "pregame" && game.gamePk !== marqueeGame?.gamePk)
    .sort((a, b) => b.gameWatchScore - a.gameWatchScore || new Date(a.firstPitch).getTime() - new Date(b.firstPitch).getTime())
    .slice(0, 2);

  return {
    date,
    headerLabel,
    firstPitchAt: marqueeGame?.firstPitch ?? null,
    marqueeGame,
    nextUpGames,
    leagueMeanGS: watch.leagueMeanGS,
    starterCount: watch.scheduledGames * 2,
    upcomingHref: `/upcoming/${date}`,
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
  now: Date,
): LiveScoreboardRow {
  const scheduleStatus = game ? normalizeScheduleStatus(game) : "pregame";
  const rawStatus = normalizeLiveStatus(liveLine?.gameStatus, scheduleStatus);
  const firstPitch = game?.gameDate ?? start.date;
  const status = refinePregameStatus(rawStatus, firstPitch, now, Boolean(liveLine));
  const line = liveLine?.line ?? start.line;
  const projectedGsPlus = projectionsByStart.get(lineKey(start.gamePk, start.pitcher.mlbId)) ?? null;
  const hasRealLine = Boolean(liveLine && status !== "warming" && hasNonEmptyLine(line));
  const scoreLabel = !hasRealLine ? "PROJ" : status === "final" ? "FINAL" : "PROV";
  const gsPlus = hasRealLine ? resolveLiveRowGsPlus(status, start, line) : null;
  const pitchCount = hasRealLine ? line.pitches : null;
  const inningLabel = hasRealLine && !liveLine?.starterIsOut ? liveLine?.inningLabel ?? null : null;

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
    firstPitch,
    status,
    line,
    gsPlus,
    projectedGsPlus,
    scoreLabel,
    qualityLabel: gsPlus === null ? null : qualityLabel(gsPlus),
    provisional: scoreLabel === "PROV",
    inningLabel,
    pitchCount,
    pitcherHref: pitcherHref({ id: start.pitcher.id, name: start.pitcher.name }, sourceParams("live")),
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

function resolveLiveRowGsPlus(status: LiveScoreboardStatus, start: StartSummary, line: StartLine) {
  if (status !== "final") return scoreCompletedLine(line, start.context);
  return sameStartLine(start.line, line) ? start.gameScorePlus : scoreCompletedLine(line, start.context);
}

function sameStartLine(a: StartLine, b: StartLine) {
  return a.inningsPitched === b.inningsPitched
    && a.hits === b.hits
    && a.earnedRuns === b.earnedRuns
    && a.runsAllowed === b.runsAllowed
    && a.homeRunsAllowed === b.homeRunsAllowed
    && a.walks === b.walks
    && a.strikeouts === b.strikeouts
    && a.pitches === b.pitches;
}

function normalizeLiveStatus(liveStatus: MlbLivePitchingLine["gameStatus"] | undefined, scheduleStatus: ReturnType<typeof normalizeScheduleStatus>): LiveScoreboardStatus {
  if (liveStatus === "delay" || scheduleStatus === "delayed" || scheduleStatus === "suspended") return "delay";
  if (liveStatus === "final" || scheduleStatus === "final") return "final";
  if (liveStatus === "live" || scheduleStatus === "live") return "live";
  if (liveStatus === "warming") return "warming";
  return "scheduled";
}

function refinePregameStatus(status: LiveScoreboardStatus, firstPitch: string, now: Date, hasLiveLine: boolean): LiveScoreboardStatus {
  if (status !== "scheduled" && status !== "warming") return !hasLiveLine && status === "live" ? "warming" : status;
  const firstPitchMs = new Date(firstPitch).getTime();
  if (!Number.isFinite(firstPitchMs)) return status;
  const remainingMs = firstPitchMs - now.getTime();
  return remainingMs > 0 && remainingMs <= LIVE_WARMING_LEAD_MS ? "warming" : "scheduled";
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

function normalizeCachedLiveScoreboard(board: LiveScoreboard | (Omit<LiveScoreboard, "slateProgress"> & { slateProgress?: SlateProgressState }), date: string): LiveScoreboard {
  if (board.slateProgress) {
    const cachedBoard = board as LiveScoreboard;
    return {
      ...cachedBoard,
      pregameSlate: cachedBoard.pregameSlate ?? null,
      nextSlateDate: cachedBoard.nextSlateDate ?? null,
      nextSlateFirstPitchAt: cachedBoard.nextSlateFirstPitchAt ?? null,
      nextSlateTopGame: cachedBoard.nextSlateTopGame ?? null,
    };
  }

  return {
    ...board,
    slateProgress: fallbackSlateProgress(board, date),
    pregameSlate: null,
    nextSlateDate: null,
    nextSlateFirstPitchAt: null,
    nextSlateTopGame: null,
  };
}

function fallbackSlateProgress(board: Omit<LiveScoreboard, "slateProgress"> & { slateProgress?: SlateProgressState }, date: string): SlateProgressState {
  const firstPitchAt = board.rows
    .map((row) => ({ iso: row.firstPitch, ms: new Date(row.firstPitch).getTime() }))
    .filter((row) => Number.isFinite(row.ms))
    .sort((a, b) => a.ms - b.ms)[0]?.iso ?? null;
  const totalGames = Math.ceil(board.totalStarts / 2);
  const liveGames = Math.ceil(board.liveStarts / 2);
  const finalGames = Math.floor(board.finalStarts / 2);

  if (!board.hasGames) {
    return {
      date,
      state: "no-games",
      totalGames: 0,
      liveGames: 0,
      finalGames: 0,
      totalStarts: 0,
      completedStarts: 0,
      liveStarts: 0,
      firstPitchAt,
      countdownLabel: null,
    };
  }

  if (board.totalStarts > 0 && board.finalStarts >= board.totalStarts) {
    return {
      date,
      state: "all-starts-complete",
      totalGames,
      liveGames,
      finalGames,
      totalStarts: board.totalStarts,
      completedStarts: board.finalStarts,
      liveStarts: 0,
      firstPitchAt,
      countdownLabel: null,
    };
  }

  if (board.liveStarts > 0 || board.finalStarts > 0 || board.delayStarts > 0) {
    return {
      date,
      state: board.finalStarts > 0 && board.liveStarts === 0 && board.scheduledStarts === 0 ? "reconciling" : "starts-in-progress",
      totalGames,
      liveGames,
      finalGames,
      totalStarts: board.totalStarts,
      completedStarts: board.finalStarts,
      liveStarts: board.liveStarts,
      firstPitchAt,
      countdownLabel: null,
    };
  }

  return {
    date,
    state: "pre-first-pitch",
    totalGames,
    liveGames,
    finalGames,
    totalStarts: board.totalStarts,
    completedStarts: board.finalStarts,
    liveStarts: board.liveStarts,
    firstPitchAt,
    countdownLabel: firstPitchAt ? formatFirstPitchCountdown(new Date(firstPitchAt).getTime() - Date.now()) : "STARTING SOON",
  };
}

function lineKey(gamePk: number, pitcherMlbId: number) {
  return `${gamePk}:${pitcherMlbId}`;
}
