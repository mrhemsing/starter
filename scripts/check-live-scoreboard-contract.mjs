import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const [liveService, livePage, liveApi, liveComponent, mlbClient, types, startService, routes, siteNav, homeRanked, homeStatus] = await Promise.all([
  readFile("src/lib/data/live-scoreboard-service.ts", "utf8"),
  readFile("src/app/live/[date]/page.tsx", "utf8"),
  readFile("src/app/api/live/[date]/route.ts", "utf8"),
  readFile("src/components/live-scoreboard.tsx", "utf8"),
  readFile("src/lib/data/mlb-stats-client.ts", "utf8"),
  readFile("src/lib/types.ts", "utf8"),
  readFile("src/lib/data/start-service.ts", "utf8"),
  readFile("src/lib/routes.ts", "utf8"),
  readFile("src/components/site-nav.tsx", "utf8"),
  readFile("src/lib/data/home-ranked-service.ts", "utf8"),
  readFile("src/components/home-slate-status-line.tsx", "utf8"),
]);

assert(
  mlbClient.includes("export async function fetchMlbLivePitchingLines") &&
    mlbClient.includes("parseLivePitchingLines") &&
    types.includes('gameStatus: "live" | "final" | "warming" | "delay";'),
  "MLB client must expose starter live lines with live/final/warming/delay status",
);

assert(
  startService.includes("export function scoreCompletedLine(line: StartLine, context?: StartContext)") &&
    liveService.includes('import { getDailySlate, getHomeSlateDate, scoreCompletedLine } from "@/lib/data/start-service";') &&
    liveService.includes('import { getTonightMustWatch } from "@/lib/data/tonight-service";') &&
    liveService.includes("const projectedGsPlus = projectionsByStart.get(lineKey(start.gamePk, start.pitcher.mlbId)) ?? null;") &&
    liveService.includes("const hasRealLine = Boolean(liveLine && status !== \"warming\" && hasNonEmptyLine(line));") &&
    liveService.includes("const gsPlus = hasRealLine ? scoreCompletedLine(line, start.context) : null;") &&
    liveService.includes("function hasNonEmptyLine(line: StartLine)") &&
    !liveService.includes("start.expectedGameScorePlus ?? start.gameScorePlus"),
  "live scoreboard must keep Upcoming projected GS+ as context before a real live line and never compute scores from empty lines",
);

assert(
  liveService.includes("fetchMlbLivePitchingLines") &&
    liveService.includes("LIVE_SCOREBOARD_REVALIDATE_SECONDS = 30") &&
    liveService.includes('["live-scoreboard", "v6"]') &&
    liveService.includes('if (game && normalizeScheduleStatus(game) === "ppd") return [];') &&
    liveService.includes('const status = !liveLine && rawStatus === "live" ? "warming" : rawStatus;') &&
    liveService.includes("const projectionsByStart = getUpcomingProjectionMap(upcoming);") &&
    liveService.includes("starter.projection?.projectedGsPlus ?? null") &&
    liveService.includes('scoreLabel: "PROJ" | "PROV" | "FINAL";') &&
    liveService.includes('const scoreLabel = !hasRealLine ? "PROJ" : status === "final" ? "FINAL" : "PROV";') &&
    liveService.includes('provisional: scoreLabel === "PROV",') &&
    liveService.includes("const inningLabel = hasRealLine && !liveLine?.starterIsOut ? liveLine?.inningLabel ?? null : null;") &&
    liveService.includes("inningLabel,") &&
    !liveService.includes("inningLabel: liveLine?.inningLabel ?? null") &&
    liveService.includes("const scoredRows = rows.filter(isScoredRow);") &&
    liveService.includes("const leaderRows = scoredRows.filter(isLiveLeaderEligibleRow);") &&
    liveService.includes("function isScoredRow(row: LiveScoreboardRow)") &&
    liveService.includes("const LIVE_LEADER_MIN_INNINGS = 3;") &&
    liveService.includes("function isLiveLeaderEligibleRow(row: LiveScoreboardRow)") &&
    liveService.includes("inningsFromIP(row.line.inningsPitched) >= LIVE_LEADER_MIN_INNINGS") &&
    liveService.includes("if (aScored && !bScored) return -1;") &&
    liveService.includes("return new Date(a.firstPitch).getTime() - new Date(b.firstPitch).getTime();") &&
    liveService.includes("hasActiveStarts: liveStarts > 0 || delayStarts > 0") &&
    liveService.includes("rows.sort(compareLiveRows)") &&
    liveService.includes("leader: leaderRows[0] ?? null"),
  "live scoreboard service must poll/cached live gamefeeds, source pregame projections from Upcoming, hide inning/outs once a starter is out, keep warming out of scored sorting, and expose only 3.0+ IP live leaders",
);

assert(
  livePage.includes('active="live"') &&
    livePage.includes('className="min-h-screen overflow-x-hidden bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8"') &&
    livePage.includes('className="mx-auto flex max-w-7xl flex-col gap-8"') &&
    !livePage.includes("max-w-7xl flex-col gap-8 px-4 py-6") &&
    livePage.includes('const boardTitle = board.hasActiveStarts ? "Live GS+ Scoreboard" : "Daily GS+ Scoreboard";') &&
    livePage.includes("Pre-game shows projected GS+. Once a starter throws, the number goes live and provisional. Final lines settle when he exits.") &&
    livePage.includes("<LiveScoreboard initialBoard={board} />") &&
    liveApi.includes("getLiveScoreboard({ date })") &&
    liveApi.includes("export const revalidate = 30;"),
  "/live/[date] route and API must render the cached live board at the shared site width",
);

assert(
  liveComponent.includes("window.setInterval(refresh, 30 * 1000)") &&
    liveComponent.includes('className="ranked-live-dot h-2 w-2 rounded-full bg-[#FF5A1F]"') &&
    liveComponent.includes('import { Headshot } from "@/components/headshot";') &&
    liveComponent.includes('grid-cols-[42px_35px_minmax(0,1fr)_auto]') &&
    liveComponent.includes("<Headshot playerId={row.pitcherMlbId}") &&
    liveComponent.includes("band={headshotBand}") &&
    liveComponent.includes("sampleSufficient={liveOrFinalScore}") &&
    liveComponent.includes("function scoreBand") &&
    liveComponent.includes("function formatScore") &&
    liveComponent.includes('const scoredRows = board.rows.filter(isScoredRow);') &&
    liveComponent.includes('const warmingRows = board.rows.filter((row) => !isScoredRow(row));') &&
    liveComponent.includes('title="In progress"') &&
    liveComponent.includes('title="Warming up"') &&
    liveComponent.includes("function scoreboardSummaryLabel") &&
    liveComponent.includes('{board.finalStarts} final · {board.warmingStarts} warming · {board.totalStarts} starters') &&
    liveComponent.includes("{liveOrFinalScore ? formatLine(row) : projectionLabel(row)}") &&
    liveComponent.includes("formatFirstPitch(row.firstPitch)") &&
    liveComponent.includes("function formatFirstPitch") &&
    liveComponent.includes("First pitch") &&
    liveComponent.includes("{row.scoreLabel}") &&
    liveComponent.includes('{row.qualityLabel ?') &&
    liveComponent.includes('row.provisional ? " · Prov." : ""') &&
    liveComponent.includes("function InningLabel") &&
    liveComponent.includes("<InningLabel label={row.inningLabel} />") &&
    liveComponent.includes("/^(top|bottom)\\b/i.test(label)") &&
    liveComponent.includes('className="block text-zinc-600 sm:inline"') &&
    liveComponent.includes("function MobileStackedPitcherName") &&
    liveComponent.includes('<MobileStackedPitcherName name={row.pitcherName} />') &&
    liveComponent.includes("pitcher-name mt-1 block break-words font-serif text-2xl font-bold leading-tight") &&
    liveComponent.includes('className="block sm:inline"') &&
    !liveComponent.includes('className="mt-1 block truncate font-serif text-2xl font-bold text-zinc-50'),
  "live scoreboard component must refresh while active, show starter headshots, and mark provisional quality bands",
);

assert(
  routes.includes("export function liveDateHref(date: string)") &&
    siteNav.includes('type NavKey = "home" | "starts" | "heat" | "live" | "upcoming" | "watchlist";') &&
    siteNav.includes('const hasActiveLiveStarts = slateProgress.state === "starts-in-progress" && slateProgress.liveGames > 0;') &&
    siteNav.includes("const liveItem = hasActiveLiveStarts ?") &&
    siteNav.includes("href: liveDateHref(today)") &&
    siteNav.includes("<LiveNavLabel />") &&
    siteNav.includes('className="h-1.5 w-1.5 rounded-full bg-[#FF5A1F]"') &&
    !siteNav.includes('className="ranked-live-dot h-2 w-2 rounded-full bg-[#FF5A1F]"'),
  "primary nav must add a conditional static LIVE wayfinding dot only while games are live",
);

assert(
  homeRanked.includes("getLiveScoreboard({ date: today })") &&
    homeRanked.includes("resolveLiveLeaderStart(liveBoard, todaySlateStarts)") &&
    homeRanked.includes("href: liveDateHref(today),") &&
    homeStatus.includes("liveDateHref(slateState.date)"),
  "homepage hero and status line must become live-board entry points during active starts",
);

console.log("live scoreboard contract ok: provisional board, hero, nav, and status hooks are isolated from ranked starts");
