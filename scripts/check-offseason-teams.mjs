import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import ts from "typescript";
import { loadProjectTs } from "./lib/load-project-ts.mjs";

const native = createRequire(import.meta.url);
function load(file, overrides, append = "") {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, "utf8") + append, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  new Function("require", "module", "exports", code)((id) => overrides[id] ?? (id.startsWith("@/") ? loadProjectTs(`src/${id.slice(2)}.ts`) : native(id)), module, module.exports);
  return module.exports;
}
const service = loadProjectTs("src/lib/data/current-team-service.ts");
const season = loadProjectTs("src/lib/season-state.ts").DEFAULT_SEASON_STATE;
const reviewBytes = readFileSync("src/data/season-review-2026.json");
const canonicalBytes = readFileSync("data/season-reviews/2026-canonical.json");
const digest = (value) => createHash("sha256").update(value).digest("hex");
const frozenHashes = [digest(reviewBytes), digest(canonicalBytes)];
const review = JSON.parse(reviewBytes);
const pitcher = structuredClone(review.home.hot[0]);
const before = JSON.stringify(pitcher);
const destination = pitcher.team === "NYY" ? "BOS" : "NYY";
const teamMeta = loadProjectTs("src/lib/team-metadata.ts").MLB_TEAMS;
let saved = null, writes = 0, requests = 0;
const logs = [];
const deps = {
  season: async () => season,
  registry: async () => [pitcher],
  read: async () => saved,
  write: async (value) => { saved = value; writes++; return true; },
  fetchTeams: async () => { requests++; return [{ id: Number(pitcher.pitcherId), currentTeam: { id: teamMeta[destination].id } }]; },
  now: () => "2026-11-03T21:00:00.000Z",
  log: (line) => logs.push(line),
};
const changed = await service.syncOffseasonCurrentTeams(deps);
assert.equal(changed.status, "synced");
assert.equal(changed.changes.length, 1);
assert.equal(saved.assignments[pitcher.pitcherId].team, destination);
assert.equal(changed.changes[0].headshotRefresh, "spring-refresh-pending");
assert(logs.some((line) => line.includes('"from"') && line.includes('"to"')));
const overlay = service.withCurrentTeam(pitcher, saved);
assert.equal(overlay.team, destination);
assert.equal(overlay.teamChangeNote, `Team updated to ${destination}`);
assert.deepEqual(overlay.lastStart, pitcher.lastStart);
assert.equal(JSON.stringify(pitcher), before);
assert.equal((await service.syncOffseasonCurrentTeams(deps)).changes.length, 0);
assert.equal(saved.transactions.length, 1, "no duplicate transaction on weekly repeat");
const priorSaved = JSON.stringify(saved), priorWrites = writes, priorRequests = requests;
assert.equal((await service.syncOffseasonCurrentTeams({ ...deps, season: async () => ({ ...season, status: "in_season" }) })).status, "skipped");
assert.equal(requests, priorRequests);
assert.equal((await service.syncOffseasonCurrentTeams({ ...deps, fetchTeams: async () => { throw new Error("seeded MLB outage"); } })).status, "unavailable");
assert.equal(writes, priorWrites);
assert.equal(JSON.stringify(saved), priorSaved);
assert.equal((await service.syncOffseasonCurrentTeams({ ...deps, write: async () => false })).status, "unavailable");

const affiliate = await service.syncOffseasonCurrentTeams({ ...deps, fetchTeams: async () => [{ id: Number(pitcher.pitcherId), currentTeam: { id: 422, parentOrgId: 141 } }], write: async (value) => { assert.equal(value.assignments[pitcher.pitcherId].team, "TOR"); return true; } });
assert.equal(affiliate.status, "synced");
await service.syncOffseasonCurrentTeams({ ...deps, fetchTeams: async () => [{ id: Number(pitcher.pitcherId), currentTeam: { id: 672, parentOrgId: 11 } }], write: async (value) => { assert.equal(value.assignments[pitcher.pitcherId].team, "FA"); return true; } });
// Exercise the real Watchlist hydration and history-preserving overlay.
const current = { ...service, readCurrentTeams: async () => saved };
const common = {
  "@/lib/season-state": { getSeasonState: async () => season },
  "@/lib/data/current-team-service": current,
  "@/lib/data/runtime-state-store": { readRuntimeState: async () => null, writeRuntimeState: async () => true },
  "@/lib/data/form-service": { getFormLeaderboard: async () => ({ pitchers: [pitcher] }) },
  "@/lib/data/start-service": { getHomeSlateDate: () => "2026-11-03" },
  "@/lib/data/watchlist-headlines-service": { readWatchlistHeadlineEvents: async () => new Map() },
};
const watchlist = load("src/lib/data/watchlist-service.ts", common);
const view = await watchlist.getWatchlistView(`wlids_${pitcher.pitcherId}`);
assert.equal(view.entries[0].team, destination);
assert.equal(view.entries[0].teamChangeNote, `Team updated to ${destination}`);
assert.deepEqual(view.entries[0].lastStart, pitcher.lastStart);

// Render real server/client page component trees, mocking I/O and unrelated children only.
const React = native("react");
const ReactDOM = native("react-dom/server");
const child = ({ children }) => React.createElement("div", null, children);
const componentMocks = {};
for (const file of ["src/app/watchlist/page.tsx", "src/app/pitchers/[id]/form/page.tsx"]) {
  for (const match of readFileSync(file, "utf8").matchAll(/import \{ ([^}]+) \} from "(@\/components\/[^\"]+)"/g)) {
    componentMocks[match[2]] = { ...componentMocks[match[2]], ...Object.fromEntries(match[1].split(",").map((name) => [name.trim(), child])) };
  }
}
const page = load("src/app/watchlist/page.tsx", { ...common, ...componentMocks,
  "next/link": child,
  "next/headers": { cookies: async () => ({ get: () => ({ value: `wlids_${pitcher.pitcherId}` }) }) },
  "@/lib/data/watchlist-service": { ...watchlist, getWatchlistView: async () => view },
}, "\nexport { WatchlistRow as TestRow };\n");
const html = ReactDOM.renderToStaticMarkup(React.createElement(page.TestRow, { entry: view.entries[0], state: "unscheduled" }));
assert(html.includes(`Team updated to ${destination}`));
assert(html.includes(destination));
assert(html.includes("Next start: 2027 season"));
assert(!html.includes("NEXT: TBD"));
const suggested = load("src/components/watchlist-suggested-follows.tsx", { ...componentMocks, "next/link": child });
assert(ReactDOM.renderToStaticMarkup(React.createElement(suggested.WatchlistSuggestedFollows, { results: [overlay], followedIds: [], query: "" })).includes(destination));
for (const file of ["src/app/pitchers/[id]/form/page.tsx", "src/app/pitchers/page.tsx", "src/app/watchlist/page.tsx"]) {
  assert(readFileSync(file, "utf8").includes("withCurrentTeam"), `current team boundary: ${file}`);
}
assert(readFileSync("src/app/pitchers/[id]/form/page.tsx", "utf8").includes("{currentPitcher.team} / Last"));
const profile = load("src/app/pitchers/[id]/form/page.tsx", { ...common, ...componentMocks,
  "next/link": child,
  "@/lib/data/form-service": { parseFormWindow: () => 5 },
  "@/lib/data/start-service": { getHomeSlateDate: () => "2026-11-03", getPitcherApiResponse: async () => null, getStartDetail: async () => null },
  "@/lib/data/odds-snapshot-service": { readPitcherStrikeoutLineResults: async () => [] },
  "@/lib/data/watchlist-headlines-service": { readOrFetchPitcherHeadlineEvents: async () => new Map() },
});
const profileTree = await profile.default({ params: Promise.resolve({ id: pitcher.pitcherId }), initialForm: { summary: pitcher, series: [pitcher.lastStart], window: 5 } });
function texts(node) {
  if (Array.isArray(node)) return node.flatMap(texts);
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (!node?.props) return [];
  return texts(node.props.children);
}
assert(texts(profileTree).join(" ").includes(`${destination}  / Last`), "actual pitcher header uses updated current team");
assert.equal(JSON.stringify(pitcher), before, "profile must not mutate frozen summary");
const headlines = loadProjectTs("src/lib/data/watchlist-headlines-service.ts");
const candidate = { pitcherId: pitcher.pitcherId, headline: `${pitcher.name} traded to Yankees`, source: "MLB", sourceType: "google-news", url: "https://www.mlb.com/news/transaction", publishedAt: new Date().toISOString() };
assert(headlines.filterHeadlineCandidate(candidate, overlay, [overlay]));
assert.equal(headlines.filterHeadlineCandidate({ ...candidate, headline: "Unrelated batter signs contract" }, overlay, [overlay]), null);
assert.deepEqual([digest(readFileSync("src/data/season-review-2026.json")), digest(readFileSync("data/season-reviews/2026-canonical.json"))], frozenHashes);
const offReader = load("src/lib/data/current-team-service.ts", {
  "@/lib/season-state": { getSeasonState: async () => ({ ...season, status: "in_season" }) },
  "@/lib/data/runtime-state-store": { readCachedRuntimeState: async () => { throw new Error("in-season stale team read"); } },
});
assert.equal(await offReader.readCurrentTeams(), null);
let cronCalls = 0;
const route = load("src/app/api/cron/offseason-teams/route.ts", {
  "next/server": { NextResponse: { json: (body, options) => ({ body, ...options }) } },
  "@/lib/data/canonical-start-store": { readCanonicalPitcherRegistry: async () => [] },
  "@/lib/data/current-team-service": { syncOffseasonCurrentTeams: async () => { cronCalls++; return { status: "synced" }; } },
});
const oldSecret = process.env.CRON_SECRET;
process.env.CRON_SECRET = "fixture-only";
assert.equal((await route.GET(new Request("https://test.invalid"))).status, 401);
assert.equal(cronCalls, 0);
assert.equal((await route.GET(new Request("https://test.invalid", { headers: { authorization: "Bearer fixture-only" } }))).body.ok, true);
assert.equal(cronCalls, 1);
if (oldSecret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = oldSecret;
const cron = JSON.parse(readFileSync("vercel.json")).crons.find((item) => item.path === "/api/cron/offseason-teams");
assert.equal(cron.schedule, "0 12 * * 1");
console.log("OFF-1 Phase 2 PASS: seeded team change, Watchlist hydration/transaction rendering, suggested follows, current-team boundaries, historical freeze, repeat idempotency, in-season skip, API/write failure, diff/art log, weekly schedule, Wire transaction relevance.");
