import { RouteLoadingShell } from "@/components/route-loading-shell";

export default function Loading() {
  return <RouteLoadingShell route="upcoming-streamers" active="upcoming" title="Fantasy Week" description="Two-start pitchers and form risers for the fantasy week. Streamer pickups are flagged where lineups are soft." controls="upcoming" layout="upcoming" rows={8} />;
}
