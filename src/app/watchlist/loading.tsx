import { RouteLoadingShell } from "@/components/route-loading-shell";
import { WatchlistRowSkeleton } from "./page";

const WATCHLIST_LOADING_FALLBACK_COUNT = 6; // Historical median followed-card count when local persistence is unavailable.

export default function Loading() {
  return (
    <RouteLoadingShell route="watchlist" active="watchlist" eyebrow="Daily ritual" title="Watchlist" description="Followed starters, current form, next starts, and Wire notes." controls="profile" layout="watchlist">
      {Array.from({ length: WATCHLIST_LOADING_FALLBACK_COUNT }).map((_, index) => <WatchlistRowSkeleton key={index} index={index} />)}
    </RouteLoadingShell>
  );
}
