import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

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
const pitcherFormWindowPanel = await readFile("src/components/pitcher-form-window-panel.tsx", "utf8");
const pitcherAvailability = await readFile("src/components/pitcher-availability.tsx", "utf8");
const pitcherProfileScrollReset = await readFile("src/components/pitcher-profile-scroll-reset.tsx", "utf8");
const entityOrientation = await readFile("src/components/entity-orientation.tsx", "utf8");
const siteNav = await readFile("src/components/site-nav.tsx", "utf8");
const watchlistPage = await readFile("src/app/watchlist/page.tsx", "utf8");
const mustWatch = await readFile("src/components/tonights-must-watch.tsx", "utf8");
const formService = await readFile("src/lib/data/form-service.ts", "utf8");
const startService = await readFile("src/lib/data/start-service.ts", "utf8");
const mlbStatsClient = await readFile("src/lib/data/mlb-stats-client.ts", "utf8");
const types = await readFile("src/lib/types.ts", "utf8");

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
assert(routes.includes('export type EntitySource = "home" | "starts" | "heat" | "upcoming" | "watchlist" | "live";'), "routes must define supported entity source keys");
assert(routes.includes("export function parseEntitySource"), "routes must parse entity source query params");
assert(routes.includes("export function sourceParams"), "routes must expose a helper for source-aware entity links");
assert(routes.includes("export function parsePitcherRouteParam"), "routes must resolve canonical slug routes by trailing pitcher ID");
assert(routes.includes("export function pitcherSlug"), "routes must build readable slug-ID pitcher URLs");
assert(pitcherPage.includes("parsePitcherRouteParam(routeParams.id)"), "canonical profile route must resolve by trailing ID");
assert(pitcherPage.includes("permanentRedirect(canonicalHref)"), "numeric or mismatched pitcher profile routes must permanently redirect");
assert(pitcherPage.includes("queryString(preservedParams)"), "canonical profile redirects must preserve source/window query params");
assert(pitcherPage.includes("<PitcherFormPage"), "canonical profile route must render the rich Heat Check profile");
assert(pitcherPage.includes("initialForm={form}"), "canonical profile route must pass its canonical form payload into the rich profile to avoid a duplicate form lookup");
assert(pitcherFormPage.includes("parsePitcherRouteParam(routeParams.id)"), "legacy /form route must resolve slug or numeric params by trailing ID");
assert(pitcherFormPage.includes("initialForm?: FormPitcherResponse | null;") && pitcherFormPage.includes("const form = initialForm ?? await getPitcherForm(id, { window });"), "rich pitcher form page must reuse an initial form payload when the canonical profile route already loaded it");
assert(watchlistPage.includes('sourceParams("watchlist")'), "watchlist links must carry watchlist source context");
assert(mustWatch.includes("import { pitcherHref, sourceParams } from") && mustWatch.includes('sourceParams("upcoming")'), "Must-Watch starter links must use shared canonical pitcherHref helper with upcoming source context");
assert(formService.includes("const recentLiveFormStartsCache = new Map"), "recent live form starts must use a short in-process cache");
assert(formService.includes("const pitcherFormCache = new Map"), "individual pitcher form pages must use a short in-process cache");
assert(formService.includes("const getCachedPitcherForm = unstable_cache"), "individual pitcher form pages must use Next cache across requests");
assert(formService.includes("async function buildPitcherForm"), "pitcher form cache must wrap a single shared builder");
assert(!formService.includes("getCachedRecentLiveFormStarts"), "recent live form starts must not use Next unstable_cache because the payload can exceed the 2MB data-cache limit");
assert(
  formService.includes("const archivedStarts = await getArchivedSeasonStartSummaries(season);") &&
    formService.includes("getRecentLiveFormStarts(season, archivedStarts)") &&
    formService.includes('const cacheKey = `${season}:${today}:${latestArchivedDate ?? "none"}`;') &&
    formService.includes(".filter((date) => !latestArchivedDate || date > latestArchivedDate)") &&
    formService.includes("if (dates.length === 0) return { starts: [], truncated: false, gapDates: [] };") &&
    formService.includes("const selectedDates = dates.slice(-RECENT_FORM_RENDER_GAP_LIMIT_DAYS);") &&
    formService.includes("readRecentCanonicalFormSlate") &&
    !formService.includes("dates.map((date) => getDailySlate"),
  "pitcher form must read the stored season archive once and only read canonical slates newer than the archive",
);
assert(
  !formService.includes("Promise.all([\n    getArchivedSeasonStartSummaries(season),\n    getRecentLiveFormStarts(season),") &&
    !formService.includes("buildRecentLiveFormStarts(season, today)"),
  "pitcher form must not fan out over the recent live window after already loading archived season starts",
);
assert(
  formService.includes("const PITCHER_SEASON_FALLBACK_REVALIDATE_SECONDS = 6 * 60 * 60;") &&
    formService.includes("const getCachedPitcherSeasonFallbackStarts = unstable_cache(") &&
    formService.includes("getPitcherFormStartsWithFallback(pitcherId, season, window, startSet.starts)") &&
    formService.includes("if (bucket && bucket.starts.length >= window) return starts;") &&
    formService.includes("fetchMlbPitcherSeasonProfile(pitcherMlbId, season, { fetchLive: true })") &&
    formService.includes("pitcherProfileStartToSummary(profile, start, index)") &&
    formService.includes('line: "live-gamefeed"') &&
    formService.includes('ranking: "schedule-derived-gamefeed-line"'),
  "pitcher form must use a cached full-season MLB game-log fallback when deployed archive data is too thin for the requested window",
);
assert(mlbStatsClient.includes("const MLB_PLAYER_PROFILE_REVALIDATE_SECONDS = 15 * 60;"), "MLB player profile requests must have a snappy shared revalidation window");
assert(mlbStatsClient.includes("cachedRequestInit(options, MLB_PLAYER_PROFILE_REVALIDATE_SECONDS)"), "MLB player profile requests must use Next fetch caching instead of no-store on every profile click");
assert(!mlbStatsClient.includes('people/${pitcherMlbId}", { cache: "no-store"'), "pitcher identity fetch must not no-store on every profile click");
assert(!mlbStatsClient.includes('stats?${seasonParams.toString()}`, { cache: "no-store"'), "pitcher season stats fetch must not no-store on every profile click");
assert(!mlbStatsClient.includes('stats?${batterHandParams.toString()}`, { cache: "no-store"'), "pitcher splits fetch must not no-store on every profile click");
assert(
  mlbStatsClient.includes("export async function fetchMlbPitcherAvailabilityStatuses") &&
    mlbStatsClient.includes('hydrate: "currentTeam,rosterEntries,transactions"') &&
    mlbStatsClient.includes("isInjuredListStatus(statusCode, statusDescription)") &&
    mlbStatsClient.includes("source: \"mlb-roster-entries\""),
  "MLB roster-entry availability must batch-fetch pitcher IL status from the official people API",
);
assert(
  startService.includes('fetchMlbPitcherSplits(pitcher.mlbId, getHomeSlateDate().slice(0, 4), { fetchLive: process.env.THE_BUMP_LIVE_MLB === "1" })') &&
    !startService.includes("fetchMlbPitcherSplits(pitcher.mlbId, getHomeSlateDate().slice(0, 4), { fetchLive: true })"),
  "pitcher API must not force live MLB split calls during normal archived profile renders",
);
assert(
  startService.includes('process.env.THE_BUMP_LIVE_MLB === "1" || !archivedSeasonProfile') &&
    startService.includes("fetchMlbPitcherSeasonProfile(pitcherMlbId, season, { fetchLive: true })") &&
    startService.includes('process.env.THE_BUMP_LIVE_MLB !== "1" ? null : await fetchMlbPitcherRecentArsenal'),
  "pitcher API must use cached MLB season profile as a missing-archive fallback without forcing live arsenal gamefeed fanout",
);

assert(
  types.includes("export type FormVenueSplitLabel") &&
    types.includes('label: "HOME FORTRESS" | "ROAD WARRIOR";') &&
    types.includes('window: "current-plus-prior";') &&
    types.includes('side?: "home" | "away";'),
  "types must expose conservative home/road split labels and preserve start side for venue splits",
);
assert(
  types.includes("export type PitcherAvailability") &&
    types.includes('status: "injured-list";') &&
    types.includes("availability?: PitcherAvailability | null;"),
  "types must expose a shared current pitcher availability payload on form/upcoming surfaces",
);

assert(
    formService.includes("fetchMlbPitcherAvailabilityStatuses") &&
    formService.includes("attachAvailability(summaries, availabilityStatuses)") &&
    formService.includes("availability: availabilityStatuses.get(pitcher.pitcherId) ?? null"),
  "form service must attach MLB IL status once at the shared FormSummary layer",
);

assert(
  pitcherAvailability.includes('data-responsive-check="pitcher-availability-note"') &&
    pitcherAvailability.includes("availability.blurb") &&
    pitcherAvailability.includes(">IL</span>"),
  "pitcher availability component must render a compact IL badge with the MLB-derived blurb",
);

assert(
  formService.includes("const VENUE_SPLIT_MIN_STARTS_PER_SIDE = 7;") &&
    formService.includes("const VENUE_SPLIT_MIN_GAP = 11;") &&
    formService.includes("function getStableVenueSplitStarts") &&
    formService.includes("getQualifiedFormStarts(previousSeason)") &&
    formService.includes("buildVenueSplitLabel(venueSplitStarts)") &&
    formService.includes("homeStarts.length < VENUE_SPLIT_MIN_STARTS_PER_SIDE || awayStarts.length < VENUE_SPLIT_MIN_STARTS_PER_SIDE") &&
    formService.includes("if (gap < VENUE_SPLIT_MIN_GAP) return null;") &&
    formService.includes("strongGsPlus >= 50") &&
    formService.includes("weakGsPlus <= 50 || tierRank(strongTier) - tierRank(weakTier) >= 1"),
  "form service must fire home/road labels only after sample, gap, and direction gates over current+prior seasons",
);

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
assert(
  types.includes("export type PitcherVelocityStart = {") &&
    types.includes("velocityByStart: PitcherVelocityStart[];") &&
    startService.includes("function buildPitcherVelocityByStart") &&
    startService.includes("belowSeasonMedian: row.avgVelocityMph <= medianVelocity - 1") &&
    pitcherFormPage.includes('data-responsive-check="pitcher-velocity-by-start"') &&
    pitcherFormPage.includes("<VelocityByStartPanel starts={pitcher.velocityByStart} />") &&
    pitcherFormPage.includes("low velo"),
  "pitcher profile must expose velocity by start with a one mph below-median flag",
);
assert(
  types.includes("export type PitcherPitchMixStart = {") &&
    types.includes("pitchMixByStart: PitcherPitchMixStart[];") &&
    startService.includes("function buildPitcherPitchMixByStart") &&
    startService.includes("usagePct: Math.max(1, Math.round((count / pitchEvents.length) * 100))") &&
    pitcherFormPage.includes('data-responsive-check="pitcher-pitch-mix-by-start"') &&
    pitcherFormPage.includes("<PitchMixByStartPanel starts={pitcher.pitchMixByStart} />") &&
    pitcherFormPage.includes("Pitch mix / by start"),
  "pitcher profile must expose pitch mix by start from existing pitch events",
);
assert(pitcherFormPage.includes("<PitcherAvailabilityNote availability={summary.availability}"), "pitcher form hero must show current MLB IL availability when present");
assert(
  pitcherFormPage.includes('import { PitcherProfileScrollReset } from "@/components/pitcher-profile-scroll-reset";') &&
    pitcherFormPage.includes("<PitcherProfileScrollReset />") &&
    pitcherProfileScrollReset.includes('"use client";') &&
    pitcherProfileScrollReset.includes('pathname.startsWith("/pitchers/")') &&
    pitcherProfileScrollReset.includes("window.scrollTo(0, 0)") &&
    pitcherProfileScrollReset.includes("document.documentElement.scrollTop = 0") &&
    pitcherProfileScrollReset.includes("window.requestAnimationFrame") &&
    pitcherProfileScrollReset.includes("[100, 350, 800]"),
  "pitcher profile route must force top-of-page placement after client navigation from long boards",
);
assert(pitcherFormPage.includes('className="min-h-screen overflow-x-hidden bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8"'), "pitcher form shell must prevent page-level horizontal scroll on mobile");
assert(pitcherFormPage.includes("sm:grid-cols-[minmax(0,1fr)_auto_auto]"), "pitcher form score/actions row must keep score text separate from controls");
assert(pitcherFormPage.includes("font-bold leading-none"), "pitcher form score must use a tight line-height so it cannot collide with its label");
assert(pitcherFormPage.includes("[overflow-wrap:anywhere]"), "pitcher form stat line must be allowed to wrap inside the header");
assert(!pitcherFormPage.includes('<div className="mt-5 flex flex-wrap items-center gap-3">'), "pitcher form score/action row must not return to the overlapping flex layout");

assert(
  pitcherFormPage.includes("getTodayProbables") &&
    pitcherFormPage.includes("getProfileNextStart") &&
    pitcherFormPage.includes('data-responsive-check="pitcher-next-start-projection"') &&
    pitcherFormPage.includes("NEXT: {nextStart.label} · Proj GS+ {nextStart.projectedGsPlus}") &&
    pitcherFormPage.includes("venueSplitContextForNextStart") &&
    pitcherFormPage.includes('data-responsive-check="home-road-next-start-context"') &&
    pitcherFormPage.includes("start tailwind") &&
    pitcherFormPage.includes("start headwind"),
  "pitcher profile must surface a next-start projection from probable-start data with contextual home/road tailwind or headwind when the split qualifies",
);

assert(
  pitcherFormPage.includes("getRecentStartDepthWithHighlights") &&
    pitcherFormPage.includes("const pitcherPromise = getPitcherApiResponse(id);") &&
    pitcherFormPage.includes("const recentDepthBundlePromise = getRecentStartDepthWithHighlights(recentStartIds);") &&
    pitcherFormPage.includes("const nextStartPromise = getProfileNextStart(summary.pitcherId, summary.rgs);") &&
    pitcherFormPage.includes("const followedIdsPromise = getWatchlistPitcherIds(accountId);"),
  "pitcher profile must start slower profile, recent-start, next-start, and watchlist reads without serializing them",
);

assert(
  pitcherFormPage.includes('import { Suspense } from "react";') &&
    pitcherFormPage.includes("<ProfileNextStartPill nextStartPromise={nextStartPromise}") &&
    pitcherFormPage.includes("<PitcherScoutingSection pitcherPromise={pitcherPromise}") &&
    pitcherFormPage.includes("<PitcherGameLogSection") &&
    pitcherFormPage.includes("<Suspense fallback={null}>") &&
    !pitcherFormPage.includes("NextStartPillSkeleton") &&
    !pitcherFormPage.includes("PitcherScoutingSkeleton") &&
    !pitcherFormPage.includes("PitcherGameLogSkeleton"),
  "pitcher profile must stream slower below-the-fold sections without non-live skeleton loading states",
);

assert(
  !existsSync("src/app/pitchers/[id]/loading.tsx") &&
    !existsSync("src/app/pitchers/loading.tsx") &&
    !existsSync("src/components/route-loading-shell.tsx"),
  "canonical pitcher profile route must not provide a page-level loading shell during idle cached navigation",
);

assert(
  pitcherFormPage.includes("PitcherFormWindowPanel") &&
    pitcherFormPage.includes("initialWindow={window}") &&
    pitcherFormPage.includes("series={series}") &&
    !pitcherFormPage.includes("href={pitcherHref(summary, sourceParams(source, value === FORM_CONFIG.windowDefault ? undefined : { window: value }))}"),
  "pitcher form Last 3/5/10 controls must be local chart toggles, not full profile route reload links",
);

assert(
  pitcherFormWindowPanel.includes('"use client";') &&
    pitcherFormWindowPanel.includes("useState<FormWindow>(initialWindow)") &&
    pitcherFormWindowPanel.includes("type=\"button\"") &&
    pitcherFormWindowPanel.includes("aria-pressed={activeWindow === value}") &&
    pitcherFormWindowPanel.includes("recalculateRollingSeries(series, activeWindow)") &&
    pitcherFormWindowPanel.includes("FORM_CONFIG.windows.map") &&
    !pitcherFormWindowPanel.includes("<Link"),
  "pitcher form window panel must recalculate rolling GS+ in the browser without navigating",
);

assert(
  pitcherFormPage.includes("function ArsenalTable") &&
    pitcherFormPage.includes('data-responsive-check="pitcher-arsenal-table"') &&
    pitcherFormPage.includes('className="min-w-0 rounded border border-white/10 bg-[#101014] p-4 sm:p-5" data-responsive-check="pitcher-arsenal-table"') &&
    pitcherFormPage.includes('className="max-w-full overflow-x-auto"') &&
    pitcherFormPage.includes("Arsenal / pitch mix") &&
    pitcherFormPage.includes("Put-away") &&
    pitcherFormPage.includes("xwOBA") &&
    pitcherFormPage.includes("out pitch"),
  "pitcher profile must render a serious arsenal table with usage, whiff, put-away, xwOBA, and out-pitch highlight",
);

assert(
  pitcherFormPage.includes("function AdvancedPercentilePanel") &&
    pitcherFormPage.includes('data-responsive-check="pitcher-advanced-percentiles"') &&
    pitcherFormPage.includes('className="min-w-0 rounded border border-white/10 bg-[#101014] p-4 sm:p-5" data-responsive-check="pitcher-advanced-percentiles"') &&
    pitcherFormPage.includes("Whiff%") &&
    pitcherFormPage.includes("CSW%") &&
    pitcherFormPage.includes("Barrel%") &&
    pitcherFormPage.includes("th pct"),
  "pitcher profile must render advanced metric percentile bars",
);

assert(
  pitcherFormPage.includes("function SplitsPanel") &&
    pitcherFormPage.includes('data-responsive-check="pitcher-splits-panel"') &&
    pitcherFormPage.includes('className="min-w-0 rounded border border-white/10 bg-[#101014] p-4 sm:p-5" data-responsive-check="pitcher-splits-panel"') &&
    pitcherFormPage.includes('data-responsive-check="home-road-split-badge"') &&
    pitcherFormPage.includes('data-responsive-check="home-road-split-evidence"') &&
    pitcherFormPage.includes("<HomeRoadSplitBadge split={summary.venueSplit} />") &&
    pitcherFormPage.includes("Home GS+ {venueSplit.home.gsPlus.toFixed(1)}") &&
    pitcherFormPage.includes("Times through order") &&
    pitcherFormPage.includes("wOBA"),
  "pitcher profile must render scouting splits, gated home/road evidence when present, and times-through-order placeholder",
);

assert(
  pitcherFormPage.includes('className="grid min-w-0 gap-5 pb-8 lg:grid-cols-[minmax(0,1fr)_360px]" data-responsive-check="pitcher-profile-scouting"') &&
    pitcherFormPage.includes('<div className="min-w-0 space-y-5">') &&
    pitcherFormPage.includes('<section className="grid min-w-0 gap-5 pb-8 lg:grid-cols-[minmax(0,1fr)_360px]">') &&
    pitcherFormWindowPanel.includes('className="max-w-full overflow-x-auto rounded border border-white/10 bg-[#101014] p-4" data-responsive-check="form-trend-chart"') &&
    pitcherFormWindowPanel.includes('className="block w-full" viewBox={`0 0 ${width} ${height}`}'),
  "pitcher form mobile panels must stay constrained while wide chart/table content scrolls inside its own panel",
);

assert(
  pitcherFormPage.includes("function GameLogRow") &&
    pitcherFormPage.includes('data-responsive-check="pitcher-game-log-row"') &&
    pitcherFormPage.includes("<details") &&
    !pitcherFormPage.includes("function RecentStartDepth"),
  "pitcher profile must consolidate recent start depth into expandable game-log rows instead of a duplicate start list",
);

console.log("pitcher page contract ok: canonical slug profile, shared nav, redirects, and hero headshot profile are present");
