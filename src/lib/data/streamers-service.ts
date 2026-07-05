import { getHomeSlateDate } from "@/lib/data/start-service";
import { getUpcomingMustWatch } from "@/lib/data/tonight-service";
import { FORM_CONFIG } from "@/lib/form-tokens";
import { pitcherHref, upcomingDateHref } from "@/lib/routes";
import { roundToScorePrecision } from "@/lib/score-display";
import type { TonightGame, TonightStarter, UpcomingResponse } from "@/lib/types";

export type StreamerMatchup = {
  date: string;
  gamePk: string;
  label: string;
  opponent: string;
  opponentName: string;
  firstPitch: string;
  park: string;
  parkLabel: string;
  parkFactor: number;
  dayHref: string;
  opponentLineupRank: number | null;
  opponentLineupCount: number | null;
  opponentLineupTier: "Soft" | "Neutral" | "Tough" | "Pending";
  opponentRunValue: number | null;
};

export type StreamerCandidate = {
  pitcherId: string;
  pitcherName: string;
  team: string;
  pitcherHref: string;
  heatBand: "onfire" | "hot" | null;
  heatLabel: "On Fire" | "Heating Up" | "Streamer";
  trendDelta: number;
  spark: number[];
  formTier: NonNullable<TonightStarter["tier"]>;
  formTrend: NonNullable<TonightStarter["trend"]>;
  matchupDataAvailable: boolean;
  streamScore: number;
  components: {
    form: number;
    matchup: number;
    park: number;
  };
  seasonContext: {
    record: string;
    qualityStarts: number | null;
    k9: number | null;
  };
  matchups: StreamerMatchup[];
  changed: boolean;
  formRiser: boolean;
};

export type UpcomingStreamersResponse = {
  generatedAt: string;
  range: {
    start: string;
    end: string;
  };
  coverage: {
    confirmedThrough: string | null;
    copy: string | null;
    games: number;
    starters: number;
    partial: boolean;
  };
  funnel: {
    risers: number;
    withNextStart: number;
    withSoftMatchup: number;
    emptyReason: string | null;
  };
  twoStartPitchers: StreamerCandidate[];
  formRisers: StreamerCandidate[];
};

type CandidateAccumulator = {
  starter: TonightStarter;
  matchups: StreamerMatchup[];
};

export const STREAMER_SCORE_CONFIG = {
  formWeight: 0.5,
  matchupWeight: 0.3,
  parkWeight: 0.2,
};

export const STREAMERS_WEEK_TARGETING_CONFIG = {
  pivotDay: 4,
  weekLengthDays: 7,
};

export const STREAMERS_RISER_FUNNEL_CONFIG = {
  hotBands: ["onfire", "hot"],
  minTrendDelta: 0,
  softOpponentShare: 1 / 3,
  maxFormRisers: 10,
};

export async function getUpcomingStreamers(anchorDate = getHomeSlateDate()): Promise<UpcomingStreamersResponse> {
  const start = targetFantasyWeekStart(anchorDate);
  const upcoming = await getUpcomingMustWatch({ start, days: STREAMERS_WEEK_TARGETING_CONFIG.weekLengthDays, window: FORM_CONFIG.windowDefault, forceOpponentSplits: true });
  const byPitcher = new Map<string, CandidateAccumulator>();
  const allMatchups: StreamerMatchup[] = [];

  for (const day of upcoming.days) {
    for (const game of day.games) {
      for (const starter of game.starters) {
        if (!starter.pitcherId || !starter.name || starter.status === "tbd") continue;
        const matchup = buildStreamerMatchup(day.date, game, starter);
        const current = byPitcher.get(starter.pitcherId) ?? { starter, matchups: [] };
        current.matchups.push(matchup);
        allMatchups.push(matchup);
        byPitcher.set(starter.pitcherId, current);
      }
    }
  }

  applyOpponentLineupTiers(allMatchups);
  const runValueCoverage = streamersRunValueCoverage(allMatchups);

  const candidates = [...byPitcher.values()]
    .map(({ starter, matchups }) => buildStreamerCandidate(starter, matchups))
    .filter((candidate): candidate is StreamerCandidate => Boolean(candidate))
    .sort(compareStreamerCandidates);
  const twoStartPitcherIds = new Set(candidates.filter((candidate) => candidate.matchups.length >= 2).map((candidate) => candidate.pitcherId));
  const risers = candidates.filter(isFormRiser);
  const withNextStart = risers.filter((candidate) => candidate.matchups.length > 0);
  const withSoftMatchup = withNextStart.filter(hasSoftMatchup);
  const twoStartPitchers = candidates
    .filter((candidate) => twoStartPitcherIds.has(candidate.pitcherId))
    .map((candidate) => ({ ...candidate, formRiser: withSoftMatchup.some((riser) => riser.pitcherId === candidate.pitcherId) }));
  const formRisers = withSoftMatchup.filter((candidate) => !twoStartPitcherIds.has(candidate.pitcherId)).slice(0, STREAMERS_RISER_FUNNEL_CONFIG.maxFormRisers);
  const funnel = {
    risers: risers.length,
    withNextStart: withNextStart.length,
    withSoftMatchup: formRisers.length,
    emptyReason: streamerFunnelEmptyReason(risers.length, withNextStart.length, withSoftMatchup.length),
  };

  console.info("[streamers:funnel]", {
    anchorDate,
    range: upcoming.range,
    risers: funnel.risers,
    withNextStart: funnel.withNextStart,
    withSoftMatchup: funnel.withSoftMatchup,
    dedupedTwoStartRisers: twoStartPitchers.filter((candidate) => candidate.formRiser).length,
    matchupRunValues: runValueCoverage.count,
    matchupRunValueMin: runValueCoverage.min,
    matchupRunValueMax: runValueCoverage.max,
  });

  return {
    generatedAt: upcoming.generatedAt,
    range: upcoming.range,
    coverage: buildCoverage(upcoming),
    funnel,
    twoStartPitchers,
    formRisers,
  };
}

function buildStreamerCandidate(starter: TonightStarter, matchups: StreamerMatchup[]): StreamerCandidate | null {
  if (!starter.pitcherId || !starter.name) return null;
  const heatBand = starter.tier === "onfire" ? "onfire" : starter.tier === "hot" ? "hot" : null;
  const components = streamScoreComponents(starter, matchups);
  const record = starter.seasonDecisionRecord;
  const matchupDataAvailable = hasMeaningfulMatchupData(matchups);
  const streamScore = streamScoreFromComponents(components, matchupDataAvailable);

  return {
    pitcherId: starter.pitcherId,
    pitcherName: starter.name,
    team: starter.team,
    pitcherHref: pitcherHref({ pitcherId: starter.pitcherId, name: starter.name }, { from: "upcoming" }),
    heatBand,
    heatLabel: heatBand === "onfire" ? "On Fire" : heatBand === "hot" ? "Heating Up" : "Streamer",
    trendDelta: roundToScorePrecision(starter.deltaForm ?? 0, 1),
    spark: starter.spark ?? [],
    formTier: starter.tier ?? "even",
    formTrend: starter.trend ?? "steady",
    matchupDataAvailable,
    streamScore,
    components,
    seasonContext: {
      record: record ? `${record.wins}-${record.losses}-${record.noDecisions}` : "--",
      qualityStarts: starter.seasonStats?.qualityStarts ?? null,
      k9: starter.seasonStats?.k9 ?? null,
    },
    matchups,
    changed: false,
    formRiser: false,
  };
}

function buildStreamerMatchup(date: string, game: TonightGame, starter: TonightStarter): StreamerMatchup {
  const opponent = starter.side === "away" ? game.home : game.away;
  const opponentName = starter.side === "away" ? game.homeName : game.awayName;

  return {
    date,
    gamePk: game.gamePk,
    label: game.label,
    opponent,
    opponentName,
    firstPitch: game.firstPitch,
    park: game.park,
    parkLabel: game.parkContext.label,
    parkFactor: game.parkContext.runFactor,
    dayHref: upcomingDateHref(date),
    opponentLineupRank: null,
    opponentLineupCount: null,
    opponentLineupTier: "Pending",
    opponentRunValue: matchupRunValueForStreamer(game, starter),
  };
}

function matchupRunValueForStreamer(game: TonightGame, starter: TonightStarter) {
  if (typeof starter.opponentSplit?.matchupRunValue === "number") return starter.opponentSplit.matchupRunValue;
  if (typeof game.matchupScore === "number") return (50 - game.matchupScore) / 12;
  return null;
}

function streamScoreComponents(starter: TonightStarter, matchups: StreamerMatchup[]) {
  const form = clampScore(((starter.rgs ?? 45) - 35) * 2.5 + Math.max(0, starter.deltaForm ?? 0));
  const matchup = hasMeaningfulMatchupData(matchups) ? clampScore(mean(matchups.map((matchup) => matchupSoftness(matchup)))) : 0;
  const park = clampScore(mean(matchups.map((matchup) => parkScore(matchup.parkFactor))));
  return {
    form: roundToScorePrecision(form, 1),
    matchup: roundToScorePrecision(matchup, 1),
    park: roundToScorePrecision(park, 1),
  };
}

function streamScoreFromComponents(components: StreamerCandidate["components"], matchupDataAvailable: boolean) {
  if (matchupDataAvailable) {
    return roundToScorePrecision(
      components.form * STREAMER_SCORE_CONFIG.formWeight + components.matchup * STREAMER_SCORE_CONFIG.matchupWeight + components.park * STREAMER_SCORE_CONFIG.parkWeight,
      1,
    );
  }

  const availableWeight = STREAMER_SCORE_CONFIG.formWeight + STREAMER_SCORE_CONFIG.parkWeight;
  return roundToScorePrecision(
    (components.form * STREAMER_SCORE_CONFIG.formWeight + components.park * STREAMER_SCORE_CONFIG.parkWeight) / availableWeight,
    1,
  );
}

function hasMeaningfulMatchupData(matchups: StreamerMatchup[]) {
  return matchups.some((matchup) => typeof matchup.opponentRunValue === "number" && matchup.opponentLineupTier !== "Pending");
}

function matchupSoftness(matchup: StreamerMatchup) {
  const value = matchup.opponentRunValue;
  if (typeof value !== "number") return 50;
  return clampScore(50 - value * 12);
}

function parkScore(runFactor: number) {
  return clampScore(50 + (1 - runFactor) * 120);
}

function isFormRiser(candidate: StreamerCandidate) {
  return Boolean(
    candidate.heatBand &&
    STREAMERS_RISER_FUNNEL_CONFIG.hotBands.includes(candidate.heatBand) &&
    candidate.trendDelta > STREAMERS_RISER_FUNNEL_CONFIG.minTrendDelta,
  );
}

function hasSoftMatchup(candidate: StreamerCandidate) {
  return candidate.matchups.some((matchup) => matchup.opponentLineupTier === "Soft");
}

function compareStreamerCandidates(a: StreamerCandidate, b: StreamerCandidate) {
  return b.streamScore - a.streamScore || b.matchups.length - a.matchups.length || a.pitcherName.localeCompare(b.pitcherName);
}

function fantasyWeekStart(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  const day = value.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function targetFantasyWeekStart(anchorDate: string) {
  const currentStart = fantasyWeekStart(anchorDate);
  const day = new Date(`${anchorDate}T00:00:00.000Z`).getUTCDay();
  const targetsNextWeek = day === 0 || day >= STREAMERS_WEEK_TARGETING_CONFIG.pivotDay;
  return targetsNextWeek ? addDays(currentStart, 7) : currentStart;
}

function applyOpponentLineupTiers(matchups: StreamerMatchup[]) {
  const byOpponent = new Map<string, { opponent: string; values: number[] }>();
  for (const matchup of matchups) {
    if (typeof matchup.opponentRunValue !== "number") continue;
    const current = byOpponent.get(matchup.opponent) ?? { opponent: matchup.opponent, values: [] };
    current.values.push(matchup.opponentRunValue);
    byOpponent.set(matchup.opponent, current);
  }

  const scoredOpponents = [...byOpponent.values()]
    .map((opponent) => ({ opponent: opponent.opponent, runValue: mean(opponent.values) }))
    .sort((a, b) => a.runValue - b.runValue || a.opponent.localeCompare(b.opponent));
  const uniqueRunValues = new Set(scoredOpponents.map((opponent) => opponent.runValue.toFixed(3)));
  if (uniqueRunValues.size <= 1) return;

  const softCutoff = Math.max(1, Math.ceil(scoredOpponents.length * STREAMERS_RISER_FUNNEL_CONFIG.softOpponentShare));
  const toughCutoff = Math.max(softCutoff, Math.floor(scoredOpponents.length * (1 - STREAMERS_RISER_FUNNEL_CONFIG.softOpponentShare)));
  const rankedOpponents = new Map<string, { rank: number; count: number; tier: StreamerMatchup["opponentLineupTier"] }>();

  scoredOpponents.forEach((opponent, index) => {
    rankedOpponents.set(opponent.opponent, {
      rank: index + 1,
      count: scoredOpponents.length,
      tier: index < softCutoff ? "Soft" : index >= toughCutoff ? "Tough" : "Neutral",
    });
  });

  matchups.forEach((matchup) => {
    const ranked = rankedOpponents.get(matchup.opponent);
    if (!ranked) return;
    matchup.opponentLineupRank = ranked.rank;
    matchup.opponentLineupCount = ranked.count;
    matchup.opponentLineupTier = ranked.tier;
  });
}

function streamersRunValueCoverage(matchups: StreamerMatchup[]) {
  const values = matchups.map((matchup) => matchup.opponentRunValue).filter((value): value is number => typeof value === "number");
  if (values.length === 0) return { count: 0, min: null, max: null };
  return {
    count: values.length,
    min: Number(Math.min(...values).toFixed(3)),
    max: Number(Math.max(...values).toFixed(3)),
  };
}

function buildCoverage(upcoming: UpcomingResponse): UpcomingStreamersResponse["coverage"] {
  const daysWithProbables = upcoming.days.filter((day) => day.games.some((game) => game.starters.some((starter) => starter.pitcherId && starter.status !== "tbd")));
  const confirmedThrough = daysWithProbables.at(-1)?.date ?? null;
  const games = upcoming.days.reduce((sum, day) => sum + day.games.length, 0);
  const starters = upcoming.days.reduce((sum, day) => sum + day.games.reduce((daySum, game) => daySum + game.starters.filter((starter) => starter.pitcherId && starter.status !== "tbd").length, 0), 0);
  const partial = confirmedThrough !== null && confirmedThrough < upcoming.range.end;
  return {
    confirmedThrough,
    copy: partial ? `Probables confirmed through ${formatShortDate(confirmedThrough)}. More arms appear as rotations publish.` : null,
    games,
    starters,
    partial,
  };
}

function streamerFunnelEmptyReason(risers: number, withNextStart: number, withSoftMatchup: number) {
  if (withSoftMatchup > 0) return null;
  if (risers === 0) return "No Heating Up or On Fire arms are in the current Form pool.";
  if (withNextStart === 0) return `${risers} risers this week, none have a confirmed start in the target week yet.`;
  return `${withNextStart} risers this week, none draw a bottom-third lineup.`;
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00.000Z`));
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}
