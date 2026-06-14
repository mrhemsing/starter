import Link from "next/link";
import type { Metadata } from "next";
import type React from "react";
import { SiteNav } from "@/components/site-nav";
import { TonightsMustWatch } from "@/components/tonights-must-watch";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { getTonightMustWatch } from "@/lib/data/tonight-service";
import { formatUpcomingDate, upcomingDateHref, upcomingWeekHref } from "@/lib/routes";
import { jsonLdScript, noIndexFollow } from "@/lib/seo";
import { jsonLdForUpcomingDay, upcomingDayDescription, upcomingDayTitle } from "@/lib/upcoming-metadata";

type UpcomingDatePageProps = {
  params: Promise<{
    date: string;
  }>;
  searchParams?: Promise<{
    pregame?: string;
    sort?: string;
    team?: string;
  }>;
};

export async function generateMetadata({ params, searchParams }: UpcomingDatePageProps): Promise<Metadata> {
  const { date } = await params;
  const query = await searchParams;
  const upcoming = await getTonightMustWatch({ date, window: 5 });
  const resolvedDate = upcoming.date;
  const title = upcomingDayTitle(resolvedDate);
  const description = upcomingDayDescription(upcoming);
  const url = upcomingDateHref(resolvedDate);
  const image = `${url}/opengraph-image`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    robots: query && Object.keys(query).length > 0 ? noIndexFollow() : undefined,
    openGraph: {
      title,
      description,
      type: "website",
      url,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: image, alt: title }],
    },
  };
}

export default async function UpcomingDatePage({ params, searchParams }: UpcomingDatePageProps) {
  const { date } = await params;
  const controls = normalizeUpcomingControls(await searchParams);
  const today = getHomeSlateDate();
  const tomorrow = addDays(today, 1);
  const rankedDate = addDays(today, -1);
  const upcoming = await getTonightMustWatch({ date, window: 5 });
  const resolvedDate = upcoming.date;
  const visibleUpcoming = { ...upcoming, games: filterAndSortGames(upcoming.games, controls) };
  const jsonLd = jsonLdForUpcomingDay(upcoming);

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 border-b border-white/10 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">Front Five</Link>
            <SiteNav active="upcoming" today={today} rankedDate={rankedDate} />
          </div>
          <h1 className="mt-4 font-serif text-5xl font-black text-zinc-50">Upcoming</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            One card per game, ranked by starter form and matchup context. Probables are grouped head-to-head instead of duplicated by pitcher.
          </p>
          <UpcomingToggle activeDate={resolvedDate} today={today} tomorrow={tomorrow} />
          <UpcomingControls controls={controls} teams={teamsForGames(upcoming.games)} basePath={upcomingDateHref(resolvedDate)} />
        </header>
      </div>
      <TonightsMustWatch
        tonight={visibleUpcoming}
        fullSlateHref={upcomingWeekHref(resolvedDate)}
        fullSlateLabel="Week view"
        fullSlateAriaLabel={`View week of ${formatUpcomingDate(resolvedDate)}`}
        eyebrow={formatUpcomingDate(resolvedDate)}
        title="Must-Watch Games"
        rankLabel={`on ${formatUpcomingDate(resolvedDate)}`}
      />
    </main>
  );
}

type UpcomingControlsState = {
  pregameOnly: boolean;
  sort: "watch" | "time";
  team: string;
};

export function normalizeUpcomingControls(params?: { pregame?: string; sort?: string; team?: string }): UpcomingControlsState {
  return {
    pregameOnly: params?.pregame === "1",
    sort: params?.sort === "time" ? "time" : "watch",
    team: params?.team ?? "",
  };
}

export function filterAndSortGames<T extends { status: string; firstPitch: string; gameWatchScore: number; away: string; home: string }>(games: T[], controls: UpcomingControlsState) {
  return games
    .filter((game) => !controls.pregameOnly || game.status === "pregame")
    .filter((game) => !controls.team || game.away === controls.team || game.home === controls.team)
    .sort((a, b) => {
      if (controls.sort === "time") return a.firstPitch.localeCompare(b.firstPitch) || b.gameWatchScore - a.gameWatchScore;
      return 0;
    });
}

export function teamsForGames(games: Array<{ away: string; home: string }>) {
  return [...new Set(games.flatMap((game) => [game.away, game.home]))].sort();
}

export function UpcomingControls({ controls, teams, basePath }: { controls: UpcomingControlsState; teams: string[]; basePath: string }) {
  const controlsLabel = upcomingControlsLabel(controls);

  return (
    <details className="mt-5 rounded border border-white/10 bg-[#101014] p-3" data-responsive-check="upcoming-controls">
      <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.16em] text-amber-300 marker:text-amber-300" aria-label={controlsLabel}>
        {controlsLabel}
      </summary>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <ControlGroup label="Status">
          <ControlLink active={!controls.pregameOnly} href={upcomingControlHref(basePath, { ...controls, pregameOnly: false })}>All games</ControlLink>
          <ControlLink active={controls.pregameOnly} href={upcomingControlHref(basePath, { ...controls, pregameOnly: true })}>Pregame only</ControlLink>
        </ControlGroup>
        <ControlGroup label="Sort">
          <ControlLink active={controls.sort === "watch"} href={upcomingControlHref(basePath, { ...controls, sort: "watch" })}>Watch rank</ControlLink>
          <ControlLink active={controls.sort === "time"} href={upcomingControlHref(basePath, { ...controls, sort: "time" })}>Start time</ControlLink>
        </ControlGroup>
        <ControlGroup label="Team">
          <ControlLink active={!controls.team} href={upcomingControlHref(basePath, { ...controls, team: "" })}>All teams</ControlLink>
          {teams.map((team) => <ControlLink key={team} active={controls.team === team} href={upcomingControlHref(basePath, { ...controls, team })}>{team}</ControlLink>)}
        </ControlGroup>
      </div>
    </details>
  );
}

function upcomingControlsLabel(controls: UpcomingControlsState) {
  return `Filters / ${controls.pregameOnly ? "Pregame only" : "All statuses"} / ${controls.sort === "time" ? "Start time" : "Watch rank"} / ${controls.team || "All teams"}`;
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ControlLink({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link className={`inline-flex min-h-11 items-center rounded border px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] ${active ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 text-zinc-300"}`} href={href}>
      {children}
    </Link>
  );
}

function upcomingControlHref(basePath: string, controls: UpcomingControlsState) {
  const params = new URLSearchParams();
  if (controls.pregameOnly) params.set("pregame", "1");
  if (controls.sort !== "watch") params.set("sort", controls.sort);
  if (controls.team) params.set("team", controls.team);
  const query = params.toString();
  return `${basePath}${query ? `?${query}` : ""}`;
}

function UpcomingToggle({ activeDate, today, tomorrow }: { activeDate: string; today: string; tomorrow: string }) {
  const todayActive = activeDate === today;
  const tomorrowActive = activeDate === tomorrow;

  return (
    <nav className="mt-5 flex flex-wrap gap-2 font-mono text-xs uppercase tracking-[0.14em]" aria-label="Upcoming range">
      <Link className={toggleClass(todayActive)} href={upcomingDateHref(today)} aria-current={todayActive ? "page" : undefined} aria-label={`View today slate for ${formatUpcomingDate(today)}`}>Today</Link>
      <Link className={toggleClass(tomorrowActive)} href={upcomingDateHref(tomorrow)} aria-current={tomorrowActive ? "page" : undefined} aria-label={`View tomorrow slate for ${formatUpcomingDate(tomorrow)}`}>Tomorrow</Link>
      <Link className={toggleClass(false)} href={upcomingWeekHref(activeDate)} aria-label={`View week of ${formatUpcomingDate(activeDate)}`}>This week</Link>
    </nav>
  );
}

function toggleClass(active: boolean) {
  return `inline-flex min-h-11 items-center rounded border px-3 ${active ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 text-zinc-300"}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
