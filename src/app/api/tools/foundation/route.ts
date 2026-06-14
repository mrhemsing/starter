import { NextResponse } from "next/server";
import { getDecisionToolsFoundation } from "@/lib/data/decision-tools-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start") ?? undefined;
  const parsedDays = Number(searchParams.get("days") ?? 7);
  const window = Number(searchParams.get("window") ?? 5);
  const data = await getDecisionToolsFoundation({
    start,
    days: Number.isFinite(parsedDays) ? parsedDays : 7,
    window: window === 3 || window === 10 ? window : 5,
  });

  return NextResponse.json(data);
}
