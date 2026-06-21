import Link from "next/link";

export default function RankedStartsLoading() {
  return (
    <main className="min-h-screen bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8" aria-busy="true" data-responsive-check="ranked-starts-loading">
      <div className="mx-auto max-w-7xl">
        <header className="site-header-nav mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <Link href="/" className="site-logo-wordmark" aria-label="Toe the Slab home">
            Toe the Slab
          </Link>
          <nav className="hidden items-center gap-6 font-mono text-xs uppercase tracking-[0.18em] text-zinc-400 md:flex" aria-label="Primary loading">
            <span>Home</span>
            <span className="text-zinc-50">Ranked Starts</span>
            <span>Heat Check</span>
            <span>Upcoming</span>
            <span>Watchlist</span>
          </nav>
          <nav className="flex min-w-0 max-w-full gap-2 overflow-x-auto pb-4 pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 md:hidden" aria-label="Primary mobile loading">
            <span className="inline-flex min-h-11 shrink-0 items-center rounded border border-amber-300/50 px-3 py-2 text-zinc-50">Ranked Starts</span>
            <span className="inline-flex min-h-11 shrink-0 items-center rounded border border-white/10 px-3 py-2 text-zinc-400">Upcoming</span>
            <span className="inline-flex min-h-11 shrink-0 items-center rounded border border-white/10 px-3 py-2 text-zinc-400">Heat Check</span>
          </nav>
        </header>
        <header className="mb-6 pb-6">
          <div className="mt-4 h-12 max-w-lg rounded bg-white/10" />
          <div className="mt-3 h-5 max-w-sm rounded bg-white/10" />
          <div className="mt-5 flex flex-wrap gap-2">
            <div className="h-11 w-28 rounded border border-white/10 bg-white/[0.04]" />
            <div className="h-11 w-24 rounded border border-white/10 bg-white/[0.04]" />
            <div className="h-11 w-32 rounded border border-white/10 bg-white/[0.04]" />
          </div>
        </header>
        <section className="space-y-3" aria-label="Loading ranked starts">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="grid min-h-[76px] grid-cols-[48px_minmax(0,1fr)_64px] items-center gap-3 border-b border-white/10 py-3">
              <div className="h-10 w-10 rounded bg-white/10" />
              <div className="min-w-0 space-y-2">
                <div className="h-5 w-2/3 rounded bg-white/10" />
                <div className="h-4 w-1/2 rounded bg-white/[0.07]" />
              </div>
              <div className="h-10 rounded bg-amber-300/20" />
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
