import { RouteLoadingShell } from "@/components/route-loading-shell";

export default function Loading() {
  return <RouteLoadingShell route="home" active="home" title="Every MLB start, ranked." description="GS+ scores a single start 0-100, league average ~50." layout="home" rows={6} />;
}
