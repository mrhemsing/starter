import { getDailySlate } from "@/lib/data/start-service";
import { getTonightMustWatch } from "@/lib/data/tonight-service";
import { startPath } from "@/lib/routes";
import type { PitchingDuel, PitchingDuelsResponse, StartSummary, TonightGame } from "@/lib/types";

const BEST_DUEL_MAX_GAP = 10;
const MISMATCH_MIN_GAP = 18;
const BEST_DUEL_MIN_COMBINED_QUALITY = 90;

export async function getPitchingDuels(date: string, mode: "upcoming" | "settled" = "upcoming"): Promise<PitchingDuelsResponse> {
  const duels = mode === "settled" ? await getSettledDuels(date) : await getUpcomingDuels(date);
  const bestDuels = duels.filter(isBestDuelCandidate);
  const mismatches = duels.filter(isMismatchCandidate);
  return {
    date,
    generatedAt: new Date().toISOString(),
    mode,
    bestDuels: bestDuels.sort((a, b) => b.duelScore - a.duelScore || a.gap - b.gap).slice(0, 6),
    mismatches: mismatches.sort((a, b) => b.mismatchScore - a.mismatchScore || b.combinedQuality - a.combinedQuality).slice(0, 6),
  };
}

async function getUpcomingDuels(date: string) {
  const tonight = await getTonightMustWatch({ date, window: 5 });
  return tonight.games
    .filter((game) => game.starters.every((starter) => starter.pitcherId && starter.status === "ok" && starter.rgs !== undefined))
    .map(upcomingGameToDuel);
}

async function getSettledDuels(date: string) {
  const starts = (await getDailySlate({ window: "yesterday", date })).filter((start) => start.source?.line !== "fixture");
  const byGame = new Map<number, StartSummary[]>();
  for (const start of starts) {
    const current = byGame.get(start.gamePk) ?? [];
    current.push(start);
    byGame.set(start.gamePk, current);
  }

  return [...byGame.values()]
    .filter((gameStarts) => gameStarts.length >= 2)
    .map((gameStarts) => settledStartsToDuel(date, gameStarts.slice(0, 2)));
}

function upcomingGameToDuel(game: TonightGame): PitchingDuel {
  const starters = game.starters.map((starter) => ({
    pitcherId: starter.pitcherId ?? "",
    name: starter.name ?? "TBD",
    team: starter.team,
    score: Math.round(starter.rgs ?? 0),
    scoreLabel: "Form" as const,
    trend: starter.trend,
    deltaForm: starter.deltaForm,
    tier: starter.tier,
    spark: starter.spark,
    href: `/pitchers/${starter.pitcherId}/form`,
  })) as PitchingDuel["starters"];
  return buildDuel({
    gamePk: game.gamePk,
    date: game.date,
    label: game.label,
    status: game.status,
    firstPitch: game.firstPitch,
    park: game.park,
    starters,
  });
}

function settledStartsToDuel(date: string, starts: StartSummary[]): PitchingDuel {
  const [a, b] = starts;
  const starters = starts.map((start) => ({
    pitcherId: String(start.pitcher.mlbId),
    name: start.pitcher.name,
    team: start.pitcher.team,
    score: start.gameScorePlus,
    scoreLabel: "GS+" as const,
    tier: undefined,
    href: startPath(start.id),
  })) as PitchingDuel["starters"];
  return buildDuel({
    gamePk: String(a.gamePk),
    date,
    label: `${a.pitcher.team} vs ${b.pitcher.team}`,
    status: "settled",
    park: a.context.parkLabel,
    starters,
  });
}

function buildDuel(input: Omit<PitchingDuel, "gap" | "combinedQuality" | "duelScore" | "mismatchScore">): PitchingDuel {
  const gap = Math.abs(input.starters[0].score - input.starters[1].score);
  const combinedQuality = input.starters[0].score + input.starters[1].score;
  const floorQuality = Math.min(input.starters[0].score, input.starters[1].score);
  const duelScore = Math.max(0, combinedQuality + floorQuality * 0.8 - gap * 2.2);
  const mismatchScore = gap + Math.max(...input.starters.map((starter) => starter.score)) * 0.35;

  return {
    ...input,
    gap,
    combinedQuality,
    duelScore: round1(duelScore),
    mismatchScore: round1(mismatchScore),
  };
}

function isBestDuelCandidate(duel: PitchingDuel) {
  return duel.combinedQuality >= BEST_DUEL_MIN_COMBINED_QUALITY && duel.gap <= BEST_DUEL_MAX_GAP;
}

function isMismatchCandidate(duel: PitchingDuel) {
  return duel.gap >= MISMATCH_MIN_GAP;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
