export const SCORE_DISPLAY_PRECISION = {
  gameScorePlus: 0,
  watchScore: 1,
  projectedGameScorePlus: 1,
} as const;

export const WATCH_SCORE_RANGE = {
  min: 0,
  max: 100,
} as const;

export function roundToScorePrecision(value: number, precision: number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function roundWatchScore(value: number) {
  return roundToScorePrecision(value, SCORE_DISPLAY_PRECISION.watchScore);
}

export function roundProjectedGameScorePlus(value: number) {
  return roundToScorePrecision(value, SCORE_DISPLAY_PRECISION.projectedGameScorePlus);
}

export function formatWatchScore(value: number) {
  return roundWatchScore(value).toFixed(SCORE_DISPLAY_PRECISION.watchScore);
}

export function formatGameScorePlus(value: number | null | undefined) {
  if (value === null || value === undefined) return "--";
  return String(roundToScorePrecision(value, SCORE_DISPLAY_PRECISION.gameScorePlus));
}
