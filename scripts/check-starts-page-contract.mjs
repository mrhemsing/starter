import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const startsPage = await readFile("src/app/starts/[id]/page.tsx", "utf8");
const pitchChart = await readFile("src/components/pitch-chart.tsx", "utf8");
const startImage = await readFile("src/app/starts/[id]/opengraph-image.tsx", "utf8");
const startRecapPage = await readFile("src/app/starts/[id]/[slug]/page.tsx", "utf8");
const arsenalEventCopy = await readFile("src/lib/arsenal-event-copy.ts", "utf8");
const pitchEventQuality = await readFile("src/lib/pitch-event-quality.ts", "utf8");
const startsIndexRoute = await readFile("src/app/starts/route.ts", "utf8");
const startApiRoute = await readFile("src/app/api/starts/[id]/route.ts", "utf8");
const startClassification = await readFile("src/lib/start-classification.ts", "utf8");
const startService = await readFile("src/lib/data/start-service.ts", "utf8");
const slateState = await readFile("src/lib/slate-state.ts", "utf8");
const canonicalStore = await readFile("src/lib/data/canonical-start-store.ts", "utf8");
const mlbStatsClient = await readFile("src/lib/data/mlb-stats-client.ts", "utf8");
const rankedStartsPageService = await readFile("src/lib/data/ranked-starts-page-service.ts", "utf8");
const rankedStartsRevalidation = await readFile("src/lib/data/ranked-starts-revalidation.ts", "utf8");
const warmLiveStartsJob = await readFile("src/lib/data/warm-live-starts-job.ts", "utf8");
const warmLiveStartsCron = await readFile("src/app/api/cron/warm-live-starts/route.ts", "utf8");
const archiveRevalidationRoute = await readFile("src/app/api/archive/revalidate/route.ts", "utf8");
const archiveSyncScript = await readFile("scripts/sync-supabase-mlb-archive.mjs", "utf8");
const formService = await readFile("src/lib/data/form-service.ts", "utf8");
const types = await readFile("src/lib/types.ts", "utf8");
const routes = await readFile("src/lib/routes.ts", "utf8");
const siteNav = await readFile("src/components/site-nav.tsx", "utf8");
const siteHeader = await readFile("src/components/site-header.tsx", "utf8");
const slateDateNav = await readFile("src/components/slate-date-nav.tsx", "utf8");
const rankedStartsArchiveLink = await readFile("src/components/ranked-starts-archive-link.tsx", "utf8");
const startsDisclosure = await readFile("src/components/ranked-starts-disclosure.tsx", "utf8");
const pageContextStrip = await readFile("src/components/page-context-strip.tsx", "utf8");
const mobileCardShell = await readFile("src/components/mobile-card-shell.tsx", "utf8");
const ctaArrow = await readFile("src/components/cta-arrow.tsx", "utf8");
const topPerformerCard = await readFile("src/components/top-performer-card.tsx", "utf8");
const slateCounts = await readFile("src/components/slate-counts.tsx", "utf8");
const homeStatusRoute = await readFile("src/app/api/home/status/route.ts", "utf8");
const globals = await readFile("src/app/globals.css", "utf8");
const mobileCardLayoutCheck = await readFile("scripts/check-mobile-card-layout.mjs", "utf8");
const packageJson = await readFile("package.json", "utf8");
const slateStateBackfillScript = await readFile("scripts/backfill-canonical-slate-state.mjs", "utf8");
const rankedStartSummaryRule = globals.match(/\.ranked-start-details > summary \{[\s\S]*?\n\}/)?.[0] ?? "";
const methodologyPage = await readFile("src/app/methodology/page.tsx", "utf8");
const startRanking = await readFile("src/lib/start-ranking.ts", "utf8");
const primaryNavLink = await readFile("src/components/primary-nav-link.tsx", "utf8");
const archivedStartOfDayActionFixtures = [
  {
    date: "2026-07-03",
    pitcher: "Dylan Cease",
    metadataPath: "public/images/top-performer-action-shots/2026-07-03-tor-sea-656302-mlb-action-v4.json",
  },
  {
    date: "2026-07-02",
    pitcher: "Bryce Miller",
    metadataPath: "public/images/top-performer-action-shots/2026-07-02-sea-laa-682243-mlb-action-v4.json",
  },
  {
    date: "2026-07-01",
    pitcher: "Troy Melton",
    metadataPath: "public/images/top-performer-action-shots/2026-07-01-det-nyy-675512-mlb-action-v4.json",
  },
];

function archivedStartInnings(ip) {
  const value = Number(ip) || 0;
  const whole = Math.trunc(value);
  const outs = Math.round((value - whole) * 10);
  return whole + outs / 3;
}

function compareArchivedStartOfDay(a, b) {
  return (
    b.gameScorePlus - a.gameScorePlus ||
    archivedStartInnings(b.line.inningsPitched) - archivedStartInnings(a.line.inningsPitched) ||
    a.line.earnedRuns - b.line.earnedRuns ||
    b.line.strikeouts - a.line.strikeouts ||
    a.line.walks - b.line.walks ||
    a.line.hits - b.line.hits ||
    a.date.localeCompare(b.date) ||
    (a.gamePk ?? 0) - (b.gamePk ?? 0) ||
    (a.pitcherName ?? "").localeCompare(b.pitcherName ?? "")
  );
}

async function readArchivedStartOfDayLeaders() {
  const archiveDir = "data/mlb-archive/2026/dates";
  const files = (await readdir(archiveDir)).filter((file) => file.endsWith(".json")).sort();
  const leaders = [];

  for (const file of files) {
    const date = file.replace(/\.json$/, "");
    const archive = JSON.parse(await readFile(`${archiveDir}/${file}`, "utf8"));
    const starts = [];
    for (const game of archive.games ?? []) {
      for (const start of game.starts ?? []) {
        if (archivedStartInnings(start.line?.inningsPitched) < 2) continue;
        starts.push({
          ...start,
          date,
          gamePk: game.gamePk,
          startId: `${date}-${start.team.toLowerCase()}-${start.opponent.toLowerCase()}-${start.pitcherMlbId}`,
        });
      }
    }
    if (starts.length === 0) continue;
    starts.sort(compareArchivedStartOfDay);
    leaders.push(starts[0]);
  }

  return leaders;
}

const visibleTieBreakerOrder = [
  {
    date: "2026-06-20",
    gamePk: 824909,
    pitcher: { name: "Chris Sale" },
    gameScorePlus: 64,
    gameScorePlusBreakdown: { preciseTotal: 64.216 },
    line: { inningsPitched: 5.2, earnedRuns: 0, strikeouts: 7, walks: 1, hits: 5 },
  },
  {
    date: "2026-06-20",
    gamePk: 824902,
    pitcher: { name: "Joey Cantillo" },
    gameScorePlus: 64,
    gameScorePlusBreakdown: { preciseTotal: 63.53 },
    line: { inningsPitched: 8, earnedRuns: 1, strikeouts: 9, walks: 1, hits: 4 },
  },
].sort((a, b) => (
  b.gameScorePlus - a.gameScorePlus ||
  b.line.inningsPitched - a.line.inningsPitched ||
  a.line.earnedRuns - b.line.earnedRuns ||
  b.line.strikeouts - a.line.strikeouts ||
  a.line.walks - b.line.walks ||
  a.line.hits - b.line.hits ||
  a.date.localeCompare(b.date) ||
  (a.gamePk ?? 0) - (b.gamePk ?? 0) ||
  (a.pitcher?.name ?? "").localeCompare(b.pitcher?.name ?? "")
));

assert(visibleTieBreakerOrder[0]?.pitcher.name === "Joey Cantillo", "visible GS+ ties must break on the displayed-line tiebreakers before hidden decimal precision");

assert(
  startService.includes('fetchMlbTeamQualityContexts(date, { fetchLive: process.env.THE_BUMP_LIVE_MLB === "1" || shouldFetchLiveSchedule(date) })'),
  "recent completed slates must keep live opponent quality context so GS+ does not drift when today becomes yesterday",
);

assert(
  siteNav.includes("PrimaryNavLink") &&
    primaryNavLink.includes("prefetch") &&
    primaryNavLink.includes("router.prefetch(href)") &&
    primaryNavLink.includes("onPointerDown={warmRoute}") &&
    primaryNavLink.includes("event.preventDefault()") &&
    primaryNavLink.includes("router.push(href)") &&
    primaryNavLink.includes('data-nav-pending={pending ? "true" : undefined}') &&
    !primaryNavLink.includes("dispatchRoutePending") &&
    existsSync("src/app/starts/[id]/loading.tsx"),
  "ranked starts navigation must use client navigation, prefetch warming, and the shell-first route skeleton fallback",
);

assert(
  rankedStartsPageService.includes('import { unstable_cache } from "next/cache";') &&
    rankedStartsPageService.includes('const RANKED_STARTS_PAGE_CACHE_VERSION = "ranked-starts-page-v16";') &&
    rankedStartsPageService.includes("export function rankedStartsDateCacheTag(date: string)") &&
    rankedStartsPageService.includes("return `ranked-starts:${date}`;") &&
    rankedStartsPageService.includes('getCachedRankedStartsPageData(date, today, "current")') &&
    rankedStartsPageService.includes('getValidatedCachedRankedStartsPageData(date, today, "final"') &&
    rankedStartsPageService.includes("rankedStartsPageDataCoversCompletion") &&
    rankedStartsPageService.includes('console.error("[ranked-starts-render] cached page data incomplete; rebuilding"') &&
    rankedStartsPageService.includes("[ranked-starts-render] rebuild returned fewer starts than cached page; serving cached floor") &&
    rankedStartsPageService.includes("[ranked-starts-render] rebuild failed; serving cached floor") &&
    rankedStartsPageService.includes("if (date > today) return buildRankedStartsPageData(date, today);") &&
    rankedStartsPageService.includes("if (completionState.totalGames === 0 && completionState.totalStarts === 0) return buildRankedStartsPageData(date, today);") &&
    rankedStartsPageService.includes("function getCachedRankedStartsPageData(date: string, today: string, cacheMode: \"current\" | \"final\")") &&
    rankedStartsPageService.includes("revalidate: false,") &&
    rankedStartsPageService.includes("tags: [RANKED_STARTS_CACHE_TAG, SLATE_CACHE_TAG, rankedStartsDateCacheTag(date)]") &&
    startService.includes("{ revalidate: false, tags: [RANKED_STARTS_CACHE_TAG, SLATE_CACHE_TAG] }") &&
    rankedStartsPageService.includes("getRankedSlateCompletionState(date, today)") &&
    rankedStartsPageService.includes("getRankedSlateContextForStarts(date, today, slateStarts)") &&
    rankedStartsPageService.includes('measureRankedStartsSpan(timings, "daily-slate"') &&
    rankedStartsPageService.includes('measureRankedStartsSpan(timings, "archive-navigation"') &&
    rankedStartsPageService.includes('measureRankedStartsSpan(timings, "slate-context"') &&
    rankedStartsPageService.includes('measureRankedStartsSyncSpan(timings, "ranking-assembly"') &&
    rankedStartsPageService.includes('measureRankedStartsSpan(timings, "highlights"') &&
    rankedStartsPageService.includes("serverTiming: formatRankedStartsServerTiming(timings)") &&
    rankedStartsPageService.includes("timings,") &&
    rankedStartsPageService.includes("withCanonicalStoreDiagnostics") &&
    rankedStartsPageService.includes('console.info("[ranked-starts-render]"') &&
    rankedStartsPageService.includes("canonicalReads: diagnostics.reads") &&
    !rankedStartsPageService.includes("getPitcherFormMap(") &&
    canonicalStore.includes("export async function readCanonicalizedStartSummaries") &&
    startService.includes("readCanonicalizedStartSummaries(date, starts)") &&
    !startsPage.includes("const starts = (await getRankedStartsPageData(id)).slateStarts") &&
    rankedStartsPageService.includes("getRankedStartsArchiveNavigation(date, today)") &&
    rankedStartsPageService.includes("archiveNavigation,") &&
    rankedStartsPageService.includes("formByPitcher: [],") &&
    startService.includes("export async function getRankedSlateContextForStarts") &&
    canonicalStore.includes("withCanonicalStoreDiagnostics") &&
    startsPage.includes('import { getRankedStartsPageData } from "@/lib/data/ranked-starts-page-service";') &&
    startsPage.includes("const pageData = await getRankedStartsPageData(date, today);") &&
    startsPage.includes("const { slateStarts, completionState, slateProgress, archiveNavigation } = pageData;") &&
    startsPage.includes("const highlights = new Map(pageData.highlights);") &&
    startsPage.includes("const formByPitcher = new Map(pageData.formByPitcher);"),
  "ranked starts date pages must use a cached shared page-data payload with date tags and settle-driven revalidation for current/final slates",
);

assert(
  rankedStartsRevalidation.includes('export type RankedStartsRevalidationReason =') &&
    rankedStartsRevalidation.includes('"settle-progress"') &&
    rankedStartsRevalidation.includes('"slate-complete"') &&
    rankedStartsRevalidation.includes('"archive-backstop"') &&
    rankedStartsRevalidation.includes("rankedStartsDateCacheTag(date)") &&
    rankedStartsRevalidation.includes("rankedStartsPath(date)") &&
    rankedStartsRevalidation.includes('console.log("[ranked-starts-revalidation]"') &&
    warmLiveStartsCron.includes('const date = new URL(request.url).searchParams.get("date") ?? undefined;') &&
    warmLiveStartsJob.includes("if (dateOverride && /^\\d{4}-\\d{2}-\\d{2}$/.test(dateOverride)) return dateOverride;") &&
    warmLiveStartsJob.includes('revalidateRankedStartsDate(date, options, completion.isFinal ? "slate-complete" : "settle-progress");') &&
    archiveRevalidationRoute.includes('revalidateRankedStartsDate(date, { revalidatePath, revalidateTag }, "archive-backstop")') &&
    archiveRevalidationRoute.includes("isAuthorizedArchiveRevalidationRequest") &&
    archiveSyncScript.includes("await revalidateArchivedDates(dateFiles.map((file) => file.replace(/\\.json$/, \"\")));") &&
    archiveSyncScript.includes('new URL("/api/archive/revalidate", revalidationBaseUrl)') &&
    archiveSyncScript.includes('url.searchParams.set("date", date)') &&
    archiveSyncScript.includes('method: "POST"') &&
    archiveSyncScript.includes('authorization: `Bearer ${cronSecret}`'),
  "ranked starts settle and archive revalidation must be date-addressed, logged by slate date, and backed up by the archive sync job",
);

assert(
  startRanking.includes("b.gameScorePlus - a.gameScorePlus") &&
    startRanking.includes("inningsFromIP(b.line.inningsPitched) - inningsFromIP(a.line.inningsPitched)") &&
    startRanking.includes("a.line.earnedRuns - b.line.earnedRuns") &&
    startRanking.includes("b.line.strikeouts - a.line.strikeouts") &&
    startRanking.includes("a.line.walks - b.line.walks") &&
    startRanking.includes("a.line.hits - b.line.hits") &&
    !startRanking.includes("preciseTotal") &&
    startService.includes('import { compareRankedStarts, rankStarts } from "@/lib/start-ranking";') &&
    startService.includes("const computedPreciseTotal = Math.max(GAME_SCORE_PLUS_DISPLAY_MIN, Math.min(GAME_SCORE_PLUS_DISPLAY_MAX, scaledTotal));") &&
    startService.includes("const preciseTotal = Math.round(computedPreciseTotal) === scoredTotal ? computedPreciseTotal : scoredTotal;") &&
    startService.includes("preciseTotal: Number(preciseTotal.toFixed(3)),"),
  "ranked starts must sort by displayed GS+ first, then break visible ties by IP, ER, K, walks, hits, and stable slate identity",
);

assert(
  !startsPage.includes("state.date === addDays(getHomeSlateDate(), -1)"),
  "starts page completion chip must not limit weekday labels to yesterday",
);

assert(
  mobileCardShell.includes("export function MobileCardShell") &&
    mobileCardShell.includes("data-mobile-card-shell") &&
    mobileCardShell.includes("gap-x-1.5 gap-y-1") &&
    startsPage.includes("data-ranked-desktop-layout") &&
    globals.includes("[data-ranked-desktop-layout]") &&
    globals.includes("[data-ranked-desktop-chip-row]") &&
    globals.includes("[data-ranked-desktop-detail-block]") &&
    globals.includes("[data-ranked-desktop-score-stack]") &&
    mobileCardShell.includes("data-mobile-card-header") &&
    mobileCardShell.includes("data-mobile-card-score") &&
    mobileCardShell.includes("data-mobile-card-chips") &&
    mobileCardShell.includes("data-mobile-card-details") &&
    startsPage.includes('import { MobileCardShell } from "@/components/mobile-card-shell";') &&
    startsPage.includes("<MobileCardShell") &&
    startsPage.includes("GSV2 {gameScoreV2} · {formatSigned(delta)} ADJ") &&
    startsPage.includes("<DecisionChip result={start.result} compact />") &&
    startsPage.includes("hidden items-start gap-x-3 gap-y-2 sm:grid") &&
    startsPage.includes("grid-cols-[minmax(0,1fr)_minmax(64px,auto)] sm:grid-cols-[48px_64px_minmax(0,1fr)_auto_auto]") &&
    startsPage.includes("grid-cols-[minmax(0,1fr)_minmax(66px,auto)] sm:grid-cols-[48px_52px_minmax(0,1fr)_auto_auto]") &&
    startsPage.includes("grid-cols-[minmax(0,1fr)_minmax(58px,auto)] sm:grid-cols-[48px_40px_minmax(0,1fr)_auto_auto]") &&
    startsPage.includes("headerClusterClass: \"col-start-1 row-start-1 grid min-w-0 grid-cols-[36px_44px_minmax(0,1fr)] items-start gap-x-2 sm:contents\"") &&
    startsPage.includes('scoreStackClass: "col-start-2 row-start-1 flex min-w-16') &&
    startsPage.includes('scoreStackClass: "col-start-2 row-start-1 flex min-w-[66px]') &&
    startsPage.includes('scoreClass: "text-4xl sm:text-[44px]"') &&
    startsPage.includes('nameClass: "text-xl sm:text-4xl"') &&
    startsPage.includes('rankClass: "text-2xl sm:text-4xl"') &&
    startsPage.includes("min-w-0 w-full max-w-full break-words") &&
    startsPage.includes('lineClass: "col-span-full row-start-3') &&
    startsPage.includes("whitespace-nowrap font-mono text-zinc-300") &&
    startsPage.includes("line-clamp-2 text-xs text-zinc-500 sm:truncate") &&
    startsPage.includes('className={profile.scoreStackClass}') &&
    startsPage.includes("className={profile.headerClusterClass}") &&
    startsPage.includes("data-ranked-desktop-chip-row") &&
    startsPage.includes("data-ranked-desktop-detail-block") &&
    startsPage.includes("data-ranked-desktop-score-stack") &&
    startsPage.indexOf("data-ranked-desktop-chip-row") < startsPage.indexOf("data-ranked-desktop-detail-block") &&
    startsPage.indexOf("data-ranked-desktop-detail-block") < startsPage.indexOf("data-ranked-desktop-score-stack") &&
    startsPage.includes('className="mt-1 flex max-sm:!hidden min-w-0 flex-wrap gap-1.5" data-ranked-desktop-chip-row') &&
    startsPage.includes("hidden max-sm:!hidden items-start") &&
    packageJson.includes('"check:mobile-card-layout": "node scripts/check-mobile-card-layout.mjs"') &&
    mobileCardLayoutCheck.includes("/starts/${rankedDate}") &&
    mobileCardLayoutCheck.includes("/heat-check") &&
    mobileCardLayoutCheck.includes('await assertVisible(page, "[data-mobile-card-shell]", false, `ranked ${viewport.name} mobile shell`)') &&
    mobileCardLayoutCheck.includes('await assertVisible(page, "[data-ranked-desktop-chip-row]", true, `ranked ${viewport.name} desktop chip row`)') &&
    mobileCardLayoutCheck.includes('await assertVisible(page, "[data-ranked-desktop-detail-block]", true, `ranked ${viewport.name} desktop detail block`)') &&
    mobileCardLayoutCheck.includes('await assertVisible(page, "[data-ranked-desktop-score-stack]", true, `ranked ${viewport.name} desktop score stack`)') &&
    mobileCardLayoutCheck.includes("assertDesktopRankedColumns(page, viewport.name)") &&
    mobileCardLayoutCheck.includes('await assertVisible(page, "[data-form-row]", true, `heat ${viewport.name} desktop row`)') &&
    mobileCardLayoutCheck.includes("page.screenshot") &&
    !startsPage.includes('className={profile.chipRowClass}') &&
    !startsPage.includes("grid-cols-[48px_52px_minmax(0,1fr)_auto] sm:grid-cols") &&
    !startsPage.includes("grid-cols-[48px_52px_minmax(0,1fr)_minmax(78px,auto)]") &&
    !startsPage.includes("row-span-2 row-start-1 flex") &&
    !startsPage.includes("order-3 flex items-center justify-end gap-2"),
  "ranked mobile cards must keep the score column in the header row while desktop keeps chips under the name cluster and details/score in the right columns",
);

assert(
  startService.includes("export async function getRankedStartsArchiveNavigation") &&
    canonicalStore.includes("export async function readCompleteCanonicalSlateStateDates") &&
    canonicalStore.includes("export async function writeCanonicalSlateStateSnapshot") &&
    canonicalStore.includes('const CANONICAL_SLATE_STATES_TABLE = "toetheslab_canonical_slate_states";') &&
    canonicalStore.includes('url.searchParams.set("state", "eq.complete");') &&
    canonicalStore.includes("row.counts.finalStarts >= row.counts.totalStarts") &&
    !startService.includes('readCompleteCanonicalSlateStateDates } from "@/lib/data/canonical-start-store";') &&
    startService.includes("const getCachedRankedScheduleRegistryDates = unstable_cache(") &&
    startService.includes('import { fetchMlbCompletedPitchingLines, fetchMlbCompletedScheduleDates,') &&
    startService.includes('["ranked-starts-schedule-registry-dates-v1"]') &&
    startService.includes("{ revalidate: false, tags: [RANKED_STARTS_CACHE_TAG, SLATE_CACHE_TAG] }") &&
    !startService.includes("const canonicalCompleteDates = await readCompleteCanonicalSlateStateDates(season);") &&
    !startService.includes("const archivedDates = Array.from(new Set(starts.filter((start) => start.source?.line !== \"fixture\").map((start) => start.date))).sort();") &&
    startService.includes("return fetchMlbCompletedScheduleDates(`${season}-01-01`, `${season}-12-31`, { fetchLive: true });") &&
    mlbStatsClient.includes("export async function fetchMlbCompletedScheduleDates") &&
    mlbStatsClient.includes('gameTypes: "R"') &&
    mlbStatsClient.includes("startDate,") &&
    mlbStatsClient.includes("endDate,") &&
    mlbStatsClient.includes('(entry.games ?? []).some((game) => game.gameType === "R" && isFinalMlbApiGame(game))') &&
    packageJson.includes('"backfill:canonical-slate-state": "node --experimental-strip-types scripts/backfill-canonical-slate-state.mjs"') &&
    slateStateBackfillScript.includes("writeCanonicalSlateStateSnapshot") &&
    slateStateBackfillScript.includes('state: "complete"') &&
    slateStateBackfillScript.includes("beforeCompleteSlateStateRows") &&
    slateStateBackfillScript.includes("afterCompleteSlateStateRows") &&
    startService.includes("const recentDates = Array.from({ length: 4 }, (_, index) => addDays(today, -index));") &&
    startService.includes("const activeState = activityStates.find(hasRankedSlateActivity);") &&
    startService.includes("function hasRankedSlateActivity(state: RankedSlateCompletionState)") &&
    startService.includes("return state.liveStarts > 0 || state.completedStarts > 0;") &&
    startService.includes("if (todayCompletion.totalGames > 0) dates.add(today);") &&
    startService.includes("activeDate === today ? Promise.resolve(null) : getRankedSlateCompletionState(activeDate, today)") &&
    startService.includes("if (activeCompletion && activeCompletion.totalGames > 0) dates.add(activeDate);") &&
    startsPage.includes('import { RankedStartsArchiveNav } from "@/components/slate-date-nav";') &&
    startsPage.includes("<RankedStartsArchiveNav") &&
    startsPage.includes("previousDate={archiveNavigation.previousDate}") &&
    startsPage.includes("nextDate={archiveNavigation.nextDate}") &&
    startsPage.includes('<SiteHeader active="starts" today={today} />') &&
    !startsPage.includes("const rankedDate = archiveNavigation.latestDate;") &&
    !startsPage.includes("hideUpcoming") &&
    !siteHeader.includes("hideUpcoming") &&
    !siteNav.includes("hideUpcoming") &&
    siteNav.includes("href: rankedStartsPath(defaultDates.rankedDate)") &&
    startsIndexRoute.includes('export const dynamic = "force-dynamic";') &&
    startApiRoute.includes('export const dynamic = "force-dynamic";') &&
    startsIndexRoute.includes("NextResponse.redirect(location, 302)") &&
    startsIndexRoute.includes('response.headers.set("X-Robots-Tag", "noindex, follow")') &&
    startsIndexRoute.includes("rankedStartsPath(await getRankedStartsDefaultDate(today))") &&
    siteNav.includes('const upcomingItem = [{ key: "upcoming" as const, label: "Upcoming", href: upcomingDateHref(defaultDates.upcomingDate) }];') &&
    startsPage.includes('import { RankedStartsDisclosure } from "@/components/ranked-starts-disclosure";') &&
    startsDisclosure.includes('"use client";') &&
    startsDisclosure.includes("window.sessionStorage.getItem(storageKey)") &&
    startsDisclosure.includes("window.sessionStorage.setItem(storageKey, nextOpen ? \"open\" : \"closed\")") &&
    startsDisclosure.includes("grid h-6 w-6 shrink-0 place-items-center rounded border border-white/15") &&
    startsDisclosure.includes("group-hover:border-amber-300/60 group-hover:text-amber-300") &&
    startsDisclosure.includes("group-open:border-amber-300/60 group-open:text-amber-300") &&
    startsDisclosure.includes('<span className="group-open:hidden">+</span>') &&
    startsDisclosure.includes('<span className="hidden group-open:inline">&#8722;</span>') &&
    !startsDisclosure.includes("group-open:rotate-180") &&
    !startsDisclosure.includes('aria-hidden="true">v</span>') &&
    startsPage.includes(">Ranked Starts</h1>") &&
    !startsPage.includes(">Daily Ranked Starts</h1>") &&
    startsPage.includes("Completed starts ranked by GS+.") &&
    !startsPage.includes("Every completed start ranked by GS+, with full lines, matchup context, and breakdowns.") &&
    startsPage.includes('data-responsive-check="ranked-starts-compact-controls"') &&
    startsPage.includes('data-responsive-check="ranked-start-controls"') &&
    startsPage.includes('data-active-filter-summary={filterSummary}') &&
    startsPage.includes('storageKey="ranked-starts-filters-open"') &&
    startsPage.includes('storageKey="ranked-starts-shape-open"') &&
    startsPage.includes('storageKey="ranked-starts-method-open"') &&
    startsPage.includes("const visibleQualityBands = QUALITY_BANDS.filter((qualityBand) => (qualityBandCounts.get(qualityBand.label) ?? 0) > 0);") &&
    startsPage.includes("function rankedStartsFilterSummary") &&
    startsPage.includes('style={{ pointerEvents: "none" }}') &&
    startsPage.includes('data-responsive-check="ranked-starts-methodology-notes"') &&
    startsPage.includes("<ScaleLegend scoreScale={scoreScale} />") &&
    !startsPage.includes('data-responsive-check="ranked-starts-slate-stamp"') &&
    !startsPage.includes('data-responsive-check="ranked-starts-board-heading"') &&
    !startsPage.includes("formatBoardEyebrowDate(date)") &&
    !startsPage.includes("Ranked Board</p>") &&
    startsPage.includes("MLB Stats API / Baseball Savant") &&
    !startsPage.includes("Data through {formatMetadataDate(date)} / MLB Stats API / Baseball Savant") &&
    !startsPage.includes(">Previous day</Link>") &&
    !startsPage.includes(">Next day</Link>") &&
    !slateDateNav.includes("export function RankedStartsRangeToggle") &&
    slateDateNav.includes("export function SlateRangeToggle") &&
    slateDateNav.includes("export function UpcomingSlateRangeToggle") &&
    slateDateNav.includes("export function RankedStartsArchiveNav") &&
    pageContextStrip.includes("export function PageContextStrip") &&
    pageContextStrip.includes("data-context-primary") &&
    pageContextStrip.includes("data-context-meta") &&
    !slateDateNav.includes('import { PageContextStrip } from "@/components/page-context-strip";') &&
    slateDateNav.includes('import { RankedStartsArchiveKeyboard, RankedStartsArchiveStrip, RankedStartsDatePicker } from "@/components/ranked-starts-archive-link";') &&
    slateDateNav.includes("<RankedStartsArchiveKeyboard previousHref={previousHref} nextHref={nextHref} />") &&
    slateDateNav.includes("<RankedStartsArchiveStrip activeDate={activeDate} availableDates={availableDates} />") &&
    slateDateNav.includes("<RankedStartsDatePicker activeDate={activeDate} min={minDate} max={maxDate} className={rankedStartsArchiveDatePickerClass} />") &&
    slateDateNav.includes('className="w-full min-w-0 font-mono uppercase"') &&
    slateDateNav.includes('className="relative flex min-w-0 items-stretch rounded border border-white/10 bg-[#101014]/95 p-2"') &&
    !slateDateNav.includes("<RankedEyebrowDateLabel") &&
    !slateDateNav.includes("function RankedEyebrowDateLabel") &&
    !slateDateNav.includes("rankedStartsArchiveStepClass") &&
    !slateDateNav.includes("rankedStartsArchiveStepDisabledClass") &&
    slateDateNav.includes("const rankedStartsArchiveDatePickerClass =") &&
    slateDateNav.includes('"absolute right-2 top-2 inline-flex h-[4.75rem] w-12 items-center justify-center rounded border border-white/10 bg-[#101014]') &&
    slateDateNav.includes("focus-within:border-amber-300/80") &&
    slateDateNav.includes("const minDate = availableDates[0];") &&
    slateDateNav.includes("const maxDate = availableDates.at(-1);") &&
    !slateDateNav.includes("min-w-[23ch]") &&
    startsPage.includes('className="mt-4 grid min-w-0 gap-2" data-responsive-check="ranked-starts-compact-controls"') &&
    startsPage.includes('className="grid min-w-0 justify-items-start gap-3"') &&
    startsPage.includes("availableDates={archiveNavigation.availableDates}") &&
    !startsPage.includes('className="flex flex-wrap items-center justify-between gap-3"') &&
    slateCounts.includes('className="inline-flex min-h-8 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400"') &&
    !slateDateNav.includes("&lt;") &&
    !slateDateNav.includes("&gt;") &&
    !slateDateNav.includes("overflow-hidden rounded border border-white/10") &&
    !slateDateNav.includes('dataArchiveStep="previous"') &&
    !slateDateNav.includes('dataArchiveStep="next"') &&
    rankedStartsArchiveLink.includes('"use client";') &&
    rankedStartsArchiveLink.includes('import { rankedStartsPath } from "@/lib/routes";') &&
    rankedStartsArchiveLink.includes("router.prefetch(href);") &&
    rankedStartsArchiveLink.includes("event.preventDefault();") &&
    rankedStartsArchiveLink.includes("router.push(href);") &&
    rankedStartsArchiveLink.includes("export function RankedStartsArchiveStrip") &&
    rankedStartsArchiveLink.includes('data-slate-strip="ranked-starts"') &&
    rankedStartsArchiveLink.includes("availableDates.map((date, index)") &&
    rankedStartsArchiveLink.includes('ariaCurrent={active ? "page" : undefined}') &&
    rankedStartsArchiveLink.includes("anchorRef={active ? activeChipRef : undefined}") &&
    rankedStartsArchiveLink.includes("strip.scrollTo({") &&
    rankedStartsArchiveLink.includes('[scrollbar-width:none]') &&
    rankedStartsArchiveLink.includes("maskImage: \"linear-gradient(to right, #000 0, #000 calc(100% - 5rem), transparent 100%)\"") &&
    rankedStartsArchiveLink.includes("export function RankedStartsDatePicker") &&
    rankedStartsArchiveLink.includes("value={activeDate}") &&
    rankedStartsArchiveLink.includes("min={min}") &&
    rankedStartsArchiveLink.includes("max={max}") &&
    rankedStartsArchiveLink.includes('data-archive-step="date-picker"') &&
    rankedStartsArchiveLink.includes('type="date"') &&
    rankedStartsArchiveLink.includes("const href = rankedStartsPath(nextDate);") &&
    rankedStartsArchiveLink.includes('event.key === "ArrowLeft" ? previousHref : event.key === "ArrowRight" ? nextHref : null') &&
    slateDateNav.includes('data-responsive-check="ranked-starts-archive-nav"') &&
    !slateDateNav.includes('data-latest-state="latest"') &&
    !slateDateNav.includes(">Latest</span>") &&
    !slateDateNav.includes("Jump to latest") &&
    !slateDateNav.includes('dataLatestState="jump"') &&
    !rankedStartsArchiveLink.includes("dataLatestState") &&
    !rankedStartsArchiveLink.includes("data-latest-state") &&
    !slateDateNav.includes("ranked-start-date-picker") &&
    !slateDateNav.includes("Pick a date") &&
    !slateDateNav.includes('className="mt-5 flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-[0.14em]"') &&
    !globals.includes(".ranked-start-date-picker-summary") &&
    slateDateNav.includes('className={slateRangeToggleClass(option.active)}') &&
    slateDateNav.includes('"border-amber-300 bg-amber-300 text-zinc-950"'),
  "ranked starts header must use archive-only latest slate navigation, promote the date eyebrow, and remove relative Upcoming-style range pills",
);

assert(
  startsPage.includes(">Pitcher Profile</Link>") && !startsPage.includes(">Pitcher</Link>"),
  "ranked starts card CTA must read Pitcher Profile instead of the terse Pitcher label",
);

assert(
  startsPage.includes("function ScoreBridge({ gameScorePlus, gameScoreV2, compact = false }") &&
    startsPage.includes("const delta = gameScorePlus - gameScoreV2;") &&
    startsPage.includes("GSv2 {gameScoreV2} / GS+ {formatSigned(delta)} adj") &&
    startsPage.includes("data-score-bridge") &&
    startsPage.includes("<ScoreBridge gameScorePlus={start.gameScorePlus} gameScoreV2={start.gameScoreV2} />") &&
    startsPage.includes("<ScoreBridge gameScorePlus={start.gameScorePlus} gameScoreV2={start.gameScoreV2} compact />") &&
    startsPage.includes("<ExpandedScoreBreakdown breakdown={start.gameScorePlusBreakdown} gameScoreV2={start.gameScoreV2} />"),
  "ranked starts and start detail surfaces must show GSv2 only as context beside GS+ without changing rank logic",
);

assert(
  startsPage.includes("function StartEventFlagChips({ flags, className = \"\" }") &&
    startsPage.includes("data-start-event-flags={flags.join(\",\")}") &&
    startsPage.includes('if (flag === "HARD_LUCK") return "Hard luck";') &&
    startsPage.includes('return "Vulture";') &&
    startsPage.includes('if (flag === "HARD_LUCK") return "border-sky-300/30 bg-sky-300/10 text-sky-200";') &&
    startsPage.includes("<StartEventFlagChips flags={start.eventFlags}") &&
    !startsPage.includes("sort === \"hard-luck\"") &&
    !startsPage.includes("sort === \"vulture\""),
  "ranked starts event chips must render from canonical HARD_LUCK/VULTURE flags without adding ranked ordering inputs",
);

assert(
  startsPage.includes("function DecisionChip({ result, className = \"\", compact = false }") &&
    startsPage.includes("data-start-decision={result}") &&
    startsPage.includes("Official pitcher decision, shown as context only") &&
    startsPage.includes('if (result === "W") return "Win";') &&
    startsPage.includes('if (result === "L") return "Loss";') &&
    startsPage.includes('return "No decision";') &&
    startsPage.includes("<DecisionChip result={start.result}") &&
    !startsPage.includes("sort === \"result\"") &&
    !startsPage.includes("sort === \"decision\"") &&
    !startsPage.includes("sort === \"win\"") &&
    !startsPage.includes("sort === \"loss\""),
  "ranked starts and start detail surfaces must show pitcher decisions as neutral context without adding decision ranking inputs",
);

assert(
  routes.includes("export function startHref") &&
    startsPage.includes("startHref(start, sourceParams(\"starts\"))") &&
    startsPage.includes("pitcherHref({ id: start.pitcher.id, name: start.pitcher.name }, sourceParams(\"starts\"))"),
  "ranked starts list cards must carry starts source context to start and pitcher entity pages",
);

assert(
  startsPage.includes('const source = parseEntitySource(query?.from, "starts");') &&
    startsPage.includes("<EntityOrientation") &&
    startsPage.includes('<SiteHeader active={null} today={today} responsiveCheck="start-detail-site-header" />') &&
    siteNav.includes("active: NavKey | null"),
  "start detail pages must render neutral nav and source-aware back/breadcrumb orientation",
);

assert(
  !startsPage.includes('href={`${upcomingDateHref(date)}#must-watch`}') &&
    !startsPage.includes('import { slateTimeWord } from "@/lib/time-words";') &&
    !startsPage.includes("still to come {slateTimeWord({ date }, { today })}") &&
    !startsPage.includes("still to come tonight"),
  "ranked starts archive pages must not link partial slates into Upcoming",
);

assert(
  startsPage.includes("pitcherHref({ id: start.pitcher.id, name: start.pitcher.name }, sourceParams(source))"),
  "start detail pitcher links must preserve the current source context",
);

assert(
  startsPage.includes('import { CtaArrow } from "@/components/cta-arrow";') &&
    startsPage.includes("<CtaArrow") &&
    startsPage.includes("Pitcher page") &&
    !startsPage.includes('<span aria-hidden="true">-&gt;</span>'),
  "start detail pitcher page CTA must use the shared drawn arrow treatment",
);

assert(
    types.includes("export type StartArsenalEventSummary") &&
    types.includes("arsenalEventSummary?: StartArsenalEventSummary;") &&
    startService.includes("async function buildStartArsenalEventSummary") &&
    startService.includes("readArchivedPitcherSeasonProfile(start.pitcherMlbId, season)") &&
    startService.includes("candidate.date < date && (candidate.pitchEvents?.length ?? 0) > 0") &&
    startService.includes("const newPitchTypes = [...currentUsage.keys()].filter((type) => !seenPitchTypes.has(type));") &&
    startService.includes(".filter((shift) => Math.abs(shift.usageDeltaPct) >= 8)") &&
    startService.includes("arsenalEventSummary,") &&
    pitchChart.includes("function ArsenalEventPanel") &&
    pitchChart.includes('data-responsive-check="start-arsenal-events"') &&
    pitchChart.includes("New {pitchTypes[type].name}") &&
    pitchChart.includes("Compared with prior archived starts for this pitcher.") &&
    types.includes("arsenalEventSummary?: StartArsenalEventSummary;") &&
    startService.includes("arsenalEventSummary: start.arsenalEventSummary,") &&
    arsenalEventCopy.includes("export function formatArsenalEventHeadline") &&
    arsenalEventCopy.includes("export function formatArsenalEventSentence") &&
    startImage.includes("formatArsenalEventHeadline(start.arsenalEventSummary)") &&
    startImage.includes("{arsenalEvent}") &&
    startRecapPage.includes("formatArsenalEventSentence(start.arsenalEventSummary)") &&
    startRecapPage.includes("recapSummary(start)") &&
    startRecapPage.includes("arsenalSentence ? ` ${arsenalSentence}` : \"\""),
  "start detail pages must surface archived first-seen pitch and major usage-shift events without calling request-time Savant",
);

assert(
    pitchChart.includes('data-responsive-check="start-arsenal-quality"') &&
    pitchChart.includes("function QualityMetric") &&
    pitchChart.includes("summarizePitchEventQuality(pitches)") &&
    pitchChart.includes("function formatPct") &&
    pitchChart.includes('label="CSW"') &&
    pitchChart.includes('label="Whiff"') &&
    pitchChart.includes('label="Zone"') &&
    pitchChart.includes('label="Swing"') &&
    pitchChart.includes("Best CSW") &&
    pitchChart.includes("formatPct(stat.cswPct)") &&
    pitchChart.includes("formatPct(stat.zonePct)") &&
    pitchChart.includes("formatPct(stat.swingPct)") &&
    pitchEventQuality.includes("export function summarizePitchEventQuality") &&
    pitchEventQuality.includes("export function formatPitchEventQualitySentence") &&
    pitchEventQuality.includes("export function isPitchInStrikeZone") &&
    startRecapPage.includes("formatPitchEventQualitySentence(summarizePitchEventQuality(start.pitchEvents))") &&
    startRecapPage.includes("qualitySentence ? ` ${qualitySentence}` : \"\""),
  "start pitch chart and recap pages must share archive-derived arsenal quality metrics without requiring new Statcast fields",
);

assert(
    !startsPage.includes("function RankedSlateStatus") &&
    startsPage.includes("const statusLabel = completionStatusLabel(completionState, slateProgress);") &&
    startsPage.includes("<SlateCounts") &&
    slateCounts.includes('className="ranked-live-dot h-2 w-2 rounded-full bg-[#FF5A1F]"') &&
    startsPage.includes('if (state.isPast || state.isFinal || slateProgress.state === "all-starts-complete") return `SLATE COMPLETE · ${state.totalStarts} STARTS`;') &&
    startsPage.includes('if (!state.isToday) return `PROBABLES · ${state.totalGames} GAMES`;') &&
    startsPage.includes("return inProgressStartsLabel(state);") &&
    startsPage.includes("function inProgressStartsLabel(state: { completedStarts: number; liveStarts: number; totalStarts: number })") &&
    startsPage.includes("const upcomingStarts = Math.max(0, state.totalStarts - finalStarts - liveStarts);") &&
    startsPage.includes('const upcomingSegment = upcomingStarts > 0 ? ` · ${upcomingStarts} UPCOMING` : "";') &&
    startsPage.includes("return `${finalStarts} FINAL · ${liveStarts} IN PROGRESS${upcomingSegment}`;") &&
    slateCounts.includes("function rankedProgressStatusLabel(progress: SlateProgressState)") &&
    slateCounts.includes('if (progress.state === "all-starts-complete") return `SLATE COMPLETE · ${progress.totalStarts} STARTS`;') &&
    slateCounts.includes("if (progress.liveStarts > 0 || progress.state === \"starts-in-progress\") return inProgressStartsLabel(progress);") &&
    slateCounts.includes("return `${finalStarts} FINAL · ${liveStarts} IN PROGRESS${upcomingSegment}`;") &&
    startsPage.includes('return `WARMING · FIRST PITCH ${firstPitchLabel}`;') &&
    startsPage.includes('return `PROBABLES · FIRST PITCH ${firstPitchLabel}`;') &&
    startService.includes("const completedStartsInLiveGames = Math.min(liveGames * 2, Math.max(0, completedStarts - completedStartsInFinalGames));") &&
    startService.includes("const liveStarts = Math.max(0, liveGames * 2 - completedStartsInLiveGames);") &&
    slateState.includes('if (start.source?.line === "live-gamefeed" && start.source.lineStatus === "final") return "final";') &&
    slateState.includes('if (start.source?.line === "live-gamefeed") return "live";') &&
    startsPage.includes("function formatRankedFirstPitch") &&
    !startsPage.includes("formatSlateCountdownLabel") &&
    !startsPage.includes("first starter toes the slab") &&
    !startsPage.includes("function formatFirstPitchStamp") &&
    !startsPage.includes("{date} / completed starts recap"),
  "ranked starts header must use viewed-date scoped functional copy and remove the redundant ISO date line",
);

const rankedLiveFixture = { completedStarts: 2, liveStarts: 2, totalStarts: 18 };
const rankedLiveUpcomingStarts = Math.max(0, rankedLiveFixture.totalStarts - rankedLiveFixture.completedStarts - rankedLiveFixture.liveStarts);
const rankedLiveFixtureLabel = `${rankedLiveFixture.completedStarts} FINAL · ${rankedLiveFixture.liveStarts} IN PROGRESS${rankedLiveUpcomingStarts > 0 ? ` · ${rankedLiveUpcomingStarts} UPCOMING` : ""}`;
assert(
  rankedLiveFixtureLabel === "2 FINAL · 2 IN PROGRESS · 14 UPCOMING",
  "ranked starts live status fixture must partition final, in-progress, and upcoming starts",
);

const rankedPregameNothingThrownFixture = { liveStarts: 0, completedStarts: 0 };
const rankedFirstPitchThrownFixture = { liveStarts: 2, completedStarts: 0 };
assert(
  (rankedPregameNothingThrownFixture.liveStarts > 0 || rankedPregameNothingThrownFixture.completedStarts > 0) === false &&
    (rankedFirstPitchThrownFixture.liveStarts > 0 || rankedFirstPitchThrownFixture.completedStarts > 0) === true &&
    startService.includes("return state.liveStarts > 0 || state.completedStarts > 0;"),
  "ranked starts resolver fixtures must keep pregame zero-thrown on yesterday and first-pitch/live slates on today",
);

assert(
  startsPage.includes('data-responsive-check="ranked-starts-empty-state"') &&
    startsPage.includes("<RankedStartsArchiveNav") &&
    startsPage.indexOf("<RankedStartsArchiveNav") < startsPage.indexOf("{starts.length > 0 ? (") &&
    startsPage.includes("<SlateCounts") &&
    startsPage.indexOf("<SlateCounts") < startsPage.indexOf("{starts.length > 0 ? (") &&
    startsPage.includes("const previousRankedDate = archiveNavigation.previousDate ?? (archiveNavigation.latestDate !== date ? archiveNavigation.latestDate : null);") &&
    startsPage.includes("const showLiveEmptyCta = completionState.liveStarts > 0 || completionState.warmingStarts > 0;") &&
    startsPage.includes("function emptyRankedStartsCopy(state: { liveStarts: number })") &&
    startsPage.includes('return `No starts have gone final yet. ${state.liveStarts} in progress now.`;') &&
    startsPage.includes('return "No starts have gone final yet today.";') &&
    startsPage.includes('direction="back"') &&
    startsPage.includes("Yesterday&apos;s slate") &&
    startsPage.includes("Follow today live") &&
    startsPage.includes("liveDateHref(date)") &&
    ctaArrow.includes('direction?: "back" | "forward";') &&
    ctaArrow.includes('data-cta-arrow-direction={direction}') &&
    ctaArrow.includes('direction="back"') &&
    ctaArrow.includes('data-cta-arrow-tail-direction={direction}') &&
    ctaArrow.includes('isBack ? "flex-row-reverse" : ""') &&
    ctaArrow.includes("whitespace-nowrap") &&
    !ctaArrow.includes("truncate") &&
    !startsPage.includes("Final gamefeed data has not settled for this date yet.") &&
    !startsPage.includes("No completed starts ready"),
  "ranked starts empty state must keep shell navigation/status visible, use helpful CTAs, and avoid pipeline vocabulary",
);

assert(
  startsPage.includes('className="mt-4 grid min-w-0 gap-2" data-responsive-check="ranked-starts-compact-controls"') &&
    startsPage.includes('className="grid min-w-0 justify-items-start gap-3"') &&
    !startsPage.includes('className="flex flex-wrap items-center justify-between gap-3"') &&
    slateCounts.includes('className="inline-flex min-h-8 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400"') &&
    startsPage.includes('storageKey="ranked-starts-method-open" label="How rankings work"') &&
    startsPage.includes('className="w-fit text-amber-300 underline-offset-4 hover:underline" href="/methodology"') &&
    !startsPage.includes("border-amber-300/30 bg-amber-300/10 px-3"),
  "ranked starts header status and methodology must live in the compact controls with a quiet status pill",
);

assert(
  !startsPage.includes(">Short outings</span>") &&
    startsPage.includes('data-responsive-check="ranked-starts-openers"') &&
    startsPage.includes("Openers & short outings · {shortStarts.length}") &&
    startsPage.includes('<ControlLink active={showOpeners} href={rankedStartsHref(date, { band, sort, showOpeners: !showOpeners })} scroll={false}>') &&
    startsPage.includes("function ControlLink({ active, href, children, color, scroll = true }") &&
    startsPage.includes("scroll={scroll}"),
  "ranked starts opener/short-outing controls must live only in the lower openers section and preserve scroll on toggle",
);

assert(
  types.includes("plannedStarter?: boolean;") &&
    startService.includes("const ESTABLISHED_STARTER_MIN_SEASON_STARTS = 5;") &&
    startService.includes("const ESTABLISHED_STARTER_MIN_AVG_IP = 4;") &&
    startService.includes("async function getEstablishedStarterPitcherIds") &&
    startService.includes("hasEstablishedStarterWorkload(profile)") &&
    startService.includes("const plannedStarter = probablePitcherIds.has(pitcher.id) || establishedStarterIds.has(pitcher.id);") &&
    startService.includes("plannedStarter,") &&
    startClassification.includes("export function isRankedRegularStart") &&
    startClassification.includes("const RANKED_START_IP_FLOOR = 2;") &&
    startClassification.includes("return inningsFromIP(start.line.inningsPitched) >= RANKED_START_IP_FLOOR;") &&
    !startClassification.includes("isPlannedStarter(start) || inningsFromIP(start.line.inningsPitched) >= RANKED_START_IP_FLOOR") &&
    startsPage.includes('import { isRankedRegularStart } from "@/lib/start-classification";') &&
    startsPage.includes("return isRankedRegularStart(start);") &&
    startsPage.includes("Board ranks starts of 2.0+ innings; openers and short outings are listed separately.") &&
    startsPage.includes("Starts under 2.0 innings are kept out of the ranked positions but remain visible for slate completeness.") &&
    methodologyPage.includes("Daily boards rank qualified starts of at least 2.0 IP; openers and short outings are listed separately.") &&
    !methodologyPage.includes("Daily boards rank qualified starts of at least 3.0 IP;") &&
    formService.includes('import { isScoredStarterSample } from "@/lib/start-classification";') &&
    formService.includes("isScoredStarterSample(start, FORM_CONFIG.ipFloor)"),
  "ranked starts must use a hard 2.0 IP eligibility floor while planned-starter workload remains available for form scoring",
);

assert(
    startsPage.includes('import { TopPerformerCard } from "@/components/top-performer-card";') &&
    startsPage.includes('import { resolveTopPerformerImage } from "@/lib/data/top-performer-image-service";') &&
    startsPage.includes('import { resolveTopPerformerMetrics } from "@/lib/data/top-performer-metrics";') &&
    startsPage.includes("const qualifiedStarts = rankStarts(starts.filter(isQualifiedRankedStart));") &&
    startsPage.includes("validateRankedStartOrder(qualifiedStarts);") &&
    startsPage.includes('slateProgress.state === "all-starts-complete"') &&
    startsPage.includes('data-responsive-check="ranked-starts-archived-hero"') &&
    startsPage.includes("resolveArchivedStartOfDayHero") &&
    startsPage.includes("function rankedStartVenueLine(start: StartSummary)") &&
    startsPage.includes("const venue = start.context.parkLabel;") &&
    !startsPage.includes('const contextLabel = start.context.label.split(" / ").at(-1) ?? start.context.label;') &&
    startsPage.includes('status: "archived" as const') &&
    startsPage.includes("resolveTopPerformerMetrics(start),") &&
    startsPage.includes("topVelo: metrics?.topVelo ?? null,") &&
    startsPage.includes("whiffRate: metrics?.whiffRate ?? null,") &&
    startsPage.includes("veloSparkline: metrics?.veloSparkline ?? [],") &&
    startsPage.includes('resolvedImage?.source === "action" ? resolvedImage : null') &&
    topPerformerCard.includes('status: "final" | "live" | "previous" | "archived";') &&
    topPerformerCard.includes('const noPhoto = status === "archived" && !imageUrl;') &&
    globals.includes(".top-performer-card {\n  opacity: 1;\n  transform: none;\n}") &&
    !globals.includes(".top-performer-card {\n  opacity: 0;") &&
    !globals.includes(".top-performer-card.is-visible {\n  opacity: 1;\n  transform: translateY(0);\n}") &&
    topPerformerCard.includes('eyebrow: `START OF THE DAY · ${dateLabel.toUpperCase()}`,') &&
    topPerformerCard.includes('data-top-performer-photo={noPhoto ? "none" : imageUrl ? "action" : "empty"}') &&
    startRanking.includes("const { rank: _staleRank, ...rest } = start;") &&
    startRanking.includes("export function validateRankedStartOrder"),
  "settled ranked pages must derive rank after canonical score overlay and render the shared archived Start of the Day hero with a no-photo variant",
);

for (const fixture of archivedStartOfDayActionFixtures) {
  const metadata = JSON.parse(await readFile(fixture.metadataPath, "utf8"));
  const hasAllowedActionUrl =
    typeof metadata.imageUrl === "string" &&
    (metadata.imageUrl.startsWith("/images/top-performer-action-shots/") ||
      metadata.imageUrl.startsWith("https://img.mlbstatic.com/mlb-images/image/upload/") ||
      metadata.imageUrl.startsWith("https://images2.minutemediacdn.com/image/upload/") ||
      metadata.imageUrl.startsWith("https://s.hdnux.com/photos/"));

  assert(
    metadata.clean === true &&
      Number.isFinite(metadata.focalPoint?.x) &&
      Number.isFinite(metadata.focalPoint?.y) &&
      metadata.focalPoint.x >= 0 &&
      metadata.focalPoint.x <= 100 &&
      metadata.focalPoint.y >= 0 &&
      metadata.focalPoint.y <= 100 &&
      hasAllowedActionUrl,
    `archived Start of the Day action photo fixture must stay curator-clean with focal point metadata: ${fixture.date} ${fixture.pitcher}`,
  );
}

for (const leader of await readArchivedStartOfDayLeaders()) {
  const metadataPath = `public/images/top-performer-action-shots/${leader.startId}-mlb-action-v4.json`;
  assert(
    existsSync(metadataPath),
    `every archived 2026 Start of the Day leader must have stored action-photo metadata: ${leader.date} ${leader.pitcherName}`,
  );

  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  const hasAllowedActionUrl =
    typeof metadata.imageUrl === "string" &&
    (metadata.imageUrl.startsWith("/images/top-performer-action-shots/") ||
      metadata.imageUrl.startsWith("https://img.mlbstatic.com/mlb-images/image/upload/") ||
      metadata.imageUrl.startsWith("https://images2.minutemediacdn.com/image/upload/") ||
      metadata.imageUrl.startsWith("https://s.hdnux.com/photos/"));

  assert(
    metadata.clean === true &&
      metadata.startId === leader.startId &&
      typeof metadata.alt === "string" &&
      metadata.alt.toLowerCase().includes("pitching action") &&
      Number.isFinite(metadata.focalPoint?.x) &&
      Number.isFinite(metadata.focalPoint?.y) &&
      metadata.focalPoint.x >= 0 &&
      metadata.focalPoint.x <= 100 &&
      metadata.focalPoint.y >= 0 &&
      metadata.focalPoint.y <= 100 &&
      hasAllowedActionUrl,
    `archived 2026 Start of the Day action photo must stay stored, curator-clean, and mobile-croppable: ${leader.date} ${leader.pitcherName}`,
  );
}

assert(
  startsPage.includes('import { SlateCounts } from "@/components/slate-counts";') &&
    startsPage.includes("const statusLabel = completionStatusLabel(completionState, slateProgress);") &&
    startsPage.includes("<SlateCounts") &&
    startsPage.includes("initialLabel={statusLabel}") &&
    startsPage.includes("initialState={slateProgress}") &&
    startsPage.includes('variant="ranked"') &&
    !startsPage.includes("function RankedSlateStatus(") &&
    slateCounts.includes('"use client";') &&
    slateCounts.includes("void refresh();") &&
    slateCounts.includes("fetch(`/api/home/status?date=${encodeURIComponent(initialState.date)}`, { cache: \"no-store\" })") &&
    slateCounts.includes("if (shouldContinuePolling)") &&
    slateCounts.includes("window.setTimeout(refresh, SLATE_COUNTS_POLL_MS)") &&
    slateCounts.includes('data-responsive-check="ranked-slate-status-island"') &&
    slateCounts.includes('data-slate-live-starts={state.liveStarts}') &&
    homeStatusRoute.includes('export const dynamic = "force-dynamic";') &&
    homeStatusRoute.includes('"Cache-Control": "no-store"'),
  "ranked starts status strip must hydrate live counts as a no-store slate-state island with one mount poll and live-only continued polling",
);

assert(
  startsPage.includes("grid-cols-[minmax(0,1fr)_minmax(64px,auto)] sm:grid-cols-[48px_64px_minmax(0,1fr)_auto_auto]") &&
    startsPage.includes("grid-cols-[minmax(0,1fr)_minmax(66px,auto)] sm:grid-cols-[48px_52px_minmax(0,1fr)_auto_auto]") &&
    startsPage.includes("grid-cols-[minmax(0,1fr)_minmax(58px,auto)] sm:grid-cols-[48px_40px_minmax(0,1fr)_auto_auto]"),
  "ranked starts rows must use fixed rank/photo/meta/reserved-score grid columns by tier",
);

assert(
  startsPage.includes("rounded border border-[#F6C445]/35") &&
    startsPage.includes("border-b border-white/10") &&
    startsPage.includes("gap-x-4") &&
    startsPage.includes("sm:text-right"),
  "ranked starts rows must use uniform gas outlines, field hairlines, 16px column gap, and right-aligned terminal stats/score",
);

assert(
  startsPage.includes("plateClass: \"!h-[55px] !w-11 sm:!h-20 sm:!w-16\"") &&
    startsPage.includes("plateClass: \"!h-[55px] !w-11 sm:!h-[65px] sm:!w-[52px]\"") &&
    startsPage.includes("plateClass: \"!h-[50px] !w-10\""),
  "ranked starts headshot plates must use tiered 4:5 dimensions",
);

assert(
  globals.includes(".ranked-start-plate") &&
    globals.includes("background: #15181C !important;") &&
    globals.includes("border: 1.5px solid color-mix(in srgb, var(--ranked-band-color, #878D97) 45%, transparent) !important;") &&
    globals.includes("object-fit: cover;") &&
    globals.includes("object-position: center 18%;"),
  "ranked starts headshot plates must use neutral backgrounds, band-tinted rings, and consistent cover crop",
);

assert(
  startsPage.includes('"--ranked-band-color": profile.railColor') &&
    startsPage.includes("relative scroll-mt-28 overflow-hidden") &&
    startsPage.includes("sm:pr-20") &&
    startsPage.includes("[&::-webkit-details-marker]:hidden") &&
    startsPage.includes("Toggle breakdown for ${start.pitcher.name}") &&
    !startsPage.includes('className="ranked-start-toggle-label"') &&
    !startsPage.includes(">Breakdown</span>") &&
    startsPage.includes('className="ranked-start-toggle-icon"') &&
    startsPage.includes('className="ranked-start-toggle-chevron"') &&
    !startsPage.includes("⌄") &&
    !globals.includes(".ranked-start-details[open] > summary") &&
    !globals.includes("border-top-color: rgb(255 255 255 / 0.1);") &&
    globals.includes(".ranked-start-toggle-icon") &&
    !globals.includes(".ranked-start-toggle-label") &&
    globals.includes(".ranked-start-toggle-chevron") &&
    globals.includes(".ranked-start-details > summary::marker") &&
    globals.includes(".ranked-start-details > summary::-webkit-details-marker") &&
    globals.includes("position: relative;") &&
    globals.includes("margin-left: auto;") &&
    globals.includes("right: 16px;") &&
    globals.includes("top: 14px;") &&
    globals.includes("min-height: 44px;") &&
    globals.includes("min-width: 44px;") &&
    globals.includes("width: 44px;") &&
    !rankedStartSummaryRule.includes("width: 100%;") &&
    !rankedStartSummaryRule.includes("height: 100%;") &&
    globals.includes("border-bottom: 2px solid currentColor;") &&
    globals.includes("border-right: 2px solid currentColor;") &&
    globals.includes("transform: translateY(-1px) rotate(45deg);") &&
    globals.includes(".ranked-start-details[open] .ranked-start-toggle-chevron") &&
    globals.includes("transform: translateY(2px) rotate(225deg);") &&
    globals.includes("@keyframes ranked-live-dot-pulse") &&
    globals.includes("animation: ranked-live-dot-pulse 2s ease-in-out infinite;"),
  "ranked starts rows must expose band ring color, use a styled CSS chevron accordion control, and pulse the live dot only through CSS",
);

console.log("starts page contract ok: completed date chips include weekday, ranked cards source-link entities, and start detail pages show neutral source orientation");
