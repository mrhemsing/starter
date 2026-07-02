import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const [recapPage, routes, sitemapRoute] = await Promise.all([
  readFile("src/app/starts/[id]/[slug]/page.tsx", "utf8"),
  readFile("src/lib/routes.ts", "utf8"),
  readFile("src/app/sitemaps/[kind]/route.ts", "utf8"),
]);

assert(
  recapPage.includes("type StartRecapPageProps =") &&
    recapPage.includes("id: string;") &&
    recapPage.includes("slug: string;") &&
    recapPage.includes("async function resolveStartRecap(date: string, slug: string)") &&
    recapPage.includes('if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) return null;'),
  "start recap pages must use /starts/{yyyy-mm-dd}/{pitcher-slug} routing and reject non-date parents",
);

assert(
  recapPage.includes("const pageData = await getRankedStartsPageData(date);") &&
    recapPage.includes('pageData.slateStarts.filter((start) => start.source?.line !== "fixture")') &&
    recapPage.includes("const start = await getStartDetail(match.id);") &&
    recapPage.includes("canonicalPath: startRecapPath(start, slateStarts),"),
  "start recap pages must resolve from ranked slate data and hydrate the canonical start detail",
);

assert(
  routes.includes("export function startRecapPath(") &&
    routes.includes("return `/starts/${start.date}/${startRecapSlug(start, slateStarts)}`;") &&
    routes.includes("export function startRecapSlug(") &&
    routes.includes("sameSlugCount > 1 ? `${baseSlug}-${start.gamePk}` : baseSlug") &&
    routes.includes("function slugifyRouteText(") &&
    routes.includes(".replace(/[^a-z0-9]+/g, \"-\")") &&
    recapPage.includes('import { pitcherHref, rankedStartsPath, sourceParams, startHref, startRecapPath, startRecapSlug } from "@/lib/routes";') &&
    recapPage.includes("startRecapSlug(start, slateStarts) === slug"),
  "start recap slugging must be readable and add a game suffix for same-day slug collisions",
);

assert(
  recapPage.includes("export async function generateMetadata") &&
    recapPage.includes("alternates: { canonical: canonicalPath }") &&
    recapPage.includes("openGraph:") &&
    recapPage.includes("twitter:"),
  "start recap pages must emit canonical and share metadata",
);

assert(
  recapPage.includes('"@type": "SportsEvent"') &&
    recapPage.includes("url: absoluteUrl(canonicalPath)") &&
    recapPage.includes('"@type": "SportsTeam"') &&
    recapPage.includes('"@type": "Person"'),
  "start recap pages must include SportsEvent structured data sourced from the start",
);

assert(
  recapPage.includes("recapSummary(start)") &&
    recapPage.includes("formatStartLine(start.line)") &&
    recapPage.includes("GSv2 {start.gameScoreV2 ?? \"pending\"}") &&
    recapPage.includes("formatDecision(start.result)") &&
    recapPage.includes("start.eventFlags ?? []"),
  "start recap pages must render canonical line, GS+, GSv2, decision, and event-flag-aware summary context",
);

assert(
  recapPage.includes("pitcherHref({ id: start.pitcher.id, name: start.pitcher.name }, sourceParams(\"starts\"))") &&
    recapPage.includes("rankedStartsPath(start.date)") &&
    recapPage.includes("startHref(start, sourceParams(\"starts\"))") &&
    recapPage.includes("Opposing starter recap"),
  "start recap pages must link to pitcher, ranked slate, full start log, and paired recap when present",
);

assert(
  sitemapRoute.includes('import { duelsPath, heatCheckPath, rankedStartsPath, startRecapPath, upcomingDateHref, upcomingWeekHref } from "@/lib/routes";') &&
    sitemapRoute.includes('if (kind === "starts") {') &&
    sitemapRoute.includes('url(startRecapPath(start, starts), dateLastmod(start.date), "monthly", 0.6)') &&
    !sitemapRoute.includes("url(startPath(start.id)"),
  "starts sitemap must publish per-start recap URLs instead of the old start-id log URLs",
);

console.log("start recap pages contract ok: canonical recap route, metadata, JSON-LD, sitemap URLs, and context links are pinned");
