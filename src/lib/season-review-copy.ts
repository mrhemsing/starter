import type { SeasonReviewMetrics } from "@/lib/season-review-metrics";

export type ReviewCopyPacket = { key: string; fallback: string; required: string[]; trace: string[] };
export function reviewCopyPackets(review: SeasonReviewMetrics): ReviewCopyPacket[] {
  const start = review.startOfYear;
  const arm = review.arms[0];
  const rotation = review.rotation[0];
  const gem = review.gemLeaders[0];
  const blowup = review.biggestBlowup;
  const streak = review.hottestStreak;
  return [
    { key: "intro", fallback: `The ${review.year} season is complete. Revisit ${review.count} final starts, the standout arms, and the performances that defined the year.`, required: [`${review.year}`, `${review.count} final starts`], trace: ["canonical:all"] },
    { key: "start", fallback: `${start.pitcher.name} reached ${start.gameScorePlus} GS+ with ${start.line.strikeouts} strikeouts, earning the top spot under the season ranking tiebreakers.`, required: [start.pitcher.name, `${start.gameScorePlus} GS+`, `${start.line.strikeouts} strikeouts`], trace: [start.id] },
    { key: "top", fallback: `The top ${review.topStarts.length} starts are ranked by GS+, then the same line-based tiebreakers used throughout the site.`, required: [`${review.topStarts.length} starts`, "GS+"], trace: review.topStarts.map((row) => row.id) },
    { key: "arm", fallback: `${arm.name} leads qualified starters with a mean of ${arm.mean.toFixed(1)} GS+ across ${arm.starts} starts.`, required: [arm.name, `${arm.mean.toFixed(1)} GS+`, `${arm.starts} starts`], trace: arm.startIds },
    { key: "rotation", fallback: `${rotation.team} finishes first on the final rotation board with ${rotation.staffMeanForm} Form across ${rotation.qualifiedCount} qualified arms.`, required: [rotation.team, `${rotation.staffMeanForm} Form`, `${rotation.qualifiedCount} qualified arms`], trace: rotation.pitcherIds.map((id) => `pitcher:${id}`) },
    { key: "bids", fallback: `${review.noHitBids.length} starts have a recorded no-hitter bid of at least six innings. The deepest bids lead this list.`, required: [`${review.noHitBids.length} starts`, "six innings"], trace: review.noHitBids.map((row) => row.id) },
    { key: "gems", fallback: `${gem.name} recorded ${gem.count} starts at 70-plus GS+, leading this season's gem count.`, required: [gem.name, `${gem.count} starts`, "70-plus GS+"], trace: gem.startIds },
    { key: "blowup", fallback: `${blowup.pitcher.name} recorded ${blowup.gameScorePlus} GS+, the season's lowest score among starts meeting the two-inning ranking minimum.`, required: [blowup.pitcher.name, `${blowup.gameScorePlus} GS+`, "two-inning"], trace: [blowup.id] },
    { key: "streak", fallback: `${streak.name} averaged ${streak.mean.toFixed(1)} GS+ over five consecutive starts, the highest five-start window of the season.`, required: [streak.name, `${streak.mean.toFixed(1)} GS+`, "five consecutive starts"], trace: streak.startIds },
    { key: "league", fallback: `The final league average is ${review.leagueMean.toFixed(1)} GS+ across ${review.count} starts. The distribution shows the full season, not only its highlights.`, required: [`${review.leagueMean.toFixed(1)} GS+`, `${review.count} starts`], trace: ["canonical:all"] },
  ];
}

export function validateReviewCopy(text: string, packet: ReviewCopyPacket, names: string[], accepted: string[] = []): boolean {
  if (!text.trim() || /[—–]/.test(text) || text.split(/\s+/).length > 55) return false;
  if (/\b(today|tomorrow|tonight|next up|since|unhittable|injur|revenge|will|into the|before the|after the)\b/i.test(text)) return false;
  if (!packet.required.every((fragment) => text.toLowerCase().includes(fragment.toLowerCase()))) return false;
  const facts = packet.fallback.toLowerCase();
  if (names.some((name) => text.toLowerCase().includes(name.toLowerCase()) && !facts.includes(name.toLowerCase()))) return false;
  const allowedNumbers = new Set(packet.fallback.match(/\d+(?:\.\d+)?/g) ?? []);
  if ((text.match(/\d+(?:\.\d+)?/g) ?? []).some((number) => !allowedNumbers.has(number))) return false;
  // Number-bearing claims must preserve their supplied metric, not swap attribution.
  for (const fragment of packet.required.filter((item) => /\d/.test(item))) if (!text.includes(fragment)) return false;
  const grams = (value: string) => {
    const words = value.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
    return words.slice(3).map((_, index) => words.slice(index, index + 4).join(" "));
  };
  const current = new Set(grams(text));
  if (accepted.some((prior) => grams(prior).some((gram) => current.has(gram)))) return false;
  return packet.trace.length > 0;
}

export function selectReviewCopy(candidate: string | null, packet: ReviewCopyPacket, names: string[], accepted: string[]) {
  return candidate && validateReviewCopy(candidate, packet, names, accepted)
    ? { text: candidate, source: "llm" as const, trace: packet.trace }
    : { text: packet.fallback, source: "template" as const, trace: packet.trace };
}
