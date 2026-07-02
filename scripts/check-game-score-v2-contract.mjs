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
const mlbStatsClient = await readFile("src/lib/data/mlb-stats-client.ts", "utf8");
const slatePage = await readFile("src/app/slate/[window]/[date]/page.tsx", "utf8");
const methodologyPage = await readFile("src/app/methodology/page.tsx", "utf8");
const types = await readFile("src/lib/types.ts", "utf8");

const publishedTangoFixtures = [
  {
    name: "Jared Jones 2026-07-02",
    line: { inningsPitched: 4, hits: 2, earnedRuns: 1, runsAllowed: 1, homeRunsAllowed: 0, walks: 2, strikeouts: 6, pitches: 73 },
    gameScoreV2: 59,
  },
  {
    name: "Alan Rangel 2026-07-02",
    line: { inningsPitched: 4, hits: 3, earnedRuns: 0, runsAllowed: 0, homeRunsAllowed: 0, walks: 4, strikeouts: 4, pitches: 90 },
    gameScoreV2: 54,
  },
  {
    name: "Chase Burns 2026-07-02",
    line: { inningsPitched: 6, hits: 4, earnedRuns: 2, runsAllowed: 2, homeRunsAllowed: 1, walks: 2, strikeouts: 4, pitches: 89 },
    gameScoreV2: 56,
  },
  {
    name: "Jacob Misiorowski 2026-07-02",
    line: { inningsPitched: 5, hits: 5, earnedRuns: 1, runsAllowed: 5, homeRunsAllowed: 2, walks: 0, strikeouts: 10, pitches: 82 },
    gameScoreV2: 43,
  },
];

function inningsToOuts(inningsPitched) {
  return Math.round(inningsPitched * 3);
}

function calculateFixtureGameScoreV2(line) {
  return Math.round(40 + inningsToOuts(line.inningsPitched) * 2 + line.strikeouts - line.walks * 2 - line.hits * 2 - line.runsAllowed * 3 - line.homeRunsAllowed * 6);
}

for (const fixture of publishedTangoFixtures) {
  assert(
    calculateFixtureGameScoreV2(fixture.line) === fixture.gameScoreV2,
    `${fixture.name} must match the external Tango Game Score v2 fixture`,
  );
}

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
    types.includes("runsAllowed?: number;") &&
    types.includes("homeRunsAllowed?: number;") &&
    types.includes('Pick<StartSummary, "id" | "date" | "opponent" | "result" | "line" | "gameScorePlus" | "gameScoreV2">') &&
    canonicalRecord.includes('import { calculateGameScoreV2 } from "@/lib/game-score-v2";') &&
    canonicalRecord.includes("gameScoreV2: number;") &&
    canonicalRecord.includes("const gameScoreV2 = start.gameScoreV2 ?? calculateGameScoreV2(start.line);") &&
    canonicalRecord.includes("gameScoreV2: record.gameScoreV2,") &&
    canonicalRecord.includes("const gameScoreV2 = official.gameScoreV2 ?? calculateGameScoreV2(official.line);"),
  "canonical start records and shared response types must carry stored Game Score v2",
);

assert(
  mlbStatsClient.includes("runs?: number;") &&
    mlbStatsClient.includes("homeRuns?: number;") &&
    mlbStatsClient.includes('...(typeof stats.runs === "number" ? { runsAllowed: stats.runs } : {})') &&
    mlbStatsClient.includes('...(typeof stats.homeRuns === "number" ? { homeRunsAllowed: stats.homeRuns } : {})'),
  "MLB gamefeed lines must carry official total runs and home runs into canonical StartLine when present",
);

assert(
  canonicalStore.includes("gameScoreV2: next.gameScoreV2,") &&
    startService.includes('import { calculateGameScoreV2 } from "@/lib/game-score-v2";') &&
    startService.includes("gameScoreV2: start.gameScoreV2,") &&
    startService.includes("gameScoreV2: start.gameScoreV2 ?? calculateGameScoreV2(start.line),") &&
    startService.includes("gameScoreV2: calculateGameScoreV2(start.line),"),
  "slate, start detail, archived summaries, and final reconciliation must expose Game Score v2 from the canonical path",
);

assert(
  slatePage.includes("GSv2 {start.gameScoreV2}") &&
    slatePage.includes("function formatGsAdjustment(start: StartSummary)") &&
    slatePage.includes("return `GS+ ${formatSigned(start.gameScorePlus - start.gameScoreV2)} adj`;") &&
    slatePage.includes("data-slate-start-decision={start.result}") &&
    slatePage.includes("function formatDecisionLabel(result: StartSummary[\"result\"])") &&
    slatePage.includes('if (result === "W") return "Win";') &&
    slatePage.includes('if (result === "L") return "Loss";') &&
    slatePage.includes("data-slate-start-event-flags={start.eventFlags.join(\",\")}") &&
    slatePage.includes("function formatStartEventFlag(flag: NonNullable<StartSummary[\"eventFlags\"]>[number])"),
  "completed slate cards must expose canonical GSv2, GS+ adjustment context, pitcher decisions, and start event flags",
);

assert(
    methodologyPage.includes("Game Score v2 is the familiar box-score benchmark.") &&
    methodologyPage.includes("Toe the Slab stores GSv2 on the same canonical start record as GS+") &&
    methodologyPage.includes("The adjustment label is shown as GS+ minus GSv2.") &&
    methodologyPage.includes("GSv2 uses official total runs and home runs when the gamefeed carries them") &&
    methodologyPage.includes("older line records fall back to earned runs and zero home runs") &&
    methodologyPage.includes('<FormulaItem label="Adjustment" value="GS+ minus GSv2" />'),
  "methodology must explain GSv2, the GS+ adjustment label, official input usage, and legacy fallbacks",
);

console.log("game score v2 contract ok: GSv2 is computed once and carried through canonical start records");
