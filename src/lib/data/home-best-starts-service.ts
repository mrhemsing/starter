import { unstable_cache } from "next/cache";
import { resolveFeaturedStartHighlight } from "@/lib/data/featured-highlight-service";
import { getArchivedSeasonStartSummaries, getDailySlate, getHomeSlateDate } from "@/lib/data/start-service";
import { isRankedRegularStart } from "@/lib/start-classification";
import { compareRankedStarts } from "@/lib/start-ranking";
import type { FeaturedStartHighlight, StartSummary } from "@/lib/types";

export const HOME_BEST_STARTS_REVALIDATE_SECONDS = 6 * 60 * 60;

export type BestStartsHomeResponse = {
  weekly: StartSummary | null;
  monthly: StartSummary | null;
  weeklyHighlight: FeaturedStartHighlight | null;
  monthlyHighlight: FeaturedStartHighlight | null;
};

export async function getBestStartsHome(): Promise<BestStartsHomeResponse> {
  const yesterday = addDays(getHomeSlateDate(), -1);
  return getCachedBestStartsHome(yesterday);
}

const getCachedBestStartsHome = unstable_cache(
  async (anchorDate: string): Promise<BestStartsHomeResponse> => {
    const { weekly, monthly } = await getBestStarts(anchorDate);
    const [weeklyHighlight, monthlyHighlight] = await Promise.all([
      resolveFeaturedStartHighlight(weekly),
      monthly?.id === weekly?.id ? Promise.resolve(null) : resolveFeaturedStartHighlight(monthly),
    ]);

    return {
      weekly,
      monthly,
      weeklyHighlight,
      monthlyHighlight: monthly?.id === weekly?.id ? weeklyHighlight : monthlyHighlight,
    };
  },
  ["home-best-starts-v2"],
  { revalidate: HOME_BEST_STARTS_REVALIDATE_SECONDS },
);

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
  const starts = slates.flat().filter(isEligibleBestStart);
  return starts.sort(compareBestStarts)[0] ?? null;
}

function rankedWindowStarts(starts: StartSummary[], startDate: string, endDate: string) {
  return starts
    .filter((start) => isEligibleBestStart(start) && start.date >= startDate && start.date <= endDate)
    .sort(compareBestStarts);
}

function isEligibleBestStart(start: StartSummary) {
  return start.source?.line !== "fixture" && isRankedRegularStart(start);
}

function compareBestStarts(a: StartSummary, b: StartSummary) {
  return (
    compareRankedStarts(a, b) ||
    b.date.localeCompare(a.date)
  );
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
