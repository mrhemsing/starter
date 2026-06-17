import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const rankedRoute = await readFile("src/app/api/home/ranked/route.ts", "utf8");
const homeDeferredSections = await readFile("src/components/home-deferred-sections.tsx", "utf8");
const topPerformerCard = await readFile("src/components/top-performer-card.tsx", "utf8");

assert(
  rankedRoute.includes('import { resolveTopPerformerImage } from "@/lib/data/top-performer-image-service";'),
  "home ranked API must use the top performer image resolver",
);

assert(
  rankedRoute.includes("resolveTopPerformerImage(topPerformerState?.start ?? null, null),"),
  "home ranked API must resolve an image for the selected top performer",
);

assert(
  rankedRoute.includes("topPerformer: topPerformerState ? { ...topPerformerState, image: topPerformerImage, metrics: topPerformerMetrics } : null"),
  "home ranked API must include image in the topPerformer payload",
);

assert(
  rankedRoute.includes("async function resolveTopPerformerMetrics(start: StartSummary | null)") &&
    rankedRoute.includes("const detail = await getStartDetail(start.id);") &&
    rankedRoute.includes("veloSparkline: velocityTrend.map((inning) => inning.avgVelocityMph),"),
  "home ranked API must enrich the top performer with real start-detail velocity metrics",
);

assert(
  homeDeferredSections.includes("image: TopPerformerImage | null;"),
  "home ranked client response type must include topPerformer.image",
);

assert(
  homeDeferredSections.includes("metrics: {") &&
    homeDeferredSections.includes("topVelo: number | null;") &&
    homeDeferredSections.includes("veloSparkline: number[];"),
  "home ranked client response type must include topPerformer.metrics",
);

assert(
  homeDeferredSections.includes("image={ranked.topPerformer.image}"),
  "home deferred top performer card must pass through the ranked API image",
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
  topPerformerCard.includes('className={isPlaceholderImage ? "object-cover object-[50%_45%]" : "object-cover object-[100%_50%]"}'),
  "home top performer real images must cover the frame while pinning the focal point to the player side",
);

assert(
  topPerformerCard.includes('const eyebrow = isProvisional ? "The one to beat" : "Start of the day";'),
  "home top performer final card eyebrow must read Start of the day",
);

assert(
  topPerformerCard.includes('<span className="mt-2 block">{dateLabel}</span>'),
  "home top performer date label must render on a forced new line without an inline separator after the eyebrow",
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
  rankedRoute.includes('dateLabel: `${formatWeekday(yesterday)} · ${formatLongDate(yesterday)}`,'),
  "home top performer previous-slate label must read the weekday",
);

assert(
  rankedRoute.includes('const rankedLabel = useTodaySlate ? "Today" : formatWeekday(yesterday);'),
  "home ranked recap previous-slate label must read the weekday",
);

assert(
  rankedRoute.includes("function formatWeekday(date: string)"),
  "home ranked API must format previous-slate weekday labels",
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

console.log("home ranked contract ok: top performer image resolves, passes to the homepage card, and uses player-side cover framing");
