import { withHighlightCover } from "@/lib/highlight-cover";
import data from "@/data/start-media-2026.json";
import { createHash } from "node:crypto";
import type { FeaturedStartHighlight } from "@/lib/types";
import type { TopPerformerImage } from "@/lib/data/top-performer-image-service";

// Published exact-start assets, including explicit null outcomes. No request-time rediscovery.
export const seasonStartMediaRevision = createHash("sha256").update(JSON.stringify(data)).digest("hex").slice(0, 12);
const stored = data as Record<string, {
  gamePk: number;
  image: TopPerformerImage | null;
  highlight: FeaturedStartHighlight | null;
}>;

export const seasonStartMedia2026 = Object.fromEntries(Object.entries(stored).map(([id, value]) => [id, { ...value, highlight: withHighlightCover(value.highlight, value.image) }]));
