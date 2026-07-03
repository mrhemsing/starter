import { RouteLoadingShell } from "@/components/route-loading-shell";

export default function Loading() {
  return <RouteLoadingShell route="start-log" active={null} title="Start Log" description="Start recap shell is ready while the pitch log streams in." layout="profile" rows={5} />;
}
