import { readFile, stat } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const [liveService, livePage, liveApi, liveComponent, liveNavLabel, ctaArrow, mlbClient, types, startService, routes, siteNav, primaryNavLink, homeRanked, homeStatus, globals, slabImage] = await Promise.all([
  readFile("src/lib/data/live-scoreboard-service.ts", "utf8"),
  readFile("src/app/live/[date]/page.tsx", "utf8"),
  readFile("src/app/api/live/[date]/route.ts", "utf8"),
  readFile("src/components/live-scoreboard.tsx", "utf8"),
  readFile("src/components/live-nav-label.tsx", "utf8"),
  readFile("src/components/cta-arrow.tsx", "utf8"),
  readFile("src/lib/data/mlb-stats-client.ts", "utf8"),
  readFile("src/lib/types.ts", "utf8"),
  readFile("src/lib/data/start-service.ts", "utf8"),
  readFile("src/lib/routes.ts", "utf8"),
  readFile("src/components/site-nav.tsx", "utf8"),
  readFile("src/components/primary-nav-link.tsx", "utf8"),
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
    liveService.includes('import { addDays, getDailySlate, getHomeSlateDate, scoreCompletedLine } from "@/lib/data/start-service";') &&
    liveService.includes('import { getTonightMustWatch } from "@/lib/data/tonight-service";') &&
    liveService.includes("const projectedGsPlus = projectionsByStart.get(lineKey(start.gamePk, start.pitcher.mlbId)) ?? null;") &&
    liveService.includes("const hasRealLine = Boolean(liveLine && status !== \"warming\" && hasNonEmptyLine(line));") &&
    liveService.includes("const gsPlus = hasRealLine ? resolveLiveRowGsPlus(status, start, line) : null;") &&
    liveService.includes("return sameStartLine(start.line, line) ? start.gameScorePlus : scoreCompletedLine(line, start.context);") &&
    liveService.includes("function hasNonEmptyLine(line: StartLine)") &&
    !liveService.includes("start.expectedGameScorePlus ?? start.gameScorePlus"),
  "live scoreboard must keep Upcoming projected GS+ as context, use frozen final GS+ only when the final gamefeed line matches the slate snapshot, and never compute scores from empty lines",
);

assert(
  startService.includes("function shouldUseArchivedSlateForDate(date: string, activeSlateDate = getHomeSlateDate())") &&
    startService.includes("return date < activeSlateDate;") &&
    startService.includes("if (archivedStarts.length > 0 && shouldUseArchivedSlateForDate(params.date)) return archivedStarts;") &&
    startService.includes('console.warn("[start-service] ignoring archive rows for active slate date"'),
  "daily slate assembly must ignore archive shards for the active slate date so a partial today archive cannot hide live/upcoming starts",
);

assert(
  liveService.includes("fetchMlbLivePitchingLines") &&
    liveService.includes("LIVE_SCOREBOARD_REVALIDATE_SECONDS = 30") &&
    liveService.includes('["live-scoreboard", "v9"]') &&
    liveService.includes('if (game && normalizeScheduleStatus(game) === "ppd") return [];') &&
    liveService.includes("const status = refinePregameStatus(rawStatus, firstPitch, now, Boolean(liveLine));") &&
    liveService.includes("const buildRows = (projectionsByStart: Map<string, number | null>) => slate.flatMap((start) =>") &&
    liveService.includes("let rows = buildRows(new Map());") &&
    liveService.includes("startCounts.warmingStarts === 0") &&
    liveService.includes("const slateComplete = rows.length > 0 && startCounts.totalStarts > 0 && startCounts.finalStarts === startCounts.totalStarts;") &&
    liveService.includes('if (!pregame && !slateComplete && rows.some((row) => row.scoreLabel === "PROJ"))') &&
    liveService.includes("const upcoming = await getTonightMustWatch({ date, window: 5 });") &&
    liveService.includes("rows = buildRows(getUpcomingProjectionMap(upcoming));") &&
    liveService.includes("starter.projection?.projectedGsPlus ?? null") &&
    liveService.includes('scoreLabel: "PROJ" | "PROV" | "FINAL";') &&
    liveService.includes('const scoreLabel = !hasRealLine ? "PROJ" : status === "final" ? "FINAL" : "PROV";') &&
    liveService.includes("const gsPlus = hasRealLine ? resolveLiveRowGsPlus(status, start, line) : null;") &&
    liveService.includes("function resolveLiveRowGsPlus(status: LiveScoreboardStatus, start: StartSummary, line: StartLine)") &&
    liveService.includes('if (status !== "final") return scoreCompletedLine(line, start.context);') &&
    liveService.includes("return sameStartLine(start.line, line) ? start.gameScorePlus : scoreCompletedLine(line, start.context);") &&
    liveService.includes("function sameStartLine(a: StartLine, b: StartLine)") &&
    liveService.includes("&& a.earnedRuns === b.earnedRuns") &&
    liveService.includes('provisional: scoreLabel === "PROV",') &&
    liveService.includes('export type LiveScoreboardStatus = "live" | "final" | "warming" | "scheduled" | "delay";') &&
    liveService.includes("const LIVE_WARMING_LEAD_MS = 30 * 60 * 1000;") &&
    liveService.includes('import { formatFirstPitchCountdown, getSlateProgressState, normalizeScheduleStatus, summarizeSlateStartBuckets, type SlateProgressState, type SlateStartBucketCounts } from "@/lib/slate-state";') &&
    liveService.includes("export type LiveScoreboard = SlateStartBucketCounts & {") &&
    liveService.includes("let startCounts = summarizeSlateStartBuckets(rows);") &&
    liveService.includes("const slateProgress = getSlateProgressState(schedule, startCounts.finalStarts, generatedAt);") &&
    liveService.includes("const nextSlate = slateComplete ? await resolveNextSlateFirstPitch(date, generatedAt) : null;") &&
    liveService.includes("slateProgress: SlateProgressState;") &&
    liveService.includes("nextSlateDate: string | null;") &&
    liveService.includes("nextSlateFirstPitchAt: string | null;") &&
    liveService.includes("nextSlateDate: nextSlate?.date ?? null,") &&
    liveService.includes("nextSlateFirstPitchAt: nextSlate?.firstPitchAt ?? null,") &&
    liveService.includes("slateProgress,") &&
    liveService.includes("async function resolveNextSlateFirstPitch(date: string, after: Date)") &&
    liveService.includes("const afterMs = after.getTime();") &&
    liveService.includes("for (let offset = 1; offset <= 7; offset += 1)") &&
    liveService.includes("const nextDate = addDays(date, offset);") &&
    liveService.includes('fetchMlbSchedule(nextDate, { fetchLive: false })') &&
    liveService.includes('normalizeScheduleStatus(game) !== "ppd"') &&
    liveService.includes("Number.isFinite(game.ms) && game.ms > afterMs") &&
    liveService.includes("normalizeCachedLiveScoreboard(await getCachedLiveScoreboard(date), date)") &&
    liveService.includes("function fallbackSlateProgress") &&
    liveService.includes("nextSlateDate: cachedBoard.nextSlateDate ?? null") &&
    liveService.includes("nextSlateFirstPitchAt: cachedBoard.nextSlateFirstPitchAt ?? null") &&
    liveService.includes("formatFirstPitchCountdown(new Date(firstPitchAt).getTime() - Date.now())") &&
    liveService.includes("...startCounts,") &&
    liveService.includes("function refinePregameStatus") &&
    liveService.includes('if (liveStatus === "warming") return "warming";') &&
    liveService.includes('return "scheduled";') &&
    liveService.includes('if (status !== "scheduled" && status !== "warming") return !hasLiveLine && status === "live" ? "warming" : status;') &&
    liveService.includes('return remainingMs > 0 && remainingMs <= LIVE_WARMING_LEAD_MS ? "warming" : "scheduled";') &&
    liveService.includes("const inningLabel = hasRealLine && !liveLine?.starterIsOut ? liveLine?.inningLabel ?? null : null;") &&
    liveService.includes("inningLabel,") &&
    liveService.includes("pitcherHref: string;") &&
    liveService.includes('import { liveDateHref, pitcherHref, sourceParams, startHref } from "@/lib/routes";') &&
    liveService.includes('pitcherHref: pitcherHref({ id: start.pitcher.id, name: start.pitcher.name }, sourceParams("live"))') &&
    !liveService.includes("inningLabel: liveLine?.inningLabel ?? null") &&
    liveService.includes("let scoredRows = rows.filter(isScoredRow);") &&
    liveService.includes("function isScoredRow(row: LiveScoreboardRow)") &&
    liveService.includes("const LIVE_LEADER_MIN_INNINGS = 3;") &&
    liveService.includes("function isLiveLeaderEligibleRow(row: LiveScoreboardRow)") &&
    liveService.includes("inningsFromIP(row.line.inningsPitched) >= LIVE_LEADER_MIN_INNINGS") &&
    liveService.includes("if (aScored && !bScored) return -1;") &&
    liveService.includes("return new Date(a.firstPitch).getTime() - new Date(b.firstPitch).getTime();") &&
    liveService.includes("hasActiveStarts: startCounts.liveStarts > 0 || startCounts.warmingStarts > 0 || startCounts.delayStarts > 0") &&
    liveService.includes(".sort(compareLiveRows)") &&
    liveService.includes("leader: scoredRows.filter(isLiveLeaderEligibleRow)[0] ?? null"),
  "live scoreboard service must poll/cached live gamefeeds, source pregame projections from Upcoming, separate scheduled from warming, recompute final rows from the displayed gamefeed line when it differs from the slate snapshot, hide inning/outs once a starter is out, keep warming out of scored sorting, and expose only 3.0+ IP live leaders",
);

assert(
  livePage.includes('active="live"') &&
    livePage.includes('<main className="min-h-screen overflow-x-hidden bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8">') &&
    !livePage.includes("live-non-live-page") &&
    livePage.includes('className="mx-auto flex max-w-7xl flex-col gap-8"') &&
    !livePage.includes("max-w-7xl flex-col gap-8 px-4 py-6") &&
    livePage.includes('import { getHomeSlateDate } from "@/lib/data/start-service";') &&
    livePage.includes("const board = await getLiveScoreboard({ date });") &&
    !livePage.includes("getSlateStartProgress") &&
    !livePage.includes("Promise.all([") &&
    livePage.includes('const boardTitle = "Live GS+ Scoreboard";') &&
    livePage.includes('const boardDescription = slateComplete') &&
    livePage.includes('pregame\n      ? ""') &&
    livePage.includes('className={pregame ? "space-y-2" : "space-y-6"}') &&
    livePage.includes('className={pregame ? "space-y-3" : "space-y-4"}') &&
    livePage.includes('<p className="font-mono text-xs uppercase tracking-[0.18em] text-[#FF9A62]">Live board</p>') &&
    livePage.includes('className="flex items-center justify-between gap-4"') &&
    livePage.includes('className="shrink-0 font-mono text-xs uppercase tracking-[0.16em] text-zinc-500"') &&
    livePage.includes('{boardDescription ? <p className="max-w-3xl text-sm leading-6 text-zinc-400">{boardDescription}</p> : null}') &&
    !livePage.includes('<p className="max-w-3xl text-sm leading-6 text-zinc-400">\n            {boardDescription}\n          </p>') &&
    !livePage.includes("Daily GS+ Scoreboard") &&
    !livePage.includes("Daily board") &&
    livePage.includes("const slateComplete = board.hasGames && board.totalStarts > 0 && board.finalStarts === board.totalStarts;") &&
    livePage.includes("const pregame = board.hasGames && board.finalStarts === 0 && board.liveStarts === 0 && board.warmingStarts === 0 && board.delayStarts === 0;") &&
    livePage.includes("This slate is final. Full tiers, filters, and breakdowns live on Ranked Starts.") &&
    livePage.includes('<LiveScoreboard initialBoard={board} initialSlateProgress={board.slateProgress} />') &&
    liveApi.includes("getLiveScoreboard({ date })") &&
    liveApi.includes("export const revalidate = 30;"),
  "/live/[date] route and API must render the cached live board at the shared site width with stable Live naming",
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
    liveComponent.includes("setSlateProgress(nextBoard.slateProgress);") &&
    liveComponent.includes('import { LIVE_NAV_STATE_EVENT } from "@/components/live-nav-label";') &&
    liveComponent.includes("window.dispatchEvent(new CustomEvent(LIVE_NAV_STATE_EVENT, { detail: { liveStarts: board.liveStarts, warmingStarts: board.warmingStarts } }))") &&
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
    liveComponent.includes('src="/images/slab-2.png"') &&
    !liveComponent.includes('src="/images/live-slab-bg.jpg"') &&
    !liveComponent.includes("bg-[linear-gradient(") &&
    !liveComponent.includes("bg-[radial-gradient(") &&
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
    liveComponent.includes('data-scheduled-starts={board.scheduledStarts}') &&
    liveComponent.includes('className="relative isolate overflow-hidden"') &&
    liveComponent.includes('className="relative flex flex-col items-start justify-start px-4 pb-5 pt-3 sm:px-6 sm:pb-6 sm:pt-4 lg:px-8 lg:pt-5"') &&
    !liveComponent.includes("min-h-[470px]") &&
    !liveComponent.includes("sm:min-h-[540px]") &&
    !liveComponent.includes("lg:min-h-[620px]") &&
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
    liveComponent.includes('className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-white sm:text-xs"') &&
    liveComponent.includes("First pitch {slateProgress.firstPitchAt ? formatFirstPitch(slateProgress.firstPitchAt) : \"TBD\"} · {board.totalStarts} starters") &&
    !liveComponent.includes("First pitch {slateProgress.firstPitchAt ? formatFirstPitch(slateProgress.firstPitchAt) : \"TBD\"} · {board.totalStarts} starters.") &&
    liveComponent.includes("upcomingDateHref(board.date)") &&
    liveComponent.includes('<CtaArrow\n              href={upcomingDateHref(board.date)}') &&
    liveComponent.includes("Preview matchups") &&
    !liveComponent.includes("Preview matchups -&gt;") &&
    !liveComponent.includes("Preview tonight&apos;s matchups on Upcoming -&gt;") &&
    liveComponent.includes("formatFirstPitchCountdown(new Date(current.firstPitchAt).getTime() - nowMs)") &&
    liveComponent.includes("function formatPregameCountdown") &&
    liveComponent.includes("function isPregame(board: LiveScoreboardData)") &&
    liveComponent.includes("return board.hasGames && board.finalStarts === 0 && board.liveStarts === 0 && board.warmingStarts === 0 && board.delayStarts === 0;") &&
    liveComponent.includes('<SlateCompleteHandoff board={board} rows={scoredRows.slice(0, 3)} />') &&
    liveComponent.includes('data-live-board-complete="true"') &&
    liveComponent.includes("function SlateCompleteHandoff") &&
    liveComponent.includes("const nextSlateLine = formatNextSlateLine(board);") &&
    liveComponent.includes("This slate is final.") &&
    !liveComponent.includes("Today&apos;s slate is final.") &&
    liveComponent.includes("Live returns with the next slate.") &&
    liveComponent.includes("data-live-next-slate") &&
    liveComponent.includes("function formatNextSlateLine(board: LiveScoreboardData)") &&
    liveComponent.includes("if (!board.nextSlateFirstPitchAt) return null;") &&
    liveComponent.includes("if (toPacificDate(parsed) !== board.date)") &&
    liveComponent.includes("return `Next slate begins ${dayLabel}, ${timeLabel}`;") &&
    liveComponent.includes("return `Next slate begins ${timeLabel}`;") &&
    liveComponent.includes("function toPacificDate(date: Date)") &&
    liveComponent.includes("rankedStartsPath(board.date)") &&
    liveComponent.includes('import { CtaArrow } from "@/components/cta-arrow";') &&
    liveComponent.includes("View all ranked starts for {formatBoardDate(board.date)}") &&
    !liveComponent.includes("View all ranked starts for {formatBoardDate(board.date)} -&gt;") &&
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
    liveComponent.includes("board.scheduledStarts > 0 ? `${board.scheduledStarts} scheduled` : null") &&
    liveComponent.includes('<span> · {board.finalStarts} final</span>') &&
    !liveComponent.includes('<span> · {board.totalStarts} starters</span>') &&
    !liveComponent.includes("const showTotal = nonzeroBuckets > 1;") &&
    liveComponent.includes('status === "scheduled" ? "Scheduled" : "Warming"') &&
    countOccurrences(liveComponent, "<p suppressHydrationWarning>{updatedLabel}</p>") === 2 &&
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
  ctaArrow.includes('export function CtaArrow') &&
    ctaArrow.includes('data-cta-arrow') &&
    ctaArrow.includes('direction?: "back" | "forward";') &&
    ctaArrow.includes('data-cta-arrow-direction={direction}') &&
    ctaArrow.includes('data-cta-arrow-tail') &&
    ctaArrow.includes('data-cta-arrow-tail-direction={direction}') &&
    ctaArrow.includes('aria-hidden="true"') &&
    ctaArrow.includes('data-cta-arrow-shaft') &&
    ctaArrow.includes('isBack ? "flex-row-reverse" : ""') &&
    ctaArrow.includes('group-hover/cta:w-10') &&
    ctaArrow.includes("whitespace-nowrap") &&
    !ctaArrow.includes("truncate") &&
    ctaArrow.includes('border-[#FF9A62]/50 text-[#FF9A62] hover:border-[#FF9A62]') &&
    ctaArrow.includes('border-[#F6C445]/50 text-[#F6C445] hover:border-[#F6C445]'),
  "shared CTA arrow must render a drawn tail that is hidden from assistive tech and uses site accent tones",
);

assert(
  routes.includes("export function liveDateHref(date: string)") &&
    siteNav.includes('type NavKey = "home" | "starts" | "heat" | "live" | "upcoming" | "watchlist";') &&
    siteNav.includes('import { LiveNavLabel } from "@/components/live-nav-label";') &&
    siteNav.includes('import { getLiveScoreboard } from "@/lib/data/live-scoreboard-service";') &&
    siteNav.includes('const liveItem = [{ key: "live" as const, label: <LiveNavLabel initialSnapshot={{ liveStarts: liveBoard.liveStarts, warmingStarts: liveBoard.warmingStarts }} routeActive={active !== null && active === "live"} />, href: liveDateHref(today) }];') &&
    siteNav.includes("href: liveDateHref(today)") &&
    siteNav.includes('className="grid w-full grid-cols-3 gap-2 pb-4 pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 md:hidden"') &&
    siteNav.includes('className={`flex min-h-11 items-center justify-center rounded border px-2 py-2 text-center') &&
    !siteNav.includes("overflow-x-auto pb-4 pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 md:hidden") &&
    !siteNav.includes("shrink-0 items-center rounded border") &&
    liveNavLabel.includes('export type LiveNavIndicatorState = "active" | "warming" | "idle";') &&
    liveNavLabel.includes('export const LIVE_NAV_STATE_EVENT = "toe-the-slab:live-nav-state";') &&
    liveNavLabel.includes("function getLiveNavIndicatorState(snapshot: LiveNavSnapshot): LiveNavIndicatorState") &&
    liveNavLabel.includes('if (snapshot.liveStarts > 0) return "active";') &&
    liveNavLabel.includes('if (snapshot.warmingStarts > 0) return "warming";') &&
    liveNavLabel.includes('return "idle";') &&
    liveNavLabel.includes('routeActive = false') &&
    liveNavLabel.includes('toneClass = routeActive ? "text-zinc-50" : active ? "text-[#FF9A62]" : "text-zinc-400"') &&
    liveNavLabel.includes('warming\n      ? "border border-[#F6C445] bg-transparent"') &&
    liveNavLabel.includes('window.addEventListener(LIVE_NAV_STATE_EVENT, handleStateEvent);') &&
    liveNavLabel.includes("data-live-nav-state={state}") &&
    liveNavLabel.includes('data-live-nav-active={active ? "true" : "false"}') &&
    liveNavLabel.includes('data-live-nav-route-active={routeActive ? "true" : "false"}') &&
    liveNavLabel.includes('{state === "idle" ? null : <span') &&
    primaryNavLink.includes("router.prefetch(href)") &&
    primaryNavLink.includes("event.preventDefault()") &&
    primaryNavLink.includes("router.push(href)") &&
    !primaryNavLink.includes("documentNavigation") &&
    !primaryNavLink.includes('data-document-nav="true"') &&
    !siteNav.includes('className="ranked-live-dot h-2 w-2 rounded-full bg-[#FF5A1F]"'),
  "primary nav must keep LIVE as a permanent scoreboard link with state-aware wayfinding, instant client navigation, and a two-row mobile grid",
);

assert(
  homeRanked.includes("getLiveScoreboard({ date: today })") &&
    homeRanked.includes("resolveLiveLeaderStart(liveBoard, todaySlateStarts)") &&
    homeRanked.includes("href: liveDateHref(today),") &&
    homeStatus.includes("shouldLinkLiveScoreboard(slateState)") &&
    homeStatus.includes('state.state === "starts-in-progress" || state.state === "pre-first-pitch" || state.state === "all-starts-complete"') &&
    !homeStatus.includes("state.liveGames > 0") &&
    homeStatus.includes("liveDateHref(slateState.date)"),
  "homepage hero and status line must become live-board entry points during active starts and off-hours",
);

console.log("live scoreboard contract ok: provisional board, hero, permanent nav, and status hooks are isolated from ranked starts");

function countOccurrences(value, token) {
  return value.split(token).length - 1;
}
