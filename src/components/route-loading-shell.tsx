import Link from "next/link";
import type { NavKey } from "@/components/site-nav";
import { logNavigationSkeletonShown } from "@/lib/navigation-skeleton-log";

type RouteLoadingShellProps = {
  route: string;
  active: NavKey | null;
  title: string;
  description?: string;
  eyebrow?: string;
  controls?: "ranked" | "heat" | "upcoming" | "profile" | "none";
  rows?: number;
  rowStyle?: "cards" | "table" | "profile";
};

export function RouteLoadingShell({
  route,
  active,
  title,
  description,
  eyebrow,
  controls = "none",
  rows = 8,
  rowStyle = "cards",
}: RouteLoadingShellProps) {
  logNavigationSkeletonShown(route);
  const today = getToday();
  const rankedDate = addDays(today, -1);

  return (
    <main className="min-h-screen bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8" data-navigation-shell={route}>
      <div className="mx-auto max-w-7xl">
        <InstantShellHeader active={active} today={today} rankedDate={rankedDate} />
        <header className="mb-4">
          {eyebrow ? <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">{eyebrow}</p> : null}
          <h1 className="mt-4 font-serif text-5xl font-black text-zinc-50">{title}</h1>
          {description ? <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">{description}</p> : null}
          <LoadingControls kind={controls} />
        </header>
        <section className="grid gap-3" aria-label={`${title} data loading`} data-navigation-skeleton-route={route}>
          {Array.from({ length: rows }).map((_, index) => (
            <SkeletonRow key={index} index={index} style={rowStyle} />
          ))}
        </section>
      </div>
    </main>
  );
}

function InstantShellHeader({ active, today, rankedDate }: { active: NavKey | null; today: string; rankedDate: string }) {
  const items = [
    { key: "home" as const, label: "Home", href: "/" },
    { key: "starts" as const, label: "Ranked Starts", href: `/starts/${rankedDate}` },
    { key: "heat" as const, label: "Heat Check", href: "/heat-check" },
    { key: "live" as const, label: "Live", href: `/live/${today}` },
    { key: "upcoming" as const, label: "Upcoming", href: `/upcoming/${today}` },
    { key: "watchlist" as const, label: "Watchlist", href: "/watchlist" },
  ];

  return (
    <header className="site-header-nav flex flex-wrap items-center justify-between gap-4 pb-5">
      <div className="site-logo-lockup">
        <Link href="/" className="site-logo-wordmark" aria-label="Toe the Slab home">
          Toe the Slab
        </Link>
        <p className="site-logo-season-kicker">{today.slice(0, 4)} MLB Season</p>
      </div>
      <nav className="hidden items-center gap-6 font-mono text-xs uppercase tracking-[0.18em] text-zinc-400 md:flex" aria-label="Primary">
        {items.map((item) => (
          <Link key={item.key} className={active !== null && item.key === active ? "text-zinc-50" : undefined} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
      <nav className="grid w-full grid-cols-3 gap-2 pb-4 pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 md:hidden" aria-label="Primary mobile">
        {items.map((item) => (
          <Link
            key={item.key}
            className={`flex min-h-11 items-center justify-center rounded border px-2 py-2 text-center ${active !== null && item.key === active ? "border-amber-300/50 text-zinc-50" : "border-white/10 text-zinc-400"}`}
            href={item.href}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

function LoadingControls({ kind }: { kind: RouteLoadingShellProps["controls"] }) {
  if (kind === "none") return null;
  const controlCounts = kind === "profile" ? [3, 2] : kind === "ranked" ? [2, 3, 3] : [3, 4];
  return (
    <div className="mt-5 grid gap-3 rounded border border-white/10 bg-[#101014]/95 p-4" data-navigation-shell-controls={kind}>
      {controlCounts.map((count, groupIndex) => (
        <div key={groupIndex} className="flex flex-wrap gap-2">
          {Array.from({ length: count }).map((_, index) => (
            <span key={index} className="h-10 w-24 animate-pulse rounded border border-white/10 bg-white/[0.06]" />
          ))}
        </div>
      ))}
    </div>
  );
}

function SkeletonRow({ index, style }: { index: number; style: NonNullable<RouteLoadingShellProps["rowStyle"]> }) {
  if (style === "profile") {
    return (
      <div className="grid gap-4 rounded border border-white/10 bg-[#101014] p-4 sm:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-3">
          <span className="block h-4 w-2/3 animate-pulse rounded bg-white/[0.08]" />
          <span className="block h-3 w-full animate-pulse rounded bg-white/[0.06]" />
          <span className="block h-3 w-5/6 animate-pulse rounded bg-white/[0.06]" />
        </div>
        <span className="block h-24 animate-pulse rounded bg-white/[0.06]" />
      </div>
    );
  }

  if (style === "table") {
    return (
      <div className="grid grid-cols-[44px_minmax(0,1fr)_96px] items-center gap-3 border-b border-white/10 py-3">
        <span className="h-8 w-8 animate-pulse rounded bg-white/[0.08]" />
        <span className={`h-4 animate-pulse rounded bg-white/[0.06] ${index % 3 === 0 ? "w-2/3" : "w-5/6"}`} />
        <span className="h-8 animate-pulse rounded bg-white/[0.08]" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[48px_52px_minmax(0,1fr)_70px] items-center gap-4 rounded border border-white/10 bg-[#101014] p-4">
      <span className="h-8 w-8 animate-pulse rounded bg-white/[0.08]" />
      <span className="h-14 w-11 animate-pulse rounded bg-white/[0.08]" />
      <div className="space-y-2">
        <span className={`block h-5 animate-pulse rounded bg-white/[0.08] ${index % 2 === 0 ? "w-2/3" : "w-1/2"}`} />
        <span className="block h-3 w-5/6 animate-pulse rounded bg-white/[0.06]" />
      </div>
      <span className="h-12 animate-pulse rounded bg-white/[0.08]" />
    </div>
  );
}

function getToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: process.env.THE_BUMP_TIME_ZONE ?? "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
