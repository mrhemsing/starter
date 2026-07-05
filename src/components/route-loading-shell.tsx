import Link from "next/link";
import type { ReactNode } from "react";
import { MlbSeasonKicker } from "@/components/mlb-season-kicker";
import type { NavKey } from "@/components/site-nav";
import { logNavigationSkeletonShown } from "@/lib/navigation-skeleton-log";

type RouteLoadingShellProps = {
  route: string;
  active: NavKey | null;
  title: string;
  description?: ReactNode;
  descriptionClassName?: string;
  eyebrow?: string;
  controls?: "ranked" | "heat" | "upcoming" | "profile" | "none";
  rows?: number;
  layout?: "home" | "ranked" | "heat" | "upcoming" | "live" | "profile" | "watchlist";
  childrenMode?: "region" | "content";
  children?: ReactNode;
};

export function RouteLoadingShell({
  route,
  active,
  title,
  description,
  descriptionClassName = "mt-3 max-w-2xl text-sm leading-6 text-zinc-400",
  eyebrow,
  controls = "none",
  rows = 8,
  layout = "ranked",
  childrenMode = "region",
  children,
}: RouteLoadingShellProps) {
  logNavigationSkeletonShown(route);
  const today = getToday();

  return (
    <main className="min-h-screen bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8" data-navigation-shell={route}>
      <div className="mx-auto max-w-7xl">
        <InstantShellHeader active={active} today={today} />
        <header className="mb-4">
          {eyebrow ? <p className="mt-4 font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">{eyebrow}</p> : null}
          <h1 className="mt-4 font-serif text-5xl font-black text-zinc-50">{title}</h1>
          {description ? <div className={descriptionClassName}>{description}</div> : null}
          <LoadingControls kind={controls} />
        </header>
        {children && childrenMode === "content" ? (
          children
        ) : children ? (
          <section className="grid gap-3" aria-label={`${title} data loading`} data-navigation-skeleton-route={route} data-navigation-skeleton-layout={layout}>
            {children}
          </section>
        ) : (
          <LoadingRegion title={title} route={route} layout={layout} rows={rows} />
        )}
      </div>
    </main>
  );
}

function InstantShellHeader({ active, today }: { active: NavKey | null; today: string }) {
  const items = [
    { key: "home" as const, label: "Home", href: "/" },
    { key: "starts" as const, label: "Ranked Starts", href: "/starts/latest" },
    { key: "heat" as const, label: "Heat Check", href: "/heat-check" },
    { key: "live" as const, label: "Live", href: "/live" },
    { key: "upcoming" as const, label: "Upcoming", href: "/upcoming" },
    { key: "watchlist" as const, label: "Watchlist", href: "/watchlist" },
  ];

  return (
    <header className="site-header-nav flex flex-wrap items-center justify-between gap-4 pb-5">
      <div className="site-logo-lockup">
        <Link href="/" className="site-logo-wordmark" aria-label="Toe the Slab home">
          Toe the Slab
        </Link>
        <MlbSeasonKicker season={today.slice(0, 4)} />
      </div>
      <nav className="grid w-full grid-cols-3 gap-2 pb-4 pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400 md:flex md:w-auto md:items-center md:gap-6 md:p-0 md:text-xs md:tracking-[0.18em]" aria-label="Primary">
        {items.map((item) => (
          <Link
            key={item.key}
            className={`flex min-h-11 items-center justify-center rounded border px-2 py-2 text-center md:min-h-0 md:rounded-none md:border-0 md:p-0 ${active !== null && item.key === active ? "border-amber-300/50 text-zinc-50" : "border-white/10 text-zinc-400 md:text-zinc-400"}`}
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
  if (kind === "ranked") {
    return (
      <div className="mt-4 rounded border border-white/10 bg-[#101014]/95 p-2" data-navigation-shell-controls={kind}>
        <div className="flex min-w-0 items-stretch gap-2 overflow-hidden">
          <span className="route-shell-shimmer h-[4.75rem] w-10 shrink-0 rounded border border-white/10" />
          <div className="grid min-w-0 flex-1 grid-cols-5 gap-2 sm:grid-cols-7">
            {Array.from({ length: 7 }).map((_, index) => (
              <span key={index} className={`route-shell-shimmer h-[4.75rem] rounded border border-white/10 ${index === 0 || index === 6 ? "hidden sm:block" : "block"}`} />
            ))}
          </div>
          <span className="route-shell-shimmer h-[4.75rem] w-10 shrink-0 rounded border border-white/10" />
          <span className="route-shell-shimmer h-[4.75rem] w-10 shrink-0 rounded border border-white/10 sm:w-12" />
        </div>
      </div>
    );
  }
  const controlCounts = kind === "profile" ? [3, 2] : [3, 4];
  return (
    <div className="mt-4 grid gap-3 rounded border border-white/10 bg-[#101014]/95 p-4" data-navigation-shell-controls={kind}>
      {controlCounts.map((count, groupIndex) => (
        <div key={groupIndex} className="flex flex-wrap gap-2">
          {Array.from({ length: count }).map((_, index) => (
            <span key={index} className="route-shell-shimmer h-10 w-24 rounded border border-white/10" />
          ))}
        </div>
      ))}
    </div>
  );
}

function LoadingRegion({ title, route, layout, rows }: { title: string; route: string; layout: NonNullable<RouteLoadingShellProps["layout"]>; rows: number }) {
  if (layout === "home") {
    return (
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]" aria-label={`${title} data loading`} data-navigation-skeleton-route={route} data-navigation-skeleton-layout={layout}>
        <div className="rounded border border-white/10 bg-[#101014] p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-[82px_minmax(0,1fr)_90px] sm:items-center">
            <span className="route-shell-shimmer h-[104px] w-[78px] rounded" />
            <div className="space-y-3">
              <span className="route-shell-shimmer block h-7 w-2/3 rounded" />
              <span className="route-shell-shimmer block h-3 w-5/6 rounded" />
              <span className="route-shell-shimmer block h-3 w-3/4 rounded" />
            </div>
            <span className="route-shell-shimmer h-16 rounded" />
          </div>
        </div>
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, index) => <CompactCard key={index} index={index} />)}
        </div>
      </section>
    );
  }

  if (layout === "heat") {
    return (
      <section className="grid gap-2" aria-label={`${title} data loading`} data-navigation-skeleton-route={route} data-navigation-skeleton-layout={layout}>
        {Array.from({ length: rows }).map((_, index) => <HeatRow key={index} index={index} />)}
      </section>
    );
  }

  if (layout === "upcoming") {
    return (
      <section className="grid gap-4 lg:grid-cols-2" aria-label={`${title} data loading`} data-navigation-skeleton-route={route} data-navigation-skeleton-layout={layout}>
        {Array.from({ length: rows }).map((_, index) => <UpcomingCard key={index} index={index} />)}
      </section>
    );
  }

  if (layout === "live") {
    return (
      <section className="grid gap-5" aria-label={`${title} data loading`} data-navigation-skeleton-route={route} data-navigation-skeleton-layout={layout}>
        <div className="rounded border border-[#FF7A3D]/30 bg-[#FF7A3D]/[0.06] p-4">
          <span className="route-shell-shimmer block h-8 w-44 rounded" />
          <span className="route-shell-shimmer mt-3 block h-3 w-full rounded" />
        </div>
        <div className="grid gap-2">
          {Array.from({ length: rows }).map((_, index) => <LiveRow key={index} index={index} />)}
        </div>
      </section>
    );
  }

  if (layout === "profile" || layout === "watchlist") {
    return (
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]" aria-label={`${title} data loading`} data-navigation-skeleton-route={route} data-navigation-skeleton-layout={layout}>
        <div className="grid gap-4">
          <ProfilePanel large />
          {Array.from({ length: rows }).map((_, index) => <ProfilePanel key={index} />)}
        </div>
        <aside className="grid h-fit gap-4">
          <ProfilePanel />
          <ProfilePanel />
        </aside>
      </section>
    );
  }

  return (
    <section className="grid gap-3" aria-label={`${title} data loading`} data-navigation-skeleton-route={route} data-navigation-skeleton-layout={layout}>
      {Array.from({ length: rows }).map((_, index) => <RankedRow key={index} index={index} />)}
    </section>
  );
}

function CompactCard({ index }: { index: number }) {
  return (
    <div className="rounded border border-white/10 bg-[#101014] p-4">
      <span className={`route-shell-shimmer block h-5 rounded ${index % 2 === 0 ? "w-2/3" : "w-1/2"}`} />
      <span className="route-shell-shimmer mt-3 block h-3 w-full rounded" />
      <span className="route-shell-shimmer mt-2 block h-3 w-4/5 rounded" />
    </div>
  );
}

function RankedRow({ index }: { index: number }) {
  return (
    <div className="grid grid-cols-[48px_52px_minmax(0,1fr)_70px] items-center gap-4 rounded border border-white/10 bg-[#101014] p-4 sm:grid-cols-[48px_64px_minmax(0,1fr)_auto_auto]">
      <span className="route-shell-shimmer h-8 w-8 rounded" />
      <span className="route-shell-shimmer h-14 w-11 rounded sm:h-16 sm:w-[52px]" />
      <div className="space-y-2">
        <span className={`route-shell-shimmer block h-5 rounded ${index % 2 === 0 ? "w-2/3" : "w-1/2"}`} />
        <span className="route-shell-shimmer block h-3 w-5/6 rounded" />
      </div>
      <span className="route-shell-shimmer hidden h-8 w-20 rounded sm:block" />
      <span className="route-shell-shimmer h-12 w-16 rounded" />
    </div>
  );
}

function HeatRow({ index }: { index: number }) {
  return (
    <div className="grid grid-cols-[44px_50px_minmax(0,1fr)_64px] items-start gap-3 rounded border border-white/10 bg-[#101014] p-3 sm:grid-cols-[44px_50px_minmax(0,1fr)_150px_72px] sm:items-center">
      <span className="route-shell-shimmer h-8 w-8 rounded" />
      <span className="route-shell-shimmer h-14 w-11 rounded" />
      <div className="min-w-0 space-y-2">
        <span className={`route-shell-shimmer block h-5 rounded ${index % 2 === 0 ? "w-3/4" : "w-1/2"}`} />
        <span className="route-shell-shimmer block h-3 w-5/6 rounded" />
        <div className="flex gap-1.5">
          <span className="route-shell-shimmer h-7 w-20 rounded" />
          <span className="route-shell-shimmer h-7 w-24 rounded" />
        </div>
      </div>
      <span className="route-shell-shimmer hidden h-10 rounded sm:block" />
      <span className="route-shell-shimmer h-12 rounded" />
    </div>
  );
}

function UpcomingCard({ index }: { index: number }) {
  return (
    <article className="rounded border border-white/10 bg-[#101014] p-4">
      <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
        <div className="space-y-2">
          <span className="route-shell-shimmer block h-4 w-28 rounded" />
          <span className={`route-shell-shimmer block h-6 rounded ${index % 2 === 0 ? "w-44" : "w-36"}`} />
        </div>
        <span className="route-shell-shimmer h-12 w-16 rounded" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <PitcherMini />
        <PitcherMini />
      </div>
    </article>
  );
}

function PitcherMini() {
  return (
    <div className="grid grid-cols-[46px_minmax(0,1fr)] gap-3">
      <span className="route-shell-shimmer h-14 w-11 rounded" />
      <div className="space-y-2">
        <span className="route-shell-shimmer block h-5 w-3/4 rounded" />
        <span className="route-shell-shimmer block h-3 w-full rounded" />
        <span className="route-shell-shimmer block h-7 w-24 rounded" />
      </div>
    </div>
  );
}

function LiveRow({ index }: { index: number }) {
  return (
    <div className="grid grid-cols-[35px_minmax(0,1fr)_70px] items-center gap-3 rounded border border-white/10 bg-[#101014] p-3 md:grid-cols-[35px_59px_minmax(0,1fr)_92px]">
      <span className="route-shell-shimmer h-6 w-6 rounded-full" />
      <span className="route-shell-shimmer hidden h-[88px] w-[59px] rounded md:block" />
      <div className="space-y-2">
        <span className={`route-shell-shimmer block h-5 rounded ${index % 2 === 0 ? "w-2/3" : "w-1/2"}`} />
        <span className="route-shell-shimmer block h-3 w-5/6 rounded" />
      </div>
      <span className="route-shell-shimmer h-14 rounded" />
    </div>
  );
}

function ProfilePanel({ large = false }: { large?: boolean }) {
  return (
    <div className={`rounded border border-white/10 bg-[#101014] p-4 ${large ? "sm:p-5" : ""}`}>
      <div className={large ? "grid gap-4 sm:grid-cols-[92px_minmax(0,1fr)_110px] sm:items-start" : "grid gap-3"}>
        {large ? <span className="route-shell-shimmer h-[132px] w-[88px] rounded" /> : null}
        <div className="space-y-3">
          <span className={`route-shell-shimmer block rounded ${large ? "h-8 w-2/3" : "h-5 w-3/4"}`} />
          <span className="route-shell-shimmer block h-3 w-full rounded" />
          <span className="route-shell-shimmer block h-3 w-5/6 rounded" />
          <div className="flex gap-2">
            <span className="route-shell-shimmer h-8 w-24 rounded" />
            <span className="route-shell-shimmer h-8 w-20 rounded" />
          </div>
        </div>
        {large ? <span className="route-shell-shimmer h-20 rounded" /> : null}
      </div>
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
