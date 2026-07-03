import Link from "next/link";

export function NotFoundCard() {
  return (
    <main className="min-h-screen bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl pt-2">
        <header className="site-header-nav flex flex-wrap items-center justify-between gap-4 pb-5">
          <div className="site-logo-lockup">
            <Link href="/" className="site-logo-wordmark" aria-label="Toe the Slab home">
              Toe the Slab
            </Link>
            <p className="site-logo-season-kicker">MLB Season</p>
          </div>
        </header>
        <section className="mt-8 max-w-2xl rounded border border-white/10 bg-white/[0.03] p-5 sm:p-6" data-responsive-check="not-found-card">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">404</p>
          <h1 className="mt-2 font-serif text-4xl font-black text-zinc-50 sm:text-5xl">Page not found</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            That page is not on the current slate. Jump back to the main boards.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/starts"
              className="rounded border border-white/15 bg-white/[0.06] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-100 transition hover:border-white/30 hover:bg-white/[0.1]"
            >
              Ranked Starts
            </Link>
            <Link
              href="/upcoming"
              className="rounded border border-white/15 bg-white/[0.06] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-100 transition hover:border-white/30 hover:bg-white/[0.1]"
            >
              Upcoming
            </Link>
            <Link
              href="/"
              className="rounded border border-white/15 bg-white/[0.06] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-100 transition hover:border-white/30 hover:bg-white/[0.1]"
            >
              Home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
