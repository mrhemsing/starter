import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const canonicalRecord = await readFile("src/lib/canonical-start-record.ts", "utf8");
const canonicalStore = await readFile("src/lib/data/canonical-start-store.ts", "utf8");
const startService = await readFile("src/lib/data/start-service.ts", "utf8");
const slateState = await readFile("src/lib/slate-state.ts", "utf8");
const archiveStatusRoute = await readFile("src/app/api/archive/status/route.ts", "utf8");
const supabaseSchema = await readFile("docs/supabase-mlb-archive.sql", "utf8");
const warmLiveStartsCron = await readFile("src/app/api/cron/warm-live-starts/route.ts", "utf8");
const formService = await readFile("src/lib/data/form-service.ts", "utf8");

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
    canonicalRecord.includes('const fields: Array<keyof StartLine> = ["inningsPitched", "hits", "earnedRuns", "runsAllowed", "homeRunsAllowed", "walks", "strikeouts", "pitches"];') &&
    canonicalRecord.includes("if (record.line[field] === undefined && officialLine[field] === undefined) continue;") &&
    canonicalRecord.includes('diffs.push({ field: "gameScorePlus", before: record.gameScorePlus, after: officialGameScorePlus });'),
  "canonical reconciliation must diff final line, optional GSv2 inputs, and GS+ corrections with explicit audit entries",
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
    !canonicalStore.includes('import os from "node:os";') &&
    !canonicalStore.includes('import fs from "node:fs/promises";') &&
    !canonicalStore.includes('import path from "node:path";') &&
    !canonicalStore.includes('const CANONICAL_START_STORE_DIR = path.join(process.cwd(), ".data", "canonical-starts");') &&
    !canonicalStore.includes('"toe-the-slab", "canonical-starts"') &&
    !canonicalStore.includes('path.join(process.cwd(), ".data", "canonical-starts")') &&
    !canonicalStore.includes("function shouldUseVolatileCanonicalStartStore()") &&
    !canonicalStore.includes("fs.readFile") &&
    !canonicalStore.includes("fs.writeFile") &&
    !canonicalStore.includes("fs.mkdir") &&
    !canonicalStore.includes("fs.rename") &&
    canonicalStore.includes('const NEXT_PRODUCTION_BUILD_PHASE = "phase-production-build";') &&
    canonicalStore.includes('const CANONICAL_STARTS_TABLE = "toetheslab_canonical_start_records";') &&
    canonicalStore.includes('const CANONICAL_SLATE_STATES_TABLE = "toetheslab_canonical_slate_states";') &&
    canonicalStore.includes("const volatileCanonicalStartStores = new Map<string, CanonicalStartStoreFile>();") &&
    canonicalStore.includes("export async function canonicalizeStartSummariesWithStore(") &&
    canonicalStore.includes("export async function readCanonicalStartRecords(") &&
    canonicalStore.includes("function upsertCanonicalStartRecord(") &&
    canonicalStore.includes("async function readCanonicalStartStore(") &&
    canonicalStore.includes("async function writeCanonicalStartStore(") &&
    canonicalStore.includes("async function readDurableCanonicalStartStore(") &&
    canonicalStore.includes("async function writeDurableCanonicalStartStore(") &&
    canonicalStore.includes("async function mergeWithLatestDurableRecords(") &&
    canonicalStore.includes("function canonicalStartRecordToRow(") &&
    canonicalStore.includes("function canonicalSlateCountsFromRecords(") &&
    canonicalStore.includes("cache: \"no-store\"") &&
    canonicalStore.includes("prefer: \"resolution=merge-duplicates\"") &&
    canonicalStore.includes("function assertCanonicalStartStoreDate(") &&
    canonicalStore.includes("if (!written) volatileCanonicalStartStores.set(store.date, store);") &&
    canonicalStore.includes("function emptyCanonicalStartStore(") &&
    canonicalStore.includes("process.env.NEXT_PHASE === NEXT_PRODUCTION_BUILD_PHASE") &&
    canonicalStore.includes("if (existing.frozen) {") &&
    canonicalStore.includes('if (next.status !== "final") return existing;') &&
    canonicalStore.includes("diffCanonicalStartRecord(existing, next.line, next.gameScorePlus)") &&
    canonicalStore.includes("reconcileCanonicalStartRecord(existing") &&
    canonicalStore.includes("officialCanonicalLineSource(next.source.line)"),
  "canonical start store must use Supabase durable records, skip static-build writes, preserve frozen finals, and audit final corrections without filesystem IO",
);

assert(
  supabaseSchema.includes("create table if not exists public.toetheslab_canonical_start_records") &&
    supabaseSchema.includes("primary key (date, start_id)") &&
    supabaseSchema.includes("record jsonb not null") &&
    supabaseSchema.includes("create table if not exists public.toetheslab_canonical_slate_states") &&
    supabaseSchema.includes("create table if not exists public.toetheslab_canonical_pitcher_season_aggregates") &&
    supabaseSchema.includes("toetheslab service canonical starts read") &&
    supabaseSchema.includes("toetheslab service canonical starts write") &&
    supabaseSchema.includes("toetheslab service canonical slate read") &&
    supabaseSchema.includes("toetheslab service canonical aggregates read"),
  "Supabase schema must document durable canonical start, slate-state, and pitcher season aggregate storage",
);

assert(
  warmLiveStartsCron.includes("export const maxDuration = 60;") &&
    warmLiveStartsCron.includes("const WARM_BATCH_SIZE = 8;") &&
    warmLiveStartsCron.includes('console.log("warm-live-starts start"') &&
    warmLiveStartsCron.includes('console.log("warm-live-starts batch warmed form leaderboards"') &&
    warmLiveStartsCron.includes('console.log("warm-live-starts end"') &&
    warmLiveStartsCron.includes("for (const batch of batchItems(slateTeams, WARM_BATCH_SIZE))") &&
    warmLiveStartsCron.includes("await warmFormLeaderboards({ teams: batch, includeGlobal: false });") &&
    formService.includes("includeGlobal?: boolean") &&
    formService.includes("const includeGlobal = options.includeGlobal ?? true;") &&
    formService.includes("if (includeGlobal) {"),
  "warm-live-starts cron must have an explicit duration budget, batched/idempotent warm work, and progress logs",
);

assert(
  startService.includes('import { canonicalizeStartSummaries, canonicalStartRecordFromSummary, deriveStartEventFlags, summarizeCanonicalReconciliation } from "@/lib/canonical-start-record";') &&
    startService.includes('import { canonicalizeStartSummariesWithStore, readCanonicalStartRecords } from "@/lib/data/canonical-start-store";') &&
    startService.includes("return canonicalizeStartSummaries(demoSlateStarts);") &&
    startService.includes("return canonicalizeStartSummariesWithStore(params.date, archivedStarts);") &&
    startService.includes("return canonicalizeStartSummariesWithStore(params.date, scheduledStarts.length > 0 ? scheduledStarts : demoSlateStarts);") &&
    startService.includes("const slateStarts = await canonicalizeStartSummariesWithStore(params.date, starts.length > 0 ? starts : demoSlateStarts);") &&
    startService.includes("return canonicalizeStartSummaries(archivedStarts") &&
    startService.includes("export async function getArchivedSeasonStartSummaries"),
  "daily slate and slate API must use the persisted canonical store while archived season summaries still pass through canonical normalization",
);

assert(
  startService.includes("export async function getCanonicalStartReconciliationReport(") &&
    startService.includes("const storedRecords = await readCanonicalStartRecords(date);") &&
    startService.includes("const records = storedRecords.length > 0 ? storedRecords : starts.map((start) => canonicalStartRecordFromSummary(start));") &&
    startService.includes("return summarizeCanonicalReconciliation(date, records);") &&
    archiveStatusRoute.includes("getCanonicalStartReconciliationReport") &&
    archiveStatusRoute.includes("export async function GET(request: Request)") &&
    archiveStatusRoute.includes('new URL(request.url).searchParams.get("date")') &&
    archiveStatusRoute.includes("canonicalReconciliation"),
  "archive status API must expose the canonical daily reconciliation report for a requested date",
);

assert(
  slateState.includes("export function summarizeCanonicalStartBuckets(starts: StartSummary[]): SlateStartBucketCounts") &&
    slateState.includes('if (start.source?.line === "archive-gamefeed") return "final";') &&
    slateState.includes('if (start.source?.line === "live-gamefeed") return "live";') &&
    slateState.includes('return "scheduled";') &&
    startService.includes('import { getSlateProgressState, summarizeCanonicalStartBuckets, type SlateProgressState } from "@/lib/slate-state";') &&
    startService.includes('const [slateStarts, liveSchedule, archivedSchedule] = await Promise.all([') &&
    startService.includes("const startCounts = summarizeCanonicalStartBuckets(slateStarts);") &&
    startService.includes("const totalStarts = startCounts.totalStarts;") &&
    startService.includes("const completedStarts = Math.min(totalStarts, startCounts.finalStarts);") &&
    startService.includes("liveStarts: startCounts.liveStarts,") &&
    startService.includes("warmingStarts: startCounts.warmingStarts,") &&
    startService.includes("scheduledStarts: startCounts.scheduledStarts,") &&
    startService.includes("delayStarts: startCounts.delayStarts,"),
  "ranked slate completion state must derive start counts from canonicalized start records",
);

console.log("canonical start record contract ok: start summaries pass through canonical score and line normalization");
