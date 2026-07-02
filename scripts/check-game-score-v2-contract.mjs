import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const gameScoreV2 = await readFile("src/lib/game-score-v2.ts", "utf8");
const canonicalRecord = await readFile("src/lib/canonical-start-record.ts", "utf8");
const canonicalStore = await readFile("src/lib/data/canonical-start-store.ts", "utf8");
const startService = await readFile("src/lib/data/start-service.ts", "utf8");
const types = await readFile("src/lib/types.ts", "utf8");

assert(
  gameScoreV2.includes("const GAME_SCORE_V2_BASELINE = 40;") &&
    gameScoreV2.includes("const GAME_SCORE_V2_OUT_VALUE = 2;") &&
    gameScoreV2.includes("const GAME_SCORE_V2_STRIKEOUT_VALUE = 1;") &&
    gameScoreV2.includes("const GAME_SCORE_V2_WALK_PENALTY = 2;") &&
    gameScoreV2.includes("const GAME_SCORE_V2_HIT_PENALTY = 2;") &&
    gameScoreV2.includes("const GAME_SCORE_V2_RUN_PENALTY = 3;") &&
    gameScoreV2.includes("const GAME_SCORE_V2_HOME_RUN_PENALTY = 6;") &&
    gameScoreV2.includes("export function calculateGameScoreV2(") &&
    gameScoreV2.includes("const runsAllowed = line.runsAllowed ?? line.earnedRuns;") &&
    gameScoreV2.includes("const homeRunsAllowed = line.homeRunsAllowed ?? 0;"),
  "Game Score v2 calculator must use the Tango component weights and keep explicit fallbacks for current canonical line inputs",
);

assert(
  types.includes("gameScoreV2?: number;") &&
    types.includes('Pick<StartSummary, "id" | "date" | "opponent" | "result" | "line" | "gameScorePlus" | "gameScoreV2">') &&
    canonicalRecord.includes('import { calculateGameScoreV2 } from "@/lib/game-score-v2";') &&
    canonicalRecord.includes("gameScoreV2: number;") &&
    canonicalRecord.includes("const gameScoreV2 = start.gameScoreV2 ?? calculateGameScoreV2(start.line);") &&
    canonicalRecord.includes("gameScoreV2: record.gameScoreV2,") &&
    canonicalRecord.includes("const gameScoreV2 = official.gameScoreV2 ?? calculateGameScoreV2(official.line);"),
  "canonical start records and shared response types must carry stored Game Score v2",
);

assert(
  canonicalStore.includes("gameScoreV2: next.gameScoreV2,") &&
    startService.includes('import { calculateGameScoreV2 } from "@/lib/game-score-v2";') &&
    startService.includes("gameScoreV2: start.gameScoreV2,") &&
    startService.includes("gameScoreV2: start.gameScoreV2 ?? calculateGameScoreV2(start.line),") &&
    startService.includes("gameScoreV2: calculateGameScoreV2(start.line),"),
  "slate, start detail, archived summaries, and final reconciliation must expose Game Score v2 from the canonical path",
);

console.log("game score v2 contract ok: GSv2 is computed once and carried through canonical start records");
