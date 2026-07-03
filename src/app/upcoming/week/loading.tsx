import { RouteLoadingShell } from "@/components/route-loading-shell";
import { UpcomingWatchCardSkeleton } from "@/components/tonights-must-watch";

export default function Loading() {
  return (
    <RouteLoadingShell route="upcoming-week" active="upcoming" title="Upcoming Matchups" description="Weekly matchup board by starter form and schedule context." controls="upcoming" layout="upcoming">
      <UpcomingWatchCardSkeleton headliner />
      {Array.from({ length: 7 }).map((_, index) => <UpcomingWatchCardSkeleton key={index} index={index + 1} />)}
    </RouteLoadingShell>
  );
}
