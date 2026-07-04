import { HOME_RANKED_CACHE_TAG, RANKED_STARTS_CACHE_TAG, SLATE_CACHE_TAG } from "@/lib/data/cache-tags";
import { rankedStartsDateCacheTag } from "@/lib/data/ranked-starts-page-service";
import { rankedStartsPath } from "@/lib/routes";

export type RankedStartsRevalidators = {
  revalidatePath?: (path: string) => void;
  revalidateTag?: (tag: string, profile: "max") => void;
};

export type RankedStartsRevalidationReason =
  | "slate-open"
  | "warming"
  | "first-pitch"
  | "settle-progress"
  | "slate-complete"
  | "leader-change"
  | "archive-backstop";

export function revalidateRankedStartsDate(
  date: string,
  revalidators: RankedStartsRevalidators,
  reason: RankedStartsRevalidationReason,
) {
  const tags = [
    RANKED_STARTS_CACHE_TAG,
    SLATE_CACHE_TAG,
    HOME_RANKED_CACHE_TAG,
    rankedStartsDateCacheTag(date),
  ];
  const paths = ["/", rankedStartsPath(date)];

  for (const tag of tags) {
    revalidators.revalidateTag?.(tag, "max");
  }
  for (const path of paths) {
    revalidators.revalidatePath?.(path);
  }

  console.log("[ranked-starts-revalidation]", {
    date,
    reason,
    tags,
    paths,
  });

  return { date, reason, tags, paths };
}
