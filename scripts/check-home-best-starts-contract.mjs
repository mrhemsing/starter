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
const rawScoreHelper = await readFile("src/lib/gs-plus-raw.ts", "utf8");
const rawScoreComponent = await readFile("src/components/gs-plus-score.tsx", "utf8");
const bestStartsRanking = await readFile("src/lib/best-starts-ranking.ts", "utf8");
const bestStartsHubPage = await readFile("src/app/best-starts/page.tsx", "utf8");
const monthlyBestStartsPage = await readFile("src/app/best-starts/[month]/page.tsx", "utf8");
const startService = await readFile("src/lib/data/start-service.ts", "utf8");
const featuredStartHighlight = await readFile("src/components/featured-start-highlight.tsx", "utf8");
const focalHelper = await readFile("src/lib/action-photo-focal.ts", "utf8");
const topPerformerImageService = await readFile("src/lib/data/top-performer-image-service.ts", "utf8");
const misiorowskiTopStartAction = JSON.parse(await readFile("public/images/top-performer-action-shots/2026-07-02-mil-cin-694819-mlb-action-v4.json", "utf8"));
const misiorowskiVisibleTopStartAction = JSON.parse(await readFile("public/images/top-performer-action-shots/2026-06-12-mil-phi-694819-mlb-action-v4.json", "utf8"));
const cavalliTopStartAction = JSON.parse(await readFile("public/images/top-performer-action-shots/2026-06-30-wsh-bos-676917-mlb-action-v4.json", "utf8"));
const detmersTopStartAction = JSON.parse(await readFile("public/images/top-performer-action-shots/2026-05-24-laa-tex-672282-mlb-action-v4.json", "utf8"));

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
    bestStartsService.includes('["home-best-starts-v13"]') &&
    bestStartsService.includes("{ revalidate: HOME_BEST_STARTS_REVALIDATE_SECONDS, tags: [HOME_BEST_STARTS_CACHE_TAG, RANKED_STARTS_CACHE_TAG, SLATE_CACHE_TAG] }"),
  "home best-starts service must cache rolling-window winners and season top starts on a short cadence with a versioned key",
);

assert(
  bestStartsService.includes('import { resolveFeaturedStartHighlight } from "@/lib/data/featured-highlight-service";') &&
    bestStartsService.includes("weeklyHighlight") &&
    bestStartsService.includes("monthlyHighlight") &&
    bestStartsService.includes("highlightUrl: highlight?.watchUrl ?? image?.playUrl ?? null"),
  "home best-starts service must include weekly, monthly, and season top-start highlight payload fields",
);

assert(
  bestStartsService.includes("return getCachedBestStartsHome(getHomeSlateDate());") &&
    bestStartsService.includes('getDailySlate({ window: date === anchorDate ? "today" : "yesterday", date })') &&
  bestStartsService.includes("getBestStartsWindow(anchorDate, 7)") &&
    bestStartsService.includes("getBestStartsWindow(anchorDate, 30)") &&
    bestStartsService.includes("getSeasonTopStarts(anchorDate)"),
  "home best-starts service must include the active day's completed live slate before the archive cycle lands",
);

assert(
  featuredHighlightService.includes('const YOUTUBE_SEARCH_ENABLED = process.env.YOUTUBE_SEARCH_ENABLED === "1";') &&
    featuredHighlightService.includes('"2026-06-19-nyy-cin-693645": "JkWrVSnrgB4"') &&
    featuredHighlightService.includes('"2026-06-22-mil-cin-605540": "oHw4ASegTcI"') &&
    featuredHighlightService.includes('"2026-06-30-wsh-bos-676917": "C-uwf39UDjw"') &&
    featuredHighlightService.includes('"2026-07-05-min-nyy-657746": "tMUgTt5EwLQ"') &&
    featuredHighlightService.includes('"2026-07-07-phi-cin-554430": "dq9meO_64Fk"') &&
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
  bestStartsRanking.includes('import { isRankedRegularStart } from "@/lib/start-classification";') &&
    bestStartsService.includes('import { rankBestStarts } from "@/lib/best-starts-ranking";') &&
    bestStartsRanking.includes("export function isEligibleBestStart") &&
    bestStartsRanking.includes("start.source?.line !== \"fixture\" && isRankedRegularStart(start)") &&
    startClassification.includes("export function isRankedRegularStart") &&
    bestStartsRanking.includes("export function compareBestStarts") &&
    bestStartsRanking.includes("bestStartRawScore(b) - bestStartRawScore(a)") &&
    bestStartsRanking.includes("b.line.strikeouts - a.line.strikeouts") &&
    bestStartsRanking.includes("a.date.localeCompare(b.date)"),
  "home best-starts service must enforce planned-starter-aware qualified starts and use the shared raw-score best-starts ranking service",
);

assert(
  !bestStartsService.includes("rankedWindowStarts") &&
    bestStartsService.includes("getBestStartsWindow(anchorDate, 30)") &&
    bestStartsService.includes("getArchivedSeasonStartSummaries(anchorDate.slice(0, 4))") &&
    bestStartsService.includes('getDailySlate({ window: date === anchorDate ? "today" : "yesterday", date })'),
  "home best-starts service must use rolling daily-slate comparison for 7-day/30-day winners and archived starts for the season top five",
);

assert(
  startService.includes("if (!archived) return getArchivedCompletedStartDetailByRouteId(date, startId);") &&
    startService.includes("async function getArchivedCompletedStartDetailByRouteId(date: string, startId: string)") &&
    startService.includes("const archivedStarts = await readCompletedStarts(date);") &&
    startService.includes("archivedCompletedStartRouteId(candidate) === startId") &&
    startService.includes("function archivedCompletedStartRouteId(start: Pick<ArchivedCompletedStartSummary"),
  "start detail routes must resolve Best Starts archive row ids even when only completed-line archive data is available",
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
    homeDeferredSections.includes('import type { BestStartsHomeResponse, HomeSeasonTopStart } from "@/lib/data/home-best-starts-service";') &&
    homeDeferredSections.includes("bestStarts?: BestStartsHomeResponse | null;") &&
    homeDeferredSections.includes("initialData?.bestStarts ?? null") &&
  homeDeferredSections.includes("bestStartsRefreshAttemptedRef") &&
    homeDeferredSections.includes("hasMissingBestStartHighlight(bestStarts)") &&
    homeDeferredSections.includes("function hasMissingBestStartHighlight") &&
    homeDeferredSections.includes("seasonTopStarts={bestStarts.seasonTopStarts}"),
  "home best-starts client must use server-prefetched initial data and refresh once when stale payloads are missing highlights",
);

assert(
  homeDeferredSections.includes('badge: "7 AND 30-DAY BEST"') &&
    homeDeferredSections.includes('badge: "30-DAY NEXT BEST"') &&
    homeDeferredSections.includes('badge: "7-DAY BEST"') &&
    homeDeferredSections.includes('badge: "30-DAY BEST"') &&
    homeDeferredSections.includes("sameWindowWinner") &&
    homeDeferredSections.includes("visibleCards.length === 0") &&
    homeDeferredSections.includes("lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]"),
  "home best-starts cards must stack 7-day and 30-day cards beside the season top-five panel and dedupe matching window winners",
);

assert(
  homeDeferredSections.includes("monthlyRunnerUpHighlight") &&
    homeDeferredSections.includes("highlight: weeklyHighlight") &&
    homeDeferredSections.includes("highlight: monthlyHighlight") &&
    homeDeferredSections.includes("entry.highlightUrl"),
  "home best-starts cards must pass API highlights into the adaptive card renderer and season rows",
);

assert(
  homeDeferredSections.includes("Recent Gems") &&
    homeDeferredSections.includes(">Best starts</p>") &&
    homeDeferredSections.includes("Top starts of 2026") &&
    homeDeferredSections.includes("The best starts of the last 7 and 30 days, worth revisiting.") &&
    homeDeferredSections.includes('badge: "7-DAY BEST"') &&
    homeDeferredSections.includes('badge: "30-DAY BEST"') &&
    !homeDeferredSections.includes(">Evergreen</p>") &&
    !homeDeferredSections.includes("Start of the Week & Month") &&
    !homeDeferredSections.includes("Start of the Week / Month") &&
    !homeDeferredSections.includes("Tops the last 7 and 30 days") &&
    !homeDeferredSections.includes('badge: "WEEK BEST"') &&
    !homeDeferredSections.includes('badge: "MONTH BEST"'),
  "home best-starts copy must use recent rolling-window vocabulary and expose the Top Starts of 2026 panel",
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
  bestStartsService.includes('import { rankBestStarts } from "@/lib/best-starts-ranking";') &&
    bestStartsHubPage.includes('export const metadata: Metadata =') &&
    bestStartsHubPage.includes('title: "Best Starts of 2026"') &&
    bestStartsHubPage.includes('alternates: { canonical: "/best-starts" }') &&
    bestStartsHubPage.includes("getBestStartsHome()") &&
    bestStartsHubPage.includes("data-best-starts-rolling-heroes=\"true\"") &&
    bestStartsHubPage.includes(">2026 leaderboard</h2>") &&
    bestStartsHubPage.includes("rankBestStarts(seasonStarts).slice(0, 25)") &&
    bestStartsHubPage.includes('href={`/best-starts/${month}`}') &&
    monthlyBestStartsPage.includes('import { rankBestStarts } from "@/lib/best-starts-ranking";') &&
    monthlyBestStartsPage.includes("data-best-starts-month-hero=\"true\"") &&
    monthlyBestStartsPage.includes("Season hub") &&
    monthlyBestStartsPage.includes("No settled starts this month yet.") &&
    monthlyBestStartsPage.includes("data-best-starts-stat-strip=\"true\"") &&
    monthlyBestStartsPage.includes("data-best-starts-month-pager=\"true\"") &&
    monthlyBestStartsPage.includes("data-best-starts-rich-row=\"true\"") &&
    monthlyBestStartsPage.includes("data-best-starts-compact-row=\"true\"") &&
    monthlyBestStartsPage.includes("The strongest starts of {monthLabel}, ranked by GS+. Capped 80s show their raw score.") &&
    !monthlyBestStartsPage.includes("7-DAY BEST") &&
    !monthlyBestStartsPage.includes("30-DAY BEST") &&
    !monthlyBestStartsPage.includes(["Monthly", "leaderboard"].join(" ")) &&
    !homeDeferredSections.includes('href={`/best-starts/${monthKey}`}') &&
    homeDeferredSections.includes('href="/best-starts"') &&
    featuredStartHighlight.includes("Highlight · MLB on YouTube") &&
    featuredStartHighlight.includes('target="_blank"') &&
    featuredStartHighlight.includes('rel="noopener"') &&
    !featuredStartHighlight.includes(["Highlight", "via", "MLB", "on", "YouTube"].join(" ")) &&
    bestStartsRanking.includes('import { rawGameScorePlus } from "@/lib/gs-plus-raw";') &&
    bestStartsRanking.includes("bestStartRawScore(b) - bestStartRawScore(a)") &&
    bestStartsRanking.includes("b.line.strikeouts - a.line.strikeouts") &&
    bestStartsRanking.includes("a.date.localeCompare(b.date)") &&
    bestStartsService.includes("rawScore: rawGameScorePlus(start.gameScorePlusBreakdown)") &&
    bestStartsService.includes("resolveTopPerformerImage(start, null)") &&
    rawScoreHelper.includes("component.key !== \"calibration\"") &&
    rawScoreComponent.includes("cappedRawGameScorePlus(score, breakdown)") &&
    rawScoreComponent.includes("RAW {raw.toFixed(1)}") &&
    bestStartsHubPage.includes("<RawGsPlusValueLine") &&
    monthlyBestStartsPage.includes("<RawGsPlusValueLine") &&
    rawScoreComponent.includes("export function RawGsPlusValueLine") &&
    rawScoreComponent.includes("rawGameScorePlus(breakdown) ?? score") &&
    homeDeferredSections.includes("function SeasonTopStartsPanel") &&
    homeDeferredSections.includes("function SeasonTopStartRow") &&
    homeDeferredSections.includes("function splitPitcherNameForMobile") &&
    homeDeferredSections.includes("data-home-top-start-row={rank}") &&
    homeDeferredSections.includes('data-home-top-start-mobile-name="two-line"') &&
    homeDeferredSections.includes('className="hidden sm:inline"') &&
    homeDeferredSections.includes('data-full-bleed-action={fullBleed ? "true" : "false"}') &&
    homeDeferredSections.includes('data-home-top-start-bg="true"') &&
    homeDeferredSections.includes('data-home-top-start-scrim="true"') &&
    homeDeferredSections.includes('data-home-top-start-framed-photo="true"') &&
    homeDeferredSections.includes('data-home-top-start-score-panel="true"') &&
    homeDeferredSections.includes('data-home-top-start-gem-lockup="true"') &&
    homeDeferredSections.includes('data-home-top-start-gem-watermark="true"') &&
    homeDeferredSections.includes("backgroundImage") &&
    homeDeferredSections.includes("opacity-[0.16]") &&
    homeDeferredSections.includes("sm:opacity-[0.12]") &&
    homeDeferredSections.includes('const imagePosition = "50% 4%";') &&
    homeDeferredSections.includes("Gem number ${rank}") &&
    homeDeferredSections.includes("sm:min-h-[160px]") &&
    homeDeferredSections.includes("min-h-[120px]") &&
    homeDeferredSections.includes('bg-[rgba(10,10,10,0.6)]') &&
    homeDeferredSections.includes("backdrop-blur-[6px]") &&
    homeDeferredSections.includes("border-white/35") &&
    homeDeferredSections.includes("sm:w-[72px]") &&
    homeDeferredSections.includes("w-[56px]") &&
    homeDeferredSections.includes("sm:text-[44px]") &&
    homeDeferredSections.includes("text-[32px]") &&
    homeDeferredSections.includes("startMatchupLabel(start), formatShortDate(start.date)") &&
    !homeDeferredSections.includes("start.pitcher.team, startMatchupLabel(start)") &&
    homeDeferredSections.includes("<RawGsPlusLine") &&
    homeDeferredSections.includes('className="mt-1 !text-white" style={{ color: "#fff" }}') &&
    homeDeferredSections.includes('alt={`${start.pitcher.name} pitching`}') &&
    homeDeferredSections.includes('target="_blank" rel="noopener"') &&
    homeDeferredSections.includes("formatStartLine(start.line)") &&
    homeDeferredSections.includes("entry.isNew"),
  "best starts surfaces must share raw GS+ ranking, render full-bleed action rows, framed fallbacks, all-row raw labels, highlights, NEW chips, and deduped 7/30 heroes",
);

assert(
  focalHelper.includes("export function clampActionPhotoObjectPosition") &&
    focalHelper.includes("SAFE_REGION_MARGIN = 0.15") &&
    focalHelper.includes("containerAspect = 3.7") &&
    focalHelper.includes('return "center 30%"') &&
    topPerformerImageService.includes("focalXOverride") &&
    topPerformerImageService.includes("focalYOverride") &&
    topPerformerImageService.includes("cachedActionFocalPoint") &&
    topPerformerImageService.includes("clampActionPhotoObjectPosition({ focal: focalPoint })") &&
    topPerformerImageService.includes("clampActionPhotoObjectPosition({ focal: autoPromoted?.focalPoint })"),
  "top-start action rows must use persisted focal data, manual overrides, a safe-zone clamp, and center 30 percent fallback without request-time detection",
);

assert(
  misiorowskiTopStartAction.imageUrl === "/images/top-performer-action-shots/2026-07-02-mil-cin-694819-mlb-api-action-v5.jpg" &&
    misiorowskiTopStartAction.sourceImageUrl === "https://img.mlbstatic.com/mlb-images/image/upload/ar_16:9,g_auto,q_auto:good,w_2608,c_fill,f_jpg/mlb/yg6pvlidztrtt29nun9j.jpg" &&
    misiorowskiTopStartAction.playUrl === "https://www.mlb.com/video/jj-bleday-strikes-out-swinging-azc6rq" &&
    misiorowskiVisibleTopStartAction.imageUrl === "/images/top-performer-action-shots/2026-06-12-mil-phi-694819-generated-action-v3.png" &&
    misiorowskiVisibleTopStartAction.sourceImageUrl === misiorowskiVisibleTopStartAction.imageUrl &&
    cavalliTopStartAction.imageUrl === "/images/top-performer-action-shots/2026-06-30-wsh-bos-676917-mlb-api-action-v2.jpg" &&
    cavalliTopStartAction.sourceImageUrl === "https://img.mlbstatic.com/mlb-images/image/upload/ar_16:9,g_auto,q_auto:good,w_2608,c_fill,f_jpg/mlb/rhkvtlkawsigrek3ke1u.jpg" &&
    cavalliTopStartAction.playUrl === "https://www.mlb.com/video/cade-cavalli-fans-13-over-seven-scoreless" &&
    detmersTopStartAction.imageUrl === "/images/top-performer-action-shots/2026-05-24-laa-tex-672282-generated-action-v2.png" &&
    detmersTopStartAction.sourceImageUrl === detmersTopStartAction.imageUrl,
  "home Top Starts #1 and screenshot-visible #3 must use generated replacement action photos",
);

const topStartClampCases = [
  { focal: { x: 0.05, y: 0.05 }, imageAspect: 3 / 2, containerAspect: 3.7 },
  { focal: { x: 0.95, y: 0.95 }, imageAspect: 3 / 2, containerAspect: 3.7 },
  { focal: { x: 0.05, y: 0.05 }, imageAspect: 16 / 9, containerAspect: 3.7 },
  { focal: { x: 0.95, y: 0.95 }, imageAspect: 16 / 9, containerAspect: 3.7 },
  { focal: { x: 0.05, y: 0.05 }, imageAspect: 1, containerAspect: 3.7 },
  { focal: { x: 0.95, y: 0.95 }, imageAspect: 1, containerAspect: 3.7 },
];
for (const testCase of topStartClampCases) {
  const position = clampActionPhotoObjectPositionLocal(testCase);
  assert(
    focalWithinSafeRegion(testCase, position),
    `top-start focal clamp should keep focal point inside safe region: ${JSON.stringify(testCase)} -> ${position}`,
  );
}

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

function clampActionPhotoObjectPositionLocal({ focal, imageAspect = 16 / 9, containerAspect = 3.7, margin = 0.15 }) {
  const focalX = normalizeFocalLocal(focal.x);
  const focalY = normalizeFocalLocal(focal.y);
  if (imageAspect >= containerAspect) {
    return `${cssPositionForAxisLocal(focalX, imageAspect, containerAspect, margin)}% ${Math.round(focalY * 100)}%`;
  }
  return `${Math.round(focalX * 100)}% ${cssPositionForAxisLocal(focalY, containerAspect / imageAspect, 1, margin)}%`;
}

function focalWithinSafeRegion({ focal, imageAspect, containerAspect }, position, margin = 0.15) {
  const [, yPosition] = position.split(" ").map((value) => Number.parseFloat(value) / 100);
  if (imageAspect >= containerAspect) return true;
  const renderedHeight = containerAspect / imageAspect;
  const visibleRatio = 1 / renderedHeight;
  const start = yPosition * (1 - visibleRatio);
  const focalY = normalizeFocalLocal(focal.y);
  const lowerMargin = Math.min(margin * visibleRatio, focalY);
  const upperMargin = Math.min(margin * visibleRatio, 1 - focalY);
  return focalY >= start + lowerMargin - 0.001 && focalY <= start + visibleRatio - upperMargin + 0.001;
}

function cssPositionForAxisLocal(focal, renderedSize, containerSize, margin) {
  if (renderedSize <= containerSize) return Math.round(focal * 100);
  const visibleRatio = containerSize / renderedSize;
  const overflowRatio = 1 - visibleRatio;
  const lower = (focal - (1 - margin) * visibleRatio) / overflowRatio;
  const upper = (focal - margin * visibleRatio) / overflowRatio;
  const centered = (focal - 0.5 * visibleRatio) / overflowRatio;
  return Math.round(Math.min(1, Math.max(0, Math.min(upper, Math.max(lower, centered)))) * 100);
}

function normalizeFocalLocal(value) {
  return Math.min(1, Math.max(0, value > 1 ? value / 100 : value));
}

console.log("home best-starts contract ok: highlight payloads are resolved in the API and rendered by the homepage cards");
