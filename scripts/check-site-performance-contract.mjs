import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function read(path) {
  return await readFile(path, "utf8");
}

const tonightService = await read("src/lib/data/tonight-service.ts");
const duelsService = await read("src/lib/data/duels-service.ts");
const rankedService = await read("src/lib/data/home-ranked-service.ts");
const environmentService = await read("src/lib/data/run-environment.ts");
const startService = await read("src/lib/data/start-service.ts");
const tonightRoute = await read("src/app/api/tonight/route.ts");
const upcomingRoute = await read("src/app/api/upcoming/route.ts");
const duelsRoute = await read("src/app/api/duels/route.ts");
const rankedRoute = await read("src/app/api/home/ranked/route.ts");
const homeStatusRoute = await read("src/app/api/home/status/route.ts");
const formHomeRoute = await read("src/app/api/form/home/route.ts");
const formLeaderboardRoute = await read("src/app/api/form/leaderboard/route.ts");
const pitcherFormRoute = await read("src/app/api/form/pitcher/[id]/route.ts");
const pitcherProfileRoute = await read("src/app/api/pitchers/[id]/route.ts");
const fastFilterLink = await read("src/components/fast-filter-link.tsx");
const heatCheckWarmup = await read("src/components/heat-check-filter-warmup.tsx");
const heatCheckPage = await read("src/app/form/page.tsx");
const upcomingDatePage = await read("src/app/upcoming/[date]/page.tsx");
const startsPage = await read("src/app/starts/[id]/page.tsx");
const appLoading = await read("src/app/loading.tsx");
const routeLoadingShell = await read("src/components/route-loading-shell.tsx");
const globals = await read("src/app/globals.css");

assert(
  tonightService.includes('import { unstable_cache } from "next/cache";') &&
    tonightService.includes("export const TONIGHT_REVALIDATE_SECONDS = 60;") &&
    tonightService.includes("const getCachedTonightMustWatch = unstable_cache(") &&
    tonightService.includes("const promise = getCachedTonightMustWatch(date, window);"),
  "Must-Watch data must use Next data cache, not only per-process memoization",
);

assert(
  duelsService.includes('import { unstable_cache } from "next/cache";') &&
    duelsService.includes("export const DUELS_REVALIDATE_SECONDS = 60;") &&
    duelsService.includes("const getCachedPitchingDuels = unstable_cache(") &&
    duelsService.includes("const promise = getCachedPitchingDuels(date, mode);"),
  "Pitching duels must use Next data cache for repeated page/API loads",
);

assert(
  rankedService.includes('import { unstable_cache } from "next/cache";') &&
    rankedService.includes("export const HOME_RANKED_REVALIDATE_SECONDS = 60;") &&
    rankedService.includes("const getCachedRankedHome = unstable_cache(") &&
    rankedService.includes("return getCachedRankedHome(getHomeSlateDate());"),
  "Home ranked data must use Next data cache for repeated homepage/API loads",
);

assert(
  environmentService.includes("const WEATHER_REVALIDATE_SECONDS = 15 * 60;") &&
    environmentService.includes("next: { revalidate: WEATHER_REVALIDATE_SECONDS }") &&
    !environmentService.includes('cache: "no-store"'),
  "Game-time weather must be revalidated instead of fetched no-store on every render",
);

assert(
  startService.includes('import { unstable_cache } from "next/cache";') &&
    startService.includes("export const PITCHER_PROFILE_REVALIDATE_SECONDS = 15 * 60;") &&
    startService.includes("const getCachedPitcherApiResponse = unstable_cache(") &&
    startService.includes("return getCachedPitcherApiResponse(pitcherId, controls.sort ?? null, controls.result ?? null);"),
  "Pitcher API profiles must cache the assembled response for warm profile navigation",
);

const cacheRoutes = [
  ["tonight API", tonightRoute, "TONIGHT_REVALIDATE_SECONDS", "stale-while-revalidate=300"],
  ["upcoming API", upcomingRoute, "UPCOMING_REVALIDATE_SECONDS", "stale-while-revalidate=300"],
  ["duels API", duelsRoute, "DUELS_REVALIDATE_SECONDS", "stale-while-revalidate=300"],
  ["home ranked API", rankedRoute, "HOME_RANKED_REVALIDATE_SECONDS", "stale-while-revalidate=300"],
  ["home status API", homeStatusRoute, "HOME_STATUS_REVALIDATE_SECONDS", "stale-while-revalidate=300"],
  ["form home API", formHomeRoute, "FORM_HOME_REVALIDATE_SECONDS", "stale-while-revalidate=3600"],
  ["form leaderboard API", formLeaderboardRoute, "FORM_LEADERBOARD_REVALIDATE_SECONDS", "stale-while-revalidate=3600"],
  ["pitcher form API", pitcherFormRoute, "PITCHER_FORM_REVALIDATE_SECONDS", "stale-while-revalidate=3600"],
  ["pitcher profile API", pitcherProfileRoute, "PITCHER_PROFILE_REVALIDATE_SECONDS", "stale-while-revalidate=3600"],
];

for (const [label, source, ttlConstant, staleWindow] of cacheRoutes) {
  assert(
    source.includes(ttlConstant) &&
      source.includes('"Cache-Control"') &&
      source.includes("public, s-maxage=") &&
      source.includes(staleWindow),
    `${label} must emit CDN cache headers`,
  );
}

assert(
  fastFilterLink.includes('"use client";') &&
    fastFilterLink.includes("router.prefetch(href)") &&
    fastFilterLink.includes("usePathname") &&
    fastFilterLink.includes("useSearchParams") &&
    fastFilterLink.includes("const currentHref = `${pathname}${currentSearch ? `?${currentSearch}` : \"\"}`;") &&
    fastFilterLink.includes("pendingIntent?.href === href && pendingIntent.from === currentHref") &&
    fastFilterLink.includes("setPendingIntent({ href, from: currentHref })") &&
    fastFilterLink.includes('pending ? " opacity-70" : ""') &&
    fastFilterLink.includes("scroll?: boolean;") &&
    fastFilterLink.includes("scroll = true") &&
    fastFilterLink.includes("scroll={scroll}") &&
    !fastFilterLink.includes("pointer-events-none opacity-70") &&
    fastFilterLink.includes("onPointerEnter={warmRoute}") &&
    fastFilterLink.includes("onPointerDown={warmRoute}") &&
    fastFilterLink.includes("onFocus={warmRoute}") &&
    fastFilterLink.includes("data-fast-filter-link"),
  "Filter links must prefetch on mount, warm routes on pointer/focus, and keep route buttons clickable after navigation",
);

assert(
  heatCheckPage.includes('import { FastFilterLink } from "@/components/fast-filter-link";') &&
    startsPage.includes('import { FastFilterLink } from "@/components/fast-filter-link";'),
  "Heat Check and Ranked Starts filter controls must use FastFilterLink",
);

assert(
  upcomingDatePage.includes("data-control-link-active={String(active)}"),
  "Upcoming filter controls must preserve active-state metadata",
);

assert(
  appLoading.includes('import { RouteLoadingShell } from "@/components/route-loading-shell";') &&
    appLoading.includes('responsiveCheck="app-route-loading"') &&
    routeLoadingShell.includes("export function RouteLoadingShell") &&
    routeLoadingShell.includes('aria-busy="true"') &&
    routeLoadingShell.includes("route-loading-spinner") &&
    routeLoadingShell.includes("route-loading-delayed-message") &&
    routeLoadingShell.includes("Retrieving fresh data") &&
    globals.includes(".route-loading-spinner") &&
    globals.includes("animation: route-loading-spin 880ms linear infinite;") &&
    globals.includes(".route-loading-delayed-message") &&
    globals.includes("animation: route-loading-delayed-message 160ms ease 2s both;") &&
    globals.includes("@media (prefers-reduced-motion: reduce)"),
  "slow route transitions must use a shared app-level loading shell with an animated spinner and 2s delayed data message",
);

assert(
  heatCheckWarmup.includes("const HEAT_WINDOWS = [3, 5, 10] as const;") &&
    heatCheckWarmup.includes("/api/form/leaderboard?window=${window}") &&
    heatCheckWarmup.includes("/api/form/leaderboard?window=${window}&qualified=false") &&
    heatCheckWarmup.includes("/api/form/leaderboard?window=${window}&qualified=false&team=${teamParam}") &&
    heatCheckWarmup.includes("/api/tonight?window=${window}") &&
    heatCheckWarmup.includes("requestIdleCallback") &&
    heatCheckPage.includes("<HeatCheckFilterWarmup activeTeam={team} />"),
  "Heat Check must warm common filter-window data after initial render",
);

console.log("Site performance contract passed");
