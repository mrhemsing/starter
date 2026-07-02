import { RouteLoadingSkeleton } from "@/components/route-loading-skeleton";

export default function Loading() {
  return <RouteLoadingSkeleton activeLabel="Heat Check" detail="Loading Heat Check" responsiveCheck="heat-check-route-loading" />;
}
