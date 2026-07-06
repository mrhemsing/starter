import { unstable_cache } from "next/cache";
import { rankBestStarts } from "@/lib/best-starts-ranking";
import { RANKED_STARTS_CACHE_TAG, SLATE_CACHE_TAG } from "@/lib/data/cache-tags";
import { resolveFeaturedStartHighlight } from "@/lib/data/featured-highlight-service";
import { resolveTopPerformerImage, type TopPerformerImage } from "@/lib/data/top-performer-image-service";
import { getArchivedSeasonStartSummaries, getDailySlate, getHomeSlateDate } from "@/lib/data/start-service";
import { rawGameScorePlus } from "@/lib/gs-plus-raw";
import type { FeaturedStartHighlight, StartSummary } from "@/lib/types";

export const HOME_BEST_STARTS_REVALIDATE_SECONDS = 60;
export const HOME_BEST_STARTS_CACHE_TAG = "home-best-starts";

export type BestStartsHomeResponse = {
  weekly: StartSummary | null;
  monthly: StartSummary | null;
  monthlyRunnerUp: StartSummary | null;
  weeklyHighlight: FeaturedStartHighlight | null;
  monthlyHighlight: FeaturedStartHighlight | null;
  monthlyRunnerUpHighlight: FeaturedStartHighlight | null;
  seasonTopStarts: HomeSeasonTopStart[];
};

export type HomeSeasonTopStart = {
  start: StartSummary;
  rawScore: number | null;
  image: TopPerformerImage | null;
  highlightUrl: string | null;
  isNew: boolean;
};

export async function getBestStartsHome(): Promise<BestStartsHomeResponse> {
  return getCachedBestStartsHome(getHomeSlateDate());
}

const getCachedBestStartsHome = unstable_cache(
  async (anchorDate: string): Promise<BestStartsHomeResponse> => {
    const { weekly, monthly, monthlyRunnerUp, seasonTopStarts } = await getBestStarts(anchorDate);
    const [weeklyHighlight, monthlyHighlight, monthlyRunnerUpHighlight, seasonTopStartViews] = await Promise.all([
      resolveFeaturedStartHighlight(weekly),
      monthly?.id === weekly?.id ? Promise.resolve(null) : resolveFeaturedStartHighlight(monthly),
      resolveFeaturedStartHighlight(monthlyRunnerUp),
      hydrateSeasonTopStarts(seasonTopStarts, anchorDate),
    ]);

    return {
      weekly,
      monthly,
      monthlyRunnerUp,
      weeklyHighlight,
      monthlyHighlight: monthly?.id === weekly?.id ? weeklyHighlight : monthlyHighlight,
      monthlyRunnerUpHighlight,
      seasonTopStarts: seasonTopStartViews,
    };
  },
  ["home-best-starts-v10"],
  { revalidate: HOME_BEST_STARTS_REVALIDATE_SECONDS, tags: [HOME_BEST_STARTS_CACHE_TAG, RANKED_STARTS_CACHE_TAG, SLATE_CACHE_TAG] },
);

async function getBestStarts(anchorDate: string) {
  const [weeklyStarts, monthlyStarts, seasonTopStarts] = await Promise.all([
    getBestStartsWindow(anchorDate, 7),
    getBestStartsWindow(anchorDate, 30),
    getSeasonTopStarts(anchorDate),
  ]);
  const weekly = weeklyStarts[0] ?? null;
  const monthly = monthlyStarts[0] ?? null;
  const monthlyRunnerUp = monthly && weekly?.id === monthly.id ? monthlyStarts.find((start) => start.id !== monthly.id) ?? null : null;
  return { weekly, monthly, monthlyRunnerUp, seasonTopStarts };
}

async function getBestStartsWindow(anchorDate: string, days: number) {
  const dates = Array.from({ length: days }, (_, index) => addDays(anchorDate, -index));
  const slates = await Promise.all(dates.map((date) => getDailySlate({ window: date === anchorDate ? "today" : "yesterday", date })));
  return rankBestStarts(slates.flat());
}

async function getSeasonTopStarts(anchorDate: string) {
  const seasonStarts = await getArchivedSeasonStartSummaries(anchorDate.slice(0, 4));
  return rankBestStarts(seasonStarts).slice(0, 5);
}

async function hydrateSeasonTopStarts(starts: StartSummary[], anchorDate: string): Promise<HomeSeasonTopStart[]> {
  return Promise.all(
    starts.map(async (start) => {
      const [image, highlight] = await Promise.all([
        resolveTopPerformerImage(start, null),
        resolveFeaturedStartHighlight(start),
      ]);

      return {
        start,
        rawScore: rawGameScorePlus(start.gameScorePlusBreakdown),
        image,
        highlightUrl: image?.playUrl ?? highlight?.watchUrl ?? null,
        isNew: daysBetween(start.date, anchorDate) <= 2,
      };
    }),
  );
}

function daysBetween(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
