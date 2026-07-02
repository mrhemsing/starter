import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const [formPage, seasonRoute, siteNav, routeLoading] = await Promise.all([
  readFile("src/app/form/page.tsx", "utf8"),
  readFile("src/app/heat-check/season/page.tsx", "utf8"),
  readFile("src/components/site-nav.tsx", "utf8"),
  readFile("src/components/route-loading-shell.tsx", "utf8"),
]);

assert(
  seasonRoute.includes("generateSeasonHeatCheckMetadata as generateMetadata") &&
    seasonRoute.includes("HeatCheckSeasonPage as default") &&
    formPage.includes("export async function HeatCheckSeasonPage") &&
    formPage.includes('return <HeatCheckPage searchParams={searchParams} view="season" />;'),
  "Heat Check season route must render the existing SEASON view without creating a new nav page",
);

assert(
  formPage.includes('const title = view === "season" ? `${getHomeSlateDate().slice(0, 4)} MLB Season GS+ Leaderboard` : formPageTitle(window);') &&
    formPage.includes('const url = view === "season" ? "/heat-check/season"') &&
    formPage.includes('return generateHeatCheckMetadata({ searchParams, view: "season" });'),
  "Heat Check season route must have distinct leaderboard metadata and canonical URL",
);

assert(
  formPage.includes('const params = { ...(rawParams ?? {}), view };') &&
    formPage.includes('const path = values.view === "season" ? "/heat-check/season" : "/heat-check";') &&
    formPage.includes('if (key === "view") continue;') &&
    formPage.includes('href={heatCheckHref({ ...params, view: "season", band: "", motion: "", sort: "", even: "", hot: "", cooling: "", show: "" })}'),
  "Heat Check toggle and filter links must keep the season view on /heat-check/season instead of ?view=season",
);

assert(
  siteNav.includes("{ key: \"home\" as const") &&
    siteNav.includes("{ key: \"starts\" as const") &&
    siteNav.includes("{ key: \"heat\" as const") &&
    siteNav.includes("{ key: \"watchlist\" as const") &&
    !siteNav.includes("leaderboard") &&
    routeLoading.includes('const navLabels = ["Home", "Ranked Starts", "Heat Check", "Live", "Upcoming", "Watchlist"] as const;'),
  "primary navigation must stay at six items with no standalone leaderboard nav item",
);

console.log("heat check season route contract ok: /heat-check/season owns SEASON without changing nav");
