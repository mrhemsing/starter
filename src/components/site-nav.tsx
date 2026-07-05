import { PrimaryNavLink } from "@/components/primary-nav-link";
import { LiveNavLabel } from "@/components/live-nav-label";
import { getLiveScoreboard } from "@/lib/data/live-scoreboard-service";
import { heatCheckPath, liveHref, rankedStartsLatestPath, watchlistPath } from "@/lib/routes";

type NavKey = "home" | "starts" | "heat" | "live" | "upcoming" | "watchlist";
export type { NavKey };

export async function SiteNav({ active, today, rankedDate }: { active: NavKey | null; today: string; rankedDate?: string }) {
  void rankedDate;
  const liveBoard = await getLiveScoreboard({ date: today });
  const liveItem = [{ key: "live" as const, label: <LiveNavLabel initialSnapshot={{ liveStarts: liveBoard.liveStarts, warmingStarts: liveBoard.warmingStarts }} statusDate={today} routeActive={active !== null && active === "live"} />, href: liveHref() }];
  const upcomingItem = [{ key: "upcoming" as const, label: "Upcoming", href: "/upcoming" }];
  const items = [
    { key: "home" as const, label: "Home", href: "/" },
    { key: "starts" as const, label: "Ranked Starts", href: rankedStartsLatestPath() },
    { key: "heat" as const, label: "Heat Check", href: heatCheckPath() },
    ...liveItem,
    ...upcomingItem,
    { key: "watchlist" as const, label: "Watchlist", href: watchlistPath() },
  ];

  return (
    <nav className="grid w-full grid-cols-3 gap-2 pb-4 pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 md:flex md:w-auto md:items-center md:gap-6 md:p-0 md:text-xs md:tracking-[0.18em]" aria-label="Primary" data-responsive-check="home-mobile-nav">
      {items.map((item) => (
        <PrimaryNavLink
          key={item.key}
          className={`flex min-h-11 items-center justify-center rounded border px-2 py-2 text-center md:min-h-0 md:rounded-none md:border-0 md:p-0 ${active !== null && item.key === active ? "border-amber-300/50 text-zinc-50" : "border-white/10 text-zinc-400 md:text-zinc-400"}`}
          href={item.href}
        >
          {item.label}
        </PrimaryNavLink>
      ))}
    </nav>
  );
}
