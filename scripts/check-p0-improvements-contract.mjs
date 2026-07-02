import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const formTokens = await readFile("src/lib/form-tokens.ts", "utf8");
const types = await readFile("src/lib/types.ts", "utf8");
const mlbStatsClient = await readFile("src/lib/data/mlb-stats-client.ts", "utf8");
const mlbArchive = await readFile("src/lib/data/mlb-archive.ts", "utf8");
const tonightService = await readFile("src/lib/data/tonight-service.ts", "utf8");

assert(
  formTokens.includes("tbdStarter: {") &&
    formTokens.includes("pairingMultiplier: 0.6,") &&
    formTokens.includes("maxWatchScore: 47.9,") &&
    formTokens.includes("maxRankWhenAlternativesExist: 4,"),
  "P0-1 TBD starter trust gates must live in MUSTWATCH_CONFIG",
);

assert(
  types.includes('export type ProbableStarterConfidence = "CONFIRMED" | "REPORTED" | "TBD";') &&
    types.includes('export type ProbableStarterSource = "mlb-stats-api" | "secondary-feed" | "none";') &&
    types.includes("probableSource: ProbableStarterSource;") &&
    types.includes("probableConfidence: ProbableStarterConfidence;") &&
    types.includes("source: ProbableStarterSource;") &&
    types.includes("confidence: ProbableStarterConfidence;"),
  "probable starter records must expose source and confidence metadata",
);

assert(
  mlbStatsClient.includes('source: "mlb-stats-api",') &&
    mlbStatsClient.includes('confidence: "CONFIRMED",') &&
    mlbStatsClient.includes('const ESPN_MLB_SCOREBOARD_API = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard";') &&
    mlbStatsClient.includes("async function fetchReportedProbablePitchers(date: string, schedule: MlbSchedule, options: MlbScheduleClientOptions = {}): Promise<Map<string, MlbProbablePitcher>>") &&
    mlbStatsClient.includes('source: "secondary-feed",') &&
    mlbStatsClient.includes('confidence: "REPORTED",') &&
    mlbStatsClient.includes("const missingKeys = new Set(schedule.games.flatMap((game) => [") &&
    mlbStatsClient.includes("if (!missingKeys.has(key)) continue;") &&
    mlbStatsClient.includes("async function resolveReportedPitcherMlbId(fullName: string, options: MlbScheduleClientOptions = {}): Promise<number | null>") &&
    mlbStatsClient.includes("probableAwayPitcher: game.probableAwayPitcher ?? reported.get(") &&
    mlbStatsClient.includes("probableHomePitcher: game.probableHomePitcher ?? reported.get(") &&
    mlbArchive.includes('source: "mlb-stats-api" as const,') &&
    mlbArchive.includes('confidence: "CONFIRMED" as const,'),
  "MLB Stats API probables must stay CONFIRMED while secondary-feed probables fill only missing starters as REPORTED",
);

assert(
  mlbStatsClient.includes("export const PROBABLES_REPOLL_FAR_SECONDS = 60 * 60;") &&
    mlbStatsClient.includes("export const PROBABLES_REPOLL_NEAR_SECONDS = 15 * 60;") &&
    mlbStatsClient.includes("export const PROBABLES_REPOLL_URGENT_SECONDS = 5 * 60;") &&
    mlbStatsClient.includes("export function probableStarterRepollSeconds(") &&
    mlbStatsClient.includes("remainingMs <= PROBABLES_URGENT_FIRST_PITCH_MS") &&
    mlbStatsClient.includes("remainingMs <= PROBABLES_NEAR_FIRST_PITCH_MS") &&
    mlbStatsClient.includes("cachedSchedule.expiresAt = Date.now() + probableStarterRepollSeconds(schedule) * 1000;") &&
    mlbStatsClient.includes("cachedRequestInit(options, probableStarterRepollSeconds(schedule))"),
  "probable starter refresh cadence must tighten from 60 minutes to 15 minutes to 5 minutes as first pitch approaches",
);

assert(
  tonightService.includes('probableSource: "none",') &&
    tonightService.includes('probableConfidence: "TBD",') &&
    tonightService.includes("probableSource: probable.source,") &&
    tonightService.includes("probableConfidence: probable.confidence,"),
  "Upcoming starter slots must carry CONFIRMED/TBD probable metadata",
);

assert(
  tonightService.includes('const tbd = awayStarter.status === "tbd" || homeStarter.status === "tbd";') &&
    tonightService.includes("MUSTWATCH_CONFIG.tbdStarter.pairingMultiplier") &&
    tonightService.includes("applyTbdWatchScoreCap(applyTrustGateWatchScore(rawWatchScore, matchupConfidence, hasMlbDebut), tbd, hasMlbDebut)") &&
    tonightService.includes("return Math.min(score, MUSTWATCH_CONFIG.tbdStarter.maxWatchScore);"),
  "TBD matchups must take a tunable pairing penalty and watch-score cap",
);

assert(
  tonightService.includes("function sortUpcomingWatchGames(games: TonightGame[])") &&
    tonightService.includes("const topRankLimit = MUSTWATCH_CONFIG.tbdStarter.maxRankWhenAlternativesExist - 1;") &&
    tonightService.includes("const trusted = sorted.filter((game) => !game.flags?.tbd);") &&
    tonightService.includes("const provisional = sorted.filter((game) => game.flags?.tbd);") &&
    tonightService.includes("const protectedTrusted = trusted.slice(0, topRankLimit);"),
  "TBD matchups must be kept out of the top three when trusted alternatives exist",
);

console.log("p0 improvements contract ok: TBD starter trust gates and probable confidence metadata are pinned");
