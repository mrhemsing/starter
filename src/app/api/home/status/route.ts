import { NextResponse } from "next/server";
import { getLiveScoreboard } from "@/lib/data/live-scoreboard-service";
import { getHomeSlateDate, getSlateStartProgress } from "@/lib/data/start-service";
import type { SlateProgressState } from "@/lib/slate-state";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestedDate = new URL(request.url).searchParams.get("date");
  const date = normalizeDateKey(requestedDate) ?? getHomeSlateDate();

  const [slateProgress, liveBoard] = await Promise.all([
    getSlateStartProgress({ window: "today", date }),
    getLiveScoreboard({ date }).catch(() => null),
  ]);

  return NextResponse.json(reconcileSlateProgressWithLiveBoard(slateProgress, liveBoard?.slateProgress ?? null), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function reconcileSlateProgressWithLiveBoard(progress: SlateProgressState, liveProgress: SlateProgressState | null) {
  if (!liveProgress || liveProgress.date !== progress.date) return progress;
  if (progress.state === "reconciling" && liveProgress.completedStarts < progress.totalStarts) return progress;
  if (liveProgress.state === "all-starts-complete" && progress.state !== "all-starts-complete") return liveProgress;
  if (liveProgress.completedStarts > progress.completedStarts) return liveProgress;
  if (progress.liveStarts > 0 && liveProgress.liveStarts === 0 && liveProgress.completedStarts >= progress.completedStarts) return liveProgress;
  return progress;
}

function normalizeDateKey(date: string | null) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return null;
  return parsed.toISOString().slice(0, 10) === date ? date : null;
}
