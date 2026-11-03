import { unstable_cache } from "next/cache";
import { readCanonicalSettledSlateDates } from "@/lib/data/canonical-start-store";
import { RANKED_STARTS_CACHE_TAG } from "@/lib/data/cache-tags";

export const getSeasonArchive = unstable_cache(async (year: number) => {
  const dates = await readCanonicalSettledSlateDates(String(year));
  const finalSlateDate = dates.at(-1);
  if (!finalSlateDate) throw new Error(`No settled slates found for ${year}`);
  return { year, dates, finalSlateDate, label: "Final slate" };
}, ["season-archive-canonical-v1"], { revalidate: 300, tags: [RANKED_STARTS_CACHE_TAG] });
