import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const [routes, toggle, streamersService, streamersPage, sitemapRoute, siteNav, routeLoading] = await Promise.all([
  readFile("src/lib/routes.ts", "utf8"),
  readFile("src/components/slate-date-nav.tsx", "utf8"),
  readFile("src/lib/data/streamers-service.ts", "utf8"),
  readFile("src/app/upcoming/streamers/page.tsx", "utf8"),
  readFile("src/app/sitemaps/[kind]/route.ts", "utf8"),
  readFile("src/components/site-nav.tsx", "utf8"),
  readFile("src/components/route-loading-shell.tsx", "utf8"),
]);

assert(
  routes.includes("export function upcomingStreamersHref()") && routes.includes('return "/upcoming/streamers";'),
  "routes must expose the crawlable Upcoming streamers path",
);

assert(
  toggle.includes("streamersActive = false") &&
    toggle.includes('key: "streamers"') &&
    toggle.includes('label: "Streamers"') &&
    toggle.includes("href: upcomingStreamersHref()") &&
    toggle.includes("active: streamersActive"),
  "Upcoming range toggle must include Streamers as a fourth pill without changing primary nav",
);

assert(
  streamersService.includes("export async function getUpcomingStreamers") &&
    streamersService.includes("twoStartPitchers: candidates.filter((candidate) => candidate.matchups.length >= 2)") &&
    streamersService.includes("formRisers: candidates.filter") &&
    streamersService.includes("STREAMER_SCORE_CONFIG") &&
    streamersService.includes("fantasyWeekStart") &&
    streamersService.includes("starter.seasonDecisionRecord") &&
    streamersService.includes("starter.seasonStats?.qualityStarts"),
  "streamers service must compute two-start and form-riser candidates from Upcoming data with a single score config",
);

assert(
  streamersPage.includes('title: "MLB Pitcher Streamers This Week"') &&
    streamersPage.includes('canonical: "/upcoming/streamers"') &&
    streamersPage.includes("<UpcomingSlateRangeToggle") &&
    streamersPage.includes("streamersActive") &&
    streamersPage.includes("Two-start pitchers") &&
    streamersPage.includes("Form risers with soft matchups") &&
    streamersPage.includes("data-responsive-check=\"upcoming-streamers\"") &&
    streamersPage.includes("W-L-ND") &&
    streamersPage.includes("QS {candidate.seasonContext.qualityStarts ?? \"--\"}") &&
    streamersPage.includes("K/9"),
  "streamers page must have distinct metadata, active pill state, two expected sections, and fantasy context labels",
);

assert(
  sitemapRoute.includes("upcomingStreamersHref") && sitemapRoute.includes("url(upcomingStreamersHref(), now, \"daily\", 0.8)"),
  "static sitemap must publish only the clean /upcoming/streamers route",
);

assert(
  siteNav.includes("{ key: \"home\" as const") &&
    siteNav.includes("{ key: \"starts\" as const") &&
    siteNav.includes("{ key: \"heat\" as const") &&
    siteNav.includes("{ key: \"watchlist\" as const") &&
    !siteNav.includes("streamers") &&
    routeLoading.includes('const navLabels = ["Home", "Ranked Starts", "Heat Check", "Live", "Upcoming", "Watchlist"] as const;'),
  "primary navigation must stay at six items with no standalone streamers nav item",
);

console.log("upcoming streamers contract ok: /upcoming/streamers lives inside Upcoming with no nav expansion");
