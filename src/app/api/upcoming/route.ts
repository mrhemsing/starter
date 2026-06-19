import { NextResponse } from "next/server";
import { getUpcomingMustWatch, UPCOMING_REVALIDATE_SECONDS } from "@/lib/data/tonight-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? undefined;
  const start = searchParams.get("start") ?? undefined;
  const parsedDays = Number(searchParams.get("days") ?? (start ? 7 : 1));
  const days = Number.isFinite(parsedDays) ? parsedDays : 1;
  const window = Number(searchParams.get("window") ?? 5);
  const data = await getUpcomingMustWatch({
    date,
    start,
    days,
    window: window === 3 || window === 10 ? window : 5,
  });

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `public, s-maxage=${UPCOMING_REVALIDATE_SECONDS}, stale-while-revalidate=300`,
    },
  });
}
