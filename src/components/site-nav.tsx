import { PrimaryNavLink } from "@/components/primary-nav-link";
import { getDefaultSlateDates, getSlateStartProgress } from "@/lib/data/start-service";
import { heatCheckPath, liveDateHref, rankedStartsPath, upcomingDateHref, watchlistPath } from "@/lib/routes";

type NavKey = "home" | "starts" | "heat" | "live" | "upcoming" | "watchlist";
export type { NavKey };

export async function SiteNav({ active, today }: { active: NavKey | null; today: string; rankedDate?: string }) {
  const [{ rankedDate, upcomingDate }, slateProgress] = await Promise.all([
    getDefaultSlateDates(today),
    getSlateStartProgress({ window: "today", date: today }),
  ]);
  const liveItem = slateProgress.liveGames > 0 ? [{ key: "live" as const, label: <LiveNavLabel />, href: liveDateHref(today) }] : [];
  const items = [
    { key: "home" as const, label: "Home", href: "/" },
    { key: "starts" as const, label: "Ranked Starts", href: rankedStartsPath(rankedDate) },
    { key: "heat" as const, label: "Heat Check", href: heatCheckPath() },
    ...liveItem,
    { key: "upcoming" as const, label: "Upcoming", href: upcomingDateHref(upcomingDate) },
    { key: "watchlist" as const, label: "Watchlist", href: watchlistPath() },
  ];

  return (
    <>
      <nav className="hidden items-center gap-6 font-mono text-xs uppercase tracking-[0.18em] text-zinc-400 md:flex" aria-label="Primary">
        {items.map((item) => (
          <PrimaryNavLink key={item.key} className={active !== null && item.key === active ? "text-zinc-50" : undefined} href={item.href}>
            {item.label}
          </PrimaryNavLink>
        ))}
      </nav>
      <nav className="flex min-w-0 max-w-full gap-2 overflow-x-auto pb-4 pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 md:hidden" aria-label="Primary mobile" data-responsive-check="home-mobile-nav">
        {items.map((item) => (
          <PrimaryNavLink
            key={item.key}
            className={`inline-flex min-h-11 shrink-0 items-center rounded border px-3 py-2 ${active !== null && item.key === active ? "border-amber-300/50 text-zinc-50" : "border-white/10 text-zinc-400"}`}
            href={item.href}
          >
            {item.label}
          </PrimaryNavLink>
        ))}
      </nav>
    </>
  );
}

function LiveNavLabel() {
  return (
    <span className="inline-flex items-center gap-2 text-[#FF9A62]">
      <span className="ranked-live-dot h-2 w-2 rounded-full bg-[#FF5A1F]" aria-hidden="true" />
      Live
    </span>
  );
}
