import { RouteLoadingShell } from "@/components/route-loading-shell";
import { FormLeaderboardRowSkeleton } from "@/app/form/page";

export default function Loading() {
  return (
    <RouteLoadingShell route="heat-check" active="heat" title="Heat Check" description="How starting pitchers are trending over their recent starts." controls="heat" layout="heat">
      {Array.from({ length: 9 }).map((_, index) => <FormLeaderboardRowSkeleton key={index} index={index} view="trend" />)}
    </RouteLoadingShell>
  );
}
