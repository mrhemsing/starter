export function WatchlistRowSkeleton({ index = 0 }: { index?: number }) {
  const bandColor = index % 3 === 0 ? "#FF7A3D" : index % 3 === 1 ? "#888780" : "#8FCBFF";

  return (
    <article className="grid gap-3 rounded border border-l-4 border-white/10 bg-[#101014] p-4 sm:grid-cols-[minmax(0,1fr)_140px] lg:grid-cols-[minmax(0,1fr)_150px_170px]" style={{ borderLeftColor: bandColor }} data-skeleton-row="watchlist">
      <div className="grid min-w-0 grid-cols-[52px_minmax(0,1fr)] gap-3">
        <span className="route-shell-shimmer ml-1 block h-[65px] w-[52px] rounded" />
        <div className="min-w-0">
          <span className="route-shell-shimmer block h-7 w-2/3 rounded" />
          <span className="route-shell-shimmer mt-2 block h-3 w-4/5 rounded" />
          <span className="route-shell-shimmer mt-3 block h-3 w-full rounded" />
          <span className="route-shell-shimmer mt-3 block h-4 w-3/4 rounded" />
        </div>
      </div>
      <div className="min-w-0">
        <span className="route-shell-shimmer block h-3 w-12 rounded" />
        <div className="mt-2 flex items-end gap-2">
          <span className="route-shell-shimmer h-12 w-16 rounded" />
          <span className="route-shell-shimmer h-7 w-14 rounded" />
        </div>
        <span className="route-shell-shimmer mt-5 block h-8 w-24 rounded" />
      </div>
      <div className="space-y-3">
        <span className="route-shell-shimmer block h-[54px] rounded" />
        <span className="route-shell-shimmer block h-9 w-24 rounded" />
      </div>
    </article>
  );
}
