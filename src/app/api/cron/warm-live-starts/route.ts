import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { logRecentSettledSlateGaps } from "@/lib/data/settled-slate-integrity";
import { prewarmProductionPaths, reconciliationPrewarmPaths, slatePrewarmPaths } from "@/lib/data/production-path-prewarmer";
import { readRuntimeState, writeRuntimeState } from "@/lib/data/runtime-state-store";
import { runWarmLiveStartsJob } from "@/lib/data/warm-live-starts-job";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = new URL(request.url).searchParams.get("date") ?? undefined;
  const result = await runWarmLiveStartsJob({ date, revalidatePath, revalidateTag });
  const settledSlateGaps = await logRecentSettledSlateGaps();
  const deployment = process.env.VERCEL_URL ?? "local";
  const deploymentStateKey = "production-prewarm:last-deployment";
  const deploymentState = await readRuntimeState<{ deployment?: string }>(deploymentStateKey);
  const needsPostDeployWarm = deploymentState?.deployment !== deployment;
  const paths = [
    ...(result.completedStarts || needsPostDeployWarm ? await reconciliationPrewarmPaths(result.date) : [`/starts/${result.date}`]),
    ...slatePrewarmPaths(result.date),
  ];
  const prewarm = await prewarmProductionPaths(paths);
  if (needsPostDeployWarm && prewarm.failed.length === 0) {
    await writeRuntimeState(deploymentStateKey, { deployment, warmedAt: new Date().toISOString() });
  }
  return NextResponse.json({ ...result, settledSlateGaps, prewarm });
}

function isAuthorizedCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}
