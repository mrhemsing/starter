import { RouteLoadingShell } from "@/components/route-loading-shell";

export default function Loading() {
  return <RouteLoadingShell route="upcoming-streamers" active="upcoming" title="Streamers" description="Probable starter stream candidates by form and matchup." controls="upcoming" rows={8} />;
}
