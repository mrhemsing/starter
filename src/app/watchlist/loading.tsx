import { RouteLoadingShell } from "@/components/route-loading-shell";

export default function Loading() {
  return <RouteLoadingShell route="watchlist" active="watchlist" eyebrow="Daily ritual" title="Watchlist" description="Followed starters, current form, next starts, and digest hooks." controls="profile" layout="watchlist" rows={6} />;
}
