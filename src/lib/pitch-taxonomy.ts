import type { PitchResultKey, PitchTypeKey } from "@/lib/types";

export const pitchTypes: Record<PitchTypeKey, { name: string; color: string }> = {
  FF: { name: "4-Seam", color: "#ef4444" },
  SI: { name: "Sinker", color: "#f97316" },
  SL: { name: "Slider", color: "#22d3ee" },
  CH: { name: "Changeup", color: "#a78bfa" },
  CU: { name: "Curveball", color: "#10b981" },
  FC: { name: "Cutter", color: "#fbbf24" },
};

export const pitchResults: Record<PitchResultKey, { label: string }> = {
  called_strike: { label: "Called Strike" },
  swinging_strike: { label: "Whiff" },
  foul: { label: "Foul" },
  ball: { label: "Ball" },
  hit_into_play: { label: "In Play" },
};
