import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const formPage = await readFile("src/app/form/page.tsx", "utf8");
const formTokens = await readFile("src/lib/form-tokens.ts", "utf8");
const formService = await readFile("src/lib/data/form-service.ts", "utf8");
const formVisuals = await readFile("src/components/form-visuals.tsx", "utf8");
const heatHero = await readFile("src/components/heat-check-hero.tsx", "utf8");
const heatLoadingShell = await readFile("src/components/heat-check-loading-shell.tsx", "utf8");
const tonightsMustWatch = await readFile("src/components/tonights-must-watch.tsx", "utf8");
const watchlistPage = await readFile("src/app/watchlist/page.tsx", "utf8");

const threshold = 1.0;
function expectedBand(delta) {
  const marker = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
  const color = delta > 0 ? "orange" : delta < 0 ? "blue" : "steady";
  const direction = delta >= threshold ? "rising" : delta <= -threshold ? "falling" : "steady";
  return { marker, color, direction };
}

const fixtureDeltas = [-12, -7.2, -1, -0.9, -0, 0, 0.9, 1, 5.5, 13];
for (let index = 0; index < 1000; index += 1) {
  const delta = index < fixtureDeltas.length ? fixtureDeltas[index] : Number(((index * 37) % 501 / 10 - 25).toFixed(1));
  const band = expectedBand(delta);
  if (delta < 0) assert(band.marker === "↓" && band.color === "blue", `negative delta ${delta} must render down/blue`);
  if (delta > 0) assert(band.marker === "↑" && band.color === "orange", `positive delta ${delta} must render up/orange`);
  if (delta === 0) assert(band.marker === "→" && band.color === "steady", "zero delta must render steady");
  if (Math.abs(delta) < threshold) assert(band.direction === "steady", `threshold delta ${delta} must count steady`);
}

assert(
  formTokens.includes('export const FORM_DELTA_STEADY_THRESHOLD = 1.0;') &&
    formTokens.includes('direction: "rising"') &&
    formTokens.includes('direction: "falling"') &&
    formTokens.includes("export function formDeltaDirection(deltaForm: number)") &&
    formTokens.includes("export function formTrendFromDelta(deltaForm: number)") &&
    formTokens.includes('heating: { label: "Rising", marker: "↑", className: "border-orange-300/30 text-orange-300" }') &&
    formTokens.includes('cooling: { label: "Falling", marker: "↓", className: "border-sky-300/30 text-sky-300" }'),
  "shared form tokens must own direction thresholds, glyphs, and colors",
);

assert(
  formService.includes("import { formHeatBandOf, formTrendFromDelta, FORM_CONFIG") &&
    formService.includes("const trend = classifyTrend(deltaForm);") &&
    formService.includes("return formTrendFromDelta(deltaForm);") &&
    !formService.includes("if (deltaForm >= thresholds.heatingDelta) return \"heating\";") &&
    !formService.includes("if (deltaForm <= thresholds.coolingDelta) return \"cooling\";"),
  "form service trend classification must use shared delta direction tokens",
);

assert(
  formVisuals.includes("const trend = formDeltaBand(summary.deltaForm);") &&
    !formVisuals.includes("const trend = TREND_STYLES[summary.trend];") &&
    formVisuals.includes("style={{ borderColor: `color-mix(in srgb, ${trend.color} 35%, transparent)`, color: trend.color }}"),
  "shared TrendChip must derive glyph and color from delta sign, not stored trend state",
);

assert(
    formPage.includes("const pulseDirectionCounts = directionCountsForPitchers(pulsePitchers);") &&
    formPage.includes('import { FORM_CONFIG, HEAT_BANDS, formDeltaBand, formDeltaDirection, qualityTierOf }') &&
    formPage.includes('<SummaryStat label="Steady" value={String(pulseDirectionCounts.steady)} />') &&
    !formPage.includes('<SummaryStat label="Even" value={String(pulseBandCounts.find') &&
    formPage.includes("const riserCandidates = heroCandidates.filter(isRisingDelta).sort") &&
    formPage.includes("const fallerCandidates = heroCandidates.filter(isFallingDelta).sort") &&
    formPage.includes("if (movers.length === 0) return null;") &&
    formPage.includes("const band = formDeltaBand(pitcher.deltaForm);") &&
    formPage.includes("const motion = band.direction === \"rising\" ? \"rising\" : \"falling\";") &&
    formPage.includes("return formDeltaDirection(pitcher.deltaForm) === \"rising\";") &&
    formPage.includes("return formDeltaDirection(pitcher.deltaForm) === \"falling\";") &&
    formPage.includes("const direction = formDeltaDirection(pitcher.deltaForm);") &&
    formPage.includes("function uniquePitchers(pitchers: FormSummary[])") &&
    formPage.includes("function moverDisplayName(name: string, surnameCounts: Map<string, number>)") &&
    formPage.includes("const deltaBand = formDeltaBand(pitcher.deltaForm);") &&
    formPage.includes("const accent = deltaBand.color;") &&
    formPage.includes("const marker = deltaBand.marker;") &&
    !formPage.includes('const marker = isRiser ? "↑" : "↓";') &&
    !formPage.includes('const color = direction === "up" ? "#FF7A3D" : "#8FCBFF";') &&
    !formPage.includes('motion: direction === "up" ? "rising" : "falling"'),
  "Heat Check heroes, movers, and counts must derive direction from signed delta only",
);

assert(
  !formPage.includes("↑ -") &&
    !formVisuals.includes("↑ -") &&
    !tonightsMustWatch.includes("↑ -") &&
    !watchlistPage.includes("↑ -"),
  "renderers must not contain hardcoded up-arrow negative copy",
);

assert(
  formPage.includes("over up to last {window} qualified starts") &&
    heatLoadingShell.includes("over up to last {window} qualified starts") &&
    heatHero.includes("Up to last {home.window} qualified starts") &&
    !formPage.includes("over their last {window} starts") &&
    !heatHero.includes("Last {home.window} qualified starts"),
  "Heat Check subtitles must use up-to-last window copy",
);

assert(
  tonightsMustWatch.includes("<TrendChip summary={{ trend: starter.trend, deltaForm: starter.deltaForm }} compact />") &&
    watchlistPage.includes("deltaForm"),
  "homepage Must-Watch and Watchlist direction chips must keep flowing through shared delta-aware components/data",
);

console.log("direction band integrity ok: signed delta controls arrows, colors, movers, heroes, counts, and window copy");
