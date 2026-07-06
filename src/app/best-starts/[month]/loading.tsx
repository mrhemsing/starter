import { RouteLoadingShell } from "@/components/route-loading-shell";

export default function Loading() {
  return (
    <RouteLoadingShell route="best-starts-month" active="starts" eyebrow="Best starts archive" title="Best Starts archive" description="The requested monthly archive is loading." layout="ranked" childrenMode="content">
      <section className="grid gap-2 sm:grid-cols-4" data-navigation-skeleton-route="best-starts-month" data-navigation-skeleton-layout="month-stat-strip">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded border border-white/10 bg-[#101014] px-3 py-2">
            <span className="route-shell-shimmer block h-7 w-16 rounded" />
            <span className="route-shell-shimmer mt-2 block h-3 w-24 rounded" />
          </div>
        ))}
      </section>
      <section className="py-5" data-navigation-skeleton-route="best-starts-month" data-navigation-skeleton-layout="month-hero">
        <div className="grid min-h-[320px] grid-cols-[76px_minmax(0,1fr)_auto] overflow-hidden rounded border border-white/10 bg-[#101014]">
          <span className="route-shell-shimmer h-full min-h-[320px]" />
          <div className="space-y-3 self-center px-4 py-5">
            <span className="route-shell-shimmer block h-10 w-2/3 rounded" />
            <span className="route-shell-shimmer block h-3 w-5/6 rounded" />
            <span className="route-shell-shimmer block h-4 w-48 rounded" />
          </div>
          <span className="route-shell-shimmer m-4 h-20 w-20 self-center rounded" />
        </div>
      </section>
      <section className="py-6" data-navigation-skeleton-route="best-starts-month" data-navigation-skeleton-layout="month-leaderboard">
        <span className="route-shell-shimmer block h-8 w-56 rounded" />
        <div className="mt-4 grid gap-2">
          {Array.from({ length: 24 }).map((_, index) => <ArchiveRowPlaceholder key={index} index={index} />)}
        </div>
      </section>
    </RouteLoadingShell>
  );
}

function ArchiveRowPlaceholder({ index }: { index: number }) {
  return (
    <div className="grid min-h-16 grid-cols-[38px_44px_minmax(0,1fr)_auto] items-center gap-3 rounded border border-white/10 bg-[#101014] px-3 py-2">
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
