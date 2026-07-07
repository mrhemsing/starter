const RUNTIME_STATE_TABLE = "toetheslab_runtime_state";
const RUNTIME_STATE_TIMEOUT_MS = 2500;
const runtimeStateFallback = new Map<string, RuntimeStateValue>();
const reportedRuntimeStateFailures = new Set<string>();

type RuntimeStateValue = Record<string, unknown>;
type RuntimeStateRow = {
  key: string;
  value: RuntimeStateValue;
  updated_at: string;
};

export async function readRuntimeState<T extends RuntimeStateValue>(key: string): Promise<T | null> {
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
      cache: "no-store",
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
