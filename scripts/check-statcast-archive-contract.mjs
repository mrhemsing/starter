import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function read(path) {
  return await readFile(path, "utf8");
}

const [types, archiveRuntime, archiveScript, archiveCheck, syncScript, schema, spike, renderPathAudit] = await Promise.all([
  read("src/lib/types.ts"),
  read("src/lib/data/mlb-archive.ts"),
  read("scripts/archive-mlb-season.mjs"),
  read("scripts/check-mlb-archive.mjs"),
  read("scripts/sync-supabase-mlb-archive.mjs"),
  read("docs/supabase-mlb-archive.sql"),
  read("docs/statcast-arsenal-quality-spike.md"),
  read("scripts/check-render-path-audit.mjs"),
]);

for (const field of [
  "zone",
  "description",
  "launchSpeedMph",
  "launchAngleDeg",
  "estimatedWoba",
  "barrel",
  "hardHit",
  "releaseExtensionFt",
  "spinRateRpm",
  "pfxX",
  "pfxZ",
]) {
  assert(types.includes(`${field}?:`), `PitchEventStatcast must include ${field}`);
  assert(archiveRuntime.includes(`statcast.${field}`), `runtime archive validator must allow ${field}`);
  assert(archiveScript.includes(`statcast.${field}`), `archive writer validator must allow ${field}`);
  assert(archiveCheck.includes(`statcast.${field}`), `archive check must allow ${field}`);
}

assert(types.includes("statcast?: PitchEventStatcast;"), "PitchEvent must carry optional Statcast enrichment under statcast");
assert(archiveRuntime.includes("hasRequiredKeysWithOptional(pitchEvent, ARCHIVED_PITCH_EVENT_KEYS, ARCHIVED_PITCH_EVENT_OPTIONAL_KEYS)"), "runtime archive validator must accept statcast as the only optional pitch-event key");
assert(archiveScript.includes("assertRequiredKeysWithOptional(pitchEvent, ARCHIVED_PITCH_EVENT_KEYS, ARCHIVED_PITCH_EVENT_OPTIONAL_KEYS"), "archive writer must accept statcast as the only optional pitch-event key");
assert(archiveCheck.includes("assertRequiredKeysWithOptional(pitchEvent, archivedPitchEventKeys, archivedPitchEventOptionalKeys"), "archive check must accept statcast as the only optional pitch-event key");

assert(schema.includes("create table if not exists public.toetheslab_statcast_pitch_event_enrichments"), "Supabase schema must define queryable Statcast pitch enrichment table");
assert(schema.includes("alter table public.toetheslab_statcast_pitch_event_enrichments enable row level security;"), "Statcast pitch enrichment table must have RLS enabled");
assert(schema.includes("toetheslab service statcast pitch read") && schema.includes("toetheslab service statcast pitch write"), "Statcast pitch enrichment table must have service-role policies only");

assert(syncScript.includes("const statcastRows = [];"), "Supabase sync must collect Statcast enrichment rows");
assert(syncScript.includes("pitchEvent.statcast"), "Supabase sync must read enriched pitchEvent.statcast payloads");
assert(syncScript.includes('await upsert("toetheslab_statcast_pitch_event_enrichments"'), "Supabase sync must upsert Statcast pitch enrichment rows");
assert(syncScript.includes("statcast pitch enrichments"), "Supabase sync must log Statcast enrichment counts");

assert(spike.includes("toetheslab_statcast_pitch_event_enrichments"), "Statcast spike doc must name the queryable enrichment table");
assert(spike.includes("must not fetch Savant during normal page render"), "Statcast spike guardrail must keep Savant out of normal page render");
assert(
  spike.includes("## Backfill IO Plan") &&
    spike.includes("one date per slice") &&
    spike.includes("Disk IO budget falls below 35%") &&
    spike.includes("503, 504, or 57014-class timeout errors") &&
    spike.includes("resume from the last completed date"),
  "Statcast spike doc must define an off-peak sliced backfill plan with IO budget floor, timeout stop rule, and resumability before enrichment runs",
);
assert(renderPathAudit.includes('"@/lib/data/baseball-savant-client"'), "render-path audit must continue blocking direct Savant imports in idle pages");

console.log("statcast archive contract ok: optional pitch enrichment shape, validators, Supabase sync, RLS, and render guardrails are pinned");
