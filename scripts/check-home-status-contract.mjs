import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const [
  homePage,
  startsPage,
  slateState,
  startService,
  slateCounts,
  liveNavLabel,
  siteNav,
  statusRoute,
  scoreComponentList,
  slateSyncScript,
  slateSyncCron,
  packageJson,
  vercelConfig,
  methodologyPage,
  homeDeferredSections,
  gsPlusCopy,
  methodologyContent,
  homeGsPlusProofService,
  homeGsPlusProofCron,
] = await Promise.all([
  readFile("src/app/page.tsx", "utf8"),
  readFile("src/app/starts/[id]/page.tsx", "utf8"),
  readFile("src/lib/slate-state.ts", "utf8"),
  readFile("src/lib/data/start-service.ts", "utf8"),
  readFile("src/components/slate-counts.tsx", "utf8"),
  readFile("src/components/live-nav-label.tsx", "utf8"),
  readFile("src/components/site-nav.tsx", "utf8"),
  readFile("src/app/api/home/status/route.ts", "utf8"),
  readFile("src/components/score-component-list.tsx", "utf8"),
  readFile("scripts/check-slate-sync.mjs", "utf8"),
  readFile("src/app/api/cron/slate-sync/route.ts", "utf8"),
  readFile("package.json", "utf8"),
  readFile("vercel.json", "utf8"),
  readFile("src/app/methodology/page.tsx", "utf8"),
  readFile("src/components/home-deferred-sections.tsx", "utf8"),
  readFile("src/lib/gs-plus-copy.ts", "utf8"),
  readFile("src/lib/methodology-content.ts", "utf8"),
  readFile("src/lib/data/home-gs-plus-proof-service.ts", "utf8"),
  readFile("src/app/api/cron/home-gs-plus-proofs/route.ts", "utf8"),
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
    slateState.includes("const completedStartCount = Math.min(totalStarts, Math.max(0, completedStarts));") &&
    slateState.includes('state: "reconciling"') &&
    slateState.includes("const completedStartsInLiveGames = Math.min(liveGames * 2, Math.max(0, completedStartCount - completedStartsInFinalGames));") &&
    slateState.includes("const liveStartCount = Math.max(0, liveGames * 2 - completedStartsInLiveGames);"),
  "homepage slate state must count starter outings from settled starter lines and expose a reconciling state instead of manufacturing completion",
);

assert(
  slateState.includes('state: "starts-in-progress"') &&
    slateState.includes('state: "reconciling"') &&
    slateState.includes('return `Today · ${state.liveStarts} live · ${state.completedStarts} of ${state.totalStarts} starts final`;') &&
    !slateState.includes('return `TODAY · ${state.liveGames} LIVE') &&
    slateState.includes('return `${todayDateLabel} · ${state.completedStarts} of ${state.totalStarts} starts final`;'),
  "homepage in-progress line must render live and completed starts",
);

assert(
  slateState.includes('state: "all-starts-complete"') &&
    slateState.includes('return `${todayDateLabel} · all ${state.totalStarts} starts final`;'),
  "homepage all-final line must render completed starts",
);

assert(
  slateState.includes('return `${dateLabel} · no games today`;'),
  "homepage no-games line must render the off-day state",
);

assert(
  slateState.includes('const todayDateLabel = `Today · ${dateLabel}`;') &&
    slateState.includes('return `${todayDateLabel} · First starter toes the slab ${countdown}`;'),
  "homepage pre-first-pitch line must use Today, date, and first starter countdown copy",
);

assert(
  !slateState.includes(".format(parsed).toUpperCase()"),
  "homepage status date label must not force uppercase month text",
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
    slateState.includes('state.countdownLabel === "STARTING SOON"') &&
    slateState.includes('state.countdownLabel === "DELAYED"') &&
    slateState.includes('return `${totalMinutes} ${pluralizeTimeUnit(totalMinutes, "minute", "minutes")}`;') &&
    slateState.includes('return `${hours} ${hourLabel} ${minutes} ${pluralizeTimeUnit(minutes, "minute", "minutes")}`;') &&
    slateState.includes('function pluralizeTimeUnit') &&
    !slateState.includes("totalSeconds"),
  "homepage countdown must use full minute/hour labels with starting-soon and delayed guards",
);

assert(
  slateCounts.includes("const SLATE_COUNTS_POLL_MS = 30_000;") &&
    slateCounts.includes('import { useRouter } from "next/navigation";') &&
    slateCounts.includes("const router = useRouter();") &&
    slateCounts.includes("void refresh();") &&
    slateCounts.includes("let refreshedStaleShell = false;") &&
    slateCounts.includes('const statusPath = variant === "home" ? "/api/home/status" : `/api/home/status?date=${encodeURIComponent(initialState.date)}`;') &&
    slateCounts.includes('if (variant === "home" && nextState.date !== initialState.date && !refreshedStaleShell)') &&
    slateCounts.includes("router.refresh();") &&
    slateCounts.includes("if (shouldContinuePolling)") &&
    slateCounts.includes("window.setTimeout(refresh, SLATE_COUNTS_POLL_MS)") &&
    !slateCounts.includes("window.setInterval(refresh"),
  "shared slate counts island must mount-poll immediately, let home refresh to the current date, refresh stale ISR shells, and continue only while live starts remain",
);

assert(
  slateCounts.includes('window.setInterval(updateCountdown, 60 * 1000)') && !slateCounts.includes("window.setInterval(updateCountdown, 1000)"),
  "homepage countdown must not tick every second",
);

assert(
  homePage.includes('import { SlateCounts } from "@/components/slate-counts";') &&
    startsPage.includes('import { SlateCounts } from "@/components/slate-counts";') &&
    homePage.includes('<HomeHeroStateBanner slateStatus={slateStatus} liveLeaderboard={ranked?.liveLeaderboard ?? null} />') &&
    homePage.includes('<SlateCounts initialState={slateStatus} variant="home" className="mb-0" />') &&
    homePage.indexOf("data-home-hero-why-line") < homePage.indexOf("Methodology") &&
    homePage.indexOf("Methodology") < homePage.indexOf("HomeHeroStateBanner") &&
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
  "homepage status line must keep the full state-aware line available in the hero state banner below the persistent pitch block",
);

assert(
  slateCounts.includes('const marker = " · First ";') &&
    slateCounts.includes('state !== "pre-first-pitch"') &&
    slateCounts.includes("mobilePreFirstPitchLine.prefix") &&
    slateCounts.includes("mobilePreFirstPitchLine.detail") &&
    slateCounts.includes("<br />") &&
    slateCounts.includes('className="hidden sm:inline"') &&
    slateCounts.includes("`First ${line.slice(markerIndex + marker.length)}`"),
  "homepage pre-first-pitch status must force a mobile break before First without the leading dot",
);

assert(
  !slateCounts.includes(">Upcoming<") &&
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
    statusRoute.includes('import { getLiveScoreboard } from "@/lib/data/live-scoreboard-service";') &&
    statusRoute.includes("getLiveScoreboard({ date }).catch(() => null)") &&
    statusRoute.includes("reconcileSlateProgressWithLiveBoard(slateProgress, liveBoard?.slateProgress ?? null)") &&
    statusRoute.includes("const progress = reconcileSlateProgressWithLiveBoard(slateProgress, liveBoard?.slateProgress ?? null);") &&
    statusRoute.includes("nav: {") &&
    statusRoute.includes("liveStarts: liveBoard?.liveStarts ?? progress.liveStarts") &&
    statusRoute.includes('warmingStarts: liveBoard?.warmingStarts ?? (progress.state === "pre-first-pitch" ? 1 : 0)') &&
    statusRoute.includes('if (liveProgress.state === "all-starts-complete" && progress.state !== "all-starts-complete") return liveProgress;') &&
    statusRoute.includes("if (liveProgress.completedStarts > progress.completedStarts) return liveProgress;") &&
    statusRoute.includes("if (progress.liveStarts > 0 && liveProgress.liveStarts === 0 && liveProgress.completedStarts >= progress.completedStarts) return liveProgress;") &&
    statusRoute.includes('"Cache-Control": "no-store"') &&
    !statusRoute.includes("s-maxage"),
  "homepage status API must return no-store slate progress reconciled against the Live Board so count islands cannot trail final live rows",
);

assert(
  liveNavLabel.includes("const LIVE_NAV_POLL_MS = 30_000;") &&
    liveNavLabel.includes("void refresh();") &&
    liveNavLabel.includes("fetch(`/api/home/status?date=${encodeURIComponent(statusDate)}`") &&
    liveNavLabel.includes("normalizeLiveNavSnapshot(nextState)") &&
    liveNavLabel.includes("shouldContinuePolling = nextSnapshot.liveStarts > 0 || nextSnapshot.warmingStarts > 0;") &&
    liveNavLabel.includes("window.setTimeout(refresh, LIVE_NAV_POLL_MS)") &&
    liveNavLabel.includes('data-live-nav-island="true"') &&
    liveNavLabel.includes("data-live-nav-live-starts={snapshot.liveStarts}") &&
    liveNavLabel.includes("data-live-nav-warming-starts={snapshot.warmingStarts}") &&
    siteNav.includes("statusDate={today}") &&
    siteNav.includes("initialSnapshot={{ liveStarts: liveBoard.liveStarts, warmingStarts: liveBoard.warmingStarts }}"),
  "nav LIVE indicator must hydrate from the shared slate status island feed with mount poll, using server state only as first paint",
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
  packageJson.includes('"check:slate-sync": "node scripts/check-slate-sync.mjs"') &&
    slateSyncScript.includes("chromium.launch") &&
    slateSyncScript.includes("assertRenderedCounts(page, \"home\", slateState)") &&
    slateSyncScript.includes("assertRenderedCounts(page, \"ranked\", slateState)") &&
    slateSyncScript.includes("assertLiveBoard(page, liveBoard)") &&
    slateSyncScript.includes("assertSettledRankedLeader(page, settledSlateApi)") &&
    slateSyncScript.includes("assertNoBannedArchiveVocabulary") &&
    scoreComponentList.includes("function cleanSettledContextCopy") &&
    scoreComponentList.includes('value.replace(/\\s*context at settle\\.?/gi, "").trim()') &&
    slateSyncScript.includes('console.error("[slate-sync] divergence"') &&
    slateSyncCron.includes('console.error("[slate-sync] divergence"') &&
    slateSyncCron.includes("fetchJson<SlateProgress>(origin, statusPath)") &&
    slateSyncCron.includes("fetchJson<LiveBoardProbe>(origin, `/api/live/${slateState.date}`)") &&
    slateSyncCron.includes("compareSlateProgress(slateState, liveBoard)") &&
    slateSyncCron.includes('field: "nav.liveStarts"') &&
    slateSyncCron.includes('field: "nav.warmingStarts"') &&
    vercelConfig.includes('"path": "/api/cron/slate-sync"') &&
    vercelConfig.includes('"schedule": "0 * * * *"'),
  "slate synchronization must have a browser production probe and scheduled cron divergence alert",
);

assert(
  !homePage.includes("GS_PLUS_SCALE_SENTENCE") && !homePage.includes("Probable starters, form, matchup context"),
  "homepage masthead must not render the shared GS+ scale sentence after the tightened pitch update",
);

const heroWhyCopy = "Game Score, adjusted for park, opponent, and swing-and-miss, so the arms worth watching rise to the top.";
const differentiatorCards = [
  {
    title: "Context, not just the line.",
    body: "Seven scoreless against the Yankees in the Bronx is not seven against the A's in Sacramento. GS+ knows the difference.",
  },
  {
    title: "Stuff counts.",
    body: "Velocity and swing-and-miss factor in, so the electric starts you would actually want to watch grade like it.",
  },
  {
    title: "Show your work.",
    body: "Every score's full breakdown is public, and settled scores never change.",
  },
];

assert(
  homePage.includes(`const GS_PLUS_HERO_WHY_LINE = "${heroWhyCopy}";`) &&
    homePage.includes("data-home-hero-why-line") &&
    homePage.includes("text-[15px]") &&
    !homePage.includes("data-home-hero-why-line>\n                  <span>{GS_PLUS_HERO_WHY_LINE_START}</span>") &&
    !homePage.includes("<br />") &&
    homePage.includes('<span className="block lg:inline">Every MLB start,</span>') &&
    homePage.includes('{" "}') &&
    homePage.includes('<span className="block lg:inline">ranked.</span>') &&
    homePage.includes("lg:max-w-none") &&
    homePage.includes("<HomeDeferredSections") &&
    homePage.includes('whyGsPlusBand={<WhyGsPlusBand proof={gsPlusProofs} />}') &&
    homePage.indexOf("data-home-hero-why-line") < homePage.indexOf("Methodology") &&
    !homePage.includes('className="hidden text-[11px] sm:inline sm:text-sm"') &&
    !heroWhyCopy.includes("—"),
  "homepage hero must render exactly one pitch subtitle followed by the methodology link without em dash copy",
);

for (const card of differentiatorCards) {
  assert(
    homePage.includes(`title: "${card.title}"`) &&
      homePage.includes(`body: "${card.body}"`) &&
      !card.title.includes("—") &&
      !card.body.includes("—"),
    `homepage GS+ differentiator card must keep exact copy for ${card.title}`,
  );
}

assert(
  homePage.includes('data-responsive-check="home-gs-plus-differentiator-band"') &&
    homePage.includes("WHY GS+") &&
    homePage.includes("Why GS+ is different") &&
    homePage.includes('bg-[#0c0c10] px-4 py-10 sm:px-6 lg:px-8') &&
    homePage.includes('mb-5 flex flex-col justify-between gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end') &&
    homePage.includes('font-mono text-xs uppercase tracking-[0.24em] text-zinc-500') &&
    homePage.includes('section-title mt-2 font-serif text-4xl font-bold text-zinc-50') &&
    homePage.includes('data-home-gs-plus-differentiator-cards') &&
    homePage.includes('data-home-gs-plus-proof-panels') &&
    homePage.includes('data-home-gs-plus-proof-card="context"') &&
    homePage.includes('data-home-gs-plus-proof-card="stuff"') &&
    homePage.includes('data-home-gs-plus-proof-card="breakdown"') &&
    homePage.includes("lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)_minmax(0,0.9fr)]") &&
    !homePage.includes('md:grid-cols-3') &&
    homePage.includes('data-home-gs-plus-context-pair') &&
    homePage.includes('data-home-gs-plus-context-start') &&
    homePage.includes('data-home-gs-plus-stuff-proof') &&
    homePage.includes('data-home-gs-plus-freeze-proof') &&
    homePage.includes('data-home-gs-plus-lock') &&
    homePage.includes('data-home-gs-plus-breakdown-link') &&
    homePage.includes("Real comparison, updated daily") &&
    homePage.includes("Real comparison, frozen examples") &&
    !homePage.includes("Proof packet:") &&
    !homePage.includes("documented fallback") &&
    homePage.includes("readHomeGsPlusProofs()") &&
    homePage.includes('data-home-gs-plus-methodology-link') &&
    homePage.includes('href="/methodology"') &&
    !homePage.includes('href="/calibration"') &&
    homePage.includes('whyGsPlusBand={<WhyGsPlusBand proof={gsPlusProofs} />}') &&
    homePage.indexOf("<HomeDeferredSections") < homePage.indexOf("function WhyGsPlusBand") &&
    homeDeferredSections.includes("whyGsPlusBand?: ReactNode") &&
    homeDeferredSections.includes('{module === "watch" ? whyGsPlusBand : null}') &&
    homeDeferredSections.includes(
      `{watch ? (
        <TonightsMustWatch`,
    ) &&
    homeDeferredSections.includes(`      {whyGsPlusBand}

      {formHome ? <HeatCheckHero home={formHome} /> : null}`) &&
    !homeDeferredSections.includes("PitchingDuelsModule"),
  "homepage must render the rebuilt WHY GS+ proof band below Must-Watch and above Heat Check, with structured context, stuff, and frozen-breakdown proof panels",
);

assert(
  homeGsPlusProofService.includes('readCachedRuntimeState') &&
    homeGsPlusProofService.includes('writeRuntimeState') &&
    homeGsPlusProofService.includes('export async function readHomeGsPlusProofs') &&
    homeGsPlusProofService.includes('export async function generateHomeGsPlusProofs') &&
    homeGsPlusProofService.includes('getArchivedSeasonStartSummaries') &&
    homeGsPlusProofService.includes('HOME_GS_PLUS_PROOF_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000') &&
    homeGsPlusProofService.includes('selectContextPair') &&
    homeGsPlusProofService.includes('lineDistance > 4') &&
    homeGsPlusProofService.includes('gsDiff < 8') &&
    homeGsPlusProofService.includes('contextComponentValue') &&
    homeGsPlusProofService.includes('stuffComponentValue') &&
    homeGsPlusProofService.includes('FALLBACK_HOME_GS_PLUS_PROOFS') &&
    homeGsPlusProofService.includes('2026-06-24-min-lad-657746') &&
    homeGsPlusProofService.includes('2026-06-14-hou-kc-681293') &&
    homeGsPlusProofService.includes('2026-06-02-stl-tex-669160') &&
    homeGsPlusProofService.includes('2026-06-30-wsh-bos-676917') &&
    homeGsPlusProofService.includes('FALLBACK_HOME_GS_PLUS_PROOFS') &&
    homeGsPlusProofCron.includes('export const dynamic = "force-dynamic";') &&
    homeGsPlusProofCron.includes('generateHomeGsPlusProofs(date)') &&
    homeGsPlusProofCron.includes('CRON_SECRET') &&
    vercelConfig.includes('"path": "/api/cron/home-gs-plus-proofs"') &&
    vercelConfig.includes('"schedule": "45 10 * * *"'),
  "homepage GS+ proof packet must be cron-selected and stored, with documented real fallbacks for context, stuff, and breakdown proof",
);

assert(
  gsPlusCopy.includes("GS+ grades a single start on the 20-80 scouting scale, league average near 50.") &&
    !homePage.includes('import { GS_PLUS_SCALE_SENTENCE } from "@/lib/gs-plus-copy";') &&
    methodologyPage.includes('import { GS_PLUS_SCALE_SENTENCE } from "@/lib/gs-plus-copy";') &&
    methodologyPage.includes("{GS_PLUS_SCALE_SENTENCE}") &&
    !homePage.includes("0-100") &&
    !methodologyPage.includes("0-100") &&
    !homePage.includes("0 to 100"),
  "GS+ scale copy must stay in the shared fragment and methodology page while no longer rendering in the homepage hero",
);

assert(
  methodologyPage.includes('className="mx-auto max-w-7xl"') &&
    !methodologyPage.includes('className="mx-auto max-w-5xl"') &&
    methodologyPage.includes('className="mt-3 max-w-3xl text-base leading-7 text-zinc-400"') &&
    methodologyPage.includes('className="space-y-3 text-base leading-7 text-zinc-400"') &&
    methodologyPage.includes('className="mt-3 text-base leading-7 text-zinc-400"') &&
    methodologyPage.includes('className="mt-3 text-sm leading-6 text-zinc-500"') &&
    !methodologyPage.includes('className="mt-3 text-xs leading-5 text-zinc-500"'),
  "methodology page must use the shared wide page width and larger reader-facing body copy",
);

assert(
  methodologyPage.includes("above league baseline") &&
    methodologyPage.includes("GAME_SCORE_PLUS_CONTEXT_BASELINES") &&
    startService.includes("GAME_SCORE_PLUS_WHIFF_CONTEXT_WEIGHT") &&
    startService.includes("GAME_SCORE_PLUS_VELOCITY_CONTEXT_WEIGHT") &&
    startService.includes("pct points above league baseline") &&
    startService.includes("mph above league baseline"),
  "methodology must disclose whiff and velocity context as deltas above imported baselines",
);

assert(
  methodologyPage.includes("The standard formula uses runs; Toe the Slab substitutes earned runs from the pitcher line") &&
    methodologyPage.includes("Starts settled before v8 retain their frozen pre-v8 park context until the P0-3 sweep") &&
    methodologyContent.includes("P3-10") &&
    methodologyContent.includes("P3-12.1"),
  "methodology must correct GSv2 runs wording, include the pre-v8 park carve-out, and track pending metric specs",
);

assert(
  methodologyContent.includes('export const GS_PLUS_20_80_FAQ_QUESTION = "Why is GS+ capped at 20 and 80?";') &&
    methodologyContent.includes("Branch Rickey") &&
    methodologyContent.includes("standard deviation") &&
    methodologyContent.includes("99.7 percent") &&
    methodologyContent.includes("raw pre-calibration") &&
    methodologyContent.includes("GS_PLUS_20_80_FAQ_ANSWER = GS_PLUS_20_80_FAQ_PARAGRAPHS.join(\" \")") &&
    methodologyPage.includes('id="why-20-80"') &&
    methodologyPage.includes('scroll-mt-24') &&
    methodologyPage.includes("{GS_PLUS_20_80_FAQ_QUESTION}") &&
    methodologyPage.includes("GS_PLUS_20_80_FAQ_PARAGRAPHS.map") &&
    methodologyPage.includes('<FaqStat value="50" label="MLB AVERAGE" />') &&
    methodologyPage.includes('<FaqStat value="10 PTS" label="ONE STD DEV" />') &&
    methodologyPage.includes('<FaqStat value="99.7%" label="WITHIN 3 STD DEV" />') &&
    methodologyPage.includes('<FaqStat value="80" label="THE EXTREME" />') &&
    methodologyPage.includes("FanGraphs: Scouting Explained, the 20-80 scale") &&
    methodologyPage.includes('target="_blank"') &&
    methodologyPage.includes('rel="noopener noreferrer"') &&
    methodologyPage.includes("GS_PLUS_20_80_FAQ_ANSWER") &&
    !methodologyContent.includes("whether he intended it or not") &&
    !methodologyContent.includes("mirrors various scientific scales") &&
    !methodologyPage.includes("whether he intended it or not") &&
    !methodologyPage.includes("mirrors various scientific scales"),
  "methodology must render the 20-80 FAQ box, stat strip, external reading link, and FAQPage JSON-LD from allowlisted copy",
);

assert(
  !homePage.includes("GS+ grades a single start on the 20-80 scouting scale,") &&
    !homePage.includes("league average near 50.") &&
    homePage.includes('className="mt-2 block w-fit font-mono text-xs uppercase tracking-[0.12em] text-amber-300 underline-offset-4 hover:underline"'),
  "homepage mobile hero must use the single pitch subtitle and keep methodology below it",
);

assert(
  !homePage.includes("FirstPitchCountdownEyebrow") &&
    !homePage.includes("SlateStatusPill") &&
    !homePage.includes("HomeSlateStatusLine") &&
    !startsPage.includes("RankedSlateStatusIsland"),
  "homepage must not render separate stacked countdown/status fragments",
);

console.log("home status contract ok: one shared slate-state line with pre-pitch-only countdown");
