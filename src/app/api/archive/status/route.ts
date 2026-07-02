import { NextResponse } from "next/server";
import { getSupabaseArchiveStatus } from "@/lib/data/supabase-archive";
import { getCanonicalStartReconciliationReport, getHomeSlateDate } from "@/lib/data/start-service";

export async function GET(request: Request) {
  const defaultDate = getHomeSlateDate();
  const date = new URL(request.url).searchParams.get("date") ?? defaultDate;
  const season = date.slice(0, 4);
  const [supabase, canonicalReconciliation] = await Promise.all([
    getSupabaseArchiveStatus(season),
    getCanonicalStartReconciliationReport(date),
  ]);

  return NextResponse.json({
    date,
    season,
    canonicalReconciliation,
    supabase,
  });
}
