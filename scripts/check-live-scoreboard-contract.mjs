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
    liveService.includes("scoreCompletedLine(line, start.context)"),
  "live scoreboard must reuse the existing GS+ function without feeding provisional scores into ranked starts",
);

assert(
  liveService.includes("fetchMlbLivePitchingLines") &&
    liveService.includes("LIVE_SCOREBOARD_REVALIDATE_SECONDS = 30") &&
    liveService.includes('const status = !liveLine && rawStatus === "live" ? "warming" : rawStatus;') &&
    liveService.includes('const gsPlus = liveLine && status !== "warming" ? scoreCompletedLine(line, start.context) : null;') &&
    liveService.includes("hasActiveStarts: liveStarts > 0 || delayStarts > 0") &&
    liveService.includes("rows.sort(compareLiveRows)") &&
    liveService.includes("leader: scoredRows[0] ?? null"),
  "live scoreboard service must poll/cached live gamefeeds, sort scored rows by GS+, and expose a live leader",
);

assert(
  livePage.includes('active="live"') &&
    livePage.includes("<LiveScoreboard initialBoard={board} />") &&
    liveApi.includes("getLiveScoreboard({ date })") &&
    liveApi.includes("export const revalidate = 30;"),
  "/live/[date] route and API must render and serve the cached live board",
);

assert(
  liveComponent.includes("window.setInterval(refresh, 30 * 1000)") &&
    liveComponent.includes('className="ranked-live-dot h-2 w-2 rounded-full bg-[#FF5A1F]"') &&
    liveComponent.includes('{row.qualityLabel ?') &&
    liveComponent.includes('row.provisional ? " · Prov." : ""'),
  "live scoreboard component must refresh while active and mark provisional quality bands",
);

assert(
  routes.includes("export function liveDateHref(date: string)") &&
    siteNav.includes('type NavKey = "home" | "starts" | "heat" | "live" | "upcoming" | "watchlist";') &&
    siteNav.includes("slateProgress.liveGames > 0") &&
    siteNav.includes("href: liveDateHref(today)") &&
    siteNav.includes("<LiveNavLabel />"),
  "primary nav must add a conditional LIVE pill only while games are live",
);

assert(
  homeRanked.includes("getLiveScoreboard({ date: today })") &&
    homeRanked.includes("resolveLiveLeaderStart(liveBoard, todaySlateStarts)") &&
    homeRanked.includes("href: liveDateHref(today),") &&
    homeStatus.includes("liveDateHref(slateState.date)"),
  "homepage hero and status line must become live-board entry points during active starts",
);

console.log("live scoreboard contract ok: provisional board, hero, nav, and status hooks are isolated from ranked starts");
