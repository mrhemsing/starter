import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const bestStartsRoute = await readFile("src/app/api/home/best-starts/route.ts", "utf8");
const bestStartsService = await readFile("src/lib/data/home-best-starts-service.ts", "utf8");
const featuredHighlightService = await readFile("src/lib/data/featured-highlight-service.ts", "utf8");
const featuredHighlightsCron = await readFile("src/app/api/cron/featured-highlights/route.ts", "utf8");
const highlightIngestScript = await readFile("scripts/ingest-featured-start-highlights.mjs", "utf8");
const packageJson = await readFile("package.json", "utf8");
const vercelJson = JSON.parse(await readFile("vercel.json", "utf8"));
const readme = await readFile("README.md", "utf8");
const startClassification = await readFile("src/lib/start-classification.ts", "utf8");
const homePage = await readFile("src/app/page.tsx", "utf8");
const homeDeferredSections = await readFile("src/components/home-deferred-sections.tsx", "utf8");

assert(
  bestStartsRoute.includes('import { getBestStartsHome, HOME_BEST_STARTS_REVALIDATE_SECONDS } from "@/lib/data/home-best-starts-service";') &&
    bestStartsRoute.includes("Cache-Control") &&
    bestStartsRoute.includes("stale-while-revalidate=86400"),
  "home best-starts API must delegate to the shared cached service and advertise CDN caching",
);

assert(
  bestStartsService.includes('import { unstable_cache } from "next/cache";') &&
    bestStartsService.includes("export const HOME_BEST_STARTS_REVALIDATE_SECONDS = 60;") &&
    bestStartsService.includes('export const HOME_BEST_STARTS_CACHE_TAG = "home-best-starts";') &&
    bestStartsService.includes("unstable_cache(") &&
    bestStartsService.includes('["home-best-starts-v4"]') &&
    bestStartsService.includes("{ revalidate: HOME_BEST_STARTS_REVALIDATE_SECONDS, tags: [HOME_BEST_STARTS_CACHE_TAG, RANKED_STARTS_CACHE_TAG, SLATE_CACHE_TAG] }"),
  "home best-starts service must cache rolling-window winners on a short cadence with a versioned key for highlight payload changes",
);

assert(
  bestStartsService.includes('import { resolveFeaturedStartHighlight } from "@/lib/data/featured-highlight-service";') &&
    bestStartsService.includes("weeklyHighlight") &&
    bestStartsService.includes("monthlyHighlight"),
  "home best-starts service must include weekly and monthly highlight payload fields",
);

assert(
  bestStartsService.includes("return getCachedBestStartsHome(getHomeSlateDate());") &&
    bestStartsService.includes('getDailySlate({ window: date === anchorDate ? "today" : "yesterday", date })') &&
    bestStartsService.includes("const [weekly, monthly] = await Promise.all([getBestStartWindow(anchorDate, 7), getBestStartWindow(anchorDate, 30)]);"),
  "home best-starts service must include the active day's completed live slate before the archive cycle lands",
);

assert(
  featuredHighlightService.includes('const YOUTUBE_SEARCH_ENABLED = process.env.YOUTUBE_SEARCH_ENABLED === "1";') &&
    featuredHighlightService.includes('"2026-06-19-nyy-cin-693645": "JkWrVSnrgB4"') &&
    featuredHighlightService.includes('"2026-06-22-mil-cin-605540": "oHw4ASegTcI"') &&
    featuredHighlightService.includes('"2026-06-30-wsh-bos-676917": "C-uwf39UDjw"') &&
    featuredHighlightService.includes("if (!YOUTUBE_SEARCH_ENABLED) return cacheResolution(start.id, null);"),
  "featured highlights must keep quota-safe dynamic search disabled by default and manually map known official MLB videos for current Recent Gems",
);

assert(
  packageJson.includes('"ingest:featured-highlights": "node scripts/ingest-featured-start-highlights.mjs"') &&
    highlightIngestScript.includes('const HIGHLIGHTS_TABLE = "toetheslab_featured_start_highlights";') &&
    highlightIngestScript.includes('const MLB_CHANNEL_HANDLE = "MLB";') &&
    highlightIngestScript.includes("const DEFAULT_LOOKBACK_DAYS = 30;") &&
    highlightIngestScript.includes("const DEFAULT_CANDIDATE_LIMIT = 16;") &&
    highlightIngestScript.includes("readStoredHighlightStartIds") &&
    highlightIngestScript.includes("searchHighlightCandidates") &&
    highlightIngestScript.includes("upsertHighlights(rows)") &&
    highlightIngestScript.includes('source: "youtube-search"') &&
    highlightIngestScript.includes('if (ALL_GAME_HIGHLIGHTS_TITLE_PATTERN.test(title) || NON_START_TITLE_PATTERN.test(title)) return null;') &&
    readme.includes("npm run ingest:featured-highlights") &&
    readme.includes("without page-render search"),
  "Recent Gems must have a quota-safe 30-day background MLB YouTube ingestion path that stores validated highlight IDs in Supabase",
);

assert(
  featuredHighlightsCron.includes('import { revalidatePath, revalidateTag } from "next/cache";') &&
    featuredHighlightsCron.includes('import { HOME_BEST_STARTS_CACHE_TAG } from "@/lib/data/home-best-starts-service";') &&
    featuredHighlightsCron.includes('const MLB_CHANNEL_HANDLE = "MLB";') &&
    featuredHighlightsCron.includes("const DEFAULT_LOOKBACK_DAYS = 30;") &&
    featuredHighlightsCron.includes("const DEFAULT_CANDIDATE_LIMIT = 16;") &&
    featuredHighlightsCron.includes('const HIGHLIGHTS_TABLE = "toetheslab_featured_start_highlights";') &&
    featuredHighlightsCron.includes("process.env.YOUTUBE_API_KEY") &&
    featuredHighlightsCron.includes("getArchivedSeasonStartSummaries") &&
    featuredHighlightsCron.includes("readStoredHighlightStartIds") &&
    featuredHighlightsCron.includes("resolveYouTubeHighlight") &&
    featuredHighlightsCron.includes("upsertHighlights") &&
    featuredHighlightsCron.includes('revalidateTag(HOME_BEST_STARTS_CACHE_TAG, "max")') &&
    featuredHighlightsCron.includes('source: "youtube-search"') &&
    vercelJson.crons.some((cron) => cron.path === "/api/cron/featured-highlights" && cron.schedule === "0 10 * * *") &&
    readme.includes("Vercel runs `/api/cron/featured-highlights` daily at 10:00 UTC"),
  "Recent Gems highlight ingestion must run automatically as a quota-safe Vercel cron and revalidate home best-starts cache after matches",
);

assert(
  bestStartsService.includes('import { isRankedRegularStart } from "@/lib/start-classification";') &&
    bestStartsService.includes('import { compareRankedStarts } from "@/lib/start-ranking";') &&
    bestStartsService.includes("function isEligibleBestStart") &&
    bestStartsService.includes("start.source?.line !== \"fixture\" && isRankedRegularStart(start)") &&
    startClassification.includes("export function isRankedRegularStart") &&
    bestStartsService.includes("function compareBestStarts") &&
    bestStartsService.includes("compareRankedStarts(a, b)") &&
    bestStartsService.includes("b.date.localeCompare(a.date)"),
  "home best-starts service must enforce planned-starter-aware qualified starts and reuse ranked-start tie-breaks before recency",
);

assert(
  !bestStartsService.includes("rankedWindowStarts") &&
    bestStartsService.includes("getBestStartWindow(anchorDate, 30)") &&
    bestStartsService.includes('getDailySlate({ window: date === anchorDate ? "today" : "yesterday", date })'),
  "home best-starts service must use the same rolling daily-slate comparison for 7-day and 30-day winners",
);

assert(
  homePage.includes('import { getBestStartsHome } from "@/lib/data/home-best-starts-service";') &&
    homePage.includes("const bestStartsPromise = getBestStartsHome().catch(() => null);") &&
    homePage.includes("bestStartsPromise,") &&
    homePage.includes("bestStarts,"),
  "homepage must server-prefetch best starts before rendering the client sections",
);

assert(
  homeDeferredSections.includes('import { FeaturedStartHighlightEmbed } from "@/components/featured-start-highlight";'),
  "home best-starts client must import the highlight embed",
);

assert(
    homeDeferredSections.includes('import type { BestStartsHomeResponse } from "@/lib/data/home-best-starts-service";') &&
    homeDeferredSections.includes("bestStarts?: BestStartsHomeResponse | null;") &&
    homeDeferredSections.includes("initialData?.bestStarts ?? null") &&
    homeDeferredSections.includes("bestStartsRefreshAttemptedRef") &&
    homeDeferredSections.includes("hasMissingBestStartHighlight(bestStarts)") &&
    homeDeferredSections.includes("function hasMissingBestStartHighlight"),
  "home best-starts client must use server-prefetched initial data and refresh once when stale payloads are missing highlights",
);

assert(
  homeDeferredSections.includes('badge: "7-DAY + 30-DAY BEST"') &&
    homeDeferredSections.includes('badge: "7-DAY BEST"') &&
    homeDeferredSections.includes('badge: "30-DAY BEST"') &&
    homeDeferredSections.includes("visibleCards.length === 0") &&
    homeDeferredSections.includes('visibleCards.length === 1 ? "" : "md:grid-cols-2"'),
  "home best-starts cards must derive one combined card or two ordered 7-day/30-day cards from the rolling-window relationship",
);

assert(
  homeDeferredSections.includes("monthlyHighlight ?? weeklyHighlight") &&
    homeDeferredSections.includes("highlight: weeklyHighlight") &&
    homeDeferredSections.includes("highlight: monthlyHighlight"),
  "home best-starts cards must pass API highlights into the adaptive card renderer",
);

assert(
  homeDeferredSections.includes("Recent Gems") &&
    homeDeferredSections.includes(">Best starts</p>") &&
    homeDeferredSections.includes("The best starts of the last 7 and 30 days, worth revisiting.") &&
    homeDeferredSections.includes('badge: "7-DAY BEST"') &&
    homeDeferredSections.includes('badge: "30-DAY BEST"') &&
    !homeDeferredSections.includes(">Evergreen</p>") &&
    !homeDeferredSections.includes("Start of the Week & Month") &&
    !homeDeferredSections.includes("Start of the Week / Month") &&
    !homeDeferredSections.includes("Tops the last 7 and 30 days") &&
    !homeDeferredSections.includes('badge: "WEEK BEST"') &&
    !homeDeferredSections.includes('badge: "MONTH BEST"'),
  "home best-starts copy must use recent rolling-window vocabulary without duplicate Week/Month labels",
);

assert(
  homeDeferredSections.includes("pitcherHref(start.pitcher, sourceParams(\"home\"))") &&
    homeDeferredSections.includes("startHref(start, sourceParams(\"home\"))") &&
    homeDeferredSections.includes("score-bug") &&
    homeDeferredSections.includes("band={scoreBand(start.gameScorePlus)}") &&
    homeDeferredSections.includes("whitespace-nowrap") &&
    homeDeferredSections.includes("grid-cols-[66px_minmax(0,1fr)_auto] items-start"),
  "home best-starts cards must show GS+ score-bug, thermal headshot, no-wrap badge, profile name link, start deep-dive card link, and top-aligned columns",
);

assert(
  homeDeferredSections.includes("<FeaturedStartHighlightEmbed highlight={highlight} pitcherName={start.pitcher.name} />"),
  "home best-starts card must render the highlight embed when a highlight is present",
);

assert(
  !homeDeferredSections.includes("HomeDeferredFallback") &&
    !homeDeferredSections.includes("Loading best starts") &&
    !homeDeferredSections.includes('aria-busy="true"'),
  "home best-starts must not use an initial loading skeleton for idle cached page content",
);

console.log("home best-starts contract ok: highlight payloads are resolved in the API and rendered by the homepage cards");
