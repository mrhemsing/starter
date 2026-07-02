import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const canonicalRecord = await readFile("src/lib/canonical-start-record.ts", "utf8");
const startService = await readFile("src/lib/data/start-service.ts", "utf8");
const methodologyPage = await readFile("src/app/methodology/page.tsx", "utf8");
const types = await readFile("src/lib/types.ts", "utf8");

assert(
  types.includes('export type StartEventFlag = "HARD_LUCK" | "VULTURE";') &&
    types.includes("eventFlags?: StartEventFlag[];") &&
    canonicalRecord.includes("eventFlags: StartEventFlag[];") &&
    canonicalRecord.includes("const eventFlags = start.eventFlags ?? deriveStartEventFlags(start.result, gameScorePlus);") &&
    canonicalRecord.includes("export function deriveStartEventFlags("),
  "start summaries and canonical records must carry shared start event flags",
);

assert(
  canonicalRecord.includes('if ((result === "L" || result === "ND") && gameScorePlus >= 60) return ["HARD_LUCK"];') &&
    canonicalRecord.includes('if (result === "W" && gameScorePlus <= 35) return ["VULTURE"];') &&
    canonicalRecord.includes("const eventFlags = deriveStartEventFlags(record.result, gameScorePlus);") &&
    canonicalRecord.includes("eventFlags,"),
  "hard-luck and vulture flags must use the P1-4 score and decision thresholds during canonical creation and final reconciliation",
);

assert(
  startService.includes('import { canonicalizeStartSummaries, canonicalStartRecordFromSummary, deriveStartEventFlags, summarizeCanonicalReconciliation } from "@/lib/canonical-start-record";') &&
    startService.includes("eventFlags: start.eventFlags,") &&
    startService.includes("eventFlags: start.eventFlags ?? deriveStartEventFlags(start.result, start.gameScorePlus),"),
  "slate and start detail API paths must expose event flags from the canonical/shared summary path",
);

assert(
  methodologyPage.includes("A hard-luck flag marks a loss or no-decision with GS+ 60 or better.") &&
    methodologyPage.includes("A vulture flag marks a win with GS+ 35 or worse.") &&
    methodologyPage.includes("Decisions are context, not ranking inputs.") &&
    methodologyPage.includes("the ranked order stays driven by GS+ and its visible line tiebreakers."),
  "methodology must explain hard-luck and vulture flags without making decisions ranking inputs",
);

console.log("start event flags contract ok: hard-luck and vulture flags are canonical data");
