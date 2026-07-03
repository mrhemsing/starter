import { RouteLoadingShell } from "@/components/route-loading-shell";

export default function Loading() {
  return <RouteLoadingShell route="heat-check" active="heat" title="Heat Check" description="How starting pitchers are trending over their recent starts." controls="heat" rowStyle="table" rows={12} />;
}
