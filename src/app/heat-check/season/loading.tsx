import { RouteLoadingShell } from "@/components/route-loading-shell";
import { FormLeaderboardRowSkeleton } from "@/app/form/page";

export default function Loading() {
  return (
    <RouteLoadingShell route="heat-check-season" active="heat" title="Heat Check" description="Starting pitchers ranked by season GS+." controls="heat" layout="heat">
      {Array.from({ length: 9 }).map((_, index) => <FormLeaderboardRowSkeleton key={index} index={index} view="season" />)}
    </RouteLoadingShell>
  );
}
