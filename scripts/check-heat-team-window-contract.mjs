import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const formService = await readFile("src/lib/data/form-service.ts", "utf8");
const formPage = await readFile("src/app/form/page.tsx", "utf8");
const leaderboardApi = await readFile("src/app/api/form/leaderboard/route.ts", "utf8");

assert(
  formService.includes("team?: string;") &&
    formService.includes("team: options.team ?? \"\"") &&
    formService.includes("getCachedFormLeaderboard(season, window, qualifiedOnly, options.team)") &&
    formService.includes("getTeamAugmentedFormStarts(season, window, startSet.starts, options.team)") &&
    formService.includes("const thinBuckets = teamBuckets.filter((bucket) => bucket.starts.length < window);") &&
    formService.includes("getCachedPitcherSeasonFallbackStarts(bucket.pitcherId, season)") &&
    formService.includes("return mergeScoredStarts(starts, teamFallbackStarts);"),
  "team-filtered Heat Check leaderboards must augment thin team samples from cached MLB season game logs",
);

assert(
  formPage.includes("getFormLeaderboard({ window, qualifiedOnly: team ? false : qualifiedOnly, team })") &&
    leaderboardApi.includes("team: searchParams.get(\"team\") ?? undefined,"),
  "Heat Check page and API must pass team filters into the form leaderboard builder",
);

console.log("heat team window contract ok: team-filtered Last 10 can augment thin archive samples");
