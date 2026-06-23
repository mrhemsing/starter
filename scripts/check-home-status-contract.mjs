import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const [homePage, slateState, statusLine, statusRoute] = await Promise.all([
  readFile("src/app/page.tsx", "utf8"),
  readFile("src/lib/slate-state.ts", "utf8"),
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
  slateState.indexOf('return "suspended"') < slateState.indexOf('return "live"'),
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
    slateState.includes('return `TODAY · ${dateLabel} · ${state.completedStarts} OF ${state.totalStarts} STARTS FINAL`;'),
  "homepage in-progress line must render completed starts",
);

assert(
  slateState.includes('state: "all-starts-complete"') &&
    slateState.includes('return `TODAY · ${dateLabel} · ALL ${state.totalStarts} STARTS FINAL`;'),
  "homepage all-final line must render completed starts",
);

assert(
  slateState.includes('return `${dateLabel} · NO GAMES TODAY`;'),
  "homepage no-games line must render the off-day state",
);

assert(
  slateState.includes(".format(parsed).toUpperCase()"),
  "homepage status date label must render uppercase month text like JUN 17",
);

assert(
  slateState.includes("Math.ceil(durationMs / 60000)") &&
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
    statusLine.includes("whitespace-nowrap") &&
    statusLine.includes("overflow-hidden") &&
    statusLine.includes("text-ellipsis") &&
    statusLine.includes("data-slate-total-starts={slateState.totalStarts}") &&
    statusLine.includes("data-slate-completed-starts={slateState.completedStarts}") &&
    statusLine.includes("{line}"),
  "homepage status line must render one nowrap state-aware line",
);

assert(
  !statusLine.includes("Upcoming") && !statusLine.includes("href") && !statusLine.includes("<a "),
  "homepage status eyebrow must not include an upcoming starts link",
);

assert(
  statusRoute.includes("getSlateStartProgress({ window: \"today\", date })"),
  "homepage status API must return the shared slate progress state",
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
