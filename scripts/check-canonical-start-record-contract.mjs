import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const canonicalRecord = await readFile("src/lib/canonical-start-record.ts", "utf8");
const startService = await readFile("src/lib/data/start-service.ts", "utf8");

assert(
  canonicalRecord.includes('export type CanonicalStartStatus = "scheduled" | "final";') &&
    canonicalRecord.includes("export type CanonicalStartRecord = {") &&
    canonicalRecord.includes("line: StartLine;") &&
    canonicalRecord.includes("gameScorePlus: number;") &&
    canonicalRecord.includes("gameScorePlusBreakdown?: StartApiGameScorePlusBreakdown;") &&
    canonicalRecord.includes("frozen: boolean;") &&
    canonicalRecord.includes("audit: CanonicalStartAuditEntry[];"),
  "canonical start record must carry line, score, source, frozen state, and audit fields",
);

assert(
  canonicalRecord.includes("source.line === \"archive-gamefeed\" || source.line === \"live-gamefeed\"") &&
    canonicalRecord.includes('status: final ? "final" : "scheduled"') &&
    canonicalRecord.includes("finalizedAt: final ? timestamp : null") &&
    canonicalRecord.includes("frozen: final") &&
    canonicalRecord.includes('event: final ? "final-reconciled" : "created"'),
  "canonical start record must freeze and audit final gamefeed-backed starts",
);

assert(
  canonicalRecord.includes("roundToScorePrecision(start.gameScorePlus, SCORE_DISPLAY_PRECISION.gameScorePlus)") &&
    canonicalRecord.includes("gameScorePlusBreakdown: start.gameScorePlusBreakdown ? { ...start.gameScorePlusBreakdown, total: gameScorePlus } : undefined"),
  "canonical start record must apply shared GS+ display precision and keep breakdown totals aligned",
);

assert(
  startService.includes('import { canonicalizeStartSummaries } from "@/lib/canonical-start-record";') &&
    startService.includes("return canonicalizeStartSummaries(demoSlateStarts);") &&
    startService.includes("return canonicalizeStartSummaries(archivedStarts);") &&
    startService.includes("return canonicalizeStartSummaries(scheduledStarts.length > 0 ? scheduledStarts : demoSlateStarts);") &&
    startService.includes("const slateStarts = canonicalizeStartSummaries(starts.length > 0 ? starts : demoSlateStarts);") &&
    startService.includes("return canonicalizeStartSummaries(archivedStarts") &&
    startService.includes("export async function getArchivedSeasonStartSummaries"),
  "daily slate, slate API, archived slate, and season summaries must pass through canonical start normalization",
);

console.log("canonical start record contract ok: start summaries pass through canonical score and line normalization");
