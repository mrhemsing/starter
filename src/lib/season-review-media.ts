import frozen from "@/data/season-review-media-2026.json";
import type { TopPerformerImage } from "@/lib/data/top-performer-image-service";
import type { FeaturedStartHighlight } from "@/lib/types";

// Presentation assets are separate from the immutable season results and recap.
export const seasonReviewMedia2026 = frozen as {
  startId: string;
  gamePk: number;
  image: TopPerformerImage | null;
  highlights: Record<string, FeaturedStartHighlight | null>;
};
