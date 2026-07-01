import { readFile, stat } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const [liveService, livePage, liveApi, liveComponent, mlbClient, types, startService, routes, siteNav, homeRanked, homeStatus, globals, slabImage] = await Promise.all([
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
  readFile("src/app/globals.css", "utf8"),
  stat("public/images/slab-2.png"),
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
    liveService.includes('["live-scoreboard", "v7"]') &&
    liveService.includes('if (game && normalizeScheduleStatus(game) === "ppd") return [];') &&
    liveService.includes('const status = !liveLine && rawStatus === "live" ? "warming" : rawStatus;') &&
    liveService.includes("const projectionsByStart = getUpcomingProjectionMap(upcoming);") &&
    liveService.includes("starter.projection?.projectedGsPlus ?? null") &&
    liveService.includes('scoreLabel: "PROJ" | "PROV" | "FINAL";') &&
    liveService.includes('const scoreLabel = !hasRealLine ? "PROJ" : status === "final" ? "FINAL" : "PROV";') &&
    liveService.includes('provisional: scoreLabel === "PROV",') &&
    liveService.includes("const inningLabel = hasRealLine && !liveLine?.starterIsOut ? liveLine?.inningLabel ?? null : null;") &&
    liveService.includes("inningLabel,") &&
    liveService.includes("pitcherHref: string;") &&
    liveService.includes('import { liveDateHref, pitcherHref, sourceParams, startHref } from "@/lib/routes";') &&
    liveService.includes('pitcherHref: pitcherHref({ id: start.pitcher.id, name: start.pitcher.name }, sourceParams("live"))') &&
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
    livePage.includes('<main className="min-h-screen overflow-x-hidden bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8">') &&
    !livePage.includes("live-non-live-page") &&
    livePage.includes('className="mx-auto flex max-w-7xl flex-col gap-8"') &&
    !livePage.includes("max-w-7xl flex-col gap-8 px-4 py-6") &&
    livePage.includes('import { getHomeSlateDate, getSlateStartProgress } from "@/lib/data/start-service";') &&
    livePage.includes('getSlateStartProgress({ window: "today", date })') &&
    livePage.includes('const boardTitle = board.hasActiveStarts ? "Live GS+ Scoreboard" : "Daily GS+ Scoreboard";') &&
    livePage.includes("const slateComplete = board.hasGames && board.totalStarts > 0 && board.finalStarts === board.totalStarts;") &&
    livePage.includes("const pregame = board.hasGames && board.finalStarts === 0 && board.liveStarts === 0 && board.delayStarts === 0;") &&
    livePage.includes("The scoreboard wakes up at first pitch. Preview tonight's matchups on Upcoming.") &&
    livePage.includes("This slate is final. Full tiers, filters, and breakdowns live on Ranked Starts.") &&
    livePage.includes('<LiveScoreboard initialBoard={board} initialSlateProgress={slateProgress} />') &&
    liveApi.includes("getLiveScoreboard({ date })") &&
    liveApi.includes("export const revalidate = 30;"),
  "/live/[date] route and API must render the cached live board at the shared site width",
);

assert(
  slabImage.size > 0 &&
    !globals.includes(".live-non-live-page") &&
    !globals.includes('url("/images/slab-2.png")') &&
    liveComponent.includes('import Image from "next/image";') &&
    liveComponent.includes("function SlabImage()") &&
    liveComponent.includes('className="mt-8 max-w-[900px] overflow-hidden rounded border border-white/10 bg-black/30"') &&
    !liveComponent.includes('className="mt-6 overflow-hidden rounded border border-white/10 bg-black/30"') &&
    liveComponent.includes('src="/images/slab-2.png"') &&
    liveComponent.includes('alt=""') &&
    liveComponent.includes('width={1280}') &&
    liveComponent.includes('height={853}') &&
    liveComponent.includes('fill') &&
    liveComponent.includes('sizes="(min-width: 1024px) 1120px, 100vw"') &&
    countOccurrences(liveComponent, "<SlabImage />") === 1,
  "non-live Live page phases must render slab-2 inline and fuse the pregame countdown into the mound hero",
);

assert(
    liveComponent.includes("window.setInterval(refresh, 30 * 1000)") &&
    liveComponent.includes("if (!board.hasActiveStarts && !pregame) return;") &&
    liveComponent.includes('className="ranked-live-dot h-2 w-2 rounded-full bg-[#FF5A1F]"') &&
    liveComponent.includes('import { Headshot } from "@/components/headshot";') &&
    liveComponent.includes('import { rankedStartsPath, upcomingDateHref } from "@/lib/routes";') &&
    liveComponent.includes('import { formatFirstPitchCountdown, type SlateProgressState } from "@/lib/slate-state";') &&
    liveComponent.includes('grid-cols-[35px_minmax(0,1fr)_auto]') &&
    liveComponent.includes("<Headshot playerId={row.pitcherMlbId}") &&
    !liveComponent.includes("band={headshotBand}") &&
    !liveComponent.includes("sampleSufficient={liveOrFinalScore}") &&
    !liveComponent.includes("function scoreBand") &&
    liveComponent.includes("function formatScore") &&
    liveComponent.includes('const scoredRows = board.rows.filter(isScoredRow);') &&
    liveComponent.includes('const warmingRows = board.rows.filter((row) => !isScoredRow(row));') &&
    liveComponent.includes("const slateComplete = isSlateComplete(board);") &&
    liveComponent.includes("const pregame = isPregame(board);") &&
    liveComponent.includes('data-live-board-pregame="true"') &&
    liveComponent.includes("<PregameHandoff board={board} slateProgress={slateProgress} nowMs={pregameNowMs} />") &&
    liveComponent.includes("function PregameHandoff") &&
    liveComponent.includes("Scoreboard opens at first pitch") &&
    liveComponent.includes("const PREGAME_CLOCK_THRESHOLD_MS = 6 * 60 * 60 * 1000;") &&
    liveComponent.includes("const PREGAME_STARTING_SOON_MS = 60 * 1000;") &&
    liveComponent.includes("const [pregameNowMs, setPregameNowMs] = useState<number | null>(null);") &&
    liveComponent.includes("setPregameNowMs(nowMs);") &&
    liveComponent.includes("const clockMode = remainingMs > PREGAME_STARTING_SOON_MS && remainingMs <= PREGAME_CLOCK_THRESHOLD_MS;") &&
    liveComponent.includes("interval = window.setInterval(updateCountdown, clockMode ? 1000 : 60 * 1000);") &&
    liveComponent.includes('if (document.visibilityState === "hidden") return;') &&
    liveComponent.includes('document.addEventListener("visibilitychange", handleVisibilityChange);') &&
    liveComponent.includes('document.removeEventListener("visibilitychange", handleVisibilityChange);') &&
    liveComponent.includes("getPregameCountdownView(slateProgress.firstPitchAt, slateProgress.countdownLabel, nowMs)") &&
    liveComponent.includes('className="flex min-h-[470px] flex-col items-start justify-start px-4 py-5 sm:min-h-[540px] sm:px-6 sm:py-7 lg:min-h-[620px] lg:px-8"') &&
    liveComponent.includes('className="w-full max-w-4xl text-left"') &&
    !liveComponent.includes("flex-col justify-end px-4 py-5") &&
    liveComponent.includes('data-live-pregame-countdown-mode={countdown.mode}') &&
    liveComponent.includes('aria-label={countdown.ariaLabel}') &&
    liveComponent.includes('<ClockUnit value={countdown.hours} label="HRS" toneClass={countdown.toneClass} />') &&
    liveComponent.includes('<ClockUnit value={countdown.minutes} label="MIN" toneClass={countdown.toneClass} />') &&
    liveComponent.includes('<ClockUnit value={countdown.seconds} label="SEC" toneClass={countdown.toneClass} />') &&
    liveComponent.includes("function ClockUnit") &&
    liveComponent.includes('style={{ width: `${countdown.progressPct}%` }}') &&
    liveComponent.includes('motion-safe:animate-pulse') &&
    liveComponent.includes('motion-safe:transition-colors') &&
    liveComponent.includes("function getPregameCountdownView") &&
    liveComponent.includes('label: "STARTING SOON"') &&
    liveComponent.includes('label: "DELAYED"') &&
    liveComponent.includes('label: "TBD"') &&
    liveComponent.includes("function padClockUnit") &&
    liveComponent.includes("function clamp") &&
    liveComponent.includes("First pitch {slateProgress.firstPitchAt ? formatFirstPitch(slateProgress.firstPitchAt) : \"TBD\"} · {board.totalStarts} starters on the slate.") &&
    liveComponent.includes("upcomingDateHref(board.date)") &&
    liveComponent.includes("Preview tonight&apos;s matchups on Upcoming -&gt;") &&
    liveComponent.includes("formatFirstPitchCountdown(new Date(current.firstPitchAt).getTime() - nowMs)") &&
    liveComponent.includes("function formatPregameCountdown") &&
    liveComponent.includes("function isPregame(board: LiveScoreboardData)") &&
    liveComponent.includes("return board.hasGames && board.finalStarts === 0 && board.liveStarts === 0 && board.delayStarts === 0;") &&
    liveComponent.includes('<SlateCompleteHandoff board={board} rows={scoredRows.slice(0, 3)} />') &&
    liveComponent.includes('data-live-board-complete="true"') &&
    liveComponent.includes("function SlateCompleteHandoff") &&
    liveComponent.includes("This slate is final.") &&
    !liveComponent.includes("Today&apos;s slate is final.") &&
    liveComponent.includes("Live returns with the next slate.") &&
    liveComponent.includes("rankedStartsPath(board.date)") &&
    liveComponent.includes("View all ranked starts for {formatBoardDate(board.date)} -&gt;") &&
    liveComponent.includes('className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] lg:items-start"') &&
    !liveComponent.includes('className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] lg:items-start"') &&
    liveComponent.includes("Top final GS+") &&
    liveComponent.includes('grid-cols-[2ch_29px_minmax(0,1fr)_auto]') &&
    liveComponent.includes('md:grid-cols-[2ch_59px_minmax(0,1fr)_auto]') &&
    countOccurrences(liveComponent, "<Headshot playerId={row.pitcherMlbId}") === 2 &&
    countOccurrences(liveComponent, 'aria-label={`Open ${row.pitcherName} pitcher page`}') === 2 &&
    liveComponent.includes('size="sm" decorative className="ml-0 md:h-[88px] md:w-[59px]"') &&
    liveComponent.includes('className="block truncate font-serif text-xl font-bold leading-tight text-zinc-50 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"') &&
    liveComponent.includes("function isSlateComplete(board: LiveScoreboardData)") &&
    liveComponent.includes("return board.hasGames && board.totalStarts > 0 && board.finalStarts === board.totalStarts;") &&
    liveComponent.includes("function formatBoardDate(date: string)") &&
    liveComponent.includes('title="In progress"') &&
    liveComponent.includes('title="Warming up"') &&
    liveComponent.includes("function scoreboardSummaryLabel") &&
    liveComponent.includes('{board.finalStarts} final · {board.warmingStarts} warming · {board.totalStarts} starters') &&
    liveComponent.includes("{liveOrFinalScore ? formatLine(row) : projectionLabel(row)}") &&
    liveComponent.includes("formatFirstPitch(row.firstPitch)") &&
    liveComponent.includes("function formatFirstPitch") &&
    liveComponent.includes("First pitch") &&
    liveComponent.includes("{row.scoreLabel}") &&
    !liveComponent.includes('{row.qualityLabel ?') &&
    !liveComponent.includes("row.qualityLabel") &&
    liveComponent.includes('row.provisional ? <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">Prov.</p> : null') &&
    liveComponent.includes("function InningLabel") &&
    liveComponent.includes("<InningLabel label={row.inningLabel} />") &&
    liveComponent.includes("/^(top|bottom)\\b/i.test(label)") &&
    liveComponent.includes('className="block text-zinc-600 sm:inline"') &&
    liveComponent.includes("function MobileStackedPitcherName") &&
    liveComponent.includes('<MobileStackedPitcherName name={row.pitcherName} />') &&
    liveComponent.includes('href={row.pitcherHref}') &&
    liveComponent.includes('aria-label={`Open ${row.pitcherName} pitcher page`}') &&
    liveComponent.includes("pitcher-name mt-1 block break-words font-serif text-2xl font-bold leading-tight") &&
    liveComponent.includes('className="block sm:inline"') &&
    !liveComponent.includes("font-serif text-2xl font-bold text-zinc-500") &&
    !liveComponent.includes("#{rank}") &&
    !liveComponent.includes('className="mt-1 block truncate font-serif text-2xl font-bold text-zinc-50'),
  "live scoreboard component must refresh while active, hand off complete slates, and present rows as live status instead of ranked tiers",
);

assert(
  routes.includes("export function liveDateHref(date: string)") &&
    siteNav.includes('type NavKey = "home" | "starts" | "heat" | "live" | "upcoming" | "watchlist";') &&
    siteNav.includes('const liveItem = [{ key: "live" as const, label: <LiveNavLabel state={slateProgress.state} liveGames={slateProgress.liveGames} />, href: liveDateHref(today) }];') &&
    siteNav.includes("href: liveDateHref(today)") &&
    siteNav.includes('className="grid w-full grid-cols-3 gap-2 pb-4 pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 md:hidden"') &&
    siteNav.includes('className={`flex min-h-11 items-center justify-center rounded border px-2 py-2 text-center') &&
    !siteNav.includes("overflow-x-auto pb-4 pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 md:hidden") &&
    !siteNav.includes("shrink-0 items-center rounded border") &&
    siteNav.includes('function LiveNavLabel({ state, liveGames }: { state: SlateProgressState["state"]; liveGames: number })') &&
    siteNav.includes('const hasActiveLiveStarts = state === "starts-in-progress" && liveGames > 0;') &&
    siteNav.includes('state === "pre-first-pitch" ? "text-amber-300" : "text-zinc-400"') &&
    siteNav.includes('state === "pre-first-pitch" ? "bg-[#F6C445]/70" : "bg-zinc-500"') &&
    siteNav.includes("data-live-nav-state={state}") &&
    siteNav.includes('data-live-nav-active={hasActiveLiveStarts ? "true" : "false"}') &&
    !siteNav.includes('className="ranked-live-dot h-2 w-2 rounded-full bg-[#FF5A1F]"'),
  "primary nav must keep LIVE as a permanent scoreboard link with state-aware wayfinding and a two-row mobile grid",
);

assert(
  homeRanked.includes("getLiveScoreboard({ date: today })") &&
    homeRanked.includes("resolveLiveLeaderStart(liveBoard, todaySlateStarts)") &&
    homeRanked.includes("href: liveDateHref(today),") &&
    homeStatus.includes("shouldLinkLiveScoreboard(slateState)") &&
    homeStatus.includes('state.liveGames > 0 || state.state === "pre-first-pitch" || state.state === "all-starts-complete"') &&
    homeStatus.includes("liveDateHref(slateState.date)"),
  "homepage hero and status line must become live-board entry points during active starts and off-hours",
);

console.log("live scoreboard contract ok: provisional board, hero, permanent nav, and status hooks are isolated from ranked starts");

function countOccurrences(value, token) {
  return value.split(token).length - 1;
}
