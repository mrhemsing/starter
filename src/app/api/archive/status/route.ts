import { NextResponse } from "next/server";
import { getSupabaseArchiveStatus } from "@/lib/data/supabase-archive";
import { getCanonicalStartReconciliationReport, getHomeSlateDate } from "@/lib/data/start-service";

export async function GET(request: Request) {
  const defaultDate = getHomeSlateDate();
  const date = new URL(request.url).searchParams.get("date") ?? defaultDate;
  const season = date.slice(0, 4);
  const expectedLastCompletedDate = addDays(defaultDate, -1);
  const [supabase, canonicalReconciliation] = await Promise.all([
    getSupabaseArchiveStatus(season, { expectedLastCompletedDate }),
    getCanonicalStartReconciliationReport(date),
  ]);

  return NextResponse.json({
    date,
    season,
    expectedLastCompletedDate,
    canonicalReconciliation,
    supabase,
  });
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
