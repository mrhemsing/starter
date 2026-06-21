import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const bestStartsRoute = await readFile("src/app/api/home/best-starts/route.ts", "utf8");
const bestStartsService = await readFile("src/lib/data/home-best-starts-service.ts", "utf8");
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
    bestStartsService.includes("export const HOME_BEST_STARTS_REVALIDATE_SECONDS = 6 * 60 * 60;") &&
    bestStartsService.includes("unstable_cache(") &&
    bestStartsService.includes('{ revalidate: HOME_BEST_STARTS_REVALIDATE_SECONDS }'),
  "home best-starts service must cache rolling-window winners for six hours",
);

assert(
  bestStartsService.includes('import { resolveFeaturedStartHighlight } from "@/lib/data/featured-highlight-service";') &&
    bestStartsService.includes("weeklyHighlight") &&
    bestStartsService.includes("monthlyHighlight"),
  "home best-starts service must include weekly and monthly highlight payload fields",
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
  bestStartsService.includes("getArchivedSeasonStartSummaries") &&
    bestStartsService.includes("rankedWindowStarts") &&
    bestStartsService.includes("monthlyStarts.length > 0"),
  "home best-starts service must use the archived season summary fast path before falling back to daily slate fanout",
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
    homeDeferredSections.includes('if (!bestStarts) {'),
  "home best-starts client must use server-prefetched initial data and only fetch the API as a fallback",
);

assert(
  homeDeferredSections.includes('badge: "WEEK + MONTH BEST"') &&
    homeDeferredSections.includes('badge: "WEEK BEST"') &&
    homeDeferredSections.includes('badge: "MONTH BEST"') &&
    homeDeferredSections.includes("visibleCards.length === 0") &&
    homeDeferredSections.includes('visibleCards.length === 1 ? "" : "md:grid-cols-2"'),
  "home best-starts cards must derive one combined card or two ordered Week/Month cards from the rolling-window relationship",
);

assert(
  homeDeferredSections.includes("monthlyHighlight ?? weeklyHighlight") &&
    homeDeferredSections.includes("highlight: weeklyHighlight") &&
    homeDeferredSections.includes("highlight: monthlyHighlight"),
  "home best-starts cards must pass API highlights into the adaptive card renderer",
);

assert(
  homeDeferredSections.includes("Start of the Week & Month") &&
    homeDeferredSections.includes("The best starts of the last 7 and 30 days, worth revisiting.") &&
    !homeDeferredSections.includes("Start of the Week / Month") &&
    !homeDeferredSections.includes("Tops the last 7 and 30 days") &&
    !homeDeferredSections.includes("7-day best") &&
    !homeDeferredSections.includes("30-day best"),
  "home best-starts copy must use cleaned Week/Month vocabulary without duplicate labels",
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
  homeDeferredSections.includes('best: { eyebrow: "Best starts", title: "Loading best starts" },'),
  "home best-starts loading skeleton must use clear loading copy instead of the final Evergreen section label",
);

console.log("home best-starts contract ok: highlight payloads are resolved in the API and rendered by the homepage cards");
