import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const packageJson = JSON.parse(await read("package.json"));
const startService = await read("src/lib/data/start-service.ts");
const upcomingIndexPage = await read("src/app/upcoming/page.tsx");
const siteNav = await read("src/components/site-nav.tsx");

assert.equal(packageJson.scripts["check:upcoming-default-date"], "node scripts/check-upcoming-default-date-contract.mjs", "package.json must expose check:upcoming-default-date.");
assert.match(startService, /export async function getDefaultSlateDates\(today = getHomeSlateDate\(\), _now = new Date\(\)\)/, "Default slate date resolver must accept an injectable clock.");
assert.match(startService, /Promise\.all\(\[[\s\S]*getRankedSlateCompletionState\(today, today\),[\s\S]*fetchMlbSchedule\(today, \{ fetchLive: shouldFetchLiveSchedule\(today\) \}\),[\s\S]*\]\)/, "Default slate date resolver must load completion and schedule together.");
assert.match(startService, /upcomingDate: shouldDefaultUpcomingToTomorrow\(schedule\) \? addDays\(today, 1\) : today/, "Upcoming default must hand off to tomorrow through the started-game helper.");
assert.match(startService, /function shouldDefaultUpcomingToTomorrow\(schedule: MlbSchedule\)[\s\S]*countableGames\.length === 0[\s\S]*return countableGames\.every\(\(game\) => !isUpcomingDefaultActiveGame\(game\)\);/, "Upcoming default must keep true off-days stable and otherwise require at least one pregame game to stay on today.");
assert.match(startService, /function isUpcomingDefaultActiveGame\(game: MlbScheduleGame\)[\s\S]*if \(isFinalGameState\(game\) \|\| isPostponedGameState\(game\)\) return false;[\s\S]*return !isLiveGameState\(game\);/, "Upcoming default must keep only pregame or not-yet-live games active and flip once every game has started.");
assert.match(startService, /function isLiveGameState\(game: MlbScheduleGame\)/, "Start service must expose a local live-game classifier for upcoming defaulting.");
assert.match(upcomingIndexPage, /const \{ upcomingDate \} = await getDefaultSlateDates\(\);[\s\S]*<UpcomingDatePage params=\{Promise\.resolve\(\{ date: upcomingDate \}\)\}/, "The /upcoming index must render the shared default upcoming date.");
assert.match(siteNav, /getDefaultSlateDates\(today\)[\s\S]*href: upcomingDateHref\(upcomingDate\)/, "Primary nav Upcoming link must use the shared default upcoming date.");

console.log("Upcoming default date contract passed.");

async function read(file) {
  return readFile(new URL(`../${file}`, import.meta.url), "utf8");
}
