import { getFormLeaderboard } from "@/lib/data/form-service";
import { getDefaultSlateDates, getSlateSchedule, getTodayProbables } from "@/lib/data/start-service";
import { MUSTWATCH_CONFIG, watchTierOf } from "@/lib/form-tokens";
import type { FormSummary, MlbProbablePitcher, MlbScheduleGame, TonightGame, TonightGameStatus, TonightResponse, TonightStarter, UpcomingResponse, WatchTierKey } from "@/lib/types";

type TonightOptions = {
  date?: string;
  window?: 3 | 5 | 10;
};

type CachedTonight = {
  expiresAt: number;
  promise: Promise<TonightResponse>;
};

const TONIGHT_CACHE_TTL_MS = 60 * 1000;
const tonightCache = new Map<string, CachedTonight>();

export async function getTonightMustWatch(options: TonightOptions = {}): Promise<TonightResponse> {
  const date = normalizeDateKey(options.date) ?? (await getDefaultSlateDates()).upcomingDate;
  const window = options.window ?? MUSTWATCH_CONFIG.windowDefault;
  const cacheKey = `${date}:${window}`;
  const cached = tonightCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = buildTonightMustWatch(date, window);
  tonightCache.set(cacheKey, {
    expiresAt: Date.now() + TONIGHT_CACHE_TTL_MS,
    promise,
  });

  return promise;
}

async function buildTonightMustWatch(date: string, window: 3 | 5 | 10): Promise<TonightResponse> {
  const [schedule, probables, leaderboard] = await Promise.all([
    getSlateSchedule({ window: "today", date }),
    getTodayProbables(date),
    getFormLeaderboard({ window, qualifiedOnly: false }),
  ]);
  const formByPitcher = new Map(leaderboard.pitchers.map((pitcher) => [pitcher.pitcherId, pitcher]));
  const probableScoresByGame = groupProbableMatchupScores(probables);
  const candidates = schedule.games
    .map((game) => buildTonightGame(game, date, formByPitcher, probableScoresByGame.get(game.gamePk) ?? [], leaderboard.leagueMeanGS))
    .filter((game) => game.status !== "final");
  const matchupRanks = rankMatchups(candidates);
  const games = candidates
    .map((game) => ({ ...game, matchupRankTonight: matchupRanks.get(game.gamePk) ?? game.matchupRankTonight }))
    .sort((a, b) => {
      if (a.status === "ppd" && b.status !== "ppd") return 1;
      if (a.status !== "ppd" && b.status === "ppd") return -1;
      if (isStartedStatus(a.status) && !isStartedStatus(b.status)) return 1;
      if (!isStartedStatus(a.status) && isStartedStatus(b.status)) return -1;
      return b.gameWatchScore - a.gameWatchScore;
    });

  return {
    date,
    generatedAt: new Date().toISOString(),
    leagueMeanGS: leaderboard.leagueMeanGS,
    matchupScoreRange: MUSTWATCH_CONFIG.matchupScoreRange,
    scheduledGames: schedule.games.length,
    games,
  };
}

export async function getUpcomingMustWatch(options: { date?: string; start?: string; days?: number; window?: 3 | 5 | 10 } = {}): Promise<UpcomingResponse> {
  const start = normalizeDateKey(options.start ?? options.date) ?? (await getDefaultSlateDates()).upcomingDate;
  const days = normalizeUpcomingDays(options.days);
  const dateList = Array.from({ length: days }, (_, index) => addDays(start, index));
  const upcomingDays = await Promise.all(dateList.map((date) => getTonightMustWatch({ date, window: options.window })));

  return {
    range: {
      start,
      end: dateList[dateList.length - 1],
    },
    generatedAt: new Date().toISOString(),
    days: upcomingDays,
  };
}

function buildTonightGame(
  game: MlbScheduleGame,
  date: string,
  formByPitcher: Map<string, FormSummary>,
  probableMatchupScores: number[],
  leagueMeanGS: number,
): TonightGame {
  const status = normalizeGameStatus(game);
  const awayStarter = buildTonightStarter(game.probableAwayPitcher, "away", game.awayTeam.abbreviation, formByPitcher);
  const homeStarter = buildTonightStarter(game.probableHomePitcher, "home", game.homeTeam.abbreviation, formByPitcher);
  const matchupScore = clampMatchupScore(probableMatchupScores.length > 0 ? round1(mean(probableMatchupScores)) : neutralMatchupScore());
  const starterScores = [starterWatchValue(awayStarter, leagueMeanGS), starterWatchValue(homeStarter, leagueMeanGS)];
  const normMatchup = normalizeMatchupScore(matchupScore);
  const topArm = Math.max(starterScores[0], starterScores[1]);
  const pairing = mean(starterScores);
  const gameWatchScore = status === "ppd" ? 0 : round1(calculateGameWatchScore(starterScores[0], starterScores[1], normMatchup));
  const watchTier = watchTierOf(gameWatchScore).key as WatchTierKey;
  const tbd = awayStarter.status === "tbd" || homeStarter.status === "tbd";
  const limitedForm = awayStarter.status !== "ok" || homeStarter.status !== "ok";

  return {
    gamePk: String(game.gamePk),
    date,
    status,
    firstPitch: game.gameDate,
    park: game.venue,
    away: game.awayTeam.abbreviation,
    home: game.homeTeam.abbreviation,
    label: `${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`,
    matchupScore,
    matchupRankTonight: 1,
    starters: [awayStarter, homeStarter],
    gameWatchScore,
    watchTier,
    watchComponents: {
      topArm: round1(topArm),
      pairing: round1(pairing),
      matchup: round1(normMatchup),
    },
    flags: {
      tbd,
      limitedForm,
    },
  };
}

function isStartedStatus(status: TonightGameStatus) {
  return status === "live" || status === "final";
}

function buildTonightStarter(
  probable: MlbProbablePitcher | undefined,
  side: "home" | "away",
  team: string,
  formByPitcher: Map<string, FormSummary>,
): TonightStarter {
  if (!probable) {
    return {
      pitcherId: null,
      name: null,
      team,
      side,
      status: "tbd",
    };
  }

  const form = formByPitcher.get(String(probable.id));
  if (!form) {
    return {
      pitcherId: String(probable.id),
      name: probable.fullName,
      team: probable.teamAbbreviation,
      side,
      status: "insufficient",
    };
  }

  return {
    pitcherId: form.pitcherId,
    name: form.name,
    team: form.team,
    side,
    status: form.status,
    rgs: form.rgs,
    tier: form.tier,
    trend: form.trend,
    deltaForm: form.deltaForm,
    spark: form.spark,
    lastStart: form.lastStart,
  };
}

function starterWatchValue(starter: TonightStarter, leagueMeanGS: number) {
  if (starter.status === "ok" && starter.rgs !== undefined) return starter.rgs;
  if (starter.lastStart?.gsPlus) return starter.lastStart.gsPlus;
  return leagueMeanGS;
}

function calculateGameWatchScore(a: number, b: number, normMatchup: number) {
  return (
    MUSTWATCH_CONFIG.weights.topArm * Math.max(a, b) +
    MUSTWATCH_CONFIG.weights.pairAvg * mean([a, b]) +
    MUSTWATCH_CONFIG.weights.matchup * normMatchup
  );
}

function normalizeMatchupScore(score: number) {
  const range = MUSTWATCH_CONFIG.matchupScoreRange;
  const clamped = clamp(range.min, range.max, score);
  const share = (clamped - range.min) / (range.max - range.min || 1);
  return 20 + share * 60;
}

function neutralMatchupScore() {
  return (MUSTWATCH_CONFIG.matchupScoreRange.min + MUSTWATCH_CONFIG.matchupScoreRange.max) / 2;
}

function clampMatchupScore(score: number) {
  const range = MUSTWATCH_CONFIG.matchupScoreRange;
  return clamp(range.min, range.max, score);
}

function groupProbableMatchupScores(probables: Array<{ gamePk: number; matchupScore: number }>) {
  const scores = new Map<number, number[]>();
  for (const probable of probables) {
    const current = scores.get(probable.gamePk) ?? [];
    current.push(probable.matchupScore);
    scores.set(probable.gamePk, current);
  }
  return scores;
}

function rankMatchups(games: TonightGame[]) {
  const sorted = [...games].sort((a, b) => {
    if (a.status === "ppd" && b.status !== "ppd") return 1;
    if (a.status !== "ppd" && b.status === "ppd") return -1;
    return b.matchupScore - a.matchupScore || Number(a.gamePk) - Number(b.gamePk);
  });
  return new Map(sorted.map((game, index) => [game.gamePk, index + 1]));
}

function normalizeGameStatus(game: MlbScheduleGame): TonightGameStatus {
  const raw = `${game.status} ${game.detailedState}`.trim().toLowerCase();
  if (raw.includes("postponed") || raw.includes("ppd")) return "ppd";
  if (raw.includes("final") || raw.includes("game over")) return "final";
  if (raw.includes("live") || raw.includes("in progress")) return "live";
  return "pregame";
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(min: number, max: number, value: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeDateKey(date: string | undefined) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return undefined;
  return parsed.toISOString().slice(0, 10) === date ? date : undefined;
}

function normalizeUpcomingDays(days: number | undefined) {
  if (typeof days !== "number" || !Number.isFinite(days)) return 1;
  return Math.max(1, Math.min(7, Math.floor(days)));
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
