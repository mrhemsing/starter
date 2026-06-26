import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const rankedRoute = await readFile("src/app/api/home/ranked/route.ts", "utf8");
const homePage = await readFile("src/app/page.tsx", "utf8");
const homeDeferredSections = await readFile("src/components/home-deferred-sections.tsx", "utf8");
const topPerformerCard = await readFile("src/components/top-performer-card.tsx", "utf8");
const heatHighlightModal = await readFile("src/components/heat-highlight-modal.tsx", "utf8");
const featuredStartHighlight = await readFile("src/components/featured-start-highlight.tsx", "utf8");
const mustWatch = await readFile("src/components/tonights-must-watch.tsx", "utf8");
const pitchingDuels = await readFile("src/components/pitching-duels.tsx", "utf8");
const rankedRecap = await readFile("src/components/ranked-starts-recap.tsx", "utf8");
const startService = await readFile("src/lib/data/start-service.ts", "utf8");
const rankedService = await readFile("src/lib/data/home-ranked-service.ts", "utf8");
const duelsService = await readFile("src/lib/data/duels-service.ts", "utf8");
const imageService = await readFile("src/lib/data/top-performer-image-service.ts", "utf8");
const featuredHighlightService = await readFile("src/lib/data/featured-highlight-service.ts", "utf8");

assert(
  rankedRoute.includes('import { getRankedHome, HOME_RANKED_REVALIDATE_SECONDS } from "@/lib/data/home-ranked-service";') &&
    rankedRoute.includes("return NextResponse.json(await getRankedHome(), {") &&
    rankedRoute.includes('"Cache-Control": `public, s-maxage=${HOME_RANKED_REVALIDATE_SECONDS}, stale-while-revalidate=300`'),
  "home ranked API must delegate to the shared ranked-home service",
);

assert(
  rankedService.includes('import { resolveTopPerformerImage, type TopPerformerImage } from "@/lib/data/top-performer-image-service";'),
  "home ranked service must use the top performer image resolver",
);

assert(
  rankedService.includes('import { resolveFeaturedStartHighlight } from "@/lib/data/featured-highlight-service";') &&
    rankedService.includes('import type { FeaturedStartHighlight, PitchEvent, StartSummary } from "@/lib/types";') &&
    rankedService.includes("highlight: FeaturedStartHighlight | null;") &&
    rankedService.includes("resolveFeaturedStartHighlight(state.start),") &&
    homeDeferredSections.includes("highlight={ranked.topPerformer.highlight}") &&
    featuredHighlightService.includes('"2026-06-25-hou-det-837227": "fSu5y2kmChE"') &&
    featuredHighlightService.includes('const MLB_CHANNEL_HANDLE = "MLB";') &&
    featuredHighlightService.includes('const YOUTUBE_SEARCH_ENABLED = process.env.YOUTUBE_SEARCH_ENABLED === "1";') &&
    featuredHighlightService.includes("readSupabaseFeaturedStartHighlight(start.id)") &&
    featuredHighlightService.includes("resolveYouTubeHighlight(start)") &&
    featuredHighlightService.includes('source,') &&
    featuredHighlightService.includes('embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`') &&
    featuredHighlightService.includes('watchUrl: `https://www.youtube.com/watch?v=${videoId}`'),
  "home top performer must resolve MLB YouTube highlights from manual seeds, stored ingest, or official-channel search and pass them into the Start of the Night card",
);

assert(
  rankedService.includes('import { isRankedRegularStart } from "@/lib/start-classification";') &&
    rankedService.includes("const todayCompletedSlateStarts = todaySlateStarts.filter(isCompletedRankedStart);") &&
    rankedService.includes("const yesterdayRankedStarts = yesterdaySlateStarts.filter(isCompletedRankedStart);") &&
    rankedService.includes("function isCompletedRankedStart(start: StartSummary)") &&
    rankedService.includes('return start.source?.line !== "fixture" && isRankedRegularStart(start);'),
  "home Start of the Day must use the shared ranked-start 2.0 IP floor instead of raw completed-start ordering",
);

assert(
  rankedRecap.includes('import { isRankedRegularStart } from "@/lib/start-classification";') &&
    rankedRecap.includes('start.source?.line !== "fixture" && isRankedRegularStart(start)') &&
    rankedRecap.includes("Final 2.0+ inning starter lines only: {rankedStarts.length} scored starts from the completed slate, ranked by GS+."),
  "home ranked recap must apply the same 2.0 IP ranked-start floor",
);

assert(
  rankedService.includes("const topPerformer = await resolveTopPerformerPayload(topPerformerState);") &&
    rankedService.includes("async function resolveTopPerformerPayload(state: TopPerformerState | null): Promise<TopPerformerPayload | null>") &&
    rankedService.includes("if (!state) return null;") &&
    rankedService.includes("resolveFeaturedStartHighlight(state.start),") &&
    rankedService.includes("resolveTopPerformerImage(state.start, null),") &&
    rankedService.includes("resolveTopPerformerMetrics(state.start),"),
  "home ranked service must resolve highlight, action-photo imagery, and metrics every time a selected top performer is exposed",
);

assert(
  rankedService.includes("topPerformer: TopPerformerPayload | null;") &&
    rankedService.includes("type TopPerformerPayload = TopPerformerState &") &&
    rankedService.includes("return { ...state, highlight, image, metrics };") &&
    rankedService.includes("topPerformer,"),
  "home ranked service must include highlight and image in the topPerformer payload",
);

assert(
  rankedService.includes("async function resolveTopPerformerMetrics(start: StartSummary | null)") &&
    rankedService.includes("const detail = await getStartDetail(start.id);") &&
    rankedService.includes("veloSparkline: velocityTrend.map((inning) => inning.avgVelocityMph),"),
  "home ranked service must enrich the top performer with real start-detail velocity metrics",
);

assert(
  startService.includes("function shouldFetchLivePitchDetails(date: string, scheduleSource: MlbSchedule[\"source\"])") &&
    startService.includes('return scheduleSource === "live" || shouldFetchLiveSchedule(date);') &&
    startService.includes("fetchLive: shouldFetchLivePitchDetails(schedule.date, schedule.source)") &&
    startService.includes("gamefeedRevalidateSeconds: LIVE_STARTER_RESULT_REVALIDATE_SECONDS"),
  "home ranked live top performer velocity metrics must fetch gamefeed pitch detail without relying on THE_BUMP_LIVE_MLB",
);

assert(
  homeDeferredSections.includes('import type { RankedHomeResponse } from "@/lib/data/home-ranked-service";'),
  "home ranked client response type must use the shared ranked-home response",
);

assert(
  homeDeferredSections.includes("export type HomeDeferredInitialData = {") &&
    homeDeferredSections.includes("todayWatch?: TonightResponse | null;") &&
    homeDeferredSections.includes("duels?: PitchingDuelsResponse | null;") &&
    homeDeferredSections.includes("ranked?: RankedHomeResponse | null;"),
  "home deferred sections must accept server-prefetched initial data for the top homepage modules",
);

assert(
  homePage.includes('import { getPitchingDuels } from "@/lib/data/duels-service";') &&
    homePage.includes('import { getRankedHome } from "@/lib/data/home-ranked-service";') &&
    homePage.includes('import { getTonightMustWatch } from "@/lib/data/tonight-service";') &&
    homePage.includes('import type { TonightResponse } from "@/lib/types";') &&
    homePage.includes("const todayWatchPromise = getTonightMustWatch({ date: today, window: 5 }).catch(() => null);") &&
    homePage.includes("const duelsPromise = todayWatchPromise") &&
    homePage.includes('getPitchingDuels(hasPregameWatchGames(watch) ? today : tomorrow, "upcoming")') &&
    homePage.includes("function hasPregameWatchGames(watch: TonightResponse | null)") &&
    homePage.includes('watch?.games.some((game) => game.status === "pregame") ?? false') &&
    homePage.includes("<HomeDeferredSections") &&
    homePage.includes("initialData={{") &&
    homePage.includes("ranked,") &&
    homePage.includes("todayWatch,") &&
    homePage.includes("duels,"),
  "homepage must server-prefetch ranked, must-watch, and duels data before rendering the client sections",
);

assert(
  duelsService.includes('["pitching-duels", "v2"]') &&
    duelsService.includes('game.status === "pregame"') &&
    duelsService.includes("firstPitch: game.firstPitch,") &&
    !duelsService.includes('game.status === "pregame" || game.status === "live"'),
  "homepage upcoming duels must only include true pregame matchups so live/final starts do not remain under Closest Matchups",
);

assert(
  pitchingDuels.includes('import { LocalTime } from "@/components/local-time";') &&
    pitchingDuels.includes("data-first-pitch={duel.firstPitch ?? undefined}") &&
    pitchingDuels.includes("Start{\" \"}") &&
    pitchingDuels.includes("<LocalTime value={duel.firstPitch} fallback={formatFirstPitch(duel.firstPitch)} />") &&
    pitchingDuels.includes("function formatFirstPitch(value: string)") &&
    pitchingDuels.includes('timeZone: process.env.THE_BUMP_TIME_ZONE ?? "America/Los_Angeles"'),
  "homepage closest matchup duel cards must render scheduled start time from firstPitch",
);

assert(
  homeDeferredSections.includes("image={ranked.topPerformer.image}"),
  "home deferred top performer card must pass through the ranked API image",
);

assert(
  homeDeferredSections.includes('title="Must-Watch Games"') && !homeDeferredSections.includes('title="Tonight\\\'s Must-Watch Games"'),
  "home must-watch section title must read Must-Watch Games without the Tonight prefix",
);

assert(
  homeDeferredSections.includes("const HOME_MUST_WATCH_LIVE_MAX_AGE_MS = 60 * 60 * 1000;") &&
    homeDeferredSections.includes("function filterHomeMustWatchGames(watch: TonightResponse | null, nowMs: number)") &&
    homeDeferredSections.includes('if (game.status !== "live") return true;') &&
    homeDeferredSections.includes("return nowMs - firstPitchMs <= HOME_MUST_WATCH_LIVE_MAX_AGE_MS;") &&
    homeDeferredSections.includes("const activeTodayWatch = filterHomeMustWatchGames(todayWatch, nowMs);") &&
    homeDeferredSections.includes("const watch = activeTodayWatch?.games.length ? activeTodayWatch : activeTomorrowWatch;"),
  "home must-watch should remove live games once first pitch is more than one hour old before choosing today vs tomorrow",
);

assert(
  mustWatch.includes("card-title mt-2 font-serif text-[1.8rem] font-bold text-zinc-50 lg:text-[2.4rem]") &&
    mustWatch.includes("card-title font-serif text-[1.2rem] font-bold text-zinc-50") &&
    !mustWatch.includes("card-title mt-2 font-serif text-4xl font-bold text-zinc-50 lg:text-5xl") &&
    !mustWatch.includes("card-title font-serif text-2xl font-bold text-zinc-50"),
  "home must-watch game-name titles must stay 20% smaller than the prior 4xl/5xl and 2xl treatment",
);

assert(
  homeDeferredSections.includes("topVelo={ranked.topPerformer.metrics?.topVelo ?? null}") &&
    homeDeferredSections.includes("veloSparkline={ranked.topPerformer.metrics?.veloSparkline ?? []}") &&
    homeDeferredSections.includes("whiffRate={ranked.topPerformer.metrics?.whiffRate ?? null}"),
  "home deferred top performer card must pass through ranked API velocity metrics",
);

assert(
  homeDeferredSections.includes('window.setInterval(() => {') &&
    homeDeferredSections.includes('fetchJson<RankedHomeResponse>("/api/home/ranked").then(setIfLive(setRanked)).catch(() => undefined);') &&
    homeDeferredSections.includes("}, 60 * 1000);") &&
    homeDeferredSections.includes("window.clearInterval(rankedRefresh);"),
  "home ranked hero must revalidate in-session so hidden/live/final states update without manual reload",
);

assert(
  !homeDeferredSections.includes("image={null}"),
  "home deferred top performer card must not hardcode a null image",
);

assert(
  !homeDeferredSections.includes("highlight={null}"),
  "home deferred top performer card must not hardcode a null highlight",
);

assert(
  topPerformerCard.includes('const imageObjectPosition = image?.objectPosition ?? (isPlaceholderImage ? "50% 45%" : "50% 50%");') &&
    topPerformerCard.includes('className="object-cover"') &&
    topPerformerCard.includes("style={{ objectPosition: imageObjectPosition }}"),
  "home top performer real images must cover the frame and honor player-focused image framing",
);

assert(
  topPerformerCard.includes('status: "final" | "live" | "previous";') &&
    topPerformerCard.includes("const statusLabel = formatTopPerformerStatusLabel(status, dateLabel);") &&
    topPerformerCard.includes('const isLiveLeader = status === "live";') &&
    topPerformerCard.includes('eyebrow: "Live GS+ leader"') &&
    topPerformerCard.includes('detail: `Today, ${dateLabel}`') &&
    topPerformerCard.includes('className="ranked-live-dot h-2 w-2 rounded-full bg-[#FF5A1F]"') &&
    topPerformerCard.includes('eyebrow: "Start of the night"') &&
    homeDeferredSections.includes("status={ranked.topPerformer.status}") &&
    !homeDeferredSections.includes("isProvisional={ranked.topPerformer.status === \"live\"}"),
  "home top performer must label live leaders with broadcast live copy and final/previous winners as Start of the Night",
);

assert(
  topPerformerCard.includes('function formatTopPerformerStatusLabel(status: "final" | "live" | "previous", dateLabel: string)') &&
    topPerformerCard.includes('if (status === "live")') &&
    !topPerformerCard.includes('const livePrefix = "Live leader · ";') &&
    !topPerformerCard.includes("The one to beat") &&
    !topPerformerCard.includes("games final"),
  "home top performer live label must not repeat the slate final-count detail",
);

assert(
  topPerformerCard.includes('font-mono text-[10px] uppercase leading-[1.25] tracking-[0.22em] text-[#F6C445]') &&
    topPerformerCard.includes('<TopPerformerEyebrow live={isLiveLeader} label={statusLabel.eyebrow} />') &&
    topPerformerCard.includes('<span className="mt-1 block">{statusLabel.detail}</span>') &&
    topPerformerCard.includes('font-mono text-[10px] uppercase leading-[1.25] tracking-[0.16em] text-[#F6C445]') &&
    topPerformerCard.includes('<TopPerformerEyebrow live={isLiveLeader} label={statusLabel.eyebrow} compact />') &&
    topPerformerCard.includes('<span className="mt-1 block nowrap-token">{statusLabel.detail}</span>'),
  "home top performer status detail must render on a forced tight new line on desktop and mobile",
);

assert(
  topPerformerCard.includes('className="grid grid-cols-2 gap-2 lg:flex"') &&
    topPerformerCard.includes('inline-flex min-h-11 w-full items-center justify-center gap-1 rounded border border-[#F6C445]/50 bg-[#F6C445] px-2 text-center font-mono text-[10px] uppercase tracking-[0.08em] text-[#0A0B0D]') &&
    topPerformerCard.includes('inline-flex min-h-11 items-center justify-center rounded border border-[#F6C445]/40 px-2 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-[#F6C445]') &&
    topPerformerCard.includes('label="Video highlights"') &&
    topPerformerCard.includes("Game log") &&
    !topPerformerCard.includes("View game log") &&
    !topPerformerCard.includes("View log") &&
    !topPerformerCard.includes("justify-center rounded border border-white/15"),
  "home top performer must show Video highlights beside Game log in a two-column mobile CTA row with the yellow slate button treatment",
);

assert(
  featuredStartHighlight.includes("loadImmediately?: boolean;") &&
    featuredStartHighlight.includes("const shouldLoadPlayer = loadImmediately || isLoaded;") &&
    heatHighlightModal.includes("<FeaturedStartHighlightEmbed highlight={highlight} pitcherName={pitcherName} loadImmediately />"),
  "highlight modal must skip the local fake poster and open directly to the YouTube player",
);

assert(
  heatHighlightModal.includes('eyebrow = "Recent MLB highlight"') &&
    heatHighlightModal.includes("{eyebrow}") &&
    topPerformerCard.includes("eyebrow={statusLabel.eyebrow}") &&
    topPerformerCard.includes('eyebrow: "Start of the night"'),
  "home top performer highlight modal must use the Start of the Night eyebrow instead of the generic recent-highlight label",
);

assert(
  topPerformerCard.includes('const hasVeloData = veloSparkline.length > 1 || typeof topVelo === "number" || typeof whiffRate === "number";'),
  "home top performer card must detect real velocity data before rendering the velocity panel",
);

assert(
  !topPerformerCard.includes("top velo pending"),
  "home top performer card must not render an empty pending velocity chart",
);

assert(
  rankedService.includes('const [todayCompletion, slateProgress] = await Promise.all([') &&
    rankedService.includes('getSlateStartProgress({ window: "today", date: today }),') &&
    rankedService.includes("todayCompletion.completedStarts > 0") &&
    rankedService.includes('areTodayStartsComplete: slateProgress.state === "all-starts-complete",') &&
    rankedService.includes("if (areTodayStartsComplete)") &&
    !rankedService.includes("const slateProgress = getSlateProgressState(todaySchedule);"),
  "home top performer gating must use shared starter-outing progress",
);

assert(
  rankedService.includes("if (isTodaySlateStarted)") &&
    rankedService.includes("if (!todayLeader || todayLeader.gameScorePlus < LIVE_TOP_PERFORMER_FLOOR) return null;") &&
    rankedService.includes("const LIVE_TOP_PERFORMER_FLOOR = 50;") &&
    rankedService.includes('["home-ranked", "v7"]'),
  "home top performer must unmount after first pitch until a qualifying solid GS+ 50 contender posts",
);

assert(
  rankedService.includes('import { getLiveScoreboard, type LiveScoreboard } from "@/lib/data/live-scoreboard-service";') &&
    rankedService.includes("const liveBoard = slateProgress.state === \"starts-in-progress\" ? await getLiveScoreboard({ date: today }) : null;") &&
    rankedService.includes("const liveLeader = resolveLiveLeaderStart(liveBoard, todaySlateStarts);") &&
    rankedService.includes("href: liveDateHref(today),") &&
    homeDeferredSections.includes("href={ranked.topPerformer.href ?? startHref(ranked.topPerformer.start, sourceParams(\"home\"))}"),
  "home top performer must promote the provisional live GS+ leader into the hero and link to the live board",
);

assert(
  rankedService.includes("if (areTodayStartsComplete)") &&
    rankedService.includes("if (!todayLeader) return null;") &&
    rankedService.includes("status: \"final\" as const,") &&
    rankedService.includes("dateLabel: formatLongDate(today),"),
  "home top performer must crown the best qualifying start once all starts are complete",
);

assert(
  rankedService.includes('dateLabel: `Yesterday · ${formatLongDate(yesterday)}`,') &&
    !rankedService.includes('dateLabel: `${formatWeekday(yesterday)} · ${formatLongDate(yesterday)}`,'),
  "home top performer previous-slate label must read Yesterday after midnight",
);

assert(
  rankedService.includes('const rankedLabel = useTodaySlate ? "Today" : formatWeekday(yesterday);'),
  "home ranked recap previous-slate label must read the weekday",
);

assert(
  rankedRecap.includes("The day at a glance") && !rankedRecap.includes("The night at a glance"),
  "home ranked recap swarm title must read The day at a glance for day-game slates",
);

assert(
  rankedRecap.includes("const duds = roughStarts(rankedStarts).slice(-3);") &&
    rankedRecap.includes("function roughStarts(starts: StartSummary[])") &&
    rankedRecap.includes('return label === "Below" || label === "Poor";') &&
    !rankedRecap.includes("const duds = rankedStarts.slice(-3);"),
  "home ranked recap Rough ones must only show below-solid starts and must not repeat solid top starts on small slates",
);

assert(
  rankedService.includes("function formatWeekday(date: string)"),
  "home ranked service must format previous-slate weekday labels",
);

assert(
  !topPerformerCard.includes('object-contain'),
  "home top performer image must not use contain framing that creates letterbox bars",
);

assert(
  !topPerformerCard.includes('blur-xl'),
  "home top performer image must not use a blurred backdrop layer",
);

assert(
  !topPerformerCard.includes('object-[58%_18%]'),
  "home top performer image must not use the old off-center crop position",
);

assert(
  imageService.includes("const NOLAN_MCLEAN_MLB_ID = 690997;") &&
    imageService.includes('const NOLAN_MCLEAN_BASES_LOADED_JAM_IMAGE = "https://img.mlbstatic.com/mlb-images/image/upload/w_1920,h_1080,f_jpg,c_fill,g_auto/mlb/rljrivvswnciz9owcoem.jpg";') &&
    imageService.includes("const CAM_SCHLITTLER_MLB_ID = 693645;") &&
    imageService.includes("const CAM_SCHLITTLER_REDS_ACTION_IMAGE =") &&
    !imageService.includes("const CHRIS_SALE_MLB_ID = 519242;") &&
    !imageService.includes("CHRIS_SALE_BREWERS_ACTION_IMAGE") &&
    !imageService.includes("const BRANDON_WOODRUFF_MLB_ID = 605540;") &&
    !imageService.includes("BRANDON_WOODRUFF_PERFECT_GAME_IMAGE") &&
    imageService.includes("const preferredPitcherImage = resolvePreferredPitcherImage(start);") &&
    imageService.includes("if (preferredPitcherImage) return preferredPitcherImage;") &&
    imageService.includes("const cachedMlbGameContentAction = await readCachedMlbGameContentActionImage(start.id);") &&
    imageService.includes("if (cachedMlbGameContentAction && cachedMlbGameContentAction.expiresAt > Date.now())") &&
    imageService.indexOf("const cachedMlbGameContentAction = await readCachedMlbGameContentActionImage(start.id);") <
      imageService.indexOf("const actionShot = await resolveSportradarActionShot(start).catch(() => null);") &&
    imageService.includes("const cached = await readCachedActionShot(start.id);") &&
    imageService.indexOf("const cached = await readCachedActionShot(start.id);") < imageService.indexOf("const apiKey = process.env.SPORTRADAR_IMAGES_API_KEY ?? process.env.SPORTRADAR_API_KEY;") &&
    imageService.includes("const actionShot = await resolveSportradarActionShot(start).catch(() => null);") &&
    imageService.includes("if (actionShot) return actionShot;") &&
    imageService.includes("const mlbGameContentAction = await resolveMlbGameContentActionImage(start).catch(() => null);") &&
    imageService.includes("if (mlbGameContentAction) return mlbGameContentAction;") &&
    imageService.includes("await writeCachedMlbGameContentActionImage(start.id, image).catch(() => undefined);") &&
    imageService.includes("function mlbGameContentActionImageCachePath(startId: string)") &&
    imageService.includes('return path.join(CACHE_DIR, `${safeFilePart(startId)}-mlb-action-v4.json`);') &&
    imageService.includes('if (!value.imageUrl.startsWith("https://img.mlbstatic.com/mlb-images/image/upload/")) return null;') &&
    imageService.includes("`https://statsapi.mlb.com/api/v1/game/${start.gamePk}/content`") &&
    imageService.includes("function selectMlbGameContentActionItem(content: MlbGameContent, start: StartSummary)") &&
    imageService.includes("function mlbGameContentActionScore(item: MlbGameContentItem, start: StartSummary)") &&
    imageService.includes("function nonActionMlbContentPattern()") &&
    imageService.includes("function nonActionMlbTitlePattern()") &&
    imageService.includes("function photoCreditImageTitlePattern()") &&
    imageService.includes("function isPhotoCreditImageTitle(title: string)") &&
    imageService.includes("function isMlbActionImageCandidate(item: MlbGameContentItem, start: StartSummary)") &&
    imageService.includes("function isPitcherActionHighlight(item: MlbGameContentItem, start: StartSummary)") &&
    imageService.includes("function isSinglePitchMlbActionFrame(item: MlbGameContentItem, start: StartSummary)") &&
    imageService.includes("function pitcherActionHighlightPattern()") &&
    imageService.includes("function singlePitchActionFramePattern()") &&
    imageService.includes("function broadSummaryMlbTitlePattern()") &&
    imageService.includes("function selectMlbImageCut(item: MlbGameContentItem | null)") &&
    imageService.includes("function normalizeMlbImageUrl(src: string)") &&
    imageService.includes("if (!text.includes(lastName(start.pitcher.name).toLowerCase())) return 0;") &&
    imageService.includes("if (!isMlbActionImageCandidate(item, start)) return 0;") &&
    imageService.includes('return isPhotoCreditImageTitle(item.image?.title ?? "") || isSinglePitchMlbActionFrame(item, start);') &&
    !imageService.includes('return isPhotoCreditImageTitle(item.image?.title ?? "") || isPitcherActionHighlight(item, start);') &&
    imageService.includes("if (nonActionMlbContentPattern().test(text)) return 0;") &&
    imageService.includes("if (nonActionMlbTitlePattern().test(titleText)) return 0;") &&
    imageService.includes('if (isPhotoCreditImageTitle(item.image?.title ?? "")) score += 35;') &&
    imageService.includes("if (isPitcherActionHighlight(item, start)) score += 30;") &&
    imageService.includes("pitcherActionHighlightPattern().test(text)") &&
    imageService.includes("singlePitchActionFramePattern().test(text)") &&
    imageService.includes("!broadSummaryMlbTitlePattern().test(text)") &&
    imageService.includes('${item.description ?? ""}') &&
    imageService.includes("first k|first strikeout|called out on strikes|strikes out swinging|swinging strike") &&
    imageService.includes("dominant start|quality start|outing|game highlights?|win|strikes? out \\d+|fans? \\d+") &&
    imageService.includes("fuel(?:s|ed)?\\b.*\\bwin") &&
    imageService.includes("gettyimages|imagn|usa today|reuters") &&
    imageService.includes("^ap\\d+") &&
    imageService.includes('cut.src?.startsWith("https://img.mlbstatic.com/mlb-images/image/upload/")') &&
    imageService.includes('objectPosition: actionShotObjectPosition()') &&
    imageService.includes('return "50% 50%";') &&
    !imageService.includes("resolvePitcherHeadshotImage") &&
    !imageService.includes('source: "headshot"') &&
    !imageService.includes("/people/${start.pitcher.mlbId}/headshot/67/current") &&
    imageService.includes("if (start.pitcher.mlbId === NOLAN_MCLEAN_MLB_ID)") &&
    imageService.includes("if (start.pitcher.mlbId === CAM_SCHLITTLER_MLB_ID)") &&
    imageService.includes('alt: "Cam Schlittler delivers a pitch against Cincinnati",') &&
    imageService.includes('source: "action",') &&
    imageService.includes("imageUrl: NOLAN_MCLEAN_BASES_LOADED_JAM_IMAGE,") &&
    imageService.includes("imageUrl: CAM_SCHLITTLER_REDS_ACTION_IMAGE,") &&
    !imageService.includes('"2026-06-18-sea-bal-693433": "Bryan Woo fans Adley Rutschman for first K of game"') &&
    !imageService.includes("PREFERRED_MLB_CONTENT_HEADLINES_BY_START_ID") &&
    !imageService.includes("resolveMlbGameContentImage") &&
    !imageService.includes('source: "highlight"') &&
    !imageService.includes("highlight.thumbnailUrl"),
  "home top performer image resolver must reject text-heavy MLB content/highlight thumbnails and never fall back to MLB headshots",
);

assert(
  (await readFile("next.config.ts", "utf8")).includes('hostname: "images2.minutemediacdn.com"') &&
    (await readFile("next.config.ts", "utf8")).includes('pathname: "/image/upload/**"'),
  "home top performer keyed action images from Minute Media must be allowed by Next image config",
);

console.log("home ranked contract ok: top performer image resolves, passes to the homepage card, uses centered action-photo framing, and never falls back to headshots");
