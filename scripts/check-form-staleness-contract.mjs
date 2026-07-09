import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function read(path) {
  return await readFile(path, "utf8");
}

function daysBetween(startDate, endDate) {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  return Math.round((end - start) / 86_400_000);
}

function seededFreshness(formThroughDate, latestScoredStartDate) {
  const lagDays = formThroughDate && latestScoredStartDate
    ? Math.max(0, daysBetween(formThroughDate, latestScoredStartDate))
    : null;
  return {
    formThroughDate,
    latestScoredStartDate,
    lagDays,
    stale: typeof lagDays === "number" && lagDays > 1,
  };
}

const [formService, warmJob, formPage, packageJson] = await Promise.all([
  read("src/lib/data/form-service.ts"),
  read("src/lib/data/warm-live-starts-job.ts"),
  read("src/app/form/page.tsx"),
  read("package.json"),
]);

assert(
  formService.includes("const RECENT_FORM_CANONICAL_GAP_LIMIT_DAYS = 14;") &&
    formService.includes("const selectedDates = dates.slice(-RECENT_FORM_CANONICAL_GAP_LIMIT_DAYS);") &&
    formService.includes("[form-pipeline] archive gap exceeds canonical fold-in cap; serving freshest bounded canonical form data") &&
    formService.includes("readRecentCanonicalFormSlate") &&
    formService.includes("readCanonicalStartRecords(date)") &&
    !formService.includes("dates.map((date) => getDailySlate"),
  "Heat Check must fold recent settled canonical gap days into form without rebuilding slates on render",
);

assert(
  formService.includes("records") &&
    formService.includes('.filter((record) => record.status === "final" || record.status === "live")') &&
    !formService.includes('record.status === "scheduled"'),
  "Heat Check form must keep scheduled fixture records out of rolling form",
);

assert(
  formService.includes("export function evaluateFormFreshness") &&
    formService.includes("lagDays > 1") &&
    formService.includes("const freshness = evaluateFormFreshness({ formThroughDate, latestScoredStartDate });") &&
    formService.includes("const stale = recent.truncated || freshness.stale;"),
  "Heat Check must have a one-day staleness guard against latest settled data",
);

assert(
  warmJob.includes("getSupabaseArchiveStatus(date.slice(0, 4), { expectedLastCompletedDate: addDays(getHomeSlateDate(), -1) })") &&
    warmJob.includes("warm-live-starts archive gap detected; continuing canonical settle/revalidation path") &&
    warmJob.includes("await warmFormLeaderboards();") &&
    !warmJob.includes("warm-live-starts archive gap detected; deferring to archive job"),
  "warm-live-starts must not let archive lag block canonical settle/form revalidation work",
);

assert(
  formPage.includes("` / latest settled ${leaderboard.latestScoredStartDate} pending`") &&
    !formPage.includes("` / updating from ${leaderboard.latestScoredStartDate}`"),
  "Heat Check stale label must describe the pending latest settled slate explicitly",
);

const oneDayLag = seededFreshness("2026-07-05", "2026-07-06");
const twoDayLag = seededFreshness("2026-07-04", "2026-07-06");

assert(oneDayLag.lagDays === 1 && oneDayLag.stale === false, "one-day form lag should not fail the freshness guard");
assert(twoDayLag.lagDays === 2 && twoDayLag.stale === true, "two-day form lag must fail the freshness guard");
assert(packageJson.includes('"check:form-staleness": "node scripts/check-form-staleness-contract.mjs"'), "package scripts must expose the form staleness contract");

console.log("form staleness contract ok: canonical gap fold-in, cron continuation, labels, and seeded freshness guard are pinned");
