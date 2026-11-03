import frozen from "@/data/season-review-2026.json";
import type { SeasonReviewMetrics } from "@/lib/season-review-metrics";
import type { FeaturedStartHighlight } from "@/lib/types";

export type FrozenSeasonReview = SeasonReviewMetrics & {
  copy: Record<string, { text: string; source: "llm" | "template"; trace: string[] }>;
  frozenRecap: { url: string; capturedAt: string; recap: string };
  highlight: FeaturedStartHighlight | null;
  sourceSha256: string;
  model: string;
};
export const seasonReview2026 = frozen as unknown as FrozenSeasonReview;
