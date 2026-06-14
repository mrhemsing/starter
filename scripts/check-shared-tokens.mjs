import { LEVEL_BANDS, QUALITY_BANDS, TREND_STYLES, bandOf, formBandOf, qualityTierOf, tierOf } from "../src/lib/form-tokens.ts";

const labels = new Set(LEVEL_BANDS.map((band) => band.label.toLowerCase()));
const trendLabels = Object.values(TREND_STYLES).map((trend) => trend.label.toLowerCase());
const overlaps = trendLabels.filter((label) => labels.has(label));
if (overlaps.length > 0) {
  throw new Error(`trend labels overlap level bands: ${overlaps.join(", ")}`);
}

for (const band of LEVEL_BANDS) {
  if (!band.cssVar || !band.color || !band.textClass) {
    throw new Error(`band ${band.key} is missing cssVar, color, or textClass`);
  }
}

if (QUALITY_BANDS.length !== LEVEL_BANDS.length) {
  throw new Error("quality bands must map one-to-one with heat bands");
}

for (const [index, band] of QUALITY_BANDS.entries()) {
  const levelBand = LEVEL_BANDS[index];
  if (band.key !== levelBand.key || band.color !== levelBand.color || band.min !== levelBand.min) {
    throw new Error(`quality band ${band.label} does not share the ${levelBand.label} color ramp slot`);
  }
}

for (const label of QUALITY_BANDS.map((band) => band.label.toLowerCase())) {
  if (labels.has(label)) {
    throw new Error(`quality label overlaps heat label: ${label}`);
  }
}

const equalDisplayedValues = [
  [49.5, 50.4],
  [56.5, 57.4],
  [68.5, 69.4],
  [29.5, 30.4],
  [42.5, 43.4],
];

for (const [a, b] of equalDisplayedValues) {
  const roundedA = Math.round(a);
  const roundedB = Math.round(b);
  if (roundedA !== roundedB) throw new Error("test fixture must share displayed value");
  if (tierOf(a).key !== tierOf(b).key || formBandOf(a).key !== formBandOf(b).key || bandOf(a).key !== bandOf(b).key || qualityTierOf(a).key !== qualityTierOf(b).key) {
    throw new Error(`equal displayed value ${roundedA} split bands`);
  }
}

if (!Object.values(TREND_STYLES).every((trend) => trend.marker && trend.label)) {
  throw new Error("trend token is missing marker or label");
}

console.log("shared tokens ok: level bands, trend vocabulary, and rounded band assignment are centralized");
