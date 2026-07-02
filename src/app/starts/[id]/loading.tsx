import { RouteLoadingSkeleton } from "@/components/route-loading-skeleton";

export default function Loading() {
  return <RouteLoadingSkeleton activeLabel="Ranked Starts" detail="Loading ranked starts" responsiveCheck="ranked-starts-route-loading" />;
}
