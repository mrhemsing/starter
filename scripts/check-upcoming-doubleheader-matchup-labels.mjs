import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const statsClient = await readFile("src/lib/data/mlb-stats-client.ts", "utf8");
const startService = await readFile("src/lib/data/start-service.ts", "utf8");
const tonightService = await readFile("src/lib/data/tonight-service.ts", "utf8");
const mustWatch = await readFile("src/components/tonights-must-watch.tsx", "utf8");
const types = await readFile("src/lib/types.ts", "utf8");

assert(statsClient.includes("function reportedProbableKey(awayAbbreviation: string, homeAbbreviation: string, side: \"home\" | \"away\", gameDate?: string)"), "reported probable merge key must include gameDate.");
assert(statsClient.includes("gameDateMinuteKey(gameDate)"), "reported probable merge key must normalize start time.");
assert(statsClient.includes("competition.date ?? event.date"), "ESPN reported probable merge must read the event/competition start time.");
assert(!statsClient.includes('reportedProbableKey(game.awayTeam.abbreviation, game.homeTeam.abbreviation, "away")'), "reported probable merge must not key only by away/home/side.");
assert(!statsClient.includes('reportedProbableKey(game.awayTeam.abbreviation, game.homeTeam.abbreviation, "home")'), "reported probable merge must not key only by away/home/side.");

assert(types.includes("gameNumber?: number | null;") && types.includes("doubleHeader?: string | null;"), "schedule and Tonight game types must carry doubleheader metadata.");
assert(statsClient.includes('doubleHeader: game.doubleHeader ?? null'), "MLB schedule parsing must carry doubleHeader.");
assert(statsClient.includes('gameNumber: typeof game.gameNumber === "number" ? game.gameNumber : null'), "MLB schedule parsing must carry gameNumber.");
assert(tonightService.includes("function matchupLabel(game: MlbScheduleGame)") && tonightService.includes("return `${base}, Gm ${game.gameNumber}`;"), "Upcoming labels must render game numbers for doubleheaders.");
assert(startService.includes("`${slateDate}-${probable.gamePk}-"), "probable IDs must include gamePk so doubleheader slots stay independent.");
assert(tonightService.includes('["tonight-must-watch", "v15"]'), "Upcoming cache namespace must be bumped for corrected doubleheader probables.");

assert(mustWatch.includes('data-visible-matchup-status-labels="none"'), "Upcoming cards must keep the former far-right matchup status slot empty.");
assert(mustWatch.includes('data-matchup-status-label="none"'), "Each Upcoming card must expose the retired matchup status slot as empty telemetry.");
assert(!mustWatch.includes("matchupStatusLabel("), "far-right matchup status label rendering must be removed.");
assert(!mustWatch.includes("watchMatchupQualityBand(game.gameWatchScore)"), "watch quality labels must not replace the retired far-right matchup labels.");
assert(!mustWatch.includes("TOP WATCH SCORE"), "top watch score must not render as a far-right matchup label.");
for (const label of ["ELITE MATCHUP", "PLUS MATCHUP", "SOLID MATCHUP", "EVEN MATCHUP", "LIMITED DATA"]) {
  assert(!mustWatch.includes(label), `far-right matchup label copy must stay removed: ${label}`);
}
assert(!mustWatch.includes("return `${ordinal(game.matchupRankTonight)} matchup`;"), "ordinal matchup status labels must be retired.");
assert(!mustWatch.includes("`${ordinal(game.matchupRankTonight)} ${rankLabel}`"), "ordinal matchup component detail copy must be retired.");

console.log("upcoming doubleheader and matchup label contract ok");
