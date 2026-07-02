import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function source(path) {
  return readFile(path, "utf8");
}

function assertBefore(sourceText, before, after, label) {
  const beforeIndex = sourceText.indexOf(before);
  const afterIndex = sourceText.indexOf(after, beforeIndex + before.length);
  assert(beforeIndex !== -1, `${label} must include ${before}`);
  assert(afterIndex !== -1, `${label} must include ${after}`);
  assert(beforeIndex < afterIndex, `${label} must validate date before ${after}`);
}

const validator = await source("src/lib/route-date-validation.ts");
const responseHelpers = await source("src/lib/route-date-response.ts");
const proxy = await source("src/proxy.ts");
const canonicalStore = await source("src/lib/data/canonical-start-store.ts");

assert(
  validator.includes("export const ROUTE_DATE_WINDOW = {") &&
    validator.includes('timeZone: "America/Los_Angeles"') &&
    validator.includes("seasonStartGraceDays: 7") &&
    validator.includes("futureDays: 14") &&
    validator.includes("export function isValidDateRouteParam(") &&
    validator.includes("function isRealIsoDate(") &&
    !validator.includes("next/navigation") &&
    !validator.includes("next/server"),
  "date route validation must centralize PT window constants and real-calendar checks without route side effects",
);

assert(
  responseHelpers.includes("export function assertValidDateRouteParam(") &&
    responseHelpers.includes("notFound();") &&
    responseHelpers.includes("export function invalidDateRouteResponse()") &&
    responseHelpers.includes('NextResponse.json({ error: "Not found" }, { status: 404 })'),
  "route date response helpers must expose page assertions and API 404 responses",
);

assert(
  proxy.includes("export function proxy(request: NextRequest)") &&
    proxy.includes("return new NextResponse(null, { status: 404 });") &&
    proxy.includes('"/upcoming/:path*"') &&
    proxy.includes('"/starts/:path*"') &&
    proxy.includes('"/live/:path*"') &&
    proxy.includes('"/api/upcoming"') &&
    proxy.includes("hasInvalidPathDate(url.pathname)") &&
    proxy.includes("hasInvalidQueryDate(url)") &&
    proxy.includes("isIsoDateRouteParam(value)") &&
    proxy.includes("!isValidDateRouteParam(value)"),
  "proxy must hard-404 invalid dated paths and query dates before route modules run",
);

assert(
  !canonicalStore.includes('import os from "node:os";') &&
    !canonicalStore.includes('import fs from "node:fs/promises";') &&
    !canonicalStore.includes('import path from "node:path";') &&
    !canonicalStore.includes("/tmp/toe-the-slab") &&
    !canonicalStore.includes("canonical-starts/") &&
    !canonicalStore.includes("fs.readFile") &&
    !canonicalStore.includes("fs.writeFile") &&
    canonicalStore.includes("volatileCanonicalStartStores"),
  "canonical store must remain memory-only and never use /tmp or filesystem JSON as a source of truth",
);

const guardedPages = [
  ["src/app/upcoming/[date]/page.tsx", "assertValidDateRouteParam(date);", "getTonightMustWatch", "upcoming date page"],
  ["src/app/upcoming/[date]/opengraph-image.tsx", "assertValidDateRouteParam(date);", "getTonightMustWatch", "upcoming date image"],
  ["src/app/upcoming/week/[startDate]/page.tsx", "assertValidDateRouteParam(startDate);", "getUpcomingMustWatch", "upcoming week page"],
  ["src/app/upcoming/week/[startDate]/opengraph-image.tsx", "assertValidDateRouteParam(startDate);", "getUpcomingMustWatch", "upcoming week image"],
  ["src/app/live/[date]/page.tsx", "assertValidDateRouteParam(date);", "getLiveScoreboard", "live page"],
  ["src/app/slate/[window]/[date]/page.tsx", "assertValidDateRouteParam(date);", "getDailySlate", "slate page"],
  ["src/app/duels/[date]/page.tsx", "assertValidDateRouteParam(date);", "getPitchingDuels", "duels page"],
  ["src/app/starts/[id]/page.tsx", "assertValidDateRouteParam(id);", "getRankedStartsPageData", "ranked starts date page"],
  ["src/app/starts/[id]/[slug]/page.tsx", "assertValidDateRouteParam(date);", "getRankedStartsPageData", "start recap page"],
];

for (const [path, guard, serviceCall, label] of guardedPages) {
  assertBefore(await source(path), guard, serviceCall, label);
}

const guardedApis = [
  ["src/app/api/live/[date]/route.ts", "if (!isValidDateRouteParam(date)) return invalidDateRouteResponse();", "getLiveScoreboard", "live api"],
  ["src/app/api/slate/[window]/[date]/route.ts", "if (!isValidDateRouteParam(date)) return invalidDateRouteResponse();", "getSlateApiResponse", "slate api"],
  ["src/app/api/tonight/route.ts", "if (date && !isValidDateRouteParam(date)) return invalidDateRouteResponse();", "getTonightMustWatch", "tonight api"],
  ["src/app/api/upcoming/route.ts", "if ((date && !isValidDateRouteParam(date)) || (start && !isValidDateRouteParam(start))) return invalidDateRouteResponse();", "getUpcomingMustWatch", "upcoming api"],
  ["src/app/api/duels/route.ts", "if (!isValidDateRouteParam(date)) return invalidDateRouteResponse();", "getPitchingDuels", "duels api"],
  ["src/app/api/social/start-of-day/route.ts", "if (date && !isValidDateRouteParam(date)) return invalidDateRouteResponse();", "getDailySocialPostDraft", "social preview api"],
  ["src/app/social/start-of-day/[date]/x/route.tsx", "if (!isValidDateRouteParam(date)) return invalidDateRouteResponse();", "getDailySocialPostDraft", "social x image"],
  ["src/app/social/start-of-day/[date]/instagram/route.tsx", "if (!isValidDateRouteParam(date)) return invalidDateRouteResponse();", "getDailySocialPostDraft", "social instagram image"],
];

for (const [path, guard, serviceCall, label] of guardedApis) {
  assertBefore(await source(path), guard, serviceCall, label);
}

console.log("date route validation contract ok: implausible dates 404 before data access");
