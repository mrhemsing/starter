import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const [homePage, startsPage, slateState, startService, slateCounts, statusRoute] = await Promise.all([
  readFile("src/app/page.tsx", "utf8"),
  readFile("src/app/starts/[id]/page.tsx", "utf8"),
  readFile("src/lib/slate-state.ts", "utf8"),
  readFile("src/lib/data/start-service.ts", "utf8"),
  readFile("src/components/slate-counts.tsx", "utf8"),
  readFile("src/app/api/home/status/route.ts", "utf8"),
]);

assert(
  slateState.includes('if (/\\b(suspended)\\b/.test(status)) return "suspended";'),
  "homepage status normalizer must classify suspended games separately",
);

assert(
  slateState.includes('if (/\\b(delayed)\\b/.test(status)) return "delayed";'),
  "homepage status normalizer must classify delayed starts separately from live games",
);

assert(
  slateState.includes('if (/\\b(live|in progress|manager challenge)\\b/.test(status)) return "live";'),
  "homepage live status normalizer must use live game status, not the clock or delayed starts",
);

assert(
  slateState.indexOf('if (/\\b(suspended)\\b/.test(status)) return "suspended";') < slateState.indexOf('if (/\\b(live|in progress|manager challenge)\\b/.test(status)) return "live";'),
  "homepage status normalizer must check suspended before live statuses",
);

assert(
  slateState.includes('state: "pre-first-pitch"') && slateState.includes("formatFirstPitchCountdown"),
  "homepage slate state must keep countdown inside the pre-first-pitch state",
);

assert(
  slateState.includes('totalStarts: number;') &&
    slateState.includes('completedStarts: number;') &&
    slateState.includes('liveStarts: number;') &&
    slateState.includes("const totalStarts = totalGames * 2;") &&
    slateState.includes("const completedStartCount = Math.min(totalStarts, Math.max(completedStarts, finalGames * 2));") &&
    slateState.includes("const completedStartsInLiveGames = Math.min(liveGames * 2, Math.max(0, completedStartCount - completedStartsInFinalGames));") &&
    slateState.includes("const liveStartCount = Math.max(0, liveGames * 2 - completedStartsInLiveGames);"),
  "homepage slate state must count starter outings and derive in-progress starts from settled starter lines",
);

assert(
  slateState.includes('state: "starts-in-progress"') &&
    slateState.includes('return `TODAY · ${state.liveStarts} LIVE · ${state.completedStarts} OF ${state.totalStarts} STARTS FINAL`;') &&
    !slateState.includes('return `TODAY · ${state.liveGames} LIVE') &&
    slateState.includes('return `${todayDateLabel} · ${state.completedStarts} OF ${state.totalStarts} STARTS FINAL`;'),
  "homepage in-progress line must render live and completed starts",
);

assert(
  slateState.includes('state: "all-starts-complete"') &&
    slateState.includes('return `${todayDateLabel} · ALL ${state.totalStarts} STARTS FINAL`;'),
  "homepage all-final line must render completed starts",
);

assert(
  slateState.includes('return `${dateLabel} · NO GAMES TODAY`;'),
  "homepage no-games line must render the off-day state",
);

assert(
  slateState.includes('const todayDateLabel = `TODAY, ${dateLabel}`;') &&
    slateState.includes('return `${todayDateLabel} · LIVE GS+ · FIRST STARTER TOES THE SLAB ${countdown}`;'),
  "homepage pre-first-pitch line must use TODAY, date before LIVE GS+",
);

assert(
  slateState.includes(".format(parsed).toUpperCase()"),
  "homepage status date label must render uppercase full month text like JUNE 17",
);

assert(
  slateState.includes('month: "long"') && slateState.includes("function formatStatusDate"),
  "homepage status date label must use the full month name, not an abbreviated month",
);

assert(
  slateState.includes("Math.ceil(durationMs / 60000)") &&
    slateState.includes("durationMs <= 60 * 1000") &&
    slateState.includes('return "STARTING SOON";') &&
    slateState.includes('return "DELAYED";') &&
    slateState.includes('state.countdownLabel === "STARTING SOON" || state.countdownLabel === "DELAYED"') &&
    !slateState.includes("totalSeconds"),
  "homepage countdown must use minute granularity with starting-soon and delayed guards",
);

assert(
  slateCounts.includes("const SLATE_COUNTS_POLL_MS = 30_000;") &&
    slateCounts.includes("void refresh();") &&
    slateCounts.includes("if (shouldContinuePolling)") &&
    slateCounts.includes("window.setTimeout(refresh, SLATE_COUNTS_POLL_MS)") &&
    !slateCounts.includes("window.setInterval(refresh"),
  "shared slate counts island must mount-poll immediately and continue only while live starts remain",
);

assert(
  slateCounts.includes('window.setInterval(updateCountdown, 60 * 1000)') && !slateCounts.includes("window.setInterval(updateCountdown, 1000)"),
  "homepage countdown must not tick every second",
);

assert(
  homePage.includes('import { SlateCounts } from "@/components/slate-counts";') &&
    startsPage.includes('import { SlateCounts } from "@/components/slate-counts";') &&
    homePage.includes('<SlateCounts initialState={slateStatus} variant="home" />') &&
    startsPage.includes('<SlateCounts') &&
    startsPage.includes('variant="ranked"') &&
    slateCounts.includes('data-responsive-check="home-slate-status-line"') &&
    slateCounts.includes('data-responsive-check="ranked-slate-status-island"') &&
    slateCounts.includes("sm:whitespace-nowrap") &&
    slateCounts.includes("overflow-hidden") &&
    slateCounts.includes("sm:text-ellipsis") &&
    slateCounts.includes("data-slate-total-starts={state.totalStarts}") &&
    slateCounts.includes("data-slate-completed-starts={state.completedStarts}") &&
    slateCounts.includes("aria-label={label}"),
  "homepage status line must keep the full state-aware line available",
);

assert(
  slateCounts.includes('const marker = " · FIRST ";') &&
    slateCounts.includes('state !== "pre-first-pitch"') &&
    slateCounts.includes("mobilePreFirstPitchLine.prefix") &&
    slateCounts.includes("mobilePreFirstPitchLine.detail") &&
    slateCounts.includes("<br />") &&
    slateCounts.includes('className="hidden sm:inline"') &&
    slateCounts.includes("`FIRST ${line.slice(markerIndex + marker.length)}`"),
  "homepage pre-first-pitch status must force a mobile break before FIRST without the leading dot",
);

assert(
  !slateCounts.includes("Upcoming") &&
    slateCounts.includes("shouldLinkLiveScoreboard(state)") &&
    slateCounts.includes('state.state === "starts-in-progress"') &&
    slateCounts.includes('state.state === "pre-first-pitch"') &&
    slateCounts.includes('state.state === "all-starts-complete"') &&
    !slateCounts.includes("state.liveGames > 0") &&
    slateCounts.includes("liveDateHref(state.date)"),
  "homepage status eyebrow must link to the live board during games and off-hours without adding a redundant live dot",
);

assert(
  statusRoute.includes('export const dynamic = "force-dynamic";') &&
    statusRoute.includes("getSlateStartProgress({ window: \"today\", date })") &&
    statusRoute.includes('"Cache-Control": "no-store"') &&
    !statusRoute.includes("s-maxage"),
  "homepage status API must return the shared slate progress state without serving stale cache to live islands",
);

assert(
  startService.includes("export async function getSlateStartProgress(params: SlateRouteParams): Promise<SlateProgressState>") &&
    startService.includes("const [schedule, slateStarts] = await Promise.all([") &&
    startService.includes("getDailySlate(params),") &&
    startService.includes("const startCounts = summarizeCanonicalStartBuckets(slateStarts);") &&
    startService.includes("return getSlateProgressState(schedule, startCounts.finalStarts);") &&
    !startService.includes("return getSlateProgressState(schedule, completedLines.size);"),
  "homepage slate progress must use canonicalized start counts instead of a separate completed-line count",
);

assert(
  homePage.includes("GS+ scores a single start 0-100, league average ~50.") && !homePage.includes("Probable starters, form, matchup context"),
  "homepage masthead value prop must be trimmed to the tagline plus GS+ line",
);

assert(
  homePage.includes('className="block whitespace-nowrap text-[11px] sm:inline sm:whitespace-normal sm:text-sm"') &&
    homePage.includes('className="mt-1 block font-mono text-xs uppercase tracking-[0.12em] text-amber-300 underline-offset-4 hover:underline sm:ml-[10px] sm:mt-0 sm:inline"'),
  "homepage mobile GS+ value prop must stay on one line and force a break before methodology",
);

assert(
  !homePage.includes("FirstPitchCountdownEyebrow") &&
    !homePage.includes("SlateStatusPill") &&
    !homePage.includes("HomeSlateStatusLine") &&
    !startsPage.includes("RankedSlateStatusIsland"),
  "homepage must not render separate stacked countdown/status fragments",
);

console.log("home status contract ok: one shared slate-state line with pre-pitch-only countdown");
