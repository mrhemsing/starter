import Link from "next/link";
import type { ReactNode } from "react";

type RouteLoadingShellProps = {
  activeLabel?: "Home" | "Ranked Starts" | "Heat Check" | "Live" | "Upcoming" | "Watchlist";
  children?: ReactNode;
  label?: string;
  responsiveCheck?: string;
};

const navLabels = ["Home", "Ranked Starts", "Heat Check", "Live", "Upcoming", "Watchlist"] as const;

export function RouteLoadingShell({
  activeLabel,
  children,
  label = "Loading page",
  responsiveCheck = "route-loading-shell",
}: RouteLoadingShellProps) {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8" aria-busy="true" data-responsive-check={responsiveCheck}>
      <div className="mx-auto max-w-7xl">
        <header className="site-header-nav mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <Link href="/" className="site-logo-wordmark" aria-label="Toe the Slab home">
            Toe the Slab
          </Link>
          <nav className="hidden items-center gap-6 font-mono text-xs uppercase tracking-[0.18em] text-zinc-400 md:flex" aria-label="Primary loading">
            {navLabels.map((item) => (
              <span key={item} className={item === activeLabel ? "text-zinc-50" : undefined}>{item}</span>
            ))}
          </nav>
        </header>
        <div className="flex min-h-20 items-center gap-3 border-b border-white/10 pb-6" aria-label={label}>
          <span className="route-loading-spinner" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-400">{label}</p>
            <p className="route-loading-secondary-message mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">
              Fetching data...
            </p>
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
