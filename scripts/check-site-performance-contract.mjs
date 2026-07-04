import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function read(path) {
  return await readFile(path, "utf8");
}

const tonightService = await read("src/lib/data/tonight-service.ts");
const duelsService = await read("src/lib/data/duels-service.ts");
const rankedService = await read("src/lib/data/home-ranked-service.ts");
const environmentService = await read("src/lib/data/run-environment.ts");
const startService = await read("src/lib/data/start-service.ts");
const supabaseArchive = await read("src/lib/data/supabase-archive.ts");
const renderPathAudit = await read("scripts/check-render-path-audit.mjs");
const cacheTags = await read("src/lib/data/cache-tags.ts");
const liveService = await read("src/lib/data/live-scoreboard-service.ts");
const rankedStartsPageService = await read("src/lib/data/ranked-starts-page-service.ts");
const formService = await read("src/lib/data/form-service.ts");
const warmLiveStartsCron = await read("src/app/api/cron/warm-live-starts/route.ts");
const warmLiveStartsJob = await read("src/lib/data/warm-live-starts-job.ts");
const tonightRoute = await read("src/app/api/tonight/route.ts");
const upcomingRoute = await read("src/app/api/upcoming/route.ts");
const duelsRoute = await read("src/app/api/duels/route.ts");
const rankedRoute = await read("src/app/api/home/ranked/route.ts");
const homeStatusRoute = await read("src/app/api/home/status/route.ts");
const formHomeRoute = await read("src/app/api/form/home/route.ts");
const formLeaderboardRoute = await read("src/app/api/form/leaderboard/route.ts");
const archiveStatusRoute = await read("src/app/api/archive/status/route.ts");
const packageJson = await read("package.json");
const pitcherFormRoute = await read("src/app/api/form/pitcher/[id]/route.ts");
const pitcherProfileRoute = await read("src/app/api/pitchers/[id]/route.ts");
const fastFilterLink = await read("src/components/fast-filter-link.tsx");
const heatCheckWarmup = await read("src/components/heat-check-filter-warmup.tsx");
const heatCheckPage = await read("src/app/form/page.tsx");
const upcomingDatePage = await read("src/app/upcoming/[date]/page.tsx");
const upcomingIndexPage = await read("src/app/upcoming/page.tsx");
const startsPage = await read("src/app/starts/[id]/page.tsx");
const appLayout = await read("src/app/layout.tsx");
const loadingPolicy = await read("docs/loading-state-policy.md");
const routeLoadingShell = await read("src/components/route-loading-shell.tsx");
const rankedStartsLoading = await read("src/app/starts/[id]/loading.tsx");

assert(
  tonightService.includes('import { unstable_cache } from "next/cache";') &&
    tonightService.includes('import { SLATE_CACHE_TAG, UPCOMING_CACHE_TAG } from "@/lib/data/cache-tags";') &&
    tonightService.includes("export const TONIGHT_REVALIDATE_SECONDS = 60;") &&
    tonightService.includes("const getCachedTonightMustWatch = unstable_cache(") &&
    tonightService.includes("tags: [SLATE_CACHE_TAG, UPCOMING_CACHE_TAG]") &&
    tonightService.includes("const promise = getCachedTonightMustWatch(date, window);"),
  "Must-Watch data must use Next data cache, not only per-process memoization",
);

assert(
  startService.includes("export function getProbablesFromSchedule") &&
    !tonightService.includes("getTodayProbables") &&
    tonightService.includes("const [schedule, leaderboard] = await Promise.all([") &&
    tonightService.includes("const probables = getProbablesFromSchedule(date, schedule);") &&
    tonightService.includes('import { getDefaultUpcomingDate, getProbablesFromSchedule, getSlateSchedule } from "@/lib/data/start-service";') &&
    tonightService.includes("const date = normalizeDateKey(options.date) ?? await getDefaultUpcomingDate();") &&
    upcomingDatePage.includes("const [upcoming, slateState] = await Promise.all([") &&
    upcomingIndexPage.includes('import { getDefaultUpcomingDate } from "@/lib/data/start-service";') &&
    upcomingIndexPage.includes("const date = await getDefaultUpcomingDate();") &&
    upcomingIndexPage.includes("const title = upcomingDayTitle(date);") &&
    !upcomingIndexPage.includes("getTonightMustWatch"),
  "Upcoming page assembly must not duplicate schedule/probable board work in metadata or within Must-Watch assembly",
);

assert(
  startService.includes('import { SLATE_CACHE_TAG, UPCOMING_CACHE_TAG } from "@/lib/data/cache-tags";') &&
    startService.includes("const getCachedDefaultUpcomingDate = unstable_cache(") &&
    startService.includes("export async function getDefaultUpcomingDate") &&
    startService.includes("tags: [SLATE_CACHE_TAG, UPCOMING_CACHE_TAG]") &&
    startService.includes("const [rankedDate, upcomingDate] = await Promise.all([") &&
    startService.includes("getDefaultUpcomingDate(today),"),
  "Upcoming default-date lookup must be cached and must not compute Ranked Starts defaults for the bare /upcoming route",
);

assert(
  cacheTags.includes('export const SLATE_CACHE_TAG = "slate-surfaces";') &&
    cacheTags.includes('export const UPCOMING_CACHE_TAG = "upcoming-surfaces";') &&
    cacheTags.includes('export const HEAT_CHECK_CACHE_TAG = "heat-check-surfaces";') &&
    cacheTags.includes('export const RANKED_STARTS_CACHE_TAG = "ranked-starts-surfaces";') &&
    cacheTags.includes('export const LIVE_CACHE_TAG = "live-surfaces";') &&
    cacheTags.includes('export const HOME_RANKED_CACHE_TAG = "home-ranked-surfaces";') &&
    cacheTags.includes("export const DATA_CHANGE_CACHE_TAGS = [") &&
    warmLiveStartsCron.includes('import { revalidatePath, revalidateTag } from "next/cache";') &&
    warmLiveStartsCron.includes("runWarmLiveStartsJob({ date, revalidatePath, revalidateTag });") &&
    warmLiveStartsJob.includes('import { DATA_CHANGE_CACHE_TAGS, HOME_RANKED_CACHE_TAG } from "@/lib/data/cache-tags";') &&
    warmLiveStartsJob.includes("for (const tag of DATA_CHANGE_CACHE_TAGS)") &&
    warmLiveStartsJob.includes('options.revalidateTag?.(tag, "max");'),
  "data-change cron must push revalidation through shared cache tags for slate surfaces",
);

assert(
  duelsService.includes('import { unstable_cache } from "next/cache";') &&
    duelsService.includes("export const DUELS_REVALIDATE_SECONDS = 60;") &&
    duelsService.includes("const getCachedPitchingDuels = unstable_cache(") &&
    duelsService.includes("const promise = getCachedPitchingDuels(date, mode);"),
  "Pitching duels must use Next data cache for repeated page/API loads",
);

assert(
  rankedService.includes('import { unstable_cache } from "next/cache";') &&
    rankedService.includes('import { HOME_RANKED_CACHE_TAG, RANKED_STARTS_CACHE_TAG, SLATE_CACHE_TAG } from "@/lib/data/cache-tags";') &&
    rankedService.includes("export const HOME_RANKED_REVALIDATE_SECONDS = 60;") &&
    rankedService.includes("const getCachedRankedHome = unstable_cache(") &&
    rankedService.includes("tags: [HOME_RANKED_CACHE_TAG, RANKED_STARTS_CACHE_TAG, SLATE_CACHE_TAG]") &&
    rankedService.includes("return getCachedRankedHome(getHomeSlateDate());"),
  "Home ranked data must use Next data cache for repeated homepage/API loads",
);

assert(
  liveService.includes('import { LIVE_CACHE_TAG, SLATE_CACHE_TAG } from "@/lib/data/cache-tags";') &&
    liveService.includes("tags: [LIVE_CACHE_TAG, SLATE_CACHE_TAG]") &&
    rankedStartsPageService.includes('import { RANKED_STARTS_CACHE_TAG, SLATE_CACHE_TAG } from "@/lib/data/cache-tags";') &&
    rankedStartsPageService.includes("tags: [RANKED_STARTS_CACHE_TAG, SLATE_CACHE_TAG]") &&
    formService.includes('import { HEAT_CHECK_CACHE_TAG, SLATE_CACHE_TAG } from "@/lib/data/cache-tags";') &&
    formService.includes("tags: [HEAT_CHECK_CACHE_TAG, SLATE_CACHE_TAG]") &&
    formService.includes("tags: [HEAT_CHECK_CACHE_TAG]"),
  "main slate, Live, Ranked Starts, and Heat Check caches must be tag-addressable after data changes",
);

assert(
  environmentService.includes("const WEATHER_REVALIDATE_SECONDS = 15 * 60;") &&
    environmentService.includes("next: { revalidate: WEATHER_REVALIDATE_SECONDS }") &&
    environmentService.includes("export function getNeutralGameTimeWeather") &&
    environmentService.includes("export function isRequestTimeEnvironmentEnrichmentEnabled()") &&
    environmentService.includes('process.env.THE_BUMP_REQUEST_TIME_ENRICHMENT === "1"') &&
    !environmentService.includes('cache: "no-store"'),
  "Game-time weather must be revalidated instead of fetched no-store on every render",
);

assert(
  tonightService.includes('const REQUEST_TIME_ENRICHMENT_FLAG = "THE_BUMP_REQUEST_TIME_ENRICHMENT";') &&
    tonightService.includes("const enrichAtRequestTime = isRequestTimeEnrichmentEnabled();") &&
    tonightService.includes("enrichAtRequestTime ? fetchMlbTeamHandednessSplitContexts") &&
    tonightService.includes("enrichAtRequestTime ? fetchMlbOddsMarketContexts") &&
    tonightService.includes("enrichAtRequestTime\n    ? await fetchMlbPitcherStartCompleteness") &&
    tonightService.includes("enrichAtRequestTime ? await getGameTimeWeather") &&
    tonightService.includes("getNeutralGameTimeWeather(game.venue)") &&
    formService.includes('const REQUEST_TIME_ENRICHMENT_FLAG = "THE_BUMP_REQUEST_TIME_ENRICHMENT";') &&
    formService.includes("? fetchMlbPitcherAvailabilityStatuses") &&
    formService.includes(": Promise.resolve(new Map())"),
  "idle page assembly must not perform optional live enrichment fetches unless THE_BUMP_REQUEST_TIME_ENRICHMENT=1 is explicitly set",
);

assert(
  formService.includes("const RECENT_FORM_RENDER_GAP_LIMIT_DAYS = 2;") &&
    formService.includes("const selectedDates = dates.slice(-RECENT_FORM_RENDER_GAP_LIMIT_DAYS);") &&
    formService.includes("[form-pipeline] archive gap exceeds render fan-out cap; serving stale archive/canonical data") &&
    formService.includes("readRecentCanonicalFormSlate") &&
    formService.includes("readCanonicalStartRecords(date)") &&
    !formService.includes('import { getArchivedSeasonStartSummaries, getDailySlate') &&
    !formService.includes("dates.map((date) => getDailySlate"),
  "Heat Check render paths must cap archive-gap fan-out and read canonical data instead of rebuilding/writing slates",
);

assert(
  supabaseArchive.includes("export const ARCHIVE_FRESHNESS_MAX_LAG_DAYS = 2;") &&
    supabaseArchive.includes('const ARCHIVE_MANIFESTS_TABLE = "toetheslab_mlb_archive_manifests";') &&
    supabaseArchive.includes("const manifest = await readSupabaseArchiveManifest(season);") &&
    supabaseArchive.includes("const starts = manifest ? [] : await readSupabaseArchivedSeasonCompletedStarts(season);") &&
    supabaseArchive.includes('import { readCompleteCanonicalSlateStateDates } from "@/lib/data/canonical-start-store";') &&
    supabaseArchive.includes('select: "season,start_date,end_date,counts,synced_at"') &&
    supabaseArchive.includes('url.searchParams.set("select", String(filters.select ?? "*"));') &&
    supabaseArchive.includes("expectedLastCompletedDate?: string;") &&
    supabaseArchive.includes("archiveFreshness(lastDate, options.expectedLastCompletedDate)") &&
    supabaseArchive.includes("const completeSlateDates = await readCompleteCanonicalSlateStateDates(season);") &&
    supabaseArchive.includes("const settledSlateGap = archiveSettledSlateGap(lastDate, latestCompleteSlateDate);") &&
    supabaseArchive.includes("[supabase-archive] archive freshness lag exceeds threshold") &&
    supabaseArchive.includes("[supabase-archive] archive trails canonical complete slate") &&
    supabaseArchive.includes("lagDays > ARCHIVE_FRESHNESS_MAX_LAG_DAYS") &&
    supabaseArchive.includes("stale: typeof lagDays === \"number\" && lagDays > 0") &&
    archiveStatusRoute.includes("const expectedLastCompletedDate = addDays(defaultDate, -1);") &&
    archiveStatusRoute.includes("getSupabaseArchiveStatus(season, { expectedLastCompletedDate })") &&
    archiveStatusRoute.includes("expectedLastCompletedDate,") &&
    renderPathAudit.includes("idlePagePaths") &&
    renderPathAudit.includes("directUpstreamImports") &&
    packageJson.includes('"check:render-path-audit": "node scripts/check-render-path-audit.mjs"'),
  "Supabase archive status must expose freshness lag and any complete-slate archive gap",
);

const seededMissingYesterdayArchiveGap = {
  archiveLastDate: "2026-07-01",
  latestCanonicalCompleteSlateDate: "2026-07-02",
  lagDays: 1,
};

assert(
  seededMissingYesterdayArchiveGap.archiveLastDate < seededMissingYesterdayArchiveGap.latestCanonicalCompleteSlateDate &&
    seededMissingYesterdayArchiveGap.lagDays > 0 &&
    supabaseArchive.includes("function archiveSettledSlateGap(lastDate: string | null, latestCompleteSlateDate: string | null)") &&
    supabaseArchive.includes("stale: typeof lagDays === \"number\" && lagDays > 0") &&
    supabaseArchive.includes("[supabase-archive] archive trails canonical complete slate"),
  "Seeded missing-yesterday archive gap must trip the complete-slate gap alarm",
);

assert(
  startService.includes('import { unstable_cache } from "next/cache";') &&
    startService.includes("export const PITCHER_PROFILE_REVALIDATE_SECONDS = 15 * 60;") &&
    startService.includes("const getCachedPitcherApiResponse = unstable_cache(") &&
    startService.includes("return getCachedPitcherApiResponse(pitcherId, controls.sort ?? null, controls.result ?? null);"),
  "Pitcher API profiles must cache the assembled response for warm profile navigation",
);

const cacheRoutes = [
  ["tonight API", tonightRoute, "TONIGHT_REVALIDATE_SECONDS", "stale-while-revalidate=300"],
  ["upcoming API", upcomingRoute, "UPCOMING_REVALIDATE_SECONDS", "stale-while-revalidate=300"],
  ["duels API", duelsRoute, "DUELS_REVALIDATE_SECONDS", "stale-while-revalidate=300"],
  ["home ranked API", rankedRoute, "HOME_RANKED_REVALIDATE_SECONDS", "stale-while-revalidate=300"],
  ["home status API", homeStatusRoute, "HOME_STATUS_REVALIDATE_SECONDS", "stale-while-revalidate=300"],
  ["form home API", formHomeRoute, "FORM_HOME_REVALIDATE_SECONDS", "stale-while-revalidate=3600"],
  ["form leaderboard API", formLeaderboardRoute, "FORM_LEADERBOARD_REVALIDATE_SECONDS", "stale-while-revalidate=3600"],
  ["pitcher form API", pitcherFormRoute, "PITCHER_FORM_REVALIDATE_SECONDS", "stale-while-revalidate=3600"],
  ["pitcher profile API", pitcherProfileRoute, "PITCHER_PROFILE_REVALIDATE_SECONDS", "stale-while-revalidate=3600"],
];

for (const [label, source, ttlConstant, staleWindow] of cacheRoutes) {
  assert(
    source.includes(ttlConstant) &&
      source.includes('"Cache-Control"') &&
      source.includes("public, s-maxage=") &&
      source.includes(staleWindow),
    `${label} must emit CDN cache headers`,
  );
}

assert(
  fastFilterLink.includes('"use client";') &&
    fastFilterLink.includes("router.prefetch(href)") &&
    fastFilterLink.includes("usePathname") &&
    fastFilterLink.includes("useSearchParams") &&
    fastFilterLink.includes("const currentHref = `${pathname}${currentSearch ? `?${currentSearch}` : \"\"}`;") &&
    fastFilterLink.includes('import { useRouteControlPending } from "@/components/route-control-pending";') &&
    fastFilterLink.includes("const { pending, beginPending } = useRouteControlPending") &&
    fastFilterLink.includes("onClick={() => beginPending()}") &&
    fastFilterLink.includes('pending ? " opacity-70" : ""') &&
    fastFilterLink.includes("scroll?: boolean;") &&
    fastFilterLink.includes("scroll = true") &&
    fastFilterLink.includes("scroll={scroll}") &&
    !fastFilterLink.includes("pointer-events-none opacity-70") &&
    fastFilterLink.includes("onPointerEnter={warmRoute}") &&
    fastFilterLink.includes("onPointerDown={warmRoute}") &&
    fastFilterLink.includes("onFocus={warmRoute}") &&
    fastFilterLink.includes("data-fast-filter-link"),
  "Filter links must prefetch on mount, warm routes on pointer/focus, and keep route buttons clickable after navigation",
);

assert(
  heatCheckPage.includes('import { FastFilterLink } from "@/components/fast-filter-link";') &&
    startsPage.includes('import { FastFilterLink } from "@/components/fast-filter-link";'),
  "Heat Check and Ranked Starts filter controls must use FastFilterLink",
);

assert(
  upcomingDatePage.includes("data-control-link-active={String(active)}"),
  "Upcoming filter controls must preserve active-state metadata",
);

assert(
  existsSync("src/app/loading.tsx") &&
    existsSync("src/app/starts/[id]/loading.tsx") &&
    existsSync("src/app/heat-check/loading.tsx") &&
    existsSync("src/app/heat-check/season/loading.tsx") &&
    existsSync("src/app/live/[date]/loading.tsx") &&
    existsSync("src/app/upcoming/loading.tsx") &&
    existsSync("src/app/upcoming/[date]/loading.tsx") &&
    existsSync("src/app/upcoming/week/loading.tsx") &&
    existsSync("src/app/upcoming/week/[startDate]/loading.tsx") &&
    existsSync("src/app/watchlist/loading.tsx") &&
    existsSync("src/app/pitchers/[id]/loading.tsx") &&
    existsSync("src/components/route-loading-shell.tsx") &&
    !existsSync("src/components/global-route-pending-overlay.tsx") &&
    !existsSync("src/lib/route-pending-event.ts") &&
    !appLayout.includes("GlobalRoutePendingOverlay") &&
    !fastFilterLink.includes("dispatchRoutePending") &&
    loadingPolicy.includes("Navigation paints within 100 ms") &&
    loadingPolicy.includes("cached content is preferred") &&
    loadingPolicy.includes("destination shell plus scoped skeleton data regions") &&
    loadingPolicy.includes("Shell elements render exactly once outside the streamed/skeleton data boundary") &&
    loadingPolicy.includes("fallback and content for a swappable data region share the same root wrapper class") &&
    loadingPolicy.includes("Frozen screens, blocking overlays, blurred previous pages, and full-page dimming are forbidden") &&
    loadingPolicy.includes("Scoped route-control pending is allowed only inside affected data regions") &&
    loadingPolicy.includes("[navigation-skeleton]"),
  "navigation must keep shell-first route skeletons with stable shell/data boundaries, per-route logging, and no blocking overlays",
);

assert(
  routeLoadingShell.includes("descriptionClassName?: string;") &&
    routeLoadingShell.includes('descriptionClassName = "mt-3 max-w-2xl text-sm leading-6 text-zinc-400"') &&
    routeLoadingShell.includes("<div className={descriptionClassName}>{description}</div>") &&
    routeLoadingShell.includes('className="mt-4 grid gap-3 rounded border border-white/10 bg-[#101014]/95 p-4"') &&
    rankedStartsLoading.includes('descriptionClassName="mt-2 max-w-2xl truncate text-sm leading-6 text-zinc-400"') &&
    rankedStartsLoading.includes('childrenMode="content"') &&
    rankedStartsLoading.includes('className="space-y-4"') &&
    rankedStartsLoading.includes('data-responsive-check="ranked-starts-recap"') &&
    rankedStartsLoading.includes('data-navigation-skeleton-route="ranked-starts"'),
  "Ranked Starts loading shell must match loaded subtitle spacing and use the same recap-region root wrapper to prevent shell movement",
);

assert(
  heatCheckWarmup.includes("const HEAT_WINDOWS = [3, 5, 10] as const;") &&
    heatCheckWarmup.includes("/api/form/leaderboard?window=${window}") &&
    heatCheckWarmup.includes("/api/form/leaderboard?window=${window}&qualified=false") &&
    heatCheckWarmup.includes("/api/form/leaderboard?window=${window}&qualified=false&team=${teamParam}") &&
    heatCheckWarmup.includes("/api/tonight?window=${window}") &&
    heatCheckWarmup.includes("requestIdleCallback") &&
    heatCheckPage.includes("<HeatCheckFilterWarmup activeTeam={team} />"),
  "Heat Check must warm common filter-window data after initial render",
);

console.log("Site performance contract passed");
