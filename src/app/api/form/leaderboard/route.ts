import { NextResponse } from "next/server";
import { getFormLeaderboard } from "@/lib/data/form-service";

const FORM_LEADERBOARD_REVALIDATE_SECONDS = 15 * 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const qualified = searchParams.get("qualified");
  const leaderboard = await getFormLeaderboard({
    window: searchParams.get("window") ?? undefined,
    qualifiedOnly: qualified === null ? true : qualified !== "false",
    team: searchParams.get("team") ?? undefined,
  });

  return NextResponse.json(leaderboard, {
    headers: {
      "Cache-Control": `public, s-maxage=${FORM_LEADERBOARD_REVALIDATE_SECONDS}, stale-while-revalidate=3600`,
    },
  });
}
