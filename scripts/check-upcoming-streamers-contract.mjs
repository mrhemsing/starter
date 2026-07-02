import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const [packageJson, routes, toggle, streamersService, streamersPage, streamersImage, sitemapRoute, siteNav] = await Promise.all([
  readFile("package.json", "utf8"),
  readFile("src/lib/routes.ts", "utf8"),
  readFile("src/components/slate-date-nav.tsx", "utf8"),
  readFile("src/lib/data/streamers-service.ts", "utf8"),
  readFile("src/app/upcoming/streamers/page.tsx", "utf8"),
  readFile("src/app/upcoming/streamers/opengraph-image.tsx", "utf8"),
  readFile("src/app/sitemaps/[kind]/route.ts", "utf8"),
  readFile("src/components/site-nav.tsx", "utf8"),
]);

assert(
  packageJson.includes('"check:upcoming-streamers": "node scripts/check-upcoming-streamers-contract.mjs"'),
  "package scripts must expose the Upcoming streamers contract as a no-op-safe npm check",
);

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
    streamersService.includes("STREAMERS_WEEK_TARGETING_CONFIG") &&
    streamersService.includes("pivotDay: 4") &&
    streamersService.includes("targetFantasyWeekStart") &&
    streamersService.includes("STREAMERS_RISER_FUNNEL_CONFIG") &&
    streamersService.includes("softOpponentShare: 1 / 3") &&
    streamersService.includes("twoStartPitchers = candidates.filter((candidate) => candidate.matchups.length >= 2)") &&
    streamersService.includes("withSoftMatchup = withNextStart.filter(hasSoftMatchup)") &&
    streamersService.includes('console.info("[streamers:funnel]"') &&
    streamersService.includes("streamerFunnelEmptyReason") &&
    streamersService.includes("matchupRunValueForStreamer") &&
    streamersService.includes("Probables confirmed through") &&
    streamersService.includes("STREAMER_SCORE_CONFIG") &&
    streamersService.includes("fantasyWeekStart") &&
    streamersService.includes("starter.seasonDecisionRecord") &&
    streamersService.includes("starter.seasonStats?.qualityStarts") &&
    streamersService.includes("opponentLineupTier") &&
    streamersService.includes("parkFactor"),
  "streamers service must target the correct fantasy week, log the riser funnel, and score candidates from Upcoming data with one config",
);

assert(
  streamersPage.includes('const title = "MLB Pitcher Streamers This Week";') &&
    streamersPage.includes('export const dynamic = "force-dynamic";') &&
    streamersPage.includes('const canonicalPath = "/upcoming/streamers";') &&
    streamersPage.includes("canonical: canonicalPath") &&
    streamersPage.includes('const imagePath = `${canonicalPath}/opengraph-image`;') &&
    streamersPage.includes("const imageUrl = absoluteUrl(imagePath);") &&
    streamersPage.includes('import { absoluteUrl, jsonLdScript, SITE_NAME } from "@/lib/seo";') &&
    streamersPage.includes("const jsonLd = jsonLdForUpcomingStreamers(streamers);") &&
    streamersPage.includes('<script type="application/ld+json"') &&
    streamersPage.includes("card: \"summary_large_image\"") &&
    streamersPage.includes("siteName: SITE_NAME") &&
    streamersPage.includes("images: [{ url: imageUrl, width: 1200, height: 630, alt: title }]") &&
    streamersPage.includes("images: [{ url: imageUrl, alt: title }]") &&
    streamersPage.includes("<UpcomingSlateRangeToggle") &&
    streamersPage.includes("streamersActive") &&
    streamersPage.includes("Widely-available arms worth a one-start pickup this week, plus everyone scheduled to start twice.") &&
    streamersPage.includes("What is streaming?") &&
    streamersPage.includes("WEEK OF") &&
    streamersPage.includes("data-streamers-coverage") &&
    streamersPage.includes("Two-start pitchers") &&
    streamersPage.includes("Two starts in one fantasy week doubles the counting stats.") &&
    streamersPage.includes("Form risers with soft matchups") &&
    streamersPage.includes("Trending arms drawing a weak lineup in their next start.") &&
    streamersPage.includes("data-responsive-check=\"upcoming-streamers\"") &&
    streamersPage.includes("data-two-start-count={streamers.twoStartPitchers.length}") &&
    streamersPage.includes("data-form-riser-count={streamers.formRisers.length}") &&
    streamersPage.includes("data-streamer-card") &&
    streamersPage.includes("data-streamer-rank={rank}") &&
    streamersPage.includes("data-stream-score={candidate.streamScore}") &&
    streamersPage.includes("W-L-ND") &&
    streamersPage.includes("QS {candidate.seasonContext.qualityStarts ?? \"--\"}") &&
    streamersPage.includes("K/9") &&
    streamersPage.includes("CHANGED · NOW 1 START") &&
    streamersPage.includes("opponentLineupTier") &&
    streamersPage.includes("Park {matchup.parkFactor.toFixed(2)}") &&
    streamersPage.includes("label.toUpperCase()"),
  "streamers page must explain streaming, expose coverage/funnel empty states, and render score components plus fantasy context labels",
);

assert(
  streamersPage.includes("function jsonLdForUpcomingStreamers(streamers: UpcomingStreamersResponse)") &&
    streamersPage.includes('"@type": "ItemList"') &&
    streamersPage.includes("url: absoluteUrl(canonicalPath)") &&
    streamersPage.includes("const itemListCandidates = candidates.slice(0, 10);") &&
    streamersPage.includes("numberOfItems: itemListCandidates.length") &&
    streamersPage.includes('itemListOrder: "https://schema.org/ItemListOrderDescending"') &&
    streamersPage.includes("itemListElement: itemListCandidates.map((candidate, index) => ({") &&
    streamersPage.includes("uniqueStreamerCandidates([...streamers.twoStartPitchers, ...streamers.formRisers])") &&
    streamersPage.includes('name: "Stream Score"') &&
    streamersPage.includes('name: "Upcoming Matchups"') &&
    streamersPage.includes('name: "Heat Label"'),
  "streamers JSON-LD must describe the deduped streamer candidate list with score and matchup context",
);

assert(
  streamersImage.includes('import { ImageResponse } from "next/og";') &&
    streamersImage.includes('export const dynamic = "force-dynamic";') &&
    streamersImage.includes("export const size =") &&
    streamersImage.includes("width: 1200") &&
    streamersImage.includes("height: 630") &&
    streamersImage.includes('export const contentType = "image/png";') &&
    streamersImage.includes("getUpcomingStreamers(getHomeSlateDate())") &&
    streamersImage.includes('export const alt = "Toe the Slab upcoming fantasy pitcher streamers card";') &&
    streamersImage.includes("Upcoming Streamers") &&
    streamersImage.includes("Fantasy arms to watch this week") &&
    streamersImage.includes("streamers.twoStartPitchers[0]") &&
    streamersImage.includes("streamers.formRisers[0]") &&
    streamersImage.includes("const visualCandidates = uniqueStreamerCandidates([...streamers.twoStartPitchers, ...streamers.formRisers]).slice(0, 10);") &&
    streamersImage.includes("function uniqueStreamerCandidates(candidates: StreamerCandidate[])"),
  "streamers route must expose a dynamic 1200x630 PNG Open Graph image from deduped Upcoming streamer candidates",
);

assert(
  sitemapRoute.includes("upcomingStreamersHref") && sitemapRoute.includes("url(upcomingStreamersHref(), now, \"daily\", 0.8)"),
  "static sitemap must publish only the clean /upcoming/streamers route",
);

assert(
  siteNav.includes("{ key: \"home\" as const") &&
    siteNav.includes("{ key: \"starts\" as const") &&
    siteNav.includes("{ key: \"heat\" as const") &&
    siteNav.includes("{ key: \"live\" as const") &&
    siteNav.includes("{ key: \"upcoming\" as const") &&
    siteNav.includes("{ key: \"watchlist\" as const") &&
    !siteNav.includes("streamers"),
  "primary navigation must stay at six items with no standalone streamers nav item",
);

console.log("upcoming streamers contract ok: /upcoming/streamers lives inside Upcoming with no nav expansion");
