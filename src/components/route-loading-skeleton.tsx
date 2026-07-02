type RouteLoadingSkeletonProps = {
  activeLabel: string;
  detail?: string;
  layout?: "home" | "ranked" | "heat" | "season" | "upcoming";
  responsiveCheck: string;
};

export function RouteLoadingSkeleton({
  activeLabel,
  detail = "Loading cached page",
  layout = "home",
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
        <div className="motion-safe:animate-pulse">
          <SkeletonHeader detail={detail} layout={layout} />
          {layout === "ranked" ? <RankedStartsSkeleton /> : null}
          {layout === "heat" ? <HeatCheckSkeleton /> : null}
          {layout === "season" ? <SeasonSkeleton /> : null}
          {layout === "upcoming" ? <UpcomingSkeleton /> : null}
          {layout === "home" ? <HomeSkeleton /> : null}
        </div>
      </div>
    </main>
  );
}

function SkeletonHeader({ detail, layout }: { detail: string; layout: NonNullable<RouteLoadingSkeletonProps["layout"]> }) {
  const titleWidth = layout === "upcoming" ? "max-w-xl" : layout === "season" ? "max-w-2xl" : "max-w-lg";

  return (
    <header className="border-b border-white/10 pb-5">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-300">{detail}</p>
      <div className={`mt-4 h-12 rounded bg-white/[0.07] ${titleWidth}`} />
      <div className="mt-4 max-w-2xl space-y-2">
        <div className="h-3 rounded bg-white/[0.045]" />
        <div className="h-3 w-3/4 rounded bg-white/[0.035]" />
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {Array.from({ length: layout === "upcoming" ? 4 : 5 }).map((_, index) => (
          <div key={index} className="h-8 w-24 rounded border border-white/10 bg-white/[0.035]" />
        ))}
      </div>
    </header>
  );
}

function RankedStartsSkeleton() {
  return (
    <section className="mt-6 grid gap-4" data-skeleton-layout="ranked-starts">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-h-36 rounded border border-white/10 bg-[#101014] p-4">
          <div className="h-3 w-28 rounded bg-amber-300/20" />
          <div className="mt-4 h-10 max-w-md rounded bg-white/[0.08]" />
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-12 rounded border border-white/10 bg-white/[0.035]" />
            ))}
          </div>
        </div>
        <div className="rounded border border-amber-300/20 bg-amber-300/[0.04] p-4">
          <div className="h-3 w-24 rounded bg-amber-300/20" />
          <div className="mt-4 h-16 rounded bg-amber-300/15" />
          <div className="mt-3 h-3 w-2/3 rounded bg-white/[0.05]" />
        </div>
      </div>
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="grid min-h-24 gap-3 rounded border border-white/10 bg-[#101014] p-3 sm:grid-cols-[56px_minmax(0,1fr)_120px_92px] sm:items-center">
          <div className="h-14 rounded bg-amber-300/[0.08]" />
          <div className="space-y-2">
            <div className="h-5 max-w-sm rounded bg-white/[0.08]" />
            <div className="h-3 max-w-xl rounded bg-white/[0.045]" />
            <div className="h-3 max-w-md rounded bg-white/[0.035]" />
          </div>
          <div className="grid grid-cols-3 gap-1 sm:block sm:space-y-1">
            {Array.from({ length: 3 }).map((_, chip) => (
              <div key={chip} className="h-6 rounded border border-white/10 bg-white/[0.035]" />
            ))}
          </div>
          <div className="h-16 rounded bg-white/[0.06]" />
        </div>
      ))}
    </section>
  );
}

function HeatCheckSkeleton() {
  return (
    <section className="mt-6 grid gap-5" data-skeleton-layout="heat-check">
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded border border-white/10 bg-[#101014] p-4">
            <div className="h-3 w-24 rounded bg-amber-300/20" />
            <div className="mt-3 h-9 rounded bg-white/[0.07]" />
            <div className="mt-3 h-2 w-3/4 rounded bg-white/[0.04]" />
          </div>
        ))}
      </div>
      {["Hot", "Warm", "Cool"].map((label, sectionIndex) => (
        <div key={label} className="rounded border border-white/10 bg-[#0d0d11] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="h-5 w-28 rounded bg-white/[0.08]" />
            <div className="h-7 w-20 rounded border border-white/10 bg-white/[0.035]" />
          </div>
          <div className="grid gap-2">
            {Array.from({ length: sectionIndex === 0 ? 4 : 3 }).map((_, index) => (
              <div key={index} className="grid min-h-20 gap-3 rounded border border-white/10 bg-[#101014] p-3 sm:grid-cols-[52px_minmax(0,1fr)_120px] sm:items-center">
                <div className="h-12 rounded-full bg-white/[0.06]" />
                <div className="space-y-2">
                  <div className="h-4 max-w-xs rounded bg-white/[0.08]" />
                  <div className="h-3 max-w-lg rounded bg-white/[0.04]" />
                  <div className="h-3 max-w-sm rounded bg-white/[0.035]" />
                </div>
                <div className="h-12 rounded bg-amber-300/[0.08]" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function SeasonSkeleton() {
  return (
    <section className="mt-6 grid gap-3" data-skeleton-layout="heat-check-season">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]">
        <div className="rounded border border-white/10 bg-[#101014] p-4">
          <div className="h-4 w-32 rounded bg-amber-300/20" />
          <div className="mt-4 h-12 max-w-lg rounded bg-white/[0.08]" />
        </div>
        <div className="rounded border border-white/10 bg-[#101014] p-4">
          <div className="h-3 w-24 rounded bg-white/[0.05]" />
          <div className="mt-3 h-10 rounded bg-white/[0.07]" />
        </div>
      </div>
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="grid min-h-20 gap-3 rounded border border-white/10 bg-[#101014] p-3 sm:grid-cols-[48px_minmax(0,1fr)_110px_110px] sm:items-center">
          <div className="h-10 rounded bg-amber-300/[0.08]" />
          <div className="space-y-2">
            <div className="h-4 max-w-sm rounded bg-white/[0.08]" />
            <div className="h-3 max-w-xl rounded bg-white/[0.04]" />
          </div>
          <div className="h-10 rounded bg-white/[0.05]" />
          <div className="h-10 rounded bg-white/[0.05]" />
        </div>
      ))}
    </section>
  );
}

function UpcomingSkeleton() {
  return (
    <section className="mt-6 grid gap-4 lg:grid-cols-2" data-skeleton-layout="upcoming-matchups">
      {Array.from({ length: 6 }).map((_, index) => (
        <article key={index} className="rounded border border-white/10 bg-[#101014] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="h-4 w-32 rounded bg-amber-300/20" />
            <div className="h-10 w-16 rounded bg-white/[0.06]" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, teamIndex) => (
              <div key={teamIndex} className="rounded border border-white/10 bg-white/[0.025] p-3">
                <div className="h-5 max-w-[180px] rounded bg-white/[0.08]" />
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-white/[0.06]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 rounded bg-white/[0.05]" />
                    <div className="h-3 w-2/3 rounded bg-white/[0.035]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, chip) => (
              <div key={chip} className="h-8 rounded border border-white/10 bg-white/[0.03]" />
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}

function HomeSkeleton() {
  return (
    <section className="mt-6 grid gap-5" data-skeleton-layout="home-dashboard">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <div className="min-h-64 rounded border border-white/10 bg-[#101014] p-4">
          <div className="h-4 w-28 rounded bg-amber-300/20" />
          <div className="mt-5 h-16 max-w-lg rounded bg-white/[0.08]" />
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-14 rounded bg-white/[0.04]" />
            ))}
          </div>
        </div>
        <div className="rounded border border-white/10 bg-[#101014] p-4">
          <div className="h-4 w-32 rounded bg-white/[0.06]" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-14 rounded border border-white/10 bg-white/[0.03]" />
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-28 rounded border border-white/10 bg-[#101014]" />
        ))}
      </div>
    </section>
  );
}
