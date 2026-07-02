import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const canonicalRecord = await readFile("src/lib/canonical-start-record.ts", "utf8");
const startService = await readFile("src/lib/data/start-service.ts", "utf8");
const archiveStatusRoute = await readFile("src/app/api/archive/status/route.ts", "utf8");

assert(
  canonicalRecord.includes('export type CanonicalStartStatus = "scheduled" | "live" | "final";') &&
    canonicalRecord.includes("export type CanonicalStartRecord = {") &&
    canonicalRecord.includes("line: StartLine;") &&
    canonicalRecord.includes("gameScorePlus: number;") &&
    canonicalRecord.includes("gameScorePlusBreakdown?: StartApiGameScorePlusBreakdown;") &&
    canonicalRecord.includes("frozen: boolean;") &&
    canonicalRecord.includes("audit: CanonicalStartAuditEntry[];") &&
    canonicalRecord.includes('event: "created" | "live-updated" | "final-reconciled" | "final-correction";') &&
    canonicalRecord.includes("export type CanonicalStartLineDiff = {"),
  "canonical start record must carry line, score, source, frozen state, and audit fields",
);

assert(
  canonicalRecord.includes('const final = source.line === "archive-gamefeed";') &&
    canonicalRecord.includes('const live = source.line === "live-gamefeed";') &&
    canonicalRecord.includes('status: final ? "final" : live ? "live" : "scheduled"') &&
    canonicalRecord.includes("finalizedAt: final ? timestamp : null") &&
    canonicalRecord.includes("frozen: final") &&
    canonicalRecord.includes('event: final ? "final-reconciled" : live ? "live-updated" : "created"') &&
    canonicalRecord.includes("Canonical record reflects a provisional live starter line."),
  "canonical start record must freeze archive finals while keeping live gamefeed lines provisional",
);

assert(
  canonicalRecord.includes("roundToScorePrecision(start.gameScorePlus, SCORE_DISPLAY_PRECISION.gameScorePlus)") &&
    canonicalRecord.includes("gameScorePlusBreakdown: start.gameScorePlusBreakdown ? { ...start.gameScorePlusBreakdown, total: gameScorePlus } : undefined"),
  "canonical start record must apply shared GS+ display precision and keep breakdown totals aligned",
);

assert(
  canonicalRecord.includes("export function reconcileCanonicalStartRecord(") &&
    canonicalRecord.includes("const diffs = diffCanonicalStartRecord(record, official.line, gameScorePlus);") &&
    canonicalRecord.includes('event: record.frozen && diffs.length > 0 ? "final-correction" : "final-reconciled"') &&
    canonicalRecord.includes("...(diffs.length > 0 ? { diffs } : {})") &&
    canonicalRecord.includes("export function diffCanonicalStartRecord(") &&
    canonicalRecord.includes('const fields: Array<keyof StartLine> = ["inningsPitched", "hits", "earnedRuns", "walks", "strikeouts", "pitches"];') &&
    canonicalRecord.includes('diffs.push({ field: "gameScorePlus", before: record.gameScorePlus, after: officialGameScorePlus });'),
  "canonical reconciliation must diff final line and GS+ corrections with explicit audit entries",
);

assert(
  canonicalRecord.includes("export type CanonicalReconciliationReport = {") &&
    canonicalRecord.includes("correctionRecords: number;") &&
    canonicalRecord.includes("correctionDiffs: CanonicalStartLineDiff[];") &&
    canonicalRecord.includes("latestAuditAt: string | null;") &&
    canonicalRecord.includes("export function summarizeCanonicalReconciliation(") &&
    canonicalRecord.includes('entry.event === "final-correction"') &&
    canonicalRecord.includes('entry.event === "final-reconciled"'),
  "canonical reconciliation must expose a daily report with final, frozen, correction, diff, and audit timing counts",
);

assert(
  startService.includes('import { canonicalizeStartSummaries, canonicalStartRecordFromSummary, summarizeCanonicalReconciliation } from "@/lib/canonical-start-record";') &&
    startService.includes("return canonicalizeStartSummaries(demoSlateStarts);") &&
    startService.includes("return canonicalizeStartSummaries(archivedStarts);") &&
    startService.includes("return canonicalizeStartSummaries(scheduledStarts.length > 0 ? scheduledStarts : demoSlateStarts);") &&
    startService.includes("const slateStarts = canonicalizeStartSummaries(starts.length > 0 ? starts : demoSlateStarts);") &&
    startService.includes("return canonicalizeStartSummaries(archivedStarts") &&
    startService.includes("export async function getArchivedSeasonStartSummaries"),
  "daily slate, slate API, archived slate, and season summaries must pass through canonical start normalization",
);

assert(
  startService.includes("export async function getCanonicalStartReconciliationReport(") &&
    startService.includes("const records = starts.map((start) => canonicalStartRecordFromSummary(start));") &&
    startService.includes("return summarizeCanonicalReconciliation(date, records);") &&
    archiveStatusRoute.includes("getCanonicalStartReconciliationReport") &&
    archiveStatusRoute.includes("export async function GET(request: Request)") &&
    archiveStatusRoute.includes('new URL(request.url).searchParams.get("date")') &&
    archiveStatusRoute.includes("canonicalReconciliation"),
  "archive status API must expose the canonical daily reconciliation report for a requested date",
);

console.log("canonical start record contract ok: start summaries pass through canonical score and line normalization");
