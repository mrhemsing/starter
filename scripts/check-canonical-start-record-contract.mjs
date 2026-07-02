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
const warmLiveStartsJob = await readFile("src/lib/data/warm-live-starts-job.ts", "utf8");
const runtimeStateStore = await readFile("src/lib/data/runtime-state-store.ts", "utf8");
const formService = await readFile("src/lib/data/form-service.ts", "utf8");

assert(
  canonicalRecord.includes('export type CanonicalStartStatus = "scheduled" | "live" | "final";') &&
    canonicalRecord.includes("export type CanonicalStartRecord = {") &&
    canonicalRecord.includes("line: StartLine;") &&
    canonicalRecord.includes("gameScorePlus: number;") &&
    canonicalRecord.includes("gameScorePlusBreakdown?: StartApiGameScorePlusBreakdown;") &&
    canonicalRecord.includes("contextSnapshot?: StartContext;") &&
    canonicalRecord.includes("frozen: boolean;") &&
    canonicalRecord.includes("audit: CanonicalStartAuditEntry[];") &&
    canonicalRecord.includes('event: "created" | "live-updated" | "final-reconciled" | "final-correction" | "context-freeze-sweep";') &&
    canonicalRecord.includes("export type CanonicalStartLineDiff = {"),
  "canonical start record must carry line, score, source, frozen state, and audit fields",
);

assert(
  canonicalRecord.includes('const final = source.line === "archive-gamefeed" || source.lineStatus === "final";') &&
    canonicalRecord.includes('const live = source.line === "live-gamefeed";') &&
    canonicalRecord.includes('status: final ? "final" : live ? "live" : "scheduled"') &&
    canonicalRecord.includes("finalizedAt: final ? timestamp : null") &&
    canonicalRecord.includes("frozen: final") &&
    canonicalRecord.includes('event: final ? "final-reconciled" : live ? "live-updated" : "created"') &&
    canonicalRecord.includes("Canonical record reflects a provisional live starter line."),
  "canonical start record must freeze archive finals or starter-final live lines while keeping active gamefeed lines provisional",
);

assert(
  canonicalRecord.includes("roundToScorePrecision(start.gameScorePlus, SCORE_DISPLAY_PRECISION.gameScorePlus)") &&
    canonicalRecord.includes("gameScorePlusBreakdown: start.gameScorePlusBreakdown ? freezeGameScorePlusBreakdown(start.gameScorePlusBreakdown, gameScorePlus, final) : undefined") &&
    canonicalRecord.includes("contextSnapshot: final ? freezeStartContextSnapshot(start.context) : undefined") &&
    canonicalRecord.includes("function freezeStartContextSnapshot(context: StartContext): StartContext") &&
    canonicalRecord.includes("function freezeGameScorePlusBreakdown(") &&
    canonicalRecord.includes("function labelContextAtSettle(value: string)") &&
    canonicalRecord.includes("Context at settle."),
  "canonical start record must apply shared GS+ display precision, freeze context snapshots, and keep breakdown totals aligned",
);

assert(
  canonicalRecord.includes("export function reconcileCanonicalStartRecord(") &&
    canonicalRecord.includes("const gameScoreV2 = official.gameScoreV2 ?? calculateGameScoreV2(official.line);") &&
    canonicalRecord.includes("const result = official.result ?? record.result;") &&
    canonicalRecord.includes("const venue = safeCanonicalVenue(official.venue) ?? record.venue;") &&
    canonicalRecord.includes("const contextSnapshot = official.contextSnapshot ?? record.contextSnapshot;") &&
    canonicalRecord.includes("const diffs = diffCanonicalStartRecord(record, official.line, gameScorePlus, gameScoreV2, result, venue);") &&
    canonicalRecord.includes("gameScorePlusBreakdown: official.gameScorePlusBreakdown ? freezeGameScorePlusBreakdown(official.gameScorePlusBreakdown, gameScorePlus, true) : record.gameScorePlusBreakdown") &&
    canonicalRecord.includes("contextSnapshot: contextSnapshot ? freezeStartContextSnapshot(contextSnapshot) : record.contextSnapshot") &&
    canonicalRecord.includes('event: record.frozen && diffs.length > 0 ? "final-correction" : "final-reconciled"') &&
    canonicalRecord.includes("...(diffs.length > 0 ? { diffs } : {})") &&
    canonicalRecord.includes("export function diffCanonicalStartRecord(") &&
    canonicalRecord.includes('const fields: Array<keyof StartLine> = ["inningsPitched", "hits", "earnedRuns", "runsAllowed", "homeRunsAllowed", "walks", "strikeouts", "pitches"];') &&
    canonicalRecord.includes("if (record.line[field] === undefined && officialLine[field] === undefined) continue;") &&
    canonicalRecord.includes('diffs.push({ field: "gameScorePlus", before: record.gameScorePlus, after: officialGameScorePlus });'),
  "canonical reconciliation must diff final line, optional GSv2 inputs, and GS+ corrections with explicit audit entries",
);

assert(
  canonicalRecord.includes('field: keyof StartLine | "gameScorePlus" | "gameScoreV2" | "result" | "venue";') &&
    canonicalRecord.includes("if (record.gameScoreV2 !== officialGameScoreV2)") &&
    canonicalRecord.includes('diffs.push({ field: "gameScoreV2", before: record.gameScoreV2, after: officialGameScoreV2 });') &&
    canonicalRecord.includes('diffs.push({ field: "result", before: record.result, after: officialResult });') &&
    canonicalRecord.includes('diffs.push({ field: "venue", before: record.venue, after: officialVenue });') &&
    canonicalRecord.includes("function safeCanonicalVenue") &&
    canonicalRecord.includes('/\\b(canonical|slate|fixture)\\b/i.test(trimmed)'),
  "canonical reconciliation must validate GSv2, decision, and venue while blocking source metadata from venue fields",
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
    canonicalStore.includes('const ALLOW_VOLATILE_CANONICAL_START_STORE = "THE_BUMP_ALLOW_VOLATILE_CANONICAL_STORE";') &&
    canonicalStore.includes("const volatileCanonicalStartStores = new Map<string, CanonicalStartStoreFile>();") &&
    canonicalStore.includes("assertCanonicalStartStoreDeploymentConfig();") &&
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
    canonicalStore.includes("const CANONICAL_STORE_READ_TIMEOUT_MS = 2_500;") &&
    canonicalStore.includes("const CANONICAL_STORE_WRITE_TIMEOUT_MS = 5_000;") &&
    canonicalStore.includes("const CANONICAL_STORE_WRITE_FAILURE_LIMIT = 3;") &&
    canonicalStore.includes("return emptyCanonicalStartStore(date);") &&
    canonicalStore.includes("async function retryCanonicalStoreWrite(") &&
    canonicalStore.includes("async function timedCanonicalStoreFetch(") &&
    canonicalStore.includes('console.warn("[canonical-store] slow-or-failed query"') &&
    canonicalStore.includes('console.error("[canonical-store] write circuit opened"') &&
    canonicalStore.includes('console.warn("[canonical-store] write circuit open; deferring canonical write"') &&
    canonicalStore.includes("if (canUseVolatileCanonicalStartStore())") &&
    canonicalStore.includes("function assertCanonicalStartStoreDeploymentConfig()") &&
    canonicalStore.includes("function failOrBypassMissingDurableCanonicalStore(") &&
    canonicalStore.includes("function canUseVolatileCanonicalStartStore()") &&
    canonicalStore.includes("function isDeployedCanonicalStoreRuntime()") &&
    canonicalStore.includes('process.env[ALLOW_VOLATILE_CANONICAL_START_STORE] === "1"') &&
    canonicalStore.includes('process.env.VERCEL_ENV === "production"') &&
    canonicalStore.includes('process.env.VERCEL_ENV === "preview"') &&
    canonicalStore.includes('process.env.VERCEL === "1"') &&
    canonicalStore.includes("Canonical start store requires Supabase URL and service role key in production/preview deployments") &&
    canonicalStore.includes("function emptyCanonicalStartStore(") &&
    canonicalStore.includes("process.env.NEXT_PHASE === NEXT_PRODUCTION_BUILD_PHASE") &&
    canonicalStore.includes("if (existing.frozen) {") &&
    canonicalStore.includes('if (next.status !== "final") return existing;') &&
    canonicalStore.includes("diffCanonicalStartRecord(existing, next.line, next.gameScorePlus, next.gameScoreV2, next.result, next.venue)") &&
    canonicalStore.includes("existing.source.lineStatus !== next.source.lineStatus") &&
    canonicalStore.includes("result: next.result") &&
    canonicalStore.includes("venue: next.venue") &&
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
    supabaseSchema.includes("create table if not exists public.toetheslab_runtime_state") &&
    supabaseSchema.includes("toetheslab service canonical starts read") &&
    supabaseSchema.includes("toetheslab service canonical starts write") &&
    supabaseSchema.includes("toetheslab service canonical slate read") &&
    supabaseSchema.includes("toetheslab service canonical aggregates read") &&
    supabaseSchema.includes("toetheslab service runtime state read") &&
    supabaseSchema.includes("toetheslab service runtime state write"),
  "Supabase schema must document durable canonical start, slate-state, pitcher aggregate, and runtime state storage",
);

assert(
  warmLiveStartsCron.includes("export const maxDuration = 60;") &&
    warmLiveStartsCron.includes('import { runWarmLiveStartsJob } from "@/lib/data/warm-live-starts-job";') &&
    warmLiveStartsCron.includes('const date = !process.env.VERCEL_ENV ? new URL(request.url).searchParams.get("date") ?? undefined : undefined;') &&
    warmLiveStartsCron.includes("const result = await runWarmLiveStartsJob({ date, revalidatePath, revalidateTag });") &&
    warmLiveStartsJob.includes('import { readRuntimeState, writeRuntimeState } from "@/lib/data/runtime-state-store";') &&
    warmLiveStartsJob.includes('import { getSupabaseArchiveStatus } from "@/lib/data/supabase-archive";') &&
    warmLiveStartsJob.includes("export const WARM_LIVE_STARTS_BATCH_SIZE = 8;") &&
    warmLiveStartsJob.includes('const WARM_TEAM_FORM_ON_CRON_FLAG = "THE_BUMP_WARM_TEAM_FORM_ON_CRON";') &&
    warmLiveStartsJob.includes('reason?: "no-live-or-final-games" | "archive-gap" | "already-running";') &&
    warmLiveStartsJob.includes("getSupabaseArchiveStatus(date.slice(0, 4), { expectedLastCompletedDate: addDays(getHomeSlateDate(), -1) })") &&
    warmLiveStartsJob.includes('console.error("warm-live-starts archive gap detected; deferring to archive job"') &&
    warmLiveStartsJob.includes("const lockKey = warmLiveStartsLockKey(date);") &&
    warmLiveStartsJob.includes("const lock = await acquireWarmLiveStartsLock(lockKey);") &&
    warmLiveStartsJob.includes('console.warn("warm-live-starts overlap lock active; exiting"') &&
    warmLiveStartsJob.includes('reason: "already-running"') &&
    warmLiveStartsJob.includes("await releaseWarmLiveStartsLock(lockKey);") &&
    warmLiveStartsJob.includes('console.log("warm-live-starts start"') &&
    warmLiveStartsJob.includes("const progressKey = warmLiveStartsProgressKey(date, completion.finalGames, completedStarts.length);") &&
    warmLiveStartsJob.includes("const progress = await readWarmLiveStartsProgress(progressKey);") &&
    warmLiveStartsJob.includes('await markWarmStepComplete(progressKey, progress, "revalidate-tags");') &&
    warmLiveStartsJob.includes("await markWarmStepComplete(progressKey, progress, batchKey);") &&
    warmLiveStartsJob.includes('console.log("warm-live-starts batch warmed form leaderboards"') &&
    warmLiveStartsJob.includes('console.log("warm-live-starts batch revalidated pitcher forms"') &&
    warmLiveStartsJob.includes('console.log("warm-live-starts team form warming deferred"') &&
    warmLiveStartsJob.includes('console.log("warm-live-starts end"') &&
    warmLiveStartsJob.includes("for (const batch of batchItems(slateTeams, WARM_LIVE_STARTS_BATCH_SIZE))") &&
    warmLiveStartsJob.includes("await warmFormLeaderboards({ teams: batch, includeGlobal: false });") &&
    warmLiveStartsJob.includes("async function readWarmLiveStartsProgress(key: string): Promise<WarmLiveStartsProgress>") &&
    warmLiveStartsJob.includes("function warmLiveStartsProgressKey(date: string, finalGames: number, completedStarts: number)") &&
    warmLiveStartsJob.includes("async function acquireWarmLiveStartsLock(key: string)") &&
    warmLiveStartsJob.includes("function warmLiveStartsLockKey(date: string)") &&
    warmLiveStartsJob.includes("function shouldWarmTeamFormOnCron()") &&
    warmLiveStartsJob.includes("if (!process.env.VERCEL_ENV && dateOverride && /^\\d{4}-\\d{2}-\\d{2}$/.test(dateOverride)) return dateOverride;") &&
    runtimeStateStore.includes('const RUNTIME_STATE_TABLE = "toetheslab_runtime_state";') &&
    runtimeStateStore.includes("export async function readRuntimeState") &&
    runtimeStateStore.includes("export async function writeRuntimeState") &&
    runtimeStateStore.includes("prefer: \"resolution=merge-duplicates\"") &&
    formService.includes("includeGlobal?: boolean") &&
    formService.includes("const includeGlobal = options.includeGlobal ?? true;") &&
    formService.includes("if (includeGlobal) {"),
  "warm-live-starts cron must have an explicit duration budget, durable progress, archive-gap deferral, batched/idempotent warm work, and progress logs",
);

assert(
  startService.includes('import { canonicalizeStartSummaries, canonicalStartRecordFromSummary, deriveStartEventFlags, summarizeCanonicalReconciliation } from "@/lib/canonical-start-record";') &&
    startService.includes('import { canonicalizeStartSummariesWithStore, readCanonicalizedStartSummaries, readCanonicalStartRecords } from "@/lib/data/canonical-start-store";') &&
    startService.includes("return canonicalizeStartSummaries(demoSlateStarts);") &&
    startService.includes("if (archivedStarts.length > 0 && shouldUseArchivedSlateForDate(params.date)) return archivedStarts;") &&
    startService.includes("persistCanonical?: boolean;") &&
    startService.includes("return canonicalizeDailySlateStarts(params.date, scheduledStarts.length > 0 ? scheduledStarts : demoSlateStarts, params.persistCanonical === true);") &&
    startService.includes("const slateStarts = await readCanonicalizedStartSummaries(params.date, starts.length > 0 ? starts : demoSlateStarts);") &&
    startService.includes("function canonicalizeDailySlateStarts(date: string, starts: StartSummary[], persistCanonical: boolean)") &&
    warmLiveStartsJob.includes('const starts = await getDailySlate({ window: "today", date, persistCanonical: true });') &&
    startService.includes("return readCanonicalizedStartSummaries(date, starts);") &&
    startService.includes("export async function getArchivedSeasonStartSummaries"),
  "daily slate and slate API must default to read-only canonical state while the warm pipeline opts into canonical writes explicitly",
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
    slateState.includes('if (start.source?.line === "live-gamefeed" && start.source.lineStatus === "final") return "final";') &&
    slateState.includes('if (start.source?.line === "live-gamefeed") return "live";') &&
    slateState.includes('return "scheduled";') &&
    startService.includes('import { getSlateProgressState, summarizeCanonicalStartBuckets, type SlateProgressState } from "@/lib/slate-state";') &&
    startService.includes("export function getRankedSlateCompletionStateFromInputs(") &&
    startService.includes("getRankedSlateContextForStarts(date, today, [])") &&
    startService.includes("const startCounts = summarizeCanonicalStartBuckets(slateStarts);") &&
    startService.includes("const totalStarts = startCounts.totalStarts;") &&
    startService.includes("const completedStarts = Math.min(totalStarts, startCounts.finalStarts);") &&
    startService.includes("const liveGames = countableGames.filter(isLiveGameState).length;") &&
    startService.includes("const completedStartsInFinalGames = finalGames * 2;") &&
    startService.includes("const completedStartsInLiveGames = Math.min(liveGames * 2, Math.max(0, completedStarts - completedStartsInFinalGames));") &&
    startService.includes("const liveStarts = Math.max(0, liveGames * 2 - completedStartsInLiveGames);") &&
    startService.includes("liveStarts,") &&
    startService.includes("warmingStarts: startCounts.warmingStarts,") &&
    startService.includes("scheduledStarts: startCounts.scheduledStarts,") &&
    startService.includes("delayStarts: startCounts.delayStarts,"),
  "ranked slate completion state must derive start counts from canonicalized start records",
);

console.log("canonical start record contract ok: start summaries pass through canonical score and line normalization");
