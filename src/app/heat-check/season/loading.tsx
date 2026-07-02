import { RouteLoadingSkeleton } from "@/components/route-loading-skeleton";

export default function Loading() {
  return <RouteLoadingSkeleton activeLabel="Heat Check" detail="Loading season leaderboard" responsiveCheck="heat-check-season-route-loading" />;
}
