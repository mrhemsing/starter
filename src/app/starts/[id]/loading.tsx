import { RouteLoadingShell } from "@/components/route-loading-shell";

export default function Loading() {
  return <RouteLoadingShell route="ranked-starts" active="starts" title="Ranked Starts" description="Completed starts ranked by GS+." controls="ranked" layout="ranked" rows={10} />;
}
