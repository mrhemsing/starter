import Image from "next/image";
import type { CSSProperties } from "react";
import type { FeaturedStartHighlight } from "@/lib/types";

// Share the daily hero's P3-12.3 responsive focal classes and stored positions.
export function HighlightCover({ highlight, compact = false, onError }: { highlight: FeaturedStartHighlight; compact?: boolean; onError?: () => void }) {
  const cover = highlight.coverImage;
  return <Image src={cover?.imageUrl ?? highlight.thumbnailUrl.replace("maxresdefault.jpg", "hqdefault.jpg")} alt="" fill
    data-highlight-cover={cover ? "action" : "video-thumbnail-fallback"}
    sizes={compact ? "(min-width: 640px) 112px, 80px" : "(min-width: 640px) 560px, 100vw"}
    className="top-performer-image object-cover opacity-90 transition group-hover:opacity-100"
    style={{ "--top-performer-image-position": cover?.objectPosition ?? "50% 50%", "--top-performer-mobile-image-position": cover?.mobileObjectPosition ?? cover?.objectPosition ?? "50% 50%" } as CSSProperties}
    onError={onError} />;
}
