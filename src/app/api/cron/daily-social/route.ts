import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { dailySocialImagePath, dailySocialPreviewPath, getDailySocialPostDraft } from "@/lib/data/daily-social-post-service";
import { addDays, getHomeSlateDate } from "@/lib/data/start-service";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = addDays(getHomeSlateDate(), -1);
  const draft = await getDailySocialPostDraft(date);

  if (draft.status === "ready") {
    revalidatePath(dailySocialImagePath(date, "instagram"));
    revalidatePath(dailySocialImagePath(date, "x"));
    revalidatePath(dailySocialPreviewPath(date));
  }

  return NextResponse.json({
    ...draft,
    generatedAt: new Date().toISOString(),
    revalidated: draft.status === "ready",
  });
}

function isAuthorizedCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}
