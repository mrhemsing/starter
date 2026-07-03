import { RouteLoadingShell } from "@/components/route-loading-shell";

export default function Loading() {
  return <RouteLoadingShell route="pitcher-form" active={null} title="Pitcher Profile" description="Profile shell and controls are ready while pitcher modules stream in." controls="profile" rowStyle="profile" rows={5} />;
}
