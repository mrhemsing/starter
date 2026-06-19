import { NextResponse } from "next/server";
import { getPitchingDuels, DUELS_REVALIDATE_SECONDS } from "@/lib/data/duels-service";
import { getHomeSlateDate } from "@/lib/data/start-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? getHomeSlateDate();
  const mode = searchParams.get("mode") === "settled" ? "settled" : "upcoming";
  const data = await getPitchingDuels(date, mode);

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `public, s-maxage=${DUELS_REVALIDATE_SECONDS}, stale-while-revalidate=300`,
    },
  });
}
