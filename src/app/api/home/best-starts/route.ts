import { NextResponse } from "next/server";
import { resolveFeaturedStartHighlight } from "@/lib/data/featured-highlight-service";
import { getArchivedSeasonStartSummaries, getDailySlate, getHomeSlateDate } from "@/lib/data/start-service";
import type { StartSummary } from "@/lib/types";

export async function GET() {
  const yesterday = addDays(getHomeSlateDate(), -1);
  const { weekly, monthly } = await getBestStarts(yesterday);
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

async function getBestStarts(anchorDate: string) {
  const archivedStarts = await getArchivedSeasonStartSummaries(anchorDate.slice(0, 4));
  const monthlyWindowStart = addDays(anchorDate, -29);
  const monthlyStarts = rankedWindowStarts(archivedStarts, monthlyWindowStart, anchorDate);

  if (monthlyStarts.length > 0) {
    return {
      weekly: rankedWindowStarts(monthlyStarts, addDays(anchorDate, -6), anchorDate)[0] ?? null,
      monthly: monthlyStarts[0] ?? null,
    };
  }

  const [weekly, monthly] = await Promise.all([getBestStartWindow(anchorDate, 7), getBestStartWindow(anchorDate, 30)]);
  return { weekly, monthly };
}

async function getBestStartWindow(anchorDate: string, days: number) {
  const dates = Array.from({ length: days }, (_, index) => addDays(anchorDate, -index));
  const slates = await Promise.all(dates.map((date) => getDailySlate({ window: "yesterday", date })));
  const starts = slates.flat().filter((start) => start.source?.line !== "fixture");
  return starts.sort((a, b) => b.gameScorePlus - a.gameScorePlus)[0] ?? null;
}

function rankedWindowStarts(starts: StartSummary[], startDate: string, endDate: string) {
  return starts
    .filter((start) => start.source?.line !== "fixture" && start.date >= startDate && start.date <= endDate)
    .sort((a, b) => b.gameScorePlus - a.gameScorePlus);
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
