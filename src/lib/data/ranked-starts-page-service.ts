import { unstable_cache } from "next/cache";
import { resolveFeaturedStartHighlight } from "@/lib/data/featured-highlight-service";
import { getPitcherFormMap } from "@/lib/data/form-service";
import { getDailySlate, getHomeSlateDate, getRankedSlateCompletionState, getRankedStartsArchiveNavigation, getSlateStartProgress } from "@/lib/data/start-service";
import type { FeaturedStartHighlight, FormSummary, StartSummary } from "@/lib/types";

const RANKED_STARTS_PAGE_CACHE_VERSION = "ranked-starts-page-v2";
export const RANKED_STARTS_FINAL_REVALIDATE_SECONDS = 24 * 60 * 60;
export const RANKED_STARTS_LIVE_REVALIDATE_SECONDS = 60;

export type RankedStartsPageData = {
  slateStarts: StartSummary[];
  completionState: Awaited<ReturnType<typeof getRankedSlateCompletionState>>;
  slateProgress: Awaited<ReturnType<typeof getSlateStartProgress>>;
  archiveNavigation: Awaited<ReturnType<typeof getRankedStartsArchiveNavigation>>;
  highlights: Array<[string, FeaturedStartHighlight | null]>;
  formByPitcher: Array<[string, FormSummary]>;
};

const getCachedFinalRankedStartsPageData = unstable_cache(
  async (date: string, today: string) => buildRankedStartsPageData(date, today),
  ["ranked-starts-page-final", RANKED_STARTS_PAGE_CACHE_VERSION],
  { revalidate: RANKED_STARTS_FINAL_REVALIDATE_SECONDS },
);

const getCachedLiveRankedStartsPageData = unstable_cache(
  async (date: string, today: string) => buildRankedStartsPageData(date, today),
  ["ranked-starts-page-live", RANKED_STARTS_PAGE_CACHE_VERSION],
  { revalidate: RANKED_STARTS_LIVE_REVALIDATE_SECONDS },
);

export async function getRankedStartsPageData(date: string, today = getHomeSlateDate()) {
  if (date < today) return getCachedFinalRankedStartsPageData(date, today);

  const completionState = await getRankedSlateCompletionState(date, today);
  if (completionState.isFinal) return getCachedFinalRankedStartsPageData(date, today);

  return getCachedLiveRankedStartsPageData(date, today);
}

async function buildRankedStartsPageData(date: string, today: string): Promise<RankedStartsPageData> {
  const [slateStarts, completionState, slateProgress, archiveNavigation] = await Promise.all([
    getDailySlate({ window: "yesterday", date }),
    getRankedSlateCompletionState(date, today),
    getSlateStartProgress({ window: "yesterday", date }),
    getRankedStartsArchiveNavigation(date, today),
  ]);
  const starts = slateStarts.filter((start) => start.source?.line !== "fixture");
  const [highlights, formByPitcher] = await Promise.all([
    resolveRankedStartHighlights(starts),
    getPitcherFormMap(starts.map((start) => String(start.pitcher.mlbId)), { window: 5 }),
  ]);

  return {
    slateStarts,
    completionState,
    slateProgress,
    archiveNavigation,
    highlights: Array.from(highlights.entries()),
    formByPitcher: Array.from(formByPitcher.entries()),
  };
}

async function resolveRankedStartHighlights(starts: StartSummary[]) {
  const map = new Map<string, FeaturedStartHighlight | null>();
  const details = await Promise.all(starts.map((start) => getStartHighlightInput(start)));
  const highlights = await Promise.all(details.map((detail) => resolveFeaturedStartHighlight(detail)));
  starts.forEach((start, index) => map.set(start.id, highlights[index] ?? null));
  return map;
}

function getStartHighlightInput(start: StartSummary) {
  return {
    id: start.id,
    date: start.date,
    pitcher: start.pitcher,
    highlightVideoId: start.highlightVideoId,
  };
}
