import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile("src/app/upcoming/[date]/page.tsx", "utf8");
const viewMode = await readFile("src/components/upcoming-view-mode.tsx", "utf8");
const segmentedControl = await readFile("src/components/segmented-control.tsx", "utf8");
const globals = await readFile("src/app/globals.css", "utf8");
const simpleBoard = await readFile("src/components/upcoming-simple-board.tsx", "utf8");
const context = await readFile("src/lib/upcoming-simple-context.ts", "utf8");

assert(page.includes("<UpcomingViewModeProvider>"), "Upcoming page must wrap toolbar and board in one view-mode provider.");
assert(page.includes('viewModeToggle={<UpcomingViewModeToggle />}'), "Upcoming toolbar must render the simple/detailed toggle inside the existing controls.");
assert(page.includes("<UpcomingViewModePanels") && page.includes("<TonightsMustWatch") && page.includes("<UpcomingSimpleBoard"), "Upcoming board must switch between detailed and simple panels without changing data.");
assert(!page.includes("viewMode="), "Upcoming simple mode must not be URL-backed.");

assert(viewMode.includes('const STORAGE_KEY = "tts.upcoming.view";'), "Upcoming view preference must use the namespaced storage key.");
assert(page.includes('import { SegmentedControl } from "@/components/segmented-control";'), "Upcoming SORT must use the shared segmented-control primitive.");
assert(viewMode.includes('import { SegmentedControl } from "@/components/segmented-control";'), "Upcoming VIEW must use the shared segmented-control primitive.");
assert(page.includes('label="Sort"') && page.includes('{ value: "watch", label: "Watch rank"') && page.includes('{ value: "time", label: "Start time"'), "Upcoming SORT must render as WATCH RANK / START TIME segmented options.");
assert(viewMode.includes('label="View"') && viewMode.includes('{ value: "detailed", label: "Detailed"') && viewMode.includes('{ value: "simple", label: "Simple"'), "Upcoming VIEW must render as DETAILED / SIMPLE segmented options.");
assert(segmentedControl.includes("data-segmented-control-indicator") && segmentedControl.includes("segmented-control-indicator") && segmentedControl.includes("transition-transform duration-[175ms]"), "Segmented controls must render a sliding indicator.");
assert(globals.includes("@media (prefers-reduced-motion: reduce)") && globals.includes(".segmented-control-indicator") && globals.includes("transition: none;"), "Segmented indicator animation must disable under reduced motion.");
assert(segmentedControl.includes('role="group"') && segmentedControl.includes("handleKeyDown") && segmentedControl.includes("ArrowLeft") && segmentedControl.includes("ArrowRight"), "Segmented controls must expose labeled group semantics and arrow-key movement.");
assert(segmentedControl.includes("min-h-11"), "Segmented controls must keep touch targets at least 44px tall.");
assert(viewMode.includes('window.localStorage.getItem(STORAGE_KEY) === "SIMPLE"'), "Stored SIMPLE preference must restore simple view.");
assert(viewMode.includes('window.localStorage.setItem(STORAGE_KEY, nextMode === "simple" ? "SIMPLE" : "DETAILED")'), "Toggle must persist SIMPLE/DETAILED values.");
assert(viewMode.includes("try {") && countOccurrences(viewMode, "catch") >= 2, "localStorage reads and writes must be wrapped for blocked storage.");
assert(viewMode.includes('const [mode, setModeState] = useState<UpcomingViewMode>(() => readStoredViewMode());'), "Default view mode must resolve through the guarded storage reader.");
assert(viewMode.includes('return "detailed";'), "Missing or blocked storage must default to DETAILED.");
assert(countOccurrences(viewMode, 'data-upcoming-view-mode-control') === 1, "Only one view-mode control should render.");

assert(simpleBoard.includes('data-responsive-check="upcoming-simple-board"'), "Simple board must expose a stable test hook.");
assert(viewMode.includes('data-responsive-check="upcoming-simple-card"'), "Simple cards must expose stable test hooks.");
assert(simpleBoard.includes("data-simple-visible-game-pks"), "Simple board must expose game order for parity checks.");
assert(simpleBoard.includes("data-simple-watch-ranks"), "Simple board must expose rank order for parity checks.");
assert(simpleBoard.includes("data-simple-watch-score"), "Simple cards must render one hero watch score.");
assert(simpleBoard.includes("data-simple-first-pitch"), "Simple cards must render one first-pitch time.");
assert(simpleBoard.includes("data-upcoming-simple-context"), "Simple cards must render one deterministic context sentence.");
assert(simpleBoard.includes("data-simple-context-sentence-count={sentenceCount(sentence)}"), "Simple context copy must expose sentence counts.");
assert(simpleBoard.includes('data-simple-context-has-em-dash={String(sentence.includes("—"))}'), "Simple context sentences must guard against em dash copy.");
assert(countOccurrences(simpleBoard, "data-simple-form-chip") === 1, "Simple starter renderer should create exactly one form chip per starter instance.");
assert(!simpleBoard.includes("FormSparkline"), "Simple cards must not render sparklines.");
assert(!simpleBoard.includes("FormDriverChips"), "Simple cards must not render pitch-mix or driver chip rows.");
assert(!simpleBoard.includes("projectedStrikeouts") && !simpleBoard.includes("K line"), "Simple cards must not render K-line elements.");
assert(!simpleBoard.includes("projectedGsPlus") && !simpleBoard.includes("Proj GS+"), "Simple cards must not render projected GS+ lines.");

const retiredSlop = [
  "'s form carries this one",
  "has cooled",
  "Two rising arms in a hitter-friendly park.",
  "Ranked #${rank} on today's board.",
  "Elite matchup: both starters grading plus.",
];

for (const phrase of retiredSlop) {
  assert(!context.includes(phrase), `Simple context must not reuse canned template: ${phrase}`);
}

const dataInputs = [
  "opponentSplit",
  "projectedStrikeouts",
  "strikeoutPropLine",
  "opposingTeamTotal",
  "weatherContext",
  "parkContext",
  "watchScoreConfidence",
];

for (const input of dataInputs) {
  assert(context.includes(input), `Simple context must be composed from data input: ${input}`);
}

assert(context.includes("namedStarters.length < 2"), "Simple context must explain TBD starter slots.");
assert(context.includes("Limited samples keep the grade cautious."), "Simple context must call out low or medium-confidence samples.");

console.log("upcoming simple view contract ok");

function countOccurrences(source, needle) {
  return source.split(needle).length - 1;
}
