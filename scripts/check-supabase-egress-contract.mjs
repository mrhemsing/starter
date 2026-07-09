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
] = await Promise.all([
  read("src/lib/data/runtime-state-store.ts"),
  read("src/lib/data/mlb-stats-client.ts"),
  read("src/lib/data/supabase-archive.ts"),
  read("src/lib/data/start-service.ts"),
  read("vercel.json"),
  read("package.json"),
]);

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
    !supabaseArchive.includes('String(filters.select ?? "*")') &&
    !supabaseArchive.includes('select", "*"'),
  "mlb_completed_starts reads must be column-scoped, date/range-filtered, and cached",
);

assert(
  startService.includes("const getCachedArchivedSlateStarts = unstable_cache(") &&
    startService.includes("const getCachedArchivedSeasonRangeStartSummaries = unstable_cache(") &&
    startService.includes("const ranges = seasonHalfMonthRanges(season);") &&
    startService.includes("Promise.all(ranges.map((range) => getCachedArchivedSeasonRangeStartSummaries(range.startDate, range.endDate)))") &&
    startService.includes("readSupabaseArchivedCompletedStartsRange(startDate, endDate)") &&
    startService.includes("function seasonHalfMonthRanges(season: string)"),
  "completed-starts archive working sets must be read once per cached slate/range pass and reused",
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
