import { RouteLoadingShell } from "@/components/route-loading-shell";

export default function Loading() {
  return <RouteLoadingShell route="shared" active={null} title="Loading" description="Toe the Slab is preparing the requested page." layout="ranked" rows={4} />;
}
