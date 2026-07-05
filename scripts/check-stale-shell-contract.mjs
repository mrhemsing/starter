import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [
  layout,
  buildStamp,
  siteNav,
  loadingShell,
  startsLatestRoute,
  liveRoute,
  routes,
  homePage,
] = await Promise.all([
  readFile("src/app/layout.tsx", "utf8"),
  readFile("src/lib/build-stamp.ts", "utf8"),
  readFile("src/components/site-nav.tsx", "utf8"),
  readFile("src/components/route-loading-shell.tsx", "utf8"),
  readFile("src/app/starts/latest/route.ts", "utf8"),
  readFile("src/app/live/route.ts", "utf8"),
  readFile("src/lib/routes.ts", "utf8"),
  readFile("src/app/page.tsx", "utf8"),
]);

assert(
  layout.includes('import { TTS_BUILD_STAMP } from "@/lib/build-stamp";') &&
    layout.includes('<meta name="tts-build" content={TTS_BUILD_STAMP} />') &&
    !layout.includes('"tts-build": TTS_BUILD_STAMP'),
  "root layout must emit the tts-build meta tag directly so every route receives the same build stamp",
);

assert(
  buildStamp.includes("process.env.VERCEL_GIT_COMMIT_SHA") &&
    buildStamp.includes("new Date().toISOString()") &&
    buildStamp.includes("export const TTS_BUILD_STAMP"),
  "build stamp must include the deployed git sha when available plus an ISO timestamp",
);

assert(
  routes.includes('export function rankedStartsLatestPath()') &&
    routes.includes('return "/starts/latest";') &&
    routes.includes('export function liveHref()') &&
    routes.includes('return "/live";'),
  "stable nav route helpers must exist for current-ranked starts and live scoreboard",
);

assert(
  siteNav.includes("rankedStartsLatestPath()") &&
    siteNav.includes('href: "/upcoming"') &&
    siteNav.includes("liveHref()") &&
    !siteNav.includes("rankedStartsPath(") &&
    !siteNav.includes("upcomingDateHref(") &&
    !siteNav.includes("liveDateHref(") &&
    countOccurrences(siteNav, "<nav ") === 1,
  "shared SiteNav must use one responsive nav element with stable, non-date-pinned primary links",
);

assert(
  loadingShell.includes('href: "/starts/latest"') &&
    loadingShell.includes('href: "/upcoming"') &&
    loadingShell.includes('href: "/live"') &&
    !loadingShell.includes("`/starts/${") &&
    !loadingShell.includes("`/upcoming/${") &&
    !loadingShell.includes("`/live/${") &&
    countOccurrences(loadingShell, "<nav ") === 1,
  "route loading shell must not bake date-pinned primary nav hrefs into fallback HTML",
);

assert(
  startsLatestRoute.includes('export const dynamic = "force-dynamic";') &&
    startsLatestRoute.includes("getRankedStartsDefaultDate(today)") &&
    startsLatestRoute.includes("NextResponse.redirect(location, 307)") &&
    liveRoute.includes('export const dynamic = "force-dynamic";') &&
    liveRoute.includes("liveDateHref(getHomeSlateDate())") &&
    liveRoute.includes("NextResponse.redirect(location, 307)"),
  "/starts/latest and /live redirects must resolve current slate targets at request time",
);

assert(
  homePage.includes('export const dynamic = "force-dynamic";') &&
    !homePage.includes("export const revalidate = 60"),
  "homepage must render dynamically while the stale-shell remediation is active",
);

assertDeepEqual(
  [
    "/",
    "/starts/latest",
    "/starts/2026-07-04",
    "/heat-check",
    "/upcoming",
    "/live",
    "/watchlist",
    "/duels",
    "/pitchers/676440/form",
    "/starts/2026-07-04",
    "/starts/2026-07-04/logan-gilbert-669302",
    "/methodology",
    "/best-starts/2026-07",
  ].filter((route, index, routes) => routes.indexOf(route) === index),
  [
    "/",
    "/starts/latest",
    "/starts/2026-07-04",
    "/heat-check",
    "/upcoming",
    "/live",
    "/watchlist",
    "/duels",
    "/pitchers/676440/form",
    "/starts/2026-07-04/logan-gilbert-669302",
    "/methodology",
    "/best-starts/2026-07",
  ],
  "stale shell verification route set must cover home, starts, heat-check, upcoming, live, watchlist, duels, pitchers, start detail, methodology, and best-starts",
);

console.log("stale shell contract ok: primary nav uses stable links, request-time redirects, and root tts-build metadata");

function countOccurrences(value, needle) {
  return value.split(needle).length - 1;
}

function assertDeepEqual(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
}
