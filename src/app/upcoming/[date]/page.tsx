import type { Metadata } from "next";
import type React from "react";
import { FastFilterLink } from "@/components/fast-filter-link";
import { PendingRegion } from "@/components/route-control-pending";
import { SegmentedControl } from "@/components/segmented-control";
import { UpcomingSlateRangeToggle } from "@/components/slate-date-nav";
import { SiteHeader } from "@/components/site-header";
import { TonightsMustWatch } from "@/components/tonights-must-watch";
import { UpcomingSimpleBoard } from "@/components/upcoming-simple-board";
import { UpcomingViewModePanels, UpcomingViewModeProvider, UpcomingViewModeToggle } from "@/components/upcoming-view-mode";
import { getHomeSlateDate, getSlateStartProgress } from "@/lib/data/start-service";
import { getTonightMustWatch } from "@/lib/data/tonight-service";
import { formatUpcomingDate, upcomingDateHref, upcomingWeekHref } from "@/lib/routes";
import { assertValidDateRouteParam } from "@/lib/route-date-response";
import { jsonLdScript, noIndexFollow } from "@/lib/seo";
import type { SlateProgressState } from "@/lib/slate-state";
import { jsonLdForUpcomingDay, upcomingDayDescription, upcomingDayTitle } from "@/lib/upcoming-metadata";
import type { TonightGameStatus } from "@/lib/types";

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
  const [upcoming, slateState] = await Promise.all([
    getTonightMustWatch({ date, window: 5 }),
    getSlateStartProgress({ window: "today", date }),
  ]);
  const resolvedDate = upcoming.date;
  const statusSummary = summarizeUpcomingStatuses(upcoming.games);
  const statusVaries = statusSummary.distinctStatuses >= 2;
  const effectiveControls = statusVaries ? controls : { ...controls, pregameOnly: false };
  const visibleUpcoming = { ...upcoming, games: filterAndSortGames(upcoming.games, effectiveControls) };
  const jsonLd = jsonLdForUpcomingDay(visibleUpcoming);

  return (
    <UpcomingViewModeProvider>
      <main className="min-h-screen bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8">
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(() => { try { document.documentElement.setAttribute("data-upcoming-view-mode-init", window.localStorage.getItem("tts.upcoming.view") === "SIMPLE" ? "simple" : "detailed"); } catch { document.documentElement.setAttribute("data-upcoming-view-mode-init", "detailed"); } })();`,
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
                controls={effectiveControls}
                basePath={upcomingDateHref(resolvedDate)}
                slateRange="day"
                visibleGameCount={visibleUpcoming.games.length}
                scheduledGameCount={upcoming.scheduledGames}
                showStatusFilter={statusVaries}
                statusSummary={statusSummary}
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
            simple={<UpcomingSimpleBoard tonight={visibleUpcoming} rankLabel={`on ${formatUpcomingDate(resolvedDate)}`} sortMode={effectiveControls.sort} />}
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
    pregameOnly: params?.pregame === "1",
    sort: params?.sort === "time" ? "time" : "watch",
  };
}

export function filterAndSortGames<T extends { status: string; firstPitch: string; gameWatchScore: number }>(games: T[], controls: UpcomingControlsState) {
  const visibleGames = games.filter((game) => !controls.pregameOnly || game.status === "pregame");
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
  showStatusFilter = true,
  statusSummary,
  viewModeToggle,
  className = "mt-3",
}: {
  controls: UpcomingControlsState;
  basePath: string;
  slateRange: "day" | "week";
  visibleGameCount: number;
  scheduledGameCount: number;
  showStatusFilter?: boolean;
  statusSummary?: UpcomingStatusSummary;
  viewModeToggle?: React.ReactNode;
  className?: string;
}) {
  const controlsLabel = upcomingControlsLabel(controls, showStatusFilter);
  const controlsKey = `${controls.pregameOnly ? "pregame" : "all"}-${controls.sort}`;
  const controlsEmpty = visibleGameCount === 0;
  const hiddenGameCount = Math.max(0, scheduledGameCount - visibleGameCount);
  const activeControlCount = (showStatusFilter ? 1 : 0) + 1;

  return (
    <div
      className={`${className} flex max-w-full flex-nowrap items-center gap-2 overflow-x-auto py-1`}
      data-responsive-check="upcoming-controls"
      data-slate-range={slateRange}
      data-control-key={controlsKey}
      data-control-label={controlsLabel}
      data-control-pregame={String(controls.pregameOnly)}
      data-control-sort={controls.sort}
      data-control-empty={String(controlsEmpty)}
      data-control-status-filter-visible={String(showStatusFilter)}
      data-control-status-summary={statusSummary ? statusSummaryValue(statusSummary) : "unknown"}
      data-control-base-path={basePath}
      data-control-visible-games={visibleGameCount}
      data-control-scheduled-games={scheduledGameCount}
      data-control-hidden-games={hiddenGameCount}
      data-control-active-count={activeControlCount}
      aria-label={controlsLabel}
    >
      {showStatusFilter ? (
        <ControlGroup label="Status">
          <ControlLink controlKey="status-all" active={!controls.pregameOnly} href={upcomingControlHref(basePath, { ...controls, pregameOnly: false })}>All games</ControlLink>
          <ControlLink controlKey="status-pregame" active={controls.pregameOnly} href={upcomingControlHref(basePath, { ...controls, pregameOnly: true })}>Pregame only</ControlLink>
        </ControlGroup>
      ) : null}
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
  );
}

function upcomingControlsLabel(controls: UpcomingControlsState, showStatusFilter: boolean) {
  const status = showStatusFilter ? `${controls.pregameOnly ? "Pregame only" : "All statuses"} / ` : "";
  return `Filters / ${status}${controls.sort === "time" ? "Start time" : "Watch rank"}`;
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={`${label} filters`}>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ControlLink({ controlKey, active, href, children }: { controlKey: string; active: boolean; href: string; children: React.ReactNode }) {
  return (
    <FastFilterLink className={`inline-flex min-h-11 items-center rounded border px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] ${active ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 text-zinc-300"}`} href={href} ariaCurrent={active ? "location" : undefined} aria-controls="upcoming-board" data-control-link-active={String(active)} data-control-link-key={controlKey} pendingRegion="upcoming-board" pendingLabel="Upcoming matchup board" scroll={false}>
      {children}
    </FastFilterLink>
  );
}

function upcomingControlHref(basePath: string, controls: UpcomingControlsState) {
  const params = new URLSearchParams();
  if (controls.pregameOnly) params.set("pregame", "1");
  if (controls.sort !== "watch") params.set("sort", controls.sort);
  const query = params.toString();
  return `${basePath}${query ? `?${query}` : ""}`;
}

type UpcomingStatusSummary = {
  pregame: number;
  delay: number;
  live: number;
  final: number;
  distinctStatuses: number;
};

export function summarizeUpcomingStatuses(games: Array<{ status: TonightGameStatus }>): UpcomingStatusSummary {
  const summary = games.reduce<UpcomingStatusSummary>(
    (current, game) => {
      if (game.status === "pregame") current.pregame += 1;
      else if (game.status === "delay") current.delay += 1;
      else if (game.status === "live") current.live += 1;
      else if (game.status === "final") current.final += 1;
      return current;
    },
    { pregame: 0, delay: 0, live: 0, final: 0, distinctStatuses: 0 },
  );
  summary.distinctStatuses = [summary.pregame, summary.delay, summary.live, summary.final].filter((count) => count > 0).length;
  return summary;
}

function statusSummaryValue(summary: UpcomingStatusSummary) {
  return `pregame:${summary.pregame},delay:${summary.delay},live:${summary.live},final:${summary.final}`;
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
