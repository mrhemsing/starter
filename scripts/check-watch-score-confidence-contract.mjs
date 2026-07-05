import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function countOccurrences(source, needle) {
  return source.split(needle).length - 1;
}

function confidenceForSideCounts(away, home, minimum) {
  const awayLimited = away < minimum;
  const homeLimited = home < minimum;
  if (awayLimited && homeLimited) return "LOW";
  if (awayLimited || homeLimited) return "MEDIUM";
  return "HIGH";
}

const [
  packageJson,
  config,
  helper,
  roleHelper,
  types,
  mlbStatsClient,
  tonightService,
  mustWatch,
  methodology,
  upcomingOg,
  upcomingWeekOg,
] = await Promise.all([
  readFile("package.json", "utf8"),
  readFile("src/lib/form-tokens.ts", "utf8"),
  readFile("src/lib/watch-score-confidence.ts", "utf8"),
  readFile("src/lib/spot-start-role.ts", "utf8"),
  readFile("src/lib/types.ts", "utf8"),
  readFile("src/lib/data/mlb-stats-client.ts", "utf8"),
  readFile("src/lib/data/tonight-service.ts", "utf8"),
  readFile("src/components/tonights-must-watch.tsx", "utf8"),
  readFile("src/app/methodology/page.tsx", "utf8"),
  readFile("src/app/upcoming/[date]/opengraph-image.tsx", "utf8"),
  readFile("src/app/upcoming/week/[startDate]/opengraph-image.tsx", "utf8"),
]);

const minimumMatch = config.match(/minQualifiedStarts:\s*(\d+)/);
const haircutMatch = config.match(/fallbackFormHaircut:\s*([0-9.]+)/);
assert(minimumMatch, "MUSTWATCH_CONFIG must define minQualifiedStarts");
assert(haircutMatch, "MUSTWATCH_CONFIG must define fallbackFormHaircut");
const minimum = Number(minimumMatch[1]);
const haircut = Number(haircutMatch[1]);

assert(minimum === 3, "watch confidence minimum should be 3 qualified starts");
assert(haircut === 0.85, "watch confidence fallback haircut should be 0.85");
assert(confidenceForSideCounts(5, 5, minimum) === "HIGH", "5/5 side counts should be HIGH");
assert(confidenceForSideCounts(5, 1, minimum) === "MEDIUM", "5/1 side counts should be MEDIUM");
assert(confidenceForSideCounts(2, 1, minimum) === "LOW", "2/1 side counts should be LOW");

assert(
  helper.includes('export type WatchScoreConfidence = "HIGH" | "MEDIUM" | "LOW";') &&
    helper.includes("watchScoreConfidenceForSideCounts") &&
    helper.includes("WATCH_SCORE_CONFIDENCE_MIN_QUALIFIED") &&
    helper.includes("WATCH_SCORE_FALLBACK_FORM_HAIRCUT") &&
    helper.includes('"LIMITED DATA"') &&
    helper.includes('"LOW CONFIDENCE"'),
  "shared watch-score confidence helper must expose constants, tiers, and chip labels",
);

assert(
  roleHelper.includes('export type StarterRoleContextLabel = "SPOT START" | "RECENT CALL-UP" | "STRETCHING OUT" | "FIRST STARTS";') &&
    roleHelper.includes("reliefAppearances > input.gamesStarted && input.gamesStarted <= 2") &&
    roleHelper.includes("input.totalAppearances < 3") &&
    roleHelper.includes("input.gamesStarted <= 3 && input.lastTwoAppearancesStarted"),
  "spot-start role helper must classify spot starts, recent call-ups, stretching-out arms, and first starts from one shared function",
);

assert(
  mlbStatsClient.includes("seasonAppearances") &&
    mlbStatsClient.includes("readPitchingGamesPlayed") &&
    mlbStatsClient.includes("lastTwoAppearancesStarted") &&
    mlbStatsClient.includes("latestAppearances.length === 2"),
  "MLB Stats completeness payload must include season appearances and last-two-appearance role context",
);

assert(
  types.includes('export type MatchupConfidence = "HIGH" | "MEDIUM" | "LOW" | "NONE";') &&
    types.includes('export type WatchScoreConfidence = "HIGH" | "MEDIUM" | "LOW";') &&
    types.includes("watchScoreConfidence: WatchScoreConfidence;") &&
    types.includes("watchScoreQualifiedStartCounts") &&
    types.includes("roleContext?:") &&
    types.includes("StarterRoleContextLabel"),
  "TonightGame payload must store watch-score confidence, side qualified counts, and limited-starter role context",
);

assert(
  tonightService.includes('["tonight-must-watch", "v10"]') &&
    tonightService.includes("const watchScoreQualifiedStartCounts = {") &&
    tonightService.includes("watchScoreConfidenceForSideCounts(watchScoreQualifiedStartCounts.away, watchScoreQualifiedStartCounts.home)") &&
    tonightService.includes("adjustedStarterWatchValue(awayStarter, leagueMeanGS)") &&
    tonightService.includes("value * WATCH_SCORE_FALLBACK_FORM_HAIRCUT") &&
    tonightService.includes("watchScoreConfidence,") &&
    tonightService.includes("watchScoreQualifiedStartCounts,") &&
    tonightService.includes("shouldFetchLimitedStarterCompleteness") &&
    tonightService.includes("buildStarterRoleContext") &&
    tonightService.includes("classifyStarterRoleContext"),
  "tonight-service must compute and store confidence and limited-starter role context at score-build time",
);

assert(
  mustWatch.includes("function WatchScoreConfidenceChip") &&
    mustWatch.includes("data-visible-watch-score-confidences") &&
    mustWatch.includes("data-visible-watch-score-confidence-labels") &&
    mustWatch.includes("data-visible-watch-score-qualified-counts") &&
    countOccurrences(mustWatch, "data-watch-score-confidence={game.watchScoreConfidence}") === 2 &&
    mustWatch.includes("data-hook-score-confidence={game.watchScoreConfidence}") &&
    mustWatch.includes("data-watch-score-confidence-chip={game.watchScoreConfidence}") &&
    mustWatch.includes("BASELINE") &&
    mustWatch.includes('"data-projection-baseline": String(baselineProjection)') &&
    mustWatch.includes("function StarterRoleContextLine") &&
    mustWatch.includes("data-visible-starter-role-contexts") &&
    mustWatch.includes("data-visible-starter-role-usages") &&
    mustWatch.includes("2026: ${role.seasonStarts} GS / ${role.seasonReliefAppearances} RP"),
  "Must-Watch cards must render and expose confidence chips, side counts, BASELINE projection tags, and role usage lines",
);

assert(
  methodology.includes("Watch Score Confidence") &&
    methodology.includes("WATCH_SCORE_CONFIDENCE_MIN_QUALIFIED") &&
    methodology.includes("WATCH_SCORE_FALLBACK_FORM_HAIRCUT") &&
    methodology.includes("LIMITED DATA or LOW CONFIDENCE") &&
    methodology.includes("Fallback form multiplier"),
  "methodology must document watch-score confidence thresholds and haircut from the config constants",
);

assert(
  upcomingOg.includes("watchScoreConfidenceLabel(topGame.watchScoreConfidence)") &&
    upcomingWeekOg.includes("watchScoreConfidenceLabel(topGame.game.watchScoreConfidence)"),
  "upcoming OG images must include the stored watch-score confidence label when limited",
);

assert(
  packageJson.includes('"check:watch-confidence": "node scripts/check-watch-score-confidence-contract.mjs"'),
  "package.json must expose check:watch-confidence",
);

console.log("watch-score confidence contract ok: stored tiers, fallback haircut, UI chips, docs, and OG labels are pinned");
