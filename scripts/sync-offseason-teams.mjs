import { writeFileSync } from "node:fs";
import { loadProjectTs } from "./lib/load-project-ts.mjs";

// Authorized publish-time first sync. Later runs use the authenticated weekly cron.
const { readRuntimeState } = loadProjectTs("src/lib/data/runtime-state-store.ts");
const { resolveSeasonState } = loadProjectTs("src/lib/season-state.ts");
const { readCanonicalPitcherRegistry } = loadProjectTs("src/lib/data/canonical-start-store.ts");
const { syncOffseasonCurrentTeams, CURRENT_TEAMS_KEY } = loadProjectTs("src/lib/data/current-team-service.ts");
const result = await syncOffseasonCurrentTeams({
  registry: readCanonicalPitcherRegistry,
  season: async () => resolveSeasonState(await readRuntimeState("season-state", true)),
});
const saved = await readRuntimeState(CURRENT_TEAMS_KEY, true);
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify({ result, saved }, null, 2));
console.log(JSON.stringify({ status: result.status, checked: result.checked, changes: result.changes.length, assignments: Object.keys(saved?.assignments ?? {}).length }));
if (result.status !== "synced") process.exitCode = 1;
