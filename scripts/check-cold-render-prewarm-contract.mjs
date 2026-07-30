import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const prewarmer = await readFile("src/lib/data/production-path-prewarmer.ts", "utf8");
const reconciliationCron = await readFile("src/app/api/cron/warm-live-starts/route.ts", "utf8");
const slateCron = await readFile("src/app/api/cron/slate-sync/route.ts", "utf8");
const upcomingCron = await readFile("src/app/api/cron/upcoming-writeups/route.ts", "utf8");
const audit = await readFile("docs/cold-render-prewarm-audit.md", "utf8");

assert(prewarmer.includes("PREWARM_CONCURRENCY = 3"), "prewarm concurrency must not exceed three");
assert(prewarmer.includes("PREWARM_TIMEOUT_MS = 15_000"), "each warm request must time out after 15 seconds");
assert(prewarmer.includes("attempt <= 2"), "warm requests must retry once");
assert(prewarmer.includes('"x-toe-the-slab-prewarm": "1"') && prewarmer.includes("ToeTheSlab-ISR-Prewarmer"), "warm requests must be identifiable");
for (const requiredPath of ['"/"', '`/starts/${date}`', '"/heat-check"', '"/best-starts"', '`/leaderboard/${date.slice(0, 4)}`', '"/upcoming"', '`/live/${date}`', '`/duels/${date}`']) {
  assert(prewarmer.includes(requiredPath), `prewarmer must derive ${requiredPath}`);
}
assert(reconciliationCron.includes("reconciliationPrewarmPlan") && reconciliationCron.includes("production-prewarm:last-deployment"), "reconciliation must warm changed paths and run once after deploy");
assert(prewarmer.includes('lineStatus === "final"') && reconciliationCron.includes("hasNewFinalizedStarts"), "recap and pitcher families must warm only when finalized starts change");
assert(slateCron.includes("slatePrewarmPaths") && upcomingCron.includes("slatePrewarmPaths"), "slate and upcoming writers must warm their dated paths");

const metadataFiles = execFileSync("rg", ["-l", "generateMetadata", "src/app", "-g", "*.tsx"], { encoding: "utf8" })
  .trim().split(/\r?\n/).filter(Boolean);
const forbiddenCalls = [
  "getStartDetail(",
  "resolveStartRecap(",
  "getTonightMustWatch(",
  "getUpcomingMustWatch(",
  "getPitchingDuels(",
  "getPitcherForm(",
  "getDefaultUpcomingDate(",
];
for (const file of metadataFiles) {
  const source = await readFile(file, "utf8");
  for (const body of extractMetadataBodies(source)) {
    for (const call of forbiddenCalls) {
      assert(!body.includes(call), `${file} generateMetadata must not call ${call}`);
    }
  }
}
assert(audit.includes("No metadata function calls MLB Stats API"), "metadata audit must record the external-call boundary");

console.log("cold render prewarm contract passed", { metadataFiles: metadataFiles.length });

function extractMetadataBodies(source) {
  const bodies = [];
  const pattern = /export\s+async\s+function\s+(?:generateMetadata|generate\w+Metadata)\b/g;
  for (const match of source.matchAll(pattern)) {
    const signature = source.slice(match.index);
    const bodyMarker = signature.match(/\)\s*(?::\s*[^{]+)?\s*\{/);
    if (!bodyMarker || bodyMarker.index === undefined) continue;
    const open = match.index + bodyMarker.index + bodyMarker[0].lastIndexOf("{");
    if (open < 0) continue;
    let depth = 0;
    for (let index = open; index < source.length; index += 1) {
      if (source[index] === "{") depth += 1;
      if (source[index] === "}") depth -= 1;
      if (depth === 0) {
        bodies.push(source.slice(open, index + 1));
        break;
      }
    }
  }
  return bodies;
}
