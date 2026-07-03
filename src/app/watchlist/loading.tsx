import { RouteLoadingShell } from "@/components/route-loading-shell";
import { WatchlistRowSkeleton } from "./page";

export default function Loading() {
  return (
    <RouteLoadingShell route="watchlist" active="watchlist" eyebrow="Daily ritual" title="Watchlist" description="Followed starters, current form, next starts, and digest hooks." controls="profile" layout="watchlist">
      {Array.from({ length: 6 }).map((_, index) => <WatchlistRowSkeleton key={index} index={index} />)}
    </RouteLoadingShell>
  );
}
