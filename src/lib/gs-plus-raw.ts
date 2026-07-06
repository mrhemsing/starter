import type { StartApiGameScorePlusBreakdown } from "@/lib/types";

export const GS_PLUS_DISPLAY_CAP = 80;

export function rawGameScorePlus(breakdown?: StartApiGameScorePlusBreakdown | null) {
  if (!breakdown?.components?.length) return null;
  const raw = breakdown.components
    .filter((component) => component.key !== "calibration")
    .reduce((sum, component) => sum + component.value, 0);
  return Number(raw.toFixed(1));
}

export function cappedRawGameScorePlus(score: number, breakdown?: StartApiGameScorePlusBreakdown | null) {
  if (score !== GS_PLUS_DISPLAY_CAP) return null;
  return rawGameScorePlus(breakdown);
}

