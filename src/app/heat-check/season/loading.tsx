import { RouteLoadingShell } from "@/components/route-loading-shell";

export default function Loading() {
  return <RouteLoadingShell route="heat-check-season" active="heat" title="Heat Check" description="Starting pitchers ranked by season GS+." controls="heat" rowStyle="table" rows={12} />;
}
