import { getFormLeaderboard } from "@/lib/data/form-service";
import { fetchMlbSchedule, fetchMlbTeamQualityContexts } from "@/lib/data/mlb-stats-client";
import { getGameTimeWeather, getParkContext } from "@/lib/data/run-environment";
import { getHomeSlateDate } from "@/lib/data/start-service";
import type { DecisionOpponentContext, DecisionToolsFoundationResponse, DecisionToolsGame, DecisionToolsStarter, FormSummary, MlbProbablePitcher, MlbScheduleGame, TonightGameStatus } from "@/lib/types";

type DecisionToolsOptions = {
  start?: string;
  days?: number;
  window?: 3 | 5 | 10;
};

const OPPONENT_QUALITY_RUN_VALUES: Record<string, number> = {
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

const OPPONENT_OFFENSE_RUN_VALUES: Record<string, number> = {
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

export async function getDecisionToolsFoundation(options: DecisionToolsOptions = {}): Promise<DecisionToolsFoundationResponse> {
  const start = normalizeDateKey(options.start) ?? getHomeSlateDate();
  const days = normalizeDays(options.days);
  const window = options.window ?? 5;
  const dates = Array.from({ length: days }, (_, index) => addDays(start, index));
  const [leaderboard, schedules, opponentContexts] = await Promise.all([
    getFormLeaderboard({ window, qualifiedOnly: false }),
    Promise.all(dates.map((date) => fetchMlbSchedule(date, { fetchLive: true }))),
    fetchMlbTeamQualityContexts(start, { fetchLive: true }),
  ]);
  const formByPitcher = new Map(leaderboard.pitchers.map((pitcher) => [pitcher.pitcherId, pitcher]));
  const games = await Promise.all(
    schedules.flatMap((schedule) =>
      schedule.games.map((game) => buildDecisionGame(game, schedule.date, formByPitcher, opponentContexts)),
    ),
  );

  return {
    range: {
      start,
      end: dates[dates.length - 1],
    },
    generatedAt: new Date().toISOString(),
    source: {
      schedule: schedules.map((schedule) => ({ date: schedule.date, source: schedule.source })),
      opponent: opponentContexts.size > 0 ? "mlb-standings-and-team-offense" : "fallback",
      park: "shared-venue-run-factors",
      weather: "open-meteo",
    },
    games,
  };
}

async function buildDecisionGame(
  game: MlbScheduleGame,
  date: string,
  formByPitcher: Map<string, FormSummary>,
  opponentContexts: Map<string, { opponentQualityRunValue: number; opponentQualityLabel: string; opponentOffenseRunValue: number; opponentOffenseLabel: string }>,
): Promise<DecisionToolsGame> {
  const parkContext = getParkContext(game.venue);
  const weatherContext = await getGameTimeWeather(game.venue, game.gameDate);
  const awayStarter = buildDecisionStarter(game.probableAwayPitcher, "away", game.awayTeam.abbreviation, game.homeTeam.abbreviation, formByPitcher, opponentContexts, parkContext, weatherContext);
  const homeStarter = buildDecisionStarter(game.probableHomePitcher, "home", game.homeTeam.abbreviation, game.awayTeam.abbreviation, formByPitcher, opponentContexts, parkContext, weatherContext);

  return {
    gamePk: String(game.gamePk),
    date,
    status: normalizeGameStatus(game),
    firstPitch: game.gameDate,
    label: `${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`,
    away: game.awayTeam.abbreviation,
    home: game.homeTeam.abbreviation,
    park: game.venue,
    starters: [awayStarter, homeStarter],
    parkContext,
    weatherContext,
  };
}

function buildDecisionStarter(
  probable: MlbProbablePitcher | undefined,
  side: "home" | "away",
  team: string,
  opponent: string,
  formByPitcher: Map<string, FormSummary>,
  opponentContexts: Map<string, { opponentQualityRunValue: number; opponentQualityLabel: string; opponentOffenseRunValue: number; opponentOffenseLabel: string }>,
  parkContext: DecisionToolsStarter["parkContext"],
  weatherContext: DecisionToolsStarter["weatherContext"],
): DecisionToolsStarter {
  const form = probable ? formByPitcher.get(String(probable.id)) : undefined;
  const status = !probable ? "tbd" : form?.status ?? "insufficient";
  const throws = form?.throws;

  return {
    pitcherId: probable ? String(probable.id) : null,
    name: probable?.fullName ?? null,
    team,
    opponent,
    side,
    throws,
    status,
    form: form
      ? {
          rgs: form.rgs,
          tier: form.tier,
          trend: form.trend,
          deltaForm: form.deltaForm,
          spark: form.spark,
          windowCount: form.windowCount,
        }
      : null,
    opponentContext: buildOpponentContext(opponent, throws, opponentContexts),
    parkContext,
    weatherContext,
  };
}

function buildOpponentContext(
  opponent: string,
  pitcherHand: "R" | "L" | undefined,
  opponentContexts: Map<string, { opponentQualityRunValue: number; opponentQualityLabel: string; opponentOffenseRunValue: number; opponentOffenseLabel: string }>,
): DecisionOpponentContext {
  const liveContext = opponentContexts.get(opponent);
  return {
    team: opponent,
    pitcherHand,
    scope: pitcherHand === "L" ? "vs-lhp" : pitcherHand === "R" ? "vs-rhp" : "overall",
    qualityRunValue: liveContext?.opponentQualityRunValue ?? OPPONENT_QUALITY_RUN_VALUES[opponent] ?? 0,
    qualityLabel: liveContext?.opponentQualityLabel ?? `${opponent} opponent quality fallback context.`,
    offenseRunValue: liveContext?.opponentOffenseRunValue ?? OPPONENT_OFFENSE_RUN_VALUES[opponent] ?? 0,
    offenseLabel: liveContext?.opponentOffenseLabel ?? `${opponent} offense fallback context.`,
  };
}

function normalizeGameStatus(game: MlbScheduleGame): TonightGameStatus {
  const raw = `${game.status} ${game.detailedState}`.trim().toLowerCase();
  if (raw.includes("postponed") || raw.includes("ppd")) return "ppd";
  if (raw.includes("final") || raw.includes("game over")) return "final";
  if (raw.includes("live") || raw.includes("in progress")) return "live";
  return "pregame";
}

function normalizeDateKey(date: string | undefined) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return undefined;
  return parsed.toISOString().slice(0, 10) === date ? date : undefined;
}

function normalizeDays(days: number | undefined) {
  if (typeof days !== "number" || !Number.isFinite(days)) return 7;
  return Math.max(1, Math.min(7, Math.floor(days)));
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
