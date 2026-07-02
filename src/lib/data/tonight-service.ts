import { unstable_cache } from "next/cache";
import { getFormLeaderboard } from "@/lib/data/form-service";
import { fetchMlbPitcherStartCompleteness, fetchMlbTeamHandednessSplitContexts, type MlbPitcherStartCompleteness } from "@/lib/data/mlb-stats-client";
import { fetchMlbOddsMarketContexts, isOddsEligibleDate, normalizeOddsName, type MlbOddsGameMarketContext } from "@/lib/data/odds-client";
import { getGameTimeWeather, getParkContext } from "@/lib/data/run-environment";
import { getDefaultSlateDates, getSlateSchedule, getTodayProbables } from "@/lib/data/start-service";
import { MUSTWATCH_CONFIG, watchTierOf } from "@/lib/form-tokens";
import { SCORE_DISPLAY_PRECISION, WATCH_SCORE_RANGE, roundProjectedGameScorePlus, roundToScorePrecision, roundWatchScore } from "@/lib/score-display";
import type { DecisionParkContext, DecisionWeatherContext, FormSummary, MlbProbablePitcher, MlbScheduleGame, MlbTeamHandednessSplitContext, StarterFormStatus, TonightGame, TonightGameStatus, TonightResponse, TonightStarter, UpcomingCardStatus, UpcomingResponse, WatchSortPolicy, WatchTierKey } from "@/lib/types";

type TonightOptions = {
  date?: string;
  window?: 3 | 5 | 10;
};

type CachedTonight = {
  expiresAt: number;
  promise: Promise<TonightResponse>;
};

const TONIGHT_CACHE_TTL_MS = 60 * 1000;
export const TONIGHT_REVALIDATE_SECONDS = 60;
export const UPCOMING_REVALIDATE_SECONDS = 60;
const ACTIVE_UPCOMING_CARD_STATUSES: UpcomingCardStatus[] = ["pregame"];
const WATCH_SORT_POLICY: WatchSortPolicy = "status-then-watch-score";
const WATCH_SCORE_PRECISION = SCORE_DISPLAY_PRECISION.watchScore;
const FORM_COMPLETENESS = MUSTWATCH_CONFIG.formCompleteness;
const LIKELY_OPENER_MAX_CAREER_STARTS = 4;
const LIKELY_OPENER_RECENT_APPEARANCE_FLOOR = 3;
const tonightCache = new Map<string, CachedTonight>();

const getCachedTonightMustWatch = unstable_cache(
  async (date: string, window: 3 | 5 | 10) => buildTonightMustWatch(date, window),
  ["tonight-must-watch", "v8"],
  { revalidate: TONIGHT_REVALIDATE_SECONDS },
);

export async function getTonightMustWatch(options: TonightOptions = {}): Promise<TonightResponse> {
  const date = normalizeDateKey(options.date) ?? (await getDefaultSlateDates()).upcomingDate;
  const window = options.window ?? MUSTWATCH_CONFIG.windowDefault;
  const cacheKey = `${date}:${window}`;
  const cached = tonightCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = getCachedTonightMustWatch(date, window);
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
  const [opponentSplits, marketContexts] = await Promise.all([
    fetchMlbTeamHandednessSplitContexts(date.slice(0, 4), { fetchLive: true }),
    fetchMlbOddsMarketContexts(schedule.games),
  ]);
  const probablePitcherIds = schedule.games.flatMap((game) => [
    game.probableAwayPitcher?.id,
    game.probableHomePitcher?.id,
  ]).filter((id): id is number => typeof id === "number");
  const completenessByPitcher = await fetchMlbPitcherStartCompleteness(probablePitcherIds, date.slice(0, 4), date, { fetchLive: true });
  const formByPitcher = new Map(leaderboard.pitchers.map((pitcher) => [pitcher.pitcherId, pitcher]));
  const probableScoresByGame = groupProbableMatchupScores(probables);
  const builtGames = await Promise.all(
    schedule.games.map((game) => buildTonightGame(game, date, formByPitcher, completenessByPitcher, probableScoresByGame.get(game.gamePk) ?? [], leaderboard.leagueMeanGS, opponentSplits, marketContexts.get(String(game.gamePk)) ?? null)),
  );
  const candidates = builtGames.filter((game) => isUpcomingCardStatus(game.status));
  const matchupRanks = rankMatchups(candidates);
  const games = sortUpcomingWatchGames(candidates
    .map((game) => ({
      ...game,
      matchupRankTonight: matchupRanks.get(game.gamePk) ?? game.matchupRankTonight,
      watchSortGroup: watchSortGroup(game.status),
    })));

  return {
    date,
    generatedAt: new Date().toISOString(),
    activeCardStatuses: ACTIVE_UPCOMING_CARD_STATUSES,
    formWindow: window,
    formThroughDate: leaderboard.formThroughDate,
    latestScoredStartDate: leaderboard.latestScoredStartDate,
    formDataStale: leaderboard.stale,
    leagueMeanGS: leaderboard.leagueMeanGS,
    watchScoreWeights: MUSTWATCH_CONFIG.weights,
    watchSortPolicy: WATCH_SORT_POLICY,
    watchScoreRange: WATCH_SCORE_RANGE,
    watchScorePrecision: WATCH_SCORE_PRECISION,
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

async function buildTonightGame(
  game: MlbScheduleGame,
  date: string,
  formByPitcher: Map<string, FormSummary>,
  completenessByPitcher: Map<string, MlbPitcherStartCompleteness>,
  probableMatchupScores: number[],
  leagueMeanGS: number,
  opponentSplits: Map<string, MlbTeamHandednessSplitContext>,
  marketContext: MlbOddsGameMarketContext | null,
): Promise<TonightGame> {
  const status = normalizeGameStatus(game);
  const parkContext = getParkContext(game.venue);
  const weatherContext = await getGameTimeWeather(game.venue, game.gameDate);
  const awayStarter = buildTonightStarter(game.probableAwayPitcher, "away", game.awayTeam.abbreviation, game.homeTeam.abbreviation, game.homeTeam.name, date, leagueMeanGS, formByPitcher, completenessByPitcher, parkContext, weatherContext, opponentSplits, marketContext);
  const homeStarter = buildTonightStarter(game.probableHomePitcher, "home", game.homeTeam.abbreviation, game.awayTeam.abbreviation, game.awayTeam.name, date, leagueMeanGS, formByPitcher, completenessByPitcher, parkContext, weatherContext, opponentSplits, marketContext);
  const tbd = awayStarter.status === "tbd" || homeStarter.status === "tbd";
  const splitMatchupScore = scoreOpponentSplitMatchup([awayStarter, homeStarter], parkContext, weatherContext);
  const matchupScore = clampMatchupScore(splitMatchupScore ?? (probableMatchupScores.length > 0 ? round1(mean(probableMatchupScores)) : neutralMatchupScore()));
  const starterScores = [starterWatchValue(awayStarter, leagueMeanGS), starterWatchValue(homeStarter, leagueMeanGS)];
  const normMatchup = normalizeMatchupScore(matchupScore);
  const topArm = roundWatchScore(Math.max(starterScores[0], starterScores[1]));
  const pairing = roundWatchScore(mean(starterScores) * (tbd ? MUSTWATCH_CONFIG.tbdStarter.pairingMultiplier : 1));
  const matchupComponent = roundWatchScore(normMatchup);
  const rawWatchScore = status === "ppd" ? 0 : roundWatchScore(calculateGameWatchScore(topArm, pairing, matchupComponent));
  const matchupConfidence = matchupConfidenceForStarters([awayStarter, homeStarter]);
  const hasMlbDebut = awayStarter.formStatus === "mlb_debut" || homeStarter.formStatus === "mlb_debut";
  const likelyOpener = awayStarter.likelyOpener === true || homeStarter.likelyOpener === true;
  const gameWatchScore = applyTbdWatchScoreCap(applyTrustGateWatchScore(rawWatchScore, matchupConfidence, hasMlbDebut), tbd, hasMlbDebut);
  const watchTier = watchTierOf(gameWatchScore).key as WatchTierKey;
  const limitedForm = awayStarter.formStatus !== "ok" || homeStarter.formStatus !== "ok" || awayStarter.flags?.limitedSample === true || homeStarter.flags?.limitedSample === true;
  const coldStartForm = awayStarter.formStatus === "cold_start" || homeStarter.formStatus === "cold_start";
  const joinGapForm = awayStarter.formStatus === "join_gap" || homeStarter.formStatus === "join_gap";

  return {
    gamePk: String(game.gamePk),
    date,
    status,
    detailedState: game.detailedState,
    firstPitch: game.gameDate,
    park: game.venue,
    parkContext,
    weatherContext,
    away: game.awayTeam.abbreviation,
    awayName: game.awayTeam.name,
    home: game.homeTeam.abbreviation,
    homeName: game.homeTeam.name,
    label: `${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`,
    matchupScore,
    matchupRankTonight: 1,
    matchupContext: {
      status: splitMatchupScore === null ? "pending-opponent-splits" : "scored",
      label: splitMatchupScore === null ? "Opponent split data pending" : "Opponent split data vs pitcher handedness",
    },
    starters: [awayStarter, homeStarter],
    gameWatchScore,
    watchTier,
    matchupConfidence,
    watchSortGroup: watchSortGroup(status),
    watchComponents: {
      topArm,
      pairing,
      matchup: matchupComponent,
    },
    flags: {
      tbd,
      limitedForm,
      coldStartForm,
      joinGapForm,
      mlbDebut: hasMlbDebut,
      likelyOpener,
    },
  };
}

function isStartedStatus(status: TonightGameStatus) {
  return status === "live" || status === "final";
}

function sortUpcomingWatchGames(games: TonightGame[]) {
  const sorted = [...games].sort(compareUpcomingWatchGames);
  const topRankLimit = MUSTWATCH_CONFIG.tbdStarter.maxRankWhenAlternativesExist - 1;
  const trusted = sorted.filter((game) => !game.flags?.tbd);
  const provisional = sorted.filter((game) => game.flags?.tbd);
  if (trusted.length < topRankLimit || provisional.length === 0) return sorted;

  const protectedTrusted = trusted.slice(0, topRankLimit);
  const protectedIds = new Set(protectedTrusted.map((game) => game.gamePk));
  const rest = sorted.filter((game) => !protectedIds.has(game.gamePk));
  return [...protectedTrusted, ...rest];
}

function compareUpcomingWatchGames(a: TonightGame, b: TonightGame) {
  if (isStartedStatus(a.status) && !isStartedStatus(b.status)) return 1;
  if (!isStartedStatus(a.status) && isStartedStatus(b.status)) return -1;
  return b.gameWatchScore - a.gameWatchScore;
}

function watchSortGroup(status: TonightGameStatus) {
  if (status === "pregame") return 0;
  if (status === "live") return 1;
  return 2;
}

function isUpcomingCardStatus(status: TonightGameStatus) {
  return ACTIVE_UPCOMING_CARD_STATUSES.includes(status as UpcomingCardStatus);
}

function buildTonightStarter(
  probable: MlbProbablePitcher | undefined,
  side: "home" | "away",
  team: string,
  opponent: string,
  opponentMarketName: string,
  date: string,
  leagueMeanGS: number,
  formByPitcher: Map<string, FormSummary>,
  completenessByPitcher: Map<string, MlbPitcherStartCompleteness>,
  parkContext: DecisionParkContext,
  weatherContext: DecisionWeatherContext,
  opponentSplits: Map<string, MlbTeamHandednessSplitContext>,
  marketContext: MlbOddsGameMarketContext | null,
): TonightStarter {
  if (!probable) {
    const projection = pendingProjection("Starter TBD");
    return {
      pitcherId: null,
      name: null,
      team,
      side,
      status: "tbd",
      formStatus: "tbd",
      probableSource: "none",
      probableConfidence: "TBD",
      limitedReason: null,
      projection,
      marketContext: buildMarketContext(projection, null, opponentMarketName, date, marketContext),
    };
  }

  const form = formByPitcher.get(String(probable.id));
  const completeness = completenessByPitcher.get(String(probable.id)) ?? null;
  const formCompleteness = classifyStarterForm(form, completeness);
  const likelyOpener = isLikelyOpenerProfile(completeness);
  const opponentSplit = form?.throws ? opponentSplits.get(teamSplitKey(opponent, form.throws === "L" ? "vs-lhp" : "vs-rhp")) ?? null : null;
  if (!form) {
    const projection = likelyOpener ? openerProjection(leagueMeanGS) : pendingProjection("Insufficient completed-start history");
    if (formCompleteness.status === "join_gap") logJoinGapStarter({ probable, side, team, opponent, date, completeness: formCompleteness });
    return {
      pitcherId: String(probable.id),
      name: probable.fullName,
      team,
      side,
      status: "insufficient",
      formStatus: formCompleteness.status,
      probableSource: probable.source,
      probableConfidence: probable.confidence,
      limitedReason: formCompleteness.status === "ok" ? null : formCompleteness.status,
      formCompleteness: {
        matched: formCompleteness.matched,
        expected: formCompleteness.expected,
        careerGS: formCompleteness.careerGS,
      },
      likelyOpener,
      projection,
      marketContext: buildMarketContext(projection, probable.fullName, opponentMarketName, date, marketContext),
      flags: {
        ...(formCompleteness.status === "mlb_debut" ? { mlbDebut: true } : null),
        ...(formCompleteness.status === "join_gap" ? { joinGap: true } : null),
        ...(likelyOpener ? { likelyOpener: true } : null),
      },
    };
  }
  const formWorkload = form.workload ?? {
    lastStartDate: form.lastStart?.gameDate ?? null,
    lastStartPitches: null,
    avgPitchesLast5: null,
    avgIpLast5: null,
  };
  const daysRest = formWorkload.lastStartDate ? daysBetween(formWorkload.lastStartDate, date) : null;
  const projection = likelyOpener ? openerProjection(form.rgs, form) : buildStarterProjection(form, daysRest, parkContext, weatherContext, opponentSplit);
  if (formCompleteness.status === "join_gap") logJoinGapStarter({ probable, side, team, opponent, date, completeness: formCompleteness });

  return {
    pitcherId: form.pitcherId,
    name: form.name,
    team,
    side,
    status: form.status,
    formStatus: formCompleteness.status,
    probableSource: probable.source,
    probableConfidence: probable.confidence,
    limitedReason: formCompleteness.status === "ok" ? null : formCompleteness.status,
    formCompleteness: {
      matched: formCompleteness.matched,
      expected: formCompleteness.expected,
      careerGS: formCompleteness.careerGS,
    },
    likelyOpener,
    rgs: form.rgs,
    tier: form.tier,
    trend: form.trend,
    deltaForm: form.deltaForm,
    windowCount: form.windowCount,
    spark: form.spark,
    lastStart: form.lastStart,
    seasonStats: form.seasonStats,
    driverChips: form.driverChips,
    opponentSplit,
    projection,
    marketContext: buildMarketContext(projection, form.name, opponentMarketName, date, marketContext),
    workload: {
      ...formWorkload,
      daysRest,
      restLabel: restLabel(daysRest),
    },
    availability: form.availability ?? null,
    flags: {
      ...form.flags,
      ...(formCompleteness.status === "mlb_debut" ? { mlbDebut: true } : null),
      ...(formCompleteness.status === "join_gap" ? { joinGap: true } : null),
      ...(likelyOpener ? { likelyOpener: true } : null),
    },
  };
}

function isLikelyOpenerProfile(completeness: MlbPitcherStartCompleteness | null) {
  if (!completeness || completeness.careerStarts === null) return false;
  if (completeness.careerStarts > LIKELY_OPENER_MAX_CAREER_STARTS) return false;
  if (completeness.recentAppearances < LIKELY_OPENER_RECENT_APPEARANCE_FLOOR) return false;
  return completeness.recentReliefAppearances > completeness.recentStarts;
}

function matchupConfidenceForStarters(starters: TonightGame["starters"]) {
  if (starters.some((starter) => starter.formStatus === "join_gap")) return "NONE";
  if (starters.some((starter) => starter.formStatus === "cold_start" || starter.flags?.limitedSample === true)) return "LOW";
  return "HIGH";
}

function applyTrustGateWatchScore(score: number, confidence: TonightGame["matchupConfidence"], hasMlbDebut: boolean) {
  if (hasMlbDebut) return Math.max(score, minWatchScoreForTier("mustwatch"));
  if (confidence === "NONE") return Math.min(score, maxWatchScoreForTier("background"));
  if (confidence === "LOW") return Math.min(score, maxWatchScoreForTier("worthit"));
  return score;
}

function applyTbdWatchScoreCap(score: number, hasTbdStarter: boolean, hasMlbDebut: boolean) {
  if (!hasTbdStarter || hasMlbDebut) return score;
  return Math.min(score, MUSTWATCH_CONFIG.tbdStarter.maxWatchScore);
}

function minWatchScoreForTier(tierKey: WatchTierKey) {
  return MUSTWATCH_CONFIG.watchTiers.find((tier) => tier.key === tierKey)?.min ?? WATCH_SCORE_RANGE.max;
}

function maxWatchScoreForTier(tierKey: WatchTierKey) {
  const tiers = MUSTWATCH_CONFIG.watchTiers;
  const tierIndex = tiers.findIndex((tier) => tier.key === tierKey);
  if (tierIndex <= 0) return WATCH_SCORE_RANGE.max;
  const higherTier = tiers[tierIndex - 1];
  return roundWatchScore(higherTier.min - 1 / 10 ** WATCH_SCORE_PRECISION);
}

function classifyStarterForm(
  form: FormSummary | undefined,
  completeness: MlbPitcherStartCompleteness | null,
): { status: StarterFormStatus; matched: number; expected: number; careerGS: number | null; completeness: number } {
  const matched = form?.seasonStartCount ?? 0;
  const expected = Math.max(0, completeness?.seasonStarts ?? form?.seasonStartCount ?? 0);
  const careerGS = completeness?.careerStarts ?? null;
  const ratio = expected <= 0 ? (matched > 0 ? 1 : 0) : matched / expected;

  if (completeness?.providerMlbDebut || careerGS === 0) {
    return { status: "mlb_debut", matched, expected, careerGS, completeness: ratio };
  }
  if (matched <= FORM_COMPLETENESS.joinGapMatchFloor && expected > FORM_COMPLETENESS.coldStartMax) {
    return { status: "join_gap", matched, expected, careerGS, completeness: ratio };
  }
  if (!form || form.status === "insufficient" || matched < FORM_COMPLETENESS.formMinStarts) {
    return { status: "cold_start", matched, expected, careerGS, completeness: ratio };
  }
  return { status: "ok", matched, expected, careerGS, completeness: ratio };
}

function logJoinGapStarter({
  probable,
  side,
  team,
  opponent,
  date,
  completeness,
}: {
  probable: MlbProbablePitcher;
  side: "home" | "away";
  team: string;
  opponent: string;
  date: string;
  completeness: { matched: number; expected: number; careerGS: number | null; completeness: number };
}) {
  console.warn("[upcoming:join-gap-starter]", {
    date,
    side,
    team,
    opponent,
    probablePitcherId: probable.id,
    probablePitcherName: probable.fullName,
    formStatus: "join_gap",
    matched: completeness.matched,
    expected: completeness.expected,
    careerGS: completeness.careerGS,
    completeness: round1(completeness.completeness),
  });
}

function pendingProjection(reason: string): NonNullable<TonightStarter["projection"]> {
  return {
    status: "pending",
    projectedGsPlus: null,
    confidence: "low",
    line: {
      inningsPitched: null,
      strikeouts: null,
      earnedRuns: null,
    },
    notes: [reason],
  };
}

function openerProjection(baseGameScorePlus: number, form?: FormSummary): NonNullable<TonightStarter["projection"]> {
  const projectedIp = 2;
  const k9 = form?.seasonStats.k9 ?? null;

  return {
    status: "line-backed",
    projectedGsPlus: roundProjectedGameScorePlus(clamp(20, 80, baseGameScorePlus - 8)),
    confidence: "low",
    line: {
      inningsPitched: projectedIp,
      strikeouts: k9 ? round1((k9 * projectedIp) / 9) : null,
      earnedRuns: null,
    },
    notes: ["Likely opener / bullpen game", "Opener innings profile"],
  };
}

function buildStarterProjection(
  form: FormSummary,
  daysRest: number | null,
  parkContext: DecisionParkContext,
  weatherContext: DecisionWeatherContext,
  opponentSplit: MlbTeamHandednessSplitContext | null,
): NonNullable<TonightStarter["projection"]> {
  const workload = form.workload;
  const avgIp = workload.avgIpLast5 ?? form.seasonStats.inningsPitched / Math.max(1, form.windowCount);
  const projectedIp = clamp(3.5, 7.5, avgIp);
  const k9 = form.seasonStats.k9 ?? (form.lastStart && form.lastStart.ip > 0 ? (form.lastStart.k * 9) / form.lastStart.ip : null);
  const projectedK = k9 ? clamp(1, 12, (k9 * projectedIp) / 9) : null;
  const era = form.seasonStats.era;
  const environmentErAdjustment = (weatherContext.runValue - parkContext.runValue) / 9;
  const projectedEr = era ? clamp(0, 7, (era * projectedIp) / 9 + environmentErAdjustment) : null;
  let projectedGsPlus = form.rgs + parkContext.runValue * 0.7 - weatherContext.runValue * 0.45;
  if (daysRest !== null && daysRest <= 3) projectedGsPlus -= 2.5;
  if (daysRest !== null && daysRest >= 7) projectedGsPlus -= 0.8;

  return {
    status: "line-backed",
    projectedGsPlus: roundProjectedGameScorePlus(clamp(20, 80, projectedGsPlus)),
    confidence: form.flags?.limitedSample ? "low" : form.windowCount >= 5 && form.seasonStats.inningsPitched >= 40 ? "high" : "medium",
    line: {
      inningsPitched: round1(projectedIp),
      strikeouts: projectedK === null ? null : round1(projectedK),
      earnedRuns: projectedEr === null ? null : round1(projectedEr),
    },
    notes: [
      "Line-backed projection",
      opponentSplit ? `Opponent split input: ${opponentSplit.team} ${opponentSplit.split.toUpperCase()}` : "Opponent split input pending",
    ],
  };
}

function buildMarketContext(
  projection: NonNullable<TonightStarter["projection"]>,
  starterName: string | null,
  opponentTeam: string,
  date: string,
  marketContext: MlbOddsGameMarketContext | null,
): NonNullable<TonightStarter["marketContext"]> {
  const projectedStrikeouts = projection.line.strikeouts;
  const strikeoutPropLine = starterName ? marketContext?.pitcherStrikeouts.get(normalizeOddsName(starterName)) ?? null : null;
  const teamTotal = marketContext?.teamTotals.get(normalizeOddsName(opponentTeam)) ?? null;
  const opposingTeamTotal = teamTotal ?? (marketContext?.gameTotal ? round1(marketContext.gameTotal / 2) : null);
  const strikeoutEdge = projectedStrikeouts !== null && strikeoutPropLine !== null ? round1(projectedStrikeouts - strikeoutPropLine) : null;
  if (marketContext) {
    return {
      status: strikeoutPropLine !== null || opposingTeamTotal !== null ? "ready" : "pending-feed",
      source: "the-odds-api",
      projectedStrikeouts,
      strikeoutPropLine,
      strikeoutEdge,
      opposingTeamTotal,
      label: strikeoutPropLine !== null || opposingTeamTotal !== null
        ? "Market context from The Odds API."
        : "The Odds API event matched, but starter prop/team-total lines were not available yet.",
    };
  }

  if (process.env.THE_BUMP_ODDS_API_KEY && !isOddsEligibleDate(date)) {
    return {
      status: "pending-feed",
      source: "odds-deferred",
      projectedStrikeouts,
      strikeoutPropLine: null,
      strikeoutEdge: null,
      opposingTeamTotal: null,
      label: "Market lines deferred to conserve The Odds API credits; odds hydrate only for near-term slates.",
    };
  }

  return {
    status: "pending-feed",
    source: "not-configured",
    projectedStrikeouts,
    strikeoutPropLine: null,
    strikeoutEdge: null,
    opposingTeamTotal: null,
    label: "K prop and implied team total feed pending. Add THE_BUMP_ODDS_API_KEY to enable market lines.",
  };
}

function starterWatchValue(starter: TonightStarter, leagueMeanGS: number) {
  if (starter.formStatus === "ok" && starter.rgs !== undefined) return starter.rgs;
  if (starter.formStatus === "cold_start" && starter.lastStart?.gsPlus) return starter.lastStart.gsPlus;
  return leagueMeanGS;
}

function scoreOpponentSplitMatchup(starters: TonightStarter[], parkContext: DecisionParkContext, weatherContext: DecisionWeatherContext) {
  const scored = starters
    .filter((starter) => starter.formStatus === "ok" && starter.opponentSplit && typeof starter.rgs === "number")
    .map((starter) => {
      const split = starter.opponentSplit!;
      return starter.rgs! - split.matchupRunValue * 2.2 + parkContext.runValue * 0.4 - weatherContext.runValue * 0.25;
    });
  if (scored.length === 0) return null;
  return round1(clampMatchupScore(mean(scored)));
}

function teamSplitKey(team: string, split: MlbTeamHandednessSplitContext["split"]) {
  return `${team}:${split}`;
}

function calculateGameWatchScore(topArm: number, pairing: number, normMatchup: number) {
  return (
    MUSTWATCH_CONFIG.weights.topArm * topArm +
    MUSTWATCH_CONFIG.weights.pairAvg * pairing +
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
  return roundToScorePrecision(value, 1);
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

function daysBetween(a: string, b: string) {
  return Math.round((new Date(`${b}T00:00:00.000Z`).valueOf() - new Date(`${a}T00:00:00.000Z`).valueOf()) / (24 * 60 * 60 * 1000));
}

function restLabel(daysRest: number | null): NonNullable<TonightStarter["workload"]>["restLabel"] {
  if (daysRest === null || !Number.isFinite(daysRest)) return "unknown";
  if (daysRest <= 3) return "short";
  if (daysRest >= 7) return "extended";
  return "normal";
}
