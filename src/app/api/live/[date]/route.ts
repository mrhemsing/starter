import { NextResponse } from "next/server";
import { getLiveScoreboard } from "@/lib/data/live-scoreboard-service";
import { invalidDateRouteResponse } from "@/lib/route-date-response";
import { isValidDateRouteParam } from "@/lib/route-date-validation";

export const revalidate = 30;

export async function GET(_request: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isValidDateRouteParam(date)) return invalidDateRouteResponse();
  const board = await getLiveScoreboard({ date });
  return NextResponse.json(board);
}
