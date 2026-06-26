import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const formPage = await readFile("src/app/form/page.tsx", "utf8");
const heatRoute = await readFile("src/app/heat-check/page.tsx", "utf8");
const escapeClear = await readFile("src/components/heat-check-escape-clear.tsx", "utf8");
const bandNav = await readFile("src/components/heat-check-band-nav.tsx", "utf8");
const teamClearLink = await readFile("src/components/heat-team-clear-link.tsx", "utf8");
const teamDrawer = await readFile("src/components/heat-team-drawer.tsx", "utf8");
const teamJumpMenu = await readFile("src/components/heat-team-jump-menu.tsx", "utf8");
const formService = await readFile("src/lib/data/form-service.ts", "utf8");

assert(
  heatRoute.includes('export { generateHeatCheckMetadata as generateMetadata, HeatCheckPage as default } from "@/app/form/page";'),
  "/heat-check must render the canonical Heat Check page implementation",
);

assert(
  formService.includes("const hot = [...qualified].sort(compareFormSummaries).slice(0, HOME_CONFIG.railSize);") &&
    formService.includes("const cold = [...qualified].filter((pitcher) => !hotIds.has(pitcher.pitcherId)).sort(compareFormAsc).slice(0, HOME_CONFIG.railSize);") &&
    formService.includes("const tier = formHeatBandOf(rgs, window).key;") &&
    formService.includes("function compareFormLevelDesc") &&
    formService.includes("if (b.rgs !== a.rgs) return b.rgs - a.rgs;") &&
    formService.includes("function compareFormLevelAsc") &&
    formService.includes("if (a.rgs !== b.rgs) return a.rgs - b.rgs;") &&
    formPage.includes('if (bandKey === "onfire") return [...pitchers].sort((a, b) => b.rgs - a.rgs || (b.heatIndex ?? 0) - (a.heatIndex ?? 0) || b.deltaForm - a.deltaForm || a.name.localeCompare(b.name));') &&
    formPage.includes('return [...pitchers].sort((a, b) => b.rgs - a.rgs || b.deltaForm - a.deltaForm || a.name.localeCompare(b.name));') &&
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
    !formPage.includes("{onFire} on fire · {ice} ice cold · {total} qualified") &&
    formPage.includes("Click a segment to filter") &&
    formPage.includes('>All</span>') &&
    formPage.includes('ariaCurrent={!activeBand ? "page" : undefined}') &&
    formPage.includes("href={heatCheckHref({ ...params, band: active ? \"\" : band.key })}") &&
    formPage.includes("activeBand"),
  "horizontal temperature bar must be the filter surface with visible All state and highlighted active filter",
);

assert(
  formPage.includes("{leagueView ? (") &&
    formPage.includes("<span className=\"block\">Starting-pitcher FORM over the last {window} starts.</span>") &&
    formPage.includes('<span className="block lg:whitespace-nowrap">A season-wide rolling view with movement called out in the Movers strip.</span>') &&
    formPage.includes('FORM band unavailable - check FORM data.') &&
    formPage.includes('FORM cold band unavailable - check FORM data.') &&
    formPage.includes('Scheduled starter') &&
    !formPage.includes("Nobody's on fire today.") &&
    !formPage.includes("Nobody's in free fall today.") &&
    !formPage.includes(">Starting today<") &&
    formPage.includes('{team} starters by recent form · {pitchers.length} shown.'),
  "Heat Check deck must keep league framing in All Teams and switch to compact team-scoped copy with shown count in team mode",
);

assert(
  formPage.includes("<HeatCheckBandNav bands={leagueBandCounts} total={qualifiedPitchers.length} />") &&
    bandNav.includes('"use client";') &&
    formPage.includes('className="min-h-screen overflow-x-hidden bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8"') &&
    bandNav.includes('data-temperature-job="jump"') &&
    bandNav.includes('aria-label="Jump to heat zones"') &&
    bandNav.includes('href={`#band-${band.key}`}') &&
    bandNav.includes("data-active-heat-band={activeKey}") &&
    bandNav.includes('aria-current={active ? "location" : undefined}') &&
    !formPage.includes("function TemperatureRail({ bands, total, params }"),
  "vertical temperature rail must jump to band sections, track active band, and never filter",
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
    formPage.includes('const team = params?.team ?? "";') &&
    formPage.includes("getFormLeaderboard({ window, qualifiedOnly: team ? false : qualifiedOnly, team })") &&
    formPage.includes(".filter((pitcher) => !team || pitcher.team === team)") &&
    formPage.includes("const filteredTotal = team ? leaderboard.pitchers.filter((pitcher) => pitcher.team === team).length : qualifiedPitchers.length;") &&
    formPage.includes("const leagueView = !team;") &&
    formPage.includes('const showBandHeaders = leagueView && sort === "form";') &&
    formPage.includes('data-responsive-check="heat-league-pulse"') &&
    formPage.includes('data-responsive-check="heat-league-stat-strip"') &&
    formPage.includes("{leagueView ? (") &&
    formPage.includes("{leagueView ? <BandDistribution bands={leagueBandCounts} total={qualifiedPitchers.length} activeBand={band} params={params ?? {}} /> : null}") &&
    formPage.includes("{leagueView && biggestRiser && biggestFaller ? (") &&
    formPage.includes("<MoversStrip risers={risers} fallers={fallers} params={params ?? {}} />") &&
    formPage.includes('className={`grid gap-4 scroll-mt-8 ${leagueView ? "lg:grid-cols-[80px_minmax(0,1fr)]" : ""}`}') &&
    formPage.includes("{leagueView ? <HeatCheckBandNav bands={leagueBandCounts} total={qualifiedPitchers.length} /> : null}") &&
    !formPage.includes("Full board") &&
    !formPage.includes("League heat map") &&
    formPage.includes('Boolean(team) || params?.even === "show" || band === "even" || sort !== "form"') &&
    formPage.includes('<section className={`z-20 rounded border border-white/10 bg-[#101014]/95 backdrop-blur sm:sticky sm:top-0 ${team ? "my-3 p-3" : "my-5 p-4"}`} data-responsive-check="form-controls">') &&
    formPage.includes("{leagueView ? <details>") &&
    formPage.includes("</details> : null}") &&
    formPage.includes('team ? <input type="hidden" name="team" value={team} /> : null') &&
    formPage.includes('data-responsive-check="heat-team-filter"') &&
    formPage.includes('function WindowControlLinks({ window, params }') &&
    formPage.includes('data-responsive-check="heat-window-controls"') &&
    formPage.includes('data-responsive-check="heat-league-desktop-window-controls"') &&
    formPage.includes('data-responsive-check="heat-team-window-controls"') &&
    formPage.includes('data-responsive-check="heat-team-mobile-window-controls"') &&
    formPage.includes('<div className="my-5 sm:hidden" data-responsive-check="heat-team-mobile-window-controls">') &&
    !formPage.includes('{activeTeam ? (\n        <div className="my-5 sm:hidden" data-responsive-check="heat-team-mobile-window-controls">') &&
    formPage.includes('<div className="hidden sm:flex sm:flex-wrap sm:items-end sm:gap-3">') &&
    formPage.includes('const clearTeamHref = heatCheckHref({ ...params, team: "" });') &&
    formPage.includes('<HeatTeamClearLink') &&
    formPage.includes("{activeTeam ? (") &&
    formPage.includes("<HeatTeamJumpMenu teams={teams} activeTeam={activeTeam} params={params} />") &&
    formPage.includes('<HeatTeamDrawer key={activeTeam || "all"} teams={teams} activeTeam={activeTeam} params={params} />'),
  "Heat Check must own the team filter in the controls row, attach team clearing to the picker, and team views must show all team pitchers while hiding league-only surfaces",
);

assert(
  formPage.includes('href={href} ariaCurrent={active ? "page" : undefined} scroll={false}') &&
    formPage.includes('ariaCurrent={!activeBand ? "page" : undefined} scroll={false}') &&
    formPage.includes('ariaCurrent={activeBand === band.key ? "page" : undefined} scroll={false}') &&
    formPage.includes('hover:border-amber-300/30" scroll={false}'),
  "Heat Check filter links must preserve mobile scroll position instead of jumping to the top",
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
    teamJumpMenu.includes("onClick={onSelect}") &&
    teamJumpMenu.includes("details.contains(event.target)") &&
    teamJumpMenu.includes('data-responsive-check="heat-team-jump-menu"') &&
    teamJumpMenu.includes('data-team-jump-details') &&
    teamJumpMenu.includes('data-team-jump-list') &&
    teamJumpMenu.includes('data-team-jump-link') &&
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
    teamDrawer.includes("onClick={onSelect}") &&
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
  formPage.includes('import { pitcherHref, sourceParams } from "@/lib/routes";') &&
    formPage.includes('pitcherHref(pitcher, sourceParams("heat", { window }))') &&
    !formPage.includes('href={`/pitchers/${pitcher.pitcherId}/form?window=${window}`}'),
  "Heat Check rows and hero links must use shared canonical pitcherHref links with heat source context",
);

assert(
  formPage.includes('even?: string;') &&
    formPage.includes('const evenExpanded = Boolean(team) || params?.even === "show" || band === "even" || sort !== "form";') &&
    formPage.includes('group.band.key === "even" && !evenExpanded') &&
    formPage.includes('<EvenBandCollapsed count={group.pitchers.length} href={heatCheckHref({ ...params, even: "show" })} />') &&
    formPage.includes('<EvenBandExpanded count={group.pitchers.length} href={heatCheckHref({ ...params, even: "" })} />') &&
    formPage.includes('data-responsive-check="heat-even-collapsed"') &&
    formPage.includes("Show {count} even arms") &&
    formPage.includes("Hide {count} even arms"),
  "Heat Check Even band must be collapsible by default without hiding team views, explicit Even filters, or alternate sorts",
);

assert(
  formPage.includes("heat-check-row scroll-mt-24 grid items-start") &&
    formPage.includes('className="col-start-4 row-start-1 flex items-start justify-end gap-2 text-right sm:col-span-2 sm:col-start-auto sm:row-auto sm:grid sm:grid-cols-[minmax(120px,1fr)_auto] sm:gap-3"') &&
    formPage.includes('className="col-span-full row-start-2 min-w-0 sm:hidden"') &&
    formPage.includes("<FormDeltaLabel summary={pitcher} />") &&
    formPage.includes('fullWindow ? <FormDeltaLabel summary={pitcher} /> : null'),
  "Heat Check rows must top-align rank, headshot, text, trend, sparkline, follow, and score clusters inside each card",
);

assert(
  formPage.includes("function FormDeltaLabel") &&
    formPage.includes('const label = steady ? "steady" : `${marker} ${formatSignedDelta(summary.deltaForm)}`') &&
    formPage.includes("text-cyan-300") &&
    formPage.includes("text-amber-300") &&
    !formPage.includes("<TrendChip summary={pitcher} compact />"),
  "Heat Check row delta must be quiet text in the score cluster, not a stranded bordered pill",
);

console.log("heat check contract ok: bar filters, rail jumps, league counts, filter status, compact momentum hero, form cluster, top-aligned rows, and canonical pitcher links are locked");
