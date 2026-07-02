import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const scoreDisplay = await readFile("src/lib/score-display.ts", "utf8");
const tonightService = await readFile("src/lib/data/tonight-service.ts", "utf8");
const upcomingMetadata = await readFile("src/lib/upcoming-metadata.ts", "utf8");
const liveScoreboard = await readFile("src/components/live-scoreboard.tsx", "utf8");

assert(
  scoreDisplay.includes("export const SCORE_DISPLAY_PRECISION = {") &&
    scoreDisplay.includes("gameScorePlus: 0,") &&
    scoreDisplay.includes("watchScore: 1,") &&
    scoreDisplay.includes("projectedGameScorePlus: 1,") &&
    scoreDisplay.includes("export const WATCH_SCORE_RANGE = {") &&
    scoreDisplay.includes("export function roundWatchScore") &&
    scoreDisplay.includes("export function formatWatchScore") &&
    scoreDisplay.includes("export function formatGameScorePlus"),
  "score display precision and range must live in one shared module",
);

assert(
  tonightService.includes('import { SCORE_DISPLAY_PRECISION, WATCH_SCORE_RANGE, roundProjectedGameScorePlus, roundToScorePrecision, roundWatchScore } from "@/lib/score-display";') &&
    tonightService.includes("const WATCH_SCORE_PRECISION = SCORE_DISPLAY_PRECISION.watchScore;") &&
    !tonightService.includes("const WATCH_SCORE_RANGE = { min: 0, max: 100 };") &&
    !tonightService.includes("const WATCH_SCORE_PRECISION = 1;") &&
    tonightService.includes("const topArm = roundWatchScore(") &&
    tonightService.includes("const rawWatchScore = status === \"ppd\" ? 0 : roundWatchScore(") &&
    tonightService.includes("projectedGsPlus: roundProjectedGameScorePlus(") &&
    tonightService.includes("return roundToScorePrecision(value, 1);"),
  "Tonight service must use shared score precision for watch score and projected GS+ values",
);

assert(
  upcomingMetadata.includes('import { formatWatchScore } from "@/lib/score-display";') &&
    upcomingMetadata.includes("formatWatchScore(topGame.gameWatchScore)") &&
    !upcomingMetadata.includes("topGame.gameWatchScore.toFixed(1)"),
  "Upcoming metadata must format watch scores with the shared formatter",
);

assert(
  liveScoreboard.includes('import { formatGameScorePlus } from "@/lib/score-display";') &&
    liveScoreboard.includes("return formatGameScorePlus(score);") &&
    !liveScoreboard.includes("return Number.isInteger(score) ? String(score) : score.toFixed(1);"),
  "Live scoreboard must format GS+ with the shared formatter",
);

console.log("score display contract ok: GS+ and watch score precision are centralized");
