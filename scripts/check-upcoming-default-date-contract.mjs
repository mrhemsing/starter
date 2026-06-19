import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const packageJson = JSON.parse(await read("package.json"));
const startService = await read("src/lib/data/start-service.ts");
const upcomingIndexPage = await read("src/app/upcoming/page.tsx");
const siteNav = await read("src/components/site-nav.tsx");

assert.equal(packageJson.scripts["check:upcoming-default-date"], "node scripts/check-upcoming-default-date-contract.mjs", "package.json must expose check:upcoming-default-date.");
assert.match(startService, /const UPCOMING_LIVE_GAME_MAX_AGE_MS = 60 \* 60 \* 1000;/, "Upcoming default must share the one-hour stale live-game threshold.");
assert.match(startService, /export async function getDefaultSlateDates\(today = getHomeSlateDate\(\), now = new Date\(\)\)/, "Default slate date resolver must accept an injectable clock.");
assert.match(startService, /Promise\.all\(\[[\s\S]*getRankedSlateCompletionState\(today, today\),[\s\S]*fetchMlbSchedule\(today, \{ fetchLive: shouldFetchLiveSchedule\(today\) \}\),[\s\S]*\]\)/, "Default slate date resolver must load completion and schedule together.");
assert.match(startService, /upcomingDate: shouldDefaultUpcomingToTomorrow\(schedule, now\) \? addDays\(today, 1\) : today/, "Upcoming default must hand off to tomorrow through the stale-game helper.");
assert.match(startService, /function shouldDefaultUpcomingToTomorrow\(schedule: MlbSchedule, now: Date\)[\s\S]*countableGames\.length === 0[\s\S]*return countableGames\.every\(\(game\) => !isUpcomingDefaultActiveGame\(game, now\)\);/, "Upcoming default must keep true off-days stable and otherwise require at least one active game to stay on today.");
assert.match(startService, /function isUpcomingDefaultActiveGame\(game: MlbScheduleGame, now: Date\)[\s\S]*if \(isFinalGameState\(game\) \|\| isPostponedGameState\(game\)\) return false;[\s\S]*if \(!isLiveGameState\(game\)\) return true;[\s\S]*now\.getTime\(\) - firstPitchMs <= UPCOMING_LIVE_GAME_MAX_AGE_MS;/, "Upcoming default must keep pregame games active and age live games out after one hour.");
assert.match(startService, /function isLiveGameState\(game: MlbScheduleGame\)/, "Start service must expose a local live-game classifier for upcoming defaulting.");
assert.match(upcomingIndexPage, /const \{ upcomingDate \} = await getDefaultSlateDates\(\);[\s\S]*<UpcomingDatePage params=\{Promise\.resolve\(\{ date: upcomingDate \}\)\}/, "The /upcoming index must render the shared default upcoming date.");
assert.match(siteNav, /const \{ rankedDate, upcomingDate \} = await getDefaultSlateDates\(today\);[\s\S]*href: upcomingDateHref\(upcomingDate\)/, "Primary nav Upcoming link must use the shared default upcoming date.");

console.log("Upcoming default date contract passed.");

async function read(file) {
  return readFile(new URL(`../${file}`, import.meta.url), "utf8");
}
