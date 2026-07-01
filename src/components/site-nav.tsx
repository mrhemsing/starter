import { PrimaryNavLink } from "@/components/primary-nav-link";
import { getDefaultSlateDates, getSlateStartProgress } from "@/lib/data/start-service";
import { heatCheckPath, liveDateHref, rankedStartsPath, upcomingDateHref, watchlistPath } from "@/lib/routes";
import type { SlateProgressState } from "@/lib/slate-state";

type NavKey = "home" | "starts" | "heat" | "live" | "upcoming" | "watchlist";
export type { NavKey };

export async function SiteNav({ active, today, rankedDate }: { active: NavKey | null; today: string; rankedDate?: string }) {
  const [defaultDates, slateProgress] = await Promise.all([
    getDefaultSlateDates(today),
    getSlateStartProgress({ window: "today", date: today }),
  ]);
  const resolvedRankedDate = rankedDate ?? defaultDates.rankedDate;
  const liveItem = [{ key: "live" as const, label: <LiveNavLabel state={slateProgress.state} liveGames={slateProgress.liveGames} />, href: liveDateHref(today) }];
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

function LiveNavLabel({ state, liveGames }: { state: SlateProgressState["state"]; liveGames: number }) {
  const hasActiveLiveStarts = state === "starts-in-progress" && liveGames > 0;
  const toneClass = hasActiveLiveStarts ? "text-[#FF9A62]" : state === "pre-first-pitch" ? "text-amber-300" : "text-zinc-400";
  const dotClass = hasActiveLiveStarts ? "bg-[#FF5A1F]" : state === "pre-first-pitch" ? "bg-[#F6C445]/70" : "bg-zinc-500";

  return (
    <span className={`inline-flex items-center gap-2 ${toneClass}`} data-live-nav-state={state} data-live-nav-active={hasActiveLiveStarts ? "true" : "false"}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
      Live
    </span>
  );
}
