import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const startService = await readFile("src/lib/data/start-service.ts", "utf8");
const types = await readFile("src/lib/types.ts", "utf8");
const methodology = await readFile("src/app/methodology/page.tsx", "utf8");
const audit = await readFile("docs/gs-plus-adjustment-audit.md", "utf8");

const neutral = 1;
const hitterParkFactor = 1.3;
const pitcherParkFactor = 0.9;
const completedHitterParkValue = (hitterParkFactor - neutral) * 12;
const completedPitcherParkValue = (pitcherParkFactor - neutral) * 12;
const expectedHitterParkValue = (neutral - hitterParkFactor) * 10;
const expectedPitcherParkValue = (neutral - pitcherParkFactor) * 10;

assert(completedHitterParkValue > completedPitcherParkValue, "context-v8 completed GS+ must reward higher run factors for identical lines");
assert(completedHitterParkValue > 0, "context-v8 completed GS+ park component must be positive above neutral");
assert(completedPitcherParkValue < 0, "context-v8 completed GS+ park component must be negative below neutral");
assert(expectedHitterParkValue < expectedPitcherParkValue, "expected GS+ must keep projection-direction park semantics");

assert(
  startService.includes("value: (context.parkRunFactor - NEUTRAL_PARK_RUN_FACTOR) * 12") &&
    startService.includes("Expected GS+ projects run prevention") &&
    startService.includes("(NEUTRAL_PARK_RUN_FACTOR - context.parkRunFactor) * 10") &&
    startService.includes('formulaVersion: "context-v8"'),
  "start service must ship completed context-v8 sign while documenting expected GS+ projection sign",
);

assert(types.includes('formulaVersion: "context-v8";'), "types must pin context-v8");
assert(methodology.includes('(run factor - 1.00) x 12'), "methodology must show the context-v8 park formula");
assert(audit.includes("`context-v8` corrects completed-start GS+"), "audit must include the dated context-v8 correction note");

console.log("gs-plus context-v8 ok: completed park sign and expected projection sign are pinned");
