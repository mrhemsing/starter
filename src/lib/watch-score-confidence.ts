import { MUSTWATCH_CONFIG } from "@/lib/form-tokens";

export type WatchScoreConfidence = "HIGH" | "MEDIUM" | "LOW";

export const WATCH_SCORE_CONFIDENCE_MIN_QUALIFIED = MUSTWATCH_CONFIG.watchConfidence.minQualifiedStarts;
export const WATCH_SCORE_FALLBACK_FORM_HAIRCUT = MUSTWATCH_CONFIG.watchConfidence.fallbackFormHaircut;

export function watchScoreConfidenceForSideCounts(awayQualifiedStarts: number, homeQualifiedStarts: number): WatchScoreConfidence {
  const awayLimited = isFallbackWatchScoreSide(awayQualifiedStarts);
  const homeLimited = isFallbackWatchScoreSide(homeQualifiedStarts);
  if (awayLimited && homeLimited) return "LOW";
  if (awayLimited || homeLimited) return "MEDIUM";
  return "HIGH";
}

export function isFallbackWatchScoreSide(qualifiedStarts: number) {
  return qualifiedStarts < WATCH_SCORE_CONFIDENCE_MIN_QUALIFIED;
}

export function watchScoreConfidenceLabel(confidence: WatchScoreConfidence, hasUnnamedStarter = false) {
  if (hasUnnamedStarter) return "PENDING";
  if (confidence === "LOW") return "LOW CONFIDENCE";
  if (confidence === "MEDIUM") return "LIMITED";
  return "";
}
