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

assert(
  heatRoute.includes('export { generateHeatCheckMetadata as generateMetadata, HeatCheckPage as default } from "@/app/form/page";'),
  "/heat-check must render the canonical Heat Check page implementation",
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
    formPage.includes('aria-current={!activeBand ? "page" : undefined}') &&
    formPage.includes("href={heatCheckHref({ ...params, band: active ? \"\" : band.key })}") &&
    formPage.includes("activeBand"),
  "horizontal temperature bar must be the filter surface with visible All state and highlighted active filter",
);

assert(
  formPage.includes('<span className="block">Furnace to freezer across the last {window} qualified starts.</span>') &&
    formPage.includes('<span className="block lg:whitespace-nowrap">The trace shows where every arm is moving; the glow is reserved for the poles.</span>'),
  "Heat Check deck must force a break after the first sentence and keep the second sentence unwrapped on desktop",
);

assert(
  formPage.includes("<HeatCheckBandNav bands={leagueBandCounts} total={qualifiedPitchers.length} />") &&
    bandNav.includes('"use client";') &&
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
    bandNav.includes('aria-current="location"'),
  "mobile Heat Check must replace the rail with a sticky band jumper that tracks the active band",
);

assert(
  formPage.includes('data-responsive-check="heat-filter-status"') &&
    formPage.includes('activeFilterLabel === "All arms"') &&
    formPage.includes("Click a segment to filter · league totals stay visible") &&
    formPage.includes('Showing {activeFilterLabel} · {pitchers.length} of {qualifiedPitchers.length} · {"✕"} Show all'),
  "Heat Check must swap the hint for a persistent filtered-list status with Show all affordance",
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
    formPage.includes('const evenExpanded = params?.even === "show" || band === "even" || sort !== "form";') &&
    formPage.includes('group.band.key === "even" && !evenExpanded') &&
    formPage.includes('<EvenBandCollapsed count={group.pitchers.length} href={heatCheckHref({ ...params, even: "show" })} />') &&
    formPage.includes('<EvenBandExpanded count={group.pitchers.length} href={heatCheckHref({ ...params, even: "" })} />') &&
    formPage.includes('data-responsive-check="heat-even-collapsed"') &&
    formPage.includes("Show {count} even arms") &&
    formPage.includes("Hide {count} even arms"),
  "Heat Check Even band must be collapsible by default without hiding explicit Even filters or alternate sorts",
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
