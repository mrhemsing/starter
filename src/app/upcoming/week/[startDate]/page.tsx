import Link from "next/link";
import type { Metadata } from "next";
import { SiteNav } from "@/components/site-nav";
import { TonightsMustWatch } from "@/components/tonights-must-watch";
import { filterAndSortGames, normalizeUpcomingControls, teamsForGames, UpcomingControls } from "@/app/upcoming/[date]/page";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { getUpcomingMustWatch } from "@/lib/data/tonight-service";
import { formatUpcomingDate, upcomingDateHref, upcomingWeekHref } from "@/lib/routes";
import { jsonLdScript, noIndexFollow } from "@/lib/seo";
import { jsonLdForUpcomingWeek, upcomingWeekDescription, upcomingWeekTitle } from "@/lib/upcoming-metadata";

type UpcomingWeekPageProps = {
  params: Promise<{
    startDate: string;
  }>;
  searchParams?: Promise<{
    pregame?: string;
    sort?: string;
    team?: string;
  }>;
};

export async function generateMetadata({ params, searchParams }: UpcomingWeekPageProps): Promise<Metadata> {
  const { startDate } = await params;
  const query = await searchParams;
  const upcoming = await getUpcomingMustWatch({ start: startDate, days: 7, window: 5 });
  const resolvedStartDate = upcoming.range.start;
  const title = upcomingWeekTitle(resolvedStartDate);
  const description = upcomingWeekDescription(upcoming);
  const url = upcomingWeekHref(resolvedStartDate);
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

export default async function UpcomingWeekPage({ params, searchParams }: UpcomingWeekPageProps) {
  const { startDate } = await params;
  const controls = normalizeUpcomingControls(await searchParams);
  const today = getHomeSlateDate();
  const tomorrow = addDays(today, 1);
  const rankedDate = addDays(today, -1);
  const upcoming = await getUpcomingMustWatch({ start: startDate, days: 7, window: 5 });
  const resolvedStartDate = upcoming.range.start;
  const bestGame = upcoming.days.flatMap((day) => day.games.map((game) => ({ day: day.date, game }))).sort((a, b) => b.game.gameWatchScore - a.game.gameWatchScore)[0];
  const jsonLd = jsonLdForUpcomingWeek(upcoming);
  const allGames = upcoming.days.flatMap((day) => day.games);

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 border-b border-white/10 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">Toe the Slab</Link>
            <SiteNav active="upcoming" today={today} rankedDate={rankedDate} />
          </div>
          <h1 className="mt-4 font-serif text-5xl font-black text-zinc-50">Upcoming Starting Matchups</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            This week&apos;s probable slates grouped by date. Each game is ranked once, by watchability, with both starters shown head-to-head.
          </p>
          <nav className="mt-5 flex flex-wrap gap-2 font-mono text-xs uppercase tracking-[0.14em]" aria-label="Upcoming range">
            <Link className={toggleClass(false)} href={upcomingDateHref(today)} aria-label={`View today slate for ${formatUpcomingDate(today)}`}>Today</Link>
            <Link className={toggleClass(false)} href={upcomingDateHref(tomorrow)} aria-label={`View tomorrow slate for ${formatUpcomingDate(tomorrow)}`}>Tomorrow</Link>
            <Link className={toggleClass(true)} href={upcomingWeekHref(resolvedStartDate)} aria-current="page" aria-label={`View week of ${formatUpcomingDate(resolvedStartDate)}`}>This week</Link>
          </nav>
          {bestGame ? (
            <Link
              href={upcomingDateHref(bestGame.day)}
              className="mt-4 inline-flex rounded border border-amber-300/30 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-amber-300 transition hover:border-amber-300/60 hover:text-amber-200"
              aria-label={`View featured game day slate for ${formatUpcomingDate(bestGame.day)}`}
            >
              Week&apos;s must-watch: {bestGame.game.label} / {formatUpcomingDate(bestGame.day)} / #1 week pick
            </Link>
          ) : null}
          <UpcomingControls controls={controls} teams={teamsForGames(allGames)} basePath={upcomingWeekHref(resolvedStartDate)} />
        </header>
      </div>

      <div className="space-y-8">
        {upcoming.days.map((day) => (
          <TonightsMustWatch
            key={day.date}
            tonight={{ ...day, games: filterAndSortGames(day.games, controls) }}
            fullSlateHref={upcomingDateHref(day.date)}
            fullSlateLabel="Day slate"
            fullSlateAriaLabel={`View day slate for ${formatUpcomingDate(day.date)}`}
            eyebrow={formatUpcomingDate(day.date)}
            title="Must-Watch Games"
            rankLabel={`on ${formatUpcomingDate(day.date)}`}
            sectionId={`must-watch-${day.date}`}
          />
        ))}
      </div>
    </main>
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
