import { RouteLoadingShell } from "@/components/route-loading-shell";

export default function Loading() {
  return <RouteLoadingShell route="upcoming-week-date" active="upcoming" title="Upcoming Matchups" description="Weekly matchup board by starter form and schedule context." controls="upcoming" layout="upcoming" rows={10} />;
}
