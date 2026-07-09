import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function read(path) {
  return await readFile(path, "utf8");
}

function assertRevalidate(source, path, seconds) {
  assert(source.includes(`export const revalidate = ${seconds};`), `${path} must export revalidate = ${seconds}`);
  assert(!source.includes('export const dynamic = "force-dynamic"'), `${path} must not force dynamic rendering`);
}

const files = Object.fromEntries(await Promise.all([
  "package.json",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/starts/[id]/page.tsx",
  "src/app/form/page.tsx",
  "src/app/heat-check/page.tsx",
  "src/app/upcoming/page.tsx",
  "src/app/upcoming/[date]/page.tsx",
  "src/app/upcoming/streamers/page.tsx",
  "src/app/best-starts/page.tsx",
  "src/app/rotations/page.tsx",
  "src/app/watchlist/page.tsx",
  "src/app/live/[date]/page.tsx",
  "src/lib/data/runtime-state-store.ts",
  "src/lib/data/form-service.ts",
  "src/lib/data/tonight-service.ts",
  "src/lib/data/ranked-starts-page-service.ts",
  "src/lib/data/start-service.ts",
  "src/lib/data/streamers-read-service.ts",
  "src/lib/data/upcoming-writeups-service.ts",
  "src/lib/data/home-gs-plus-proof-service.ts",
  "src/app/api/upcoming/route.ts",
  "src/app/api/form/leaderboard/route.ts",
  "src/app/api/home/ranked/route.ts",
  "src/app/api/pitchers/[id]/route.ts",
  "docs/performance-guardrail-2026-07-08.md",
  "docs/read-path-caching-audit-2026-07-08.md",
  "scripts/measure-performance-guardrail.mjs",
].map(async (path) => [path, await read(path)])));

assertRevalidate(files["src/app/page.tsx"], "home page", 60);
assertRevalidate(files["src/app/starts/[id]/page.tsx"], "ranked starts/start detail page", 60);
assertRevalidate(files["src/app/upcoming/page.tsx"], "upcoming index page", 60);
assertRevalidate(files["src/app/upcoming/[date]/page.tsx"], "upcoming date page", 60);

assertRevalidate(files["src/app/form/page.tsx"], "heat check implementation page", 900);
assertRevalidate(files["src/app/heat-check/page.tsx"], "heat check route page", 900);
assertRevalidate(files["src/app/upcoming/streamers/page.tsx"], "fantasy streamers page", 900);
assertRevalidate(files["src/app/best-starts/page.tsx"], "best starts page", 900);
assertRevalidate(files["src/app/rotations/page.tsx"], "rotations page", 900);

assert(
  files["src/app/watchlist/page.tsx"].includes('export const dynamic = "force-dynamic"') &&
    files["src/app/watchlist/page.tsx"].includes("cookies()") &&
    files["src/app/watchlist/page.tsx"].includes("getWatchlistView(accountId"),
  "Watchlist must stay explicitly dynamic and per-user, with the exception documented",
);

assert(
  files["src/app/live/[date]/page.tsx"].includes("getLiveScoreboard({ date })") &&
    !files["src/app/live/[date]/page.tsx"].includes("readSupabaseArchivedCompletedStarts") &&
    !files["src/app/live/[date]/page.tsx"].includes("readRuntimeState"),
  "Live page must read the live board only and must not perform broad archive/runtime reads directly",
);

const pagePaths = [
  "src/app/page.tsx",
  "src/app/starts/[id]/page.tsx",
  "src/app/form/page.tsx",
  "src/app/heat-check/page.tsx",
  "src/app/upcoming/page.tsx",
  "src/app/upcoming/[date]/page.tsx",
  "src/app/upcoming/streamers/page.tsx",
  "src/app/best-starts/page.tsx",
  "src/app/rotations/page.tsx",
  "src/app/live/[date]/page.tsx",
  "src/app/watchlist/page.tsx",
];

const forbiddenRequestPathSnippets = [
  "openai",
  "generateFantasyCoach",
  "generateUpcomingWriteups",
  "syncSupabase",
  "upsertRuntimeState",
  "writeRuntimeState",
  "recompute",
  "backfill",
  "fetchMlbTeamHandednessSplitContexts",
  "fetchMlbOddsMarketContexts",
  "fetchBaseballSavant",
];

for (const path of pagePaths) {
  const source = files[path];
  for (const snippet of forbiddenRequestPathSnippets) {
    assert(!source.includes(snippet), `${path} must not trigger heavy compute/write work on the request path: ${snippet}`);
  }
}

assert(
  files["src/lib/data/runtime-state-store.ts"].includes("export function readCachedRuntimeState") &&
    files["src/lib/data/runtime-state-store.ts"].includes("unstable_cache(") &&
    files["src/lib/data/streamers-read-service.ts"].includes("readCachedRuntimeState<FantasyCoachState>") &&
    files["src/lib/data/upcoming-writeups-service.ts"].includes("readCachedRuntimeState<UpcomingWriteupsState>") &&
    files["src/lib/data/home-gs-plus-proof-service.ts"].includes("readCachedRuntimeState<HomeGsPlusProofState>"),
  "Precomputed runtime packets must be read through cached render-time helpers",
);

assert(
  files["src/lib/data/form-service.ts"].includes("readRecentCanonicalFormSlate") &&
    files["src/lib/data/tonight-service.ts"].includes("const getCachedTonightMustWatch = unstable_cache(") &&
    files["src/lib/data/ranked-starts-page-service.ts"].includes("unstable_cache(") &&
    files["src/lib/data/start-service.ts"].includes("getCachedArchivedSlateStarts") &&
    files["src/lib/data/start-service.ts"].includes("getCachedArchivedSeasonRangeStartSummaries"),
  "Form, Upcoming, Ranked Starts, and archive reads must remain cached/stored instead of recomputed per visit",
);

for (const [label, source] of [
  ["upcoming API", files["src/app/api/upcoming/route.ts"]],
  ["form leaderboard API", files["src/app/api/form/leaderboard/route.ts"]],
  ["home ranked API", files["src/app/api/home/ranked/route.ts"]],
  ["pitcher profile API", files["src/app/api/pitchers/[id]/route.ts"]],
]) {
  assert(
    source.includes('"Cache-Control"') &&
      source.includes("public, s-maxage=") &&
      source.includes("stale-while-revalidate="),
    `${label} must keep stale-while-revalidate cache headers`,
  );
}

assert(
  files["src/app/layout.tsx"].includes('import { Analytics } from "@vercel/analytics/next";') &&
    files["src/app/layout.tsx"].includes("<Analytics />") &&
    files["package.json"].includes('"@vercel/analytics"'),
  "Vercel Analytics must remain installed and mounted for ongoing RUM visibility",
);

assert(
  files["scripts/measure-performance-guardrail.mjs"].includes("PERF_BASE_URL") &&
    files["scripts/measure-performance-guardrail.mjs"].includes("Cold TTFB ms") &&
    files["scripts/measure-performance-guardrail.mjs"].includes("Warm TTFB ms") &&
    files["scripts/measure-performance-guardrail.mjs"].includes('["heat check", "/heat-check"]') &&
    files["scripts/measure-performance-guardrail.mjs"].includes('["pitcher page", "/pitchers/dylan-cease-656302"]'),
  "Performance probe must provide repeatable route timing evidence",
);

const doc = files["docs/performance-guardrail-2026-07-08.md"];
assert(
  doc.includes("# Performance Guardrail - 2026-07-08") &&
    doc.includes("Tolerance") &&
    doc.includes("LCP must not regress by more than 10%") &&
    doc.includes("Compute-write-read verification") &&
    doc.includes("Before and after table") &&
    doc.includes("| `/heat-check` |") &&
    doc.includes("| `/watchlist` |") &&
    doc.includes("Vercel Analytics is mounted") &&
    doc.includes("stale-while-revalidate") &&
    doc.includes("PERF_BASE_URL="),
  "Performance guardrail doc must include tolerance, route evidence, compute-write-read audit, RUM, and repeatable probe instructions",
);

assert(
  files["docs/read-path-caching-audit-2026-07-08.md"].includes("| `/heat-check` | CACHED |") &&
    files["docs/read-path-caching-audit-2026-07-08.md"].includes("| `/watchlist` | UNCACHED |"),
  "Performance guardrail must stay tied to the read-path caching audit classifications",
);

assert(
  files["package.json"].includes('"check:performance-guardrail": "node scripts/check-performance-guardrail-contract.mjs"') &&
    files["package.json"].includes('"measure:performance-guardrail": "node scripts/measure-performance-guardrail.mjs"'),
  "package.json must expose performance guardrail check and measurement scripts",
);

console.log("performance guardrail contract ok: route timings, compute/write/read boundaries, SWR headers, and RUM wiring are pinned");
