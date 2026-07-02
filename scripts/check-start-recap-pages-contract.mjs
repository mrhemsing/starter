import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const recapPage = await readFile("src/app/starts/[id]/[slug]/page.tsx", "utf8");

assert(
  recapPage.includes("type StartRecapPageProps =") &&
    recapPage.includes("id: string;") &&
    recapPage.includes("slug: string;") &&
    recapPage.includes("async function resolveStartRecap(date: string, slug: string)") &&
    recapPage.includes('if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) return null;'),
  "start recap pages must use /starts/{yyyy-mm-dd}/{pitcher-slug} routing and reject non-date parents",
);

assert(
  recapPage.includes("const pageData = await getRankedStartsPageData(date);") &&
    recapPage.includes('const slateStarts = pageData.slateStarts.filter((start) => start.source?.line !== "fixture");') &&
    recapPage.includes("const start = await getStartDetail(match.id);") &&
    recapPage.includes("canonicalPath: startRecapPathForStart(start, slateStarts),"),
  "start recap pages must resolve from ranked slate data and hydrate the canonical start detail",
);

assert(
  recapPage.includes("function startRecapSlugForStart(") &&
    recapPage.includes("sameSlugCount > 1 ? `${baseSlug}-${start.gamePk}` : baseSlug") &&
    recapPage.includes("function slugifyPitcherName(name: string)") &&
    recapPage.includes(".replace(/[^a-z0-9]+/g, \"-\")"),
  "start recap slugging must be readable and add a game suffix for same-day slug collisions",
);

assert(
  recapPage.includes("export async function generateMetadata") &&
    recapPage.includes("alternates: { canonical: canonicalPath }") &&
    recapPage.includes("openGraph:") &&
    recapPage.includes("twitter:"),
  "start recap pages must emit canonical and share metadata",
);

assert(
  recapPage.includes('"@type": "SportsEvent"') &&
    recapPage.includes("url: absoluteUrl(canonicalPath)") &&
    recapPage.includes('"@type": "SportsTeam"') &&
    recapPage.includes('"@type": "Person"'),
  "start recap pages must include SportsEvent structured data sourced from the start",
);

assert(
  recapPage.includes("recapSummary(start)") &&
    recapPage.includes("formatStartLine(start.line)") &&
    recapPage.includes("GSv2 {start.gameScoreV2 ?? \"pending\"}") &&
    recapPage.includes("formatDecision(start.result)") &&
    recapPage.includes("start.eventFlags ?? []"),
  "start recap pages must render canonical line, GS+, GSv2, decision, and event-flag-aware summary context",
);

assert(
  recapPage.includes("pitcherHref({ id: start.pitcher.id, name: start.pitcher.name }, sourceParams(\"starts\"))") &&
    recapPage.includes("rankedStartsPath(start.date)") &&
    recapPage.includes("startHref(start, sourceParams(\"starts\"))") &&
    recapPage.includes("Opposing starter recap"),
  "start recap pages must link to pitcher, ranked slate, full start log, and paired recap when present",
);

console.log("start recap pages contract ok: canonical recap route, metadata, JSON-LD, and context links are pinned");
