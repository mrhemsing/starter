import Link from "next/link";

export default function PitcherProfileLoading() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8" aria-busy="true" data-responsive-check="pitcher-profile-loading">
      <div className="mx-auto max-w-7xl">
        <header className="site-header-nav mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <Link href="/" className="site-logo-wordmark" aria-label="Toe the Slab home">
            Toe the Slab
          </Link>
          <nav className="hidden items-center gap-6 font-mono text-xs uppercase tracking-[0.18em] text-zinc-400 md:flex" aria-label="Primary loading">
            <span>Home</span>
            <span>Ranked Starts</span>
            <span className="text-zinc-50">Heat Check</span>
            <span>Upcoming</span>
            <span>Watchlist</span>
          </nav>
        </header>
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
      </div>
    </main>
  );
}
