import { withHighlightCover } from "@/lib/highlight-cover";
import { seasonStartMedia2026 } from "@/lib/season-start-media";
import frozen from "@/data/season-review-media-2026.json";
import type { TopPerformerImage } from "@/lib/data/top-performer-image-service";
import type { FeaturedStartHighlight } from "@/lib/types";

// Presentation assets are separate from the immutable season results and recap.
const stored = frozen as {
  startId: string;
  gamePk: number;
  image: TopPerformerImage | null;
  highlights: Record<string, FeaturedStartHighlight | null>;
};

export const seasonReviewMedia2026 = { ...stored, highlights: Object.fromEntries(Object.entries(stored.highlights).map(([id, highlight]) => [id, withHighlightCover(highlight, id === stored.startId ? stored.image : seasonStartMedia2026[id]?.image)])) };
