import { RouteLoadingShell } from "@/components/route-loading-shell";
import { getDailySlate, getHomeSlateDate } from "@/lib/data/start-service";
import { RankedStartCardSkeleton } from "./page";

const RANKED_STARTS_LOADING_FALLBACK_COUNT = 28; // Median full-slate starter count when schedule data is unavailable.

export default async function Loading() {
  const today = getHomeSlateDate();
  const starts = await getDailySlate({ date: today }).catch(() => []);
  const rowCount = starts.length > 0 ? starts.length : RANKED_STARTS_LOADING_FALLBACK_COUNT;
  const bands = ["Elite", "Plus", "Solid", "Solid", "Below", "Below", "Poor", "Poor"] as const;

  return (
    <RouteLoadingShell route="ranked-starts" active="starts" title="Ranked Starts" description="Completed starts ranked by GS+." descriptionClassName="mt-2 max-w-2xl truncate text-sm leading-6 text-zinc-400" controls="ranked" layout="ranked" childrenMode="content">
      <section className="space-y-4" data-responsive-check="ranked-starts-recap" data-navigation-skeleton-route="ranked-starts" data-navigation-skeleton-layout="ranked" data-loading-row-count={rowCount}>
        {Array.from({ length: rowCount }).map((_, index) => (
          <RankedStartCardSkeleton key={index} index={index} band={bands[index % bands.length]} grouped />
        ))}
      </section>
    </RouteLoadingShell>
  );
}
