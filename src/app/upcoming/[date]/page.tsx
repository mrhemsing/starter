import type { Metadata } from "next";
import type React from "react";
import { PendingRegion } from "@/components/route-control-pending";
import { SegmentedControl } from "@/components/segmented-control";
import { UpcomingSlateRangeToggle } from "@/components/slate-date-nav";
import { SiteHeader } from "@/components/site-header";
import { TonightsMustWatch } from "@/components/tonights-must-watch";
import { UpcomingSimpleBoard } from "@/components/upcoming-simple-board";
import { UpcomingViewModePanels, UpcomingViewModeProvider, UpcomingViewModeToggle } from "@/components/upcoming-view-mode";
import { getHomeSlateDate, getSlateStartProgress } from "@/lib/data/start-service";
import { getTonightMustWatch } from "@/lib/data/tonight-service";
import { readUpcomingWriteups } from "@/lib/data/upcoming-writeups-service";
import { formatUpcomingDate, upcomingDateHref, upcomingWeekHref } from "@/lib/routes";
import { assertValidDateRouteParam } from "@/lib/route-date-response";
import { jsonLdScript, noIndexFollow } from "@/lib/seo";
import type { SlateProgressState } from "@/lib/slate-state";
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

export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: UpcomingDatePageProps): Promise<Metadata> {
  const { date } = await params;
  assertValidDateRouteParam(date);
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
  assertValidDateRouteParam(date);
  const controls = normalizeUpcomingControls(await searchParams);
  const today = getHomeSlateDate();
  const tomorrow = addDays(today, 1);
  const rankedDate = addDays(today, -1);
  const [upcoming, slateState, contextWriteups] = await Promise.all([
    getTonightMustWatch({ date, window: 5 }),
    getSlateStartProgress({ window: "today", date }),
    readUpcomingWriteups(date),
  ]);
  const resolvedDate = upcoming.date;
  const visibleUpcoming = { ...upcoming, games: filterAndSortGames(upcoming.games, controls) };
  const jsonLd = jsonLdForUpcomingDay(visibleUpcoming);

  return (
    <UpcomingViewModeProvider>
      <main className="min-h-screen bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8">
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(() => { try { document.documentElement.setAttribute("data-upcoming-view-mode-init", window.localStorage.getItem("tts.upcoming.view") === "DETAILED" ? "detailed" : "simple"); } catch { document.documentElement.setAttribute("data-upcoming-view-mode-init", "simple"); } })();`,
          }}
        />
        <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
        <div className="mx-auto max-w-7xl">
          <header className="mb-3 pb-3">
            <SiteHeader active="upcoming" today={today} rankedDate={rankedDate} />
            <h1 className="mt-4 font-serif text-5xl font-black text-zinc-50">Upcoming Matchups</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              One card per game, ranked by starter form and matchup context.
            </p>
            <p
              className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500"
              data-responsive-check="upcoming-slate-stamp"
              data-slate-state={slateState.state}
              aria-label={formatUpcomingSlateStampLabel(slateState, today)}
            >
              {formatUpcomingSlateStamp(slateState, today)}
            </p>
            <div className="mt-5 flex flex-col gap-2" data-upcoming-toolbar-row>
              <UpcomingSlateRangeToggle activeDate={resolvedDate} today={today} tomorrow={tomorrow} className="mt-0" />
              <UpcomingControls
                controls={controls}
                basePath={upcomingDateHref(resolvedDate)}
                slateRange="day"
                visibleGameCount={visibleUpcoming.games.length}
                scheduledGameCount={upcoming.scheduledGames}
                viewModeToggle={<UpcomingViewModeToggle />}
                className="mt-0"
              />
            </div>
          </header>
        </div>
        <PendingRegion id="upcoming-board" region="upcoming-board" label="Upcoming matchup board" className="transition data-[route-pending=true]:opacity-70">
          <UpcomingViewModePanels
            detailed={(
              <TonightsMustWatch
                tonight={visibleUpcoming}
                fullSlateHref={upcomingWeekHref(resolvedDate)}
                fullSlateLabel="Week view"
                fullSlateAriaLabel={`View week of ${formatUpcomingDate(resolvedDate)}`}
                eyebrow={formatUpcomingSectionDate(resolvedDate)}
                title="Matchup Board"
                rankLabel={`on ${formatUpcomingDate(resolvedDate)}`}
                compactTopPadding
              />
            )}
            simple={<UpcomingSimpleBoard tonight={visibleUpcoming} rankLabel={`on ${formatUpcomingDate(resolvedDate)}`} sortMode={controls.sort} contextWriteups={contextWriteups} />}
          />
        </PendingRegion>
      </main>
    </UpcomingViewModeProvider>
  );
}

function formatUpcomingSlateStamp(state: SlateProgressState, today: string) {
  const dayLabel = state.date === today ? "Today" : formatUpcomingStampDate(state.date);
  const dateLabel = formatUpcomingStampDate(state.date);
  if (state.state === "no-games") return `${dateLabel} · no games today`;
  if (state.state === "all-starts-complete") return `${dayLabel} · ${dateLabel} · all ${state.totalStarts} starts final`;
  if (state.state === "starts-in-progress") return `${dayLabel} · ${dateLabel} · ${state.completedStarts} of ${state.totalStarts} starts final`;
  const firstStarterLabel = `first starter toes the slab ${state.firstPitchAt ? formatFirstPitchStamp(state.firstPitchAt) : "soon"}`;
  return (
    <>
      <span className="block sm:inline">{dayLabel} · {dateLabel}</span>
      <span className="hidden sm:inline"> · </span>
      <span className="mt-1 block sm:mt-0 sm:inline">{firstStarterLabel}</span>
    </>
  );
}

function formatUpcomingSlateStampLabel(state: SlateProgressState, today: string) {
  const dayLabel = state.date === today ? "Today" : formatUpcomingStampDate(state.date);
  const dateLabel = formatUpcomingStampDate(state.date);
  if (state.state === "no-games") return `${dateLabel} · no games today`;
  if (state.state === "all-starts-complete") return `${dayLabel} · ${dateLabel} · all ${state.totalStarts} starts final`;
  if (state.state === "starts-in-progress") return `${dayLabel} · ${dateLabel} · ${state.completedStarts} of ${state.totalStarts} starts final`;
  return `${dayLabel} · ${dateLabel} · first starter toes the slab ${state.firstPitchAt ? formatFirstPitchStamp(state.firstPitchAt) : "soon"}`;
}

function formatUpcomingStampDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function formatFirstPitchStamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "soon";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: process.env.THE_BUMP_TIME_ZONE ?? "America/Los_Angeles",
    timeZoneName: "short",
  }).format(parsed);
}

type UpcomingControlsState = {
  pregameOnly: boolean;
  sort: "watch" | "time";
};

export function normalizeUpcomingControls(params?: { pregame?: string; sort?: string }): UpcomingControlsState {
  return {
    pregameOnly: false,
    sort: params?.sort === "time" ? "time" : "watch",
  };
}

export function filterAndSortGames<T extends { firstPitch: string; gameWatchScore: number }>(games: T[], controls: UpcomingControlsState) {
  const visibleGames = games;
  if (controls.sort === "time") {
    return [...visibleGames].sort((a, b) => a.firstPitch.localeCompare(b.firstPitch) || b.gameWatchScore - a.gameWatchScore);
  }
  return visibleGames;
}

export function UpcomingControls({
  controls,
  basePath,
  slateRange,
  visibleGameCount,
  scheduledGameCount,
  viewModeToggle,
  className = "mt-3",
}: {
  controls: UpcomingControlsState;
  basePath: string;
  slateRange: "day" | "week";
  visibleGameCount: number;
  scheduledGameCount: number;
  viewModeToggle?: React.ReactNode;
  className?: string;
}) {
  const controlsLabel = upcomingControlsLabel(controls);
  const controlsKey = `all-${controls.sort}`;
  const controlsEmpty = visibleGameCount === 0;
  const hiddenGameCount = Math.max(0, scheduledGameCount - visibleGameCount);
  const activeControlCount = 1;

  return (
    <div
      className={`${className} flex max-w-full flex-col gap-1`}
      data-responsive-check="upcoming-controls"
      data-slate-range={slateRange}
      data-control-key={controlsKey}
      data-control-label={controlsLabel}
      data-control-pregame="false"
      data-control-sort={controls.sort}
      data-control-empty={String(controlsEmpty)}
      data-control-status-filter-visible="false"
      data-control-status-summary="removed"
      data-control-base-path={basePath}
      data-control-visible-games={visibleGameCount}
      data-control-scheduled-games={scheduledGameCount}
      data-control-hidden-games={hiddenGameCount}
      data-control-active-count={activeControlCount}
      aria-label={controlsLabel}
    >
      <div className="flex max-w-full flex-nowrap items-center gap-2 overflow-x-auto py-1" data-upcoming-control-row>
        <SegmentedControl
          label="Sort"
          ariaLabel="Sort options"
          activeValue={controls.sort}
          segments={[
            { value: "watch", label: "Watch rank", href: upcomingControlHref(basePath, { ...controls, sort: "watch" }), controlKey: "sort-watch" },
            { value: "time", label: "Start time", href: upcomingControlHref(basePath, { ...controls, sort: "time" }), controlKey: "sort-time" },
          ]}
          pendingRegion="upcoming-board"
          pendingLabel="Upcoming matchup board"
          ariaControls="upcoming-board"
        />
        {viewModeToggle}
      </div>
    </div>
  );
}

function upcomingControlsLabel(controls: UpcomingControlsState) {
  return `Filters / ${controls.sort === "time" ? "Start time" : "Watch rank"}`;
}

function upcomingControlHref(basePath: string, controls: UpcomingControlsState) {
  const params = new URLSearchParams();
  if (controls.sort !== "watch") params.set("sort", controls.sort);
  const query = params.toString();
  return `${basePath}${query ? `?${query}` : ""}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatUpcomingSectionDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}
