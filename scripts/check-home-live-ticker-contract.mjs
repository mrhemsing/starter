import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const [packageJson, homePage, ticker, provider, deferredSections, globals, methodology, rankedStartsRevalidation, warmLiveStartsJob] = await Promise.all([
  readFile("package.json", "utf8"),
  readFile("src/app/page.tsx", "utf8"),
  readFile("src/components/home-live-ticker.tsx", "utf8"),
  readFile("src/components/home-live-board-provider.tsx", "utf8"),
  readFile("src/components/home-deferred-sections.tsx", "utf8"),
  readFile("src/app/globals.css", "utf8"),
  readFile("src/app/methodology/page.tsx", "utf8"),
  readFile("src/lib/data/ranked-starts-revalidation.ts", "utf8"),
  readFile("src/lib/data/warm-live-starts-job.ts", "utf8"),
]);

assert(
  packageJson.includes('"check:home-live-ticker": "node scripts/check-home-live-ticker-contract.mjs"'),
  "package scripts must expose the home live ticker contract",
);

assert(
  homePage.includes('import { HomeLiveBoardProvider } from "@/components/home-live-board-provider";') &&
    homePage.includes('import { HomeLiveTicker } from "@/components/home-live-ticker";') &&
    homePage.includes('import { getLiveScoreboard } from "@/lib/data/live-scoreboard-service";') &&
    homePage.includes("const homeTickerBoardPromise = getLiveScoreboard({ date: today }).catch(() => null);") &&
    homePage.includes("<HomeLiveBoardProvider initialBoard={homeTickerBoard} today={today}>") &&
    homePage.includes("<HomeLiveTicker />") &&
    homePage.indexOf("<SiteHeader active=\"home\"") < homePage.indexOf("<HomeLiveTicker />") &&
    homePage.indexOf("<HomeLiveTicker />") < homePage.indexOf('data-responsive-check="home-masthead"') &&
    homePage.indexOf("<HomeLiveBoardProvider initialBoard={homeTickerBoard} today={today}>") < homePage.indexOf("<HomeDeferredSections"),
  "home page must render the ticker directly below nav and above the hero masthead from the shared live scoreboard payload",
);

assert(
    provider.includes('"use client";') &&
    provider.includes('import { LIVE_NAV_STATE_EVENT } from "@/components/live-nav-label";') &&
    provider.includes("export const HOME_LIVE_BOARD_POLL_MS = 30 * 1000") &&
    provider.includes("export const HOME_LIVE_BOARD_STALE_INITIAL_MS = 90 * 1000;") &&
    provider.includes("Prevent stale ISR HTML from briefly showing a LIVE slate before the first no-store sync corrects it.") &&
    provider.includes("HOME_LIVE_BOARD_FIRST_PITCH_GRACE_MS = 15 * 1000") &&
    provider.includes("const [boardUnverified, setBoardUnverified] = useState(() => shouldVerifyStaleInitialBoard(initialBoard));") &&
    provider.includes("const shouldPoll = Boolean(board?.hasGames && (board.liveStarts > 0 || boardUnverified) && board.slateProgress.state !== \"all-starts-complete\");") &&
    provider.includes("fetchJson<LiveScoreboard>(`/api/live/${today}`)") &&
    provider.includes("setBoardUnverified(false);") &&
    provider.includes("syncLiveBoard().catch(() => undefined);") &&
    provider.includes("}, HOME_LIVE_BOARD_POLL_MS);") &&
    provider.includes("function shouldVerifyStaleInitialBoard(board: LiveScoreboard | null)") &&
    provider.includes("if (!board || board.liveStarts + board.warmingStarts === 0) return false;") &&
    provider.includes("Date.now() - generatedAtMs > HOME_LIVE_BOARD_STALE_INITIAL_MS") &&
    provider.includes("window.setTimeout(() =>") &&
    provider.includes('row.status === "scheduled" || row.status === "warming"') &&
    provider.includes("window.dispatchEvent(new CustomEvent(LIVE_NAV_STATE_EVENT, {") &&
    provider.includes("liveStarts: boardUnverified ? 0 : board.liveStarts") &&
    provider.includes("warmingStarts: boardUnverified ? 0 : board.warmingStarts") &&
    ticker.includes('"use client";') &&
    ticker.includes('import { useHomeLiveBoard } from "@/components/home-live-board-provider";') &&
    !ticker.includes("fetchJson<LiveScoreboard>") &&
    !ticker.includes("setInterval") &&
    ticker.includes("HOME_LIVE_TICKER_AUTO_RESUME_MS = 4 * 1000") &&
    ticker.includes("data-responsive-check=\"home-live-gs-ticker\"") &&
    ticker.includes('data-home-live-ticker-phase={phase}') &&
    ticker.includes('data-home-live-ticker-polling={shouldPoll ? "true" : "false"}') &&
    ticker.includes('data-home-live-ticker-unverified={boardUnverified ? "true" : "false"}') &&
    ticker.includes('phase === "live" ? "LIVE" : "TODAY"') &&
    ticker.includes('const phase = board && board.liveStarts > 0 && !boardUnverified ? "live" : "today";') &&
    !ticker.includes("board.liveStarts > 0 || board.finalStarts > 0 || board.delayStarts > 0") &&
    !ticker.includes("shouldVerifyStaleSlate") &&
    !ticker.includes("scheduleFirstPitchSync") &&
    ticker.includes('const liveRows = boardUnverified ? [] : board.rows') &&
    ticker.includes('const upcomingRows = boardUnverified ? [] : board.rows') &&
    ticker.includes('entry.state === "live" ? <span className="text-zinc-500">--</span> : null') &&
    ticker.includes("row.scoreLabel === \"FINAL\"") &&
    ticker.includes('state: "final" as const') &&
    ticker.includes("row.scoreLabel === \"PROJ\"") &&
    ticker.includes("row.status === \"scheduled\" || row.status === \"warming\"") &&
    ticker.includes("board.finalStarts < board.totalStarts") &&
    ticker.includes('key: "checking-live-board"') &&
    ticker.includes('label: "CHECKING"') &&
    ticker.includes('time: "SYNCING"') &&
    ticker.includes("liveDateHref(board.date)") &&
    ticker.includes("return [") &&
    ticker.includes("const showNextDivider = entry.state === \"upcoming\" && previous?.state !== \"upcoming\";") &&
    ticker.includes("showNextDivider={showNextDivider}") &&
    ticker.includes('glyph: row.gsPlus === null ? undefined : (row.gsPlus ?? 0) >= (row.projectedGsPlus ?? 50) ? "up" as const : "down" as const') &&
    ticker.includes("text-[#FF9A62]") &&
    ticker.includes("text-[#7EC8FF]") &&
    ticker.includes("upcomingDateHref(board.date)") &&
    ticker.includes("function disambiguatedNames") &&
    ticker.includes('aria-label="Live GS+ ticker"') &&
    ticker.includes("aria-hidden={duplicate ? \"true\" : undefined}") &&
    deferredSections.includes('import { useHomeLiveBoard } from "@/components/home-live-board-provider";') &&
    deferredSections.includes("const { board, shouldPoll } = useHomeLiveBoard();") &&
    !deferredSections.includes("fetchJson<LiveScoreboard>(`/api/live/${today}`)") &&
    !ticker.includes("text-green") &&
    !ticker.includes("text-red"),
  "ticker must render all slate day, poll only through the shared live endpoint when active, include live scoreless arms, carry finals, use projection glyphs, site colors, collision initials, and accessible duplicate handling",
);

assert(
  warmLiveStartsJob.includes("const openingRevalidated = await revalidateSlateLifecycleTransition({") &&
    warmLiveStartsJob.includes("reason: slateLifecycleRevalidationReason({") &&
    warmLiveStartsJob.includes('if (totalStarts > 0 && completedStarts >= totalStarts) return "slate-complete";') &&
    warmLiveStartsJob.includes('if (liveStarts > 0) return "first-pitch";') &&
    warmLiveStartsJob.includes("revalidateRankedStartsDate(date, options, reason);") &&
    rankedStartsRevalidation.includes('const paths = ["/", rankedStartsPath(date)];') &&
    rankedStartsRevalidation.includes('revalidators.revalidatePath?.(path);'),
  "home page must be revalidated from the warm-live slate lifecycle path on first pitch and slate complete, never from request-time rendering",
);

assert(
  globals.includes(".home-live-ticker-track") &&
    globals.includes("animation: home-live-ticker-scroll 42s linear infinite;") &&
    globals.includes(".home-live-ticker-track:hover") &&
    globals.includes(".home-live-ticker-track:active") &&
    globals.includes('.home-live-ticker-track[data-touch-paused="true"]') &&
    globals.includes(".home-live-ticker-scrollbarless") &&
    globals.includes("scrollbar-width: none;") &&
    globals.includes(".home-live-ticker-scrollbarless::-webkit-scrollbar") &&
    globals.indexOf(".home-live-ticker-scrollbarless") < globals.indexOf("@media (prefers-reduced-motion: no-preference)") &&
    globals.includes('.home-live-ticker-track [data-ticker-duplicate="true"]') &&
    ticker.includes("onPointerDown={pauseForTouch}") &&
    ticker.includes("onPointerUp={scheduleTouchResume}") &&
    globals.includes("@keyframes home-live-ticker-scroll") &&
    ticker.includes("motion-reduce:animate-none"),
  "ticker motion must be CSS-only, pause on hover/touch, auto-resume touch pauses, hide scrollbars, and honor reduced motion",
);

assert(
  methodology.includes("On the homepage ticker, ▲ means a live provisional GS+ is at or above that starter&apos;s pregame projected GS+.") &&
    methodology.includes("If no projection is available, the comparison falls back to league-average 50."),
  "methodology must explain ticker delta glyphs",
);

console.log("home live ticker contract ok: slate-day render, live-only polling, and projection glyphs are pinned");
