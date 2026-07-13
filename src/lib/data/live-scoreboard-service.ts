import { unstable_cache } from "next/cache";
import { LIVE_CACHE_TAG, SLATE_CACHE_TAG } from "@/lib/data/cache-tags";
import { fetchMlbLivePitchingLines, fetchMlbSchedule } from "@/lib/data/mlb-stats-client";
import { readNoHitterBidAlerts, type NoHitterBidAlert } from "@/lib/data/no-hitter-alert-service";
import { readCachedRuntimeState, writeRuntimeState } from "@/lib/data/runtime-state-store";
import { addDays, getBoardDate, getDailySlate, scoreCompletedLine } from "@/lib/data/start-service";
import { getTonightMustWatch } from "@/lib/data/tonight-service";
import { PREGAME_FIRST_UP_PROXIMITY_WINDOW_MS } from "@/lib/live-pregame";
import { inningsFromIP } from "@/lib/innings";
import { liveDateHref, pitcherHref, sourceParams, startHref } from "@/lib/routes";
import { formatFirstPitchCountdown, getSlateProgressState, normalizeScheduleStatus, summarizeSlateStartBuckets, type SlateProgressState, type SlateStartBucketCounts } from "@/lib/slate-state";
import { RANKED_START_IP_FLOOR } from "@/lib/start-classification";
import type { MlbLivePitchingLine, MlbSchedule, MlbScheduleGame, StartLine, StartNarrativeNotables, StartSummary, TonightResponse } from "@/lib/types";

export const LIVE_SCOREBOARD_REVALIDATE_SECONDS = 30;
const LIVE_WARMING_LEAD_MS = 30 * 60 * 1000;
const LIVE_BOARD_TIME_ZONE = "America/Vancouver";
const LIVE_LOOKAHEAD_DAYS = 10;

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
  outingStatus: "qualifying" | "provisional" | "short";
  qualityLabel: "Elite" | "Plus" | "Solid" | "Below" | "Poor" | null;
  provisional: boolean;
  starterIsOut: boolean;
  gameFinal: boolean;
  inningLabel: string | null;
  pitchCount: number | null;
  narrativeNotables?: StartNarrativeNotables;
  pitcherHref: string;
  startHref: string;
  liveHref: string;
};

export type LiveScoreboard = SlateStartBucketCounts & {
  date: string;
  mode: "slate" | "empty" | "error";
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
  noHitterAlerts: NoHitterBidAlert[];
  slateStory: SlateStory | null;
};

export type SlateStory = {
  version: 1;
  date: string;
  story: string;
  generatedAt: string;
  source: "stored" | "fallback";
};

export type LivePregameSlate = {
  date: string;
  headerLabel: "FIRST UP" | "NEXT SLATE";
  firstPitchAt: string | null;
  marqueeGame: TonightResponse["games"][number] | null;
  firstUpGames: TonightResponse["games"][number][];
  nextUpGames: TonightResponse["games"][number][];
  leagueMeanGS: number;
  starterCount: number;
  upcomingHref: string;
};

const getCachedLiveScoreboard = unstable_cache(
  async (date: string) => buildLiveScoreboard(date),
  ["live-scoreboard", "v12"],
  { revalidate: LIVE_SCOREBOARD_REVALIDATE_SECONDS, tags: [LIVE_CACHE_TAG, SLATE_CACHE_TAG] },
);

const getCachedLiveLookahead = unstable_cache(
  async (date: string) => resolveNextSlateUncached(date),
  ["live-scoreboard-lookahead", "v1"],
  { revalidate: 24 * 60 * 60, tags: [LIVE_CACHE_TAG, SLATE_CACHE_TAG] },
);

export { getBoardDate };

export async function getLiveScoreboard({ date = getBoardDate() }: { date?: string } = {}): Promise<LiveScoreboard> {
  return normalizeCachedLiveScoreboard(await getCachedLiveScoreboard(date), date);
}

async function buildLiveScoreboard(date: string): Promise<LiveScoreboard> {
  console.info(`[live-board] boardDate=${date} tz=${LIVE_BOARD_TIME_ZONE}`);
  const [rawSlate, rawSchedule] = await Promise.all([
    getDailySlate({ window: "today", date, allowDemoFallback: false }),
    fetchMlbSchedule(date, { fetchLive: true, gamefeedRevalidateSeconds: LIVE_SCOREBOARD_REVALIDATE_SECONDS }),
  ]);
  console.info(`[live-board] fetch date=${date} upstream=https://statsapi.mlb.com/api/v1/schedule?sportId=1&gameTypes=R&date=${date}&hydrate=probablePitcher%2Cteam status=${rawSchedule.source === "live" ? 200 : "fallback"} rawGames=${rawSchedule.games.length}`);

  const schedule = filterLiveBoardSchedule(rawSchedule, date);
  const validGamePks = new Set(schedule.games.map((game) => game.gamePk));
  const slate = rawSlate.filter((start) => validGamePks.has(start.gamePk));

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

  let rows = guardLiveRowsForBoardDate(buildRows(new Map()), date);
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
    rows = guardLiveRowsForBoardDate(buildRows(getUpcomingProjectionMap(upcoming)), date);
    scoredRows = rows.filter(isScoredRow);
    startCounts = summarizeSlateStartBuckets(rows);
  }

  const slateProgress = getSlateProgressState(schedule, startCounts.finalStarts, generatedAt);
  const noHitterAlerts = await readNoHitterBidAlerts(date, generatedAt);
  const slateStory = slateComplete ? await readSlateStory(date, rows, startCounts.totalStarts, generatedAt) : null;
  const currentPregameWatch = pregame ? await getTonightMustWatch({ date, window: 5 }).catch(() => null) : null;
  const nextSlate = slateComplete || rows.length === 0 ? await resolveNextSlate(date) : null;
  const mode = rawSchedule.source !== "live" ? "error" : rows.length === 0 ? "empty" : "slate";
  console.info(`[live-board] cache write date=${date} rows=${rows.length}`);
  console.info(`[live-board] render mode=${mode} rows=${rows.length}`);
  const pregameSlate = currentPregameWatch
    ? buildLivePregameSlate(date, currentPregameWatch, "FIRST UP")
    : mode === "slate" && rows.length === 0 && nextSlate?.watch
      ? buildLivePregameSlate(nextSlate.date, nextSlate.watch, "NEXT SLATE")
      : null;

  return {
    date,
    mode,
    generatedAt: generatedAt.toISOString(),
    hasGames: mode === "slate" && rows.length > 0,
    hasActiveStarts: startCounts.liveStarts > 0 || startCounts.warmingStarts > 0 || startCounts.delayStarts > 0,
    slateProgress,
    pregameSlate,
    nextSlateDate: nextSlate?.date ?? null,
    nextSlateFirstPitchAt: nextSlate?.firstPitchAt ?? null,
    nextSlateTopGame: nextSlate?.topGame ?? null,
    ...startCounts,
    rows,
    leader: scoredRows.filter(isLiveLeaderEligibleRow)[0] ?? null,
    noHitterAlerts,
    slateStory,
  };
}

export async function writeSlateStoryForFinalBoard(date: string, rows: LiveScoreboardRow[], totalStarts: number, now = new Date()) {
  const story = buildDeterministicSlateStory(date, rows, totalStarts);
  if (!story) return false;
  return writeRuntimeState(slateStoryKey(date), {
    version: 1,
    date,
    story,
    generatedAt: now.toISOString(),
    source: "stored",
  });
}

async function readSlateStory(date: string, rows: LiveScoreboardRow[], totalStarts: number, now: Date): Promise<SlateStory | null> {
  const stored = await readCachedRuntimeState<SlateStory>(slateStoryKey(date), 60);
  if (stored?.version === 1 && stored.date === date && isSupportedSlateStory(stored.story, rows)) {
    return { ...stored, source: "stored" };
  }
  const story = buildDeterministicSlateStory(date, rows, totalStarts);
  return story ? { version: 1, date, story, generatedAt: now.toISOString(), source: "fallback" } : null;
}

function slateStoryKey(date: string) {
  return `live-slate-story:${date}`;
}

async function resolveNextSlate(date: string) {
  const nextSlate = await getCachedLiveLookahead(date);
  console.info(`[live-board] lookahead nextSlate=${nextSlate?.date ?? "none"} daysScanned=${nextSlate?.daysScanned ?? LIVE_LOOKAHEAD_DAYS}`);
  return nextSlate;
}

async function resolveNextSlateUncached(date: string) {
  for (let offset = 1; offset <= LIVE_LOOKAHEAD_DAYS; offset += 1) {
    const nextDate = addDays(date, offset);
    const [schedule, watch] = await Promise.all([
      fetchMlbSchedule(nextDate, { fetchLive: true }),
      getTonightMustWatch({ date: nextDate, window: 5 }).catch(() => null),
    ]);
    const scopedSchedule = filterLiveBoardSchedule(schedule, nextDate, { log: false });
    const firstPitchAt = scopedSchedule.games
      .filter((game) => normalizeScheduleStatus(game) !== "ppd")
      .map((game) => ({ iso: game.gameDate, ms: new Date(game.gameDate).getTime() }))
      .filter((game) => Number.isFinite(game.ms))
      .sort((a, b) => a.ms - b.ms)[0]?.iso ?? null;

    if (firstPitchAt) return { date: nextDate, firstPitchAt, topGame: watch?.games[0] ?? null, watch, daysScanned: offset };
  }

  return null;
}

function filterLiveBoardSchedule(schedule: MlbSchedule, boardDate: string, options: { log?: boolean } = {}) {
  const log = options.log !== false;
  const regularGames = schedule.games.filter((game) => game.gameType === "R");
  const dateMatchedGames = regularGames.filter((game) => gameDateInBoardTimeZone(game.gameDate) === boardDate);
  const droppedPks = regularGames.filter((game) => gameDateInBoardTimeZone(game.gameDate) !== boardDate).map((game) => game.gamePk);

  if (log) {
    console.info(`[live-board] filter gameType=R kept=${regularGames.length} dropped=${schedule.games.length - regularGames.length}`);
    console.info(`[live-board] filter ptDateMatch kept=${dateMatchedGames.length} dropped=${regularGames.length - dateMatchedGames.length} droppedPks=[${droppedPks.join(",")}]`);
  }

  return { ...schedule, date: boardDate, games: dateMatchedGames };
}

export function guardLiveRowsForBoardDate(rows: LiveScoreboardRow[], boardDate: string) {
  const kept: LiveScoreboardRow[] = [];
  const dropped: LiveScoreboardRow[] = [];

  for (const row of rows) {
    const rowDate = gameDateInBoardTimeZone(row.firstPitch);
    if (rowDate === boardDate) {
      kept.push(row);
    } else {
      dropped.push(row);
      console.warn(`[live-board] drop ptDateMatch gamePk=${row.gamePk} pitcher=${row.pitcherName} gameDate=${rowDate ?? "invalid"}`);
    }
  }

  console.info(`[live-board] filter ptDateMatch kept=${kept.length} dropped=${dropped.length} droppedPks=[${dropped.map((row) => row.gamePk).join(",")}]`);
  return kept;
}

function gameDateInBoardTimeZone(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.valueOf())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LIVE_BOARD_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(parsed);
  const year = parts.find((part) => part.type === "year")?.value ?? String(parsed.getUTCFullYear());
  const month = parts.find((part) => part.type === "month")?.value ?? String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const day = parts.find((part) => part.type === "day")?.value ?? String(parsed.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildLivePregameSlate(date: string, watch: TonightResponse, headerLabel: LivePregameSlate["headerLabel"]): LivePregameSlate {
  const pregameGames = watch.games
    .filter((game) => game.status === "pregame")
    .map((game) => ({ game, firstPitchMs: new Date(game.firstPitch).getTime() }))
    .filter((entry) => Number.isFinite(entry.firstPitchMs))
    .sort((a, b) => a.firstPitchMs - b.firstPitchMs);
  const marqueeGame = pregameGames[0]?.game ?? null;
  const firstPitchMs = pregameGames[0]?.firstPitchMs ?? null;
  const firstUpGames = pregameGames
    .filter((entry, index) => index === 0 || (firstPitchMs !== null && entry.firstPitchMs - firstPitchMs <= PREGAME_FIRST_UP_PROXIMITY_WINDOW_MS))
    .slice(0, 2)
    .map((entry) => entry.game);
  const firstUpGamePks = new Set(firstUpGames.map((game) => game.gamePk));
  const nextUpGames = pregameGames
    .filter((entry) => !firstUpGamePks.has(entry.game.gamePk))
    .map((entry) => entry.game)
    .slice(0, 2);

  return {
    date,
    headerLabel,
    firstPitchAt: marqueeGame?.firstPitch ?? null,
    marqueeGame,
    firstUpGames,
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
  const outingStatus = liveOutingStatus(status, scoreLabel, line);
  const gsPlus = hasRealLine ? resolveLiveRowGsPlus(status, start, line) : null;
  const pitchCount = hasRealLine ? line.pitches : null;
  const inningLabel = hasRealLine && !liveLine?.starterIsOut ? liveLine?.inningLabel ?? null : null;
  const starterIsOut = liveLine?.starterIsOut ?? status === "final";
  const gameFinal = liveLine?.gameFinal ?? status === "final";

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
    outingStatus,
    qualityLabel: gsPlus === null ? null : qualityLabel(gsPlus),
    provisional: scoreLabel === "PROV",
    starterIsOut,
    gameFinal,
    inningLabel,
    pitchCount,
    narrativeNotables: liveLine?.narrativeNotables ?? start.narrativeNotables,
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

function buildDeterministicSlateStory(date: string, rows: LiveScoreboardRow[], totalStarts: number) {
  const scored = rows
    .filter((row): row is LiveScoreboardRow & { gsPlus: number } => row.gsPlus !== null && row.scoreLabel === "FINAL")
    .sort((a, b) => b.gsPlus - a.gsPlus || b.line.strikeouts - a.line.strikeouts);
  if (scored.length === 0) return null;

  const notables = slateNarrativeNotables(scored);
  const notable = notables[0] ?? null;
  const secondaryNotable = notable
    ? notables.find((item) => item.row.startId !== notable.row.startId && item.score >= 100) ?? null
    : null;
  const leader = scored[0];
  const tiedLeaders = scored.filter((row) => row.gsPlus === leader.gsPlus);
  const leaderLine = tiedLeaders.length === 2
    ? `${lastName(tiedLeaders[0].pitcherName)} and ${lastName(tiedLeaders[1].pitcherName)} split the day at ${leader.gsPlus}.`
    : `${lastName(leader.pitcherName)} led the day at GS+ ${leader.gsPlus}.`;
  const countLine = `All ${totalStarts} starts are in.`;

  if (!notable) return `${countLine} ${leaderLine}`;
  return [countLine, notable.sentence, secondaryNotable?.sentence, leaderLine].filter(Boolean).join(" ");
}

function slateNarrativeNotables(rows: Array<LiveScoreboardRow & { gsPlus: number }>) {
  return rows
    .flatMap((row) => slateNarrativeNotableSentences(row).map((sentence) => ({ row, sentence, score: slateNarrativeNotableScore(row) })))
    .sort((a, b) => b.score - a.score || b.row.gsPlus - a.row.gsPlus);
}

function slateNarrativeNotableSentences(row: LiveScoreboardRow) {
  const noHit = row.narrativeNotables?.noHitDepth;
  if (noHit?.firstHitInning && noHit.innings >= 8) {
    return [`${lastName(row.pitcherName)} carried a no-hitter into the ${ordinal(noHit.firstHitInning)}.`];
  }
  if (noHit?.hitlessStintComplete && noHit.innings >= 5) {
    return [`${lastName(row.pitcherName)} worked ${formatInnings(noHit.innings)} hitless innings.`];
  }
  if (row.narrativeNotables?.strikeouts?.doubleDigit) {
    return [`${lastName(row.pitcherName)} punched out ${row.line.strikeouts}.`];
  }
  return [];
}

function slateNarrativeNotableScore(row: LiveScoreboardRow) {
  const noHit = row.narrativeNotables?.noHitDepth;
  if (noHit?.firstHitInning && noHit.innings >= 8) return 120 + noHit.innings;
  if (noHit?.hitlessStintComplete && noHit.innings >= 6) return 105 + noHit.innings;
  if (noHit && noHit.innings >= 5) return 90 + noHit.innings;
  if (row.narrativeNotables?.strikeouts?.doubleDigit) return 70 + row.line.strikeouts;
  return 0;
}

function isSupportedSlateStory(story: string, rows: LiveScoreboardRow[]) {
  const noHitTimingClaims = [...story.matchAll(/\bno-hitter into the (\w+)\b/gi)];
  return noHitTimingClaims.every((claim) => {
    const claimedInning = ordinalWordToNumber(claim[1]);
    if (!claimedInning) return false;
    return rows.some((row) => row.narrativeNotables?.noHitDepth?.firstHitInning === claimedInning);
  });
}

function ordinal(value: number) {
  if (value === 1) return "first";
  if (value === 2) return "second";
  if (value === 3) return "third";
  if (value === 4) return "fourth";
  if (value === 5) return "fifth";
  if (value === 6) return "sixth";
  if (value === 7) return "seventh";
  if (value === 8) return "eighth";
  if (value === 9) return "ninth";
  return `${value}th`;
}

function ordinalWordToNumber(value: string) {
  const normalized = value.toLowerCase();
  const words: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9 };
  return words[normalized] ?? (Number(normalized.replace(/\D/g, "")) || null);
}

function formatInnings(innings: number) {
  return `${innings}.0`;
}

function lastName(name: string) {
  return name.trim().split(/\s+/).at(-1) ?? name;
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
    const aShort = isShortOutingRow(a);
    const bShort = isShortOutingRow(b);
    if (aShort && !bShort) return 1;
    if (!aShort && bShort) return -1;
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
  return isScoredRow(row) && row.gsPlus !== null && !isShortOutingRow(row);
}

function isShortOutingRow(row: LiveScoreboardRow) {
  return row.outingStatus === "short";
}

function liveOutingStatus(status: LiveScoreboardStatus, scoreLabel: LiveScoreboardRow["scoreLabel"], line: StartLine): LiveScoreboardRow["outingStatus"] {
  if (scoreLabel === "FINAL" && status === "final" && inningsFromIP(line.inningsPitched) < RANKED_START_IP_FLOOR) return "short";
  if (scoreLabel === "PROV" && inningsFromIP(line.inningsPitched) < RANKED_START_IP_FLOOR) return "provisional";
  return "qualifying";
}

function qualityLabel(gsPlus: number): LiveScoreboardRow["qualityLabel"] {
  if (gsPlus >= 70) return "Elite";
  if (gsPlus >= 60) return "Plus";
  if (gsPlus >= 50) return "Solid";
  if (gsPlus >= 40) return "Below";
  return "Poor";
}

function normalizeCachedLiveScoreboard(board: LiveScoreboard | (Omit<LiveScoreboard, "slateProgress"> & { slateProgress?: SlateProgressState }), date: string): LiveScoreboard {
  if (board.date !== date) {
    console.warn(`[live-board] cache miss reason=dateMismatch cached=${board.date}`);
    return fallbackErrorBoard(date);
  }

  if (board.slateProgress) {
    const cachedBoard = board as LiveScoreboard;
    const rows = cachedBoard.rows.map(normalizeCachedLiveRow);
    return {
      ...cachedBoard,
      mode: cachedBoard.mode ?? (rows.length === 0 ? "empty" : "slate"),
      rows,
      leader: rows.filter(isLiveLeaderEligibleRow)[0] ?? null,
      noHitterAlerts: cachedBoard.noHitterAlerts ?? [],
      pregameSlate: normalizeCachedPregameSlate(cachedBoard.pregameSlate ?? null),
      nextSlateDate: cachedBoard.nextSlateDate ?? null,
      nextSlateFirstPitchAt: cachedBoard.nextSlateFirstPitchAt ?? null,
      nextSlateTopGame: cachedBoard.nextSlateTopGame ?? null,
      slateStory: cachedBoard.slateStory ?? null,
    };
  }
  const rows = board.rows.map(normalizeCachedLiveRow);

  return {
    ...board,
    mode: board.rows.length === 0 ? "empty" : "slate",
    rows,
    leader: rows.filter(isLiveLeaderEligibleRow)[0] ?? null,
    noHitterAlerts: [],
    slateStory: null,
    slateProgress: fallbackSlateProgress(board, date),
    pregameSlate: null,
    nextSlateDate: null,
    nextSlateFirstPitchAt: null,
    nextSlateTopGame: null,
  };
}

function fallbackErrorBoard(date: string): LiveScoreboard {
  const generatedAt = new Date().toISOString();
  return {
    date,
    mode: "error",
    generatedAt,
    hasGames: false,
    hasActiveStarts: false,
    slateProgress: {
      date,
      state: "no-games",
      totalGames: 0,
      liveGames: 0,
      finalGames: 0,
      totalStarts: 0,
      completedStarts: 0,
      liveStarts: 0,
      firstPitchAt: null,
      countdownLabel: null,
    },
    pregameSlate: null,
    nextSlateDate: null,
    nextSlateFirstPitchAt: null,
    nextSlateTopGame: null,
    totalStarts: 0,
    liveStarts: 0,
    finalStarts: 0,
    warmingStarts: 0,
    scheduledStarts: 0,
    delayStarts: 0,
    rows: [],
    leader: null,
    noHitterAlerts: [],
    slateStory: null,
  };
}

function normalizeCachedPregameSlate(slate: LivePregameSlate | null): LivePregameSlate | null {
  if (!slate) return null;
  const firstUpGames = slate.firstUpGames?.length ? slate.firstUpGames : slate.marqueeGame ? [slate.marqueeGame] : [];
  const firstUpGamePks = new Set(firstUpGames.map((game) => game.gamePk));
  return {
    ...slate,
    firstUpGames,
    nextUpGames: slate.nextUpGames.filter((game) => !firstUpGamePks.has(game.gamePk)),
  };
}

function normalizeCachedLiveRow(row: LiveScoreboardRow | (Omit<LiveScoreboardRow, "outingStatus"> & { outingStatus?: LiveScoreboardRow["outingStatus"] })): LiveScoreboardRow {
  if (row.outingStatus && typeof (row as LiveScoreboardRow).starterIsOut === "boolean" && typeof (row as LiveScoreboardRow).gameFinal === "boolean") return row as LiveScoreboardRow;
  return {
    ...row,
    outingStatus: liveOutingStatus(row.status, row.scoreLabel, row.line),
    starterIsOut: row.status === "final",
    gameFinal: row.status === "final",
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
