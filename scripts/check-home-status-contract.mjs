import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const [homePage, slateState, startService, statusLine, statusRoute] = await Promise.all([
  readFile("src/app/page.tsx", "utf8"),
  readFile("src/lib/slate-state.ts", "utf8"),
  readFile("src/lib/data/start-service.ts", "utf8"),
  readFile("src/components/home-slate-status-line.tsx", "utf8"),
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
    slateState.includes("const totalStarts = totalGames * 2;") &&
    slateState.includes("const completedStartCount = Math.min(totalStarts, Math.max(completedStarts, finalGames * 2));"),
  "homepage slate state must count starter outings with a playable-game fallback",
);

assert(
  slateState.includes('state: "starts-in-progress"') &&
    slateState.includes('return `TODAY · ${state.liveGames} LIVE · ${state.completedStarts} OF ${state.totalStarts} STARTS FINAL`;') &&
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
  statusLine.includes('window.setInterval(refresh, 30 * 1000)'),
  "homepage status line must refresh live state without a manual reload",
);

assert(
  statusLine.includes('window.setInterval(updateCountdown, 60 * 1000)') && !statusLine.includes("window.setInterval(updateCountdown, 1000)"),
  "homepage countdown must not tick every second",
);

assert(
  statusLine.includes('data-responsive-check="home-slate-status-line"') &&
    statusLine.includes("sm:whitespace-nowrap") &&
    statusLine.includes("overflow-hidden") &&
    statusLine.includes("sm:text-ellipsis") &&
    statusLine.includes("data-slate-total-starts={slateState.totalStarts}") &&
    statusLine.includes("data-slate-completed-starts={slateState.completedStarts}") &&
    statusLine.includes("aria-label={line}"),
  "homepage status line must keep the full state-aware line available",
);

assert(
  statusLine.includes('const marker = " · FIRST ";') &&
    statusLine.includes('state !== "pre-first-pitch"') &&
    statusLine.includes("mobilePreFirstPitchLine.prefix") &&
    statusLine.includes("mobilePreFirstPitchLine.detail") &&
    statusLine.includes("<br />") &&
    statusLine.includes('className="hidden sm:inline"') &&
    statusLine.includes("`FIRST ${line.slice(markerIndex + marker.length)}`"),
  "homepage pre-first-pitch status must force a mobile break before FIRST without the leading dot",
);

assert(
  !statusLine.includes("Upcoming") &&
    statusLine.includes("shouldLinkLiveScoreboard(slateState)") &&
    statusLine.includes('state.state === "pre-first-pitch"') &&
    statusLine.includes('state.state === "all-starts-complete"') &&
    statusLine.includes("liveDateHref(slateState.date)") &&
    !statusLine.includes("ranked-live-dot") &&
    !statusLine.includes('rounded-full bg-[#FF5A1F]"'),
  "homepage status eyebrow must link to the live board during games and off-hours without adding a redundant live dot",
);

assert(
  statusRoute.includes("getSlateStartProgress({ window: \"today\", date })"),
  "homepage status API must return the shared slate progress state",
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
  !homePage.includes("FirstPitchCountdownEyebrow") && !homePage.includes("SlateStatusPill"),
  "homepage must not render separate stacked countdown/status fragments",
);

console.log("home status contract ok: one shared slate-state line with pre-pitch-only countdown");
