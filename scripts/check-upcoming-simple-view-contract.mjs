import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile("src/app/upcoming/[date]/page.tsx", "utf8");
const viewMode = await readFile("src/components/upcoming-view-mode.tsx", "utf8");
const segmentedControl = await readFile("src/components/segmented-control.tsx", "utf8");
const simpleBoard = await readFile("src/components/upcoming-simple-board.tsx", "utf8");
const context = await readFile("src/lib/upcoming-simple-context.ts", "utf8");
const writeupsService = await readFile("src/lib/data/upcoming-writeups-service.ts", "utf8");
const writeupsCron = await readFile("src/app/api/cron/upcoming-writeups/route.ts", "utf8");
const vercelConfig = await readFile("vercel.json", "utf8");
const headshot = await readFile("src/components/headshot.tsx", "utf8");
const globals = await readFile("src/app/globals.css", "utf8");

assert(page.includes("<UpcomingViewModeProvider>"), "Upcoming page must wrap toolbar and board in one view-mode provider.");
assert(page.includes('viewModeToggle={<UpcomingViewModeToggle />}'), "Upcoming toolbar must render the simple/detailed toggle inside the existing controls.");
assert(page.includes("<UpcomingViewModePanels") && page.includes("<TonightsMustWatch") && page.includes("<UpcomingSimpleBoard"), "Upcoming board must switch between detailed and simple panels without changing data.");
assert(!page.includes("viewMode="), "Upcoming simple mode must not be URL-backed.");
assert(page.includes('import { readUpcomingWriteups } from "@/lib/data/upcoming-writeups-service";') && page.includes("readUpcomingWriteups(date)") && page.includes("contextWriteups={contextWriteups}"), "Upcoming page must only read stored LLM writeups during render and pass them to Simple cards.");

assert(viewMode.includes('const STORAGE_KEY = "tts.upcoming.view";'), "Upcoming view preference must use the namespaced storage key.");
assert(page.includes('import { SegmentedControl } from "@/components/segmented-control";'), "Upcoming SORT must use the shared segmented-control primitive.");
assert(page.includes('import { formWindowLabel } from "@/lib/form-tokens";'), "Upcoming form-window label must come from the shared form token helper.");
assert(viewMode.includes('import { SegmentedControl } from "@/components/segmented-control";'), "Upcoming VIEW must use the shared segmented-control primitive.");
assert(page.includes('label="Sort"') && page.includes('{ value: "watch", label: "Watch rank"') && page.includes('{ value: "time", label: "Start time"'), "Upcoming SORT must render as WATCH RANK / START TIME segmented options.");
assert(viewMode.includes('label="View"') && viewMode.indexOf('{ value: "simple", label: "Simple"') < viewMode.indexOf('{ value: "detailed", label: "Detailed"'), "Upcoming VIEW must render as SIMPLE / DETAILED segmented options.");
assert(segmentedControl.includes("data-segmented-control-indicator") && segmentedControl.includes("segmented-control-indicator") && segmentedControl.includes("transition-transform") && segmentedControl.includes("motion-reduce:transition-none"), "Segmented controls must render a sliding indicator that disables motion when reduced motion is requested.");
assert(segmentedControl.includes("bg-zinc-700") && segmentedControl.includes("text-white") && segmentedControl.includes("data-segmented-active-dot") && segmentedControl.includes("inline-flex items-center justify-center gap-1.5 leading-none"), "Segmented controls must use a dark active indicator with white text and a vertically centered active dot.");
assert(segmentedControl.includes("items-center rounded-lg border border-white/10") && segmentedControl.includes("left-1 rounded-md border border-white/10 bg-zinc-700") && segmentedControl.includes("gap-1 rounded-md px-2") && !segmentedControl.includes("items-center rounded-full border border-white/10 bg-black/35") && !segmentedControl.includes("left-1 rounded-full border border-white/10 bg-zinc-700"), "Segmented controls must use less-rounded track and active option corners.");
assert(segmentedControl.includes("cursor-pointer"), "Segmented controls must use the hand cursor for both link and button options.");
assert(segmentedControl.includes('role="group"') && segmentedControl.includes("handleKeyDown") && segmentedControl.includes("ArrowLeft") && segmentedControl.includes("ArrowRight"), "Segmented controls must expose labeled group semantics and arrow-key movement.");
assert(segmentedControl.includes("min-h-11") && segmentedControl.includes("min-h-9"), "Segmented controls must keep touch-friendly 44px tracks.");
assert(viewMode.includes('window.localStorage.getItem(STORAGE_KEY) === "DETAILED" ? "detailed" : "simple"'), "Stored DETAILED preference must restore detailed view while absent storage defaults to SIMPLE.");
assert(viewMode.includes('window.localStorage.setItem(STORAGE_KEY, nextMode === "simple" ? "SIMPLE" : "DETAILED")'), "Toggle must persist SIMPLE/DETAILED values.");
assert(viewMode.includes("try {") && countOccurrences(viewMode, "catch") >= 2, "localStorage reads and writes must be wrapped for blocked storage.");
assert(viewMode.includes('const [mode, setModeState] = useState<UpcomingViewMode>(() => readStoredViewMode());'), "Default view mode must resolve through the guarded storage reader.");
assert(viewMode.includes('const DEFAULT_VIEW_MODE: UpcomingViewMode = "simple";') && viewMode.includes("return DEFAULT_VIEW_MODE;"), "Missing or blocked storage must default to SIMPLE.");
assert(countOccurrences(viewMode, '<div data-upcoming-view-mode-control') === 1, "Only one view-mode control should render.");
assert(viewMode.includes("__ttsUpcomingViewModeClickBridge") && viewMode.includes("document.addEventListener(\"click\"") && viewMode.includes("[data-upcoming-view-mode-control] [data-view-mode-option]"), "View mode toggle must bridge pre-hydration SIMPLE clicks.");
assert(page.includes("data-upcoming-view-mode-init") && page.includes('window.localStorage.getItem("tts.upcoming.view") === "DETAILED" ? "detailed" : "simple"'), "Upcoming page must set the stored view mode before the controls paint and default absent storage to SIMPLE.");
assert(viewMode.includes('document.documentElement.setAttribute("data-upcoming-view-mode-init", mode)') && viewMode.includes('document.documentElement.setAttribute("data-upcoming-view-mode-init", nextMode)'), "View mode updates must keep the pre-paint mode marker in sync.");
assert(globals.includes('html[data-upcoming-view-mode-init="detailed"] [data-upcoming-view-mode-control]') && globals.includes('html[data-upcoming-view-mode-init="detailed"] [data-upcoming-view-storage-key="tts.upcoming.view"] [data-upcoming-view-panel="simple"]'), "Stored DETAILED preference must receive CSS pre-paint overrides to avoid a SIMPLE flash.");

assert(simpleBoard.includes('data-responsive-check="upcoming-simple-board"'), "Simple board must expose a stable test hook.");
assert(viewMode.includes('data-responsive-check="upcoming-simple-card"'), "Simple cards must expose stable test hooks.");
assert(!viewMode.includes("import Link from \"next/link\";") && viewMode.includes("<article") && viewMode.includes('data-simple-card-interaction="static-preview"'), "Simple cards must render as static previews, not whole-card links.");
assert(viewMode.includes("overflow-hidden rounded-lg border border-white/10"), "Simple card containers must use .5rem border radius instead of a pillier card radius.");
assert(viewMode.includes("ariaLabel") && !viewMode.includes("data-simple-details-target"), "Simple card preview must keep an accessible label without a detail target.");
assert(!viewMode.includes("data-upcoming-simple-hover-hint") && !viewMode.includes("&rsaquo;"), "Simple cards must not render the bottom-right arrow hover hint.");
assert(!viewMode.includes("data-upcoming-simple-details") && !viewMode.includes(">Details<"), "Simple cards must not render standalone DETAILS buttons.");
assert(simpleBoard.includes("data-simple-visible-game-pks"), "Simple board must expose game order for parity checks.");
assert(simpleBoard.includes("data-simple-watch-ranks"), "Simple board must expose rank order for parity checks.");
assert(page.includes("sortMode={controls.sort}") && simpleBoard.includes('data-simple-sort-mode={sortMode}'), "Simple cards must receive the active sort mode.");
assert(simpleBoard.includes('data-simple-rank-visible={String(showRank)}') && simpleBoard.includes('const showRank = sortMode === "watch";') && simpleBoard.includes("data-simple-card-rank"), "Simple desktop VS ranks must render only for watch-rank sort.");
assert(simpleBoard.includes("data-simple-watch-score"), "Simple cards must render one hero watch score.");
assert(simpleBoard.includes("data-simple-first-pitch"), "Simple cards must render one first-pitch time.");
assert(simpleBoard.includes("data-upcoming-simple-context"), "Simple cards must render one deterministic context sentence.");
assert(simpleBoard.includes("contextWriteup ?? upcomingSimpleContextSentence") && simpleBoard.includes('data-simple-context-source={contextWriteup ? "stored-llm" : "deterministic-fallback"}'), "Simple cards must render stored LLM writeups when present and deterministic fallback copy otherwise.");
assert(simpleBoard.includes("text-center text-sm") && simpleBoard.includes("lg:text-left"), "Simple context text must stay centered on mobile and left-aligned on desktop.");
assert(simpleBoard.includes("data-simple-context-sentence-count={sentenceCount(sentence)}"), "Simple context copy must expose sentence counts.");
assert(simpleBoard.includes('data-simple-context-has-em-dash={String(sentence.includes("—"))}'), "Simple context sentences must guard against em dash copy.");
assert(simpleBoard.includes('data-simple-context-has-this-one={String(/\\bthis one\\b/i.test(sentence))}'), "Simple context sentences must guard against this-one copy.");
assert(simpleBoard.includes("lg:grid-cols-[repeat(2,minmax(500px,560px))]") && simpleBoard.includes('data-simple-desktop-layout="two-up-vs"'), "Desktop Simple board must render as a centered two-up capped grid.");
assert(simpleBoard.includes("justify-center gap-5") && simpleBoard.includes("sm:gap-4") && simpleBoard.includes("lg:gap-5"), "Simple board must add a little extra spacing between cards on mobile while preserving larger breakpoints.");
assert(simpleBoard.includes("data-simple-card-accent={watchTier.key}") && simpleBoard.includes("simpleCardTint(game.gameWatchScore, accentColor)") && viewMode.includes("data-simple-card-background={background}") && viewMode.includes("data-simple-card-edge-color={accentColor}") && simpleBoard.includes("style={{ color: accentColor }}"), "Simple cards must tint the background, edge, and score by watch band.");
assert(simpleBoard.includes("data-simple-vs-composition") && simpleBoard.includes("data-simple-score-column"), "Desktop Simple cards must keep the VS composition and score-column hooks.");
assert(simpleBoard.includes("lg:grid-cols-[minmax(0,1fr)_104px_minmax(0,1fr)]") && simpleBoard.includes("lg:gap-3"), "Desktop Simple VS cards must keep horizontal breathing room between the center score column and portrait panels.");
assert(simpleBoard.includes("rounded-lg pt-4") && simpleBoard.includes("lg:pt-0"), "Simple VS cards must add mobile-only top spacing above the starter panels.");
assert(!simpleBoard.includes("data-simple-vs-seam") && !simpleBoard.includes("simpleVsGradient") && !simpleBoard.includes("lg:bg-black/25") && !simpleBoard.includes("lg:[background:var(--simple-vs-gradient)]"), "Simple score column must not render the old gradient, center seam, or black overlay.");
assert(simpleBoard.includes("data-simple-vs-mark") && simpleBoard.includes("text-zinc-50") && simpleBoard.includes("drop-shadow"), "Simple VS center column must keep rank, VS, score, and start time visible over the seam.");
assert(simpleBoard.includes("data-simple-confidence-chip={game.watchScoreConfidence}") && simpleBoard.includes("mx-auto mt-4 inline-flex") && !simpleBoard.includes("mx-auto mt-2 inline-flex rounded border border-amber-300/30"), "Simple confidence chip must apply the larger vertical gap on the chip element itself.");
assert(page.includes("data-upcoming-form-window-label") && page.includes("data-form-window={formWindow}") && page.includes("{formWindowLabel(formWindow)}"), "Upcoming toolbar must render the shared FORM: LAST n STARTS label from the active form window.");
assert(simpleBoard.includes('size="simple"'), "Simple starter headshots must use the enlarged simple size.");
assert(simpleBoard.includes("data-simple-starter-frame") && simpleBoard.includes("data-simple-starter-panel-color={panelColor}") && simpleBoard.includes('data-simple-starter-panel-source="three-band"') && simpleBoard.includes("data-simple-starter-nameplate"), "Simple starters must render baseball-card style portrait frames with explicit top, middle, and bottom color bands.");
assert(simpleBoard.includes("data-simple-starter-portrait-zone") && simpleBoard.includes('data-simple-starter-portrait-zone-source="heat-band"') && simpleBoard.includes("simpleStarterHeatZoneGradient(panelColor, align, \"top\")"), "Simple starter portrait surround must use the heat-band color as the top zone.");
assert(simpleBoard.includes('data-simple-starter-nameplate-source="team-color"') && simpleBoard.includes("simpleNameplateGradient(teamColor, align)") && simpleBoard.includes("border-y border-white/20"), "Simple starter nameplate stripe must stay team-colored with a clean edge treatment.");
assert(simpleBoard.includes('data-simple-starter-card-back-source="heat-band"') && simpleBoard.includes("simpleStarterHeatZoneGradient(panelColor, align, \"bottom\")"), "Simple starter bottom stat bar must use the heat-band color.");
assert(simpleBoard.includes("data-simple-portrait-bleed") && simpleBoard.includes("lg:absolute") && simpleBoard.includes("lg:top-0") && simpleBoard.includes("lg:w-full") && !simpleBoard.includes("lg:w-[calc(100)]"), "Desktop Simple portrait panels must bleed toward the top and outer edge at full width.");
assert(simpleBoard.includes("data-simple-mini-stat-line") && simpleBoard.includes("miniStatLine(starter)") && simpleBoard.includes("Starter TBD"), "Simple starter frames must render compact card-back stats and honest TBD placeholders.");
assert(simpleBoard.includes("data-simple-mini-stat-line") && simpleBoard.includes("lg:text-white"), "Simple desktop mini-stat text, including Proj GS+, must render white.");
assert(headshot.includes('starterStatus === "tbd" ? "TBD"') && headshot.includes("{fallbackLabel}"), "TBD starter headshot placeholders must render TBD instead of initials like TN.");
assert(simpleBoard.includes("whitespace-normal") && simpleBoard.includes("break-words") && simpleBoard.includes("function PitcherNameLines") && simpleBoard.includes('className="block"') && !simpleBoard.includes("block truncate text-sm") && !simpleBoard.includes('className="truncate text-sm'), "Simple starter names must render full names on two lines instead of truncating.");
assert(simpleBoard.includes("mt-3") && simpleBoard.includes("data-simple-first-pitch"), "Simple card must add breathing room above first pitch time.");
assert(countExactLineOccurrences(simpleBoard, "data-simple-form-chip") === 1, "Simple starter renderer should create exactly one form chip per starter instance.");
assert(simpleBoard.includes("inline-flex flex-col items-center justify-center") && simpleBoard.includes("sm:flex-row sm:gap-1") && simpleBoard.includes("function SimpleFormChipLabel") && simpleBoard.includes("whitespace-nowrap"), "Simple form chips must stack label over value on mobile and return to inline label/value at larger breakpoints.");
assert(simpleBoard.includes('starter.formStatus === "mlb_debut"') && simpleBoard.includes("MLB DEBUT"), "Simple starter form chip must show MLB DEBUT instead of generic form pending for debut starters.");
assert(simpleBoard.includes("const SIMPLE_EVEN_PANEL_COLOR") && simpleBoard.includes("starterHeatPanelColor") && simpleBoard.includes("data-simple-starter-panel-source=\"three-band\"") && simpleBoard.includes("data-simple-form-chip-color={heatColor}") && simpleBoard.includes("HEAT_BANDS.find"), "Simple starter heat zones must use shared heat-band color tokens.");
assert(!simpleBoard.includes("data-simple-heat-accent"), "Simple starter panels must remove the redundant separate heat-accent stripe once the panel itself carries heat.");
assert(simpleBoard.includes("data-simple-starter-team-color={teamColor}") && simpleBoard.includes("data-simple-orientation"), "Simple starter panels must retain team identity through team telemetry and visible orientation microcopy.");
assert(!simpleBoard.includes("FormSparkline"), "Simple cards must not render sparklines.");
assert(!simpleBoard.includes("FormDriverChips"), "Simple cards must not render pitch-mix or driver chip rows.");
assert(!simpleBoard.includes("projectedStrikeouts") && !simpleBoard.includes("K line"), "Simple cards must not render K-line elements.");
assert(simpleBoard.includes("starter.projection?.projectedGsPlus") && simpleBoard.includes("Proj GS+"), "Simple baseball-card backs may surface a compact projected GS+ stat.");

const retiredSlop = [
  "'s form carries this one",
  "has cooled",
  "Two rising arms in a hitter-friendly park.",
  "Ranked #${rank} on today's board.",
  "Elite matchup: both starters grading plus.",
  "clear separation from",
  "recent shape is the separator",
  "carries this one",
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

assert(context.includes('type MatchupArchetype = "ACE_DUEL"') && context.includes('"CLEAR_EDGE"') && context.includes('"MISMATCH_DOWN"') && context.includes('"COIN_FLIP"') && context.includes('"BOTH_COLD"') && context.includes('"PROVISIONAL"') && context.includes('"TBD"'), "Simple context must classify matchups into required archetypes before writing.");
assert(context.includes("const CLEAR_EDGE_GAP = 8") && context.includes("input.gap < CLEAR_EDGE_GAP && PROHIBITED_SMALL_GAP_CLAIMS.test(sentence)"), "Simple context must prohibit separation-style claims below the clear-edge threshold.");
assert(context.includes("bothTop && gap < CLEAR_EDGE_GAP") && context.includes('archetype: "ACE_DUEL"') && context.includes('input.archetype === "ACE_DUEL"'), "Both-top-band small-gap matchups must use an ace-duel frame.");
assert(context.includes("namedStarters.length < 2") && context.includes('archetype: "TBD"'), "Simple context must explain TBD starter slots without form contrast.");
assert(context.includes("validateSentence(candidate, input)") && context.includes("NARRATIVE_VERBS") && context.includes("numberTokens(sentence)") && context.includes("allowedNumberTokens(input)"), "Simple context must validate voice, narrative claims, and number fidelity before rendering.");
assert(context.includes("restEdgeSignal") && context.includes("trendSplitSignal") && context.includes("marketTotalSignalFor"), "Simple context must include rest, trend, and market-total signals.");
assert(context.includes("wordCount(sentence) > 22") && context.includes('sentence.includes("—")') && context.includes('/\\bthis one\\b/i') && context.includes("sentenceCount(sentence) !== 1"), "Simple context validator must enforce the one-sentence, 22-word, no-em-dash, no-this-one voice rules.");
assert(context.includes("export function validateUpcomingSimpleContextSentence") && context.includes("export function upcomingSimpleContextArchetype"), "Simple context must expose validator/archetype helpers for write-time LLM storage.");

assert(
  writeupsService.includes("OPENAI_API_KEY") &&
    writeupsService.includes("readRuntimeState") &&
    writeupsService.includes("writeRuntimeState") &&
    writeupsService.includes("getTonightMustWatch({ date, window: 5, forceOpponentSplits: true })") &&
    writeupsService.includes("inputHash") &&
    writeupsService.includes("UPCOMING_WRITEUPS_PROMPT_VERSION") &&
    writeupsService.includes("buildUpcomingFactPackets") &&
    writeupsService.includes("factPacket: MatchupFactPacket") &&
    writeupsService.includes('source: "form-service" | "odds-feed"') &&
    writeupsService.includes("getPitcherForm(starter.pitcherId, { window: 5 })") &&
    writeupsService.includes("starterVenueHistoryFact") &&
    writeupsService.includes("starterSeasonBestFact") &&
    writeupsService.includes("starterStreakFact") &&
    writeupsService.includes("starterStrikeoutLineFact") &&
    writeupsService.includes("highest on the slate") &&
    writeupsService.includes("MAX_FACTS_PER_MATCHUP = 2") &&
    writeupsService.includes("validateFactTrace(clean, input)") &&
    writeupsService.includes("hasLlmWriteupsForGames") &&
    writeupsService.includes('sources: Record<string, "llm" | "fallback">') &&
    writeupsService.includes('sources[game.gamePk] = generated ? "llm" : "fallback"') &&
    writeupsService.includes('state.sources?.[gamePk] === "llm"') &&
    writeupsService.includes("MAX_GENERATION_ATTEMPTS") &&
    writeupsService.includes("OPENAI_RESPONSES_URL") &&
    writeupsService.includes("Every number must appear exactly in the input.") &&
    writeupsService.includes("normalizeGeneratedSentence") &&
    writeupsService.includes("validateGeneratedUpcomingText") &&
    writeupsService.includes("validateUpcomingSimpleContextSentence") &&
    writeupsService.includes("upcomingSimpleContextSentence(game, index + 1, slate.leagueMeanGS)") &&
    writeupsService.includes("AbortSignal.timeout") &&
    !simpleBoard.includes("OPENAI_API_KEY"),
  "Upcoming LLM writeups must generate off the request path, store by input hash, inject traceable fact packets, validate output, and fall back to deterministic copy without client/request-path key usage.",
);

assert(
  writeupsCron.includes("generateUpcomingWriteupsForDate(date)") &&
    writeupsCron.includes("CRON_SECRET") &&
    vercelConfig.includes('"/api/cron/upcoming-writeups"') &&
    vercelConfig.includes('"20 */6 * * *"'),
  "Upcoming LLM writeups must run from an authorized low-cadence cron to avoid unnecessary API spend.",
);

const phraseBankMatches = context.match(/\[[^\]]+\]/gs) ?? [];
const signalPhraseGroups = phraseBankMatches.filter((group) => (group.match(/"/g) ?? []).length >= 8);
assert(signalPhraseGroups.length >= 7, "Simple context phrase banks must provide varied archetype and secondary structures.");

console.log("upcoming simple view contract ok");

function countOccurrences(source, needle) {
  return source.split(needle).length - 1;
}

function countExactLineOccurrences(source, needle) {
  return source.split(/\r?\n/).filter((line) => line.trim() === needle).length;
}
