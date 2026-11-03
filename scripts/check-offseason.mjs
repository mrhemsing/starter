import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import ts from "typescript";

const logs = [];
let state = null;
let sideEffects = 0;
const logger = { log: (...args) => logs.push(args.join(" ")), error: (...args) => logs.push(args.join(" ")), warn: (...args) => logs.push(args.join(" ")) };
function load(file, dependencies = {}) {
  const source = readFileSync(file, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const forbidden = new Proxy({}, { get: () => () => { sideEffects++; throw new Error("unexpected job dependency"); } });
  new Function("require", "module", "exports", "console", compiled)(
    (id) => dependencies[id] ?? forbidden, module, module.exports, logger,
  );
  return module.exports;
}
const season = load("src/lib/season-state.ts", {
  "@/lib/data/runtime-state-store": { readCachedRuntimeState: async (key) => { assert.equal(key, "season-state"); return state; } },
});
assert.equal((await season.getSeasonState()).status, "season_complete");
const deps = { "@/lib/season-state": season, "next/server": { NextResponse: { json: (body, options) => ({ body, ...options }) } } };
// Real cron route bodies must exit before invoking any of their job dependencies.
for (const name of readdirSync("src/app/api/cron")) {
  if (name === "watchlist-headlines") continue;
  const route = load(`src/app/api/cron/${name}/route.ts`, deps);
  const result = await route.GET(new Request(`https://example.test/api/cron/${name}`));
  assert.equal(result.body.skipped, "season complete", name);
  assert.equal(logs.filter((line) => line === `[${name}] skipped: season complete`).length, 1);
}
assert.equal(sideEffects, 0, "zero LLM, ingest, settle, recompute, or auxiliary requests");
let wireRuns = 0;
const wire = load("src/app/api/cron/watchlist-headlines/route.ts", {
  ...deps, "@/lib/data/watchlist-headlines-service": { ingestWatchlistHeadlines: async () => { wireRuns++; return {}; } },
});
await wire.GET(new Request("https://example.test/api/cron/watchlist-headlines"));
assert.equal(wireRuns, 1);
const integrity = load("src/lib/data/settled-slate-integrity.ts", deps);
const beforeQuiet = logs.length;
assert.deepEqual(await integrity.detectRecentSettledSlateGaps("2026-11-03", async (date) => ({ date, totalGames: 0, completedStarts: 0 })), []);
assert.equal(logs.length, beforeQuiet, "a quiet winter night must produce zero alerts");
await assert.rejects(integrity.detectRecentSettledSlateGaps("2026-11-03", async (date) => ({ date, totalGames: 1, completedStarts: 2 })), /unexpected new settle/);
for (const operation of ["canonical ingest/settle", "slate settle", "form recompute"]) {
  assert.throws(() => season.assertSeasonWriteAllowed(season.DEFAULT_SEASON_STATE, operation), /season complete/);
}
assert(logs.some((line) => line.includes("[season-integrity] unexpected new settle")));
state = { ...season.DEFAULT_SEASON_STATE, status: "in_season", year: 2027 };
assert.equal(await season.skipSeasonJob("rearmed"), false);
assert.doesNotThrow(() => season.assertSeasonWriteAllowed(state, "ingest"));
assert.equal((await season.getSeasonState()).year, 2027);
console.log("OFF-1 gates PASS: 8 crons skipped once, zero job side effects, Wire runs, quiet night zero alerts, unexpected settle alerts, state flip re-arms.");
