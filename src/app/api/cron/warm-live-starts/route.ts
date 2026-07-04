import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { runWarmLiveStartsJob } from "@/lib/data/warm-live-starts-job";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = new URL(request.url).searchParams.get("date") ?? undefined;
  const result = await runWarmLiveStartsJob({ date, revalidatePath, revalidateTag });
  return NextResponse.json(result);
}

function isAuthorizedCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}
