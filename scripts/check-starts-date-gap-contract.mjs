import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const page = await readFile("src/app/starts/[id]/page.tsx", "utf8");
const pageService = await readFile("src/lib/data/ranked-starts-page-service.ts", "utf8");
const startService = await readFile("src/lib/data/start-service.ts", "utf8");
const integrity = await readFile("src/lib/data/settled-slate-integrity.ts", "utf8");
const cronRoute = await readFile("src/app/api/cron/warm-live-starts/route.ts", "utf8");
const audit = await readFile("docs/starts-date-gap-audit-2026-07-30.md", "utf8");

assert(startService.includes('"v3-canonical-gap-recovery"'), "archived slate cache must advance past cached zero results");
assert(pageService.includes('"ranked-starts-page-v18-canonical-gap-recovery"'), "ranked page cache must advance past cached zero results");
assert(page.includes('"data-gap"') && page.includes("No reconciled starts for this date."), "valid scheduled zero-row dates must render the honest empty state");
assert(page.includes("previousRankedDate") && page.includes("nextRankedDate"), "data-gap state must link adjacent archive dates");
assert(!page.match(/No reconciled starts for this date\.[\s\S]{0,160}/)?.[0].match(/[—!]/), "data-gap copy must not contain em dashes or exclamation points");
assert(integrity.includes("detectRecentSettledSlateGaps") && integrity.includes("[settled-slate-integrity]"), "cron must scan and alert on recent settled slate gaps");
assert(integrity.includes("Array.from({ length: 7 }"), "integrity scan must cover seven trailing dates");
assert(cronRoute.includes("logRecentSettledSlateGaps"), "the reconciliation cron must run the settled-slate integrity check");
assert(audit.includes("32 rows for 2026-07-28") && audit.includes("Scheduled dates with zero canonical rows: none"), "production row count and season scan must be recorded");

console.log("starts date-gap contract passed");
