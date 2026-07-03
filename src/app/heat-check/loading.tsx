import { RouteLoadingShell } from "@/components/route-loading-shell";
import { HeatCheckLoadingControls, HeatCheckLoadingDescription } from "@/components/heat-check-loading-shell";
import { FormLeaderboardRowSkeleton, MomentumHeroSkeleton } from "@/app/form/page";

export default function Loading() {
  return (
    <RouteLoadingShell route="heat-check" active="heat" title="Heat Check" description={<HeatCheckLoadingDescription view="trend" />} layout="heat" childrenMode="content">
      <HeatCheckLoadingControls view="trend" />
      <section className="relative z-0 grid gap-4" data-responsive-check="heat-league-pulse">
        <MomentumHeroSkeleton />
      </section>
      <section className="grid gap-2" aria-label="Heat Check data loading" data-navigation-skeleton-route="heat-check" data-navigation-skeleton-layout="heat">
        {Array.from({ length: 9 }).map((_, index) => <FormLeaderboardRowSkeleton key={index} index={index} view="trend" />)}
      </section>
    </RouteLoadingShell>
  );
}
