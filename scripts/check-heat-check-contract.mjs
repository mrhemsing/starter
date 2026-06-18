import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const formPage = await readFile("src/app/form/page.tsx", "utf8");
const heatRoute = await readFile("src/app/heat-check/page.tsx", "utf8");

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
    formPage.includes("Click a segment to filter") &&
    formPage.includes("href={heatCheckHref({ ...params, band: band.key })}") &&
    formPage.includes("activeBand"),
  "horizontal temperature bar must be the filter surface with highlighted active filter",
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
    formPage.includes("Showing {activeFilterLabel} · {pitchers.length} of {qualifiedPitchers.length}") &&
    formPage.includes("Clear"),
  "Heat Check must show persistent filtered-list status with clear affordance",
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
  formPage.includes('import { pitcherHref } from "@/lib/routes";') &&
    formPage.includes("pitcherHref(pitcher, { window })") &&
    !formPage.includes('href={`/pitchers/${pitcher.pitcherId}/form?window=${window}`}'),
  "Heat Check rows and hero links must use shared canonical pitcherHref links",
);

console.log("heat check contract ok: bar filters, rail jumps, league counts, filter status, and canonical pitcher links are locked");
