import { NextResponse } from "next/server";
import { readCanonicalPitcherRegistry } from "@/lib/data/canonical-start-store";
import { syncOffseasonCurrentTeams } from "@/lib/data/current-team-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await syncOffseasonCurrentTeams({ registry: readCanonicalPitcherRegistry });
  return NextResponse.json({ ok: result.status !== "unavailable", result });
}
