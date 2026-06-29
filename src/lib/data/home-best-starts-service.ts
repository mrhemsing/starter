import { unstable_cache } from "next/cache";
import { resolveFeaturedStartHighlight } from "@/lib/data/featured-highlight-service";
import { getDailySlate, getHomeSlateDate } from "@/lib/data/start-service";
import { isRankedRegularStart } from "@/lib/start-classification";
import { compareRankedStarts } from "@/lib/start-ranking";
import type { FeaturedStartHighlight, StartSummary } from "@/lib/types";

export const HOME_BEST_STARTS_REVALIDATE_SECONDS = 60;
export const HOME_BEST_STARTS_CACHE_TAG = "home-best-starts";

export type BestStartsHomeResponse = {
  weekly: StartSummary | null;
  monthly: StartSummary | null;
  weeklyHighlight: FeaturedStartHighlight | null;
  monthlyHighlight: FeaturedStartHighlight | null;
};

export async function getBestStartsHome(): Promise<BestStartsHomeResponse> {
  return getCachedBestStartsHome(getHomeSlateDate());
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
  ["home-best-starts-v3"],
  { revalidate: HOME_BEST_STARTS_REVALIDATE_SECONDS, tags: [HOME_BEST_STARTS_CACHE_TAG] },
);

async function getBestStarts(anchorDate: string) {
  const [weekly, monthly] = await Promise.all([getBestStartWindow(anchorDate, 7), getBestStartWindow(anchorDate, 30)]);
  return { weekly, monthly };
}

async function getBestStartWindow(anchorDate: string, days: number) {
  const dates = Array.from({ length: days }, (_, index) => addDays(anchorDate, -index));
  const slates = await Promise.all(dates.map((date) => getDailySlate({ window: date === anchorDate ? "today" : "yesterday", date })));
  const starts = slates.flat().filter(isEligibleBestStart);
  return starts.sort(compareBestStarts)[0] ?? null;
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
