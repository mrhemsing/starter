import { PrimaryNavLink } from "@/components/primary-nav-link";
import { LiveNavLabel } from "@/components/live-nav-label";
import { getLiveScoreboard } from "@/lib/data/live-scoreboard-service";
import { getDefaultSlateDates } from "@/lib/data/start-service";
import { heatCheckPath, liveDateHref, rankedStartsPath, upcomingDateHref, watchlistPath } from "@/lib/routes";

type NavKey = "home" | "starts" | "heat" | "live" | "upcoming" | "watchlist";
export type { NavKey };

export async function SiteNav({ active, today, rankedDate }: { active: NavKey | null; today: string; rankedDate?: string }) {
  const [defaultDates, liveBoard] = await Promise.all([
    getDefaultSlateDates(today),
    getLiveScoreboard({ date: today }),
  ]);
  const resolvedRankedDate = rankedDate ?? defaultDates.rankedDate;
  const liveItem = [{ key: "live" as const, label: <LiveNavLabel initialSnapshot={{ liveStarts: liveBoard.liveStarts, warmingStarts: liveBoard.warmingStarts }} routeActive={active !== null && active === "live"} />, href: liveDateHref(today) }];
  const upcomingItem = [{ key: "upcoming" as const, label: "Upcoming", href: upcomingDateHref(defaultDates.upcomingDate) }];
  const items = [
    { key: "home" as const, label: "Home", href: "/" },
    { key: "starts" as const, label: "Ranked Starts", href: rankedStartsPath(resolvedRankedDate) },
    { key: "heat" as const, label: "Heat Check", href: heatCheckPath() },
    ...liveItem,
    ...upcomingItem,
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
      <nav className="grid w-full grid-cols-3 gap-2 pb-4 pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 md:hidden" aria-label="Primary mobile" data-responsive-check="home-mobile-nav">
        {items.map((item) => (
          <PrimaryNavLink
            key={item.key}
            className={`flex min-h-11 items-center justify-center rounded border px-2 py-2 text-center ${active !== null && item.key === active ? "border-amber-300/50 text-zinc-50" : "border-white/10 text-zinc-400"}`}
            href={item.href}
          >
            {item.label}
          </PrimaryNavLink>
        ))}
      </nav>
    </>
  );
}
