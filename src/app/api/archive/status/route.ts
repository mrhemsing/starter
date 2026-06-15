import { NextResponse } from "next/server";
import { getSupabaseArchiveStatus } from "@/lib/data/supabase-archive";
import { getHomeSlateDate } from "@/lib/data/start-service";

export async function GET() {
  const season = getHomeSlateDate().slice(0, 4);
  const supabase = await getSupabaseArchiveStatus(season);

  return NextResponse.json({
    season,
    supabase,
  });
}
