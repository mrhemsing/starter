import { unstable_cache } from "next/cache";
import { RANKED_STARTS_CACHE_TAG, SLATE_CACHE_TAG } from "@/lib/data/cache-tags";
import { withCanonicalStoreDiagnostics } from "@/lib/data/canonical-start-store";
import { resolveFeaturedStartHighlight } from "@/lib/data/featured-highlight-service";
import { getDailySlate, getHomeSlateDate, getRankedSlateCompletionState, getRankedSlateContextForStarts, getRankedStartsArchiveNavigation } from "@/lib/data/start-service";
import type { SlateProgressState } from "@/lib/slate-state";
import type { FeaturedStartHighlight, FormSummary, StartSummary } from "@/lib/types";

const RANKED_STARTS_PAGE_CACHE_VERSION = "ranked-starts-page-v7";
export const RANKED_STARTS_FINAL_REVALIDATE_SECONDS = 24 * 60 * 60;
export const RANKED_STARTS_LIVE_REVALIDATE_SECONDS = 60;

export type RankedStartsPageData = {
  slateStarts: StartSummary[];
  completionState: Awaited<ReturnType<typeof getRankedSlateCompletionState>>;
  slateProgress: SlateProgressState;
  archiveNavigation: Awaited<ReturnType<typeof getRankedStartsArchiveNavigation>>;
  highlights: Array<[string, FeaturedStartHighlight | null]>;
  formByPitcher: Array<[string, FormSummary]>;
};

const getCachedFinalRankedStartsPageData = unstable_cache(
  async (date: string, today: string) => buildRankedStartsPageData(date, today),
  ["ranked-starts-page-final", RANKED_STARTS_PAGE_CACHE_VERSION],
  { revalidate: RANKED_STARTS_FINAL_REVALIDATE_SECONDS, tags: [RANKED_STARTS_CACHE_TAG, SLATE_CACHE_TAG] },
);

const getCachedLiveRankedStartsPageData = unstable_cache(
  async (date: string, today: string) => buildRankedStartsPageData(date, today),
  ["ranked-starts-page-live", RANKED_STARTS_PAGE_CACHE_VERSION],
  { revalidate: RANKED_STARTS_LIVE_REVALIDATE_SECONDS, tags: [RANKED_STARTS_CACHE_TAG, SLATE_CACHE_TAG] },
);

export async function getRankedStartsPageData(date: string, today = getHomeSlateDate()) {
  if (date < today) return getCachedFinalRankedStartsPageData(date, today);

  const completionState = await getRankedSlateCompletionState(date, today);
  if (completionState.isFinal) return getCachedFinalRankedStartsPageData(date, today);

  return getCachedLiveRankedStartsPageData(date, today);
}

async function buildRankedStartsPageData(date: string, today: string): Promise<RankedStartsPageData> {
  const startedAt = performance.now();
  const timings: Array<{ name: string; durationMs: number }> = [];
  const { result, diagnostics } = await withCanonicalStoreDiagnostics(async () => {
    const [slateStarts, archiveNavigation] = await Promise.all([
      measureRankedStartsSpan(timings, "daily-slate", () => getDailySlate({ window: "yesterday", date })),
      measureRankedStartsSpan(timings, "archive-navigation", () => getRankedStartsArchiveNavigation(date, today)),
    ]);
    const slateContext = await measureRankedStartsSpan(timings, "slate-context", () => getRankedSlateContextForStarts(date, today, slateStarts));
    if (!slateContext.completionState || !slateContext.slateProgress) {
      throw new Error(`ranked starts page data missing slate context for ${date}`);
    }
    const completionState = slateContext.completionState;
    const slateProgress = slateContext.slateProgress;
    const starts = measureRankedStartsSyncSpan(timings, "ranking-assembly", () => slateStarts.filter((start) => start.source?.line !== "fixture"));
    const highlights = await measureRankedStartsSpan(timings, "highlights", () => resolveRankedStartHighlights(starts));

    return {
      slateStarts,
      completionState,
      slateProgress,
      archiveNavigation,
      highlights: Array.from(highlights.entries()),
      formByPitcher: [],
    };
  });
  const elapsedMs = Math.round(performance.now() - startedAt);
  timings.push({ name: "total", durationMs: elapsedMs });
  console.info("[ranked-starts-render]", {
    date,
    today,
    elapsedMs,
    serverTiming: formatRankedStartsServerTiming(timings),
    timings,
    canonicalReads: diagnostics.reads,
    canonicalWrites: diagnostics.writes,
    canonicalRowsRead: diagnostics.rowsRead,
    canonicalRowsWritten: diagnostics.rowsWritten,
    starts: result.slateStarts.length,
  });
  return result;
}

async function measureRankedStartsSpan<T>(timings: Array<{ name: string; durationMs: number }>, name: string, action: () => Promise<T>): Promise<T> {
  const startedAt = performance.now();
  try {
    return await action();
  } finally {
    timings.push({ name, durationMs: Math.round(performance.now() - startedAt) });
  }
}

function measureRankedStartsSyncSpan<T>(timings: Array<{ name: string; durationMs: number }>, name: string, action: () => T): T {
  const startedAt = performance.now();
  try {
    return action();
  } finally {
    timings.push({ name, durationMs: Math.round(performance.now() - startedAt) });
  }
}

function formatRankedStartsServerTiming(timings: Array<{ name: string; durationMs: number }>) {
  return timings
    .map((timing) => `ranked-${timing.name};dur=${Math.max(0, timing.durationMs)}`)
    .join(", ");
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
