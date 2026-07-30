import { RouteLoadingShell } from "@/components/route-loading-shell";

export default function Loading() {
  return <RouteLoadingShell route="shared" active={null} title="Warming up" layout="ranked" rows={4} />;
}
