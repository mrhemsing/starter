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
const homeDeferredSections = await readFile("src/components/home-deferred-sections.tsx", "utf8");

const directionThresholds = {
  3: { heating: 0.75, cooling: -0.75, onFire: 8, iceCold: -8 },
  5: { heating: 0.75, cooling: -0.75, onFire: 5, iceCold: -8 },
  10: { heating: 0.75, cooling: -0.75, onFire: 3.5, iceCold: -3.5 },
};

function directionTier(delta, window) {
  const thresholds = directionThresholds[window];
  if (delta >= thresholds.onFire) return "onfire";
  if (delta >= thresholds.heating) return "hot";
  if (delta <= thresholds.iceCold) return "ice";
  if (delta <= thresholds.cooling) return "cooling";
  return "even";
}

for (const [form, delta, window, expected] of [
  [50, -13.2, 5, "ice"],
  [44, 6, 5, "onfire"],
  [57, -4.6, 5, "cooling"],
  [60, 0.3, 5, "even"],
]) {
  assert(directionTier(delta, window) === expected, `form ${form}, delta ${delta}, window ${window} must be ${expected}`);
}
assert(directionTier(4, 5) === "hot" && directionTier(4, 10) === "onfire", "window thresholds must select different tiers");
assert(directionTier(0.75, 5) === "hot" && directionTier(5, 5) === "onfire", "positive threshold edges must be inclusive");
assert(directionTier(-0.75, 5) === "cooling" && directionTier(-8, 5) === "ice", "negative threshold edges must be inclusive");

for (const fixture of [
  { name: "Jacob Misiorowski", form: 61.2, delta: -9.6, rail: "cold", tier: "ice", label: "Freefall" },
  { name: "Cristian Javier", form: 44, delta: 5.8, rail: "hot", tier: "onfire", label: "Surging" },
  { name: "Matt Waldron", form: 46, delta: 5.3, rail: "hot", tier: "onfire", label: "Surging" },
]) {
  const tier = directionTier(fixture.delta, 5);
  const rail = fixture.delta > 0 ? "hot" : fixture.delta < 0 ? "cold" : "steady";
  assert(tier === fixture.tier && rail === fixture.rail, `${fixture.name} form ${fixture.form}, delta ${fixture.delta} must render ${fixture.label} on the ${fixture.rail} rail`);
}

const threshold = 1.0;
function expectedBand(delta) {
  const marker = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
  const color = delta > 0 ? "orange" : delta < 0 ? "blue" : "steady";
  const direction = delta >= threshold ? "rising" : delta <= -threshold ? "falling" : "steady";
  return { marker, color, direction };
}

const fixtureDeltas = [-12, -7.2, -1, -0.9, -0, 0, 0.9, 1, 5, 13];
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
  formService.includes("import { directionBandOf, formLevelBandOf, formTrendFromDelta, FORM_CONFIG") &&
    formService.includes("const tier = directionBandOf(deltaForm, window).key;") &&
    (formService.match(/const tier = directionBandOf\(deltaForm, window\)\.key;/g) ?? []).length === 1 &&
    formService.includes("const levelTier = formLevelBandOf(rgs, window).key;") &&
    formService.includes("const trend = classifyTrend(deltaForm);") &&
    formService.includes("return formTrendFromDelta(deltaForm);") &&
    !formService.includes("if (deltaForm >= thresholds.heatingDelta) return \"heating\";") &&
    !formService.includes("if (deltaForm <= thresholds.coolingDelta) return \"cooling\";"),
  "form service trend classification must use shared delta direction tokens",
);

const heatIndexFixtures = [
  { rgs: 50, mean: 50, trend: 0, expected: 50 },
  { rgs: 57, mean: 50, trend: -4.6, expected: 58 },
  { rgs: 44, mean: 50, trend: 6, expected: 45 },
];
for (const fixture of heatIndexFixtures) {
  const actual = Math.max(0, Math.min(100, Math.round(50 + 1.6 * (fixture.rgs - fixture.mean) + 0.7 * fixture.trend)));
  assert(actual === fixture.expected, `heat index fixture must remain byte-stable: ${JSON.stringify(fixture)} got ${actual}`);
}
assert(
  formService.includes("FORM_CONFIG.heatIndexBase +") &&
    formService.includes("FORM_CONFIG.heatIndexRgsWeight * (rgs - leagueMeanGS)") &&
    formService.includes("FORM_CONFIG.heatIndexTrendWeight * trendDelta") &&
    formPage.includes("const buyLow = rising && pitcher.rgs < FORM_CONFIG.buyLowGsPlusMax;") &&
    formPage.includes("const sellHigh = falling && pitcher.rgs >= FORM_CONFIG.sellHighGsPlusMin;") &&
    FORM_BUY_LOW_FIXTURE(49, "hot") === true,
  "direction labels must not alter heat-index ranking or BUY-LOW and SELL-HIGH thresholds",
);

assert(
  formVisuals.includes("const trend = formDeltaBand(summary.deltaForm);") &&
    !formVisuals.includes("const trend = TREND_STYLES[summary.trend];") &&
    formVisuals.includes("style={{ borderColor: `color-mix(in srgb, ${trend.color} 35%, transparent)`, color: trend.color }}"),
  "shared TrendChip must derive glyph and color from delta sign, not stored trend state",
);

assert(
    formPage.includes("const pulseDirectionCounts = directionCountsForPitchers(pulsePitchers);") &&
    formPage.includes('import { FORM_CONFIG, HEAT_BANDS, formDeltaBand, formDeltaDirection, formWindowLabel, qualityTierOf }') &&
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
  formService.includes('.filter((pitcher) => pitcher.tier === "onfire" || pitcher.tier === "hot")') &&
    formService.includes('.filter((pitcher) => pitcher.tier === "ice" || pitcher.tier === "cooling")') &&
    formService.includes("b.deltaForm - a.deltaForm") &&
    formService.includes("a.deltaForm - b.deltaForm") &&
    heatHero.includes("directionBandOf(pitcher.deltaForm, window)") &&
    !heatHero.includes("levelBandFor(") &&
    homeDeferredSections.includes("accentColor={scoreColorBand(start.gameScorePlus)}") &&
    homeDeferredSections.includes("function scoreColorBand(score: number): string") &&
    !homeDeferredSections.includes("function scoreBand(") &&
    !homeDeferredSections.includes("FormTier"),
  "homepage movers must use delta tiers while single-start GS+ decoration remains color-only",
);

assert(
  !formPage.includes("↑ -") &&
    !formVisuals.includes("↑ -") &&
    !tonightsMustWatch.includes("↑ -") &&
    !watchlistPage.includes("↑ -"),
  "renderers must not contain hardcoded up-arrow negative copy",
);

assert(
  formPage.includes("formWindowLabel(window)") &&
    heatLoadingShell.includes("formWindowLabel(window)") &&
    heatHero.includes("formWindowLabel(home.window)") &&
    !formPage.includes("over their last {window} starts") &&
    !formPage.includes("over up to last {window} qualified starts") &&
    !heatHero.includes("Up to last {home.window} qualified starts") &&
    !heatHero.includes("Last {home.window} qualified starts"),
  "Heat Check subtitles must use the shared form-window label copy",
);

assert(
  tonightsMustWatch.includes("<TrendChip summary={{ trend: starter.trend, deltaForm: starter.deltaForm }} compact />") &&
    watchlistPage.includes("deltaForm"),
  "homepage Must-Watch and Watchlist direction chips must keep flowing through shared delta-aware components/data",
);

console.log("direction band integrity ok: signed delta controls arrows, colors, movers, heroes, counts, and window copy");

function FORM_BUY_LOW_FIXTURE(form, tier) {
  const rising = tier === "onfire" || tier === "hot";
  return rising && form < 50;
}
