import { RouteLoadingSkeleton } from "@/components/route-loading-skeleton";

export default function Loading() {
  return <RouteLoadingSkeleton activeLabel="Upcoming" detail="Loading upcoming matchups" layout="upcoming" responsiveCheck="upcoming-date-route-loading" />;
}
