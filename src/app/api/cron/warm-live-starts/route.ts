import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { logRecentSettledSlateGaps } from "@/lib/data/settled-slate-integrity";
import { finalizedStartSignature, prewarmProductionPaths, reconciliationPrewarmPlan, slatePrewarmPaths } from "@/lib/data/production-path-prewarmer";
import { readRuntimeState, writeRuntimeState } from "@/lib/data/runtime-state-store";
import { runWarmLiveStartsJob } from "@/lib/data/warm-live-starts-job";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const RECONCILIATION_PREWARM_MIN_INTERVAL_MS = 30 * 60 * 1000;
const INCREMENTAL_PREWARM_MIN_INTERVAL_MS = 5 * 60 * 1000;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = new URL(request.url).searchParams.get("date") ?? undefined;
  const result = await runWarmLiveStartsJob({ date, revalidatePath, revalidateTag });
  if (result.reason === "no-live-or-final-games") {
    return NextResponse.json({ ...result, tailSkipped: true });
  }
  const settledSlateGaps = await logRecentSettledSlateGaps();
  const deployment = process.env.VERCEL_DEPLOYMENT_ID
    ?? process.env.VERCEL_GIT_COMMIT_SHA
    ?? process.env.VERCEL_URL
    ?? "local";
  const deploymentStateKey = "production-prewarm:last-deployment";
  const deploymentState = await readRuntimeState<{
    deployment?: string;
    finalizedSignature?: string;
    fullWarmedAt?: string;
    incrementalWarmedAt?: string;
  }>(deploymentStateKey);
  const now = Date.now();
  const finalizedSignature = finalizedStartSignature(result.finalizedStartIds ?? []);
  const needsPostDeployWarm = deploymentState?.deployment !== deployment;
  const hasNewFinalizedStarts = deploymentState?.finalizedSignature !== finalizedSignature;
  const fullIntervalElapsed = intervalElapsed(deploymentState?.fullWarmedAt, now, RECONCILIATION_PREWARM_MIN_INTERVAL_MS);
  const incrementalIntervalElapsed = intervalElapsed(deploymentState?.incrementalWarmedAt, now, INCREMENTAL_PREWARM_MIN_INTERVAL_MS);
  const shouldRunFullPrewarm = needsPostDeployWarm || (hasNewFinalizedStarts && fullIntervalElapsed);
  const reconciliationPlan = shouldRunFullPrewarm ? await reconciliationPrewarmPlan(result.date) : null;
  const paths = shouldRunFullPrewarm
    ? [...(reconciliationPlan?.paths ?? []), ...slatePrewarmPaths(result.date)]
    : incrementalIntervalElapsed
      ? ["/", `/starts/${result.date}`, ...slatePrewarmPaths(result.date)]
      : [];
  const prewarm = await prewarmProductionPaths(paths);
  if (paths.length > 0 && prewarm.failed.length === 0) {
    await writeRuntimeState(deploymentStateKey, {
      ...deploymentState,
      deployment: shouldRunFullPrewarm ? deployment : deploymentState?.deployment,
      finalizedSignature: shouldRunFullPrewarm ? finalizedSignature : deploymentState?.finalizedSignature,
      fullWarmedAt: shouldRunFullPrewarm ? new Date(now).toISOString() : deploymentState?.fullWarmedAt,
      incrementalWarmedAt: new Date(now).toISOString(),
    });
  }
  return NextResponse.json({ ...result, settledSlateGaps, prewarm, prewarmMode: shouldRunFullPrewarm ? "full" : paths.length > 0 ? "incremental" : "debounced" });
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
