import { NextResponse } from "next/server";
import { getPitchingDuels, DUELS_REVALIDATE_SECONDS } from "@/lib/data/duels-service";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { invalidDateRouteResponse } from "@/lib/route-date-response";
import { isValidDateRouteParam } from "@/lib/route-date-validation";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? getHomeSlateDate();
  if (!isValidDateRouteParam(date)) return invalidDateRouteResponse();
  const mode = searchParams.get("mode") === "settled" ? "settled" : "upcoming";
  const data = await getPitchingDuels(date, mode);

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `public, s-maxage=${DUELS_REVALIDATE_SECONDS}, stale-while-revalidate=300`,
    },
  });
}
