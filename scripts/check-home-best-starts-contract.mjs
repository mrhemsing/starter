import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const bestStartsRoute = await readFile("src/app/api/home/best-starts/route.ts", "utf8");
const homeDeferredSections = await readFile("src/components/home-deferred-sections.tsx", "utf8");

assert(
  bestStartsRoute.includes('import { resolveFeaturedStartHighlight } from "@/lib/data/featured-highlight-service";'),
  "home best-starts API must use the featured highlight resolver",
);

assert(
  bestStartsRoute.includes("weeklyHighlight") && bestStartsRoute.includes("monthlyHighlight"),
  "home best-starts API must include weekly and monthly highlight payload fields",
);

assert(
  bestStartsRoute.includes("getArchivedSeasonStartSummaries") &&
    bestStartsRoute.includes("rankedWindowStarts") &&
    bestStartsRoute.includes("monthlyStarts.length > 0"),
  "home best-starts API must use the archived season summary fast path before falling back to daily slate fanout",
);

assert(
  homeDeferredSections.includes('import { FeaturedStartHighlightEmbed } from "@/components/featured-start-highlight";'),
  "home best-starts client must import the highlight embed",
);

assert(
  homeDeferredSections.includes("weeklyHighlight: FeaturedStartHighlight | null;") &&
    homeDeferredSections.includes("monthlyHighlight: FeaturedStartHighlight | null;"),
  "home best-starts client response type must include highlight fields",
);

assert(
  homeDeferredSections.includes("highlight={weeklyHighlight}") &&
    homeDeferredSections.includes("highlight={monthlyHighlight}"),
  "home best-starts cards must pass API highlights into the card renderer",
);

assert(
  homeDeferredSections.includes("<FeaturedStartHighlightEmbed highlight={highlight} pitcherName={start.pitcher.name} />"),
  "home best-starts card must render the highlight embed when a highlight is present",
);

assert(
  homeDeferredSections.includes('best: { eyebrow: "Best starts", title: "Loading best starts" },'),
  "home best-starts loading skeleton must use clear loading copy instead of the final Evergreen section label",
);

console.log("home best-starts contract ok: highlight payloads are resolved in the API and rendered by the homepage cards");
