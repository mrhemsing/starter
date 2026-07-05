import { NextResponse } from "next/server";
import { syncOddsSnapshotsForDefaultDates } from "@/lib/data/odds-snapshot-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await syncOddsSnapshotsForDefaultDates();
  return NextResponse.json({ ok: true, results });
}

function isAuthorizedCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}
