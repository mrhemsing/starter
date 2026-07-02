import { unstable_cache } from "next/cache";
import { canonicalizeStartSummaries, canonicalStartRecordFromSummary, deriveStartEventFlags, summarizeCanonicalReconciliation } from "@/lib/canonical-start-record";
import type { CanonicalReconciliationReport } from "@/lib/canonical-start-record";
import { canonicalizeStartSummariesWithStore, readCanonicalStartRecords } from "@/lib/data/canonical-start-store";
import { demoPitcherDetail, demoSlateStarts, demoStartDetail } from "@/lib/data/demo";
import { fetchSavantStartPitchDetails } from "@/lib/data/baseball-savant-client";
import { calculateGameScoreV2 } from "@/lib/game-score-v2";
import { readArchivedCompletedPitchingLines, readArchivedCompletedStarts, readArchivedDateSummary, readArchivedPitcherRecentArsenal, readArchivedPitcherSeasonProfile, readArchivedSchedule, readArchivedSeasonCompletedStarts, readArchivedStartByRouteId, readArchivedStartLineSummary, readArchivedStartPitchDetails, readArchivedStartPitchDetailSummary } from "@/lib/data/mlb-archive";
import type { ArchivedCompletedStartSummary } from "@/lib/data/mlb-archive";
import { readSupabaseArchivedCompletedStarts, readSupabaseArchivedSeasonCompletedStarts } from "@/lib/data/supabase-archive";
import { fetchMlbCompletedPitchingLines, fetchMlbCompletedScheduleDates, fetchMlbPitcherRecentArsenal, fetchMlbPitcherSeasonProfile, fetchMlbPitcherSplits, fetchMlbSchedule, fetchMlbStartPitchDetails, fetchMlbTeamQualityContexts } from "@/lib/data/mlb-stats-client";
import { inningsFromIP } from "@/lib/innings";
import { slatePath, startPath } from "@/lib/routes";
import { getSlateProgressState, summarizeCanonicalStartBuckets, type SlateProgressState } from "@/lib/slate-state";
import { compareRankedStarts, rankStarts } from "@/lib/start-ranking";
import type { GameSummary, MlbCompletedPitchingLine, MlbProbablePitcher, MlbSchedule, MlbScheduleGame, MlbTeamQualityContext, PitchEvent, PitcherApiResponse, PitcherApiSeasonLogControls, PitcherApiSeasonLogResultFilter, PitcherApiSeasonLogSort, PitcherApiSeasonLogSummary, PitcherApiSplitGroup, PitcherApiStartLogEntry, PitcherSkillProfile, PitcherSkillSnapshot, SlateApiResponse, SlateApiScoreDeltaComparison, SlateApiScoreScale, SlateNavItem, SlateRouteParams, SlateWindow, StartApiCountLeverage, StartApiGameScorePlusBreakdown, StartApiGameScorePlusGradeLabel, StartApiInningTimeline, StartApiPitchCount, StartApiPitchSequenceRow, StartApiResponse, StartApiVelocityTrend, StartContext, StartDataSource, StartDetail, StartLine, StartSummary, TeamSummary } from "@/lib/types";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_LIVE_SCHEDULE_LOOKBACK_DAYS = 35;
const SITE_TIME_ZONE = process.env.THE_BUMP_TIME_ZONE ?? "America/Los_Angeles";
const FALLBACK_TEAM_COLOR = "#27272a";
const FALLBACK_ACCENT_COLOR = "#fbbf24";
const NEUTRAL_PARK_RUN_FACTOR = 1;
const PITCHER_SEASON_LOG_SORTS: PitcherApiSeasonLogSort[] = ["date-desc", "gs-desc", "ip-desc"];
const PITCHER_SEASON_LOG_RESULTS: PitcherApiSeasonLogResultFilter[] = ["all", "W", "L", "ND"];
const ESTABLISHED_STARTER_MIN_SEASON_STARTS = 5;
const ESTABLISHED_STARTER_MIN_AVG_IP = 4;
export const PITCHER_PROFILE_REVALIDATE_SECONDS = 15 * 60;

type CompletedPitchingLineSource = "archive-gamefeed" | "live-gamefeed";
type CompletedPitchingLineEntry = MlbCompletedPitchingLine & {
  source: CompletedPitchingLineSource;
};

const LIVE_STARTER_RESULT_REVALIDATE_SECONDS = 60;

const teamColors: Record<string, { color: string; accent: string }> = {
  ARI: { color: "#a71930", accent: "#e3d4ad" },
  ATL: { color: "#13274f", accent: "#ce1141" },
  BAL: { color: "#df4601", accent: "#000000" },
  BOS: { color: "#bd3039", accent: "#0c2340" },
  CHC: { color: "#0e3386", accent: "#cc3433" },
  CIN: { color: "#c6011f", accent: "#ffffff" },
  CLE: { color: "#00385d", accent: "#e50022" },
  COL: { color: "#33006f", accent: "#c4ced4" },
  CWS: { color: "#27251f", accent: "#c4ced4" },
  DET: { color: "#0c2340", accent: "#fa4616" },
  HOU: { color: "#002d62", accent: "#eb6e1f" },
  KC: { color: "#004687", accent: "#bd9b60" },
  LAA: { color: "#ba0021", accent: "#003263" },
  LAD: { color: "#005a9c", accent: "#ef3e42" },
  MIA: { color: "#00a3e0", accent: "#ef3340" },
  MIL: { color: "#12284b", accent: "#ffc52f" },
  MIN: { color: "#002b5c", accent: "#d31145" },
  NYM: { color: "#002d72", accent: "#ff5910" },
  NYY: { color: "#0c2340", accent: "#c4ced4" },
  OAK: { color: "#003831", accent: "#efb21e" },
  PHI: { color: "#e81828", accent: "#002d72" },
  PIT: { color: "#27251f", accent: "#fdb827" },
  SD: { color: "#2f241d", accent: "#ffc425" },
  SEA: { color: "#0c2c56", accent: "#005c5c" },
  SF: { color: "#fd5a1e", accent: "#27251f" },
  STL: { color: "#c41e3a", accent: "#0c2340" },
  TB: { color: "#092c5c", accent: "#8fbce6" },
  TEX: { color: "#003278", accent: "#c0111f" },
  TOR: { color: "#134a8e", accent: "#e8291c" },
  WSH: { color: "#ab0003", accent: "#14225a" },
};

const venueRunFactors: Record<string, number> = {
  "Angel Stadium": 0.98,
  "Busch Stadium": 0.97,
  "Chase Field": 1.03,
  "Citi Field": 0.97,
  "Citizens Bank Park": 1.01,
  "Comerica Park": 0.98,
  "Coors Field": 1.16,
  "Daikin Park": 0.99,
  "Dodger Stadium": 0.98,
  "Fenway Park": 1.05,
  "George M. Steinbrenner Field": 1.02,
  "Globe Life Field": 1,
  "Great American Ball Park": 1.08,
  "Guaranteed Rate Field": 1.01,
  "Kauffman Stadium": 1,
  "loanDepot park": 0.96,
  "Minute Maid Park": 0.99,
  "Nationals Park": 1,
  "Oracle Park": 0.94,
  "Oriole Park at Camden Yards": 1.01,
  "Petco Park": 0.95,
  "PNC Park": 0.98,
  "Progressive Field": 0.99,
  "Rate Field": 1.01,
  "Rogers Centre": 1.02,
  "T-Mobile Park": 0.95,
  "Target Field": 0.99,
  "Truist Park": 1.01,
  "Wrigley Field": 1.04,
  "Yankee Stadium": 1.03,
};

const opponentQualityRunValues: Record<string, number> = {
  ATL: 2.2,
  BAL: 1.4,
  BOS: 0.9,
  CHC: 1.1,
  HOU: 1.6,
  LAD: 2.5,
  NYY: 2,
  PHI: 1.8,
  SD: 1.3,
  TEX: 0.8,
};

const opponentOffenseRunValues: Record<string, number> = {
  ATL: 1.9,
  BAL: 1.1,
  BOS: 0.7,
  CHC: 0.8,
  HOU: 1.2,
  LAD: 2.1,
  NYY: 1.7,
  PHI: 1.5,
  SD: 0.9,
  TEX: 0.6,
};

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number) {
  return toIsoDate(new Date(new Date(`${date}T00:00:00.000Z`).getTime() + days * ONE_DAY_MS));
}

function daysBetween(olderDate: string, newerDate: string) {
  return Math.round((new Date(`${newerDate}T00:00:00.000Z`).getTime() - new Date(`${olderDate}T00:00:00.000Z`).getTime()) / ONE_DAY_MS);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export async function getDailySlate(params?: Partial<SlateRouteParams>): Promise<StartSummary[]> {
  if (!params?.date) return canonicalizeStartSummaries(demoSlateStarts);

  const archivedStarts = await getArchivedSlateStarts(params.date);
  if (archivedStarts.length > 0) return canonicalizeStartSummariesWithStore(params.date, archivedStarts);

  const schedule = await fetchMlbSchedule(params.date, { fetchLive: shouldFetchLiveSchedule(params.date) });
  const [completedLines, teamQualityContexts] = await Promise.all([getCompletedPitchingLineMap(schedule), getTeamQualityContextMap(schedule.date)]);
  const scheduledStarts = rankStarts(await buildScheduledStarts(schedule, completedLines, teamQualityContexts));

  return canonicalizeStartSummariesWithStore(params.date, scheduledStarts.length > 0 ? scheduledStarts : demoSlateStarts);
}

export async function getCanonicalStartReconciliationReport(date = getHomeSlateDate()): Promise<CanonicalReconciliationReport> {
  const starts = await getDailySlate({ window: "today", date });
  const storedRecords = await readCanonicalStartRecords(date);
  const records = storedRecords.length > 0 ? storedRecords : starts.map((start) => canonicalStartRecordFromSummary(start));

  return summarizeCanonicalReconciliation(date, records);
}

export type RankedSlateCompletionState = {
  date: string;
  totalGames: number;
  finalGames: number;
  totalStarts: number;
  completedStarts: number;
  liveStarts: number;
  warmingStarts: number;
  scheduledStarts: number;
  delayStarts: number;
  remainingGames: number;
  remainingStarts: number;
  isToday: boolean;
  isPast: boolean;
  isFinal: boolean;
  isPartialToday: boolean;
  scheduleSource: MlbSchedule["source"] | "archive";
};

export type RankedStartsArchiveNavigation = {
  activeDate: string;
  latestDate: string;
  previousDate: string | null;
  nextDate: string | null;
  availableDates: string[];
  isLatest: boolean;
};

export async function getRankedStartsArchiveNavigation(activeDate: string, today = getHomeSlateDate()): Promise<RankedStartsArchiveNavigation> {
  const availableDates = await getRankedStartsCompletedSlateDates(activeDate, today);
  const latestDate = availableDates.at(-1) ?? activeDate;
  const activeIndex = availableDates.indexOf(activeDate);
  const previousDate = activeIndex > 0 ? availableDates[activeIndex - 1] ?? null : null;
  const nextDate = activeIndex >= 0 && activeIndex < availableDates.length - 1 ? availableDates[activeIndex + 1] ?? null : null;

  return {
    activeDate,
    latestDate,
    previousDate,
    nextDate,
    availableDates,
    isLatest: activeDate === latestDate,
  };
}

const getCachedRankedArchivedCompletedSlateDates = unstable_cache(
  async (season: string) => {
    const starts = await getArchivedSeasonStartSummaries(season);
    const archivedDates = Array.from(new Set(starts.filter((start) => start.source?.line !== "fixture").map((start) => start.date))).sort();
    if (archivedDates.length > 0) return archivedDates;

    return fetchMlbCompletedScheduleDates(`${season}-01-01`, `${season}-12-31`, { fetchLive: true });
  },
  ["ranked-starts-archive-dates-v3"],
  { revalidate: 15 * 60 },
);

export async function getRankedStartsDefaultDate(today = getHomeSlateDate()) {
  return (await getRankedStartsArchiveNavigation(today, today)).latestDate;
}

export async function getDefaultSlateDates(today = getHomeSlateDate(), _now = new Date()) {
  void _now;

  const [rankedNavigation, schedule] = await Promise.all([
    getRankedStartsArchiveNavigation(today, today),
    fetchMlbSchedule(today, { fetchLive: shouldFetchLiveSchedule(today) }),
  ]);

  return {
    rankedDate: rankedNavigation.latestDate,
    upcomingDate: shouldDefaultUpcomingToTomorrow(schedule) ? addDays(today, 1) : today,
  };
}

async function getRankedStartsCompletedSlateDates(activeDate: string, today: string) {
  const seasons = Array.from(new Set([activeDate.slice(0, 4), today.slice(0, 4)]));
  const [seasonDates, todayCompletion, activeCompletion] = await Promise.all([
    Promise.all(seasons.map((season) => getCachedRankedArchivedCompletedSlateDates(season))),
    getRankedSlateCompletionState(today, today),
    activeDate === today ? Promise.resolve(null) : getRankedSlateCompletionState(activeDate, today),
  ]);
  const dates = new Set(seasonDates.flat());

  if (todayCompletion.totalStarts > 0) dates.add(today);
  if (activeCompletion && activeCompletion.totalStarts > 0) dates.add(activeDate);

  return Array.from(dates)
    .filter((date) => date <= today)
    .sort();
}

function shouldDefaultUpcomingToTomorrow(schedule: MlbSchedule) {
  const countableGames = schedule.games.filter((game) => !isPostponedGameState(game));
  if (countableGames.length === 0) return false;

  return countableGames.every((game) => !isUpcomingDefaultActiveGame(game));
}

function isUpcomingDefaultActiveGame(game: MlbScheduleGame) {
  if (isFinalGameState(game) || isPostponedGameState(game)) return false;
  return !isLiveGameState(game);
}

export async function getRankedSlateCompletionState(date: string, today = getHomeSlateDate()): Promise<RankedSlateCompletionState> {
  const [slateStarts, liveSchedule, archivedSchedule] = await Promise.all([
    getDailySlate({ window: date === today ? "today" : "yesterday", date }),
    fetchMlbSchedule(date, { fetchLive: shouldFetchLiveSchedule(date) }),
    readArchivedSchedule(date),
  ]);
  const schedule = liveSchedule.source === "live" ? liveSchedule : archivedSchedule ?? liveSchedule;
  const countableGames = schedule.games.filter((game) => !isPostponedGameState(game));
  const finalGames = countableGames.filter(isFinalGameState).length;
  const totalGames = countableGames.length;
  const startCounts = summarizeCanonicalStartBuckets(slateStarts);
  const totalStarts = startCounts.totalStarts;
  const completedStarts = Math.min(totalStarts, startCounts.finalStarts);
  const isToday = date === today;
  const isPast = date < today;
  const isFinal = totalStarts > 0 && completedStarts >= totalStarts;

  return {
    date,
    totalGames,
    finalGames,
    totalStarts,
    completedStarts,
    liveStarts: startCounts.liveStarts,
    warmingStarts: startCounts.warmingStarts,
    scheduledStarts: startCounts.scheduledStarts,
    delayStarts: startCounts.delayStarts,
    remainingGames: Math.max(0, totalGames - finalGames),
    remainingStarts: Math.max(0, totalStarts - completedStarts),
    isToday,
    isPast,
    isFinal,
    isPartialToday: isToday && completedStarts > 0 && !isFinal,
    scheduleSource: liveSchedule.source === "live" ? liveSchedule.source : archivedSchedule ? "archive" : liveSchedule.source,
  };
}

export async function getSlateSchedule(params: SlateRouteParams) {
  return fetchMlbSchedule(params.date, { fetchLive: shouldFetchLiveSchedule(params.date) });
}

export async function getSlateStartProgress(params: SlateRouteParams): Promise<SlateProgressState> {
  const [schedule, slateStarts] = await Promise.all([
    getSlateSchedule(params),
    getDailySlate(params),
  ]);
  const startCounts = summarizeCanonicalStartBuckets(slateStarts);
  return getSlateProgressState(schedule, startCounts.finalStarts);
}

export async function getTodayProbables(date?: string) {
  const slateDate = date ?? new Date().toISOString().slice(0, 10);
  const archivedStarts = await readCompletedStarts(slateDate);
  const shouldFetchLiveProbables = shouldFetchLiveSchedule(slateDate) || archivedStarts.length > 0;

  const probableSchedule = await fetchMlbSchedule(slateDate, { fetchLive: shouldFetchLiveProbables });
  if (archivedStarts.length > 0 && probableSchedule.source !== "live") return [];
  const probables = probableSchedule.games.flatMap((game) =>
    [game.probableAwayPitcher, game.probableHomePitcher]
      .filter((pitcher): pitcher is MlbProbablePitcher => Boolean(pitcher))
      .map((pitcher) => ({
        ...pitcher,
        gamePk: game.gamePk,
        gameDate: game.gameDate,
        gameStatus: game.detailedState,
        venue: game.venue,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
      })),
  );

  return probables.filter((probable) => isUnstartedGameStatus(probable.gameStatus)).map((probable) => ({
    id: `${slateDate}-${probable.teamAbbreviation.toLowerCase()}-${probable.opponentAbbreviation.toLowerCase()}-${probable.id}`,
    gamePk: probable.gamePk,
    date: slateDate,
    pitcherId: String(probable.id),
    pitcherMlbId: probable.id,
    pitcherName: probable.fullName,
    team: probable.teamAbbreviation,
    opponent: probable.opponentAbbreviation,
    side: probable.side,
    venue: probable.venue,
    gameLabel: `${probable.awayTeam.abbreviation} @ ${probable.homeTeam.abbreviation}`,
    status: probable.gameStatus,
    matchupScore: 50,
    parkAdjustment: 0,
  }));
}

function isUnstartedGameStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  return ["preview", "pre-game", "scheduled", "warmup"].includes(normalized) || /\b\d{1,2}:\d{2}\s?(am|pm)\b/.test(normalized);
}

function isFinalGameState(game: MlbScheduleGame) {
  const status = `${game.status} ${game.detailedState}`.toLowerCase();
  return /\b(final|game over|completed early)\b/.test(status);
}

function isPostponedGameState(game: MlbScheduleGame) {
  const status = `${game.status} ${game.detailedState}`.toLowerCase();
  return /\b(postponed|cancelled|canceled)\b/.test(status);
}

function shouldFetchLiveSchedule(date: string) {
  if (process.env.THE_BUMP_LIVE_MLB === "1") return true;
  const today = getHomeSlateDate();
  if (date >= today) return true;

  const target = new Date(`${date}T00:00:00.000Z`);
  const current = new Date(`${today}T00:00:00.000Z`);
  if (Number.isNaN(target.valueOf()) || Number.isNaN(current.valueOf())) return false;

  const ageInDays = Math.floor((current.getTime() - target.getTime()) / ONE_DAY_MS);
  return ageInDays >= 0 && ageInDays <= RECENT_LIVE_SCHEDULE_LOOKBACK_DAYS;
}

function shouldFetchLivePitchDetails(date: string, scheduleSource: MlbSchedule["source"]) {
  return scheduleSource === "live" || shouldFetchLiveSchedule(date);
}

export function getHomeSlateDate(now = new Date()) {
  return toTimeZoneIsoDate(now, SITE_TIME_ZONE);
}

function toTimeZoneIsoDate(date: Date, timeZone: string) {
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

function gameApiStatus(game: MlbScheduleGame) {
  const detailedState = game.detailedState.toLowerCase();
  return detailedState === "final" || detailedState === "game over" ? "final" : game.detailedState;
}

export function getHomeSlateNavigation(today = getHomeSlateDate()): SlateNavItem[] {
  const items: Array<{ window: SlateWindow; label: string; date: string }> = [
    { window: "yesterday", label: "Yesterday", date: addDays(today, -1) },
    { window: "today", label: "Today", date: today },
    { window: "tomorrow", label: "Tomorrow", date: addDays(today, 1) },
    { window: "week", label: "Week ahead", date: today },
  ];

  return items.map((item) => ({
    ...item,
    href: slatePath({ window: item.window, date: item.date }),
  }));
}

export async function getHomeTodaySlate(date = getHomeSlateDate()) {
  const [probables, schedule, archiveDate] = await Promise.all([getTodayProbables(date), getSlateSchedule({ window: "today", date }), readArchivedDateSummary(date)]);

  return {
    date,
    probables,
    schedule,
    archiveDate,
  };
}

export async function getSlateApiResponse(params: SlateRouteParams): Promise<SlateApiResponse> {
  const [probables, schedule] = await Promise.all([getTodayProbables(params.date), getSlateSchedule(params)]);
  const [completedLines, teamQualityContexts, archiveDate, archivedStarts, archivedSchedule] = await Promise.all([
    getCompletedPitchingLineMap(schedule),
    getTeamQualityContextMap(schedule.date),
    readArchivedDateSummary(schedule.date),
    getArchivedSlateStarts(params.date),
    readArchivedSchedule(params.date),
  ]);
  const scheduleGames = archivedSchedule?.games ?? schedule.games;
  const unstartedScheduleGamePks = new Set(
    scheduleGames
      .filter((game) => isUnstartedGameStatus(game.detailedState))
      .map((game) => game.gamePk),
  );
  const slateProbables = probables.filter((probable) => unstartedScheduleGamePks.has(probable.gamePk));
  const starts = archivedStarts.length > 0
    ? archivedStarts
    : rankStarts(await buildScheduledStarts(schedule, completedLines, teamQualityContexts));
  const slateStarts = await canonicalizeStartSummariesWithStore(params.date, starts.length > 0 ? starts : demoSlateStarts);
  const completedStartStats = summarizeCompletedStartSource(slateStarts);
  const completedStartStatsCoverage = summarizeCompletedStartSourceCoverage(slateStarts);

  return {
    window: params.window,
    date: params.date,
    counts: {
      starts: slateStarts.length,
      probables: slateProbables.length,
      games: archiveDate?.games ?? schedule.games.length,
    },
    source: {
      schedule: schedule.source,
      completedStartStats,
      completedStartStatsCoverage,
      archiveDate,
    },
    scoreScale: summarizeSlateScoreScale(slateStarts),
    scoreDeltaComparison: summarizeScoreDeltaComparison(slateStarts),
    games: scheduleGames.map((game) => ({
      gamePk: game.gamePk,
      status: gameApiStatus(game),
      venue: game.venue,
      label: `${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`,
      probablePitcherIds: [game.probableAwayPitcher?.id, game.probableHomePitcher?.id].filter((id): id is number => Boolean(id)),
    })),
    probables: slateProbables.map((probable) => ({
      id: probable.id,
      gamePk: probable.gamePk,
      pitcherMlbId: probable.pitcherMlbId,
      pitcherName: probable.pitcherName,
      team: probable.team,
      opponent: probable.opponent,
      side: probable.side,
      status: probable.status,
    })),
    starts: slateStarts.map((start) => {
      const lineSource = completedLines.get(startLineKey(start.gamePk, start.pitcher.mlbId))?.source ?? "fixture";

      return {
        id: start.id,
        gamePk: start.gamePk,
        date: start.date,
        rank: start.rank,
        pitcherMlbId: start.pitcher.mlbId,
        pitcherName: start.pitcher.name,
        team: start.pitcher.team,
        opponent: start.opponent,
        result: start.result,
        line: start.line,
        gameScorePlus: start.gameScorePlus,
        gameScoreV2: start.gameScoreV2,
        eventFlags: start.eventFlags,
        gameScorePlusBreakdown: start.gameScorePlusBreakdown ?? summarizeGameScorePlus(start.line, start.gameScorePlus, start.context),
        source: {
          schedule: schedule.source,
          line: lineSource,
          ranking: getRankingSource(lineSource),
        },
      };
    }),
  };
}

export async function getFeaturedStart(startId?: string) {
  if (startId) {
    const start = await getStartDetail(startId);
    if (start) return start;
  }

  return withStartSummaries({
    ...demoStartDetail,
    pitchDetailSource: "fixture" as const,
  });
}

export async function getStartDetail(startId: string) {
  if (startId === demoStartDetail.id) return withStartSummaries(demoStartDetail);

  const demoMatch = demoSlateStarts.find((start) => start.id === startId);
  if (demoMatch) return withStartSummaries({ ...demoStartDetail, ...demoMatch });

  const date = startId.match(/^(\d{4}-\d{2}-\d{2})-/)?.[1];
  if (!date) return null;

  const archivedStart = await getArchivedStartDetailByRouteId(date, startId);
  if (archivedStart) return archivedStart;

  const schedule = await fetchMlbSchedule(date, { fetchLive: shouldFetchLiveSchedule(date) });
  const [completedLines, teamQualityContexts] = await Promise.all([getCompletedPitchingLineMap(schedule), getTeamQualityContextMap(schedule.date)]);
  const scheduledStarts = await buildScheduledStarts(schedule, completedLines, teamQualityContexts);
  const matchedStart = scheduledStarts.find((start) => start.id === startId);
  const matchedGame = matchedStart ? schedule.games.find((game) => game.gamePk === matchedStart.gamePk) : undefined;

  if (!matchedStart || !matchedGame) return null;

  const [archivedPitchDetails, archivePitchDetail, archiveCompletedLine] = await Promise.all([
    readArchivedStartPitchDetails(schedule.date, matchedStart.gamePk, matchedStart.pitcher.mlbId),
    readArchivedStartPitchDetailSummary(schedule.date, matchedStart.gamePk, matchedStart.pitcher.mlbId),
    readArchivedStartLineSummary(schedule.date, matchedStart.gamePk, matchedStart.pitcher.mlbId),
  ]);
  const livePitchDetails = archivedPitchDetails
    ?? await fetchMlbStartPitchDetails(matchedStart.gamePk, matchedStart.pitcher.mlbId, {
      fetchLive: shouldFetchLivePitchDetails(schedule.date, schedule.source),
      gamefeedRevalidateSeconds: LIVE_STARTER_RESULT_REVALIDATE_SECONDS,
    })
    ?? await fetchSavantStartPitchDetails(schedule.date, matchedStart.gamePk, matchedStart.pitcher.mlbId);
  const pitchDetails = livePitchDetails ?? {
    source: "fixture" as const,
    arsenal: [],
    pitchEvents: [],
  };

  return withStartSummaries({
    ...demoStartDetail,
    ...matchedStart,
    game: scheduledGameToGameSummary(matchedGame, schedule.date),
    arsenal: pitchDetails.arsenal,
    pitchEvents: pitchDetails.pitchEvents,
    pitchDetailSource: pitchDetails.source,
    archivePitchDetail,
    archiveCompletedLine,
  });
}

async function getArchivedStartDetailByRouteId(date: string, startId: string) {
  const archived = await readArchivedStartByRouteId(date, startId);
  if (!archived) return null;

  const { archive, game, start } = archived;
  const fallback = demoSlateStarts[(start.gamePk + start.pitcherMlbId) % demoSlateStarts.length];
  const colors = teamColors[start.team] ?? { color: fallback.teamColor ?? FALLBACK_TEAM_COLOR, accent: fallback.accentColor ?? FALLBACK_ACCENT_COLOR };
  const context = {
    label: `${fallback.context.label} / ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}, ${game.venue}`,
    whiffDeltaPct: fallback.context.whiffDeltaPct,
    velocityDeltaMph: fallback.context.velocityDeltaMph,
    parkRunFactor: getVenueRunFactor(game.venue),
    parkLabel: game.venue,
    opponentQualityRunValue: getOpponentQualityRunValue(start.opponent),
    opponentQualityLabel: `${start.opponent} archived opponent quality from the stored MLB archive matchup.`,
    opponentOffenseRunValue: getOpponentOffenseRunValue(start.opponent),
    opponentOffenseLabel: `${start.opponent} archived offense quality from fixture lineup context.`,
  };
  const gameScorePlus = scoreCompletedLine(start.line, context);
  const savantPitchDetails = start.pitchEvents?.length
    ? null
    : await fetchSavantStartPitchDetails(date, start.gamePk, start.pitcherMlbId);
  const archivedPitchEvents = start.pitchEvents ?? [];
  const pitchEvents = archivedPitchEvents.length > 0 ? archivedPitchEvents : savantPitchDetails?.pitchEvents ?? [];
  const arsenal = archivedPitchEvents.length > 0 ? start.arsenal ?? [] : savantPitchDetails?.arsenal ?? [];

  return withStartSummaries({
    ...demoStartDetail,
    id: startId,
    gamePk: start.gamePk,
    date,
    rank: 1,
    pitcher: {
      id: String(start.pitcherMlbId),
      mlbId: start.pitcherMlbId,
      name: start.pitcherName,
      team: start.team,
      throws: fallback.pitcher.throws,
      headshotUrl: `https://img.mlbstatic.com/mlb-photos/image/upload/w_360,q_auto:best/v1/people/${start.pitcherMlbId}/headshot/67/current`,
    },
    opponent: start.opponent,
    side: start.side,
    result: start.result,
    line: start.line,
    gameScorePlus,
    game: {
      gamePk: game.gamePk,
      date,
      awayTeam: teamSummaryFromArchiveTeam(game.awayTeam),
      homeTeam: teamSummaryFromArchiveTeam(game.homeTeam),
      venue: game.venue,
      status: game.status.detailed.toLowerCase() === "final" ? "final" : "scheduled",
    },
    arsenal,
    pitchEvents,
    pitchDetailSource: archivedPitchEvents.length > 0 ? "archive-gamefeed" : savantPitchDetails ? "statcast-savant" : "fixture",
    archivePitchDetail: {
      status: archivedPitchEvents.length > 0 ? "stored" : "missing-gamefeed-pitches",
      pitchEvents: start.pitchEventCount ?? archivedPitchEvents.length,
      date: archive.date,
      archivedAt: archive.archivedAt,
      source: archive.source,
    },
    archiveCompletedLine: {
      status: "stored",
      date: archive.date,
      archivedAt: archive.archivedAt,
      source: archive.source,
    },
    teamColor: colors.color,
    accentColor: colors.accent,
    context,
    source: {
      schedule: "live",
      line: "archive-gamefeed",
      ranking: "schedule-derived-archive-line",
    },
  });
}

export async function getStartApiResponse(startId: string): Promise<StartApiResponse | null> {
  const start = await getStartDetail(startId);
  if (!start) return null;

  return {
    id: start.id,
    gamePk: start.gamePk,
    date: start.date,
    pitcherMlbId: start.pitcher.mlbId,
    pitcherName: start.pitcher.name,
    team: start.pitcher.team,
    opponent: start.opponent,
    line: start.line,
    gameScorePlus: start.gameScorePlus,
    gameScoreV2: start.gameScoreV2 ?? calculateGameScoreV2(start.line),
    eventFlags: start.eventFlags,
    gameScorePlusBreakdown: start.gameScorePlusBreakdown ?? summarizeGameScorePlus(start.line, start.gameScorePlus, start.context),
    source: {
      schedule: start.source?.schedule ?? "fixture",
      line: start.source?.line ?? "fixture",
      ranking: start.source?.ranking ?? "schedule-derived-fixture-line",
      pitchDetail: start.pitchDetailSource ?? "fixture",
      archivePitchDetail: start.archivePitchDetail ?? { status: "not-archived", pitchEvents: 0 },
      archiveCompletedLine: start.archiveCompletedLine ?? { status: "not-archived" },
    },
    pitchCounts: summarizeStartPitchCounts(start.pitchEvents),
    velocityTrend: start.velocityTrend ?? summarizeVelocityTrend(start.pitchEvents),
    inningTimeline: start.inningTimeline ?? summarizeInningTimeline(start.pitchEvents),
    countLeverage: start.countLeverage ?? summarizeCountLeverage(start.pitchEvents),
    pitchSequence: start.pitchSequence ?? summarizePitchSequence(start.pitchEvents),
    arsenal: start.arsenal,
    pitchEvents: start.pitchEvents,
  };
}

export async function getPitcherDetail(pitcherId: string) {
  const pitcherMlbId = Number(pitcherId);
  const season = getHomeSlateDate().slice(0, 4);
  const [archivedArsenal, archivedSeasonProfile] = Number.isInteger(pitcherMlbId)
    ? await Promise.all([
        readArchivedPitcherRecentArsenal(pitcherMlbId, season),
        readArchivedPitcherSeasonProfile(pitcherMlbId, season),
      ])
    : [null, null];

  if (Number.isInteger(pitcherMlbId) && (process.env.THE_BUMP_LIVE_MLB === "1" || !archivedSeasonProfile)) {
    const liveProfile = await fetchMlbPitcherSeasonProfile(pitcherMlbId, season, { fetchLive: true });
    if (liveProfile) {
      const starts = archivedSeasonProfile?.starts ?? liveProfile.starts;
      const recentGamePks = starts
        .map((start) => start.gamePk)
        .filter((gamePk): gamePk is number => typeof gamePk === "number")
        .slice(0, 5);
      const liveArsenal = archivedArsenal || process.env.THE_BUMP_LIVE_MLB !== "1" ? null : await fetchMlbPitcherRecentArsenal(pitcherMlbId, recentGamePks, { fetchLive: true });

      return {
        ...liveProfile,
        seasonLine: archivedSeasonProfile?.seasonLine ?? liveProfile.seasonLine,
        starts,
        arsenal: archivedArsenal?.arsenal ?? liveArsenal?.arsenal ?? demoPitcherDetail.arsenal,
        arsenalSource: archivedArsenal?.source ?? liveArsenal?.source ?? "fixture",
        seasonLineSource: archivedSeasonProfile?.source ?? liveProfile.source,
        startHistorySource: archivedSeasonProfile?.source ?? liveProfile.source,
        archiveArsenal: archivedArsenal?.archiveArsenal ?? null,
        archiveProfile: archivedSeasonProfile?.archiveProfile ?? null,
      };
    }
  }

  if (archivedSeasonProfile) {
    return {
      ...demoPitcherDetail,
      id: String(archivedSeasonProfile.mlbId),
      mlbId: archivedSeasonProfile.mlbId,
      name: archivedSeasonProfile.name,
      team: archivedSeasonProfile.team,
      headshotUrl: `https://img.mlbstatic.com/mlb-photos/image/upload/w_360,q_auto:best/v1/people/${archivedSeasonProfile.mlbId}/headshot/67/current`,
      seasonLine: archivedSeasonProfile.seasonLine,
      starts: archivedSeasonProfile.starts,
      arsenal: archivedArsenal?.arsenal ?? demoPitcherDetail.arsenal,
      arsenalSource: archivedArsenal?.source ?? "fixture",
      seasonLineSource: archivedSeasonProfile.source,
      startHistorySource: archivedSeasonProfile.source,
      archiveArsenal: archivedArsenal?.archiveArsenal ?? null,
      archiveProfile: archivedSeasonProfile.archiveProfile,
    };
  }

  if (pitcherId === demoPitcherDetail.id || pitcherId === String(demoPitcherDetail.mlbId)) {
    return {
      ...demoPitcherDetail,
      arsenal: archivedArsenal?.arsenal ?? demoPitcherDetail.arsenal,
      arsenalSource: archivedArsenal?.source ?? "fixture",
      archiveArsenal: archivedArsenal?.archiveArsenal ?? null,
    };
  }
  const matchedStart = demoSlateStarts.find((start) => start.pitcher.id === pitcherId || start.pitcher.mlbId === Number(pitcherId));
  return matchedStart
    ? {
        ...demoPitcherDetail,
        ...matchedStart.pitcher,
        arsenal: archivedArsenal?.arsenal ?? demoPitcherDetail.arsenal,
        arsenalSource: archivedArsenal?.source ?? "fixture",
        archiveArsenal: archivedArsenal?.archiveArsenal ?? null,
        starts: demoPitcherDetail.starts.filter((start) => start.id === matchedStart.id),
      }
    : null;
}

const getCachedPitcherApiResponse = unstable_cache(
  async (pitcherId: string, sort: string | null, result: string | null) => buildPitcherApiResponse(pitcherId, { sort, result }),
  ["pitcher-api-response", "v1"],
  { revalidate: PITCHER_PROFILE_REVALIDATE_SECONDS },
);

export async function getPitcherApiResponse(pitcherId: string, controls: { sort?: string | null; result?: string | null } = {}): Promise<PitcherApiResponse | null> {
  return getCachedPitcherApiResponse(pitcherId, controls.sort ?? null, controls.result ?? null);
}

async function buildPitcherApiResponse(pitcherId: string, controls: { sort?: string | null; result?: string | null } = {}): Promise<PitcherApiResponse | null> {
  const pitcher = await getPitcherDetail(pitcherId);
  if (!pitcher) return null;
  const isLiveProfile = "source" in pitcher && pitcher.source === "live-people-stats";
  const arsenalSource = "arsenalSource" in pitcher && (pitcher.arsenalSource === "archive-gamefeed" || pitcher.arsenalSource === "live-gamefeed") ? pitcher.arsenalSource : "fixture";
  const seasonLineSource = "seasonLineSource" in pitcher && pitcher.seasonLineSource === "archive-gamefeed" ? pitcher.seasonLineSource : isLiveProfile ? "live-people-stats" : "fixture";
  const startHistorySource = "startHistorySource" in pitcher && pitcher.startHistorySource === "archive-gamefeed" ? pitcher.startHistorySource : isLiveProfile ? "live-people-stats" : "fixture";
  const archiveArsenal = "archiveArsenal" in pitcher && pitcher.archiveArsenal ? pitcher.archiveArsenal : null;
  const archiveProfile = "archiveProfile" in pitcher && pitcher.archiveProfile ? pitcher.archiveProfile : null;
  const liveSplits = await fetchMlbPitcherSplits(pitcher.mlbId, getHomeSlateDate().slice(0, 4), { fetchLive: process.env.THE_BUMP_LIVE_MLB === "1" });
  const splitGroups = liveSplits?.map((split) => ({
    ...split,
    status: "live-people-stat-splits" as const,
  })) ?? buildPitcherSplitPlaceholders();
  const splitsSource = liveSplits ? "live-people-stat-splits" : "pending-live-source";

  const allStarts = pitcher.starts.map((start) => ({
    ...start,
    startHref: startPath(start.id),
  }));
  const skillProfile = buildPitcherSkillProfile(allStarts, seasonLineSource);
  const seasonLogControls = normalizePitcherSeasonLogControls(controls, allStarts);
  const starts = sortPitcherSeasonLog(
    seasonLogControls.result === "all" ? allStarts : allStarts.filter((start) => start.result === seasonLogControls.result),
    seasonLogControls.sort,
  ).map(stripPitchEventsFromPitcherStart);

  return {
    id: pitcher.id,
    mlbId: pitcher.mlbId,
    name: pitcher.name,
    team: pitcher.team,
    throws: pitcher.throws,
    headshotUrl: pitcher.headshotUrl,
    seasonLine: pitcher.seasonLine,
    skillProfile,
    arsenal: pitcher.arsenal,
    starts,
    seasonLogSummary: summarizePitcherSeasonLog(starts),
    seasonLogControls,
    source: {
      identity: isLiveProfile ? "live-people-stats" : "fixture",
      seasonLine: seasonLineSource,
      startHistory: startHistorySource,
      arsenal: arsenalSource,
      splits: splitsSource,
      archiveArsenal,
      archiveProfile,
    },
    splits: {
      status: splitsSource,
      groups: splitGroups,
    },
  };
}

function normalizePitcherSeasonLogControls(
  controls: { sort?: string | null; result?: string | null },
  starts: PitcherApiStartLogEntry[],
): PitcherApiSeasonLogControls {
  const sort = controls.sort && PITCHER_SEASON_LOG_SORTS.includes(controls.sort as PitcherApiSeasonLogSort) ? controls.sort as PitcherApiSeasonLogSort : "date-desc";
  const result = controls.result && PITCHER_SEASON_LOG_RESULTS.includes(controls.result as PitcherApiSeasonLogResultFilter) ? controls.result as PitcherApiSeasonLogResultFilter : "all";
  const shownStartCount = result === "all" ? starts.length : starts.filter((start) => start.result === result).length;

  return {
    sort,
    result,
    totalStartCount: starts.length,
    shownStartCount,
    options: {
      sort: PITCHER_SEASON_LOG_SORTS,
      result: PITCHER_SEASON_LOG_RESULTS,
    },
  };
}

function sortPitcherSeasonLog(starts: PitcherApiStartLogEntry[], sort: PitcherApiSeasonLogSort) {
  return [...starts].sort((a, b) => {
    if (sort === "gs-desc") return compareRankedStarts(a, b) || b.date.localeCompare(a.date);
    if (sort === "ip-desc") return b.line.inningsPitched - a.line.inningsPitched || b.date.localeCompare(a.date);
    return b.date.localeCompare(a.date);
  });
}

function summarizePitcherSeasonLog(starts: PitcherApiStartLogEntry[]): PitcherApiSeasonLogSummary {
  if (starts.length === 0) {
    return {
      recentStartCount: 0,
      averageGameScorePlus: 0,
      averageInningsPitched: 0,
      lastStart: null,
      bestStart: null,
    };
  }

  const sortedStarts = [...starts].sort((a, b) => b.date.localeCompare(a.date));
  const lastStart = sortedStarts[0];
  const bestStart = [...starts].sort(compareRankedStarts)[0];
  const averageGameScorePlus = starts.reduce((sum, start) => sum + start.gameScorePlus, 0) / starts.length;
  const averageInningsPitched = starts.reduce((sum, start) => sum + start.line.inningsPitched, 0) / starts.length;

  return {
    recentStartCount: starts.length,
    averageGameScorePlus: Number(averageGameScorePlus.toFixed(1)),
    averageInningsPitched: Number(averageInningsPitched.toFixed(1)),
    lastStart: summarizePitcherStart(lastStart),
    bestStart: summarizePitcherStart(bestStart),
  };
}

function summarizePitcherStart(start: PitcherApiStartLogEntry) {
  return {
    id: start.id,
    date: start.date,
    opponent: start.opponent,
    result: start.result,
    gameScorePlus: start.gameScorePlus,
    startHref: start.startHref,
  };
}

function buildPitcherSkillProfile(
  starts: PitcherApiStartLogEntry[],
  seasonLineSource: PitcherApiResponse["source"]["seasonLine"],
): PitcherSkillProfile {
  const sorted = [...starts].sort((a, b) => b.date.localeCompare(a.date));
  const latestDate = sorted[0]?.date;
  const trailing30 = latestDate
    ? sorted.filter((start) => daysBetween(start.date, latestDate) <= 30)
    : [];
  const source: PitcherSkillProfile["source"] = seasonLineSource === "archive-gamefeed"
    ? "archive-gamefeed-line"
    : seasonLineSource === "live-people-stats"
      ? "live-people-stats-line"
      : "fixture-line";

  const season = summarizeSkillSnapshot("Season", starts);
  const trailing30Snapshot = summarizeSkillSnapshot("Last 30", trailing30);
  const pitchSnapshots = [season, trailing30Snapshot].filter((snapshot) => snapshot.pitchCount > 0);
  const statcastStatus: PitcherSkillProfile["statcastStatus"] = pitchSnapshots.length === 0
    ? "pending"
    : pitchSnapshots.every((snapshot) => snapshot.pitchCount >= Math.max(1, snapshot.starts * 40))
      ? "available"
      : "partial";

  return {
    source,
    note: statcastStatus === "pending"
      ? "Line-backed skill profile from completed-start totals. Statcast CSW, SwStr, chase, zone, expected stats, and contact quality remain pending verified Savant ingestion."
      : "Line-backed profile plus verified pitch-event skills where archived gamefeed or Savant rows exist. Chase, zone, expected stats, and contact quality remain pending full Savant leaderboard ingestion.",
    season,
    trailing30: trailing30Snapshot,
    statcastStatus,
  };
}

function summarizeSkillSnapshot(label: PitcherSkillSnapshot["label"], starts: PitcherApiStartLogEntry[]): PitcherSkillSnapshot {
  if (starts.length === 0) {
    return {
      label,
      status: "insufficient",
      starts: 0,
      inningsPitched: 0,
      era: null,
      whip: null,
      k9: null,
      bb9: null,
      kMinusBbPer9: null,
      avgIpPerStart: null,
      pitchesPerStart: null,
      pitchCount: 0,
      cswPct: null,
      swStrPct: null,
      whiffPct: null,
      avgVelocityMph: null,
      maxVelocityMph: null,
    };
  }

  const innings = starts.reduce((sum, start) => sum + inningsFromIP(start.line.inningsPitched), 0);
  const earnedRuns = starts.reduce((sum, start) => sum + start.line.earnedRuns, 0);
  const hits = starts.reduce((sum, start) => sum + start.line.hits, 0);
  const walks = starts.reduce((sum, start) => sum + start.line.walks, 0);
  const strikeouts = starts.reduce((sum, start) => sum + start.line.strikeouts, 0);
  const pitches = starts.reduce((sum, start) => sum + start.line.pitches, 0);
  const pitchEvents = starts.flatMap((start) => start.pitchEvents ?? []);
  const pitchSkill = summarizePitchEventSkills(pitchEvents);
  const status: PitcherSkillSnapshot["status"] = innings >= 5 ? "line-backed" : "insufficient";

  return {
    label,
    status,
    starts: starts.length,
    inningsPitched: round1(innings),
    era: innings > 0 ? round2((earnedRuns * 9) / innings) : null,
    whip: innings > 0 ? round2((hits + walks) / innings) : null,
    k9: innings > 0 ? round1((strikeouts * 9) / innings) : null,
    bb9: innings > 0 ? round1((walks * 9) / innings) : null,
    kMinusBbPer9: innings > 0 ? round1(((strikeouts - walks) * 9) / innings) : null,
    avgIpPerStart: starts.length > 0 ? round1(innings / starts.length) : null,
    pitchesPerStart: starts.length > 0 && pitches > 0 ? round1(pitches / starts.length) : null,
    ...pitchSkill,
  };
}

function stripPitchEventsFromPitcherStart(start: PitcherApiStartLogEntry): PitcherApiStartLogEntry {
  const publicStart = { ...start };
  delete publicStart.pitchEvents;
  return publicStart;
}

function summarizePitchEventSkills(pitchEvents: PitchEvent[]) {
  if (pitchEvents.length === 0) {
    return {
      pitchCount: 0,
      cswPct: null,
      swStrPct: null,
      whiffPct: null,
      avgVelocityMph: null,
      maxVelocityMph: null,
    };
  }

  const calledStrikes = pitchEvents.filter((pitch) => pitch.result === "called_strike").length;
  const swingingStrikes = pitchEvents.filter((pitch) => pitch.result === "swinging_strike").length;
  const swings = pitchEvents.filter((pitch) => ["swinging_strike", "foul", "hit_into_play"].includes(pitch.result)).length;
  const velocities = pitchEvents.map((pitch) => pitch.velocityMph).filter((velocity) => Number.isFinite(velocity));

  return {
    pitchCount: pitchEvents.length,
    cswPct: round1(((calledStrikes + swingingStrikes) / pitchEvents.length) * 100),
    swStrPct: round1((swingingStrikes / pitchEvents.length) * 100),
    whiffPct: swings > 0 ? round1((swingingStrikes / swings) * 100) : null,
    avgVelocityMph: velocities.length > 0 ? round1(velocities.reduce((total, velocity) => total + velocity, 0) / velocities.length) : null,
    maxVelocityMph: velocities.length > 0 ? round1(Math.max(...velocities)) : null,
  };
}

function buildPitcherSplitPlaceholders(): PitcherApiSplitGroup[] {
  const note = "Split stats are contracted but awaiting a verified MLB public endpoint mapping.";

  return [
    { key: "vs-rhb", label: "Vs RHB", scope: "batter-hand", status: "pending-live-source", inningsPitched: null, era: null, strikeouts: null, walks: null, opponentAverage: null, note },
    { key: "vs-lhb", label: "Vs LHB", scope: "batter-hand", status: "pending-live-source", inningsPitched: null, era: null, strikeouts: null, walks: null, opponentAverage: null, note },
    { key: "home", label: "Home", scope: "venue", status: "pending-live-source", inningsPitched: null, era: null, strikeouts: null, walks: null, opponentAverage: null, note },
    { key: "away", label: "Away", scope: "venue", status: "pending-live-source", inningsPitched: null, era: null, strikeouts: null, walks: null, opponentAverage: null, note },
  ];
}

async function getCompletedPitchingLineMap(schedule: MlbSchedule) {
  const archivedLines = await readArchivedCompletedPitchingLines(schedule.date);
  const lines = new Map<string, CompletedPitchingLineEntry>(
    archivedLines.map((line) => [startLineKey(line.gamePk, line.pitcherMlbId), { ...line, source: "archive-gamefeed" as const }]),
  );

  if (schedule.source === "live" || process.env.THE_BUMP_LIVE_MLB === "1") {
    const liveLinesByGame = await Promise.all(
      schedule.games
        .filter((game) => isLiveGameState(game) || isFinalGameState(game))
        .filter((game) => !lines.has(startLineKey(game.gamePk, game.probableAwayPitcher?.id ?? 0)) || !lines.has(startLineKey(game.gamePk, game.probableHomePitcher?.id ?? 0)))
        .map((game) => fetchMlbCompletedPitchingLines(game.gamePk, { fetchLive: true, gamefeedRevalidateSeconds: LIVE_STARTER_RESULT_REVALIDATE_SECONDS })),
    );

    for (const line of liveLinesByGame.flat()) {
      const key = startLineKey(line.gamePk, line.pitcherMlbId);
      if (!lines.has(key)) lines.set(key, { ...line, source: "live-gamefeed" });
    }
  }

  return lines;
}

async function getTeamQualityContextMap(date: string) {
  return fetchMlbTeamQualityContexts(date, { fetchLive: process.env.THE_BUMP_LIVE_MLB === "1" || shouldFetchLiveSchedule(date) });
}

function startLineKey(gamePk: number, pitcherMlbId: number) {
  return `${gamePk}:${pitcherMlbId}`;
}

function isLiveGameState(game: MlbScheduleGame) {
  const status = `${game.status} ${game.detailedState}`.toLowerCase();
  return /\b(live|in progress|manager challenge|review|delayed)\b/.test(status);
}

function summarizeCompletedStartSource(starts: StartSummary[]) {
  if (starts.some((start) => start.source?.line === "archive-gamefeed")) return "archive-gamefeed";
  if (starts.some((start) => start.source?.line === "live-gamefeed")) return "live-gamefeed";
  return "fixture";
}

function summarizeCompletedStartSourceCoverage(starts: StartSummary[]) {
  return starts.reduce(
    (coverage, start) => {
      const lineSource = start.source?.line;

      if (lineSource === "archive-gamefeed") coverage.archiveGamefeed += 1;
      else if (lineSource === "live-gamefeed") coverage.liveGamefeed += 1;
      else coverage.fixture += 1;

      coverage.total += 1;
      return coverage;
    },
    {
      total: 0,
      archiveGamefeed: 0,
      liveGamefeed: 0,
      fixture: 0,
    },
  );
}

function getRankingSource(lineSource: StartDataSource["line"]): StartDataSource["ranking"] {
  if (lineSource === "archive-gamefeed") return "schedule-derived-archive-line";
  if (lineSource === "live-gamefeed") return "schedule-derived-gamefeed-line";
  return "schedule-derived-fixture-line";
}

function summarizeStartPitchCounts(pitchEvents: PitchEvent[]): StartApiPitchCount {
  const byType: StartApiPitchCount["byType"] = {};
  const byInningMap = new Map<number, number>();

  for (const pitch of pitchEvents) {
    byType[pitch.type] = (byType[pitch.type] ?? 0) + 1;
    byInningMap.set(pitch.inning, (byInningMap.get(pitch.inning) ?? 0) + 1);
  }

  return {
    total: pitchEvents.length,
    byType,
    byInning: Array.from(byInningMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([inning, pitches]) => ({ inning, pitches })),
  };
}

function withStartSummaries(start: StartDetail): StartDetail {
  return {
    ...start,
    expectedGameScorePlus: summarizeExpectedGameScorePlus(start.line, start.context),
    gameScoreV2: start.gameScoreV2 ?? calculateGameScoreV2(start.line),
    eventFlags: start.eventFlags ?? deriveStartEventFlags(start.result, start.gameScorePlus),
    velocityTrend: summarizeVelocityTrend(start.pitchEvents),
    inningTimeline: summarizeInningTimeline(start.pitchEvents),
    countLeverage: summarizeCountLeverage(start.pitchEvents),
    pitchSequence: summarizePitchSequence(start.pitchEvents),
    gameScorePlusBreakdown: summarizeGameScorePlus(start.line, start.gameScorePlus, start.context),
  };
}

function summarizeExpectedGameScorePlus(line: StartLine, context?: StartContext) {
  const computedInnings = inningsFromIP(line.inningsPitched);
  const raw = 45
    + computedInnings * 3.2
    + line.strikeouts * 2.6
    - line.walks * 2.1
    + (context ? (NEUTRAL_PARK_RUN_FACTOR - context.parkRunFactor) * 10 : 0);
  const scaled = GAME_SCORE_PLUS_DISPLAY_MIDPOINT + (raw - GAME_SCORE_PLUS_RAW_MIDPOINT) * GAME_SCORE_PLUS_RAW_TO_DISPLAY_MULTIPLIER;
  return Math.max(GAME_SCORE_PLUS_DISPLAY_MIN, Math.min(GAME_SCORE_PLUS_DISPLAY_MAX, Math.round(scaled)));
}

function summarizePitchSequence(pitchEvents: PitchEvent[]): StartApiPitchSequenceRow[] {
  return pitchEvents.map((pitch) => ({
    id: pitch.id,
    pitchNumber: pitch.pitchNumber,
    inning: pitch.inning,
    count: pitch.count,
    countLabel: `${pitch.count.balls}-${pitch.count.strikes}`,
    type: pitch.type,
    result: pitch.result,
    velocityMph: pitch.velocityMph,
    plateX: pitch.plateX,
    plateZ: pitch.plateZ,
    locationLabel: `${pitch.plateX.toFixed(2)} / ${pitch.plateZ.toFixed(2)}`,
  }));
}

function summarizeCountLeverage(pitchEvents: PitchEvent[]): StartApiCountLeverage[] {
  const innings = new Map<number, StartApiCountLeverage>();

  for (const pitch of pitchEvents) {
    const leverage = innings.get(pitch.inning) ?? {
      inning: pitch.inning,
      ahead: 0,
      even: 0,
      behind: 0,
      twoStrike: 0,
    };

    if (pitch.count.strikes === 2) leverage.twoStrike += 1;
    if (pitch.count.strikes > pitch.count.balls) leverage.ahead += 1;
    else if (pitch.count.balls > pitch.count.strikes) leverage.behind += 1;
    else leverage.even += 1;

    innings.set(pitch.inning, leverage);
  }

  return Array.from(innings.values()).sort((a, b) => a.inning - b.inning);
}

function summarizeInningTimeline(pitchEvents: PitchEvent[]): StartApiInningTimeline[] {
  const innings = new Map<number, PitchEvent[]>();

  for (const pitch of pitchEvents) {
    innings.set(pitch.inning, [...(innings.get(pitch.inning) ?? []), pitch]);
  }

  return Array.from(innings.entries())
    .sort(([a], [b]) => a - b)
    .map(([inning, inningPitches]) => {
      const velocities = inningPitches.map((pitch) => pitch.velocityMph);
      const avgVelocityMph = average(velocities);

      return {
        inning,
        pitches: inningPitches.length,
        strikes: inningPitches.filter((pitch) => pitch.result === "called_strike" || pitch.result === "swinging_strike").length,
        whiffs: inningPitches.filter((pitch) => pitch.result === "swinging_strike").length,
        inPlay: inningPitches.filter((pitch) => pitch.result === "hit_into_play").length,
        avgVelocityMph,
        maxVelocityMph: velocities.length ? Math.max(...velocities) : 0,
      };
    });
}

function summarizeVelocityTrend(pitchEvents: PitchEvent[]): StartApiVelocityTrend[] {
  return summarizeInningTimeline(pitchEvents).map((inning) => ({
    inning: inning.inning,
    avgVelocityMph: inning.avgVelocityMph,
    maxVelocityMph: inning.maxVelocityMph,
  }));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

const GAME_SCORE_PLUS_DISPLAY_MIN = 20;
const GAME_SCORE_PLUS_DISPLAY_MAX = 80;
const GAME_SCORE_PLUS_DISPLAY_MIDPOINT = 50;
const GAME_SCORE_PLUS_RAW_MIDPOINT = 59;
const GAME_SCORE_PLUS_RAW_TO_DISPLAY_MULTIPLIER = 0.72;
const GAME_SCORE_PLUS_GRADE_LABELS: StartApiGameScorePlusGradeLabel[] = ["Elite", "Plus", "Average", "Below average", "Poor"];
const GAME_SCORE_PLUS_EXPLANATION: SlateApiScoreScale["explanation"] = [
  {
    label: "Start line",
    value: "IP / K / ER / traffic",
    description: "Length and missed bats lift the score; runs, hits, and walks pull it back.",
  },
  {
    label: "Context",
    value: "Park / opponent",
    description: "The same line gets adjusted for run environment and matchup quality.",
  },
  {
    label: "Display",
    value: "20-80 GS+",
    description: "The raw total is calibrated onto a scouting-style range so slate ranks are easy to scan.",
  },
];

function summarizeGameScorePlus(line: StartLine, total?: number, context?: StartContext): StartApiGameScorePlusBreakdown {
  const computedInnings = inningsFromIP(line.inningsPitched);
  const baseComponents = [
    { key: "baseline" as const, label: "Baseline", value: 45, description: "Neutral starting point for every outing." },
    { key: "innings" as const, label: "Length", value: computedInnings * 3, description: `${line.inningsPitched.toFixed(1)} innings pitched.` },
    { key: "strikeouts" as const, label: "Misses", value: line.strikeouts * 2.2, description: `${line.strikeouts} strikeouts.` },
    { key: "earnedRuns" as const, label: "Runs", value: line.earnedRuns * -5, description: `${line.earnedRuns} earned runs allowed.` },
    { key: "hits" as const, label: "Traffic", value: line.hits * -1.2, description: `${line.hits} hits allowed.` },
    { key: "walks" as const, label: "Free passes", value: line.walks * -1.5, description: `${line.walks} walks allowed.` },
  ];
  const contextComponents = context
    ? [
        {
          key: "whiffDelta" as const,
          label: "Whiff context",
          value: context.whiffDeltaPct * 0.35,
          description: `${formatSignedNumber(context.whiffDeltaPct)} pct points vs expected whiff rate.`,
        },
        {
          key: "velocityDelta" as const,
          label: "Velocity context",
          value: context.velocityDeltaMph * 1.75,
          description: `${formatSignedNumber(context.velocityDeltaMph)} mph vs recent baseline.`,
        },
        {
          key: "parkContext" as const,
          label: "Park context",
          value: (NEUTRAL_PARK_RUN_FACTOR - context.parkRunFactor) * 12,
          description: `${context.parkLabel} at ${context.parkRunFactor.toFixed(2)} run factor.`,
        },
        {
          key: "opponentQuality" as const,
          label: "Opponent quality",
          value: context.opponentQualityRunValue,
          description: context.opponentQualityLabel,
        },
        {
          key: "opponentOffense" as const,
          label: "Opponent offense",
          value: context.opponentOffenseRunValue,
          description: context.opponentOffenseLabel,
        },
      ]
    : [];
  const scoringComponents = [...baseComponents, ...contextComponents];
  const rawTotal = scoringComponents.reduce((sum, component) => sum + component.value, 0);
  const scaledTotal = GAME_SCORE_PLUS_DISPLAY_MIDPOINT + (rawTotal - GAME_SCORE_PLUS_RAW_MIDPOINT) * GAME_SCORE_PLUS_RAW_TO_DISPLAY_MULTIPLIER;
  const scoredTotal = total ?? Math.max(GAME_SCORE_PLUS_DISPLAY_MIN, Math.min(GAME_SCORE_PLUS_DISPLAY_MAX, Math.round(scaledTotal)));
  const computedPreciseTotal = Math.max(GAME_SCORE_PLUS_DISPLAY_MIN, Math.min(GAME_SCORE_PLUS_DISPLAY_MAX, scaledTotal));
  const preciseTotal = Math.round(computedPreciseTotal) === scoredTotal ? computedPreciseTotal : scoredTotal;
  const calibration = scoredTotal - Math.round(rawTotal);
  const components = calibration === 0
    ? scoringComponents
    : [
        ...scoringComponents,
        {
          key: "calibration" as const,
          label: "Scale adjustment",
          value: calibration,
          description: "Recalibrates the raw component total onto the slightly lifted 20-80 displayed ranking scale.",
        },
      ];
  const rankingReasons = components
    .filter((component) => component.key !== "baseline" && component.key !== "calibration" && component.value !== 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 3)
    .map((component) => ({
      ...component,
      impact: component.value > 0 ? "positive" as const : "negative" as const,
    }));

  return {
    total: scoredTotal,
    preciseTotal: Number(preciseTotal.toFixed(3)),
    formulaVersion: "context-v7",
    gradeBand: getGameScorePlusGradeBand(scoredTotal),
    components,
    rankingReasons,
  };
}

function getGameScorePlusGradeBand(score: number): StartApiGameScorePlusBreakdown["gradeBand"] {
  if (score >= 70) {
    return {
      label: "Elite",
      percentileLabel: "Top 5%",
      rangeLabel: "70-80",
      description: "Ace-level outing on the displayed 20-80 Game Score+ scale.",
    };
  }

  if (score >= 60) {
    return {
      label: "Plus",
      percentileLabel: "Top 20%",
      rangeLabel: "60-69",
      description: "Clearly above-average start with ranking impact.",
    };
  }

  if (score >= 50) {
    return {
      label: "Average",
      percentileLabel: "Middle band",
      rangeLabel: "50-59",
      description: "Solid start near the midpoint of the 20-80 display scale.",
    };
  }

  if (score >= 40) {
    return {
      label: "Below average",
      percentileLabel: "Lower 35%",
      rangeLabel: "40-49",
      description: "Below-average start after line and context adjustments.",
    };
  }

  return {
    label: "Poor",
    percentileLabel: "Bottom band",
    rangeLabel: "20-39",
    description: "Rough start on the displayed 20-80 Game Score+ scale.",
  };
}

export function scoreCompletedLine(line: StartLine, context?: StartContext) {
  return summarizeGameScorePlus(line, undefined, context).total;
}

export function summarizeSlateScoreScale(starts: StartSummary[]): SlateApiScoreScale {
  const scores = starts.map((start) => start.gameScorePlusBreakdown?.total ?? start.gameScorePlus);
  const low = scores.length ? Math.min(...scores) : GAME_SCORE_PLUS_DISPLAY_MIN;
  const high = scores.length ? Math.max(...scores) : GAME_SCORE_PLUS_DISPLAY_MIN;
  const averageScore = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : GAME_SCORE_PLUS_DISPLAY_MIN;
  const gradeBandCounts = new Map<StartApiGameScorePlusGradeLabel, number>(GAME_SCORE_PLUS_GRADE_LABELS.map((label) => [label, 0]));

  for (const start of starts) {
    const gradeBand = start.gameScorePlusBreakdown?.gradeBand ?? getGameScorePlusGradeBand(start.gameScorePlus);
    gradeBandCounts.set(gradeBand.label, (gradeBandCounts.get(gradeBand.label) ?? 0) + 1);
  }

  return {
    formulaVersion: "context-v7",
    displayRange: "20-80",
    low,
    high,
    average: Number(averageScore.toFixed(1)),
    explanation: GAME_SCORE_PLUS_EXPLANATION,
    gradeBandCounts: GAME_SCORE_PLUS_GRADE_LABELS.map((label) => ({
      label,
      count: gradeBandCounts.get(label) ?? 0,
    })),
  };
}

function summarizeScoreDeltaComparison(starts: StartSummary[]): SlateApiScoreDeltaComparison | null {
  const comparedStarts = starts.filter((start) => start.gameScorePlusBreakdown).slice(0, 3);
  const leader = comparedStarts[0];

  if (!leader?.gameScorePlusBreakdown || comparedStarts.length < 2) return null;

  const componentKeys = leader.gameScorePlusBreakdown.rankingReasons.map((reason) => reason.key);
  const leaderComponents = leader.gameScorePlusBreakdown.components.filter((component) => componentKeys.includes(component.key));

  return {
    leader: {
      rank: leader.rank,
      pitcherName: leader.pitcher.name,
      gameScorePlus: leader.gameScorePlus,
    },
    comparedStarts: comparedStarts.map((start) => ({
      rank: start.rank,
      pitcherName: start.pitcher.name,
      gameScorePlus: start.gameScorePlus,
    })),
    components: leaderComponents.map((leaderComponent) => ({
      key: leaderComponent.key,
      label: leaderComponent.label,
      description: leaderComponent.description,
      leaderValue: leaderComponent.value,
      rows: comparedStarts.map((start) => {
        const component = start.gameScorePlusBreakdown?.components.find((item) => item.key === leaderComponent.key);
        const value = component?.value ?? 0;

        return {
          rank: start.rank,
          pitcherName: start.pitcher.name,
          gameScorePlus: start.gameScorePlus,
          value,
          deltaVsLeader: Number((value - leaderComponent.value).toFixed(2)),
        };
      }),
    })),
  };
}

function formatSignedNumber(value: number) {
  return `${value >= 0 ? "+" : ""}${Number.isInteger(value) ? value : value.toFixed(1)}`;
}

async function buildScheduledStarts(
  schedule: MlbSchedule,
  completedLines = new Map<string, CompletedPitchingLineEntry>(),
  teamQualityContexts = new Map<string, MlbTeamQualityContext>(),
) {
  const establishedStarterIds = await getEstablishedStarterPitcherIds(schedule, completedLines);
  const starts = schedule.games.map((game) => scheduledGameToStarts(game, schedule.date, completedLines, teamQualityContexts, schedule.source, establishedStarterIds));
  return starts.flat();
}

async function getEstablishedStarterPitcherIds(schedule: MlbSchedule, completedLines: Map<string, CompletedPitchingLineEntry>) {
  if (!shouldFetchLiveSchedule(schedule.date)) return new Set<number>();

  const scheduleGamePks = new Set(schedule.games.map((game) => game.gamePk));
  const pitcherIds = Array.from(new Set(
    Array.from(completedLines.values())
      .filter((line) => scheduleGamePks.has(line.gamePk))
      .map((line) => line.pitcherMlbId),
  ));

  const profiles = await Promise.all(
    pitcherIds.map(async (pitcherId) => ({
      pitcherId,
      profile: await fetchMlbPitcherSeasonProfile(pitcherId, schedule.date.slice(0, 4), { fetchLive: true }),
    })),
  );

  return new Set(
    profiles
      .filter(({ profile }) => hasEstablishedStarterWorkload(profile))
      .map(({ pitcherId }) => pitcherId),
  );
}

function hasEstablishedStarterWorkload(profile: Awaited<ReturnType<typeof fetchMlbPitcherSeasonProfile>>) {
  if (!profile) return false;

  const starts = profile.seasonLine.starts || profile.starts.length;
  if (starts < ESTABLISHED_STARTER_MIN_SEASON_STARTS) return false;

  const inningsPitched = profile.seasonLine.inningsPitched;
  return inningsPitched / starts >= ESTABLISHED_STARTER_MIN_AVG_IP;
}

function scheduledGameToStarts(
  game: MlbScheduleGame,
  date: string,
  completedLines = new Map<string, CompletedPitchingLineEntry>(),
  teamQualityContexts = new Map<string, MlbTeamQualityContext>(),
  scheduleSource: MlbSchedule["source"] = "fixture",
  establishedStarterIds = new Set<number>(),
): StartSummary[] {
  const probableCandidates = [
    { pitcher: game.probableAwayPitcher, opponent: game.homeTeam.abbreviation },
    { pitcher: game.probableHomePitcher, opponent: game.awayTeam.abbreviation },
  ];
  const probablePitcherIds = new Set(probableCandidates.map((candidate) => candidate.pitcher?.id).filter((id): id is number => Boolean(id)));
  const completedCandidates = Array.from(completedLines.values())
    .filter((entry) => entry.gamePk === game.gamePk && !probablePitcherIds.has(entry.pitcherMlbId))
    .map((entry) => ({
      pitcher: {
        id: entry.pitcherMlbId,
        fullName: entry.pitcherName ?? `Pitcher ${entry.pitcherMlbId}`,
        teamAbbreviation: entry.teamAbbreviation,
        opponentAbbreviation: entry.opponentAbbreviation,
        side: entry.side,
      },
      opponent: entry.opponentAbbreviation,
    }));
  const candidates = [...probableCandidates, ...completedCandidates];

  return candidates
    .filter((candidate): candidate is { pitcher: MlbProbablePitcher; opponent: string } => Boolean(candidate.pitcher))
    .map(({ pitcher, opponent }, index) => {
      const fallback = demoSlateStarts[(game.gamePk + index) % demoSlateStarts.length];
      const completedLine = completedLines.get(startLineKey(game.gamePk, pitcher.id));
      const lineSource = completedLine?.source ?? "fixture";
      const line = completedLine?.line ?? fallback.line;
      const plannedStarter = probablePitcherIds.has(pitcher.id) || establishedStarterIds.has(pitcher.id);
      const colors = teamColors[pitcher.teamAbbreviation] ?? { color: fallback.teamColor ?? FALLBACK_TEAM_COLOR, accent: fallback.accentColor ?? FALLBACK_ACCENT_COLOR };
      const rankSeed = game.gamePk + pitcher.id;
      const opponentQualityContext = teamQualityContexts.get(opponent);
      const context = {
        label: `${fallback.context.label} / ${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}, ${game.venue}`,
        whiffDeltaPct: fallback.context.whiffDeltaPct,
        velocityDeltaMph: fallback.context.velocityDeltaMph,
        parkRunFactor: getVenueRunFactor(game.venue),
        parkLabel: game.venue,
        opponentQualityRunValue: opponentQualityContext?.opponentQualityRunValue ?? getOpponentQualityRunValue(opponent),
        opponentQualityLabel: opponentQualityContext?.opponentQualityLabel ?? `${opponent} scheduled opponent quality from the MLB schedule matchup.`,
        opponentOffenseRunValue: opponentQualityContext?.opponentOffenseRunValue ?? getOpponentOffenseRunValue(opponent),
        opponentOffenseLabel: opponentQualityContext?.opponentOffenseLabel ?? `${opponent} scheduled offense quality from fixture lineup context.`,
      };
      const gameScorePlus = completedLine ? scoreCompletedLine(line, context) : Math.max(40, fallback.gameScorePlus - (rankSeed % 5));
      const gameScorePlusBreakdown = summarizeGameScorePlus(line, gameScorePlus, context);

      return {
        id: `${date}-${pitcher.teamAbbreviation.toLowerCase()}-${opponent.toLowerCase()}-${pitcher.id}`,
        gamePk: game.gamePk,
        date,
        rank: 1,
        pitcher: {
          id: String(pitcher.id),
          mlbId: pitcher.id,
          name: pitcher.fullName,
          team: pitcher.teamAbbreviation,
          throws: fallback.pitcher.throws,
          headshotUrl: `https://img.mlbstatic.com/mlb-photos/image/upload/w_360,q_auto:best/v1/people/${pitcher.id}/headshot/67/current`,
        },
        opponent,
        result: completedLine?.result ?? fallback.result,
        line,
        gameScorePlus,
        gameScorePlusBreakdown,
        plannedStarter,
        teamColor: colors.color,
        accentColor: colors.accent,
        context,
        source: {
          schedule: scheduleSource,
          line: lineSource,
          ranking: getRankingSource(lineSource),
        },
      };
    });
}

export async function getArchivedSlateStarts(date: string): Promise<StartSummary[]> {
  const archivedStarts = await readCompletedStarts(date);

  return canonicalizeStartSummaries(archivedStarts
    .map((start) => archivedCompletedStartToSummary(start))
    .sort(compareRankedStarts)
    .map((start, index) => ({ ...start, rank: index + 1 })));
}

export async function getArchivedSeasonStartSummaries(season = getHomeSlateDate().slice(0, 4)): Promise<StartSummary[]> {
  const archivedStarts = await readSeasonCompletedStarts(season);

  return canonicalizeStartSummaries(archivedStarts
    .map((start) => archivedCompletedStartToSummary(start))
    .sort((a, b) => a.date.localeCompare(b.date) || a.gamePk - b.gamePk));
}

async function readCompletedStarts(date: string) {
  const supabaseStarts = await readSupabaseArchivedCompletedStarts(date);
  return supabaseStarts.length > 0 ? supabaseStarts : readArchivedCompletedStarts(date);
}

async function readSeasonCompletedStarts(season: string) {
  const supabaseStarts = await readSupabaseArchivedSeasonCompletedStarts(season);
  return supabaseStarts.length > 0 ? supabaseStarts : readArchivedSeasonCompletedStarts(season);
}

function archivedCompletedStartToSummary(start: ArchivedCompletedStartSummary): StartSummary {
  const fallback = demoSlateStarts[(start.gamePk + start.pitcherMlbId) % demoSlateStarts.length];
  const colors = teamColors[start.team] ?? { color: fallback.teamColor ?? FALLBACK_TEAM_COLOR, accent: fallback.accentColor ?? FALLBACK_ACCENT_COLOR };
  const context = {
    label: `${start.awayTeam.abbreviation} @ ${start.homeTeam.abbreviation}, ${start.venue}`,
    whiffDeltaPct: fallback.context.whiffDeltaPct,
    velocityDeltaMph: fallback.context.velocityDeltaMph,
    parkRunFactor: getVenueRunFactor(start.venue),
    parkLabel: start.venue,
    opponentQualityRunValue: getOpponentQualityRunValue(start.opponent),
    opponentQualityLabel: `${start.opponent} archived opponent quality from the stored MLB archive matchup.`,
    opponentOffenseRunValue: getOpponentOffenseRunValue(start.opponent),
    opponentOffenseLabel: `${start.opponent} archived offense quality from fixture lineup context.`,
  };

  return {
    id: `${start.date}-${start.team.toLowerCase()}-${start.opponent.toLowerCase()}-${start.pitcherMlbId}`,
    gamePk: start.gamePk,
    date: start.date,
    rank: 1,
    pitcher: {
      id: String(start.pitcherMlbId),
      mlbId: start.pitcherMlbId,
      name: start.pitcherName,
      team: start.team,
      throws: fallback.pitcher.throws,
      headshotUrl: `https://img.mlbstatic.com/mlb-photos/image/upload/w_360,q_auto:best/v1/people/${start.pitcherMlbId}/headshot/67/current`,
    },
    opponent: start.opponent,
    result: start.result,
    line: start.line,
    gameScorePlus: scoreCompletedLine(start.line, context),
    gameScoreV2: calculateGameScoreV2(start.line),
    gameScorePlusBreakdown: summarizeGameScorePlus(start.line, undefined, context),
    teamColor: colors.color,
    accentColor: colors.accent,
    context,
    source: {
      schedule: "live",
      line: "archive-gamefeed",
      ranking: "schedule-derived-archive-line",
    },
  };
}

function getVenueRunFactor(venue: string) {
  return venueRunFactors[venue] ?? NEUTRAL_PARK_RUN_FACTOR;
}

function getOpponentQualityRunValue(opponent: string) {
  return opponentQualityRunValues[opponent] ?? 0;
}

function getOpponentOffenseRunValue(opponent: string) {
  return opponentOffenseRunValues[opponent] ?? 0;
}

function teamSummaryFromScheduleTeam(team: MlbScheduleGame["homeTeam"]): TeamSummary {
  const colors = teamColors[team.abbreviation] ?? { color: FALLBACK_TEAM_COLOR, accent: FALLBACK_ACCENT_COLOR };

  return {
    abbreviation: team.abbreviation,
    name: team.name,
    color: colors.color,
    accentColor: colors.accent,
  };
}

function teamSummaryFromArchiveTeam(team: Pick<TeamSummary, "abbreviation" | "name">): TeamSummary {
  return teamSummaryFromScheduleTeam(team);
}

function scheduledGameToGameSummary(game: MlbScheduleGame, date: string): GameSummary {
  const status = game.status.toLowerCase();
  const detailedState = game.detailedState.toLowerCase();
  const isFinal = status === "final" || detailedState === "final" || detailedState === "game over";

  return {
    gamePk: game.gamePk,
    date,
    awayTeam: teamSummaryFromScheduleTeam(game.awayTeam),
    homeTeam: teamSummaryFromScheduleTeam(game.homeTeam),
    venue: game.venue,
    status: isFinal ? "final" : status === "live" || status === "in progress" ? "live" : "scheduled",
  };
}
