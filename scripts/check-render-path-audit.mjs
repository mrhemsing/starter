import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function read(path) {
  return await readFile(path, "utf8");
}

const directUpstreamImports = [
  "@/lib/data/mlb-stats-client",
  "@/lib/data/baseball-savant-client",
  "@/lib/data/odds-client",
  "@/lib/data/run-environment",
];

const idlePagePaths = [
  "src/app/page.tsx",
  "src/app/starts/[id]/page.tsx",
  "src/app/form/page.tsx",
  "src/app/heat-check/page.tsx",
  "src/app/heat-check/season/page.tsx",
  "src/app/upcoming/page.tsx",
  "src/app/upcoming/[date]/page.tsx",
];

for (const path of idlePagePaths) {
  const source = await read(path);
  for (const importPath of directUpstreamImports) {
    assert(!source.includes(importPath), `${path} must not import upstream client ${importPath} directly`);
  }
}

const [formService, tonightService, rankedStartsPageService, startService, warmLiveStartsCron, warmLiveStartsJob, supabaseArchive, sitePerformanceContract, packageJson] = await Promise.all([
  read("src/lib/data/form-service.ts"),
  read("src/lib/data/tonight-service.ts"),
  read("src/lib/data/ranked-starts-page-service.ts"),
  read("src/lib/data/start-service.ts"),
  read("src/app/api/cron/warm-live-starts/route.ts"),
  read("src/lib/data/warm-live-starts-job.ts"),
  read("src/lib/data/supabase-archive.ts"),
  read("scripts/check-site-performance-contract.mjs"),
  read("package.json"),
]);

assert(
  formService.includes("const RECENT_FORM_CANONICAL_GAP_LIMIT_DAYS = 14;") &&
    formService.includes("readRecentCanonicalFormSlate") &&
    formService.includes("readCanonicalStartRecords(date)") &&
    formService.includes("evaluateFormFreshness({ formThroughDate, latestScoredStartDate })") &&
    !formService.includes('import { getArchivedSeasonStartSummaries, getDailySlate') &&
    !formService.includes("dates.map((date) => getDailySlate"),
  "Heat Check form render must use a bounded recent canonical fold-in and read canonical rows, never rebuild slates in page render",
);

assert(
  tonightService.includes('const REQUEST_TIME_ENRICHMENT_FLAG = "THE_BUMP_REQUEST_TIME_ENRICHMENT";') &&
    tonightService.includes("const enrichAtRequestTime = isRequestTimeEnrichmentEnabled();") &&
    tonightService.includes("shouldFetchOpponentSplits ? fetchMlbTeamHandednessSplitContexts") &&
    tonightService.includes("enrichAtRequestTime ? fetchMlbOddsMarketContexts") &&
    tonightService.includes("const weatherContext = await getGameTimeWeather(game.venue, game.gameDate);"),
  "Upcoming request-time MLB/Odds enrichments must remain behind the explicit enrichment flag while cached Open-Meteo weather may load",
);

assert(
  rankedStartsPageService.includes("withCanonicalStoreDiagnostics") &&
    rankedStartsPageService.includes("[ranked-starts-render]") &&
    rankedStartsPageService.includes("canonicalWrites: diagnostics.writes") &&
    rankedStartsPageService.includes("canonicalRowsWritten: diagnostics.rowsWritten"),
  "Ranked Starts render must keep canonical store diagnostics until the P1-5 timing gate clears",
);

const getDailySlateSource = startService.slice(
  startService.indexOf("export async function getDailySlate"),
  startService.indexOf("export async function getCanonicalStartReconciliationReport"),
);
assert(
  getDailySlateSource.includes("const archivedStarts = await getArchivedSlateStarts(params.date);") &&
    getDailySlateSource.indexOf("if (archivedStarts.length > 0 && shouldUseArchivedSlateForDate(params.date)) return archivedStarts;") <
      getDailySlateSource.indexOf("const schedule = await fetchMlbSchedule(params.date"),
  "settled getDailySlate render path must return archive rows before any upstream schedule fetch",
);

const rankedSlateContextSource = startService.slice(
  startService.indexOf("export async function getRankedSlateContextForStarts"),
  startService.indexOf("export function getRankedSlateCompletionStateFromInputs"),
);
assert(
  rankedSlateContextSource.includes("const settled = date < today;") &&
    rankedSlateContextSource.includes("readArchivedSchedule(date)") &&
    rankedSlateContextSource.includes("readCanonicalSlateState(date)") &&
    rankedSlateContextSource.includes("fetchMlbSchedule(date, { fetchLive: shouldFetchLiveSchedule(date) })") &&
    rankedSlateContextSource.indexOf("const [liveSchedule, archivedSchedule, canonicalSlateState] = settled") <
      rankedSlateContextSource.indexOf("fetchMlbSchedule(date, { fetchLive: shouldFetchLiveSchedule(date) })"),
  "settled ranked slate context must prefer stored archive/canonical state and avoid render-time upstream schedule fetches",
);

assert(
  startService.includes("const expectedTotalStarts = canonicalSlateState?.counts.totalStarts ?? totalGames * 2;") &&
    startService.includes("const totalStarts = isFinal ? startCounts.totalStarts : Math.max(startCounts.totalStarts, expectedTotalStarts);") &&
    !startService.includes("const totalStarts = totalGames * 2;"),
  "ranked visible completion counts must be coupled to rendered start rows, with schedule/canonical totals used only as expectations",
);

assert(
  rankedStartsPageService.includes("[ranked-starts-render] rebuild returned fewer starts than cached page; serving cached floor") &&
    rankedStartsPageService.includes("if (countRankedPageStarts(rebuiltData) < countRankedPageStarts(cachedData))") &&
    rankedStartsPageService.includes("[ranked-starts-render] rebuild failed; serving cached floor"),
  "Ranked Starts final cache validator must never replace a cached page with a smaller rebuilt dataset",
);

assert(
  warmLiveStartsCron.includes("runWarmLiveStartsJob({ date, revalidatePath, revalidateTag })") || warmLiveStartsCron.includes("runWarmLiveStartsJob({ date, revalidatePath, revalidateTag });")
    ? warmLiveStartsJob.includes("await warmFormLeaderboards();") &&
      warmLiveStartsJob.includes("warm-live-starts batch warmed global form leaderboards") &&
      warmLiveStartsJob.includes("warm-live-starts archive gap detected; continuing canonical settle/revalidation path") &&
      warmLiveStartsJob.includes("await warmFormLeaderboards({ teams: batch, includeGlobal: false });") &&
      warmLiveStartsJob.includes("for (const tag of DATA_CHANGE_CACHE_TAGS)") &&
      warmLiveStartsJob.includes('options.revalidateTag?.(tag, "max");')
    : false,
  "warm-live-starts cron must warm global and team Heat Check variants after data-change revalidation",
);

assert(
  supabaseArchive.includes("ARCHIVE_FRESHNESS_MAX_LAG_DAYS = 2") &&
    supabaseArchive.includes("[supabase-archive] archive freshness lag exceeds threshold") &&
    supabaseArchive.includes("freshness: archiveFreshness"),
  "Supabase archive must keep a production-visible freshness monitor",
);

assert(
  sitePerformanceContract.includes("Supabase archive status must expose freshness lag and any complete-slate archive gap") &&
    packageJson.includes('"check:render-path-audit": "node scripts/check-render-path-audit.mjs"'),
  "render-path audit must be runnable and referenced by source contracts",
);

console.log("render path audit passed: idle pages avoid direct upstream clients and service-level gates are pinned");
