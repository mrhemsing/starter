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
const mustWatch = await readFile("src/components/tonights-must-watch.tsx", "utf8");
const startService = await readFile("src/lib/data/start-service.ts", "utf8");
const rankedService = await readFile("src/lib/data/home-ranked-service.ts", "utf8");
const imageService = await readFile("src/lib/data/top-performer-image-service.ts", "utf8");

assert(
  rankedRoute.includes('import { getRankedHome } from "@/lib/data/home-ranked-service";') &&
    rankedRoute.includes("return NextResponse.json(await getRankedHome());"),
  "home ranked API must delegate to the shared ranked-home service",
);

assert(
  rankedService.includes('import { resolveTopPerformerImage, type TopPerformerImage } from "@/lib/data/top-performer-image-service";'),
  "home ranked service must use the top performer image resolver",
);

assert(
  rankedService.includes("resolveTopPerformerImage(topPerformerState?.start ?? null, null),"),
  "home ranked service must resolve an image for the selected top performer",
);

assert(
  rankedService.includes("topPerformer: topPerformerState ? { ...topPerformerState, image: topPerformerImage, metrics: topPerformerMetrics } : null"),
  "home ranked service must include image in the topPerformer payload",
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
    homePage.includes("const todayWatchPromise = getTonightMustWatch({ date: today, window: 5 }).catch(() => null);") &&
    homePage.includes("const duelsPromise = todayWatchPromise") &&
    homePage.includes("<HomeDeferredSections") &&
    homePage.includes("initialData={{") &&
    homePage.includes("ranked,") &&
    homePage.includes("todayWatch,") &&
    homePage.includes("duels,"),
  "homepage must server-prefetch ranked, must-watch, and duels data before rendering the client sections",
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
  !homeDeferredSections.includes("image={null}"),
  "home deferred top performer card must not hardcode a null image",
);

assert(
  topPerformerCard.includes('className={isPlaceholderImage ? "object-cover object-[50%_45%]" : "object-cover object-center lg:object-[100%_50%]"}'),
  "home top performer real images must cover the frame, center on mobile, and keep player-side framing on large screens",
);

assert(
  topPerformerCard.includes('const eyebrow = isProvisional ? "The one to beat" : "Start of the day";'),
  "home top performer final card eyebrow must read Start of the day",
);

assert(
  topPerformerCard.includes("function formatTopPerformerStatusLabel(eyebrow: string, dateLabel: string)") &&
    topPerformerCard.includes('const livePrefix = "Live leader · ";') &&
    topPerformerCard.includes('eyebrow: `${eyebrow} · Live leader`,') &&
    topPerformerCard.includes('"$1 games final"'),
  "home top performer live label must combine the eyebrow with Live leader, then force the games-final detail onto the next line",
);

assert(
  topPerformerCard.includes('font-mono text-[10px] uppercase leading-[1.05] tracking-[0.22em] text-[#F6C445]') &&
    topPerformerCard.includes('<span className="mt-1 block">{statusLabel.detail}</span>') &&
    topPerformerCard.includes('font-mono text-[10px] uppercase leading-[1.05] tracking-[0.16em] text-[#F6C445]') &&
    topPerformerCard.includes('<span className="mt-1 block nowrap-token">{statusLabel.detail}</span>'),
  "home top performer status detail must render on a forced tight new line on desktop and mobile",
);

assert(
  topPerformerCard.includes('inline-flex min-h-11 items-center rounded border border-[#F6C445]/40 px-3 font-mono text-xs uppercase tracking-[0.16em] text-[#F6C445]') &&
    topPerformerCard.includes("View game log") &&
    !topPerformerCard.includes("View log") &&
    !topPerformerCard.includes("justify-center rounded border border-white/15"),
  "home top performer View game log CTA must match the left-aligned yellow slate button treatment",
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
  rankedService.includes('dateLabel: `${formatWeekday(yesterday)} · ${formatLongDate(yesterday)}`,'),
  "home top performer previous-slate label must read the weekday",
);

assert(
  rankedService.includes('const rankedLabel = useTodaySlate ? "Today" : formatWeekday(yesterday);'),
  "home ranked recap previous-slate label must read the weekday",
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
    imageService.includes("const preferredPitcherImage = resolvePreferredPitcherImage(start);") &&
    imageService.includes("if (preferredPitcherImage) return preferredPitcherImage;") &&
    imageService.includes("if (start.pitcher.mlbId !== NOLAN_MCLEAN_MLB_ID) return null;") &&
    imageService.includes("imageUrl: NOLAN_MCLEAN_BASES_LOADED_JAM_IMAGE,") &&
    imageService.includes('"2026-06-12-nym-atl-690997": "Nolan McLean escapes bases-loaded jam"') &&
    imageService.includes("PREFERRED_MLB_CONTENT_HEADLINES_BY_START_ID[start.id]") &&
    imageService.includes("if (preferredItem) return preferredItem;"),
  "home top performer image resolver must pin Nolan McLean to the wider bases-loaded jam image across Nolan starts",
);

console.log("home ranked contract ok: top performer image resolves, passes to the homepage card, and uses mobile-safe cover framing");
