import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function read(path) {
  return await readFile(path, "utf8");
}

function seededSettledFallback(date, today, archivedGames, canonicalState) {
  if (date >= today) return false;
  if (archivedGames === 0) return true;
  if (!canonicalState) return true;
  if (canonicalState.state !== "complete") return true;
  return canonicalState.totalStarts <= 0 || canonicalState.finalStarts < canonicalState.totalStarts;
}

const [
  packageJson,
  vercelJson,
  startService,
  formService,
  mlbArchive,
  supabaseArchive,
  warmJob,
  archiveScript,
  syncScript,
  auditDoc,
] = await Promise.all([
  read("package.json"),
  read("vercel.json"),
  read("src/lib/data/start-service.ts"),
  read("src/lib/data/form-service.ts"),
  read("src/lib/data/mlb-archive.ts"),
  read("src/lib/data/supabase-archive.ts"),
  read("src/lib/data/warm-live-starts-job.ts"),
  read("scripts/archive-mlb-season.mjs"),
  read("scripts/sync-supabase-mlb-archive.mjs"),
  read("docs/archive-gap-closeout-2026-07-08.md"),
]);

assert(
  packageJson.includes('"check:archive-gap-closeout": "node scripts/check-archive-gap-closeout-contract.mjs"'),
  "package.json must expose check:archive-gap-closeout",
);

assert(
  !vercelJson.includes("/api/cron/archive") &&
    !vercelJson.includes("archive:mlb-season") &&
    !vercelJson.includes("sync:supabase-mlb-archive"),
  "vercel cron config must not imply the ignored file archive is maintained by a deployed daily writer",
);

assert(
  archiveScript.includes('const archiveRoot = readArg("out", process.env.THE_BUMP_ARCHIVE_DIR ?? path.join("data", "mlb-archive", season));') &&
    syncScript.includes("const manifest = await readJson(path.join(archiveRoot, \"manifest.json\"));"),
  "archive writer/sync must remain documented as an offline file archive workflow, not a request-path source of truth",
);

assert(
  startService.includes("function shouldFetchSettledScheduleFallback") &&
    startService.includes("if ((archivedSchedule?.games.length ?? 0) === 0) return true;") &&
    startService.includes("await fetchMlbSchedule(date, { fetchLive: true })") &&
    startService.includes("canonicalSlateState.counts.finalStarts < canonicalSlateState.counts.totalStarts"),
  "settled completion checks must recover from an empty or incomplete archive by using live/canonical data",
);

assert(
  startService.includes("readSupabaseArchivedCompletedStarts(date)") &&
    startService.includes("readSupabaseArchivedCompletedStartsRange(startDate, endDate)") &&
    startService.includes("readArchivedStartPitchDetails(schedule.date, matchedStart.gamePk, matchedStart.pitcher.mlbId)") &&
    mlbArchive.includes("export async function readArchivedStartPitchDetails") &&
    supabaseArchive.includes("export async function readSupabaseArchivedCompletedStarts"),
  "archive readers must be mapped as Supabase completed-start reads plus optional local pitch-detail enrichment",
);

assert(
  formService.includes("[form-pipeline] canonical fold-in window exceeded; serving freshest bounded canonical form data") &&
    !formService.includes("[form-pipeline] recent canonical form gap") &&
    !formService.includes("[form-pipeline] archive gap exceeds canonical fold-in cap"),
  "form rendering must not log a persistent archive-gap warning when canonical fallback covers recent settled dates",
);

assert(
  warmJob.includes("warm-live-starts archive gap detected; continuing canonical settle/revalidation path") &&
    !warmJob.includes("warm-live-starts archive gap detected; deferring to archive job"),
  "warm-live-starts must continue canonical settle/revalidation work when archive status is behind",
);

assert(
  auditDoc.includes("Decision: Option B") &&
    auditDoc.includes("No deployed archive writer exists") &&
    auditDoc.includes("The archive remains optional enrichment") &&
    auditDoc.includes("Archive Reader Map") &&
    auditDoc.includes("Chronically Ignored Warning Audit") &&
    auditDoc.includes("P0-6 failure mode"),
  "archive closeout audit must document root cause, Option B, reader map, warning audit, and incident guard",
);

assert(
  seededSettledFallback("2026-07-07", "2026-07-08", 0, null) === true,
  "seeded P0-6 condition must fetch live schedule fallback instead of treating an empty archive as zero games",
);
assert(
  seededSettledFallback("2026-07-06", "2026-07-08", 8, { state: "complete", totalStarts: 16, finalStarts: 16 }) === false,
  "complete canonical settled dates must not do unnecessary live fallback work",
);
assert(
  seededSettledFallback("2026-07-07", "2026-07-08", 16, { state: "active", totalStarts: 32, finalStarts: 28 }) === true,
  "incomplete canonical settled dates must still recover through the live fallback",
);

console.log("archive gap closeout contract ok: Option B, reader map, warning cleanup, and P0-6 fallback guard are pinned");
