import { readdir } from "node:fs/promises";
import path from "node:path";
import { readCompleteCanonicalSlateStateDates, writeCanonicalSlateStateSnapshot } from "../src/lib/data/canonical-start-store.ts";
import { readArchivedDateSummary } from "../src/lib/data/mlb-archive.ts";

const season = process.argv.find((arg) => arg.startsWith("--season="))?.split("=")[1] ?? new Date().getFullYear().toString();
if (!/^\d{4}$/.test(season)) throw new Error(`invalid season: ${season}`);

const archiveDatesDir = path.join(process.cwd(), "data", "mlb-archive", season, "dates");
const beforeDates = await readCompleteCanonicalSlateStateDates(season);
const archiveDates = (await readdir(archiveDatesDir))
  .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
  .map((file) => file.replace(/\.json$/, ""))
  .sort();

const written = [];
const skipped = [];

for (const date of archiveDates) {
  const summary = await readArchivedDateSummary(date);
  if (!summary || summary.starts <= 0 || summary.completedGames <= 0) {
    skipped.push({ date, reason: "missing-or-empty-archive" });
    continue;
  }

  const ok = await writeCanonicalSlateStateSnapshot({
    date,
    state: "complete",
    counts: {
      totalStarts: summary.starts,
      liveStarts: 0,
      finalStarts: summary.starts,
      scheduledStarts: 0,
    },
  });

  if (ok) {
    written.push(date);
  } else {
    skipped.push({ date, reason: "write-failed" });
  }
}

const afterDates = await readCompleteCanonicalSlateStateDates(season);
const report = {
  season,
  archiveDateFiles: archiveDates.length,
  beforeCompleteSlateStateRows: beforeDates.length,
  writtenRows: written.length,
  afterCompleteSlateStateRows: afterDates.length,
  firstWrittenDate: written[0] ?? null,
  lastWrittenDate: written.at(-1) ?? null,
  skipped,
};

console.log(JSON.stringify(report, null, 2));
if (skipped.some((item) => item.reason === "write-failed")) process.exit(1);
