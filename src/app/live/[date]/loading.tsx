import { RouteLoadingShell } from "@/components/route-loading-shell";

export default function Loading() {
  return <RouteLoadingShell route="live" active="live" eyebrow="Live board" title="Live GS+ Scoreboard" description="Provisional GS+ rows stream in as the live board resolves." rowStyle="table" rows={10} />;
}
