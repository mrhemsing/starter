import { getHomeSlateDate } from "@/lib/data/start-service";
import { getUpcomingMustWatch } from "@/lib/data/tonight-service";
import { FORM_CONFIG } from "@/lib/form-tokens";
import { pitcherHref, upcomingDateHref } from "@/lib/routes";
import { roundToScorePrecision } from "@/lib/score-display";
import type { TonightGame, TonightStarter } from "@/lib/types";

export type StreamerMatchup = {
  date: string;
  gamePk: string;
  label: string;
  opponent: string;
  opponentName: string;
  firstPitch: string;
  park: string;
  parkLabel: string;
  dayHref: string;
};

export type StreamerCandidate = {
  pitcherId: string;
  pitcherName: string;
  team: string;
  pitcherHref: string;
  heatBand: "onfire" | "hot" | null;
  heatLabel: "On Fire" | "Heating Up" | "Streamer";
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
};

export type UpcomingStreamersResponse = {
  generatedAt: string;
  range: {
    start: string;
    end: string;
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
  softMatchupRunValueMax: -0.5,
};

export async function getUpcomingStreamers(anchorDate = getHomeSlateDate()): Promise<UpcomingStreamersResponse> {
  const start = fantasyWeekStart(addDays(anchorDate, 1));
  const upcoming = await getUpcomingMustWatch({ start, days: 7, window: FORM_CONFIG.windowDefault });
  const byPitcher = new Map<string, CandidateAccumulator>();

  for (const day of upcoming.days) {
    for (const game of day.games) {
      for (const starter of game.starters) {
        if (!starter.pitcherId || !starter.name || starter.status === "tbd") continue;
        const current = byPitcher.get(starter.pitcherId) ?? { starter, matchups: [] };
        current.matchups.push(buildStreamerMatchup(day.date, game, starter));
        byPitcher.set(starter.pitcherId, current);
      }
    }
  }

  const candidates = [...byPitcher.values()]
    .map(({ starter, matchups }) => buildStreamerCandidate(starter, matchups))
    .filter((candidate): candidate is StreamerCandidate => Boolean(candidate))
    .sort(compareStreamerCandidates);

  return {
    generatedAt: upcoming.generatedAt,
    range: upcoming.range,
    twoStartPitchers: candidates.filter((candidate) => candidate.matchups.length >= 2),
    formRisers: candidates.filter((candidate) => candidate.matchups.length > 0 && isFormRiser(candidate) && hasSoftMatchup(candidate)),
  };
}

function buildStreamerCandidate(starter: TonightStarter, matchups: StreamerMatchup[]): StreamerCandidate | null {
  if (!starter.pitcherId || !starter.name) return null;
  const heatBand = starter.tier === "onfire" ? "onfire" : starter.tier === "hot" ? "hot" : null;
  const components = streamScoreComponents(starter, matchups);
  const record = starter.seasonDecisionRecord;

  return {
    pitcherId: starter.pitcherId,
    pitcherName: starter.name,
    team: starter.team,
    pitcherHref: pitcherHref({ pitcherId: starter.pitcherId, name: starter.name }, { from: "upcoming" }),
    heatBand,
    heatLabel: heatBand === "onfire" ? "On Fire" : heatBand === "hot" ? "Heating Up" : "Streamer",
    streamScore: roundToScorePrecision(components.form * STREAMER_SCORE_CONFIG.formWeight + components.matchup * STREAMER_SCORE_CONFIG.matchupWeight + components.park * STREAMER_SCORE_CONFIG.parkWeight, 1),
    components,
    seasonContext: {
      record: record ? `${record.wins}-${record.losses}-${record.noDecisions}` : "--",
      qualityStarts: starter.seasonStats?.qualityStarts ?? null,
      k9: starter.seasonStats?.k9 ?? null,
    },
    matchups,
    changed: false,
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
    dayHref: upcomingDateHref(date),
  };
}

function streamScoreComponents(starter: TonightStarter, matchups: StreamerMatchup[]) {
  const form = clampScore(((starter.rgs ?? 45) - 35) * 2.5);
  const matchup = clampScore(mean(matchups.map(() => matchupSoftness(starter))));
  const park = clampScore(mean(matchups.map((matchup) => parkScore(matchup.parkLabel))));
  return {
    form: roundToScorePrecision(form, 1),
    matchup: roundToScorePrecision(matchup, 1),
    park: roundToScorePrecision(park, 1),
  };
}

function matchupSoftness(starter: TonightStarter) {
  const value = starter.opponentSplit?.matchupRunValue;
  if (typeof value !== "number") return 50;
  return clampScore(50 - value * 12);
}

function parkScore(label: string) {
  if (/pitcher/i.test(label)) return 70;
  if (/hitter/i.test(label)) return 35;
  return 50;
}

function isFormRiser(candidate: StreamerCandidate) {
  return candidate.heatBand === "onfire" || candidate.heatBand === "hot";
}

function hasSoftMatchup(candidate: StreamerCandidate) {
  return candidate.components.matchup >= 56 || candidate.components.park >= 60;
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
