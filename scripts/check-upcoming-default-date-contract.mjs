import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const packageJson = JSON.parse(await read("package.json"));
const startService = await read("src/lib/data/start-service.ts");
const tonightService = await read("src/lib/data/tonight-service.ts");
const upcomingIndexPage = await read("src/app/upcoming/page.tsx");
const upcomingIndexImage = await read("src/app/upcoming/opengraph-image.tsx");
const upcomingWeekIndexPage = await read("src/app/upcoming/week/page.tsx");
const upcomingWeekIndexImage = await read("src/app/upcoming/week/opengraph-image.tsx");
const tonightApi = await read("src/app/api/tonight/route.ts");
const upcomingApi = await read("src/app/api/upcoming/route.ts");
const siteNav = await read("src/components/site-nav.tsx");

assert.equal(packageJson.scripts["check:upcoming-default-date"], "node scripts/check-upcoming-default-date-contract.mjs", "package.json must expose check:upcoming-default-date.");
assert.match(startService, /export async function getDefaultSlateDates\(today = getHomeSlateDate\(\), _now = new Date\(\)\)/, "Default slate date resolver must accept an injectable clock.");
assert.match(startService, /const \[rankedDate, upcomingDate\] = await Promise\.all\(\[[\s\S]*getRankedStartsDefaultDate\(today\),[\s\S]*getDefaultUpcomingDate\(today\),[\s\S]*\]\)/, "Default slate date resolver must load ranked and upcoming defaults together.");
assert.match(startService, /const getCachedDefaultUpcomingDate = unstable_cache\([\s\S]*fetchMlbSchedule\(today, \{ fetchLive: shouldFetchLiveSchedule\(today\) \}\);[\s\S]*return shouldDefaultUpcomingToTomorrow\(schedule\) \? addDays\(today, 1\) : today;[\s\S]*\{ revalidate: DEFAULT_UPCOMING_DATE_REVALIDATE_SECONDS, tags: \[SLATE_CACHE_TAG, UPCOMING_CACHE_TAG\] \}/, "Upcoming default must use cached live schedule state and shared slate/upcoming cache tags.");
assert.match(startService, /function shouldDefaultUpcomingToTomorrow\(schedule: MlbSchedule\)[\s\S]*countableGames\.length === 0[\s\S]*return countableGames\.every\(\(game\) => !isUpcomingDefaultActiveGame\(game\)\);/, "Upcoming default must keep true off-days stable and otherwise require at least one pregame game to stay on today.");
assert.match(startService, /function isUpcomingDefaultActiveGame\(game: MlbScheduleGame\)[\s\S]*if \(isFinalGameState\(game\) \|\| isPostponedGameState\(game\)\) return false;[\s\S]*return !isLiveGameState\(game\);/, "Upcoming default must keep only pregame or not-yet-live games active and flip once every game has started.");
assert.match(startService, /function isLiveGameState\(game: MlbScheduleGame\)/, "Start service must expose a local live-game classifier for upcoming defaulting.");
assert.match(upcomingIndexPage, /import \{ getDefaultUpcomingDate \} from "@\/lib\/data\/start-service";[\s\S]*const upcomingDate = await getDefaultUpcomingDate\(\);[\s\S]*<UpcomingDatePage params=\{Promise\.resolve\(\{ date: upcomingDate \}\)\}/, "The /upcoming index must render the shared default upcoming date.");
assert.match(upcomingIndexImage, /import \{ getDefaultUpcomingDate \} from "@\/lib\/data\/start-service";[\s\S]*const upcomingDate = await getDefaultUpcomingDate\(\);[\s\S]*Image\(\{ params: Promise\.resolve\(\{ date: upcomingDate \}\) \}\)/, "The /upcoming Open Graph wrapper must use the shared default upcoming date without loading ranked defaults.");
assert.match(upcomingWeekIndexPage, /import \{ getDefaultUpcomingDate \} from "@\/lib\/data\/start-service";[\s\S]*const startDate = await getDefaultUpcomingDate\(\);[\s\S]*getUpcomingMustWatch\(\{ start: startDate, days: 7, window: 5 \}\)[\s\S]*const upcomingDate = await getDefaultUpcomingDate\(\);[\s\S]*<UpcomingWeekPage params=\{Promise\.resolve\(\{ startDate: upcomingDate \}\)\}/, "The /upcoming/week index metadata and page must use the shared default upcoming date without loading ranked defaults.");
assert.match(upcomingWeekIndexImage, /import \{ getDefaultUpcomingDate \} from "@\/lib\/data\/start-service";[\s\S]*const upcomingDate = await getDefaultUpcomingDate\(\);[\s\S]*Image\(\{ params: Promise\.resolve\(\{ startDate: upcomingDate \}\) \}\)/, "The /upcoming/week Open Graph wrapper must use the shared default upcoming date without loading ranked defaults.");
for (const [label, source] of [
  ["/upcoming page", upcomingIndexPage],
  ["/upcoming Open Graph wrapper", upcomingIndexImage],
  ["/upcoming/week page", upcomingWeekIndexPage],
  ["/upcoming/week Open Graph wrapper", upcomingWeekIndexImage],
]) {
  assert.doesNotMatch(source, /getDefaultSlateDates/, `${label} must not load ranked defaults for upcoming-only routing.`);
}
assert.match(siteNav, /const upcomingItem = \[\{ key: "upcoming" as const, label: "Upcoming", href: "\/upcoming" \}\];/, "Primary nav Upcoming link must stay on the stable /upcoming index so stale shells can resolve the shared default at request time.");
assert.doesNotMatch(siteNav, /upcomingDateHref\(defaultDates\.upcomingDate\)/, "Primary nav Upcoming link must not bake a dated default into shared chrome.");
assert.match(tonightService, /export async function getTonightMustWatch[\s\S]*normalizeDateKey\(options\.date\) \?\? await getDefaultUpcomingDate\(\)/, "Tonight service must use the shared default upcoming date when no date is supplied.");
assert.match(tonightService, /export async function getUpcomingMustWatch[\s\S]*normalizeDateKey\(options\.start \?\? options\.date\) \?\? await getDefaultUpcomingDate\(\)/, "Upcoming service must use the shared default upcoming date when no date/start is supplied.");
assert.match(tonightService, /function normalizeUpcomingDays\(days: number \| undefined\)[\s\S]*Math\.max\(1, Math\.min\(7, Math\.floor\(days\)\)\)/, "Upcoming service must clamp API day ranges to the public one-week surface.");
assert.match(tonightApi, /export const dynamic = "force-dynamic";/, "/api/tonight must stay dynamic for runtime slate defaults.");
assert.match(upcomingApi, /export const dynamic = "force-dynamic";/, "/api/upcoming must stay dynamic for runtime slate defaults.");
assert.match(tonightApi, /if \(date && !isValidDateRouteParam\(date\)\) return invalidDateRouteResponse\(\);/, "/api/tonight must reject invalid explicit dates before defaulting.");
assert.match(upcomingApi, /if \(\(date && !isValidDateRouteParam\(date\)\) \|\| \(start && !isValidDateRouteParam\(start\)\)\) return invalidDateRouteResponse\(\);/, "/api/upcoming must reject invalid explicit date/start params before defaulting.");
assert.match(tonightApi, /getTonightMustWatch\(\{ date, window: window === 3 \|\| window === 10 \? window : 5 \}\)/, "/api/tonight must delegate to the service with normalized public form windows.");
assert.match(upcomingApi, /getUpcomingMustWatch\(\{[\s\S]*date,[\s\S]*start,[\s\S]*days,[\s\S]*window: window === 3 \|\| window === 10 \? window : 5,[\s\S]*\}\)/, "/api/upcoming must delegate to the service with shared default-date inputs and normalized public form windows.");
assert.match(tonightApi, /"Cache-Control": `public, s-maxage=\$\{TONIGHT_REVALIDATE_SECONDS\}, stale-while-revalidate=300`/, "/api/tonight must keep service-owned cache headers.");
assert.match(upcomingApi, /"Cache-Control": `public, s-maxage=\$\{UPCOMING_REVALIDATE_SECONDS\}, stale-while-revalidate=300`/, "/api/upcoming must keep service-owned cache headers.");

console.log("Upcoming default date contract passed.");

async function read(file) {
  return readFile(new URL(`../${file}`, import.meta.url), "utf8");
}
