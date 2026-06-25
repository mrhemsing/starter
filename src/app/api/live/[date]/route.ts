import { NextResponse } from "next/server";
import { getLiveScoreboard } from "@/lib/data/live-scoreboard-service";

export const revalidate = 30;

export async function GET(_request: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const board = await getLiveScoreboard({ date });
  return NextResponse.json(board);
}
