import { RouteLoadingShell } from "@/components/route-loading-shell";
import { HeatCheckLoadingControls, HeatCheckLoadingDescription } from "@/components/heat-check-loading-shell";
import { FormLeaderboardRowSkeleton } from "@/app/form/page";

export default function Loading() {
  return (
    <RouteLoadingShell route="heat-check-season" active="heat" title="Heat Check" description={<HeatCheckLoadingDescription view="season" />} layout="heat" childrenMode="content">
      <HeatCheckLoadingControls view="season" />
      <section className="grid gap-2" aria-label="Heat Check season data loading" data-navigation-skeleton-route="heat-check-season" data-navigation-skeleton-layout="heat">
        {Array.from({ length: 9 }).map((_, index) => <FormLeaderboardRowSkeleton key={index} index={index} view="season" />)}
      </section>
    </RouteLoadingShell>
  );
}
