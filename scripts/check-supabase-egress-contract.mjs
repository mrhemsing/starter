import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function read(path) {
  return await readFile(path, "utf8");
}

const [
  runtimeStateStore,
  mlbStatsClient,
  supabaseArchive,
  startService,
  vercelConfig,
  packageJson,
  warmLiveStartsCron,
  productionPrewarmer,
  slateSyncCron,
  settledSlateIntegrity,
  canonicalStartStore,
] = await Promise.all([
  read("src/lib/data/runtime-state-store.ts"),
  read("src/lib/data/mlb-stats-client.ts"),
  read("src/lib/data/supabase-archive.ts"),
  read("src/lib/data/start-service.ts"),
  read("vercel.json"),
  read("package.json"),
  read("src/app/api/cron/warm-live-starts/route.ts"),
  read("src/lib/data/production-path-prewarmer.ts"),
  read("src/app/api/cron/slate-sync/route.ts"),
  read("src/lib/data/settled-slate-integrity.ts"),
  read("src/lib/data/canonical-start-store.ts"),
]);

assert(
  warmLiveStartsCron.includes("const cheapState = await readCheapSlateState(date);") &&
    warmLiveStartsCron.indexOf('prewarmMode: "debounced"') < warmLiveStartsCron.indexOf("const result = await runWarmLiveStartsJob") &&
    warmLiveStartsCron.includes("shouldDebounceWarmLiveStarts(cheapState.liveGames, cheapState.finalizedGameSignature, finalizedObservation?.finalizedGameSignature)") &&
    warmLiveStartsCron.includes("return liveGames === 0 && finalizedGameSignature === observedSignature") &&
    warmLiveStartsCron.includes("const finalizedObservationKey = `warm-live-starts:finalized:${date}`") &&
    warmLiveStartsCron.includes("if (!finalizedObservation?.finalizedGameSignature)") &&
    warmLiveStartsCron.includes("finalizedGameObservedAt: new Date().toISOString()") &&
    warmLiveStartsCron.indexOf("if (cheapState.liveGames === 0)") < warmLiveStartsCron.indexOf("const deploymentStateKey") &&
    !warmLiveStartsCron.includes("observedFinalizedGameSignatures") &&
    warmLiveStartsCron.includes("buildFinalizedGameSignature(date, finalizedGameIds)") &&
    warmLiveStartsCron.includes("supabaseReads: 0") &&
    !warmLiveStartsCron.includes("logRecentSettledSlateGaps") &&
    warmLiveStartsCron.includes("RECONCILIATION_PREWARM_MIN_INTERVAL_MS") &&
    warmLiveStartsCron.includes("INCREMENTAL_PREWARM_MIN_INTERVAL_MS") &&
    warmLiveStartsCron.includes("incrementalIntervalElapsed && (cheapState.liveGames > 0 || hasNewFinalizedStarts)") &&
    productionPrewarmer.includes("finalizedStartSignature(starts.map((start) => start.id))") &&
    !productionPrewarmer.includes("`${start.id}:${start.gameScorePlus}`") &&
    slateSyncCron.includes("getSupabaseArchiveStatus") &&
    slateSyncCron.includes("logRecentSettledSlateGaps") &&
    settledSlateIntegrity.includes("readCanonicalSlateCounts(date)") &&
    settledSlateIntegrity.includes("canonicalState?.finalStarts ?? 0") &&
    canonicalStartStore.includes('url.searchParams.set("select", "date,counts")') &&
    !settledSlateIntegrity.includes("getRankedSlateCompletionState") &&
    !settledSlateIntegrity.includes("readCanonicalStartRecords") &&
    !warmLiveStartsCron.includes("getSupabaseArchiveStatus"),
  "minute reconciliation must debounce before heavy work, warm only on live/new-final activity, and leave count-only integrity checks to hourly slate-sync",
);

let durableState = null;
let heavySupabaseReads = 0;
for (let invocation = 0; invocation < 10; invocation += 1) {
  const freshModuleState = new Map();
  const liveGames = 0;
  const currentFinalizedSignature = "2026-08-09:823500|823501";
  let debounced = liveGames === 0 && currentFinalizedSignature === durableState?.finalizedGameSignature;
  if (!debounced && liveGames === 0) {
    durableState = { finalizedGameSignature: currentFinalizedSignature, finalizedGameObservedAt: new Date().toISOString() };
    debounced = true;
  }
  if (!debounced) heavySupabaseReads += 1;
  assert(freshModuleState.size === 0, "cold-start fixture must not share process-local observations");
  assert(debounced, `quiet final-slate invocation ${invocation + 1} must debounce`);
}
assert(durableState?.finalizedGameSignature === "2026-08-09:823500|823501", "first cold invocation must durably pin the finalized signature");
assert(heavySupabaseReads === 0, "ten cold quiet invocations must trigger zero heavy Supabase reads");

assert(
  runtimeStateStore.includes("export async function readRuntimeStates") &&
    runtimeStateStore.includes('url.searchParams.set("key", `in.(${uniqueKeys.map(quotePostgrestValue).join(",")})`);') &&
    runtimeStateStore.includes('url.searchParams.set("select", "key,value");') &&
    runtimeStateStore.includes("export async function writeRuntimeStates") &&
    runtimeStateStore.includes("body: JSON.stringify(uniqueRows.map((row) => ({") &&
    runtimeStateStore.includes('prefer: "resolution=merge-duplicates"') &&
    runtimeStateStore.includes("function uniqueRuntimeStateRows") &&
    runtimeStateStore.includes("function quotePostgrestValue"),
  "runtime_state store must expose batched key=in reads and bulk upserts",
);

assert(
  mlbStatsClient.includes('import { readRuntimeStates, writeRuntimeStates } from "@/lib/data/runtime-state-store";') &&
    mlbStatsClient.includes("const previousStates = await readRuntimeStates<ProbableConfidenceState>(stateKeys);") &&
    mlbStatsClient.includes("if (previousConfidence === nextConfidence) continue;") &&
    mlbStatsClient.includes("await writeRuntimeStates(changedRows);") &&
    mlbStatsClient.includes('[probable-confidence] runtime-state batch') &&
    mlbStatsClient.includes("readRequests: stateKeys.length > 0 ? 1 : 0") &&
    mlbStatsClient.includes("writeRequests: changedRows.length > 0 ? 1 : 0") &&
    mlbStatsClient.includes('[probable-confidence] runtime-state slot count exceeded guardrail') &&
    !mlbStatsClient.includes("readProbableConfidenceState") &&
    !mlbStatsClient.includes("writeProbableConfidenceState"),
  "probable-confidence transitions must batch runtime_state access and diff before write",
);

assert(
  supabaseArchive.includes('const COMPLETED_STARTS_SELECT = "date,game_pk,game_date,venue,away_team,home_team,pitcher_mlb_id,pitcher_name,team,opponent,side,result,line";') &&
    supabaseArchive.includes("select: COMPLETED_STARTS_SELECT") &&
    supabaseArchive.includes("date: `eq.${date}`") &&
    supabaseArchive.includes("date: [`gte.${startDate}`, `lte.${endDate}`]") &&
    supabaseArchive.includes("SUPABASE_ARCHIVE_REVALIDATE_SECONDS = 15 * 60") &&
    supabaseArchive.includes('[supabase-egress] archive fetch cache observation') &&
    !supabaseArchive.includes('String(filters.select ?? "*")') &&
    !supabaseArchive.includes('select", "*"'),
  "mlb_completed_starts reads must be column-scoped, date/range-filtered, and cached",
);

assert(
  startService.includes("const getCachedArchivedSlateStarts = unstable_cache(") &&
    startService.includes("const getCachedArchivedSeasonStartSummaries = unstable_cache(") &&
    startService.includes("buildArchivedSeasonRangeStartSummaries(`${season}-01-01`, `${season}-12-31`)") &&
    startService.includes("return getCachedArchivedSeasonStartSummaries(season)") &&
    startService.includes("readSupabaseArchivedCompletedStartsRange(startDate, endDate)") &&
    !startService.includes("seasonHalfMonthRanges") &&
    !startService.includes("Promise.all(ranges.map"),
  "completed-starts archive season working set must use one cached range query",
);

assert(
  vercelConfig.includes('"/api/cron/warm-live-starts"') &&
    vercelConfig.includes('"/api/cron/upcoming-writeups"') &&
    vercelConfig.includes('"/api/cron/fantasy-streaming-read"') &&
    vercelConfig.includes('"/api/cron/home-gs-plus-proofs"') &&
    !vercelConfig.includes("backfill") &&
    !vercelConfig.includes("recap") &&
    !vercelConfig.includes("fact-packet"),
  "scheduled crons must not include recurring one-time backfill jobs",
);

assert(
  packageJson.includes('"check:supabase-egress": "node scripts/check-supabase-egress-contract.mjs"'),
  "package.json must expose check:supabase-egress",
);

console.log("supabase egress contract ok: runtime_state batching, diff-before-write, archive scoping, and cron schedule guards are pinned");
