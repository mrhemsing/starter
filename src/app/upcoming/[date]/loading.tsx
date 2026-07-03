import { RouteLoadingShell } from "@/components/route-loading-shell";

export default function Loading() {
  return <RouteLoadingShell route="upcoming-day" active="upcoming" title="Upcoming Matchups" description="One card per game, ranked by starter form and matchup context." controls="upcoming" layout="upcoming" rows={8} />;
}
