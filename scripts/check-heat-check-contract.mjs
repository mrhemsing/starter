import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const formPage = await readFile("src/app/form/page.tsx", "utf8");
const heatRoute = await readFile("src/app/heat-check/page.tsx", "utf8");
const heatLoading = await readFile("src/app/heat-check/loading.tsx", "utf8");
const heatSeasonLoading = await readFile("src/app/heat-check/season/loading.tsx", "utf8");
const heatLoadingShell = await readFile("src/components/heat-check-loading-shell.tsx", "utf8");
const heatClientTeamFilter = await readFile("src/components/heat-check-client-team-filter.tsx", "utf8");
const routeControlPending = await readFile("src/components/route-control-pending.tsx", "utf8");
const heatCheckFilterLinkSource = await readFile("src/components/heat-check-filter-link.tsx", "utf8");
const fastFilterLinkSource = await readFile("src/components/fast-filter-link.tsx", "utf8");
const appLayout = await readFile("src/app/layout.tsx", "utf8");
const escapeClear = await readFile("src/components/heat-check-escape-clear.tsx", "utf8");
const bandNav = await readFile("src/components/heat-check-band-nav.tsx", "utf8");
const fastFilterLink = await readFile("src/components/fast-filter-link.tsx", "utf8");
const teamClearLink = await readFile("src/components/heat-team-clear-link.tsx", "utf8");
const teamDrawer = await readFile("src/components/heat-team-drawer.tsx", "utf8");
const teamJumpMenu = await readFile("src/components/heat-team-jump-menu.tsx", "utf8");
const scrollReset = await readFile("src/components/heat-check-scroll-reset.tsx", "utf8");
const heatPitcherProfileLink = await readFile("src/components/heat-pitcher-profile-link.tsx", "utf8");
const heatFilterLink = await readFile("src/components/heat-check-filter-link.tsx", "utf8");
const pageContextStrip = await readFile("src/components/page-context-strip.tsx", "utf8");
const formVisuals = await readFile("src/components/form-visuals.tsx", "utf8");
const heatHero = await readFile("src/components/heat-check-hero.tsx", "utf8");
const formDriverChips = await readFile("src/components/form-driver-chips.tsx", "utf8");
const liveScoreboard = await readFile("src/components/live-scoreboard.tsx", "utf8");
const formTokens = await readFile("src/lib/form-tokens.ts", "utf8");
const formService = await readFile("src/lib/data/form-service.ts", "utf8");
const types = await readFile("src/lib/types.ts", "utf8");
const globals = await readFile("src/app/globals.css", "utf8");
const seasonControls = formPage.slice(formPage.indexOf("function SeasonBoardControls"), formPage.indexOf("function SeasonExpandControls"));

assert(
  heatRoute.includes('export { generateHeatCheckMetadata as generateMetadata, HeatCheckPage as default } from "@/app/form/page";'),
  "/heat-check must render the canonical Heat Check page implementation",
);

assert(
  !existsSync("src/components/global-route-pending-overlay.tsx") &&
    !existsSync("src/lib/route-pending-event.ts") &&
    !appLayout.includes("GlobalRoutePendingOverlay") &&
    !heatFilterLink.includes("dispatchRoutePending") &&
    !teamClearLink.includes("dispatchRoutePending") &&
    !fastFilterLink.includes("dispatchRoutePending"),
  "Heat Check navigation must not trigger page-level route loading overlays during idle cached transitions",
);

assert(
  formPage.includes('import { HeatPitcherProfileLink } from "@/components/heat-pitcher-profile-link";') &&
    formPage.includes("<HeatPitcherProfileLink") &&
    formPage.includes("const profileHref = pitcherHref(pitcher, sourceParams(\"heat\", { window }));") &&
    heatPitcherProfileLink.includes('"use client";') &&
    heatPitcherProfileLink.includes("router.prefetch(href);") &&
    heatPitcherProfileLink.includes("event.preventDefault();") &&
    heatPitcherProfileLink.includes("router.push(href);") &&
    heatPitcherProfileLink.includes('data-nav-pending={pending ? "true" : undefined}') &&
    !heatPitcherProfileLink.includes('data-responsive-check="heat-pitcher-profile-pending"') &&
    !heatPitcherProfileLink.includes("Loading pitcher profile") &&
    !heatPitcherProfileLink.includes("Fetching data"),
  "Heat Check pitcher profile links must prefetch without showing page-level loading feedback during idle navigation",
);

assert(
  formPage.includes('import { HeatCheckFilterLink } from "@/components/heat-check-filter-link";') &&
    formPage.includes("<HeatCheckFilterLink") &&
    formPage.includes('data-heat-window-link={heatWindowLink ? "true" : undefined}') &&
    formPage.includes('data-heat-view-link={heatViewLink ? "true" : undefined}') &&
    teamJumpMenu.includes('import { HeatCheckFilterLink } from "@/components/heat-check-filter-link";') &&
    teamJumpMenu.includes("<HeatCheckFilterLink") &&
    teamJumpMenu.includes('data-team-jump-link="true"') &&
    teamDrawer.includes('import { HeatCheckFilterLink } from "@/components/heat-check-filter-link";') &&
    teamDrawer.includes("<HeatCheckFilterLink") &&
    teamDrawer.includes('data-team-drawer-link="true"') &&
    heatFilterLink.includes('"use client";') &&
    heatFilterLink.includes("router.prefetch(href);") &&
    heatFilterLink.includes('import { useRouteControlPending } from "@/components/route-control-pending";') &&
    heatFilterLink.includes("const { pending, beginPending } = useRouteControlPending") &&
    heatFilterLink.includes("region: \"heat-check-board\"") &&
    heatFilterLink.includes("beginPending(() => {") &&
    heatFilterLink.includes("scroll={false}") &&
    !heatFilterLink.includes('data-responsive-check="heat-filter-pending"') &&
    !heatFilterLink.includes("absolute inset-0 z-[120]") &&
    !heatFilterLink.includes("Updating Heat Check") &&
    !heatFilterLink.includes("Fetching pitcher form") &&
    !heatFilterLink.includes("route-loading-spinner"),
  "Heat Check team and window filters must prefetch, use shared pending treatment, and avoid blocking page-level loading overlays",
);

assert(
  formService.includes("const hot = [...qualified].sort(compareRollingFormLevelDesc).slice(0, HOME_CONFIG.railSize);") &&
    formService.includes("const cold = [...qualified].filter((pitcher) => !hotIds.has(pitcher.pitcherId)).sort(compareRollingFormLevelAsc).slice(0, HOME_CONFIG.railSize);") &&
    formService.includes("const tier = formHeatBandOf(rgs, window).key;") &&
    formService.includes("function compareRollingFormLevelDesc") &&
    formService.includes("if (b.rgs !== a.rgs) return b.rgs - a.rgs;") &&
    formService.includes("function compareRollingFormLevelAsc") &&
    formService.includes("if (a.rgs !== b.rgs) return a.rgs - b.rgs;") &&
    formPage.includes("const formRankByPitcherId = buildGlobalFormRankMap(qualifiedPitchers);") &&
    formPage.includes("rank={formRankByPitcherId.get(pitcher.pitcherId) ?? 0}") &&
    formPage.includes("function sortPitchersByGlobalFormRank") &&
    formPage.includes("function compareRollingFormLevelRank") &&
    formPage.includes("if (b.rgs !== a.rgs) return b.rgs - a.rgs;") &&
    formPage.includes("return a.pitcherId.localeCompare(b.pitcherId);") &&
    formPage.includes('if (sort === "risers") return Number(aLimited) - Number(bLimited) || compareMovementRise(a, b);') &&
    formPage.includes('if (sort === "fallers") return Number(aLimited) - Number(bLimited) || compareMovementFall(a, b);') &&
    formPage.includes("return Number(aLimited) - Number(bLimited) || compareRollingFormLevelRank(a, b);") &&
    formPage.includes("function compareMovementRisers") &&
    formPage.includes("function compareMovementFallers") &&
    !formPage.includes("rank={pitchers.indexOf(pitcher) + 1}") &&
    !formService.includes("function compareFormSummaries") &&
    !formService.includes("function compareFormAsc") &&
    !formPage.includes("function compareGlobalFormRank") &&
    !formService.includes("sort(compareHeatDesc)") &&
    !formService.includes("sort(compareHeatAsc)") &&
    !formService.includes("function compareHeatDesc") &&
    !formService.includes("function compareHeatAsc"),
  "Heat Check must band and rank by rolling FORM level while keeping movement separate for Movers",
);

assert(
  formPage.includes("leagueBandCounts") &&
    formPage.includes("qualifiedPitchers.filter((pitcher) => pitcher.tier === candidate.key).length") &&
    !formPage.includes("count: pitchers.filter((pitcher) => pitcher.status === \"ok\" && pitcher.tier === candidate.key).length"),
  "Heat Check temperature bar counts must stay league-wide, not filtered-subset counts",
);

assert(
  formPage.includes('data-responsive-check="heat-band-distribution"') &&
    formPage.includes('data-temperature-job="filter"') &&
    formPage.includes('className="mb-[5px] font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">League temperature</p>') &&
    formPage.includes('<p className="font-serif text-3xl font-bold text-zinc-50">{onFire} on fire · {ice} ice cold</p>') &&
    formPage.includes('<details className="mt-4">') &&
    !formPage.includes("{onFire} on fire · {ice} ice cold · {total} qualified") &&
    formPage.includes("Click a segment to filter") &&
    formPage.includes('>All</span>') &&
    formPage.includes('ariaCurrent={!activeBand ? "page" : undefined}') &&
    formPage.includes("href={heatCheckHref({ ...params, band: active ? \"\" : band.key })}") &&
    formPage.includes("activeBand"),
  "horizontal temperature bar must be the filter surface with visible All state and highlighted active filter",
);

assert(
  formPage.includes("{trendView && leagueView ? (") &&
    formPage.includes('{trendView ? <>How starting pitchers are trending over their last {window} starts.</> : <>Starting pitchers ranked by season GS+.</>}') &&
    formPage.includes('import { PageContextStrip } from "@/components/page-context-strip";') &&
    pageContextStrip.includes("export function PageContextStrip") &&
    pageContextStrip.includes("const hasContext = Boolean(leading || primary);") &&
    pageContextStrip.includes("{hasContext ? (") &&
    pageContextStrip.includes("data-context-primary") &&
    pageContextStrip.includes("data-context-meta") &&
    formPage.includes('const throughPrefix = seasonView ? "Season through" : "Form through";') &&
    formPage.includes('const formThroughLabel = `${throughPrefix} ${leaderboard.formThroughDate ?? "pending"}') &&
    formPage.includes('className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400"') &&
    formPage.includes('view={view} formThroughLabel={formThroughLabel} stale={leaderboard.stale}') &&
    formPage.includes('data-responsive-check="heat-controls-context"') &&
    formPage.includes('meta={formThroughLabel}') &&
    formPage.includes('metaClassName={`font-mono text-xs uppercase leading-4 tracking-[0.16em] ${stale ? "text-amber-300" : "text-zinc-400"}`}') &&
    !formPage.includes('const heatScopeLabel = team ? teamDisplayName(team) : "All teams";') &&
    !formPage.includes('{heatScopeLabel} · Form through {leaderboard.formThroughDate ?? "pending"}') &&
    !formPage.includes("All teams · Form through") &&
    !formPage.includes('className="mt-3 max-w-2xl min-h-12 text-sm leading-6 text-zinc-400"') &&
    !formPage.includes('className={`mt-3 min-h-8 font-mono text-xs uppercase leading-4 tracking-[0.16em]') &&
    !formPage.includes("Starting-pitcher FORM over the last {window} starts") &&
    !formPage.includes("teamScopeLabel") &&
    !formPage.includes('header className={team ? "pb-3" : "pb-6"}') &&
    !formPage.includes('team ? "mt-2 text-sm text-zinc-500" : "mt-3 text-sm text-zinc-400"') &&
    teamJumpMenu.includes('BAL: { id: 110, name: "Baltimore Orioles" }') &&
    teamDrawer.includes('BAL: { id: 110, name: "Baltimore Orioles" }') &&
    !formPage.includes("A season-wide rolling view with movement called out in the Movers strip.") &&
    formPage.includes('FORM band unavailable - check FORM data.') &&
    formPage.includes('FORM cold band unavailable - check FORM data.') &&
    !formPage.includes('Scheduled starter') &&
    !formPage.includes('SCHEDULED STARTER') &&
    !formPage.includes("Nobody's on fire today.") &&
    !formPage.includes("Nobody's in free fall today.") &&
    !formPage.includes(">Starting today<") &&
    !formPage.includes('{team} starters by recent form · {pitchers.length} shown.'),
  "Heat Check deck must use tight momentum copy and consolidate the form-through context into the controls card",
);

assert(
  formPage.includes("function StartStatusChip({ pitcher, todayStart }: { pitcher: FormSummary; todayStart: TodayStartContext | null })") &&
    formPage.includes("function startStatusLabel(pitcher: FormSummary, todayStart: TodayStartContext | null)") &&
    formPage.includes('if (todayStart?.status === "live") return { kind: "live", label: "LIVE NOW", href: todayStart.liveHref };') &&
    formPage.includes('if (pitcher.nextStart.date === today) return { kind: "scheduled", label: "STARTS TODAY" };') &&
    formPage.includes("if (daysAway > 0 && daysAway <= 6) return { kind: \"scheduled\", label: `STARTS ${formatWeekday(pitcher.nextStart.date)}` };") &&
    formPage.includes('weekday: "long"') &&
    formPage.includes("return { kind: \"scheduled\", label: `STARTS ${formatMonthDay(pitcher.nextStart.date)}` };") &&
    formPage.includes("<StartStatusChip pitcher={pitcher} todayStart={todayStart} />") &&
    formPage.includes("<CrossoverPill pitcher={pitcher} />") &&
    formPage.includes("grid-cols-[68px_44px_minmax(0,1fr)] items-start gap-x-3") &&
    formPage.includes("data-heat-mobile-rank") &&
    formPage.includes("data-heat-mobile-headshot") &&
    formPage.includes("getLiveScoreboard({ date: today })") &&
    formPage.includes("liveRow?.status ?? todayStartStatusFromSchedule(game)") &&
    formPage.includes('`${liveRow.liveHref}#live-start-${liveRow.pitcherId}`') &&
    liveScoreboard.includes('id={`live-start-${row.pitcherId}`}') &&
    formPage.includes('data-heat-start-status-chip="live"') &&
    formPage.includes('data-heat-start-status-chip="scheduled"') &&
    formPage.includes("function MobileStartStatusRowBreak({ pitcher, todayStart }: { pitcher: FormSummary; todayStart: TodayStartContext | null })") &&
    formPage.includes('return <span className="h-0 basis-full sm:hidden" aria-hidden="true" data-heat-mobile-start-status-break />;') &&
    formPage.includes("<MobileStartStatusRowBreak pitcher={pitcher} todayStart={todayStart} />") &&
    formPage.includes("function ScheduledStartChipLabel({ label }: { label: string })") &&
    formPage.includes('if (!label.startsWith("STARTS ")) return <>{label}</>;') &&
    formPage.includes('const startDateLabel = label.slice("STARTS ".length);') &&
    formPage.includes('<span className="block sm:inline">STARTS</span>') &&
    formPage.includes('<span className="block sm:inline">{startDateLabel}</span>') &&
    formPage.indexOf("chips={(\n          <>") < formPage.indexOf("<StartStatusChip pitcher={pitcher} todayStart={todayStart} />") &&
    formPage.indexOf("<StartStatusChip pitcher={pitcher} todayStart={todayStart} />") < formPage.indexOf("<MobileStartStatusRowBreak pitcher={pitcher} todayStart={todayStart} />") &&
    formPage.indexOf("<MobileStartStatusRowBreak pitcher={pitcher} todayStart={todayStart} />") < formPage.indexOf('<PitcherAvailabilityNote availability={pitcher.availability} compact />') &&
    formPage.includes("border border-teal-300/35 bg-teal-300/10") &&
    formPage.includes("border-[#FF5A1F]/45 bg-[#FF5A1F]/10") &&
    formPage.includes("whitespace-nowrap") &&
    formPage.includes("min-h-8") &&
    formDriverChips.includes("leading?: React.ReactNode") &&
    formDriverChips.includes("{leading}") &&
    formDriverChips.includes("flex min-w-0 max-w-full flex-wrap gap-1.5") &&
    formDriverChips.includes("inline-flex min-h-8") &&
    formDriverChips.includes("whitespace-nowrap") &&
    !formDriverChips.includes("whitespace-normal") &&
    !formDriverChips.includes("[overflow-wrap:anywhere]"),
  "Heat Check cards must render LIVE NOW/STARTS TODAY/STARTS WEEKDAY/STARTS MM/DD first, with mobile scheduled chips breaking after STARTS and driver chips in a wrapping row",
);

assert(
  types.includes("todaysStartNotReflected?: boolean") &&
    formService.includes("stalePitcherIds: Set<string>;") &&
    formService.includes("function attachTodayStartFreshnessFlag(summary: FormSummary, stalePitcherIds: Set<string>): FormSummary") &&
    formService.includes("todaysStartNotReflected: true,") &&
    formService.includes("start.date > formThroughDate") &&
    formPage.includes("function TodayStartFreshnessChip({ pitcher, compact = false }: { pitcher: FormSummary; compact?: boolean })") &&
    formPage.includes("pitcher.flags?.todaysStartNotReflected") &&
    formPage.includes("TODAY&apos;S START NOT YET REFLECTED"),
  "Heat Check must flag pitchers whose completed start today is not yet reflected in rolling form",
);

assert(
  formPage.includes("<HeatCheckBandNav bands={leagueBandCounts} />") &&
    bandNav.includes('"use client";') &&
    formPage.includes('className="min-h-screen overflow-x-hidden bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8"') &&
    !bandNav.includes('data-temperature-job="jump"') &&
    !bandNav.includes('aria-label="Jump to heat zones"') &&
    !bandNav.includes("function TemperatureRail") &&
    !formPage.includes('lg:grid-cols-[80px_minmax(0,1fr)]') &&
    bandNav.includes('href={`#band-${band.key}`}') &&
    bandNav.includes("data-active-heat-band={active?.key ?? \"\"}") &&
    bandNav.includes('aria-current={selected ? "location" : undefined}') &&
    !formPage.includes("function TemperatureRail({ bands, total, params }"),
  "Heat Check must remove the unnecessary desktop temperature rail while keeping mobile band jumps active",
);

assert(
  bandNav.includes('data-temperature-job="mobile-jump"') &&
    bandNav.includes("function MobileBandJumper") &&
    bandNav.includes('aria-label="Jump to heat band"') &&
    bandNav.includes("data-active-heat-band={active?.key ?? \"\"}") &&
    bandNav.includes('aria-current={selected ? "location" : undefined}') &&
    !bandNav.includes('className="sticky top-[76px]') &&
    !bandNav.includes('{active.label} · {active.count}'),
  "mobile Heat Check must replace the rail with a non-sticky band jumper that tracks the active band without duplicating the first section count",
);

assert(
  formPage.includes('data-responsive-check="heat-filter-status"') &&
    formPage.includes('!team && activeFilterLabel !== "All arms"') &&
    !formPage.includes('<p className="text-zinc-300">Click a segment to filter · league totals stay visible</p>') &&
    formPage.includes('const filteredCountLabel = team && pitchers.length === filteredTotal ? `${pitchers.length} starters` : `${pitchers.length} of ${filteredTotal}`;') &&
    formPage.includes('<span>Showing {activeFilterLabel} · {filteredCountLabel}</span>') &&
    formPage.includes('className="mt-1 block sm:mt-0 sm:inline"') &&
    formPage.includes('{"✕"} Show all') &&
    !formPage.includes("Show all teams"),
  "Heat Check must keep the filtered-list status for league filters only and avoid a separate team status clear box",
);

assert(
  formPage.includes('data-responsive-check="heat-empty-filter"') &&
    formPage.includes('No arms in ${HEAT_BANDS.find((candidate) => candidate.key === band)?.label ?? "this band"}') &&
    formPage.includes('"No arms match these filters"') &&
    formPage.includes('<Link href={clearFilterHref} className="ml-2 text-amber-300 hover:text-amber-200">· Clear</Link>') &&
    !formPage.includes("No qualified pitchers match these filters."),
  "Heat Check empty filtered states must name the empty filter and expose a clear action",
);

assert(
  formPage.includes("href={heatCheckHref({ ...params, band: band === candidate.key ? \"\" : candidate.key })}") &&
    formPage.includes("href={heatCheckHref({ ...params, band: activeBand === band.key ? \"\" : band.key })}"),
  "Heat Check active band controls must toggle back to All",
);

assert(
  formPage.includes("<HeatCheckEscapeClear href={clearFilterHref} />") &&
    escapeClear.includes('"use client";') &&
    escapeClear.includes('event.key === "Escape"') &&
    escapeClear.includes("router.push(href)"),
  "Heat Check must clear active filters with Escape",
);

assert(
  formPage.includes("motion?: string") &&
    formPage.includes('params?.motion === "rising"') &&
    formPage.includes("Rising ({leaderboard.heatingCount})") &&
    formPage.includes("Falling ({leaderboard.coolingCount})") &&
    formPage.includes("motion: direction === \"up\" ? \"rising\" : \"falling\""),
  "rising/falling counts and mover chips must be filter doorways",
);

assert(
  formPage.includes('data-control-role="filter"') &&
    formPage.includes('data-control-role="sort-window"'),
  "Heat Check controls must separate filter controls from sort/window controls",
);

assert(
  formPage.includes("team?: string;") &&
    formPage.includes('const team = params.team ?? "";') &&
    formPage.includes('import { getHomeSlateDate, getSlateSchedule } from "@/lib/data/start-service";') &&
    !formPage.includes('import { getTonightMustWatch } from "@/lib/data/tonight-service";') &&
    formPage.includes("getFormLeaderboard({ window, qualifiedOnly: seasonView || team ? false : qualifiedOnly, team })") &&
    formPage.includes('getSlateSchedule({ window: "today", date: today })') &&
    formPage.includes("function buildTodayStartContext(games: MlbScheduleGame[], liveRows: LiveScoreboardRow[], date: string)") &&
    formPage.includes(".filter((pitcher) => !team || pitcher.team === team)") &&
    formPage.includes("const filteredTotal = team ? leaderboard.pitchers.filter((pitcher) => pitcher.team === team).length : qualifiedPitchers.length;") &&
    formPage.includes("const allTeamsView = !team;") &&
    formPage.includes("const leagueView = allTeamsView && trendView;") &&
    formPage.includes('const showBandHeaders = leagueView && sort === "form";') &&
    formPage.includes("const heroCandidates = qualifiedPitchers;") &&
    !formPage.includes("const heroCandidates = qualifiedPitchers.filter((pitcher) => pitcher.windowCount >= window);") &&
    formPage.includes('data-responsive-check="heat-primary-controls"') &&
    formPage.indexOf('data-responsive-check="heat-primary-controls"') < formPage.indexOf('data-responsive-check="heat-league-pulse"') &&
    formPage.includes('data-responsive-check="heat-league-pulse"') &&
    formPage.includes('data-responsive-check="heat-league-stat-strip"') &&
    formPage.includes("{trendView && leagueView ? (") &&
    formPage.includes("<BandDistribution bands={leagueBandCounts} total={qualifiedPitchers.length} activeBand={band} params={params} />") &&
    formPage.includes("{trendView && leagueView && biggestRiser && biggestFaller ? (") &&
    formPage.includes("<MoversStrip risers={risers} fallers={fallers} params={params ?? {}} />") &&
    formPage.includes('className="grid gap-4 scroll-mt-8"') &&
    formPage.includes("{trendView && leagueView ? <HeatCheckBandNav bands={leagueBandCounts} /> : null}") &&
    !formPage.includes("Full board") &&
    !formPage.includes("League heat map") &&
    formPage.includes('Boolean(team) || params?.even === "show" || band === "even" || sort !== "form"') &&
    formPage.includes('<section className="relative z-40 mb-5 mt-4 rounded border border-white/10 bg-[#101014]/95 p-4 backdrop-blur" data-responsive-check="heat-primary-controls">') &&
    formPage.includes('border-b border-white/10 pb-3') &&
    !formPage.includes('${team ? "my-3" : "my-5"}') &&
    formPage.includes('<section className="relative z-0 grid gap-4" data-responsive-check="heat-league-pulse">') &&
    formPage.includes('<section className="z-20 my-5 rounded border border-white/10 bg-[#101014]/95 p-4 backdrop-blur sm:sticky sm:top-0" data-responsive-check="form-controls">') &&
    formPage.includes("{trendView && leagueView ? (") &&
    formPage.includes('<details className="mt-4">') &&
    formPage.includes("</details>") &&
    formPage.includes('team ? <input type="hidden" name="team" value={team} /> : null') &&
    formPage.includes('data-responsive-check="heat-team-filter"') &&
    formPage.includes('function WindowControlLinks({ window, params }') &&
    formPage.includes('data-responsive-check="heat-window-controls"') &&
    formPage.includes('data-responsive-check="heat-desktop-window-controls"') &&
    formPage.includes('<ControlGroup label="Window">') &&
    formPage.includes('{view === "trend" ? (') &&
    formPage.includes('<WindowControlLinks window={window} params={params} />') &&
    !formPage.includes('data-responsive-check="heat-league-desktop-window-controls"') &&
    !formPage.includes('data-responsive-check="heat-team-window-controls"') &&
    !formPage.includes('Filters / Last {window}') &&
    formPage.includes('data-responsive-check="heat-team-mobile-window-controls"') &&
    formPage.includes('<div className="grid gap-3 sm:hidden" data-responsive-check="heat-team-mobile-window-controls">') &&
    !formPage.includes('{activeTeam ? (\n        <div className="my-5 sm:hidden" data-responsive-check="heat-team-mobile-window-controls">') &&
    formPage.includes('<div className="hidden sm:flex sm:flex-wrap sm:items-end sm:gap-3">') &&
    formPage.includes('<ControlGroup label="View">') &&
    formPage.includes('<ViewControlLinks view={view} params={params} />') &&
    formPage.includes('const clearTeamHref = heatCheckHref({ ...params, team: "" });') &&
    formPage.includes('<HeatTeamClearLink') &&
    formPage.includes("{activeTeam ? (") &&
    formPage.includes("<HeatTeamJumpMenu teams={teams} activeTeam={activeTeam} params={params} />") &&
    formPage.includes('<HeatTeamDrawer key={activeTeam || "all"} teams={teams} activeTeam={activeTeam} params={params} />'),
  "Heat Check must own the team filter in the controls row, keep desktop window controls beside it for all teams, attach team clearing to the picker, and team views must show all team pitchers while hiding league-only surfaces",
);

assert(
  formPage.includes('type HeatCheckView = "trend" | "season";') &&
    formPage.includes('function parseHeatCheckView(value: string | undefined): HeatCheckView') &&
    formPage.includes("const view = viewOverride ?? parseHeatCheckView(rawParams?.view);") &&
    formPage.includes('const trendView = view === "trend";') &&
    formPage.includes('const seasonView = view === "season";') &&
    formPage.includes("const seasonPitchers = leaderboard.pitchers") &&
    formPage.includes(".sort((a, b) => compareSeasonRows(a, b, sort));") &&
    formPage.includes("const seasonRankByPitcherId = buildGlobalSeasonRankMap(leaderboard.pitchers.filter(isSeasonQualifiedPitcher));") &&
    formPage.includes("const seasonQualifiedPitchers = seasonPitchers.filter(isSeasonQualifiedPitcher);") &&
    formPage.includes('const seasonUnrankedPitchers = seasonPitchers.filter((pitcher) => !isSeasonQualifiedPitcher(pitcher));') &&
    formPage.includes('const seasonSortOptions = [') &&
    formPage.includes('{ key: "season-gs", label: "Season GS+" }') &&
    formPage.includes('{ key: "gem-rate", label: "Gem rate" }') &&
    formPage.includes('{ key: "consistency", label: "Consistency" }') &&
    formPage.includes('{ key: "best-start", label: "Best start" }') &&
    formPage.includes("function compareSeasonRows") &&
    formPage.includes('if (sort === "gem-rate")') &&
    formPage.includes('if (sort === "consistency")') &&
    formPage.includes('if (sort === "best-start")') &&
    formPage.includes("function compareSeasonGsRank") &&
    formPage.includes("if (b.bgs !== a.bgs) return b.bgs - a.bgs;") &&
    formPage.includes("function visibleSeasonPitchers") &&
    formPage.includes('if (team || show === "all") return pitchers;') &&
    formPage.includes("return pitchers.slice(0, 25);") &&
    formPage.includes("function isSeasonQualifiedPitcher") &&
    formPage.includes("return pitcher.seasonQualification.qualified;") &&
    formPage.includes("function formatSeasonConsistency") &&
    formPage.includes('if (pitcher.seasonStartCount < FORM_CONFIG.minStartsForConsistency) return "--";') &&
    formPage.includes("const HEAT_BAND_INITIAL_LIMIT = 12;") &&
    formPage.includes("const SEASON_UNRANKED_INITIAL_LIMIT = 25;") &&
    formPage.includes("function SeasonQualificationDisclosure") &&
    formPage.includes("arms below {threshold} GS are not yet ranked. The bar scales with the season.") &&
    formPage.includes('data-unranked-expanded={expanded ? "true" : "false"}') &&
    formPage.includes('const expanded = params.unranked === "show" || params.unranked === "all";') &&
    formPage.includes("const visiblePitchers = showAll ? sortedPitchers : sortedPitchers.slice(0, SEASON_UNRANKED_INITIAL_LIMIT);") &&
    formPage.includes('unranked: expanded ? "" : "show"') &&
    formPage.includes('unranked: "all"') &&
    formPage.includes('data-season-unranked={unranked ? "true" : undefined}') &&
    formPage.includes('{unranked ? "-" : `#${rank}`}') &&
    formPage.includes('data-responsive-check="heat-view-controls"') &&
    formPage.includes('data-heat-view-link={heatViewLink ? "true" : undefined}') &&
    formPage.includes('href={heatCheckHref({ ...params, view: "season", band: "", motion: "", sort: "", even: "", fire: "", hot: "", cooling: "", ice: "", show: "", unranked: "" })}') &&
    formPage.includes('view === "trend" ? (') &&
    formPage.includes('const throughPrefix = seasonView ? "Season through" : "Form through";') &&
    formPage.includes("const qualityTier = qualityTierOf(pitcher.bgs);") &&
    formPage.includes("const bandColor = seasonView ? qualityTier.color") &&
    formPage.includes('seasonView ? "Season GS+" : "Form"') &&
    formPage.includes("pitcher.seasonStartCount} GS") &&
    formPage.includes('unranked ? "rounded border border-white/10 px-1.5 py-1 text-zinc-400" : "text-zinc-500"') &&
    formPage.includes("seasonView ? null : (") &&
    formPage.includes("function SeasonBoardControls") &&
    formPage.includes('data-responsive-check="heat-season-sort-controls"') &&
    !seasonControls.includes("Qualified") &&
    formPage.includes("function SeasonExpandControls") &&
    formService.includes("seasonStartCount: starts.length,") &&
    formService.includes("function buildTeamGamesPlayedMap") &&
    formService.includes("const MLB_TEAM_CODES = new Set([") &&
    formService.includes("heat-check skipped non-MLB team code while building qualification map") &&
    formService.includes("MLB_TEAM_CODES.has(normalizedTeam)") &&
    formService.includes("function attachSeasonQualification") &&
    formService.includes("seasonQualificationMinStarts(teamGames)") &&
    formTokens.includes("seasonQualificationDivisor: 16") &&
    formTokens.includes("minStartsForConsistency: 4") &&
    types.includes("export type FormSeasonQualification = {") &&
    types.includes("seasonQualification: FormSeasonQualification;") &&
    types.includes("seasonQualificationThreshold: number;") &&
    formService.includes("function buildSeasonDepthStats(starts: StartSummary[]): FormSeasonDepthStats") &&
    formService.includes("gemRate: round1((scores.filter((score) => score >= 65).length / total) * 100)") &&
    formService.includes("dudRate: round1((scores.filter((score) => score <= 30).length / total) * 100)") &&
    formService.includes("consistency: round1(sampleStddev(scores))") &&
    formService.includes("bandDistribution,") &&
    types.includes("export type FormSeasonDepthStats = {") &&
    types.includes("seasonDepthStats: FormSeasonDepthStats;") &&
    formPage.includes("function SeasonDepthInlineStats") &&
    formPage.includes('data-responsive-check="heat-season-depth-inline"') &&
    formPage.includes("function SeasonDepthMobileDetails") &&
    formPage.includes('data-responsive-check="heat-season-mobile-depth"') &&
    formPage.includes("function SeasonRangeBar") &&
    formPage.includes("function SeasonBandMiniBar") &&
    formPage.includes('data-responsive-check="heat-season-controls"') &&
    formPage.includes('data-responsive-check="heat-season-expand"') &&
    !formPage.includes("<details className=\"mt-4 rounded border border-white/10 bg-black/20\"") &&
    !formPage.includes("bandOf("),
  "Heat Check Season view must rank by season GS+, hide Trend-only chrome, use quality colors, cap all-team lists, and keep unranked rows out of initial HTML",
);

assert(
  formPage.includes('data-heat-window-link={heatWindowLink ? "true" : undefined}') &&
    heatFilterLink.includes("scroll={false}") &&
    formPage.includes('ariaCurrent={!activeBand ? "page" : undefined} scroll={false}') &&
    formPage.includes('ariaCurrent={activeBand === band.key ? "page" : undefined} scroll={false}') &&
    formPage.includes('hover:border-amber-300/30" scroll={false}'),
  "Heat Check filter links must preserve mobile scroll position instead of jumping to the top",
);

assert(
  formPage.includes('import { HeatCheckScrollReset } from "@/components/heat-check-scroll-reset";') &&
    formPage.includes("<HeatCheckScrollReset />") &&
    scrollReset.includes('"use client";') &&
    scrollReset.includes('window.history.scrollRestoration = "manual";') &&
    scrollReset.includes('navigation.type !== "navigate" && navigation.type !== "reload"') &&
    scrollReset.includes("window.scrollTo(0, 0)") &&
    scrollReset.includes("document.documentElement.scrollTop = 0") &&
    scrollReset.includes("document.body.scrollTop = 0"),
  "Heat Check hard refreshes and direct opens must force the board to start at the top without changing filter-link scroll preservation",
);

assert(
  formPage.includes("function MobileStackedPitcherName") &&
    formPage.includes("<MobileStackedPitcherName name={pitcher.name} />") &&
    formPage.includes('className="block lg:inline"') &&
    formPage.includes('className="hidden lg:inline"') &&
    formPage.includes("pitcher-name break-words"),
  "Heat Check row names must stack first/rest and last name on mobile so long names do not collide with the score",
);

assert(
  formPage.includes('bg-[#08080a]/92 py-2 backdrop-blur sm:sticky sm:top-0" data-heat-band-header={band.key}') &&
    !formPage.includes('className="sticky top-0 z-10 mt-6 mb-3') &&
    !bandNav.includes('sticky top-[76px]'),
  "Heat Check must not use sticky controls, mobile band chips, or mobile band headers on phone widths",
);

assert(
  teamJumpMenu.includes('"use client";') &&
    teamJumpMenu.includes('import { useEffect, useRef } from "react";') &&
    teamJumpMenu.includes("const detailsRef = useRef<HTMLDetailsElement>(null);") &&
    teamJumpMenu.includes('document.addEventListener("pointerdown", onPointerDown)') &&
    teamJumpMenu.includes("details.open = false") &&
    teamJumpMenu.includes("const closeMenu = () =>") &&
    teamJumpMenu.includes("onSelect={onSelect}") &&
    teamJumpMenu.includes("details.contains(event.target)") &&
    teamJumpMenu.includes('data-responsive-check="heat-team-jump-menu"') &&
    teamJumpMenu.includes('data-team-jump-details') &&
    teamJumpMenu.includes('data-team-jump-list') &&
    teamJumpMenu.includes('data-team-jump-link') &&
    teamJumpMenu.includes('className="group relative z-[70] w-full sm:w-auto sm:max-w-full"') &&
    teamJumpMenu.includes('top-[calc(100%+6px)] z-[80]') &&
    teamJumpMenu.includes('inline-block max-w-full') &&
    teamJumpMenu.includes('border-amber-300/70 bg-black/20') &&
    teamJumpMenu.includes('text-amber-300') &&
    teamJumpMenu.includes('sm:w-auto') &&
    teamJumpMenu.includes('w-[min(32rem,calc(100vw-2rem))]') &&
    teamJumpMenu.includes('aria-label="Jump to Heat Check team"') &&
    teamJumpMenu.includes('href={heatCheckHref({ ...params, team: "" })}') &&
    teamJumpMenu.includes('href={heatCheckHref({ ...params, team })}') &&
    teamJumpMenu.includes("teamDisplayName(team)") &&
    teamJumpMenu.includes("function TeamLogo") &&
    teamJumpMenu.includes('className="block size-6 bg-contain bg-center bg-no-repeat"') &&
    teamJumpMenu.includes("backgroundImage: `url(https://www.mlbstatic.com/team-logos/${meta.id}.svg)`") &&
    teamJumpMenu.includes("if (!meta) return null;") &&
    !teamJumpMenu.includes(">All</span>") &&
    teamJumpMenu.includes("const MLB_TEAMS: Record<string, { id: number; name: string }>") &&
    !teamJumpMenu.includes("<select"),
  "Heat Check team filter must use a compact yellow custom jump menu with full team names, logos, no All avatar, and close on selection",
);

assert(
  teamDrawer.includes('"use client";') &&
    teamDrawer.includes('data-responsive-check="heat-team-bottom-drawer"') &&
    teamDrawer.includes('data-responsive-check="heat-team-picker-row"') &&
    teamDrawer.includes('const [clearing, setClearing] = useState(false);') &&
    teamDrawer.includes('const visibleTeam = clearing ? "" : activeTeam;') &&
    teamDrawer.includes('onClear={() => setClearing(true)}') &&
    teamDrawer.includes('<HeatTeamClearLink') &&
    teamDrawer.includes('const clearTeamHref = heatCheckHref({ ...params, team: "" });') &&
    teamDrawer.includes('createPortal(') &&
    teamDrawer.includes("document.body") &&
    teamDrawer.includes('role="dialog" aria-label="Heat Check team filter"') &&
    teamDrawer.includes("TeamLogo team={visibleTeam}") &&
    teamDrawer.includes("const closeDrawer = () => setOpen(false);") &&
    teamDrawer.includes("teamDisplayName(activeTeam)") &&
    teamDrawer.includes("TeamDrawerLink") &&
    teamDrawer.includes("onSelect={onSelect}") &&
    teamDrawer.includes("onSelect={closeDrawer}") &&
    teamDrawer.includes("data-team-drawer-link") &&
    teamDrawer.includes('className="block size-6 bg-contain bg-center bg-no-repeat"') &&
    teamDrawer.includes("backgroundImage: `url(https://www.mlbstatic.com/team-logos/${meta.id}.svg)`") &&
    teamDrawer.includes("if (!meta) return null;") &&
    teamDrawer.includes("const MLB_TEAMS: Record<string, { id: number; name: string }>"),
  "mobile Heat Check team filter must keep the bottom drawer with team logos and names but no All avatar",
);

assert(
  teamClearLink.includes('"use client";') &&
    teamClearLink.includes('router.prefetch(href)') &&
    teamClearLink.includes('onPointerDown={warmClearRoute}') &&
    teamClearLink.includes('onFocus={warmClearRoute}') &&
    teamClearLink.includes('setPending(true)') &&
    teamClearLink.includes('onClear?.()') &&
    teamClearLink.includes('data-responsive-check="heat-team-clear"'),
  "Heat Check team clear must prefetch the all-teams route and give immediate tap feedback",
);

assert(
  formPage.includes('className="relative grid grid-cols-[64px_minmax(0,1fr)] items-start gap-x-2 gap-y-3 sm:grid-cols-[92px_minmax(0,1fr)] sm:gap-4 sm:items-center"') &&
    formPage.includes('className="relative col-start-1 row-start-1 block focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:hidden"') &&
    formPage.includes('size="xl" band={thermalBand}') &&
    formPage.includes('className="relative hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:block"') &&
    formPage.includes('className="col-start-2 row-start-1 min-w-0 sm:col-start-auto sm:row-start-auto"') &&
    formPage.includes('className="col-span-full row-start-2 min-w-0 sm:row-start-auto sm:col-span-2"') &&
    formPage.includes('className="truncate font-serif text-xl font-bold leading-none text-zinc-50 sm:text-3xl"') &&
    formPage.includes('className="mt-2 grid gap-1 sm:mt-4 sm:flex sm:flex-wrap sm:items-end sm:gap-x-3 sm:gap-y-1"') &&
    formPage.includes('className="font-mono text-[34px] font-black leading-none tabular-nums sm:text-5xl"') &&
    formPage.includes('className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 sm:pb-1 sm:text-xs sm:tracking-[0.14em]"'),
  "Heat Check momentum hero must use a tight true mobile two-column first row, with identity/delta beside the headshot and trace/footer full-width beneath",
);

assert(
  formPage.includes('import { liveDateHref, pitcherHref, sourceParams } from "@/lib/routes";') &&
    formPage.includes('pitcherHref(pitcher, sourceParams("heat", { window }))') &&
    !formPage.includes('href={`/pitchers/${pitcher.pitcherId}/form?window=${window}`}'),
  "Heat Check rows and hero links must use shared canonical pitcherHref links with heat source context",
);

assert(
  formPage.includes('even?: string;') &&
    formPage.includes('fire?: string;') &&
    formPage.includes('ice?: string;') &&
    formPage.includes('const evenExpanded = Boolean(team) || params?.even === "show" || band === "even" || sort !== "form";') &&
    formPage.includes('const fireExpanded = Boolean(team) || params?.fire === "show" || band === "onfire" || sort !== "form";') &&
    formPage.includes('const iceExpanded = Boolean(team) || params?.ice === "show" || band === "ice" || sort !== "form";') &&
    formPage.includes('group.band.key === "even" && !evenExpanded') &&
    formPage.includes('<EvenBandCollapsed count={group.pitchers.length} href={heatCheckHref({ ...params, even: "show" })} />') &&
    formPage.includes('<EvenBandExpanded count={group.pitchers.length} href={heatCheckHref({ ...params, even: "" })} />') &&
    formPage.includes("function bandExpandableControl") &&
    formPage.includes("function visibleBandPitchers") &&
    formPage.includes('if (count <= HEAT_BAND_INITIAL_LIMIT) return null;') &&
    formPage.includes('if (bandKey !== "even" && !bandExpanded(bandKey, state)) return pitchers.slice(0, HEAT_BAND_INITIAL_LIMIT);') &&
    formPage.includes("function bandExpansionParam") &&
    formPage.includes("function bandExpansionLabel") &&
    formPage.includes("`Show ${hidden} more ${label}`") &&
    formPage.includes('data-responsive-check="heat-even-collapsed"') &&
    formPage.includes("Show {count} even arms") &&
    formPage.includes("Hide {count} even arms"),
  "Heat Check bands must cap initial row payload without hiding team views, explicit band filters, or alternate sorts",
);

assert(
  formPage.includes("heat-check-row scroll-mt-24 block rounded") &&
    formPage.includes("<MobileCardShell") &&
    formPage.includes('className="hidden min-w-0 gap-1 sm:grid"') &&
    formPage.includes('className="hidden"') &&
    formPage.includes("<FormDeltaLabel summary={pitcher} compact />") &&
    formPage.includes('fullWindow ? <FormDeltaLabel summary={pitcher} /> : null') &&
    formPage.includes('hidden truncate font-mono text-[10px] uppercase tracking-[0.14em] sm:block') &&
    formPage.includes('const mobileMetaLine = seasonView ? `${pitcher.team} · ${pitcher.seasonStartCount} GS` : `${pitcher.team} · ${pitcher.windowCount} GS`;') &&
    formPage.includes('const mobileLastValue = pitcher.lastStart') &&
    formPage.includes('`GS+ ${pitcher.lastStart.gsPlus} VS ${pitcher.lastStart.opp} · ${formatStartLine') &&
    formPage.includes('<MobileDetailLine label={seasonView ? "Season" : "Last"} value={seasonView ? seasonLine(pitcher) : mobileLastValue} />') &&
    formPage.includes('<MobileDetailLine label="Next start" value={nextStartDetails(pitcher)} muted={!pitcher.nextStart} />') &&
    formPage.includes("function MobileDetailLine({ label, value, muted = false }: { label: string; value: string; muted?: boolean })") &&
    formPage.includes('<span className="block text-zinc-500">{label}:</span>') &&
    formPage.includes('<span className="block">{value}</span>') &&
    formPage.includes('className="block sm:inline">{nextStartDetails(pitcher)}</span>') &&
    formPage.includes("function nextStartDetails(pitcher: FormSummary)") &&
    globals.includes("@media (min-width: 640px)") &&
    globals.includes(".heat-check-row {\n    content-visibility: auto;") &&
    globals.includes("contain-intrinsic-size: auto;") &&
    formPage.includes('return " TBD";') &&
    formPage.includes("return ` ${matchup} ${formatMonthDay(pitcher.nextStart.date)}`;") &&
    !formPage.includes("return ` ${matchup} · ${formatMonthDay(pitcher.nextStart.date)}`;"),
  "Heat Check rows must top-align rank, headshot, text, trend, sparkline, follow, and score clusters inside each card",
);

assert(
  formService.includes('const FORM_CACHE_VERSION = "form-level-bands-v4";') &&
    formService.includes("const [availabilityStatuses, nextStarts] = await Promise.all([") &&
    formService.includes("getNextStartMap(summaries.map((summary) => summary.pitcherId)),") &&
    formService.includes("const pitchersWithNextStarts = attachNextStarts(pitchers, nextStarts);") &&
    formService.includes("pitchers: pitchersWithNextStarts,"),
  "Heat Check full leaderboard payload must attach nextStart for every rendered row, not only the homepage rail",
);

assert(
  formPage.includes("function FormDeltaLabel") &&
    formPage.includes("const band = formDeltaBand(summary.deltaForm);") &&
    formPage.includes('const label = band.key === "steady" ? "steady" : `${band.marker} ${formatSignedDelta(summary.deltaForm)}`;') &&
    formPage.includes("style={{ color: band.color }}") &&
    formPage.includes("function formSparklineLabel(pitcher: FormSummary, window: number)") &&
    formPage.includes("Form trend, last ${Math.min(window, pitcher.windowCount)} starts, ${deltaAriaLabel(pitcher)}") &&
    formPage.includes("values={formSparkValues(pitcher)}") &&
    formPage.includes("baselineValue={formSparkBaseline(pitcher)}") &&
    formPage.includes("deltaForm={pitcher.deltaForm}") &&
    !formPage.includes("<TrendChip summary={pitcher} compact />"),
  "Heat Check row delta and sparkline must use shared form-delta banding, form-series values, and accessible form trend labels",
);

assert(
  formTokens.includes("export const FORM_DELTA_STEADY_THRESHOLD = 1.0;") &&
    formTokens.includes('warming: { key: "warming"') &&
    formTokens.includes('steady: { key: "steady"') &&
    formTokens.includes('cooling: { key: "cooling"') &&
    formTokens.includes("export function formDeltaBand(deltaForm: number)") &&
    formTokens.includes("if (deltaForm >= FORM_DELTA_STEADY_THRESHOLD) return FORM_DELTA_BANDS.warming;") &&
    formTokens.includes("if (deltaForm <= -FORM_DELTA_STEADY_THRESHOLD) return FORM_DELTA_BANDS.cooling;") &&
    globals.includes("--form-steady: #a1a1aa;"),
  "Heat Check form delta banding must have one inclusive 1.0 threshold and a neutral --form-steady token",
);

assert(
  formService.includes("function buildRollingFormSpark(starts: StartSummary[], window: FormWindow)") &&
    formService.includes("formSpark,") &&
    formService.includes("spark: windowStarts.map((start) => start.gameScorePlus),") &&
    formService.includes("const deltaForm = rgs - (formSpark[0] ?? rgs);"),
  "Heat Check data must expose rolling FORM spark values while preserving raw per-start GS+ inputs",
);

assert(
  types.includes('result: StartSummary["result"];') &&
    types.includes("export type FormDecisionRecord = {") &&
    types.includes("seasonDecisionRecord: FormDecisionRecord;") &&
    formService.includes("function buildStartPoint(starts: StartSummary[], index: number, window: FormWindow): FormStartPoint") &&
    formService.includes("result: start.result,") &&
    formService.includes("function buildSeasonDecisionRecord(starts: StartSummary[])") &&
    formService.includes("seasonDecisionRecord,"),
  "Heat Check Form summaries and start points must preserve canonical W/L/ND decisions for profile context and last-start payloads",
);

assert(
    formVisuals.includes("formDeltaBand") &&
    formVisuals.includes("baselineValue?: number;") &&
    formVisuals.includes("const baselineY = yFor(baselineValue ?? leagueMeanGS);") &&
    formVisuals.includes("const lineStyle = { stroke: lineColor } satisfies CSSProperties;") &&
    formVisuals.includes('style={lineStyle} strokeOpacity={intensity === "field" ? "0.8" : "1"}') &&
    formVisuals.includes("const fillStyle = { fill: lineColor } satisfies CSSProperties;") &&
    heatHero.includes("formDeltaBand(pitcher.deltaForm)") &&
    heatHero.includes("values={formSparkValues(pitcher)}") &&
    heatHero.includes("baselineValue={formSparkBaseline(pitcher)}"),
  "Heat Check sparkline stroke, endpoint, fill, and homepage Heat Check hero must follow shared form-delta coloring and baseline",
);

assert(
  heatLoading.includes('description={<HeatCheckLoadingDescription view="trend" />}') &&
    heatLoading.includes("<HeatCheckLoadingControls view=\"trend\" />") &&
    heatLoading.includes("<MomentumHeroSkeleton />") &&
    heatLoading.includes('childrenMode="content"') &&
    !heatLoading.includes('controls="heat"') &&
    heatSeasonLoading.includes('description={<HeatCheckLoadingDescription view="season" />}') &&
    heatSeasonLoading.includes("<HeatCheckLoadingControls view=\"season\" />") &&
    heatSeasonLoading.includes('childrenMode="content"') &&
    !heatSeasonLoading.includes('controls="heat"') &&
    heatLoadingShell.includes("useSearchParams") &&
    heatLoadingShell.includes("How starting pitchers are trending over their last {window} starts.") &&
    heatLoadingShell.includes('data-navigation-shell-controls="heat-real"') &&
    formPage.includes("export function MomentumHeroSkeleton()") &&
    formPage.includes('data-skeleton-row="heat-momentum-hero"'),
  "Heat Check loading must render URL-derived filter/subtitle chrome as real shell and reserve skeletons for hero/list data regions",
);

assert(
  formPage.includes('import { PendingRegion } from "@/components/route-control-pending";') &&
    formPage.includes('import { HeatCheckClientTeamFilter } from "@/components/heat-check-client-team-filter";') &&
    formPage.includes("<HeatCheckClientTeamFilter enabled={clientTeamFilterEnabled} />") &&
    formPage.includes('<PendingRegion region="heat-check-board"') &&
    formPage.includes("data-heat-client-team-board={clientTeamFilterEnabled ? \"true\" : undefined}") &&
    formPage.includes("data-heat-team={pitcher.team}") &&
    formPage.includes("data-heat-overflow-hidden={overflowHidden ? \"true\" : undefined}") &&
    teamDrawer.includes('data-heat-client-team-link="true"') &&
    teamJumpMenu.includes('data-heat-client-team-link="true"') &&
    heatClientTeamFilter.includes("window.history.pushState") &&
    heatClientTeamFilter.includes("heat-client-team-filter-request") &&
    heatClientTeamFilter.includes("route-control-pending-clear") &&
    routeControlPending.includes("export function useRouteControlPending") &&
    routeControlPending.includes("export function PendingRegion") &&
    routeControlPending.includes("const PENDING_MIN_MS = 150;") &&
    heatCheckFilterLinkSource.includes("useRouteControlPending") &&
    fastFilterLinkSource.includes("useRouteControlPending"),
  "Heat Check controls must show shared pending treatment and team links must filter locally when the loaded board has the dataset",
);

console.log("heat check contract ok: bar filters, mobile band jumps, league counts, filter status, compact momentum hero, form cluster, top-aligned rows, and canonical pitcher links are locked");
