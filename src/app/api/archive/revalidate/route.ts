import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { revalidateRankedStartsDate } from "@/lib/data/ranked-starts-revalidation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAuthorizedArchiveRevalidationRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  const result = revalidateRankedStartsDate(date, { revalidatePath, revalidateTag }, "archive-backstop");
  return NextResponse.json({ ok: true, ...result });
}

function isAuthorizedArchiveRevalidationRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}
