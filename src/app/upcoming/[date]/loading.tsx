import { RouteLoadingShell } from "@/components/route-loading-shell";
import { UpcomingWatchCardSkeleton } from "@/components/tonights-must-watch";

export default function Loading() {
  return (
    <RouteLoadingShell route="upcoming-day" active="upcoming" title="Upcoming Matchups" description="One card per game, ranked by starter form and matchup context." controls="upcoming" layout="upcoming">
      <UpcomingWatchCardSkeleton headliner />
      {Array.from({ length: 6 }).map((_, index) => <UpcomingWatchCardSkeleton key={index} index={index + 1} />)}
    </RouteLoadingShell>
  );
}
