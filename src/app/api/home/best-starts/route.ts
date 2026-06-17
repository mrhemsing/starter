import { NextResponse } from "next/server";
import { resolveFeaturedStartHighlight } from "@/lib/data/featured-highlight-service";
import { getDailySlate, getHomeSlateDate } from "@/lib/data/start-service";

export async function GET() {
  const yesterday = addDays(getHomeSlateDate(), -1);
  const [weekly, monthly] = await Promise.all([getBestStartWindow(yesterday, 7), getBestStartWindow(yesterday, 30)]);
  const [weeklyHighlight, monthlyHighlight] = await Promise.all([
    resolveFeaturedStartHighlight(weekly),
    monthly?.id === weekly?.id ? Promise.resolve(null) : resolveFeaturedStartHighlight(monthly),
  ]);

  return NextResponse.json({
    weekly,
    monthly,
    weeklyHighlight,
    monthlyHighlight: monthly?.id === weekly?.id ? weeklyHighlight : monthlyHighlight,
  });
}

async function getBestStartWindow(anchorDate: string, days: number) {
  const dates = Array.from({ length: days }, (_, index) => addDays(anchorDate, -index));
  const slates = await Promise.all(dates.map((date) => getDailySlate({ window: "yesterday", date })));
  const starts = slates.flat().filter((start) => start.source?.line !== "fixture");
  return starts.sort((a, b) => b.gameScorePlus - a.gameScorePlus)[0] ?? null;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
