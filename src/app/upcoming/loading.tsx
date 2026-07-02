import { RouteLoadingSkeleton } from "@/components/route-loading-skeleton";

export default function Loading() {
  return <RouteLoadingSkeleton activeLabel="Upcoming" detail="Loading upcoming matchups" responsiveCheck="upcoming-route-loading" />;
}
