import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const formPage = await readFile("src/app/form/page.tsx", "utf8");
const heatRoute = await readFile("src/app/heat-check/page.tsx", "utf8");
const escapeClear = await readFile("src/components/heat-check-escape-clear.tsx", "utf8");

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
  formPage.includes('data-temperature-job="jump"') &&
    formPage.includes('aria-label="Jump to heat zones"') &&
    formPage.includes('href={`#band-${band.key}`}') &&
    !formPage.includes("function TemperatureRail({ bands, total, params }"),
  "vertical temperature rail must jump to band sections and never filter",
);

assert(
  formPage.includes('data-temperature-job="mobile-jump"') &&
    formPage.includes("function MobileBandJumper") &&
    formPage.includes('aria-label="Jump to heat band"'),
  "mobile Heat Check must replace the rail with a sticky band jumper",
);

assert(
  formPage.includes('data-responsive-check="heat-filter-status"') &&
    formPage.includes('activeFilterLabel === "All arms"') &&
    formPage.includes("Click a segment to filter · league totals stay visible") &&
    formPage.includes('Showing {activeFilterLabel} · {pitchers.length} of {qualifiedPitchers.length} · {"✕"} Show all'),
  "Heat Check must swap the hint for a persistent filtered-list status with Show all affordance",
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
  formPage.includes('import { pitcherHref, sourceParams } from "@/lib/routes";') &&
    formPage.includes('pitcherHref(pitcher, sourceParams("heat", { window }))') &&
    !formPage.includes('href={`/pitchers/${pitcher.pitcherId}/form?window=${window}`}'),
  "Heat Check rows and hero links must use shared canonical pitcherHref links with heat source context",
);

console.log("heat check contract ok: bar filters, rail jumps, league counts, filter status, and canonical pitcher links are locked");
