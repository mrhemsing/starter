import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const formService = await readFile("src/lib/data/form-service.ts", "utf8");
const formPage = await readFile("src/app/form/page.tsx", "utf8");
const leaderboardApi = await readFile("src/app/api/form/leaderboard/route.ts", "utf8");
const heatCheckWarmup = await readFile("src/components/heat-check-filter-warmup.tsx", "utf8");
const warmCron = await readFile("src/app/api/cron/warm-live-starts/route.ts", "utf8");

assert(
  formService.includes("team?: string;") &&
    formService.includes("team: options.team ?? \"\"") &&
    formService.includes("getCachedFormLeaderboard(season, window, qualifiedOnly, options.team)") &&
    formService.includes("getTeamAugmentedFormStarts(season, window, startSet.starts, options.team)") &&
    formService.includes("const thinBuckets = teamBuckets.filter((bucket) => bucket.starts.length < window);") &&
    formService.includes("getCachedPitcherSeasonFallbackStarts(bucket.pitcherId, season)") &&
    formService.includes("readArchivedPitcherSeasonProfile(pitcherMlbId, season)") &&
    formService.includes("return mergeScoredStarts(starts, teamFallbackStarts);"),
  "team-filtered Heat Check leaderboards must augment thin team samples from cached/stored season game logs",
);

assert(
  formPage.includes("getFormLeaderboard({ window, qualifiedOnly: team ? false : qualifiedOnly, team })") &&
    leaderboardApi.includes("team: searchParams.get(\"team\") ?? undefined,"),
  "Heat Check page and API must pass team filters into the form leaderboard builder",
);

assert(
  heatCheckWarmup.includes("activeTeam?: string;") &&
    heatCheckWarmup.includes("const team = activeTeam.trim().toUpperCase();") &&
    heatCheckWarmup.includes("if (activeTeam.trim())") &&
    heatCheckWarmup.includes("fetch(`/api/form/leaderboard?window=${window}&qualified=false&team=${teamParam}`)") &&
    formPage.includes("<HeatCheckFilterWarmup activeTeam={team} />"),
  "Heat Check must immediately warm team-specific leaderboard windows so filter taps use cached team responses after the team page loads",
);

assert(
  formService.includes("export async function warmFormLeaderboards") &&
    warmCron.includes('import { warmFormLeaderboards } from "@/lib/data/form-service";') &&
    warmCron.includes('import { getRankedHome } from "@/lib/data/home-ranked-service";') &&
    warmCron.includes("...tonight.games.flatMap((game) => [game.away, game.home]),") &&
    warmCron.includes("getRankedHome(),") &&
    warmCron.includes("warmFormLeaderboards({ teams: slateTeams }),") &&
    warmCron.includes("imageSource: topPerformer.image?.source ?? null") &&
    warmCron.includes("warmedTeams: slateTeams.length"),
  "Live-start cron must prebuild active-slate team Heat Check windows and warm current top-performer imagery",
);

console.log("heat team window contract ok: team-filtered windows use stored fallbacks and warm team caches");
