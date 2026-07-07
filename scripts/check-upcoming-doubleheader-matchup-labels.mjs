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

assert(mustWatch.includes("data-visible-matchup-status-labels={shownGames.length ? shownGames.map((game) => matchupStatusLabel(game, game.gamePk === topWatchGamePk)).join(\"|\") : \"none\"}"), "Upcoming cards must expose one matchup quality/status label per visible card.");
assert(mustWatch.includes("function matchupStatusLabel(game: TonightGame, isTopWatchScore: boolean)"), "Detailed cards must derive the top-right quality tag from one helper.");
assert(mustWatch.includes('if (isTopWatchScore) return "TOP WATCH SCORE";'), "Exactly the max watch-score card must get TOP WATCH SCORE.");
assert(mustWatch.includes("watchMatchupQualityBand(game.gameWatchScore).label"), "Non-top detailed cards must use shared watch matchup quality bands.");
assert(mustWatch.includes("watchScoreConfidenceLabel(game.watchScoreConfidence)"), "Limited-data games must use confidence treatment instead of unqualified quality copy.");
assert(mustWatch.includes("data-matchup-quality-tag={statusLabel}"), "Detailed cards must render the top-right quality tag in the status slot.");
assert(!mustWatch.includes("return `${ordinal(game.matchupRankTonight)} matchup`;"), "ordinal matchup status labels must be retired.");
assert(!mustWatch.includes("`${ordinal(game.matchupRankTonight)} ${rankLabel}`"), "ordinal matchup component detail copy must be retired.");

console.log("upcoming doubleheader and matchup label contract ok");
