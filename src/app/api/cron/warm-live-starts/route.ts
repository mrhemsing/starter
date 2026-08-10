import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { fetchMlbSchedule } from "@/lib/data/mlb-stats-client";
import { finalizedStartSignature, prewarmProductionPaths, reconciliationPrewarmPlan, slatePrewarmPaths } from "@/lib/data/production-path-prewarmer";
import { readCachedRuntimeState, writeRuntimeState } from "@/lib/data/runtime-state-store";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { runWarmLiveStartsJob } from "@/lib/data/warm-live-starts-job";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const RECONCILIATION_PREWARM_MIN_INTERVAL_MS = 30 * 60 * 1000;
const INCREMENTAL_PREWARM_MIN_INTERVAL_MS = 5 * 60 * 1000;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = new URL(request.url).searchParams.get("date") ?? getHomeSlateDate();
  const cheapState = await readCheapSlateState(date);
  const finalizedObservationKey = `warm-live-starts:finalized:${date}`;
  const finalizedObservation = await readCachedRuntimeState<{
    finalizedGameSignature?: string;
    finalizedGameObservedAt?: string;
  }>(finalizedObservationKey, 5 * 60);
  if (shouldDebounceWarmLiveStarts(cheapState.liveGames, cheapState.finalizedGameSignature, finalizedObservation?.finalizedGameSignature)) {
    return NextResponse.json({ ok: true, date, liveGames: 0, finalizedGameSignature: cheapState.finalizedGameSignature, prewarmMode: "debounced", supabaseReads: 0 });
  }
  if (cheapState.liveGames === 0) {
    await writeRuntimeState(finalizedObservationKey, {
      finalizedGameSignature: cheapState.finalizedGameSignature,
      finalizedGameObservedAt: new Date().toISOString(),
    });
    if (!finalizedObservation?.finalizedGameSignature) {
      return NextResponse.json({ ok: true, date, liveGames: 0, finalizedGameSignature: cheapState.finalizedGameSignature, prewarmMode: "debounced", supabaseReads: 0 });
    }
  }
  const deploymentStateKey = "production-prewarm:last-deployment";
  const deploymentState = await readCachedRuntimeState<{
    deployment?: string;
    finalizedSignature?: string;
    finalizedGameSignature?: string;
    fullWarmedAt?: string;
    incrementalWarmedAt?: string;
  }>(deploymentStateKey, 5 * 60);
  const result = await runWarmLiveStartsJob({ date, revalidatePath, revalidateTag });
  if (result.reason === "no-live-or-final-games") {
    await writeRuntimeState(deploymentStateKey, {
      ...deploymentState,
      finalizedGameSignature: cheapState.finalizedGameSignature,
    });
    return NextResponse.json({ ...result, tailSkipped: true });
  }
  const deployment = process.env.VERCEL_DEPLOYMENT_ID
    ?? process.env.VERCEL_GIT_COMMIT_SHA
    ?? process.env.VERCEL_URL
    ?? "local";
  const now = Date.now();
  const finalizedSignature = finalizedStartSignature(result.finalizedStartIds ?? []);
  const needsPostDeployWarm = deploymentState?.deployment !== deployment;
  const hasNewFinalizedStarts = deploymentState?.finalizedGameSignature !== cheapState.finalizedGameSignature;
  const fullIntervalElapsed = intervalElapsed(deploymentState?.fullWarmedAt, now, RECONCILIATION_PREWARM_MIN_INTERVAL_MS);
  const incrementalIntervalElapsed = intervalElapsed(deploymentState?.incrementalWarmedAt, now, INCREMENTAL_PREWARM_MIN_INTERVAL_MS);
  const shouldRunFullPrewarm = needsPostDeployWarm || (hasNewFinalizedStarts && fullIntervalElapsed);
  const reconciliationPlan = shouldRunFullPrewarm ? await reconciliationPrewarmPlan(result.date) : null;
  const paths = shouldRunFullPrewarm
    ? [...(reconciliationPlan?.paths ?? []), ...slatePrewarmPaths(result.date)]
    : incrementalIntervalElapsed && (cheapState.liveGames > 0 || hasNewFinalizedStarts)
      ? ["/", `/starts/${result.date}`, ...slatePrewarmPaths(result.date)]
      : [];
  const prewarm = await prewarmProductionPaths(paths);
  if (paths.length > 0 && prewarm.failed.length === 0) {
    await writeRuntimeState(deploymentStateKey, {
      ...deploymentState,
      deployment: shouldRunFullPrewarm ? deployment : deploymentState?.deployment,
      finalizedSignature: shouldRunFullPrewarm ? finalizedSignature : deploymentState?.finalizedSignature,
      finalizedGameSignature: cheapState.finalizedGameSignature,
      fullWarmedAt: shouldRunFullPrewarm ? new Date(now).toISOString() : deploymentState?.fullWarmedAt,
      incrementalWarmedAt: new Date(now).toISOString(),
    });
  }
  return NextResponse.json({ ...result, prewarm, prewarmMode: shouldRunFullPrewarm ? "full" : paths.length > 0 ? "incremental" : "debounced" });
}

export function shouldDebounceWarmLiveStarts(liveGames: number, finalizedGameSignature: string, observedSignature?: string) {
  return liveGames === 0 && finalizedGameSignature === observedSignature;
}

export async function readCheapSlateState(date: string) {
  const schedule = await fetchMlbSchedule(date, { fetchLive: true });
  const liveGames = schedule.games.filter((game) => isLiveStatus(game.status, game.detailedState)).length;
  const finalizedGameIds = schedule.games
    .filter((game) => isFinalStatus(game.status, game.detailedState))
    .map((game) => String(game.gamePk));
  return { liveGames, finalizedGameSignature: buildFinalizedGameSignature(date, finalizedGameIds) };
}

export function buildFinalizedGameSignature(date: string, finalizedGameIds: Array<string | number>) {
  return `${date}:${finalizedStartSignature(finalizedGameIds.map(String))}`;
}

function isLiveStatus(status: string, detail: string) {
  return /live|in progress|warmup|delayed/i.test(`${status} ${detail}`);
}

function isFinalStatus(status: string, detail: string) {
  return /final|completed early/i.test(`${status} ${detail}`);
}

function intervalElapsed(previous: string | undefined, now: number, minimumMs: number) {
  const previousMs = previous ? Date.parse(previous) : 0;
  return !Number.isFinite(previousMs) || now - previousMs >= minimumMs;
}

function isAuthorizedCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}
