import { NextResponse } from "next/server";
import { getFormLeaderboard } from "@/lib/data/form-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const qualified = searchParams.get("qualified");
  const leaderboard = await getFormLeaderboard({
    window: searchParams.get("window") ?? undefined,
    qualifiedOnly: qualified === null ? true : qualified !== "false",
  });

  return NextResponse.json(leaderboard);
}
