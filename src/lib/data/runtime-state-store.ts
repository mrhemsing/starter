import { unstable_cache } from "next/cache";

const RUNTIME_STATE_TABLE = "toetheslab_runtime_state";
const RUNTIME_STATE_TIMEOUT_MS = 2500;
const RUNTIME_STATE_CACHE_VERSION = "runtime-state-read-v1";
const runtimeStateFallback = new Map<string, RuntimeStateValue>();
const reportedRuntimeStateFailures = new Set<string>();

type RuntimeStateValue = Record<string, unknown>;
type RuntimeStateRow = {
  key: string;
  value: RuntimeStateValue;
  updated_at: string;
};

export async function readRuntimeState<T extends RuntimeStateValue>(key: string): Promise<T | null> {
  return readRuntimeStateInternal<T>(key, { cache: "no-store" });
}

export function readCachedRuntimeState<T extends RuntimeStateValue>(key: string, revalidateSeconds: number): Promise<T | null> {
  assertRuntimeStateKey(key);
  return unstable_cache(
    async (stateKey: string) => readRuntimeStateInternal<T>(stateKey, { next: { revalidate: revalidateSeconds } }),
    ["runtime-state", RUNTIME_STATE_CACHE_VERSION, String(revalidateSeconds)],
    { revalidate: revalidateSeconds },
  )(key);
}

async function readRuntimeStateInternal<T extends RuntimeStateValue>(
  key: string,
  cacheOptions: { cache: "no-store" } | { next: { revalidate: number } },
): Promise<T | null> {
  assertRuntimeStateKey(key);
  const baseUrl = runtimeStateSupabaseUrl();
  const serviceKey = runtimeStateSupabaseServiceKey();
  if (!baseUrl || !serviceKey) return runtimeStateFallback.get(key) as T | undefined ?? null;

  const url = new URL(`/rest/v1/${RUNTIME_STATE_TABLE}`, baseUrl);
  url.searchParams.set("select", "value");
  url.searchParams.set("key", `eq.${key}`);
  url.searchParams.set("limit", "1");

  try {
    const response = await fetch(url, {
      headers: runtimeStateSupabaseHeaders(serviceKey),
      ...cacheOptions,
      signal: AbortSignal.timeout(RUNTIME_STATE_TIMEOUT_MS),
    });
    if (!response.ok) {
      reportRuntimeStateFailure("read", response.status);
      return runtimeStateFallback.get(key) as T | undefined ?? null;
    }
    const rows = await response.json() as Array<Pick<RuntimeStateRow, "value">>;
    return (rows[0]?.value as T | undefined) ?? (runtimeStateFallback.get(key) as T | undefined) ?? null;
  } catch (error) {
    reportRuntimeStateFailure("read", error instanceof Error ? error.message : "unknown");
    return runtimeStateFallback.get(key) as T | undefined ?? null;
  }
}

export async function readRuntimeStates<T extends RuntimeStateValue>(keys: string[]): Promise<Map<string, T>> {
  const uniqueKeys = uniqueRuntimeStateKeys(keys);
  const fallbackRows = new Map(uniqueKeys.flatMap((key) => {
    const value = runtimeStateFallback.get(key) as T | undefined;
    return value ? [[key, value] as const] : [];
  }));
  if (uniqueKeys.length === 0) return fallbackRows;

  const baseUrl = runtimeStateSupabaseUrl();
  const serviceKey = runtimeStateSupabaseServiceKey();
  if (!baseUrl || !serviceKey) return fallbackRows;

  const url = new URL(`/rest/v1/${RUNTIME_STATE_TABLE}`, baseUrl);
  url.searchParams.set("select", "key,value");
  url.searchParams.set("key", `in.(${uniqueKeys.map(quotePostgrestValue).join(",")})`);

  try {
    const response = await fetch(url, {
      headers: runtimeStateSupabaseHeaders(serviceKey),
      cache: "no-store",
      signal: AbortSignal.timeout(RUNTIME_STATE_TIMEOUT_MS),
    });
    if (!response.ok) {
      reportRuntimeStateFailure("read", response.status);
      return fallbackRows;
    }
    const rows = await response.json() as Array<Pick<RuntimeStateRow, "key" | "value">>;
    return new Map([
      ...fallbackRows,
      ...rows.map((row) => [row.key, row.value as T] as const),
    ]);
  } catch (error) {
    reportRuntimeStateFailure("read", error instanceof Error ? error.message : "unknown");
    return fallbackRows;
  }
}

export async function writeRuntimeState(key: string, value: RuntimeStateValue) {
  assertRuntimeStateKey(key);
  runtimeStateFallback.set(key, value);
  const baseUrl = runtimeStateSupabaseUrl();
  const serviceKey = runtimeStateSupabaseServiceKey();
  if (!baseUrl || !serviceKey) return false;

  const url = new URL(`/rest/v1/${RUNTIME_STATE_TABLE}`, baseUrl);
  url.searchParams.set("on_conflict", "key");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...runtimeStateSupabaseHeaders(serviceKey),
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({
        key,
        value,
        updated_at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(RUNTIME_STATE_TIMEOUT_MS),
    });
    if (!response.ok) reportRuntimeStateFailure("write", response.status);
    return response.ok;
  } catch (error) {
    reportRuntimeStateFailure("write", error instanceof Error ? error.message : "unknown");
    return false;
  }
}

export async function writeRuntimeStates(rows: Array<{ key: string; value: RuntimeStateValue }>) {
  const uniqueRows = uniqueRuntimeStateRows(rows);
  if (uniqueRows.length === 0) return true;
  const updatedAt = new Date().toISOString();
  for (const row of uniqueRows) {
    runtimeStateFallback.set(row.key, row.value);
  }

  const baseUrl = runtimeStateSupabaseUrl();
  const serviceKey = runtimeStateSupabaseServiceKey();
  if (!baseUrl || !serviceKey) return false;

  const url = new URL(`/rest/v1/${RUNTIME_STATE_TABLE}`, baseUrl);
  url.searchParams.set("on_conflict", "key");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        ...runtimeStateSupabaseHeaders(serviceKey),
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(uniqueRows.map((row) => ({
        key: row.key,
        value: row.value,
        updated_at: updatedAt,
      }))),
      signal: AbortSignal.timeout(RUNTIME_STATE_TIMEOUT_MS),
    });
    if (!response.ok) reportRuntimeStateFailure("write", response.status);
    return response.ok;
  } catch (error) {
    reportRuntimeStateFailure("write", error instanceof Error ? error.message : "unknown");
    return false;
  }
}

function reportRuntimeStateFailure(operation: "read" | "write", reason: number | string) {
  const key = `${operation}:${reason}`;
  if (reportedRuntimeStateFailures.has(key)) return;
  reportedRuntimeStateFailures.add(key);
  console.error("[runtime-state] durable state unavailable; using process fallback", {
    table: RUNTIME_STATE_TABLE,
    operation,
    reason,
  });
}

function assertRuntimeStateKey(key: string) {
  if (!/^[a-z0-9:_-]{1,160}$/i.test(key)) throw new Error(`invalid runtime state key: ${key}`);
}

function uniqueRuntimeStateKeys(keys: string[]) {
  const unique = [...new Set(keys)];
  for (const key of unique) {
    assertRuntimeStateKey(key);
  }
  return unique;
}

function uniqueRuntimeStateRows(rows: Array<{ key: string; value: RuntimeStateValue }>) {
  const byKey = new Map<string, RuntimeStateValue>();
  for (const row of rows) {
    assertRuntimeStateKey(row.key);
    byKey.set(row.key, row.value);
  }
  return [...byKey.entries()].map(([key, value]) => ({ key, value }));
}

function quotePostgrestValue(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function runtimeStateSupabaseHeaders(serviceKey: string) {
  return {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
  };
}

function runtimeStateSupabaseUrl() {
  return process.env.THE_BUMP_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

function runtimeStateSupabaseServiceKey() {
  return process.env.THE_BUMP_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.THE_BUMP_SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SECRET_KEY ?? "";
}
