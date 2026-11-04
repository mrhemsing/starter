import data from "@/data/start-media-2026.json";
import { createHash } from "node:crypto";
import type { FeaturedStartHighlight } from "@/lib/types";
import type { TopPerformerImage } from "@/lib/data/top-performer-image-service";

// Published exact-start assets, including explicit null outcomes. No request-time rediscovery.
export const seasonStartMediaRevision = createHash("sha256").update(JSON.stringify(data)).digest("hex").slice(0, 12);
export const seasonStartMedia2026 = data as Record<string, {
  gamePk: number;
  image: TopPerformerImage | null;
  highlight: FeaturedStartHighlight | null;
}>;
