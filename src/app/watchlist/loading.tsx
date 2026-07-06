import { cookies } from "next/headers";
import { RouteLoadingShell } from "@/components/route-loading-shell";
import { WATCHLIST_COOKIE, getWatchlistPitcherIds } from "@/lib/data/watchlist-service";
import { WatchlistRowSkeleton } from "./page";

const WATCHLIST_LOADING_FALLBACK_COUNT = 6; // Historical median followed-card count when local persistence is unavailable.

export default async function Loading() {
  const watchlistValue = (await cookies()).get(WATCHLIST_COOKIE)?.value ?? null;
  const followedCount = watchlistValue ? (await getWatchlistPitcherIds(watchlistValue)).length : WATCHLIST_LOADING_FALLBACK_COUNT;
  const rowCount = Math.max(1, followedCount);

  return (
    <RouteLoadingShell route="watchlist" active="watchlist" eyebrow="Daily ritual" title="Watchlist" description="Followed starters, current form, next starts, and Wire notes." controls="profile" layout="watchlist">
      {Array.from({ length: rowCount }).map((_, index) => <WatchlistRowSkeleton key={index} index={index} />)}
    </RouteLoadingShell>
  );
}
