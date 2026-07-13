import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [liveService, liveComponent, startService, mlbClient, liveRoute, livePage, liveConfig] = await Promise.all([
  readFile("src/lib/data/live-scoreboard-service.ts", "utf8"),
  readFile("src/components/live-scoreboard.tsx", "utf8"),
  readFile("src/lib/data/start-service.ts", "utf8"),
  readFile("src/lib/data/mlb-stats-client.ts", "utf8"),
  readFile("src/app/live/route.ts", "utf8"),
  readFile("src/app/live/[date]/page.tsx", "utf8"),
  readFile("src/lib/live-board-config.ts", "utf8"),
]);

const response = await fetch("https://statsapi.mlb.com/api/v1/schedule?sportId=1&gameTypes=R&date=2026-07-13&hydrate=probablePitcher%2Cteam");
assert(response.ok, "MLB schedule probe for 2026-07-13 should succeed");
const payload = await response.json();
assert(payload.totalGames === 0 && Array.isArray(payload.dates) && payload.dates.length === 0, "2026-07-13 schedule probe should be a true zero-game day");

assert(
  startService.includes("allowDemoFallback?: boolean;") &&
    startService.includes("params.allowDemoFallback !== false") &&
    startService.includes("scheduledStarts.length > 0 || !allowDemoFallback ? scheduledStarts : demoSlateStarts") &&
    startService.includes('export function getBoardDate(now = new Date())') &&
    startService.includes('return toTimeZoneIsoDate(now, "America/Vancouver");'),
  "start service must expose a Pacific board-date helper and allow live board callers to reject demo fallback rows",
);

assert(
  mlbClient.includes('gameTypes: "R"') &&
    mlbClient.includes('date,') &&
    mlbClient.includes('hydrate: "probablePitcher,team"'),
  "MLB schedule fetch must request regular-season games for the exact date with probable pitcher hydration",
);

assert(
  liveRoute.includes('import { getBoardDate } from "@/lib/data/live-scoreboard-service";') &&
    liveRoute.includes("liveDateHref(getBoardDate())") &&
    livePage.includes('import { getBoardDate, getLiveScoreboard } from "@/lib/data/live-scoreboard-service";') &&
    livePage.includes("const today = getBoardDate();"),
  "/live route and page must use the live board-date helper instead of deriving today independently",
);

assert(
  liveService.includes('export type LiveScoreboard = SlateStartBucketCounts & {') &&
    liveService.includes('mode: "slate" | "empty" | "error";') &&
    liveService.includes('getDailySlate({ window: "today", date, allowDemoFallback: false })') &&
    liveService.includes("const validGamePks = new Set(schedule.games.map((game) => game.gamePk));") &&
    liveService.includes("const slate = rawSlate.filter((start) => validGamePks.has(start.gamePk));") &&
    liveService.includes("filterLiveBoardSchedule(rawSchedule, date)") &&
    liveService.includes('const regularGames = schedule.games.filter((game) => game.gameType === "R");') &&
    liveService.includes("gameDateInBoardTimeZone(game.gameDate) === boardDate") &&
    liveService.includes("guardLiveRowsForBoardDate(buildRows(new Map()), date)") &&
    liveService.includes("droppedPks=[${dropped.map((row) => row.gamePk).join(\",\")}]") &&
    liveService.includes("[live-board] drop ptDateMatch gamePk=${row.gamePk} pitcher=${row.pitcherName} gameDate="),
  "live board service must derive rows only from same-date regular-season schedule games and keep a render-layer date guard with dropped row attribution",
);

assert(
  liveService.includes('console.info(`[live-board] boardDate=${date} tz=${LIVE_BOARD_TIME_ZONE}`);') &&
    liveService.includes("gameTypes=R&date=${date}&hydrate=probablePitcher%2Cteam") &&
    liveService.includes("[live-board] filter gameType=R kept=") &&
    liveService.includes("[live-board] filter ptDateMatch kept=") &&
    liveService.includes("[live-board] cache write date=${date} rows=${rows.length}") &&
    liveService.includes("[live-board] cache miss reason=dateMismatch cached=${board.date}") &&
    liveService.includes("[live-board] render mode=${mode} rows=${rows.length}") &&
    liveService.includes("[live-board] lookahead nextSlate=${nextSlate?.date ?? \"none\"} daysScanned="),
  "live board funnel log must cover board date, fetch, filters, cache write/miss, render mode, and lookahead",
);

assert(
  liveService.includes("const LIVE_LOOKAHEAD_DAYS = 10;") &&
    liveService.includes("getCachedLiveLookahead") &&
    liveService.includes("fetchMlbSchedule(nextDate, { fetchLive: true })") &&
    liveService.includes("filterLiveBoardSchedule(schedule, nextDate, { log: false })") &&
    liveService.includes("return { date: nextDate, firstPitchAt, topGame: watch?.games[0] ?? null, watch, daysScanned: offset };"),
  "empty-day lookahead must scan live regular-season schedules up to 10 days and cache by board date",
);

assert(
  liveService.includes("if (board.date !== date)") &&
    liveService.includes("return fallbackErrorBoard(date);") &&
    liveService.includes('mode: "error"') &&
    liveComponent.includes("Could not load today&apos;s slate. Retrying."),
  "stale cached live payloads must be rejected into the error state instead of rendering old rows",
);

assert(
  liveComponent.includes('data-live-board-mode="empty"') &&
    liveComponent.includes("data-live-empty-refresh-interval-ms={LIVE_EMPTY_REFRESH_INTERVAL_MS}") &&
    liveComponent.includes("<LiveEmptyState board={board} />") &&
    liveComponent.includes("NO GAMES TODAY") &&
    liveComponent.includes("League is on the All-Star break.") &&
    liveComponent.includes("No starts scheduled today.") &&
    liveComponent.includes("The season is over. See you in the spring.") &&
    liveComponent.includes("return `Next slate: ${label}`;") &&
    liveComponent.includes("window.setInterval(refresh, LIVE_EMPTY_REFRESH_INTERVAL_MS)") &&
    liveConfig.includes("export const LIVE_EMPTY_REFRESH_INTERVAL_MS = 30 * 60 * 1000;") &&
    liveComponent.includes('import { LIVE_EMPTY_REFRESH_INTERVAL_MS } from "@/lib/live-board-config";'),
  "live board empty mode must render requested copy, hide starter sections, and poll no more than once per 30 minutes",
);

assert(
  liveComponent.includes('board.mode === "empty"') &&
    liveComponent.includes("? [`${board.scheduledStarts} scheduled`]") &&
    !liveComponent.includes("No games today.") &&
    !liveService.includes("5:00 PM PT") &&
    !liveService.includes("5:00PM PT") &&
    !liveService.includes("17:00"),
  "empty mode must show 0 scheduled in the count row and slate mapping must not contain a default 5:00 PM PT first pitch",
);

console.log("live board slate scoping contract ok: zero-game days render empty and stale/demo slates are rejected");
