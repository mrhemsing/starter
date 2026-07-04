import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type SlateProgress = {
  date: string;
  state: string;
  totalStarts: number;
  completedStarts: number;
  liveStarts: number;
};

type LiveBoardProbe = {
  slateProgress: SlateProgress;
};

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dateOverride = normalizeDateKey(url.searchParams.get("date"));
  const origin = `${url.protocol}//${url.host}`;
  const statusPath = dateOverride ? `/api/home/status?date=${dateOverride}` : "/api/home/status";

  try {
    const slateState = await fetchJson<SlateProgress>(origin, statusPath);
    const liveBoard = await fetchJson<LiveBoardProbe>(origin, `/api/live/${slateState.date}`);
    const mismatches = compareSlateProgress(slateState, liveBoard.slateProgress);

    if (mismatches.length > 0) {
      console.error("[slate-sync] divergence", {
        date: slateState.date,
        mismatches,
        status: compactProgress(slateState),
        live: compactProgress(liveBoard.slateProgress),
      });
      return NextResponse.json({ ok: false, date: slateState.date, mismatches }, { status: 500 });
    }

    console.log("[slate-sync] ok", {
      date: slateState.date,
      status: compactProgress(slateState),
    });
    return NextResponse.json({ ok: true, date: slateState.date, status: compactProgress(slateState) });
  } catch (error) {
    console.error("[slate-sync] probe failed", {
      date: dateOverride,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

async function fetchJson<T>(origin: string, path: string): Promise<T> {
  const response = await fetch(new URL(path, origin), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}: ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

function compareSlateProgress(left: SlateProgress, right: SlateProgress) {
  const mismatches = [];
  for (const key of ["state", "totalStarts", "completedStarts", "liveStarts"] as const) {
    if (left[key] !== right[key]) {
      mismatches.push({ field: key, status: left[key], live: right[key] });
    }
  }
  return mismatches;
}

function compactProgress(progress: SlateProgress) {
  return {
    state: progress.state,
    totalStarts: progress.totalStarts,
    completedStarts: progress.completedStarts,
    liveStarts: progress.liveStarts,
  };
}

function normalizeDateKey(date: string | null) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return null;
  return parsed.toISOString().slice(0, 10) === date ? date : null;
}

function isAuthorizedCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}
