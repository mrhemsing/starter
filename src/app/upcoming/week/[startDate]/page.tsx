import Link from "next/link";
import type { Metadata } from "next";
import { PendingRegion } from "@/components/route-control-pending";
import { UpcomingSlateRangeToggle } from "@/components/slate-date-nav";
import { SiteHeader } from "@/components/site-header";
import { TonightsMustWatch } from "@/components/tonights-must-watch";
import { filterAndSortGames, normalizeUpcomingControls, summarizeUpcomingStatuses, UpcomingControls } from "@/app/upcoming/[date]/page";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { getUpcomingMustWatch } from "@/lib/data/tonight-service";
import { formatUpcomingDate, upcomingDateHref, upcomingWeekHref } from "@/lib/routes";
import { assertValidDateRouteParam } from "@/lib/route-date-response";
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

export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: UpcomingWeekPageProps): Promise<Metadata> {
  const { startDate } = await params;
  assertValidDateRouteParam(startDate);
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
  assertValidDateRouteParam(startDate);
  const controls = normalizeUpcomingControls(await searchParams);
  const today = getHomeSlateDate();
  const tomorrow = addDays(today, 1);
  const rankedDate = addDays(today, -1);
  const upcoming = await getUpcomingMustWatch({ start: startDate, days: 7, window: 5 });
  const resolvedStartDate = upcoming.range.start;
  const bestGame = upcoming.days
    .flatMap((day) => day.games.map((game) => ({ day: day.date, game })))
    .sort(
      (a, b) =>
        b.game.gameWatchScore - a.game.gameWatchScore ||
        a.game.firstPitch.localeCompare(b.game.firstPitch) ||
        a.game.label.localeCompare(b.game.label),
    )[0];
  const allGames = upcoming.days.flatMap((day) => day.games);
  const statusSummary = summarizeUpcomingStatuses(allGames);
  const statusVaries = statusSummary.distinctStatuses >= 2;
  const effectiveControls = statusVaries ? controls : { ...controls, pregameOnly: false };
  const filteredDays = upcoming.days.map((day) => ({ ...day, games: filterAndSortGames(day.games, effectiveControls) }));
  const visibleUpcoming = { ...upcoming, days: filteredDays };
  const jsonLd = jsonLdForUpcomingWeek(visibleUpcoming);
  const visibleGameCount = filteredDays.reduce((count, day) => count + day.games.length, 0);
  const scheduledGameCount = upcoming.days.reduce((count, day) => count + day.scheduledGames, 0);

  return (
    <main className="min-h-screen bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8">
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <div className="mx-auto max-w-7xl">
        <header className="mb-3 pb-3">
          <SiteHeader active="upcoming" today={today} rankedDate={rankedDate} />
          <h1 className="mt-4 font-serif text-5xl font-black text-zinc-50">Upcoming Matchups</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            One card per game, ranked by starter form and matchup context.
          </p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500" data-responsive-check="upcoming-slate-stamp">
            Week of {formatUpcomingDate(resolvedStartDate)} · {visibleGameCount} of {scheduledGameCount} games shown
          </p>
          <UpcomingSlateRangeToggle activeDate={resolvedStartDate} today={today} tomorrow={tomorrow} weekActive />
          {bestGame ? (
            <Link
              href={upcomingDateHref(bestGame.day)}
              className="mt-4 inline-flex rounded border border-amber-300/30 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-amber-300 transition hover:border-amber-300/60 hover:text-amber-200"
              aria-label={`View featured game day slate for ${formatUpcomingDate(bestGame.day)}`}
              data-responsive-check="upcoming-week-feature"
              data-feature-date={bestGame.day}
              data-feature-game-id={bestGame.game.gamePk}
              data-feature-watch-score={bestGame.game.gameWatchScore}
              data-feature-rank="1"
            >
              Week&apos;s must-watch: {bestGame.game.label} / {formatUpcomingDate(bestGame.day)} / #1 week pick
            </Link>
          ) : null}
          <UpcomingControls
            controls={effectiveControls}
            basePath={upcomingWeekHref(resolvedStartDate)}
            slateRange="week"
            visibleGameCount={visibleGameCount}
            scheduledGameCount={scheduledGameCount}
            showStatusFilter={statusVaries}
            statusSummary={statusSummary}
          />
        </header>
      </div>

      <PendingRegion id="upcoming-board" region="upcoming-board" label="Upcoming matchup board" className="space-y-8 transition data-[route-pending=true]:opacity-70">
        {filteredDays.map((day) => (
          <TonightsMustWatch
            key={day.date}
            tonight={day}
            fullSlateHref={upcomingDateHref(day.date)}
            fullSlateLabel="Day slate"
            fullSlateAriaLabel={`View day slate for ${formatUpcomingDate(day.date)}`}
            eyebrow={formatUpcomingDate(day.date)}
            title="Matchup Board"
            rankLabel={`on ${formatUpcomingDate(day.date)}`}
            sectionId={`must-watch-${day.date}`}
          />
        ))}
      </PendingRegion>
    </main>
  );
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
