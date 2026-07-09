import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function read(path) {
  return await readFile(path, "utf8");
}

function assertRevalidate(source, path, seconds) {
  assert(
    source.includes(`export const revalidate = ${seconds};`),
    `${path} must export revalidate = ${seconds}`,
  );
  assert(
    !source.includes('export const dynamic = "force-dynamic"'),
    `${path} must not force dynamic rendering`,
  );
}

const files = Object.fromEntries(await Promise.all([
  "package.json",
  "src/app/page.tsx",
  "src/app/heat-check/page.tsx",
  "src/app/heat-check/season/page.tsx",
  "src/app/form/page.tsx",
  "src/app/upcoming/page.tsx",
  "src/app/upcoming/[date]/page.tsx",
  "src/app/upcoming/week/page.tsx",
  "src/app/upcoming/week/[startDate]/page.tsx",
  "src/app/upcoming/streamers/page.tsx",
  "src/app/starts/[id]/page.tsx",
  "src/app/best-starts/page.tsx",
  "src/app/best-starts/[month]/page.tsx",
  "src/app/rotations/page.tsx",
  "src/app/pitchers/[id]/form/page.tsx",
  "src/app/watchlist/page.tsx",
  "src/components/follow-pitcher-button.tsx",
  "src/lib/data/runtime-state-store.ts",
  "src/lib/data/home-gs-plus-proof-service.ts",
  "src/lib/data/streamers-read-service.ts",
  "src/lib/data/upcoming-writeups-service.ts",
  "docs/read-path-caching-audit-2026-07-08.md",
].map(async (path) => [path, await read(path)])));

assertRevalidate(files["src/app/page.tsx"], "home page", 60);
assertRevalidate(files["src/app/upcoming/page.tsx"], "upcoming index page", 60);
assertRevalidate(files["src/app/upcoming/[date]/page.tsx"], "upcoming date page", 60);
assertRevalidate(files["src/app/upcoming/week/page.tsx"], "upcoming week index page", 60);
assertRevalidate(files["src/app/upcoming/week/[startDate]/page.tsx"], "upcoming week page", 60);
assertRevalidate(files["src/app/starts/[id]/page.tsx"], "starts page", 60);

assertRevalidate(files["src/app/heat-check/page.tsx"], "heat check page", 900);
assertRevalidate(files["src/app/heat-check/season/page.tsx"], "heat check season page", 900);
assertRevalidate(files["src/app/upcoming/streamers/page.tsx"], "upcoming streamers page", 900);
assertRevalidate(files["src/app/best-starts/page.tsx"], "best starts page", 900);
assertRevalidate(files["src/app/best-starts/[month]/page.tsx"], "best starts month page", 900);
assertRevalidate(files["src/app/rotations/page.tsx"], "rotations page", 900);
assertRevalidate(files["src/app/pitchers/[id]/form/page.tsx"], "pitcher form page", 900);

assert(
  files["src/app/form/page.tsx"].includes("export const revalidate = 900;") &&
    !files["src/app/form/page.tsx"].includes("next/headers") &&
    !files["src/app/form/page.tsx"].includes("getWatchlistPitcherIds") &&
    !files["src/app/form/page.tsx"].includes("WATCHLIST_COOKIE"),
  "Heat Check implementation must be cacheable and must not server-read watchlist cookies",
);

assert(
  !files["src/app/pitchers/[id]/form/page.tsx"].includes("next/headers") &&
    !files["src/app/pitchers/[id]/form/page.tsx"].includes("getWatchlistPitcherIds") &&
    !files["src/app/pitchers/[id]/form/page.tsx"].includes("WATCHLIST_COOKIE"),
  "Pitcher form implementation must be cacheable and must not server-read watchlist cookies",
);

assert(
  files["src/components/follow-pitcher-button.tsx"].includes('fetch("/api/watchlist", { cache: "no-store" })') &&
    files["src/components/follow-pitcher-button.tsx"].includes("let followStateHydration: Promise<void> | null = null") &&
    files["src/components/follow-pitcher-button.tsx"].includes("window.dispatchEvent(new CustomEvent(FOLLOW_STATE_EVENT"),
  "Follow buttons must client-hydrate user-specific follow state after cached page render",
);

assert(
  files["src/lib/data/runtime-state-store.ts"].includes("export function readCachedRuntimeState") &&
    files["src/lib/data/runtime-state-store.ts"].includes("unstable_cache(") &&
    files["src/lib/data/runtime-state-store.ts"].includes("next: { revalidate: revalidateSeconds }"),
  "runtime_state must expose a cached render-time read helper",
);

assert(
  files["src/lib/data/home-gs-plus-proof-service.ts"].includes("readCachedRuntimeState<HomeGsPlusProofState>") &&
    files["src/lib/data/streamers-read-service.ts"].includes("readCachedRuntimeState<FantasyCoachState>") &&
    files["src/lib/data/upcoming-writeups-service.ts"].includes("readCachedRuntimeState<UpcomingWriteupsState>"),
  "stored render-time packets must use cached runtime_state reads instead of no-store reads",
);

assert(
  files["src/app/watchlist/page.tsx"].includes('export const dynamic = "force-dynamic"'),
  "Watchlist should remain dynamic because it is a per-user surface",
);

assert(
  files["docs/read-path-caching-audit-2026-07-08.md"].includes("| `/heat-check` | CACHED |") &&
    files["docs/read-path-caching-audit-2026-07-08.md"].includes("| `/watchlist` | UNCACHED |") &&
    files["docs/read-path-caching-audit-2026-07-08.md"].includes("x-vercel-cache") &&
    files["docs/read-path-caching-audit-2026-07-08.md"].includes("Before and after read-path estimate"),
  "read-path audit doc must include route classifications, Vercel cache verification, and egress estimate",
);

assert(
  files["package.json"].includes('"check:read-path-cache": "node scripts/check-read-path-cache-contract.mjs"'),
  "package.json must expose check:read-path-cache",
);

console.log("read-path cache contract ok: cacheable routes, dynamic exceptions, follow-state hydration, and audit evidence are pinned");
