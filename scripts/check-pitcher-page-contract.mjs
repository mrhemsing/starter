import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const packageJson = await readFile("package.json", "utf8");
const headshotComponent = await readFile("src/components/headshot.tsx", "utf8");
const routes = await readFile("src/lib/routes.ts", "utf8");
const pitcherPage = await readFile("src/app/pitchers/[id]/page.tsx", "utf8");
const pitcherFormPage = await readFile("src/app/pitchers/[id]/form/page.tsx", "utf8");
const entityOrientation = await readFile("src/components/entity-orientation.tsx", "utf8");
const siteNav = await readFile("src/components/site-nav.tsx", "utf8");
const watchlistPage = await readFile("src/app/watchlist/page.tsx", "utf8");
const mustWatch = await readFile("src/components/tonights-must-watch.tsx", "utf8");
const formService = await readFile("src/lib/data/form-service.ts", "utf8");

assert(
  packageJson.includes('"check:pitcher-pages": "node scripts/check-pitcher-page-contract.mjs"') ||
    packageJson.includes('"check:pitcher-pages": "node scripts/check-pitcher-pages-contract.mjs"'),
  "package scripts must expose the pitcher page contract",
);

assert(
  headshotComponent.includes('export type HeadshotSize = "hero" | "xl" | "lg" | "md" | "sm" | "xs";') &&
    headshotComponent.includes('hero: "h-[112px] w-[75px] sm:h-[132px] sm:w-[88px] lg:h-[148px] lg:w-[99px]"') &&
    headshotComponent.includes('if (size === "hero") return 320;'),
  "shared headshot component must expose a larger hero size for pitcher page headers",
);

assert(routes.includes("export function pitcherHref"), "routes must expose one shared pitcherHref helper");
assert(routes.includes("export function startHref"), "routes must expose one shared startHref helper");
assert(routes.includes('export type EntitySource = "home" | "starts" | "heat" | "upcoming" | "watchlist";'), "routes must define supported entity source keys");
assert(routes.includes("export function parseEntitySource"), "routes must parse entity source query params");
assert(routes.includes("export function sourceParams"), "routes must expose a helper for source-aware entity links");
assert(routes.includes("export function parsePitcherRouteParam"), "routes must resolve canonical slug routes by trailing pitcher ID");
assert(routes.includes("export function pitcherSlug"), "routes must build readable slug-ID pitcher URLs");
assert(pitcherPage.includes("parsePitcherRouteParam(routeParams.id)"), "canonical profile route must resolve by trailing ID");
assert(pitcherPage.includes("permanentRedirect(canonicalHref)"), "numeric or mismatched pitcher profile routes must permanently redirect");
assert(pitcherPage.includes("queryString(preservedParams)"), "canonical profile redirects must preserve source/window query params");
assert(pitcherPage.includes("<PitcherFormPage"), "canonical profile route must render the rich Heat Check profile");
assert(pitcherFormPage.includes("parsePitcherRouteParam(routeParams.id)"), "legacy /form route must resolve slug or numeric params by trailing ID");
assert(watchlistPage.includes('sourceParams("watchlist")'), "watchlist links must carry watchlist source context");
assert(mustWatch.includes("import { pitcherHref, sourceParams } from") && mustWatch.includes('sourceParams("upcoming")'), "Must-Watch starter links must use shared canonical pitcherHref helper with upcoming source context");
assert(formService.includes("const recentLiveFormStartsCache = new Map"), "recent live form starts must use a short in-process cache");
assert(!formService.includes("getCachedRecentLiveFormStarts"), "recent live form starts must not use Next unstable_cache because the payload can exceed the 2MB data-cache limit");

assert(
  entityOrientation.includes("router.back()") &&
    entityOrientation.includes("window.history.state") &&
    entityOrientation.includes("document.referrer") &&
    entityOrientation.includes('data-entity-back-control="true"') &&
    entityOrientation.includes("← Back to {sourceLabel}") &&
    entityOrientation.includes('aria-label="Breadcrumb"'),
  "entity orientation must render a visible source-aware back control and breadcrumb while preserving router back",
);

assert(
  siteNav.includes("active: NavKey | null") &&
    siteNav.includes("active !== null && item.key === active"),
  "site nav must support neutral entity pages without falsely highlighting a section",
);

for (const [label, source] of [
  ["pitcher form", pitcherFormPage],
]) {
  assert(source.includes('import { SiteHeader } from "@/components/site-header";'), `${label} must import shared site header`);
  assert(source.includes("getHomeSlateDate"), `${label} must resolve today for shared site navigation`);
  assert(source.includes('<SiteHeader active={null} today={today} responsiveCheck="pitcher-form-site-header" />'), `${label} must keep the shared Toe the Slab wordmark/nav header`);
  assert(source.includes('className="flex max-w-5xl items-start gap-4 sm:gap-6"'), `${label} header must align the headshot to the left of the name block`);
  assert(source.includes('size="hero"'), `${label} header must use the larger hero headshot`);
  assert(!source.includes('md:grid-cols-[1fr_240px]'), `${label} header must not keep the old detached right-column headshot layout`);
  assert(!source.includes('className="mx-auto"'), `${label} header headshot must not be centered away from the name`);
}

assert(
  pitcherFormPage.includes('<SiteHeader active={null} today={today} responsiveCheck="pitcher-form-site-header" />') &&
    pitcherFormPage.includes("<EntityOrientation"),
  "pitcher form must render the shared header with neutral nav and source-aware orientation",
);

assert(
  pitcherFormPage.includes('const source = parseEntitySource(query?.from, "heat");') &&
    pitcherFormPage.includes("entitySourceHref(source") &&
    pitcherFormPage.includes("sourceParams(source") &&
    pitcherFormPage.includes("startHref(nextStart.startId, sourceParams(source))") &&
    pitcherFormPage.includes("startHref(start.id, sourceParams(source))"),
  "pitcher form links must preserve source context across profile tabs and start deep dives",
);

assert(pitcherFormPage.includes('data-responsive-check="pitcher-form-score-summary"'), "pitcher form score block must expose a stable layout hook");
assert(pitcherFormPage.includes("sm:grid-cols-[minmax(0,1fr)_auto_auto]"), "pitcher form score/actions row must keep score text separate from controls");
assert(pitcherFormPage.includes("font-bold leading-none"), "pitcher form score must use a tight line-height so it cannot collide with its label");
assert(pitcherFormPage.includes("[overflow-wrap:anywhere]"), "pitcher form stat line must be allowed to wrap inside the header");
assert(!pitcherFormPage.includes('<div className="mt-5 flex flex-wrap items-center gap-3">'), "pitcher form score/action row must not return to the overlapping flex layout");

assert(
  pitcherFormPage.includes("getTodayProbables") &&
    pitcherFormPage.includes("getProfileNextStart") &&
    pitcherFormPage.includes('data-responsive-check="pitcher-next-start-projection"') &&
    pitcherFormPage.includes("NEXT: {nextStart.label} · Proj GS+"),
  "pitcher profile must surface a next-start projection from probable-start data",
);

assert(
  pitcherFormPage.includes("function ArsenalTable") &&
    pitcherFormPage.includes('data-responsive-check="pitcher-arsenal-table"') &&
    pitcherFormPage.includes("Arsenal / pitch mix") &&
    pitcherFormPage.includes("Put-away") &&
    pitcherFormPage.includes("xwOBA") &&
    pitcherFormPage.includes("out pitch"),
  "pitcher profile must render a serious arsenal table with usage, whiff, put-away, xwOBA, and out-pitch highlight",
);

assert(
  pitcherFormPage.includes("function AdvancedPercentilePanel") &&
    pitcherFormPage.includes('data-responsive-check="pitcher-advanced-percentiles"') &&
    pitcherFormPage.includes("Whiff%") &&
    pitcherFormPage.includes("CSW%") &&
    pitcherFormPage.includes("Barrel%") &&
    pitcherFormPage.includes("th pct"),
  "pitcher profile must render advanced metric percentile bars",
);

assert(
  pitcherFormPage.includes("function SplitsPanel") &&
    pitcherFormPage.includes('data-responsive-check="pitcher-splits-panel"') &&
    pitcherFormPage.includes("Times through order") &&
    pitcherFormPage.includes("wOBA"),
  "pitcher profile must render scouting splits including times-through-order placeholder",
);

assert(
  pitcherFormPage.includes("function GameLogRow") &&
    pitcherFormPage.includes('data-responsive-check="pitcher-game-log-row"') &&
    pitcherFormPage.includes("<details") &&
    !pitcherFormPage.includes("function RecentStartDepth"),
  "pitcher profile must consolidate recent start depth into expandable game-log rows instead of a duplicate start list",
);

console.log("pitcher page contract ok: canonical slug profile, shared nav, redirects, and hero headshot profile are present");
