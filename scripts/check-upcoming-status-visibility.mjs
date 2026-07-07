import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const upcomingPage = readFileSync("src/app/upcoming/[date]/page.tsx", "utf8");
const upcomingWeekPage = readFileSync("src/app/upcoming/week/[startDate]/page.tsx", "utf8");
const slateDateNav = readFileSync("src/components/slate-date-nav.tsx", "utf8");
const tonightService = readFileSync("src/lib/data/tonight-service.ts", "utf8");
const tonightCards = readFileSync("src/components/tonights-must-watch.tsx", "utf8");
const types = readFileSync("src/lib/types.ts", "utf8");

assert(types.includes('"pregame" | "delay" | "live" | "final" | "ppd"'), "TonightGameStatus must include mixed Upcoming statuses");
assert(types.includes('export type UpcomingCardStatus = "pregame" | "delay";'), "UpcomingCardStatus must exclude games after first pitch");
assert(tonightService.includes('const ACTIVE_UPCOMING_CARD_STATUSES: UpcomingCardStatus[] = ["pregame", "delay"]'), "Upcoming data should include only not-yet-started and delayed games");
assert(tonightService.includes("const candidates = builtGames.filter(isUpcomingGame);"), "Upcoming service must filter started games before ranking cards");
assert(tonightService.includes("function hasStarted("), "Upcoming service must use a schedule-state started-game guard");
assert(tonightService.includes('["tonight-must-watch", "v15"]'), "Upcoming service must bump the cache namespace after the matchup baseline change");
assert(tonightService.includes("function scoreBaselineMatchup("), "Upcoming service must compute a local matchup baseline when live opponent splits are missing");
assert(tonightService.includes("status: splitMatchupScore === null && baselineMatchupScore.pending ? \"pending-opponent-splits\" : \"scored\""), "Upcoming cards with starter-form baselines must not render as matchup pending");
assert(!tonightService.includes("firstPitchAt <= Date.now()"), "Upcoming service must not remove Warming/Pre-Game cards only because scheduled first pitch has passed");
assert(tonightService.includes('return "delay";'), "schedule status normalization must preserve delay status");

assert(upcomingPage.includes("export function summarizeUpcomingStatuses"), "day Upcoming page must expose slate status summary");
assert(upcomingPage.includes("statusSummary.distinctStatuses >= 2"), "day Upcoming page must compute status variation");
assert(upcomingPage.includes("showStatusFilter={statusVaries}"), "day Upcoming controls must hide status filter when status does not vary");
assert(upcomingPage.includes("const effectiveControls = statusVaries ? controls : { ...controls, pregameOnly: false }"), "day Upcoming page must ignore pregame-only control when status does not vary");
assert(upcomingPage.includes("jsonLdForUpcomingDay(visibleUpcoming)"), "day Upcoming JSON-LD must match the visible filtered slate");
assert(upcomingPage.includes("data-control-status-filter-visible"), "Upcoming controls must expose status-filter visibility for DOM checks");
assert(upcomingPage.includes("data-control-status-summary"), "Upcoming controls must expose status summary for DOM checks");
assert(!upcomingPage.includes("<details\n      className=\"mt-5"), "Upcoming controls must not collapse filters and sort behind an expandable details row");
assert(!upcomingPage.includes("<summary className=\"cursor-pointer font-mono text-xs uppercase"), "Upcoming controls must not render the old Filters / Start time summary row");
assert(upcomingPage.includes('data-upcoming-toolbar-row') && upcomingPage.includes('className="mt-5 flex flex-col gap-2"') && upcomingPage.includes('className="mt-0"'), "Upcoming day toolbar must place compact toggles on a second row below the range tabs.");
assert(upcomingPage.includes('className={`${className} flex max-w-full flex-nowrap items-center gap-2 overflow-x-auto py-1`}'), "Upcoming controls must render surfaced compact toggles with caller-controlled spacing.");
assert(slateDateNav.includes('mobileLabel: "Week"') && slateDateNav.includes('className="sm:hidden"') && slateDateNav.includes('className="hidden sm:inline"'), "Upcoming range tabs must show WEEK on mobile and THIS WEEK on larger screens.");

assert(upcomingWeekPage.includes("summarizeUpcomingStatuses"), "week Upcoming page must use the same status summary");
assert(upcomingWeekPage.includes("showStatusFilter={statusVaries}"), "week Upcoming controls must hide status filter when status does not vary");
assert(upcomingWeekPage.includes("const effectiveControls = statusVaries ? controls : { ...controls, pregameOnly: false }"), "week Upcoming page must ignore pregame-only control when status does not vary");
assert(upcomingWeekPage.includes("jsonLdForUpcomingWeek(visibleUpcoming)"), "week Upcoming JSON-LD must match the visible filtered slate");

assert(tonightCards.includes("const showGameStatus = new Set(shownGames.map((game) => game.status)).size >= 2"), "Upcoming cards must render lifecycle status only when visible status varies");
assert(tonightCards.includes("data-visible-status-varies={String(showGameStatus)}"), "Upcoming card section must expose status variation for DOM checks");
assert(tonightCards.includes("gameSummarySegments(game, showGameStatus)"), "Upcoming card summaries must consume status variation");
assert(tonightCards.includes("formatFirstPitchCountdown"), "Upcoming countdown must reuse the shared first-pitch countdown formatter");
assert(tonightCards.includes("remainingMs <= 3 * 60 * 60 * 1000"), "Upcoming countdown should only replace pregame time within 3 hours");
assert(tonightCards.includes("First pitch in ${compactFirstPitchCountdown(remainingMs)}"), "Upcoming pregame countdown copy must use minute precision");
assert(tonightCards.includes('if (status === "delay") return "Delay";'), "status labels must handle delay");
assert(tonightCards.includes('if (status === "final") return "Final";'), "status labels must handle final");

console.log("upcoming status visibility checks passed");
