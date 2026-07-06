import { RouteLoadingShell } from "@/components/route-loading-shell";

export default function Loading() {
  return (
    <RouteLoadingShell route="best-starts" active="starts" title="Best Starts of 2026" description="The best starts of the 2026 season, with rolling 7 and 30-day leaders up top." layout="ranked" childrenMode="content">
      <section className="grid gap-3 border-y border-white/10 py-6 md:grid-cols-2" data-navigation-skeleton-route="best-starts" data-navigation-skeleton-layout="season-hub">
        <BestStartsHeroPlaceholder />
        <BestStartsHeroPlaceholder />
      </section>
      <section className="py-6" data-navigation-skeleton-route="best-starts" data-navigation-skeleton-layout="season-leaderboard">
        <span className="route-shell-shimmer block h-8 w-48 rounded" />
        <div className="mt-4 grid gap-2">
          {Array.from({ length: 25 }).map((_, index) => <BestStartsRowPlaceholder key={index} index={index} />)}
        </div>
      </section>
    </RouteLoadingShell>
  );
}

function BestStartsHeroPlaceholder() {
  return (
    <article className="grid gap-4 rounded border border-white/10 bg-[#101014] p-5 sm:grid-cols-[80px_minmax(0,1fr)_auto] sm:items-center">
      <span className="route-shell-shimmer h-20 w-16 rounded" />
      <div className="min-w-0 space-y-3">
        <span className="route-shell-shimmer block h-3 w-28 rounded" />
        <span className="route-shell-shimmer block h-8 w-2/3 rounded" />
        <span className="route-shell-shimmer block h-3 w-5/6 rounded" />
      </div>
      <span className="route-shell-shimmer h-16 w-20 rounded" />
    </article>
  );
}

function BestStartsRowPlaceholder({ index }: { index: number }) {
  return (
    <div className="grid min-h-16 grid-cols-[42px_44px_minmax(0,1fr)_auto] items-center gap-3 rounded border border-white/10 bg-[#101014] px-3 py-2">
      <span className="route-shell-shimmer h-8 w-8 rounded" />
      <span className="route-shell-shimmer h-11 w-10 rounded" />
      <div className="space-y-2">
        <span className={`route-shell-shimmer block h-5 rounded ${index % 2 === 0 ? "w-2/3" : "w-1/2"}`} />
        <span className="route-shell-shimmer block h-3 w-5/6 rounded" />
      </div>
      <span className="route-shell-shimmer h-12 w-16 rounded" />
    </div>
  );
}
