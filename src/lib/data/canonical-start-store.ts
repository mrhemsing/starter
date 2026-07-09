import { assertValidCanonicalSettledRecord, canonicalStartRecordFromSummary, diffCanonicalStartRecord, reconcileCanonicalStartRecord, startSummaryFromCanonicalRecord } from "@/lib/canonical-start-record";
import type { CanonicalStartRecord } from "@/lib/canonical-start-record";
import type { StartDataSource, StartSummary } from "@/lib/types";
import { AsyncLocalStorage } from "node:async_hooks";

type CanonicalStartStoreFile = {
  date: string;
  updatedAt: string;
  records: CanonicalStartRecord[];
};

type CanonicalStartRow = {
  date: string;
  start_id: string;
  game_pk: number;
  pitcher_mlb_id: number;
  status: CanonicalStartRecord["status"];
  frozen: boolean;
  record: CanonicalStartRecord;
  updated_at: string;
};

type CanonicalSlateStateRow = {
  date: string;
  state: string;
  counts: {
    totalStarts: number;
    liveStarts: number;
    finalStarts: number;
    scheduledStarts: number;
  };
  updated_at: string;
};

export type CanonicalSlateStateSnapshot = {
  date: string;
  state: string;
  counts: CanonicalSlateStateRow["counts"];
  updatedAt: string;
};

const NEXT_PRODUCTION_BUILD_PHASE = "phase-production-build";
const CANONICAL_STARTS_TABLE = "toetheslab_canonical_start_records";
const CANONICAL_SLATE_STATES_TABLE = "toetheslab_canonical_slate_states";
const ALLOW_VOLATILE_CANONICAL_START_STORE = "THE_BUMP_ALLOW_VOLATILE_CANONICAL_STORE";
const CANONICAL_STORE_READ_TIMEOUT_MS = 2_500;
const CANONICAL_STORE_WRITE_TIMEOUT_MS = 5_000;
const CANONICAL_STORE_READ_REVALIDATE_SECONDS = 60;
const CANONICAL_STORE_SLOW_QUERY_MS = 1_000;
const CANONICAL_STORE_WRITE_FAILURE_LIMIT = 3;
const CANONICAL_STORE_CIRCUIT_OPEN_MS = 60_000;
const volatileCanonicalStartStores = new Map<string, CanonicalStartStoreFile>();
const canonicalStoreDiagnostics = new AsyncLocalStorage<CanonicalStoreDiagnostics>();
let canonicalStoreWriteFailures = 0;
let canonicalStoreCircuitOpenUntil = 0;

export type CanonicalStoreDiagnostics = {
  reads: number;
  writes: number;
  rowsRead: number;
  rowsWritten: number;
};

assertCanonicalStartStoreDeploymentConfig();

export async function canonicalizeStartSummariesWithStore(date: string, starts: StartSummary[], now = new Date()): Promise<StartSummary[]> {
  if (shouldSkipCanonicalStartStore(starts)) {
    return starts.map((start) => startSummaryFromCanonicalRecord(canonicalStartRecordFromSummary(start, now), start));
  }

  const store = await readCanonicalStartStore(date);
  const recordsById = new Map(store.records.map((record) => [record.id, record]));
  const canonicalStarts = starts.map((start) => {
    const next = upsertCanonicalStartRecord(recordsById.get(start.id), start, now);
    recordsById.set(start.id, next);
    return startSummaryFromCanonicalRecord(next, start);
  });

  await writeCanonicalStartStore({
    date,
    updatedAt: now.toISOString(),
    records: Array.from(recordsById.values()).sort(compareCanonicalStartRecords),
  });

  return canonicalStarts;
}

export async function readCanonicalizedStartSummaries(date: string, starts: StartSummary[], now = new Date()): Promise<StartSummary[]> {
  if (shouldSkipCanonicalStartStore(starts)) {
    return starts.map((start) => startSummaryFromCanonicalRecord(canonicalStartRecordFromSummary(start, now), start));
  }

  const store = await readCanonicalStartStore(date);
  const recordsById = new Map(store.records.map((record) => [record.id, record]));
  if (recordsById.size === 0) {
    return starts.map((start) => startSummaryFromCanonicalRecord(canonicalStartRecordFromSummary(start, now), start));
  }

  return starts.map((start) => {
    const record = upsertCanonicalStartRecord(recordsById.get(start.id), start, now);
    return startSummaryFromCanonicalRecord(record, start);
  });
}

export async function readCanonicalStartRecords(date: string): Promise<CanonicalStartRecord[]> {
  return (await readCanonicalStartStore(date)).records;
}

export async function readCompleteCanonicalSlateStateDates(season: string): Promise<string[]> {
  if (!/^\d{4}$/.test(season)) throw new Error("invalid canonical slate state season");

  const baseUrl = canonicalStoreSupabaseUrl();
  const serviceKey = canonicalStoreSupabaseServiceKey();
  if (!baseUrl || !serviceKey) {
    failOrBypassMissingDurableCanonicalStore("read");
    return [];
  }

  const url = new URL(`/rest/v1/${CANONICAL_SLATE_STATES_TABLE}`, baseUrl);
  url.searchParams.set("select", "date,state,counts,updated_at");
  url.searchParams.set("date", `gte.${season}-01-01`);
  url.searchParams.append("date", `lte.${season}-12-31`);
  url.searchParams.set("state", "eq.complete");
  url.searchParams.set("order", "date.asc");

  try {
    const response = await timedCanonicalStoreFetch("canonical-slate-states.complete-dates", url, {
      headers: canonicalStoreSupabaseHeaders(serviceKey),
      next: { revalidate: CANONICAL_STORE_READ_REVALIDATE_SECONDS },
    }, CANONICAL_STORE_READ_TIMEOUT_MS);
    if (!response.ok) {
      const message = `${CANONICAL_SLATE_STATES_TABLE} complete-date read failed with HTTP ${response.status}: ${await response.text()}`;
      console.warn(message);
      return [];
    }

    const rows = await response.json() as CanonicalSlateStateRow[];
    recordCanonicalStoreRead(rows.length);
    return rows
      .filter((row) => row.state === "complete" && row.counts.finalStarts >= row.counts.totalStarts && row.counts.totalStarts > 0)
      .map((row) => row.date)
      .sort();
  } catch (error) {
    console.warn("canonical slate state complete-date read failed", { season, error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

export async function readCanonicalSlateState(date: string): Promise<CanonicalSlateStateSnapshot | null> {
  assertCanonicalStartStoreDate(date);
  if (process.env.NEXT_PHASE === NEXT_PRODUCTION_BUILD_PHASE) return null;

  const baseUrl = canonicalStoreSupabaseUrl();
  const serviceKey = canonicalStoreSupabaseServiceKey();
  if (!baseUrl || !serviceKey) {
    failOrBypassMissingDurableCanonicalStore("read");
    return null;
  }

  const url = new URL(`/rest/v1/${CANONICAL_SLATE_STATES_TABLE}`, baseUrl);
  url.searchParams.set("select", "date,state,counts,updated_at");
  url.searchParams.set("date", `eq.${date}`);
  url.searchParams.set("limit", "1");

  try {
    const response = await timedCanonicalStoreFetch("canonical-slate-state.read", url, {
      headers: canonicalStoreSupabaseHeaders(serviceKey),
      next: { revalidate: CANONICAL_STORE_READ_REVALIDATE_SECONDS },
    }, CANONICAL_STORE_READ_TIMEOUT_MS);
    if (!response.ok) {
      console.warn(`${CANONICAL_SLATE_STATES_TABLE} state read failed with HTTP ${response.status}: ${await response.text()}`);
      return null;
    }

    const rows = await response.json() as CanonicalSlateStateRow[];
    recordCanonicalStoreRead(rows.length);
    const row = rows[0];
    return row
      ? {
          date: row.date,
          state: row.state,
          counts: row.counts,
          updatedAt: row.updated_at,
        }
      : null;
  } catch (error) {
    console.warn("canonical slate state read failed", { date, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

export async function writeCanonicalSlateStateSnapshot(snapshot: Omit<CanonicalSlateStateSnapshot, "updatedAt"> & { updatedAt?: string }): Promise<boolean> {
  assertCanonicalStartStoreDate(snapshot.date);
  if (process.env.NEXT_PHASE === NEXT_PRODUCTION_BUILD_PHASE) return false;
  if (isCanonicalStoreCircuitOpen()) return false;

  const baseUrl = canonicalStoreSupabaseUrl();
  const serviceKey = canonicalStoreSupabaseServiceKey();
  if (!baseUrl || !serviceKey) {
    failOrBypassMissingDurableCanonicalStore("write");
    return false;
  }

  try {
    await upsertCanonicalSlateStateRow(baseUrl, serviceKey, {
      date: snapshot.date,
      state: snapshot.state,
      counts: snapshot.counts,
      updated_at: snapshot.updatedAt ?? new Date().toISOString(),
    });
    canonicalStoreWriteFailures = 0;
    return true;
  } catch (error) {
    console.warn("canonical slate state durable write failed", { date: snapshot.date, error: error instanceof Error ? error.message : String(error) });
    noteCanonicalStoreWriteFailure(error instanceof Error ? error.message : String(error));
    return false;
  }
}

export async function withCanonicalStoreDiagnostics<T>(operation: () => Promise<T>): Promise<{ result: T; diagnostics: CanonicalStoreDiagnostics }> {
  const diagnostics: CanonicalStoreDiagnostics = {
    reads: 0,
    writes: 0,
    rowsRead: 0,
    rowsWritten: 0,
  };
  const result = await canonicalStoreDiagnostics.run(diagnostics, operation);
  return { result, diagnostics };
}

function upsertCanonicalStartRecord(existing: CanonicalStartRecord | undefined, start: StartSummary, now: Date) {
  const next = canonicalStartRecordFromSummary(start, now);

  if (!existing) return next;

  assertValidCanonicalSettledRecord(next);
  try {
    assertValidCanonicalSettledRecord(existing);
  } catch (error) {
    if (next.status === "final") return next;
    throw error;
  }

  if (existing.frozen) {
    if (next.status !== "final") return existing;

    const diffs = diffCanonicalStartRecord(existing, next.line, next.gameScorePlus, next.gameScoreV2, next.result, next.venue, next.narrativeNotables);
    return diffs.length > 0
      ? reconcileCanonicalStartRecord(existing, {
        line: next.line,
        gameScorePlus: next.gameScorePlus,
        gameScoreV2: next.gameScoreV2,
        gameScorePlusBreakdown: next.gameScorePlusBreakdown,
        narrativeNotables: next.narrativeNotables,
        contextSnapshot: next.contextSnapshot,
        result: next.result,
        venue: next.venue,
        source: officialCanonicalLineSource(next.source.line),
      }, now)
      : existing;
  }

  if (next.status === "final") {
    return reconcileCanonicalStartRecord(existing, {
      line: next.line,
      gameScorePlus: next.gameScorePlus,
        gameScoreV2: next.gameScoreV2,
        gameScorePlusBreakdown: next.gameScorePlusBreakdown,
        narrativeNotables: next.narrativeNotables,
        contextSnapshot: next.contextSnapshot,
      result: next.result,
      venue: next.venue,
      source: officialCanonicalLineSource(next.source.line),
    }, now);
  }

  const changed = existing.status !== next.status
    || existing.source.line !== next.source.line
    || existing.source.lineStatus !== next.source.lineStatus
    || diffCanonicalStartRecord(existing, next.line, next.gameScorePlus, next.gameScoreV2, next.result, next.venue, next.narrativeNotables).length > 0;

  if (!changed) return existing;

  return {
    ...next,
    createdAt: existing.createdAt,
    audit: [
      ...existing.audit,
      ...next.audit.filter((entry) => entry.event !== "created"),
    ],
  };
}

async function readCanonicalStartStore(date: string): Promise<CanonicalStartStoreFile> {
  assertCanonicalStartStoreDate(date);
  const durableStore = await readDurableCanonicalStartStore(date);
  if (durableStore) return durableStore;
  if (canUseVolatileCanonicalStartStore()) {
    return volatileCanonicalStartStores.get(date) ?? emptyCanonicalStartStore(date);
  }
  return emptyCanonicalStartStore(date);
}

async function writeCanonicalStartStore(store: CanonicalStartStoreFile) {
  assertCanonicalStartStoreDate(store.date);
  store.records.forEach(assertValidCanonicalSettledRecord);
  if (isCanonicalStoreCircuitOpen()) return;
  const written = await writeDurableCanonicalStartStore(store);
  if (written) return;
  if (canUseVolatileCanonicalStartStore()) {
    volatileCanonicalStartStores.set(store.date, store);
    return;
  }
  noteCanonicalStoreWriteFailure("canonical start store write unavailable");
}

function emptyCanonicalStartStore(date: string): CanonicalStartStoreFile {
  return { date, updatedAt: new Date(0).toISOString(), records: [] };
}

function assertCanonicalStartStoreDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("invalid canonical start store date");
}

function shouldSkipCanonicalStartStore(starts: StartSummary[]) {
  return process.env.NEXT_PHASE === NEXT_PRODUCTION_BUILD_PHASE
    || starts.length === 0
    || starts.every((start) => start.source?.line === "fixture");
}

function officialCanonicalLineSource(source: StartDataSource["line"]): Extract<StartDataSource["line"], "archive-gamefeed" | "live-gamefeed"> {
  return source === "live-gamefeed" ? "live-gamefeed" : "archive-gamefeed";
}

function compareCanonicalStartRecords(a: CanonicalStartRecord, b: CanonicalStartRecord) {
  return a.date.localeCompare(b.date) || a.gamePk - b.gamePk || a.pitcherMlbId - b.pitcherMlbId;
}

async function readDurableCanonicalStartStore(date: string): Promise<CanonicalStartStoreFile | null> {
  const baseUrl = canonicalStoreSupabaseUrl();
  const serviceKey = canonicalStoreSupabaseServiceKey();
  if (!baseUrl || !serviceKey) {
    failOrBypassMissingDurableCanonicalStore("read");
    return null;
  }

  const url = new URL(`/rest/v1/${CANONICAL_STARTS_TABLE}`, baseUrl);
  url.searchParams.set("select", "record,updated_at");
  url.searchParams.set("date", `eq.${date}`);
  url.searchParams.set("order", "game_pk.asc,pitcher_mlb_id.asc");

  try {
    const response = await timedCanonicalStoreFetch("canonical-start-records.read", url, {
      headers: canonicalStoreSupabaseHeaders(serviceKey),
      next: { revalidate: CANONICAL_STORE_READ_REVALIDATE_SECONDS },
    }, CANONICAL_STORE_READ_TIMEOUT_MS);
    if (!response.ok) {
      const message = `${CANONICAL_STARTS_TABLE} read failed with HTTP ${response.status}: ${await response.text()}`;
      console.warn(message);
      return null;
    }

    const rows = await response.json() as Array<Pick<CanonicalStartRow, "record" | "updated_at">>;
    recordCanonicalStoreRead(rows.length);
    return {
      date,
      updatedAt: rows.map((row) => row.updated_at).sort().at(-1) ?? new Date(0).toISOString(),
      records: rows.map((row) => row.record).sort(compareCanonicalStartRecords),
    };
  } catch (error) {
    console.warn("canonical start durable store read failed", { date, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

async function writeDurableCanonicalStartStore(store: CanonicalStartStoreFile): Promise<boolean> {
  const baseUrl = canonicalStoreSupabaseUrl();
  const serviceKey = canonicalStoreSupabaseServiceKey();
  if (!baseUrl || !serviceKey) {
    failOrBypassMissingDurableCanonicalStore("write");
    return false;
  }

  try {
    const records = await mergeWithLatestDurableRecords(store.date, store.records);
    await upsertCanonicalStartRows(baseUrl, serviceKey, records);
    await upsertCanonicalSlateStateRow(baseUrl, serviceKey, {
      date: store.date,
      state: canonicalSlateStateFromRecords(records),
      counts: canonicalSlateCountsFromRecords(records),
      updated_at: store.updatedAt,
    });
    canonicalStoreWriteFailures = 0;
    return true;
  } catch (error) {
    console.warn("canonical start durable store write failed", { date: store.date, error: error instanceof Error ? error.message : String(error) });
    noteCanonicalStoreWriteFailure(error instanceof Error ? error.message : String(error));
    return false;
  }
}

async function mergeWithLatestDurableRecords(date: string, records: CanonicalStartRecord[]) {
  const latest = await readDurableCanonicalStartStore(date);
  const recordsById = new Map(latest?.records.map((record) => [record.id, record]) ?? []);

  for (const record of records) {
    assertValidCanonicalSettledRecord(record);
    recordsById.set(record.id, mergeCanonicalStartRecord(recordsById.get(record.id), record));
  }

  return Array.from(recordsById.values()).sort(compareCanonicalStartRecords);
}

function mergeCanonicalStartRecord(existing: CanonicalStartRecord | undefined, next: CanonicalStartRecord) {
  if (existing) assertValidCanonicalSettledRecord(existing);
  assertValidCanonicalSettledRecord(next);
  if (!existing) return next;
  if (existing.frozen && next.status !== "final") return existing;
  if (existing.status === "final" && next.status !== "final") return existing;
  if (next.status === "final" && !existing.frozen) {
    return reconcileCanonicalStartRecord(existing, {
      line: next.line,
      gameScorePlus: next.gameScorePlus,
      gameScoreV2: next.gameScoreV2,
      gameScorePlusBreakdown: next.gameScorePlusBreakdown,
      narrativeNotables: next.narrativeNotables,
      contextSnapshot: next.contextSnapshot,
      result: next.result,
      venue: next.venue,
      source: officialCanonicalLineSource(next.source.line),
    }, new Date(next.updatedAt));
  }
  return new Date(next.updatedAt).getTime() >= new Date(existing.updatedAt).getTime() ? next : existing;
}

async function upsertCanonicalStartRows(baseUrl: string, serviceKey: string, records: CanonicalStartRecord[]) {
  if (records.length === 0) return;
  records.forEach(assertValidCanonicalSettledRecord);

  const url = new URL(`/rest/v1/${CANONICAL_STARTS_TABLE}`, baseUrl);
  url.searchParams.set("on_conflict", "date,start_id");

  const response = await retryCanonicalStoreWrite("canonical-start-records.upsert", url, {
    method: "POST",
    headers: {
      ...canonicalStoreSupabaseHeaders(serviceKey),
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(records.map(canonicalStartRecordToRow)),
  });

  if (!response.ok) {
    throw new Error(`${CANONICAL_STARTS_TABLE} upsert failed with HTTP ${response.status}: ${await response.text()}`);
  }
  recordCanonicalStoreWrite(records.length);
}

async function upsertCanonicalSlateStateRow(baseUrl: string, serviceKey: string, row: CanonicalSlateStateRow) {
  const url = new URL(`/rest/v1/${CANONICAL_SLATE_STATES_TABLE}`, baseUrl);
  url.searchParams.set("on_conflict", "date");

  const response = await retryCanonicalStoreWrite("canonical-slate-state.upsert", url, {
    method: "POST",
    headers: {
      ...canonicalStoreSupabaseHeaders(serviceKey),
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(row),
  });

  if (!response.ok) {
    throw new Error(`${CANONICAL_SLATE_STATES_TABLE} upsert failed with HTTP ${response.status}: ${await response.text()}`);
  }
  recordCanonicalStoreWrite(1);
}

function recordCanonicalStoreRead(rows: number) {
  const diagnostics = canonicalStoreDiagnostics.getStore();
  if (!diagnostics) return;
  diagnostics.reads += 1;
  diagnostics.rowsRead += rows;
}

function recordCanonicalStoreWrite(rows: number) {
  const diagnostics = canonicalStoreDiagnostics.getStore();
  if (!diagnostics) return;
  diagnostics.writes += 1;
  diagnostics.rowsWritten += rows;
}

async function retryCanonicalStoreWrite(queryName: string, url: URL, init: RequestInit) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await timedCanonicalStoreFetch(queryName, url, init, CANONICAL_STORE_WRITE_TIMEOUT_MS);
      if (response.ok || !isRetryableCanonicalStoreStatus(response.status) || attempt === 2) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === 2) throw error;
    }
    await sleep(250 * 2 ** attempt + Math.floor(Math.random() * 150));
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function timedCanonicalStoreFetch(queryName: string, url: URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    const durationMs = Date.now() - startedAt;
    logCanonicalStoreQuery(queryName, durationMs, response.status);
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

function logCanonicalStoreQuery(queryName: string, durationMs: number, status: number) {
  const payload = { query: queryName, durationMs, status };
  if (durationMs >= CANONICAL_STORE_SLOW_QUERY_MS || status >= 500) {
    console.warn("[canonical-store] slow-or-failed query", payload);
    return;
  }
  console.info("[canonical-store] query", payload);
}

function isRetryableCanonicalStoreStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function noteCanonicalStoreWriteFailure(reason: string) {
  canonicalStoreWriteFailures += 1;
  if (canonicalStoreWriteFailures < CANONICAL_STORE_WRITE_FAILURE_LIMIT) return;
  canonicalStoreCircuitOpenUntil = Date.now() + CANONICAL_STORE_CIRCUIT_OPEN_MS;
  console.error("[canonical-store] write circuit opened", {
    failures: canonicalStoreWriteFailures,
    openMs: CANONICAL_STORE_CIRCUIT_OPEN_MS,
    reason,
  });
}

function isCanonicalStoreCircuitOpen() {
  if (Date.now() >= canonicalStoreCircuitOpenUntil) return false;
  console.warn("[canonical-store] write circuit open; deferring canonical write", {
    opensUntil: new Date(canonicalStoreCircuitOpenUntil).toISOString(),
  });
  return true;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function canonicalStartRecordToRow(record: CanonicalStartRecord): CanonicalStartRow {
  assertValidCanonicalSettledRecord(record);
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

function canonicalSlateCountsFromRecords(records: CanonicalStartRecord[]): CanonicalSlateStateRow["counts"] {
  return {
    totalStarts: records.length,
    liveStarts: records.filter((record) => record.status === "live").length,
    finalStarts: records.filter((record) => record.status === "final").length,
    scheduledStarts: records.filter((record) => record.status === "scheduled").length,
  };
}

function canonicalSlateStateFromRecords(records: CanonicalStartRecord[]) {
  const counts = canonicalSlateCountsFromRecords(records);
  if (counts.totalStarts === 0) return "empty";
  if (counts.finalStarts >= counts.totalStarts) return "complete";
  if (counts.liveStarts > 0 || counts.finalStarts > 0) return "active";
  return "pregame";
}

function canonicalStoreSupabaseHeaders(serviceKey: string) {
  return {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
  };
}

function canonicalStoreSupabaseUrl() {
  return process.env.THE_BUMP_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

function canonicalStoreSupabaseServiceKey() {
  return process.env.THE_BUMP_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.THE_BUMP_SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "";
}

function assertCanonicalStartStoreDeploymentConfig() {
  if (!isDeployedCanonicalStoreRuntime()) return;
  if (canonicalStoreSupabaseUrl() && canonicalStoreSupabaseServiceKey()) return;

  throw new Error("Canonical start store requires Supabase URL and service role key in production/preview deployments");
}

function failOrBypassMissingDurableCanonicalStore(operation: "read" | "write") {
  if (isDeployedCanonicalStoreRuntime()) {
    throw new Error(`Cannot ${operation} canonical start store without Supabase URL and service role key in production/preview deployments`);
  }
}

function canUseVolatileCanonicalStartStore() {
  return process.env[ALLOW_VOLATILE_CANONICAL_START_STORE] === "1"
    && !isDeployedCanonicalStoreRuntime();
}

function isDeployedCanonicalStoreRuntime() {
  return process.env.NEXT_PHASE !== NEXT_PRODUCTION_BUILD_PHASE
    && (process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview" || process.env.VERCEL === "1");
}
