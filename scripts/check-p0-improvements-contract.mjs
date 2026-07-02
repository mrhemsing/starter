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
const mustWatchComponent = await readFile("src/components/tonights-must-watch.tsx", "utf8");

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
    types.includes("confidence: ProbableStarterConfidence;") &&
    types.includes("likelyOpener?: boolean;"),
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
  mlbStatsClient.includes("recentAppearances: number;") &&
    mlbStatsClient.includes("recentStarts: number;") &&
    mlbStatsClient.includes("recentReliefAppearances: number;") &&
    mlbStatsClient.includes('const gameLogParams = new URLSearchParams({ stats: "gameLog", group: "pitching", season });') &&
    mlbStatsClient.includes("function readRecentPitchingUsage(") &&
    mlbStatsClient.includes("reliefAppearances: Math.max(0, recentSplits.length - starts),"),
  "probable starter completeness must carry recent relief-heavy usage for opener detection",
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
  mlbStatsClient.includes('import { readRuntimeState, writeRuntimeState } from "@/lib/data/runtime-state-store";') &&
  mlbStatsClient.includes('const probableConfidenceBySlot = new Map<string, MlbProbablePitcher["confidence"] | "TBD">();') &&
    mlbStatsClient.includes("const PROBABLE_CONFIDENCE_TRANSITION_HORIZON_DAYS = 7;") &&
    mlbStatsClient.includes("type ProbableConfidenceState = {") &&
    mlbStatsClient.includes('const NEXT_PRODUCTION_BUILD_PHASE = "phase-production-build";') &&
    mlbStatsClient.includes("await logProbableConfidenceTransitions(hydratedSchedule);") &&
    mlbStatsClient.includes("async function logProbableConfidenceTransitions(schedule: MlbSchedule)") &&
    mlbStatsClient.includes("if (process.env.NEXT_PHASE === NEXT_PRODUCTION_BUILD_PHASE) return;") &&
    mlbStatsClient.includes("if (isBeyondProbableConfidenceTransitionHorizon(game.gameDate)) continue;") &&
    mlbStatsClient.includes("const previousConfidence = probableConfidenceBySlot.get(key) ?? (await readProbableConfidenceState(stateKey))?.confidence;") &&
    mlbStatsClient.includes("probableConfidenceBySlot.set(key, nextConfidence);") &&
    mlbStatsClient.includes("await writeProbableConfidenceState(stateKey, nextConfidence);") &&
    mlbStatsClient.includes('console.info("probable starter confidence transition", {') &&
    mlbStatsClient.includes("from: previousConfidence,") &&
    mlbStatsClient.includes("to: nextConfidence,") &&
    mlbStatsClient.includes('source: slot.probable?.source ?? "none",') &&
    mlbStatsClient.includes("function probableConfidenceStateKey(gamePk: number, side:") &&
    mlbStatsClient.includes("async function readProbableConfidenceState(key: string)") &&
    mlbStatsClient.includes("async function writeProbableConfidenceState(key: string, confidence: ProbableConfidenceState") &&
    mlbStatsClient.includes("function isBeyondProbableConfidenceTransitionHorizon(gameDate: string)"),
  "probable starter confidence transitions must persist state, suppress repeated logs, and skip far-future probables",
);

assert(
  tonightService.includes('probableSource: "none",') &&
    tonightService.includes('probableConfidence: "TBD",') &&
    tonightService.includes("probableSource: probable.source,") &&
    tonightService.includes("probableConfidence: probable.confidence,"),
  "Upcoming starter slots must carry CONFIRMED/TBD probable metadata",
);

assert(
  tonightService.includes("const LIKELY_OPENER_MAX_CAREER_STARTS = 4;") &&
    tonightService.includes("const LIKELY_OPENER_RECENT_APPEARANCE_FLOOR = 3;") &&
    tonightService.includes("function isLikelyOpenerProfile(") &&
    tonightService.includes("completeness.recentReliefAppearances > completeness.recentStarts") &&
    tonightService.includes("function openerProjection(") &&
    tonightService.includes('notes: ["Likely opener / bullpen game", "Opener innings profile"]') &&
    tonightService.includes("likelyOpener,"),
  "Upcoming service must flag likely openers and use a 2.0 IP opener projection",
);

assert(
  mustWatchComponent.includes("data-starter-probable-source={starter.probableSource}") &&
    mustWatchComponent.includes("data-starter-probable-confidence={starter.probableConfidence}") &&
    mustWatchComponent.includes("data-starter-likely-opener={String(starter.likelyOpener === true)}") &&
    mustWatchComponent.includes("data-likely-opener={String(game.flags?.likelyOpener === true)}") &&
    mustWatchComponent.includes("function ProbableConfidenceChip(") &&
    mustWatchComponent.includes("function LikelyOpenerBadge(") &&
    mustWatchComponent.includes('starter.probableConfidence !== "REPORTED"') &&
    mustWatchComponent.includes("UNCONFIRMED") &&
    mustWatchComponent.includes("PROVISIONAL") &&
    mustWatchComponent.includes("Likely opener / bullpen game") &&
    mustWatchComponent.includes("Starter unconfirmed. Score uses league baseline.") &&
    !mustWatchComponent.includes("Starter TBD / league baseline used"),
  "Upcoming cards must render REPORTED, TBD, and likely opener trust treatments",
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
