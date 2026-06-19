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

console.log("Site performance contract passed");
