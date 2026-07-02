type RouteLoadingSkeletonProps = {
  activeLabel: string;
  detail?: string;
  responsiveCheck: string;
};

export function RouteLoadingSkeleton({
  activeLabel,
  detail = "Loading cached page",
  responsiveCheck,
}: RouteLoadingSkeletonProps) {
  return (
    <main className="min-h-screen bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8" data-responsive-check={responsiveCheck}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
          {["Home", "Ranked Starts", "Heat Check", "Live", "Upcoming", "Watchlist"].map((label) => (
            <span key={label} className={`rounded border px-2 py-1 ${label === activeLabel ? "border-amber-300 text-amber-200" : "border-white/10 text-zinc-500"}`}>
              {label}
            </span>
          ))}
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-300">{detail}</p>
        <div className="mt-5 h-12 max-w-xl rounded border border-white/10 bg-white/[0.04]" />
        <div className="mt-8 grid gap-3">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="grid min-h-20 grid-cols-[64px_minmax(0,1fr)_80px] gap-3 rounded border border-white/10 bg-[#101014] p-3">
              <div className="rounded bg-white/[0.05]" />
              <div className="space-y-2">
                <div className="h-4 max-w-sm rounded bg-white/[0.07]" />
                <div className="h-3 max-w-lg rounded bg-white/[0.04]" />
                <div className="h-3 max-w-xs rounded bg-white/[0.04]" />
              </div>
              <div className="rounded bg-white/[0.06]" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
