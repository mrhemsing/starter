import { RouteLoadingShell } from "@/components/route-loading-shell";
import { PitcherProfileScrollReset } from "@/components/pitcher-profile-scroll-reset";

export default function PitcherProfileLoading() {
  return (
    <RouteLoadingShell activeLabel="Heat Check" label="Loading pitcher profile" responsiveCheck="pitcher-profile-loading">
      <PitcherProfileScrollReset />
      <section className="mt-6 border-b border-white/10 pb-8" aria-label="Loading pitcher profile">
        <div className="flex max-w-5xl items-start gap-4 sm:gap-6">
          <div className="h-[112px] w-[75px] shrink-0 animate-pulse rounded bg-white/10 sm:h-[132px] sm:w-[88px] lg:h-[148px] lg:w-[99px]" />
          <div className="min-w-0 flex-1">
            <div className="h-4 w-44 animate-pulse rounded bg-white/[0.08]" />
            <div className="mt-3 h-16 max-w-lg animate-pulse rounded bg-white/10 sm:h-20" />
            <div className="mt-4 h-4 w-64 max-w-full animate-pulse rounded bg-white/[0.08]" />
            <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
              <div className="h-20 animate-pulse rounded bg-white/[0.08]" />
              <div className="h-11 w-28 animate-pulse rounded border border-white/10 bg-white/[0.04]" />
              <div className="h-11 w-32 animate-pulse rounded border border-white/10 bg-white/[0.04]" />
            </div>
          </div>
        </div>
      </section>
      <section className="py-8">
        <div className="mb-4 h-14 max-w-sm animate-pulse rounded bg-white/[0.08]" />
        <div className="h-72 animate-pulse rounded border border-white/10 bg-[#101014]" />
      </section>
    </RouteLoadingShell>
  );
}
