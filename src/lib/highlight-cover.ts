import type { FeaturedStartHighlight } from "@/lib/types";
import type { TopPerformerImage } from "@/lib/data/top-performer-image-service";

export function withHighlightCover(highlight: FeaturedStartHighlight | null, image: TopPerformerImage | null | undefined): FeaturedStartHighlight | null {
  if (!highlight) return null;
  return { ...highlight, coverImage: image?.source === "action" ? { imageUrl: image.imageUrl, objectPosition: image.objectPosition, mobileObjectPosition: image.mobileObjectPosition } : null };
}
