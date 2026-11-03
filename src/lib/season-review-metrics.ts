import type { CanonicalStartRecord } from "@/lib/canonical-start-record";
import { canonicalRecordToFormStart, frozenSeasonForm, frozenRotationLeaderboard } from "@/lib/data/form-service";
import { FORM_CONFIG, HEAT_BANDS, HOME_CONFIG } from "@/lib/form-tokens";
import { compareRankedStarts } from "@/lib/start-ranking";
import { isRankedRegularStart } from "@/lib/start-classification";
import type { FormHomeResponse } from "@/lib/types";

export const REVIEW_GEM_MIN_GS_PLUS = 70;
export const REVIEW_STREAK_STARTS = 5;
export const REVIEW_TOP_STARTS = 25;

export function computeSeasonReview(records: CanonicalStartRecord[], publishedAt: string) {
  if (!records.length || records.some((row) => row.status !== "final" || !row.frozen || row.source.line === "fixture")) throw new Error("Season review requires frozen, non-fixture final records");
  if (new Set(records.map((row) => row.id)).size !== records.length) throw new Error("Duplicate canonical start");
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date) || a.gamePk - b.gamePk || a.id.localeCompare(b.id));
  const ranked = sorted.filter((row) => isRankedRegularStart({ line: row.line })).sort(compareRankedStarts);
  const form = frozenSeasonForm(sorted);
  const byPitcher = new Map<number, CanonicalStartRecord[]>();
  for (const row of sorted) byPitcher.set(row.pitcherMlbId, [...(byPitcher.get(row.pitcherMlbId) ?? []), row]);
  const arms = form.pitchers.filter((pitcher) => pitcher.seasonQualification.qualified).map((pitcher) => {
    const starts = byPitcher.get(Number(pitcher.pitcherId))!;
    return { pitcherId: pitcher.pitcherId, name: pitcher.name, team: pitcher.team, mean: starts.reduce((sum, row) => sum + row.gameScorePlus, 0) / starts.length, starts: starts.length, minStarts: pitcher.seasonQualification.minStarts, startIds: starts.map((row) => row.id) };
  }).sort((a, b) => b.mean - a.mean || b.starts - a.starts || a.name.localeCompare(b.name));
  const gemLeaders = [...byPitcher.entries()].map(([pitcherId, starts]) => ({ pitcherId: String(pitcherId), name: starts.at(-1)!.pitcherName, count: starts.filter((row) => row.gameScorePlus >= REVIEW_GEM_MIN_GS_PLUS).length, startIds: starts.filter((row) => row.gameScorePlus >= REVIEW_GEM_MIN_GS_PLUS).map((row) => row.id) })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const streaks = [...byPitcher.entries()].flatMap(([pitcherId, starts]) => starts.slice(REVIEW_STREAK_STARTS - 1).map((_, index) => {
    const window = starts.slice(index, index + REVIEW_STREAK_STARTS);
    return { pitcherId: String(pitcherId), name: window[0].pitcherName, mean: window.reduce((sum, row) => sum + row.gameScorePlus, 0) / REVIEW_STREAK_STARTS, from: window[0].date, through: window.at(-1)!.date, startIds: window.map((row) => row.id) };
  })).sort((a, b) => b.mean - a.mean || a.through.localeCompare(b.through) || a.pitcherId.localeCompare(b.pitcherId));
  const rotation = frozenRotationLeaderboard(form.pitchers, form.formThroughDate, 5, publishedAt);
  const qualified = form.pitchers.filter((pitcher) => pitcher.status === "ok");
  const home: FormHomeResponse = {
    generatedAt: publishedAt, formThroughDate: form.formThroughDate, latestScoredStartDate: form.formThroughDate,
    stale: false, window: 5, leagueMeanGS: form.leagueMeanGS, totalQualified: qualified.length,
    bands: Object.fromEntries(HEAT_BANDS.map((band) => [band.key, qualified.filter((pitcher) => pitcher.tier === band.key).length])) as FormHomeResponse["bands"],
    hot: qualified.filter((pitcher) => pitcher.tier === "onfire" || pitcher.tier === "hot").sort((a, b) => b.deltaForm - a.deltaForm || b.rgs - a.rgs).slice(0, HOME_CONFIG.railSize),
    cold: qualified.filter((pitcher) => pitcher.tier === "ice" || pitcher.tier === "cooling").sort((a, b) => a.deltaForm - b.deltaForm || a.rgs - b.rgs).slice(0, HOME_CONFIG.railSize),
  };
  const distribution = Array.from({ length: 7 }, (_, index) => {
    const low = 20 + index * 10;
    return { low, high: index === 6 ? 80 : low + 9, count: records.filter((row) => row.gameScorePlus >= low && (index === 6 ? row.gameScorePlus <= 80 : row.gameScorePlus < low + 10)).length };
  });
  return {
    year: Number(sorted[0].date.slice(0, 4)), publishedAt, finalDate: sorted.at(-1)!.date,
    count: records.length, leagueMean: records.reduce((sum, row) => sum + row.gameScorePlus, 0) / records.length,
    startOfYear: canonicalRecordToFormStart(ranked[0], 1),
    topStarts: ranked.slice(0, REVIEW_TOP_STARTS).map((row, index) => canonicalRecordToFormStart(row, index + 1)),
    arms: arms.slice(0, 3), gemLeaders: gemLeaders.slice(0, 10),
    biggestBlowup: canonicalRecordToFormStart([...ranked].sort((a, b) => a.gameScorePlus - b.gameScorePlus || compareRankedStarts(a, b))[0], 1),
    hottestStreak: streaks[0],
    noHitBids: sorted.filter((row) => (row.narrativeNotables?.noHitDepth?.innings ?? 0) >= 6).sort((a, b) => b.narrativeNotables!.noHitDepth!.innings - a.narrativeNotables!.noHitDepth!.innings || compareRankedStarts(a, b)).map(canonicalRecordToFormStart),
    rotation: rotation.rows.map(({ rank, team, staffMeanForm, qualifiedCount, pitchers }) => ({ rank, team, staffMeanForm, qualifiedCount, pitcherIds: pitchers.map((pitcher) => pitcher.pitcherId) })),
    home, distribution, qualificationDivisor: FORM_CONFIG.seasonQualificationDivisor,
  };
}

export type SeasonReviewMetrics = ReturnType<typeof computeSeasonReview>;
