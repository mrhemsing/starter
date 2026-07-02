import type { FormTier, FormTrend, HeatBand } from "@/lib/types";

export type LevelBandToken = HeatBand & {
  cssVar: string;
  textCssVar?: string;
};

export const FORM_CONFIG = {
  windowDefault: 5 as const,
  windows: [3, 5, 10] as const,
  minStartsToQualify: 3,
  minStartsInWindow: 2,
  ipFloor: 2.0,
  heatingDelta: 0.75,
  coolingDelta: -0.75,
  onFireDelta: 5.5,
  iceColdDelta: -8,
  directionBandThresholds: {
    3: { heatingDelta: 0.75, coolingDelta: -0.75, onFireDelta: 8, iceColdDelta: -8 },
    5: { heatingDelta: 0.75, coolingDelta: -0.75, onFireDelta: 5.5, iceColdDelta: -8 },
    10: { heatingDelta: 0.75, coolingDelta: -0.75, onFireDelta: 3.5, iceColdDelta: -3.5 },
  },
  formBandThresholds: {
    3: { onFireMin: 55, heatingMin: 49, coolingMax: 39, iceColdMax: 34 },
    5: { onFireMin: 53, heatingMin: 49, coolingMax: 41, iceColdMax: 36 },
    10: { onFireMin: 52, heatingMin: 49, coolingMax: 42, iceColdMax: 39 },
  },
  buyLowGsPlusMax: 50,
  sellHighGsPlusMin: 58,
  heatIndexBase: 50,
  heatIndexRgsWeight: 1.6,
  heatIndexTrendWeight: 0.7,
};

export const FORM_DELTA_STEADY_THRESHOLD = 1.0;

export type FormDeltaBandKey = "warming" | "steady" | "cooling";

export type FormDeltaBand = {
  key: FormDeltaBandKey;
  label: string;
  marker: "" | "↑" | "↓";
  color: string;
  cssVar: string;
  directionLabel: "up" | "steady" | "down";
};

export const FORM_DELTA_BANDS: Record<FormDeltaBandKey, FormDeltaBand> = {
  warming: { key: "warming", label: "Warming", marker: "↑", color: "var(--level-hot)", cssVar: "--level-hot", directionLabel: "up" },
  steady: { key: "steady", label: "Steady", marker: "", color: "var(--form-steady, #a1a1aa)", cssVar: "--form-steady", directionLabel: "steady" },
  cooling: { key: "cooling", label: "Cooling", marker: "↓", color: "var(--level-cooling)", cssVar: "--level-cooling", directionLabel: "down" },
};

export function formDeltaBand(deltaForm: number) {
  if (deltaForm >= FORM_DELTA_STEADY_THRESHOLD) return FORM_DELTA_BANDS.warming;
  if (deltaForm <= -FORM_DELTA_STEADY_THRESHOLD) return FORM_DELTA_BANDS.cooling;
  return FORM_DELTA_BANDS.steady;
}

export const LEVEL_BANDS: LevelBandToken[] = [
  { key: "onfire", label: "On Fire", min: 69, color: "#D85A30", cssVar: "--level-onfire", textClass: "text-[var(--level-onfire)]" },
  { key: "hot", label: "Heating Up", min: 57, color: "#EF9F27", cssVar: "--level-hot", textClass: "text-[var(--level-hot)]" },
  { key: "even", label: "Even", min: 43, color: "#888780", cssVar: "--level-even", textCssVar: "--level-even-text", textClass: "text-[var(--level-even-text)]" },
  { key: "cooling", label: "Cooling Down", min: 30, color: "#85B7EB", cssVar: "--level-cooling", textClass: "text-[var(--level-cooling)]" },
  { key: "ice", label: "Ice Cold", min: 0, color: "#378ADD", cssVar: "--level-ice", textClass: "text-[var(--level-ice)]" },
];

export const QUALITY_BANDS: LevelBandToken[] = [
  { ...LEVEL_BANDS[0], label: "Elite" },
  { ...LEVEL_BANDS[1], label: "Plus" },
  { ...LEVEL_BANDS[2], label: "Solid" },
  { ...LEVEL_BANDS[3], label: "Below" },
  { ...LEVEL_BANDS[4], label: "Poor" },
];

export const HEAT_BANDS = LEVEL_BANDS;
export const GS_TIERS: Array<HeatBand & { key: FormTier; fillClass: string }> = [
  { ...LEVEL_BANDS[0], fillClass: "bg-[var(--level-onfire)] text-zinc-950" },
  { ...LEVEL_BANDS[1], fillClass: "bg-[var(--level-hot)] text-zinc-950" },
  { ...LEVEL_BANDS[2], fillClass: "bg-[var(--level-even)] text-zinc-950" },
  { ...LEVEL_BANDS[3], fillClass: "bg-[var(--level-cooling)] text-zinc-950" },
  { ...LEVEL_BANDS[4], fillClass: "bg-[var(--level-ice)] text-zinc-950" },
];
export const FORM_BANDS = LEVEL_BANDS;

export const TREND_STYLES: Record<FormTrend, { label: string; marker: string; className: string }> = {
  heating: { label: "Rising", marker: "↑", className: "border-teal-300/30 text-teal-300" },
  steady: { label: "Steady", marker: "→", className: "border-zinc-300/20 text-zinc-300" },
  cooling: { label: "Falling", marker: "↓", className: "border-rose-300/30 text-rose-300" },
};

export const FORM_CHART_COLORS = {
  grid: "#27272a",
  gridStrong: "#3f3f46",
  textMuted: "#71717a",
  leagueReference: "#52525b",
  neutralLine: "#71717a",
  neutralPoint: "#a1a1aa",
  formBandFill: "rgba(239,159,39,0.10)",
  best: "#EF9F27",
  worst: "#D85A30",
  lightText: "#fafafa",
};

export const HOME_CONFIG = {
  railSize: 5,
  showHeadshots: true,
};

export const MUSTWATCH_CONFIG = {
  windowDefault: 5 as const,
  formCompleteness: {
    coldStartMax: 2,
    // Join gaps should mean the form join found almost nothing for an established pitcher,
    // not ordinary settle lag between provider GS and scored form starts.
    joinGapMatchFloor: 1,
    formMinStarts: 3,
  },
  weights: {
    topArm: 0.5,
    pairAvg: 0.3,
    matchup: 0.2,
  },
  matchupScoreRange: {
    min: 0,
    max: 100,
  },
  tbdStarter: {
    pairingMultiplier: 0.6,
    maxWatchScore: 47.9,
    maxRankWhenAlternativesExist: 4,
  },
  watchTiers: [
    { key: "mustwatch", label: "Must-watch", min: 58, color: "#EF9F27" },
    { key: "worthit", label: "Worth it", min: 48, color: "#378ADD" },
    { key: "background", label: "Background", min: 0, color: "#888780" },
  ],
};

export function tierOf(gs: number) {
  const displayedValue = Math.round(gs);
  return LEVEL_BANDS.find((tier) => displayedValue >= tier.min) ?? LEVEL_BANDS[LEVEL_BANDS.length - 1];
}

export function bandOf(heatIndex: number) {
  const displayedValue = Math.round(heatIndex);
  return LEVEL_BANDS.find((band) => displayedValue >= band.min) ?? LEVEL_BANDS[LEVEL_BANDS.length - 1];
}

export function directionThresholdsForWindow(window: number = FORM_CONFIG.windowDefault) {
  return FORM_CONFIG.directionBandThresholds[window as keyof typeof FORM_CONFIG.directionBandThresholds] ?? FORM_CONFIG;
}

export function directionBandOf(deltaForm: number, window: number = FORM_CONFIG.windowDefault) {
  const thresholds = directionThresholdsForWindow(window);
  if (deltaForm >= thresholds.onFireDelta) return LEVEL_BANDS[0];
  if (deltaForm >= thresholds.heatingDelta) return LEVEL_BANDS[1];
  if (deltaForm <= thresholds.iceColdDelta) return LEVEL_BANDS[4];
  if (deltaForm <= thresholds.coolingDelta) return LEVEL_BANDS[3];
  return LEVEL_BANDS[2];
}

export function formThresholdsForWindow(window: number = FORM_CONFIG.windowDefault) {
  return FORM_CONFIG.formBandThresholds[window as keyof typeof FORM_CONFIG.formBandThresholds] ?? FORM_CONFIG.formBandThresholds[FORM_CONFIG.windowDefault];
}

export function formHeatBandOf(rgs: number, window: number = FORM_CONFIG.windowDefault) {
  const thresholds = formThresholdsForWindow(window);
  if (rgs >= thresholds.onFireMin) return LEVEL_BANDS[0];
  if (rgs >= thresholds.heatingMin) return LEVEL_BANDS[1];
  if (rgs <= thresholds.iceColdMax) return LEVEL_BANDS[4];
  if (rgs <= thresholds.coolingMax) return LEVEL_BANDS[3];
  return LEVEL_BANDS[2];
}

export function formBandOf(rgs: number, window: number = FORM_CONFIG.windowDefault) {
  return formHeatBandOf(rgs, window);
}

export function qualityTierOf(gs: number) {
  const displayedValue = Math.round(gs);
  return QUALITY_BANDS.find((tier) => displayedValue >= tier.min) ?? QUALITY_BANDS[QUALITY_BANDS.length - 1];
}

export function watchTierOf(score: number) {
  return MUSTWATCH_CONFIG.watchTiers.find((tier) => score >= tier.min) ?? MUSTWATCH_CONFIG.watchTiers[MUSTWATCH_CONFIG.watchTiers.length - 1];
}

export function watchTierForRank(rank: number) {
  if (rank <= 3) return MUSTWATCH_CONFIG.watchTiers[0];
  if (rank <= 8) return MUSTWATCH_CONFIG.watchTiers[1];
  return MUSTWATCH_CONFIG.watchTiers[2];
}
