import { readFile } from "node:fs/promises";

const CANONICAL_STARTS_TABLE = "toetheslab_canonical_start_records";
const PAGE_SIZE = 1000;
const CONTEXT_KEYS = new Set(["whiffDelta", "velocityDelta", "parkContext", "opponentQuality", "opponentOffense", "calibration"]);

const env = { ...process.env, ...(await loadDotEnv(".env.local")) };
const baseUrl = env.THE_BUMP_SUPABASE_URL ?? env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.THE_BUMP_SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY ?? env.THE_BUMP_SUPABASE_SECRET_KEY ?? env.SUPABASE_SECRET_KEY;

if (!baseUrl || !serviceKey) {
  throw new Error("Missing Supabase URL or service role key");
}

const dryRun = process.argv.includes("--dry-run");
const rows = await readCanonicalRows();
const timestamp = new Date().toISOString();
const updates = [];

for (const row of rows) {
  const record = row.record;
  if (!record || record.status !== "final" || !record.frozen) continue;
  const nextRecord = freezeRecord(record, timestamp);
  if (JSON.stringify(nextRecord) === JSON.stringify(record)) continue;
  updates.push(canonicalRowFromRecord(nextRecord));
}

if (!dryRun) {
  for (let index = 0; index < updates.length; index += 500) {
    await upsertCanonicalRows(updates.slice(index, index + 500));
  }
}

console.log(JSON.stringify({
  scanned: rows.length,
  updated: updates.length,
  dryRun,
}, null, 2));

async function readCanonicalRows() {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = new URL(`/rest/v1/${CANONICAL_STARTS_TABLE}`, baseUrl);
    url.searchParams.set("select", "date,start_id,record");
    url.searchParams.set("order", "date.asc,start_id.asc");
    const response = await fetch(url, {
      headers: {
        ...supabaseHeaders(),
        range: `${offset}-${offset + PAGE_SIZE - 1}`,
      },
    });
    if (!response.ok) throw new Error(`canonical read failed ${response.status}: ${await response.text()}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

async function upsertCanonicalRows(rows) {
  if (rows.length === 0) return;
  const url = new URL(`/rest/v1/${CANONICAL_STARTS_TABLE}`, baseUrl);
  url.searchParams.set("on_conflict", "date,start_id");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`canonical upsert failed ${response.status}: ${await response.text()}`);
}

function freezeRecord(record, timestamp) {
  const breakdown = record.gameScorePlusBreakdown ? freezeBreakdown(record.gameScorePlusBreakdown) : record.gameScorePlusBreakdown;
  const next = {
    ...record,
    gameScorePlusBreakdown: breakdown,
    contextSnapshot: record.contextSnapshot ?? buildContextSnapshot(record, breakdown),
  };
  if (!record.audit?.some((entry) => entry.event === "context-freeze-sweep")) {
    next.audit = [
      ...(record.audit ?? []),
      {
        at: timestamp,
        event: "context-freeze-sweep",
        source: record.source?.line ?? "archive-gamefeed",
        note: "Canonical final score context snapshot added so settled GS+ does not drift with later league context.",
      },
    ];
    next.updatedAt = timestamp;
  }
  return next;
}

function buildContextSnapshot(record, breakdown) {
  const components = new Map((breakdown?.components ?? []).map((component) => [component.key, component]));
  const whiff = components.get("whiffDelta");
  const velocity = components.get("velocityDelta");
  const park = components.get("parkContext");
  const opponentQuality = components.get("opponentQuality");
  const opponentOffense = components.get("opponentOffense");

  return {
    label: `${record.team} vs ${record.opponent} context at settle`,
    whiffDeltaPct: round((whiff?.value ?? 0) / 0.35, 3),
    velocityDeltaMph: round((velocity?.value ?? 0) / 1.75, 3),
    parkRunFactor: round(1 - ((park?.value ?? 0) / 12), 3),
    parkLabel: record.venue ?? "Context at settle park",
    opponentQualityRunValue: opponentQuality?.value ?? 0,
    opponentQualityLabel: labelContextAtSettle(opponentQuality?.description ?? `${record.opponent} opponent context.`),
    opponentOffenseRunValue: opponentOffense?.value ?? 0,
    opponentOffenseLabel: labelContextAtSettle(opponentOffense?.description ?? `${record.opponent} offense context.`),
  };
}

function freezeBreakdown(breakdown) {
  return {
    ...breakdown,
    components: breakdown.components.map(freezeComponent),
    rankingReasons: breakdown.rankingReasons.map(freezeComponent),
  };
}

function freezeComponent(component) {
  if (!CONTEXT_KEYS.has(component.key)) return component;
  return {
    ...component,
    label: labelContextAtSettle(component.label),
    description: labelContextAtSettle(component.description),
  };
}

function labelContextAtSettle(value) {
  return /\bcontext at settle\b/i.test(value) ? value : `${value} Context at settle.`;
}

function canonicalRowFromRecord(record) {
  return {
    date: record.date,
    start_id: record.id,
    game_pk: record.gamePk,
    pitcher_mlb_id: record.pitcherMlbId,
    status: record.status,
    frozen: record.frozen,
    record,
    updated_at: record.updatedAt,
  };
}

function supabaseHeaders() {
  return {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
  };
}

function round(value, precision) {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

async function loadDotEnv(path) {
  try {
    const content = await readFile(path, "utf8");
    return Object.fromEntries(content.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^\s*([A-Za-z0-9_]+)=(.*)$/);
      if (!match) return [];
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      return [[match[1], value]];
    }));
  } catch {
    return {};
  }
}
