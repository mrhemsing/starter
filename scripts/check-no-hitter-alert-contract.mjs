import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [
  packageJson,
  service,
  warmJob,
  liveScoreboard,
  homeProvider,
  homePage,
  siteHeader,
  alertBars,
  watchlistService,
  mlbClient,
  types,
] = await Promise.all([
  readFile("package.json", "utf8"),
  readFile("src/lib/data/no-hitter-alert-service.ts", "utf8"),
  readFile("src/lib/data/warm-live-starts-job.ts", "utf8"),
  readFile("src/lib/data/live-scoreboard-service.ts", "utf8"),
  readFile("src/components/home-live-board-provider.tsx", "utf8"),
  readFile("src/app/page.tsx", "utf8"),
  readFile("src/components/site-header.tsx", "utf8"),
  readFile("src/components/no-hitter-alert-bars.tsx", "utf8"),
  readFile("src/lib/data/watchlist-service.ts", "utf8"),
  readFile("src/lib/data/mlb-stats-client.ts", "utf8"),
  readFile("src/lib/types.ts", "utf8"),
]);

assert(
  packageJson.includes('"check:no-hitter-alert": "node scripts/check-no-hitter-alert-contract.mjs"'),
  "package scripts must expose the no-hitter alert contract",
);

assert(
  service.includes('status: NoHitterBidStatus;') &&
    service.includes('"active" | "broken" | "removed" | "completed"') &&
    service.includes('kind: NoHitterBidKind;') &&
    service.includes('"no-hitter" | "perfect-game"') &&
    service.includes('row.line.hits === 0 && outsRecorded >= 18') &&
    service.includes('row.line.hits > 0') &&
    service.includes('row.starterIsOut && !row.gameFinal') &&
    service.includes('row.gameFinal && outsRecorded >= 27') &&
    service.includes('row.line.walks === 0 && (row.line.hitBatters ?? 0) === 0 && (row.line.reachedOnError ?? 0) === 0') &&
    service.includes('NO_HITTER_ACTIVE_TTL_MS = 2 * 60 * 60 * 1000') &&
    service.includes('NO_HITTER_END_STATE_TTL_MS = 30 * 60 * 1000') &&
    service.includes('endOfSiteDay') &&
    service.includes('sameBidState') &&
    service.includes('sameActiveSnapshot') &&
    service.includes('if (previous.status === status) return previous;') &&
    service.includes('noHitterBidId(row)') &&
    service.includes('readNoHitterBidAlerts') &&
    service.includes('updateNoHitterBidStateFromLiveBoard') &&
    service.includes('readWatchlistNoHitterWireEvents'),
  "no-hitter bid service must detect starting-pitcher no-hit/perfect bids at 18 outs, handle broken/removed/completed states, and keep TTL/dedupe in runtime state",
);

assert(
  warmJob.includes('updateNoHitterBidStateFromLiveBoard(date, liveBoard.rows, startedAt)') &&
    warmJob.includes('warm-live-starts revalidated no-hitter alert surfaces') &&
    warmJob.includes('options.revalidateTag?.(LIVE_CACHE_TAG, "max")') &&
    warmJob.includes('options.revalidatePath?.("/")') &&
    warmJob.includes('options.revalidatePath?.(`/live/${date}`)') &&
    warmJob.includes('warmLiveStartsLockKey(date)') &&
    warmJob.includes('acquireWarmLiveStartsLock(lockKey)') &&
    !homePage.includes('updateNoHitterBidStateFromLiveBoard') &&
    !liveScoreboard.includes('updateNoHitterBidStateFromLiveBoard'),
  "bid state writes must originate from the guarded warm-live-starts path, never from page or API render reads",
);

assert(
  liveScoreboard.includes('noHitterAlerts: NoHitterBidAlert[];') &&
    liveScoreboard.includes('const noHitterAlerts = await readNoHitterBidAlerts(date, generatedAt);') &&
    liveScoreboard.includes('starterIsOut: boolean;') &&
    liveScoreboard.includes('gameFinal: boolean;') &&
    liveScoreboard.includes('starterIsOut,') &&
    liveScoreboard.includes('gameFinal,') &&
    homeProvider.includes('fetchJson<LiveScoreboard>(`/api/live/${today}`)') &&
    homeProvider.includes('HOME_LIVE_BOARD_POLL_MS = 30 * 1000'),
  "shared live scoreboard must carry no-hitter alerts and starter/game-final state through the existing 30s live board poll",
);

assert(
  siteHeader.includes('import { NoHitterAlertBars } from "@/components/no-hitter-alert-bars";') &&
    !siteHeader.includes('readNoHitterBidAlerts') &&
    siteHeader.includes('<NoHitterAlertBars today={today} />') &&
    !homePage.includes('import { NoHitterAlertBars } from "@/components/no-hitter-alert-bars";') &&
    homePage.indexOf("<SiteHeader active=\"home\"") < homePage.indexOf("<HomeLiveTicker />") &&
    alertBars.includes('useHomeLiveBoard') &&
    alertBars.includes('fetchJson<LiveScoreboard>(`/api/live/${effectiveToday}`)') &&
    alertBars.includes('HOME_LIVE_BOARD_POLL_MS') &&
    alertBars.includes('(contextBoard ?? fallbackBoard)?.noHitterAlerts ?? []') &&
    alertBars.includes('Date.parse(alert.expiresAt) > now') &&
    alertBars.includes('localStorage.setItem(`${NO_HITTER_DISMISS_PREFIX}:${id}`') &&
    alertBars.includes('data-no-hitter-alert-count={alerts.length}') &&
    alertBars.includes('data-no-hitter-alert-elevated={elevated ? "true" : "false"}') &&
    alertBars.includes('alert.outsRecorded >= 24') &&
    alertBars.includes('aria-label={`Dismiss ${label} alert for ${alert.pitcherName}`}'),
  "site header must render dismissible no-hitter alert bars site-wide through the shared live-board route, while homepage reuses its live board context with elevated ninth-inning treatment",
);

assert(
  watchlistService.includes('"no-hitter-bid"') &&
    watchlistService.includes('readWatchlistNoHitterWireEvents(pitcherIds, today)') &&
    watchlistService.includes('...(noHitterEventsByPitcher.get(pitcher.pitcherId) ?? [])'),
  "Watchlist Wire must include no-hitter bid transition events for followed pitchers",
);

assert(
  types.includes('hitBatters?: number;') &&
    types.includes('reachedOnError?: number;') &&
    types.includes('gameFinal: boolean;') &&
    mlbClient.includes('hitBatsmen?: number;') &&
    mlbClient.includes('result?: {') &&
    mlbClient.includes('eventType?: string;') &&
    mlbClient.includes('countReachedOnErrorForPitcher') &&
    mlbClient.includes('play.result?.eventType === "field_error"') &&
    mlbClient.includes('gameFinal: isFinalGameFeedState(payload)'),
  "MLB live adapter must expose HBP/error baserunner and game-final fields so perfect-game and removal states are distinguishable",
);

console.log("no-hitter alert contract ok: guarded live-state writes, shared live-board alert bars, and Watchlist Wire events are pinned");
