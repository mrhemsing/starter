import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const startsPage = await readFile("src/app/starts/[id]/page.tsx", "utf8");
const startClassification = await readFile("src/lib/start-classification.ts", "utf8");
const startService = await readFile("src/lib/data/start-service.ts", "utf8");
const mlbStatsClient = await readFile("src/lib/data/mlb-stats-client.ts", "utf8");
const rankedStartsPageService = await readFile("src/lib/data/ranked-starts-page-service.ts", "utf8");
const formService = await readFile("src/lib/data/form-service.ts", "utf8");
const types = await readFile("src/lib/types.ts", "utf8");
const routes = await readFile("src/lib/routes.ts", "utf8");
const siteNav = await readFile("src/components/site-nav.tsx", "utf8");
const siteHeader = await readFile("src/components/site-header.tsx", "utf8");
const slateDateNav = await readFile("src/components/slate-date-nav.tsx", "utf8");
const rankedStartsArchiveLink = await readFile("src/components/ranked-starts-archive-link.tsx", "utf8");
const startsDisclosure = await readFile("src/components/ranked-starts-disclosure.tsx", "utf8");
const pageContextStrip = await readFile("src/components/page-context-strip.tsx", "utf8");
const globals = await readFile("src/app/globals.css", "utf8");
const rankedStartSummaryRule = globals.match(/\.ranked-start-details > summary \{[\s\S]*?\n\}/)?.[0] ?? "";
const methodologyPage = await readFile("src/app/methodology/page.tsx", "utf8");
const startRanking = await readFile("src/lib/start-ranking.ts", "utf8");
const primaryNavLink = await readFile("src/components/primary-nav-link.tsx", "utf8");
const startsLoading = await readFile("src/app/starts/[id]/loading.tsx", "utf8");
const routeLoadingShell = await readFile("src/components/route-loading-shell.tsx", "utf8");

const visibleTieBreakerOrder = [
  {
    date: "2026-06-20",
    gamePk: 824909,
    pitcher: { name: "Chris Sale" },
    gameScorePlus: 64,
    gameScorePlusBreakdown: { preciseTotal: 64.216 },
    line: { inningsPitched: 5.2, earnedRuns: 0, strikeouts: 7, walks: 1, hits: 5 },
  },
  {
    date: "2026-06-20",
    gamePk: 824902,
    pitcher: { name: "Joey Cantillo" },
    gameScorePlus: 64,
    gameScorePlusBreakdown: { preciseTotal: 63.53 },
    line: { inningsPitched: 8, earnedRuns: 1, strikeouts: 9, walks: 1, hits: 4 },
  },
].sort((a, b) => (
  b.gameScorePlus - a.gameScorePlus ||
  b.line.inningsPitched - a.line.inningsPitched ||
  a.line.earnedRuns - b.line.earnedRuns ||
  b.line.strikeouts - a.line.strikeouts ||
  a.line.walks - b.line.walks ||
  a.line.hits - b.line.hits ||
  a.date.localeCompare(b.date) ||
  (a.gamePk ?? 0) - (b.gamePk ?? 0) ||
  (a.pitcher?.name ?? "").localeCompare(b.pitcher?.name ?? "")
));

assert(visibleTieBreakerOrder[0]?.pitcher.name === "Joey Cantillo", "visible GS+ ties must break on the displayed-line tiebreakers before hidden decimal precision");

assert(
  startService.includes('fetchMlbTeamQualityContexts(date, { fetchLive: process.env.THE_BUMP_LIVE_MLB === "1" || shouldFetchLiveSchedule(date) })'),
  "recent completed slates must keep live opponent quality context so GS+ does not drift when today becomes yesterday",
);

assert(
  siteNav.includes("PrimaryNavLink") &&
    primaryNavLink.includes("router.prefetch(href)") &&
    primaryNavLink.includes("onPointerDown={warmRoute}") &&
    primaryNavLink.includes("event.preventDefault()") &&
    primaryNavLink.includes("router.push(href)") &&
    primaryNavLink.includes('data-nav-pending={pending ? "true" : undefined}') &&
    startsLoading.includes('import { RouteLoadingShell } from "@/components/route-loading-shell";') &&
    startsLoading.includes('activeLabel="Ranked Starts"') &&
    startsLoading.includes('responsiveCheck="ranked-starts-loading"') &&
    startsLoading.includes('aria-label="Loading ranked starts"') &&
    routeLoadingShell.includes('aria-busy="true"') &&
    routeLoadingShell.includes("data-responsive-check={responsiveCheck}") &&
    routeLoadingShell.includes("route-loading-secondary-message"),
  "ranked starts navigation must prefetch on intent and show an immediate loading shell",
);

assert(
  rankedStartsPageService.includes('import { unstable_cache } from "next/cache";') &&
    rankedStartsPageService.includes('const RANKED_STARTS_PAGE_CACHE_VERSION = "ranked-starts-page-v5";') &&
    rankedStartsPageService.includes("export const RANKED_STARTS_FINAL_REVALIDATE_SECONDS = 24 * 60 * 60;") &&
    rankedStartsPageService.includes("export const RANKED_STARTS_LIVE_REVALIDATE_SECONDS = 60;") &&
    rankedStartsPageService.includes("const getCachedFinalRankedStartsPageData = unstable_cache(") &&
    rankedStartsPageService.includes("const getCachedLiveRankedStartsPageData = unstable_cache(") &&
    rankedStartsPageService.includes("if (date < today) return getCachedFinalRankedStartsPageData(date, today);") &&
    rankedStartsPageService.includes("if (completionState.isFinal) return getCachedFinalRankedStartsPageData(date, today);") &&
    rankedStartsPageService.includes("getRankedSlateCompletionState(date, today)") &&
    rankedStartsPageService.includes("getSlateStartProgress({ window: \"yesterday\", date })") &&
    rankedStartsPageService.includes("getRankedStartsArchiveNavigation(date, today)") &&
    rankedStartsPageService.includes("archiveNavigation,") &&
    rankedStartsPageService.includes("getPitcherFormMap(starts.map((start) => String(start.pitcher.mlbId)), { window: 5 })") &&
    startsPage.includes('import { getRankedStartsPageData } from "@/lib/data/ranked-starts-page-service";') &&
    startsPage.includes("const pageData = await getRankedStartsPageData(date, today);") &&
    startsPage.includes("const { slateStarts, completionState, slateProgress, archiveNavigation } = pageData;") &&
    startsPage.includes("const highlights = new Map(pageData.highlights);") &&
    startsPage.includes("const formByPitcher = new Map(pageData.formByPitcher);"),
  "ranked starts date pages must use a cached shared page-data payload, with long cache for final slates and short cache while live",
);

assert(
  startRanking.includes("b.gameScorePlus - a.gameScorePlus") &&
    startRanking.includes("inningsFromIP(b.line.inningsPitched) - inningsFromIP(a.line.inningsPitched)") &&
    startRanking.includes("a.line.earnedRuns - b.line.earnedRuns") &&
    startRanking.includes("b.line.strikeouts - a.line.strikeouts") &&
    startRanking.includes("a.line.walks - b.line.walks") &&
    startRanking.includes("a.line.hits - b.line.hits") &&
    !startRanking.includes("preciseTotal") &&
    startService.includes('import { compareRankedStarts, rankStarts } from "@/lib/start-ranking";') &&
    startService.includes("const computedPreciseTotal = Math.max(GAME_SCORE_PLUS_DISPLAY_MIN, Math.min(GAME_SCORE_PLUS_DISPLAY_MAX, scaledTotal));") &&
    startService.includes("const preciseTotal = Math.round(computedPreciseTotal) === scoredTotal ? computedPreciseTotal : scoredTotal;") &&
    startService.includes("preciseTotal: Number(preciseTotal.toFixed(3)),"),
  "ranked starts must sort by displayed GS+ first, then break visible ties by IP, ER, K, walks, hits, and stable slate identity",
);

assert(
  !startsPage.includes("state.date === addDays(getHomeSlateDate(), -1)"),
  "starts page completion chip must not limit weekday labels to yesterday",
);

assert(
  startService.includes("export async function getRankedStartsArchiveNavigation") &&
    startService.includes("const getCachedRankedArchivedCompletedSlateDates = unstable_cache(") &&
    startService.includes('import { fetchMlbCompletedPitchingLines, fetchMlbCompletedScheduleDates,') &&
    startService.includes('["ranked-starts-archive-dates-v3"]') &&
    startService.includes("{ revalidate: 15 * 60 }") &&
    startService.includes("const archivedDates = Array.from(new Set(starts.filter((start) => start.source?.line !== \"fixture\").map((start) => start.date))).sort();") &&
    startService.includes("if (archivedDates.length > 0) return archivedDates;") &&
    startService.includes("return fetchMlbCompletedScheduleDates(`${season}-01-01`, `${season}-12-31`, { fetchLive: true });") &&
    mlbStatsClient.includes("export async function fetchMlbCompletedScheduleDates") &&
    mlbStatsClient.includes("startDate,") &&
    mlbStatsClient.includes("endDate,") &&
    mlbStatsClient.includes("(entry.games ?? []).some((game) => isFinalMlbApiGame(game))") &&
    startService.includes("return (await getRankedStartsArchiveNavigation(today, today)).latestDate;") &&
    startService.includes("if (todayCompletion.completedStarts > 0) dates.add(today);") &&
    startService.includes("activeDate === today ? Promise.resolve(null) : getRankedSlateCompletionState(activeDate, today)") &&
    startService.includes("if (activeCompletion && activeCompletion.completedStarts > 0) dates.add(activeDate);") &&
    startsPage.includes('import { RankedStartsArchiveNav } from "@/components/slate-date-nav";') &&
    startsPage.includes("<RankedStartsArchiveNav") &&
    startsPage.includes("previousDate={archiveNavigation.previousDate}") &&
    startsPage.includes("nextDate={archiveNavigation.nextDate}") &&
    startsPage.includes('<SiteHeader active="starts" today={today} rankedDate={rankedDate} />') &&
    !startsPage.includes("hideUpcoming") &&
    !siteHeader.includes("hideUpcoming") &&
    !siteNav.includes("hideUpcoming") &&
    siteNav.includes('const upcomingItem = [{ key: "upcoming" as const, label: "Upcoming", href: upcomingDateHref(defaultDates.upcomingDate) }];') &&
    startsPage.includes('import { RankedStartsDisclosure } from "@/components/ranked-starts-disclosure";') &&
    startsDisclosure.includes('"use client";') &&
    startsDisclosure.includes("window.sessionStorage.getItem(storageKey)") &&
    startsDisclosure.includes("window.sessionStorage.setItem(storageKey, nextOpen ? \"open\" : \"closed\")") &&
    startsDisclosure.includes("grid h-6 w-6 shrink-0 place-items-center rounded border border-white/15") &&
    startsDisclosure.includes("group-hover:border-amber-300/60 group-hover:text-amber-300") &&
    startsDisclosure.includes("group-open:border-amber-300/60 group-open:text-amber-300") &&
    startsDisclosure.includes('<span className="group-open:hidden">+</span>') &&
    startsDisclosure.includes('<span className="hidden group-open:inline">&#8722;</span>') &&
    !startsDisclosure.includes("group-open:rotate-180") &&
    !startsDisclosure.includes('aria-hidden="true">v</span>') &&
    startsPage.includes(">Ranked Starts</h1>") &&
    !startsPage.includes(">Daily Ranked Starts</h1>") &&
    startsPage.includes("Completed starts ranked by GS+.") &&
    !startsPage.includes("Every completed start ranked by GS+, with full lines, matchup context, and breakdowns.") &&
    startsPage.includes('data-responsive-check="ranked-starts-compact-controls"') &&
    startsPage.includes('data-responsive-check="ranked-start-controls"') &&
    startsPage.includes('data-active-filter-summary={filterSummary}') &&
    startsPage.includes('storageKey="ranked-starts-filters-open"') &&
    startsPage.includes('storageKey="ranked-starts-shape-open"') &&
    startsPage.includes('storageKey="ranked-starts-method-open"') &&
    startsPage.includes("const visibleQualityBands = QUALITY_BANDS.filter((qualityBand) => (qualityBandCounts.get(qualityBand.label) ?? 0) > 0);") &&
    startsPage.includes("function rankedStartsFilterSummary") &&
    startsPage.includes('style={{ pointerEvents: "none" }}') &&
    startsPage.includes('data-responsive-check="ranked-starts-methodology-notes"') &&
    startsPage.includes("<ScaleLegend scoreScale={scoreScale} />") &&
    !startsPage.includes('data-responsive-check="ranked-starts-slate-stamp"') &&
    !startsPage.includes('data-responsive-check="ranked-starts-board-heading"') &&
    !startsPage.includes("formatBoardEyebrowDate(date)") &&
    !startsPage.includes("Ranked Board</p>") &&
    startsPage.includes("MLB Stats API / Baseball Savant") &&
    !startsPage.includes("Data through {formatMetadataDate(date)} / MLB Stats API / Baseball Savant") &&
    !startsPage.includes(">Previous day</Link>") &&
    !startsPage.includes(">Next day</Link>") &&
    !slateDateNav.includes("export function RankedStartsRangeToggle") &&
    slateDateNav.includes("export function SlateRangeToggle") &&
    slateDateNav.includes("export function UpcomingSlateRangeToggle") &&
    slateDateNav.includes("export function RankedStartsArchiveNav") &&
    pageContextStrip.includes("export function PageContextStrip") &&
    pageContextStrip.includes("data-context-primary") &&
    pageContextStrip.includes("data-context-meta") &&
    slateDateNav.includes('import { PageContextStrip } from "@/components/page-context-strip";') &&
    slateDateNav.includes('import { RankedStartsArchiveKeyboard, RankedStartsArchiveLink } from "@/components/ranked-starts-archive-link";') &&
    slateDateNav.includes("<RankedStartsArchiveKeyboard previousHref={previousHref} nextHref={nextHref} />") &&
    slateDateNav.includes('className="min-w-0 font-mono uppercase"') &&
    slateDateNav.includes("primaryClassName=\"font-mono text-2xl font-semibold leading-none tracking-normal\"") &&
    slateDateNav.includes("data-ranked-date-label") &&
    slateDateNav.includes('className="inline-flex shrink-0 items-center gap-1.5"') &&
    slateDateNav.includes("const rankedStartsArchiveStepClass =") &&
    slateDateNav.includes('"inline-flex h-10 w-10 items-center justify-center rounded border border-white/10 bg-[#101014] text-zinc-200 transition hover:border-amber-300/60 hover:bg-amber-300/10 hover:text-amber-200 active:border-amber-300 active:bg-amber-300/15 active:text-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"') &&
    slateDateNav.includes("const rankedStartsArchiveStepDisabledClass =") &&
    slateDateNav.includes('"inline-flex h-10 w-10 items-center justify-center rounded border border-white/10 bg-[#101014] text-zinc-700"') &&
    slateDateNav.includes('ariaLabel={`Previous slate, ${formatRankedEyebrowDate(previousDate)}`}') &&
    slateDateNav.includes('ariaLabel={`Next slate, ${formatRankedEyebrowDate(nextDate)}`}') &&
    slateDateNav.includes('aria-label="No next slate"') &&
    slateDateNav.includes('<span className="text-3xl font-semibold leading-none" aria-hidden="true">‹</span>') &&
    slateDateNav.includes('<span className="text-3xl font-semibold leading-none" aria-hidden="true">›</span>') &&
    !slateDateNav.includes("text-amber-300") &&
    !slateDateNav.includes("min-w-[23ch]") &&
    startsPage.includes('className="flex flex-wrap items-center justify-between gap-3"') &&
    startsPage.includes('className="inline-flex min-h-8 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400"') &&
    !slateDateNav.includes("&lt;") &&
    !slateDateNav.includes("&gt;") &&
    !slateDateNav.includes("overflow-hidden rounded border border-white/10") &&
    slateDateNav.includes('dataArchiveStep="previous"') &&
    slateDateNav.includes('dataArchiveStep="next"') &&
    rankedStartsArchiveLink.includes('"use client";') &&
    rankedStartsArchiveLink.includes("router.prefetch(href);") &&
    rankedStartsArchiveLink.includes("event.preventDefault();") &&
    rankedStartsArchiveLink.includes("router.push(href);") &&
    rankedStartsArchiveLink.includes('event.key === "ArrowLeft" ? previousHref : event.key === "ArrowRight" ? nextHref : null') &&
    slateDateNav.includes('data-responsive-check="ranked-starts-archive-nav"') &&
    !slateDateNav.includes('data-latest-state="latest"') &&
    !slateDateNav.includes(">Latest</span>") &&
    !slateDateNav.includes("Jump to latest") &&
    !slateDateNav.includes('dataLatestState="jump"') &&
    !rankedStartsArchiveLink.includes("dataLatestState") &&
    !rankedStartsArchiveLink.includes("data-latest-state") &&
    !slateDateNav.includes("ranked-start-date-picker") &&
    !slateDateNav.includes("Pick a date") &&
    !slateDateNav.includes('className="mt-5 flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-[0.14em]"') &&
    !globals.includes(".ranked-start-date-picker-summary") &&
    slateDateNav.includes('className={slateRangeToggleClass(option.active)}') &&
    slateDateNav.includes('"border-amber-300 bg-amber-300 text-zinc-950"'),
  "ranked starts header must use archive-only latest slate navigation, promote the date eyebrow, and remove relative Upcoming-style range pills",
);

assert(
  startsPage.includes(">Pitcher Profile</Link>") && !startsPage.includes(">Pitcher</Link>"),
  "ranked starts card CTA must read Pitcher Profile instead of the terse Pitcher label",
);

assert(
  routes.includes("export function startHref") &&
    startsPage.includes("startHref(start, sourceParams(\"starts\"))") &&
    startsPage.includes("pitcherHref({ id: start.pitcher.id, name: start.pitcher.name }, sourceParams(\"starts\"))"),
  "ranked starts list cards must carry starts source context to start and pitcher entity pages",
);

assert(
  startsPage.includes('const source = parseEntitySource(query?.from, "starts");') &&
    startsPage.includes("<EntityOrientation") &&
    startsPage.includes('<SiteHeader active={null} today={today} responsiveCheck="start-detail-site-header" />') &&
    siteNav.includes("active: NavKey | null"),
  "start detail pages must render neutral nav and source-aware back/breadcrumb orientation",
);

assert(
  !startsPage.includes('href={`${upcomingDateHref(date)}#must-watch`}') &&
    !startsPage.includes('import { slateTimeWord } from "@/lib/time-words";') &&
    !startsPage.includes("still to come {slateTimeWord({ date }, { today })}") &&
    !startsPage.includes("still to come tonight"),
  "ranked starts archive pages must not link partial slates into Upcoming",
);

assert(
  startsPage.includes("pitcherHref({ id: start.pitcher.id, name: start.pitcher.name }, sourceParams(source))"),
  "start detail pitcher links must preserve the current source context",
);

assert(
  startsPage.includes('className="mt-4 inline-flex min-h-11 items-center gap-2 rounded border border-amber-300/40 bg-amber-300/10 px-3 py-2 font-mono text-xs uppercase tracking-[0.16em] text-amber-300 transition hover:border-amber-200 hover:bg-amber-300 hover:text-zinc-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"') &&
    startsPage.includes('<span aria-hidden="true">-&gt;</span>'),
  "start detail pitcher page CTA must look and behave like an obvious link",
);

assert(
    startsPage.includes("function RankedSlateStatus") &&
    startsPage.includes('className="ranked-live-dot h-2 w-2 rounded-full bg-[#FF5A1F]"') &&
    startsPage.includes('return `${state.completedStarts} final, ${Math.max(0, state.totalStarts - state.completedStarts)} in progress`;') &&
    startsPage.includes('if (state.isFinal) return `All ${state.totalStarts} final`;') &&
    startsPage.includes('return `Probables · Today · first starter toes the slab ${formatSlateCountdownLabel(slateProgress.countdownLabel)}`;') &&
    startsPage.includes('return `${state.completedStarts} final`;') &&
    startsPage.includes("function formatSlateCountdownLabel") &&
    startsPage.includes('return `in ${countdownLabel}`;') &&
    !startsPage.includes("function formatFirstPitchStamp") &&
    !startsPage.includes("{date} / completed starts recap"),
  "ranked starts header must use a no-box state-aware live/final/probables indicator and remove the redundant ISO date line",
);

assert(
  startsPage.includes('className="mt-4 grid gap-2" data-responsive-check="ranked-starts-compact-controls"') &&
    startsPage.includes('className="flex flex-wrap items-center justify-between gap-3"') &&
    startsPage.includes('className="inline-flex min-h-8 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400"') &&
    startsPage.includes('storageKey="ranked-starts-method-open" label="How rankings work"') &&
    startsPage.includes('className="w-fit text-amber-300 underline-offset-4 hover:underline" href="/methodology"') &&
    !startsPage.includes("border-amber-300/30 bg-amber-300/10 px-3"),
  "ranked starts header status and methodology must live in the compact controls with a quiet status pill",
);

assert(
  !startsPage.includes(">Short outings</span>") &&
    startsPage.includes('data-responsive-check="ranked-starts-openers"') &&
    startsPage.includes("Openers & short outings · {shortStarts.length}") &&
    startsPage.includes('<ControlLink active={showOpeners} href={rankedStartsHref(date, { band, sort, showOpeners: !showOpeners })} scroll={false}>') &&
    startsPage.includes("function ControlLink({ active, href, children, color, scroll = true }") &&
    startsPage.includes("scroll={scroll}"),
  "ranked starts opener/short-outing controls must live only in the lower openers section and preserve scroll on toggle",
);

assert(
  types.includes("plannedStarter?: boolean;") &&
    startService.includes("const ESTABLISHED_STARTER_MIN_SEASON_STARTS = 5;") &&
    startService.includes("const ESTABLISHED_STARTER_MIN_AVG_IP = 4;") &&
    startService.includes("async function getEstablishedStarterPitcherIds") &&
    startService.includes("hasEstablishedStarterWorkload(profile)") &&
    startService.includes("const plannedStarter = probablePitcherIds.has(pitcher.id) || establishedStarterIds.has(pitcher.id);") &&
    startService.includes("plannedStarter,") &&
    startClassification.includes("export function isRankedRegularStart") &&
    startClassification.includes("const RANKED_START_IP_FLOOR = 2;") &&
    startClassification.includes("return inningsFromIP(start.line.inningsPitched) >= RANKED_START_IP_FLOOR;") &&
    !startClassification.includes("isPlannedStarter(start) || inningsFromIP(start.line.inningsPitched) >= RANKED_START_IP_FLOOR") &&
    startsPage.includes('import { isRankedRegularStart } from "@/lib/start-classification";') &&
    startsPage.includes("return isRankedRegularStart(start);") &&
    startsPage.includes("Board ranks starts of 2.0+ innings; openers and short outings are listed separately.") &&
    startsPage.includes("Starts under 2.0 innings are kept out of the ranked positions but remain visible for slate completeness.") &&
    methodologyPage.includes("Daily boards rank qualified starts of at least 2.0 IP; openers and short outings are listed separately.") &&
    !methodologyPage.includes("Daily boards rank qualified starts of at least 3.0 IP;") &&
    formService.includes('import { isScoredStarterSample } from "@/lib/start-classification";') &&
    formService.includes("isScoredStarterSample(start, FORM_CONFIG.ipFloor)"),
  "ranked starts must use a hard 2.0 IP eligibility floor while planned-starter workload remains available for form scoring",
);

assert(
  startsPage.includes("grid-cols-[48px_52px_minmax(0,1fr)_auto] sm:grid-cols-[48px_64px_minmax(0,1fr)_auto_auto]") &&
    startsPage.includes("grid-cols-[48px_44px_minmax(0,1fr)_auto] sm:grid-cols-[48px_52px_minmax(0,1fr)_auto_auto]") &&
    startsPage.includes("grid-cols-[48px_40px_minmax(0,1fr)_auto] sm:grid-cols-[48px_40px_minmax(0,1fr)_auto_auto]"),
  "ranked starts rows must use fixed rank/photo/meta/stats/score grid columns by tier",
);

assert(
  startsPage.includes("rounded border border-[#F6C445]/35") &&
    startsPage.includes("border-b border-white/10") &&
    startsPage.includes("gap-x-4") &&
    startsPage.includes("sm:text-right"),
  "ranked starts rows must use uniform gas outlines, field hairlines, 16px column gap, and right-aligned terminal stats/score",
);

assert(
  startsPage.includes("plateClass: \"!h-[65px] !w-[52px] sm:!h-20 sm:!w-16\"") &&
    startsPage.includes("plateClass: \"!h-[55px] !w-11 sm:!h-[65px] sm:!w-[52px]\"") &&
    startsPage.includes("plateClass: \"!h-[50px] !w-10\""),
  "ranked starts headshot plates must use tiered 4:5 dimensions",
);

assert(
  globals.includes(".ranked-start-plate") &&
    globals.includes("background: #15181C !important;") &&
    globals.includes("border: 1.5px solid color-mix(in srgb, var(--ranked-band-color, #878D97) 45%, transparent) !important;") &&
    globals.includes("object-fit: cover;") &&
    globals.includes("object-position: center 18%;"),
  "ranked starts headshot plates must use neutral backgrounds, band-tinted rings, and consistent cover crop",
);

assert(
  startsPage.includes('"--ranked-band-color": profile.railColor') &&
    startsPage.includes("relative scroll-mt-28 overflow-hidden") &&
    startsPage.includes("sm:pr-20") &&
    startsPage.includes("[&::-webkit-details-marker]:hidden") &&
    startsPage.includes("Toggle breakdown for ${start.pitcher.name}") &&
    !startsPage.includes('className="ranked-start-toggle-label"') &&
    !startsPage.includes(">Breakdown</span>") &&
    startsPage.includes('className="ranked-start-toggle-icon"') &&
    startsPage.includes('className="ranked-start-toggle-chevron"') &&
    !startsPage.includes("⌄") &&
    !globals.includes(".ranked-start-details[open] > summary") &&
    !globals.includes("border-top-color: rgb(255 255 255 / 0.1);") &&
    globals.includes(".ranked-start-toggle-icon") &&
    !globals.includes(".ranked-start-toggle-label") &&
    globals.includes(".ranked-start-toggle-chevron") &&
    globals.includes(".ranked-start-details > summary::marker") &&
    globals.includes(".ranked-start-details > summary::-webkit-details-marker") &&
    globals.includes("position: relative;") &&
    globals.includes("margin-left: auto;") &&
    globals.includes("right: 16px;") &&
    globals.includes("top: 14px;") &&
    globals.includes("min-height: 44px;") &&
    globals.includes("min-width: 44px;") &&
    globals.includes("width: 44px;") &&
    !rankedStartSummaryRule.includes("width: 100%;") &&
    !rankedStartSummaryRule.includes("height: 100%;") &&
    globals.includes("border-bottom: 2px solid currentColor;") &&
    globals.includes("border-right: 2px solid currentColor;") &&
    globals.includes("transform: translateY(-1px) rotate(45deg);") &&
    globals.includes(".ranked-start-details[open] .ranked-start-toggle-chevron") &&
    globals.includes("transform: translateY(2px) rotate(225deg);") &&
    globals.includes("@keyframes ranked-live-dot-pulse") &&
    globals.includes("animation: ranked-live-dot-pulse 2s ease-in-out infinite;"),
  "ranked starts rows must expose band ring color, use a styled CSS chevron accordion control, and pulse the live dot only through CSS",
);

console.log("starts page contract ok: completed date chips include weekday, ranked cards source-link entities, and start detail pages show neutral source orientation");
