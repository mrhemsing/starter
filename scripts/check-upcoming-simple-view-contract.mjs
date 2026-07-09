import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const page = await readFile("src/app/upcoming/[date]/page.tsx", "utf8");
const weekPage = await readFile("src/app/upcoming/week/[startDate]/page.tsx", "utf8");
const viewMode = await readFile("src/components/upcoming-view-mode.tsx", "utf8");
const segmentedControl = await readFile("src/components/segmented-control.tsx", "utf8");
const simpleBoard = await readFile("src/components/upcoming-simple-board.tsx", "utf8");
const detailedBoard = await readFile("src/components/tonights-must-watch.tsx", "utf8");
const watchlistPage = await readFile("src/app/watchlist/page.tsx", "utf8");
const liveScoreboard = await readFile("src/components/live-scoreboard.tsx", "utf8");
const limitedSampleChip = await readFile("src/components/limited-sample-form-chip.tsx", "utf8");
const context = await readFile("src/lib/upcoming-simple-context.ts", "utf8");
const writeupsService = await readFile("src/lib/data/upcoming-writeups-service.ts", "utf8");
const writeupsCron = await readFile("src/app/api/cron/upcoming-writeups/route.ts", "utf8");
const vercelConfig = await readFile("vercel.json", "utf8");
const headshot = await readFile("src/components/headshot.tsx", "utf8");
const globals = await readFile("src/app/globals.css", "utf8");

assert(page.includes("<UpcomingViewModeProvider>"), "Upcoming page must wrap toolbar and board in one view-mode provider.");
assert(page.includes('viewModeToggle={<UpcomingViewModeToggle />}'), "Upcoming toolbar must render the simple/detailed toggle inside the existing controls.");
assert(page.includes("<UpcomingViewModePanels") && page.includes("<TonightsMustWatch") && page.includes("<UpcomingSimpleBoard"), "Upcoming board must switch between detailed and simple panels without changing data.");
assert(weekPage.includes("<UpcomingViewModeProvider>") && weekPage.includes('viewModeToggle={<UpcomingViewModeToggle />}') && weekPage.includes("<UpcomingViewModePanels") && weekPage.includes("<UpcomingSimpleBoard") && weekPage.includes("data-upcoming-week-simple-board"), "Upcoming week page must include the same Simple/Detailed view toggle and per-day Simple boards.");
assert(weekPage.includes("dateLabel={formatUpcomingDate(day.date)}") && weekPage.includes("showCardDate"), "Upcoming week Simple view must pass each day label and render per-card dates for multi-day slates.");
assert(!page.includes("viewMode="), "Upcoming simple mode must not be URL-backed.");
assert(page.includes('import { readUpcomingWriteups } from "@/lib/data/upcoming-writeups-service";') && page.includes("readUpcomingWriteups(date)") && page.includes("contextWriteups={contextWriteups}"), "Upcoming page must only read stored LLM writeups during render and pass them to Simple cards.");

assert(viewMode.includes('const STORAGE_KEY = "tts.upcoming.view";'), "Upcoming view preference must use the namespaced storage key.");
assert(page.includes('import { SegmentedControl } from "@/components/segmented-control";'), "Upcoming SORT must use the shared segmented-control primitive.");
assert(!page.includes('import { formWindowLabel } from "@/lib/form-tokens";'), "Upcoming board must drop the persistent FORM: LAST n STARTS caption.");
assert(viewMode.includes('import { SegmentedControl } from "@/components/segmented-control";'), "Upcoming VIEW must use the shared segmented-control primitive.");
assert(page.includes('label="Sort"') && page.indexOf('{ value: "time", label: "Start time"') < page.indexOf('{ value: "watch", label: "Watch rank"') && page.includes('sort: params?.sort === "watch" ? "watch" : "time"') && page.includes('if (controls.sort !== "time") params.set("sort", controls.sort);'), "Upcoming SORT must render START TIME before WATCH RANK and default to START TIME.");
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
assert(viewMode.includes("<article") && viewMode.includes('data-simple-card-interaction="whole-card-link"') && viewMode.includes("data-simple-card-link") && viewMode.includes('href={`#upcoming-game-${gamePk}`}'), "Simple cards must link the whole card to the detailed matchup anchor, not standalone details actions.");
assert(viewMode.includes("border-y border-white/10") && viewMode.includes("sm:rounded-lg sm:border"), "Simple card containers must be full-bleed hairline cards on mobile and rounded cards on desktop.");
assert(viewMode.includes("ariaLabel") && !viewMode.includes("data-simple-details-target"), "Simple card preview must keep an accessible label without a detail target.");
assert(!viewMode.includes("data-upcoming-simple-hover-hint") && !viewMode.includes("&rsaquo;"), "Simple cards must not render the bottom-right arrow hover hint.");
assert(!viewMode.includes("data-upcoming-simple-details") && !viewMode.includes(">Details<"), "Simple cards must not render standalone DETAILS buttons.");
assert(simpleBoard.includes("data-simple-visible-game-pks"), "Simple board must expose game order for parity checks.");
assert(simpleBoard.includes("data-simple-watch-ranks"), "Simple board must expose rank order for parity checks.");
assert(
  simpleBoard.includes("function simpleDateGroups") &&
    simpleBoard.includes("data-upcoming-simple-date-group") &&
    simpleBoard.includes("data-upcoming-simple-date-header") &&
    simpleBoard.includes("data-simple-date-header-label={label}") &&
    simpleBoard.includes("groups.sort((a, b) => a.date.localeCompare(b.date))") &&
    simpleBoard.includes("data-simple-date-groups={dateGroups.length ? dateGroups.map((group) => group.date).join(\",\") : \"none\"}") &&
    simpleBoard.includes("data-simple-date-header-labels={dateHeaderLabels.length ? dateHeaderLabels.join(\"|\") : \"none\"}"),
  "Simple board must group cards by game date and expose date-header parity hooks.",
);
assert(
  simpleBoard.includes("function formatSimpleCardDate") &&
    simpleBoard.includes("data-simple-card-date") &&
    simpleBoard.includes("data-simple-card-date-source={game.date}") &&
    simpleBoard.includes("data-simple-card-date-visible={String(showCardDate)}") &&
    page.includes("dateLabel={formatUpcomingSectionDate(resolvedDate)}"),
  "Simple cards must support per-card dates for multi-day views while single-day pages keep a date group header.",
);
assert(page.includes("sortMode={controls.sort}") && simpleBoard.includes('data-simple-sort-mode={sortMode}'), "Simple cards must receive the active sort mode.");
assert(simpleBoard.includes('data-simple-rank-visible={String(showRankSlot)}') && simpleBoard.includes('const showRankSlot = sortMode === "watch";') && simpleBoard.includes('const rankLabelText = hasNamedStarterMatchup ? `#${rank}` : "--";') && simpleBoard.includes("data-simple-card-rank") && simpleBoard.includes("function hasNamedStarters"), "Simple desktop VS rank slots must render only for watch-rank sort and dash TBD matchups.");
assert(simpleBoard.includes("data-simple-watch-score"), "Simple cards must render one hero watch score.");
assert(simpleBoard.includes("data-simple-first-pitch"), "Simple cards must render one first-pitch time.");
assert(simpleBoard.includes('className="hidden sm:inline" aria-hidden="true"> / </span>') && simpleBoard.includes('className="hidden sm:inline" data-simple-ballpark') && simpleBoard.includes("data-simple-ballpark-source={game.park}") && simpleBoard.includes("formatSimpleBallpark(game.park)") && simpleBoard.includes('return trimmed.length > 0 ? trimmed.toUpperCase() : "VENUE TBD";'), "Simple card headers must render the game ballpark next to first pitch on sm+ while hiding the slash and ballpark on mobile.");
assert(simpleBoard.includes("data-upcoming-simple-context"), "Simple cards must render one deterministic context sentence.");
assert(simpleBoard.includes("upcomingSimpleContextSentencesForSlate") && simpleBoard.includes("fallbackContextSentences") && simpleBoard.includes("contextWriteup ?? fallbackContextSentence ?? upcomingSimpleContextSentence") && simpleBoard.includes('data-simple-context-source={contextWriteup ? "stored-llm" : "deterministic-fallback"}'), "Simple cards must render stored LLM writeups when present and slate-deduped deterministic fallback copy otherwise.");
assert(simpleBoard.includes("text-left text-base") && !simpleBoard.includes("text-center text-base") && !simpleBoard.includes("text-center font-serif") && !simpleBoard.includes("lg:text-left"), "Simple context text must render left-aligned in the body copy face at the card foot.");
assert(simpleBoard.includes("data-simple-context-sentence-count={sentenceCount(sentence)}"), "Simple context copy must expose sentence counts.");
assert(simpleBoard.includes('data-simple-context-has-em-dash={String(sentence.includes("—"))}'), "Simple context sentences must guard against em dash copy.");
assert(simpleBoard.includes('data-simple-context-has-this-one={String(/\\bthis one\\b/i.test(sentence))}'), "Simple context sentences must guard against this-one copy.");
assert(simpleBoard.includes("lg:grid-cols-[repeat(2,minmax(500px,560px))]") && simpleBoard.includes('data-simple-desktop-layout="two-up-vs"'), "Desktop Simple board must render as a centered two-up capped grid.");
assert(simpleBoard.includes("justify-center gap-3") && simpleBoard.includes("sm:gap-4") && simpleBoard.includes("lg:gap-5") && simpleBoard.includes('cardClassName="mb-4 sm:mb-0"'), "Simple board must keep mobile breathing room under and between cards while preserving larger breakpoint spacing.");
assert(simpleBoard.includes("data-upcoming-simple-date-groups-wrapper") && simpleBoard.includes("pb-8") && simpleBoard.includes("sm:pb-10") && simpleBoard.includes("lg:pb-12") && simpleBoard.includes("data-upcoming-simple-card-list"), "Simple board date-group wrapper must leave bottom breathing room on mobile and desktop.");
assert(simpleBoard.includes("data-simple-card-accent={watchTier.key}") && simpleBoard.includes("simpleCardTint(game.gameWatchScore, accentColor)") && viewMode.includes("data-simple-card-background={background}") && viewMode.includes("data-simple-card-edge-color={accentColor}") && simpleBoard.includes('style={{ color: hasNamedStarterMatchup ? accentColor : "#888780" }}'), "Simple cards must tint named matchup scores by watch band and show TBD matchup dashes in neutral.");
assert(simpleBoard.includes("data-simple-header-band") && simpleBoard.includes("data-simple-header-left") && simpleBoard.includes("<span aria-hidden=\"true\" />") && simpleBoard.includes("data-upcoming-simple-score") && simpleBoard.indexOf("data-upcoming-simple-score") > simpleBoard.indexOf("data-simple-diagonal-panels"), "Simple header must contain rank, time, and ballpark grouped on the left, with score moved out of the header.");
assert(simpleBoard.includes("grid-cols-2") && simpleBoard.includes('data-simple-seam-layout="single-opaque-bar"') && simpleBoard.includes("data-simple-score-seam-column") && simpleBoard.includes('data-simple-score-seam-bar="single-opaque"') && simpleBoard.includes('data-simple-score-seam-bar-width="26%"') && simpleBoard.includes("w-[26%]") && simpleBoard.includes("min-w-[94px]") && simpleBoard.includes("max-w-[110px]") && simpleBoard.includes("bg-[#08080c]") && simpleBoard.includes("px-3") && simpleBoard.includes("sm:px-2") && simpleBoard.includes("text-[32px]") && simpleBoard.includes("sm:text-[42px]") && simpleBoard.includes("data-simple-watch-score>{scoreLabel}</p>") && simpleBoard.includes('const scoreLabel = hasNamedStarterMatchup ? game.gameWatchScore.toFixed(1) : "--";'), "Simple cards must render the watch score in a single opaque 24-28% seam bar between portrait cells, with smaller padded mobile score type and dash TBD matchups.");
assert(simpleBoard.includes("data-simple-heat-strip") && simpleBoard.includes("simpleHeatStripGradient(awayHeatColor, homeHeatColor)") && simpleBoard.includes("data-simple-heat-strip-away-color") && simpleBoard.includes("data-simple-heat-strip-home-color"), "Simple cards must open with a four-pixel heat strip based on both starter heat colors.");
assert(!simpleBoard.includes("data-simple-ghost-rank") && !simpleBoard.includes("opacity-[0.05]"), "Simple cards must not render the decorative back-rank numeral behind the header.");
assert(simpleBoard.includes("data-simple-diagonal-panels") && simpleBoard.includes('data-simple-score-seam-bar="single-opaque"') && simpleBoard.includes("clipPath") && simpleBoard.includes("polygon(") && simpleBoard.includes('data-simple-panel-clip-path="none"') && simpleBoard.includes('data-simple-panel-overlap="none"') && !simpleBoard.includes("data-simple-vs-pin") && !simpleBoard.includes("-ml-4") && !simpleBoard.includes("-mr-4"), "Simple cards must use one opaque diagonal seam bar over unclipped, non-overlapping portrait panels and remove the diamond seam pin.");
assert(simpleBoard.includes("data-simple-vs-text") && simpleBoard.includes(">vs.</p>") && simpleBoard.includes("text-[12px] lowercase"), "Simple cards must render a centered lowercase vs. label beneath the seam score.");
assert(simpleBoard.includes("simplePortraitPanelGradient(panelColor)") && simpleBoard.includes("linear-gradient(0deg") && simpleBoard.includes("0.82") && simpleBoard.includes("100%"), "Simple portrait panels must use heat-only ember gradients strongest at the bottom.");
assert(simpleBoard.includes("data-simple-confidence-chip={game.watchScoreConfidence}") && simpleBoard.includes("mx-auto mt-2 inline-flex"), "Simple confidence chip must live in the seam score column.");
assert(!page.includes("data-upcoming-form-window-label") && !page.includes("{formWindowLabel(formWindow)}"), "Upcoming toolbar must not render the old global FORM: LAST n STARTS caption.");
assert(simpleBoard.includes('size="simple"'), "Simple starter headshots must use the enlarged simple size.");
assert(simpleBoard.includes("h-[128px]") && simpleBoard.includes("w-[128px]") && simpleBoard.includes("rounded-none") && simpleBoard.includes("[&_.headshot__img]:object-cover"), "Simple headshots must be square, sharp-cornered, and at least 128px on mobile.");
assert(headshot.includes('suppressThermalBackground || size === "simple"') && headshot.includes('background: shouldSuppressThermalBackground ? "transparent" : thermalBackground(resolvedBand)') && simpleBoard.includes("suppressThermalBackground"), "Simple fight-card headshot containers must suppress the inline thermal background gradient.");
assert(/\.thermal-headshot\s*\{[^}]*box-shadow:\s*none;/s.test(globals), "Thermal headshot containers must not render a global box shadow.");
assert(simpleBoard.includes("data-simple-starter-panel-color={panelColor}") && simpleBoard.includes('data-simple-starter-panel-source="heat-band"') && !simpleBoard.includes("data-simple-starter-nameplate"), "Simple starters must drop the old three-band/nameplate treatment and use heat panels.");
assert(simpleBoard.includes("data-simple-starter-portrait-zone") && simpleBoard.includes('data-simple-starter-portrait-zone-source="heat-band"'), "Simple starter portrait surround must use heat-band color.");
assert(!simpleBoard.includes("simpleNameplateGradient") && !simpleBoard.includes('data-simple-starter-nameplate-source="team-color"') && !simpleBoard.includes("teamAccentColor("), "Simple cards must not use team-colored nameplates or team color tokens.");
assert(simpleBoard.includes('data-simple-starter-card-back-source="heat-band"') && simpleBoard.includes("data-simple-identity-strip"), "Simple identity/form strip must replace the old card-back/nameplate stack.");
assert(simpleBoard.includes("data-simple-portrait-bleed") && !simpleBoard.includes("lg:w-[calc(100)]"), "Simple portrait panels must retain portrait bleed hooks without invalid width utilities.");
assert(simpleBoard.includes("data-simple-mini-stat-line") && simpleBoard.includes("miniStatLine(starter)") && simpleBoard.includes("Starter TBD"), "Simple starter frames must render compact card-back stats and honest TBD placeholders.");
assert(simpleBoard.includes("data-simple-form-promoted-value") && simpleBoard.includes("text-[26px]") && simpleBoard.includes("formBandValueColor(formBand, qualifiedSample)") && !simpleBoard.includes("data-simple-form-promoted-whisper"), "Simple form strips must promote form GS+ beside the name without repeating the heat-band whisper under the score.");
assert(
  simpleBoard.includes("data-simple-mini-stat-line") &&
    simpleBoard.includes("data-simple-form-microline-text={formMicroLine(starter)}") &&
    simpleBoard.includes("function SimpleFormMicroLine") &&
    simpleBoard.includes('className="hidden sm:inline"> · </span>') &&
    simpleBoard.includes('className="block sm:inline" data-simple-form-mobile-break-before-proj') &&
    simpleBoard.includes("PROJ ${projected.toFixed(1)}"),
  "Simple form strips must keep desktop L5 ERA dot PROJ inline while forcing a mobile line break before PROJ.",
);
assert(headshot.includes('starterStatus === "tbd" ? "TBD"') && headshot.includes("{fallbackLabel}"), "TBD starter headshot placeholders must render TBD instead of initials like TN.");
assert(simpleBoard.includes("whitespace-normal") && simpleBoard.includes("break-words") && simpleBoard.includes("function PitcherNameLines") && simpleBoard.includes('className="block"') && !simpleBoard.includes("block truncate text-sm") && !simpleBoard.includes('className="truncate text-sm'), "Simple starter names must render full names on two lines instead of truncating.");
assert(simpleBoard.includes("data-simple-name-band-label") && simpleBoard.includes('data-simple-name-band-label-align="bottom"') && simpleBoard.includes("simpleStarterBandLabel(starter, formBand)") && simpleBoard.includes("inline-flex items-end gap-2") && simpleBoard.includes("text-[12px] uppercase leading-none tracking-[0.12em] text-zinc-500") && simpleBoard.includes('className="whitespace-nowrap leading-none"'), "Simple starter names must show the heat-band whisper label underneath the pitcher name with the mobile score and label bottom-aligned without wrapping.");
assert(simpleBoard.includes("data-simple-mobile-form-value") && simpleBoard.includes('className="font-semibold tabular-nums sm:hidden"') && simpleBoard.includes('style={{ color: valueColor }}') && simpleBoard.includes("data-simple-name-band-label") && simpleBoard.indexOf("data-simple-mobile-form-value") < simpleBoard.indexOf("{bandLabel}"), "Simple mobile starter labels must place the colored form score immediately before the heat-band whisper under the pitcher name.");
assert(simpleBoard.includes('className={`hidden sm:block ${align === "home" ? "text-left" : "text-right"}`}') && simpleBoard.includes("grid grid-cols-1 items-start gap-2") && simpleBoard.includes("sm:grid-cols-[54px_minmax(0,1fr)]"), "Simple cards must hide the promoted side score on mobile while preserving the side-by-side score/name row from sm upward.");
assert(simpleBoard.includes("data-simple-header-left") && simpleBoard.includes("data-simple-card-rank") && simpleBoard.includes("data-simple-first-pitch") && simpleBoard.indexOf("data-simple-first-pitch") > simpleBoard.indexOf("data-simple-card-rank") && simpleBoard.includes("flex min-w-0 items-start gap-2"), "Simple header must place first-pitch time on the left beside the match rank.");
assert(simpleBoard.includes('data-simple-card-rank-tone={hasNamedStarterMatchup ? "ranked" : "muted"}') && simpleBoard.includes('hasNamedStarterMatchup ? "text-white" : "text-zinc-400"') && !simpleBoard.includes('rank === 1 && hasNamedStarterMatchup ? "text-white"'), "Simple header must render every named matchup rank in white while TBD dash ranks remain gray.");
assert(countExactLineOccurrences(simpleBoard, "data-simple-form-line") === 1, "Simple starter renderer should create exactly one shared form line per starter instance.");
assert(simpleBoard.includes("simpleStarterBandLabel(starter, formBand)") && simpleBoard.includes("formBandWhisperLabel(formBand, Boolean(formBand))") && simpleBoard.includes("formLineEraText(starter.seasonStats?.era)") && !simpleBoard.includes("<FormValueWhisperLine"), "Simple form block must reuse shared band/limited tokens while moving the value out of the microline.");
assert(simpleBoard.includes('starter.formStatus === "mlb_debut"') && simpleBoard.includes('"DEBUT"'), "Simple starter name band must show a debut whisper instead of generic form pending for debut starters.");
assert(limitedSampleChip.includes('export const LIMITED_SAMPLE_FORM_LABEL = "LTD";') && limitedSampleChip.includes('export const LIMITED_SAMPLE_FORM_COLOR = "#71717a";'), "Limited-sample card chips must reuse the Heat Check LTD token and neutral color.");
assert(limitedSampleChip.includes("WATCH_SCORE_CONFIDENCE_MIN_QUALIFIED") && limitedSampleChip.includes("hasQualifiedStarterFormSample") && limitedSampleChip.includes("hasQualifiedFormSummarySample"), "Limited-sample card qualification must use the shared confidence threshold helper, not a local threshold.");
assert(limitedSampleChip.includes("export function FormValueWhisperLine") && limitedSampleChip.includes("formBandWhisperLabel") && limitedSampleChip.includes("formLineEraText") && limitedSampleChip.includes("L${window} ERA"), "Colored value plus whisper plus Ln ERA must be one shared component.");
assert(simpleBoard.includes("hasQualifiedStarterFormSample(starter) ? starter.tier ?? null : null") && simpleBoard.includes('data-simple-form-line-source={formBand ? "heat-band" : starter.formStatus === "ok" ? "limited-sample" : starter.formStatus}'), "Simple cards must render limited-sample arms as neutral LTD whisper lines, not FORM pseudo-bands.");
assert(!simpleBoard.includes('const label = formBand ? heatBandLabel(formBand) : "Form";'), "Simple limited-sample chips must not fall back to the old FORM label.");
assert(detailedBoard.includes("hasQualifiedStarterFormSample(starter) && starter.rgs !== undefined && starter.tier") && detailedBoard.includes("<FormValueWhisperLine value={starter.rgs}") && detailedBoard.includes("return hasQualifiedStarterFormSample(starter) && Boolean(starter.spark?.length && starter.tier);"), "Detailed Upcoming cards must gate band lines, sparklines, and limited labels through the shared whisper treatment.");
assert(watchlistPage.includes("hasQualifiedFormSummarySample(entry)") && watchlistPage.includes("<FormValueWhisperLine") && watchlistPage.includes("LIMITED_SAMPLE_FORM_COLOR"), "Watchlist cards must use the shared whisper line and neutral color for limited-sample form slots.");
assert(liveScoreboard.includes('import { UpcomingSimpleCard, UpcomingSimpleCardGrid } from "@/components/upcoming-simple-board";') && liveScoreboard.includes('data-live-pregame-simple-card="true"') && liveScoreboard.includes('<UpcomingSimpleCardGrid data-live-pregame-first-up-grid="true" data-live-pregame-first-up-count={firstUpGames.length}>') && liveScoreboard.includes('<UpcomingSimpleCard key={firstUpGame.gamePk} game={firstUpGame} rank={index + 1} leagueMeanGS={slate.leagueMeanGS} rankLabel={slate.headerLabel.toLowerCase()} sortMode="time" />'), "Live pregame cards must reuse the shared Simple card and grid so band labels and LTD limited-sample labels stay aligned with Upcoming.");
assert(simpleBoard.includes("const SIMPLE_EVEN_PANEL_COLOR") && simpleBoard.includes("starterHeatPanelColor") && simpleBoard.includes('data-simple-starter-panel-source="heat-band"') && simpleBoard.includes("data-simple-form-line-color={heatColor}") && simpleBoard.includes("HEAT_BANDS.find"), "Simple starter heat zones must use shared heat-band color tokens.");
assert(!simpleBoard.includes("data-simple-heat-accent"), "Simple starter panels must remove the redundant separate heat-accent stripe once the panel itself carries heat.");
assert(!simpleBoard.includes("data-simple-starter-team-color") && simpleBoard.includes("data-simple-orientation"), "Simple starter panels must retain team identity through visible orientation microcopy without team-color telemetry.");
assert(!simpleBoard.includes("FormSparkline"), "Simple cards must not render sparklines.");
assert(!simpleBoard.includes("FormDriverChips"), "Simple cards must not render pitch-mix or driver chip rows.");
assert(!simpleBoard.includes("projectedStrikeouts") && !simpleBoard.includes("K line"), "Simple cards must not render K-line elements.");
assert(simpleBoard.includes("starter.projection?.projectedGsPlus") && simpleBoard.includes("PROJ"), "Simple baseball-card backs may surface a compact projected GS+ stat.");
assert(!/text-\[(?:8|9|10|11)px\]/.test(simpleBoard), "Simple fight-card text utilities must keep a 12px floor.");

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
assert(context.includes("wordCount(sentence) > 24") && context.includes('sentence.includes("—")') && context.includes('/\\bthis one\\b/i') && context.includes("sentenceCount(sentence) !== 1"), "Simple context validator must enforce the one-sentence, 24-word, no-em-dash, no-this-one voice rules.");
assert(context.includes("export function validateUpcomingSimpleContextSentence") && context.includes("export function upcomingSimpleContextArchetype") && context.includes("export function upcomingSimpleContextSentencesForSlate"), "Simple context must expose validator/archetype helpers and slate-deduped fallback generation for write-time LLM storage.");
assert(
  context.includes("namedStarters.find(isProvisionalStarter)") &&
    context.includes("namedStarters.some(isProvisionalStarter)") &&
    context.includes("function isProvisionalStarter(starter: TonightStarter)") &&
    context.includes("starter.flags?.limitedSample === true") &&
    context.includes("validateAttributedClaims(sentence, input)") &&
    context.includes("containsNameToken(normalized, last)") &&
    context.includes("function escapeRegExp(value: string)") &&
    context.includes("thin sample") &&
    context.includes("!isProvisionalStarter(subject)"),
  "Simple context must bind provisional/thin-sample claims to the starter whose limitedSample or limited status is actually true.",
);

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
    writeupsService.includes("hasUsableWriteupsForGames") &&
    writeupsService.includes('sources: Record<string, "llm" | "fallback">') &&
    writeupsService.includes("const acceptedGenerated = Boolean(generated)") &&
    writeupsService.includes('sources[game.gamePk] = acceptedGenerated ? "llm" : "fallback"') &&
    writeupsService.includes("Object.entries(state.writeups).filter(([, text]) => text.trim().length > 0)") &&
    writeupsService.includes("MAX_GENERATION_ATTEMPTS") &&
    writeupsService.includes("OPENAI_RESPONSES_URL") &&
    writeupsService.includes("Every number must appear exactly in the input.") &&
    writeupsService.includes("normalizeGeneratedSentence") &&
    writeupsService.includes("validateGeneratedUpcomingText") &&
    writeupsService.includes("validateUpcomingSimpleContextSentence") &&
    writeupsService.includes("upcomingSimpleContextSentencesForSlate(slate.games, slate.leagueMeanGS)") &&
    writeupsService.includes("upcomingSimpleContextSentence(game, index + 1, slate.leagueMeanGS)") &&
    writeupsService.includes("AbortSignal.timeout") &&
    writeupsService.includes("const UPCOMING_WRITEUPS_VERSION = 7;") &&
    writeupsService.includes("const UPCOMING_WRITEUPS_PROMPT_VERSION = 14;") &&
    writeupsService.includes("generatedAtByGame") &&
    writeupsService.includes("UPCOMING_WRITEUPS_REGENERATION_EPOCH") &&
    writeupsService.includes("limitedSample: starter.flags?.limitedSample === true") &&
    writeupsService.includes("limitedSample is true") &&
    !simpleBoard.includes("OPENAI_API_KEY"),
  "Upcoming LLM writeups must generate off the request path, store by input hash, inject traceable fact packets including limited-sample ownership, validate output, and fall back to deterministic copy without client/request-path key usage.",
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
