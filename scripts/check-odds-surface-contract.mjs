import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const [
  oddsClient,
  oddsSnapshot,
  tonightService,
  mustWatch,
  methodology,
  oddsCron,
  vercelConfig,
] = await Promise.all([
  readFile("src/lib/data/odds-client.ts", "utf8"),
  readFile("src/lib/data/odds-snapshot-service.ts", "utf8"),
  readFile("src/lib/data/tonight-service.ts", "utf8"),
  readFile("src/components/tonights-must-watch.tsx", "utf8"),
  readFile("src/app/methodology/page.tsx", "utf8"),
  readFile("src/app/api/cron/odds-sync/route.ts", "utf8"),
  readFile("vercel.json", "utf8"),
]);

assert(
  oddsClient.includes("fetchMlbOddsMarketContextsWithDiagnostics") &&
    oddsClient.includes('response.headers.get("x-requests-used")') &&
    oddsClient.includes('response.headers.get("x-requests-remaining")') &&
    oddsClient.includes("eventsSeen") &&
    oddsClient.includes("matchedGames") &&
    oddsClient.includes("if (result.error || result.contexts.size === 0) oddsCache.delete(cacheKey)") &&
    oddsClient.includes('export type OddsProviderSource = "the-odds-api" | "prop-line";') &&
    oddsClient.includes("THE_BUMP_PROPLINE_API_KEY") &&
    oddsClient.includes("THE_BUMP_ODDS_PROVIDER") &&
    oddsClient.includes("export function configuredOddsProviderSource()") &&
    oddsClient.includes("PROPLINE_API_BASE") &&
    oddsClient.includes("oddsEventsUrl(provider)") &&
    oddsClient.includes("normalizedTeamKeys") &&
    oddsClient.includes('.normalize("NFD")') &&
    oddsClient.includes("replace(/[\\u0300-\\u036f]/g, \"\")"),
  "odds client must expose credit/match diagnostics, support PropLine as a provider, fold accented names, and must not cache empty failure results",
);

assert(
  oddsSnapshot.includes('const ODDS_SNAPSHOT_VERSION = 1') &&
    oddsSnapshot.includes('readRuntimeState<OddsSnapshotState>(oddsSnapshotStateKey(date))') &&
    oddsSnapshot.includes("writeRuntimeState(oddsSnapshotStateKey(date), snapshot)") &&
    oddsSnapshot.includes('export const ODDS_SYNC_CADENCE_LABEL = "daily-pre-first-pitch-free-tier"') &&
    oddsSnapshot.includes('const ODDS_MIN_SYNC_INTERVAL_MINUTES = envPositiveInt("THE_BUMP_ODDS_MIN_SYNC_MINUTES", 6 * 60)') &&
    oddsSnapshot.includes('process.env.THE_BUMP_ODDS_SYNC_NEXT_DATE === "1"') &&
    oddsSnapshot.includes('const defaultUpcomingDate = await getDefaultUpcomingDate(today);') &&
    oddsSnapshot.includes("const dates = includeNextDate ? [today, defaultUpcomingDate, addDays(today, 1)] : [today, defaultUpcomingDate];") &&
    oddsSnapshot.includes("const configuredProvider = configuredOddsProviderSource();") &&
    oddsSnapshot.includes("previousSnapshot.source === configuredProvider") &&
    oddsSnapshot.includes('isFreshEnoughSnapshot(previousSnapshot, schedule.games, capturedAt)') &&
    oddsSnapshot.includes("eventsSeen: diagnostics.eventsSeen") &&
    oddsSnapshot.includes("provider: diagnostics.provider") &&
    oddsSnapshot.includes("source: context.source") &&
    oddsSnapshot.includes("hasGameStarted(game)") &&
    oddsSnapshot.includes("nextGames.push({ ...previousGame, frozen: true })") &&
    oddsSnapshot.includes("scheduledProbableStartersHaveStoredLines(game, previousGame)") &&
    oddsSnapshot.includes("return requiredStarters.every((starter) => {"),
  "odds snapshots must use runtime-state storage, document free-tier cadence, refresh partial starter-line snapshots, expose diagnostics, and freeze existing rows after first pitch",
);

assert(
  tonightService.includes('import { readOddsSnapshotMarketContexts } from "@/lib/data/odds-snapshot-service";') &&
    tonightService.includes("const oddsRequestGames = schedule.games.filter((game) => !hasStarted(game));") &&
    tonightService.includes("readOddsSnapshotMarketContexts(date)") &&
    tonightService.includes("mergeMarketContexts(snapshotMarketContexts, requestMarketContexts)") &&
    tonightService.includes("fetchMlbOddsMarketContexts(oddsRequestGames)") &&
    tonightService.includes("resolvePitcherStrikeoutPropLine(marketContext.pitcherStrikeouts, starterName)") &&
    tonightService.includes("return first[0] === starterFirst[0] && last === starterLast;") &&
    tonightService.includes("return candidates.length === 1 ? candidates[0][1] : null;") &&
    !tonightService.includes("writeRuntimeState("),
  "render path must read odds snapshots, resolve conservative starter-name aliases, and must not write odds state during render",
);

assert(
  mustWatch.includes("K line pending") &&
    mustWatch.includes("K line {strikeoutPropLine.toFixed(1)}") &&
    mustWatch.includes("Proj {market.projectedStrikeouts.toFixed(1)}") &&
    mustWatch.includes("Edge {formatSigned(market.strikeoutEdge)}") &&
    mustWatch.includes('data-market-attribution={attribution.source}') &&
    mustWatch.includes('attribution.source === "prop-line" ? "PropLine" : "The Odds API"') &&
    mustWatch.includes("1-800-GAMBLER"),
  "Must-Watch and Upcoming shared cards must render K line, projection, edge, pending state, and one attribution line",
);

assert(
    methodology.includes("season K/9") &&
    methodology.includes("Projected innings use recent workload") &&
    methodology.includes("K prop lines come from PropLine or The Odds API snapshots written by cron") &&
    methodology.includes("Edges are projection minus line"),
  "methodology must document strikeout projection inputs and odds source",
);

assert(
    oddsCron.includes("syncOddsSnapshotsForDefaultDates") &&
    oddsCron.includes("CRON_SECRET") &&
    vercelConfig.includes('"/api/cron/odds-sync"') &&
    vercelConfig.includes('"15 14 * * *"') &&
    oddsClient.includes('const ODDS_MARKETS = process.env.THE_BUMP_ODDS_INCLUDE_TOTALS === "1" ? "pitcher_strikeouts,team_totals,totals" : "pitcher_strikeouts"'),
  "odds sync cron must be scheduled and use the existing cron auth pattern",
);

const prohibitedAdvice = new RegExp(`\\b(${[
  ["BE", "ST", "\\s+", "BE", "T"].join(""),
  ["LO", "CK"].join(""),
  ["PL", "AY"].join(""),
  ["HA", "MM", "ER"].join(""),
].join("|")})\\b`, "i");
for (const [label, source] of [
  ["must-watch", mustWatch],
  ["methodology", methodology],
  ["odds snapshot", oddsSnapshot],
]) {
  assert(!prohibitedAdvice.test(source), `${label} must not add betting advice language`);
}

console.log("odds surface contract ok: snapshot-backed K prop rows, cron sync, and methodology docs are pinned");
