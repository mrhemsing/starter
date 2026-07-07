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
const headlineService = await readFile("src/lib/data/watchlist-headlines-service.ts", "utf8");
const mustWatch = await readFile("src/components/tonights-must-watch.tsx", "utf8");
const formService = await readFile("src/lib/data/form-service.ts", "utf8");
const startService = await readFile("src/lib/data/start-service.ts", "utf8");
const mlbStatsClient = await readFile("src/lib/data/mlb-stats-client.ts", "utf8");
const supabaseArchive = await readFile("src/lib/data/supabase-archive.ts", "utf8");
const supabaseSchema = await readFile("docs/supabase-mlb-archive.sql", "utf8");
const supabaseSync = await readFile("scripts/sync-supabase-mlb-archive.mjs", "utf8");
const types = await readFile("src/lib/types.ts", "utf8");
const arsenalDataOps = await readFile("docs/arsenal-data-ops.md", "utf8");

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
  startService.includes('const REQUEST_TIME_SAVANT_PITCH_DETAIL_FLAG = "THE_BUMP_REQUEST_TIME_SAVANT_PITCH_DETAIL";') &&
    startService.includes("function shouldFetchRequestTimeSavantPitchDetails()") &&
    startService.includes("process.env[REQUEST_TIME_SAVANT_PITCH_DETAIL_FLAG] === \"1\"") &&
    startService.includes("async function fetchRequestTimeSavantPitchDetails") &&
    startService.includes("if (!shouldFetchRequestTimeSavantPitchDetails()) return null;") &&
    startService.includes("fetchRequestTimeSavantPitchDetails(schedule.date, matchedStart.gamePk, matchedStart.pitcher.mlbId)") &&
    startService.includes("fetchRequestTimeSavantPitchDetails(date, start.gamePk, start.pitcherMlbId)") &&
    !startService.includes("?? await fetchSavantStartPitchDetails(schedule.date") &&
    !startService.includes(": await fetchSavantStartPitchDetails(date"),
  "start detail must keep Baseball Savant pitch-detail fallback behind an explicit request-time flag",
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
    pitcherFormPage.includes("if (rows.length < 2) return null;") &&
    pitcherFormPage.includes("low velo"),
  "pitcher profile must expose velocity by start with a one mph below-median flag",
);
assert(
    types.includes("export type PitcherPitchMixStart = {") &&
    types.includes("pitchMixByStart: PitcherPitchMixStart[];") &&
    types.includes("newPitchTypes: PitchTypeKey[];") &&
    types.includes("firstSeen: boolean;") &&
    startService.includes("function buildPitcherPitchMixByStart") &&
    startService.includes("function summarizePitchUsage") &&
    startService.includes("const seenPitchTypes = new Set<PitchTypeKey>();") &&
    startService.includes("const newPitchTypes = previousUsage.size > 0") &&
    startService.includes("firstSeen: newPitchTypeSet.has(type)") &&
    startService.includes("for (const type of byType.keys()) seenPitchTypes.add(type);") &&
    startService.includes("usagePct: Math.max(1, Math.round((count / pitchEvents.length) * 100))") &&
    startService.includes("usageDeltaPct: previousUsage.size > 0") &&
    pitcherFormPage.includes('data-responsive-check="pitcher-pitch-mix-by-start"') &&
    pitcherFormPage.includes("<PitchMixByStartPanel starts={pitcher.pitchMixByStart} />") &&
    pitcherFormPage.includes("if (rows.length < 2) return null;") &&
    pitcherFormPage.includes("Pitch mix / by start") &&
    pitcherFormPage.includes("usage shift") &&
    pitcherFormPage.includes("New {pitchTypes[type].name}") &&
    pitcherFormPage.includes("new pitch"),
  "pitcher profile must expose pitch mix by start, start-over-start usage deltas, and first-seen pitch type events from existing pitch events",
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
    pitcherFormPage.includes("const wireEventsPromise = readOrFetchPitcherHeadlineEvents([summary]);") &&
    pitcherFormPage.includes("const followedIdsPromise = getWatchlistPitcherIds(accountId);"),
  "pitcher profile must start slower profile, recent-start, next-start, Wire, and watchlist reads without serializing them",
);

assert(
  pitcherFormPage.includes('import { Suspense } from "react";') &&
    pitcherFormPage.includes("<ProfileNextStartPill nextStartPromise={nextStartPromise}") &&
    pitcherFormPage.includes("<PitcherProfileBody") &&
    pitcherFormPage.includes("pitcherPromise={pitcherPromise}") &&
    pitcherFormPage.includes("<Suspense fallback={<PitcherProfileBodyFallback />}>") &&
    pitcherFormPage.includes("function PitcherProfileBodyFallback") &&
    pitcherFormPage.includes('data-responsive-check="pitcher-profile-body-loading"') &&
    pitcherFormPage.includes('aria-busy="true"') &&
    pitcherFormPage.includes("Loading pitcher details") &&
    !pitcherFormPage.includes("Profile shell and controls are ready while pitcher modules stream in"),
  "pitcher profile must show an in-page loading state while slower below-the-fold sections stream",
);

assert(
  pitcherFormPage.includes('import { readOrFetchPitcherHeadlineEvents } from "@/lib/data/watchlist-headlines-service";') &&
    pitcherFormPage.includes("sortPitcherWireEvents") &&
    pitcherFormPage.includes("<PitcherWirePanel events={wireEvents} />") &&
    pitcherFormPage.includes("if (events.length === 0) return null;") &&
    pitcherFormPage.includes('data-responsive-check="pitcher-profile-wire"') &&
    pitcherFormPage.includes("News for this arm") &&
    pitcherFormPage.includes("events.slice(0, 8)") &&
    pitcherFormPage.includes("data-wire-visible-count={visibleEvents.length}") &&
    pitcherFormPage.includes("data-wire-hidden-count={hiddenCount}") &&
    pitcherFormPage.includes("data-wire-more") &&
    !pitcherFormPage.includes("No recent Wire items for") &&
    !pitcherFormPage.includes(">NEWS<") &&
    pitcherFormPage.includes('target="_blank"') &&
    pitcherFormPage.includes('rel="noopener"') &&
    pitcherFormPage.includes("event.headline?.source ?? \"News\"") &&
    pitcherFormPage.includes("relativeEventTime(event.headline?.publishedAt ?? event.detectedAt)") &&
    pitcherFormPage.includes("data-wire-eyebrow") &&
    pitcherFormPage.includes('aria-label="Unread Wire item"') &&
    watchlistPage.includes("function WireEventCard") &&
    watchlistPage.includes("event.headline?.source ?? \"News\"") &&
    watchlistPage.includes("relativeEventTime(event.headline?.publishedAt ?? event.detectedAt)") &&
    watchlistPage.includes("formatArticleDate(detectedAt)"),
  "pitcher profile must render capped API-backed Wire headline links with source/time eyebrows, no redundant NEWS chip, and a more affordance",
);

assert(
  headlineService.includes("export async function readOrFetchPitcherHeadlineEvents(pitchers: FormSummary[])") &&
    headlineService.includes("const events = await readWatchlistHeadlineEvents(pitchers.map((pitcher) => pitcher.pitcherId));") &&
    headlineService.includes("const missingPitchers = pitchers.filter((pitcher) => !events.has(pitcher.pitcherId));") &&
    headlineService.includes("const adapters = await activeAdapters();") &&
    headlineService.includes("await adapter.fetch(pitcher)") &&
    headlineService.includes("filterHeadlineCandidate(candidate, pitcher, allPitchers)") &&
    headlineService.includes("appendHeadline(filtered)") &&
    headlineService.includes("return readWatchlistHeadlineEvents(pitchers.map((pitcher) => pitcher.pitcherId));") &&
    headlineService.includes("collapseHeadlineClusters(state.headlines)") &&
    headlineService.includes("sameHeadlineCluster(existing.headline, candidate.headline)") &&
    headlineService.includes("headlineFetchAttemptKey(pitcher.pitcherId)") &&
    headlineService.includes("resolveGoogleNewsArticleMetadata(item.link)") &&
    headlineService.includes("fetchPublisherArticleMetadata(publisherUrl)") &&
    headlineService.includes("publishedDateTime") &&
    headlineService.includes("sourceHref") &&
    headlineService.includes("const HEADLINE_STATE_VERSION = 5;") &&
    headlineService.includes("const HEADLINE_FRESHNESS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;") &&
    headlineService.includes("isPublishedWithinHeadlineWindow(headline.publishedAt") &&
    headlineService.includes("isPublishedWithinHeadlineWindow(publishedAt)") &&
    headlineService.includes("when:7d") &&
    headlineService.includes(".filter((item) => isLikelyPitcherHeadline(item.title, pitcher))") &&
    headlineService.includes("const headlineTokens = new Set(normalizedTokens(headline));") &&
    headlineService.includes("if (!headlineTokens.has(normalizeText(surname))) return null;") &&
    headlineService.includes("containsTokenPhrase(headlineTokens, pitcherTokens)") &&
    headlineService.includes("containsTokenPhrase(headlineTokens, normalizedTokens(other.name))") &&
    watchlistPage.includes("sortWatchlistWireEvents") &&
    pitcherFormPage.includes("sortPitcherWireEvents(wireEventsByPitcher.get(summary.pitcherId) ?? [], summary.name)") &&
    (await readFile("src/lib/data/watchlist-service.ts", "utf8")).includes("export function sortPitcherWireEvents"),
  "pitcher profile Wire must fetch related articles on demand from headline APIs, resolve syndicated Google News items to publisher dates, require token-level pitcher relevance, reuse stored events, dedupe duplicate stories before render, and rank direct-subject headlines first",
);

assert(
  existsSync("src/app/pitchers/[id]/loading.tsx") &&
    !existsSync("src/app/pitchers/loading.tsx") &&
    existsSync("src/components/route-loading-shell.tsx"),
  "canonical pitcher profile route must provide a shell-first loading fallback without adding a parent-level pitcher overlay",
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
    pitcherFormWindowPanel.includes('className="mt-2 flex flex-wrap gap-2" data-responsive-check="pitcher-form-local-window-controls"') &&
    pitcherFormWindowPanel.includes('className="mt-4 max-w-full overflow-x-auto rounded border border-white/10 bg-[#101014] p-4" data-responsive-check="form-trend-chart"') &&
    !pitcherFormWindowPanel.includes("<Link"),
  "pitcher form window panel must recalculate rolling GS+ in the browser without navigating and keep breathing room around controls/chart",
);

assert(
    pitcherFormPage.includes("function ArsenalTable") &&
    pitcherFormPage.includes("formatArsenalSourceLabel(pitcher)") &&
    pitcherFormPage.includes("formatArsenalSourceTitle(pitcher)") &&
    pitcherFormPage.includes('return `Archive through ${pitcher.source.archiveArsenal.lastStartDate}`;') &&
    pitcherFormPage.includes('return "More data after next archive run";') &&
    pitcherFormPage.includes("if (pitches.length === 0) return null;") &&
    pitcherFormPage.includes('data-responsive-check="pitcher-arsenal-table"') &&
    pitcherFormPage.includes('className="min-w-0 rounded border border-white/10 bg-[#101014] p-4 sm:p-5" data-responsive-check="pitcher-arsenal-table"') &&
    pitcherFormPage.includes('className="max-w-full overflow-x-auto"') &&
    pitcherFormPage.includes("Arsenal / pitch mix") &&
    pitcherFormPage.includes("Put-away") &&
    pitcherFormPage.includes("CSW") &&
    !pitcherFormPage.includes("estimateXwoba") &&
    pitcherFormPage.includes("out pitch"),
  "pitcher profile must render a serious archive-backed arsenal table with usage, whiff, put-away, CSW, and out-pitch highlight",
);

assert(
  startService.includes("arsenal: archivedArsenal?.arsenal ?? liveArsenal?.arsenal ?? []") &&
    startService.includes("arsenal: archivedArsenal?.arsenal ?? []") &&
    !startService.includes("archivedArsenal?.arsenal ?? liveArsenal?.arsenal ?? demoPitcherDetail.arsenal") &&
    !startService.includes("archivedArsenal?.arsenal ?? demoPitcherDetail.arsenal"),
  "real pitcher profiles must never fall back to the demo arsenal table; absent real data should hide the module",
);

assert(
  startService.includes("readSupabaseArchivedPitcherRecentArsenal(pitcherMlbId, season).then((arsenal) => arsenal ?? readArchivedPitcherRecentArsenal(pitcherMlbId, season))") &&
    supabaseArchive.includes('const PITCHER_ARCHIVE_ARSENALS_TABLE = "toetheslab_pitcher_archive_arsenals";') &&
    supabaseArchive.includes("export async function readSupabaseArchivedPitcherRecentArsenal") &&
    supabaseSchema.includes("create table if not exists public.toetheslab_pitcher_archive_arsenals") &&
    supabaseSync.includes('await upsert("toetheslab_pitcher_archive_arsenals", batch, "season,pitcher_mlb_id");') &&
    supabaseSync.includes("function buildPitcherArsenalRows") &&
    supabaseSync.includes("summarizePitchEvents(pitchEvents)"),
  "production pitcher profiles must source real archive-gamefeed arsenal rows from Supabase instead of local-only archive files",
);

assert(
  mlbStatsClient.includes('if (gameType !== "R") return [];') &&
    mlbStatsClient.includes("function isRegularSeasonStatSplit") &&
    mlbStatsClient.includes('if (split.game?.gameType) return split.game.gameType === "R";'),
  "pitcher profile and schedule ingestion must filter exhibition games before building season starts",
);

assert(
  arsenalDataOps.includes("npm run archive:mlb-season -- --season=2026 --date=YYYY-MM-DD") &&
    arsenalDataOps.includes("npm run check:mlb-archive -- --season=2026 --expect-end=YYYY-MM-DD") &&
    arsenalDataOps.includes("npm run sync:supabase-mlb-archive") &&
    arsenalDataOps.includes("THE_BUMP_ARCHIVE_CONCURRENCY=4") &&
    arsenalDataOps.includes("THE_BUMP_REQUEST_TIME_SAVANT_PITCH_DETAIL=1") &&
    arsenalDataOps.includes("Archive through YYYY-MM-DD") &&
    arsenalDataOps.includes("More data after next archive run"),
  "arsenal data ops must document nightly archive refresh, validation, Supabase sync, rate-limit posture, and stale labels",
);

assert(
  pitcherFormPage.includes("function AdvancedPercentilePanel") &&
    pitcherFormPage.includes('data-responsive-check="pitcher-advanced-percentiles"') &&
    pitcherFormPage.includes('className="min-w-0 rounded border border-white/10 bg-[#101014] p-4 sm:p-5" data-responsive-check="pitcher-advanced-percentiles"') &&
    pitcherFormPage.includes("Pitch-event skills") &&
    pitcherFormPage.includes("const snapshots = [pitcher.skillProfile.season, pitcher.skillProfile.trailing30].filter((snapshot) => snapshot.pitchCount > 0);") &&
    pitcherFormPage.includes("if (snapshots.length === 0 && !hasTrend) return null;") &&
    pitcherFormPage.includes("function PitcherSkillSnapshotCard") &&
    pitcherFormPage.includes('data-responsive-check="pitcher-archive-quality-card"') &&
    pitcherFormPage.includes("pitcher.skillProfile.season") &&
    pitcherFormPage.includes("pitcher.skillProfile.trailing30") &&
    pitcherFormPage.includes("CSW") &&
    pitcherFormPage.includes("Whiff") &&
    pitcherFormPage.includes("SwStr") &&
    !pitcherFormPage.includes("Chase%") &&
    !pitcherFormPage.includes("Barrel%") &&
    !pitcherFormPage.includes("Hard-hit%") &&
    !pitcherFormPage.includes("xERA") &&
    !pitcherFormPage.includes("FIP {estimateFip"),
  "pitcher profile must render archive-derived season and last-30 quality cards without unsupported Statcast estimates",
);

assert(
  pitcherFormPage.includes("function SplitsPanel") &&
    pitcherFormPage.includes('data-responsive-check="pitcher-splits-panel"') &&
    pitcherFormPage.includes('className="min-w-0 rounded border border-white/10 bg-[#101014] p-4 sm:p-5" data-responsive-check="pitcher-splits-panel"') &&
    pitcherFormPage.includes('data-responsive-check="home-road-split-badge"') &&
    pitcherFormPage.includes('data-responsive-check="home-road-split-evidence"') &&
    pitcherFormPage.includes("<HomeRoadSplitBadge split={summary.venueSplit} />") &&
    pitcherFormPage.includes("Home GS+ {venueSplit.home.gsPlus.toFixed(1)}") &&
    pitcherFormPage.includes("function hasRealSplitValues") &&
    pitcherFormPage.includes("if (!venueSplit && realSplits.length === 0) return null;") &&
    !pitcherFormPage.includes("Times through order") &&
    pitcherFormPage.includes("wOBA"),
  "pitcher profile must render only populated scouting split rows and gated home/road evidence when present",
);

assert(
  pitcherFormPage.includes('className="grid min-w-0 gap-5 pb-8 lg:grid-cols-[minmax(0,1fr)_360px]" data-responsive-check="pitcher-profile-stacks"') &&
    pitcherFormPage.includes('data-responsive-check="pitcher-profile-left-stack"') &&
    pitcherFormPage.includes('data-responsive-check="pitcher-profile-right-stack"') &&
    pitcherFormPage.includes('data-responsive-check="pitcher-profile-game-log"') &&
    pitcherFormPage.includes('<div className="lg:hidden">') &&
    pitcherFormPage.includes('<div className="hidden lg:block">') &&
    pitcherFormWindowPanel.includes('className="mt-4 max-w-full overflow-x-auto rounded border border-white/10 bg-[#101014] p-4" data-responsive-check="form-trend-chart"') &&
    pitcherFormWindowPanel.includes('className="block w-full" viewBox={`0 0 ${width} ${height}`}'),
  "pitcher form profile modules must pack in independent column stacks while wide chart/table content scrolls inside its own panel",
);

assert(
  pitcherFormPage.includes("function GameLogRow") &&
    pitcherFormPage.includes('data-responsive-check="pitcher-game-log-row"') &&
    pitcherFormPage.includes("<details") &&
    !pitcherFormPage.includes("function RecentStartDepth"),
  "pitcher profile must consolidate recent start depth into expandable game-log rows instead of a duplicate start list",
);

console.log("pitcher page contract ok: canonical slug profile, shared nav, redirects, and hero headshot profile are present");
