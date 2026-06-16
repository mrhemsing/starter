import { HeatCheckHero } from "@/components/heat-check-hero";
import { FeaturedStartHighlightEmbed } from "@/components/featured-start-highlight";
import { Headshot } from "@/components/headshot";
import { PitchingDuelsModule } from "@/components/pitching-duels";
import { RankedStartsRecap } from "@/components/ranked-starts-recap";
import { ShareStartButton } from "@/components/share-start-button";
import { SiteNav } from "@/components/site-nav";
import { TonightsMustWatch } from "@/components/tonights-must-watch";
import { TopPerformerCard } from "@/components/top-performer-card";
import type { Metadata } from "next";
import { getPitchingDuels } from "@/lib/data/duels-service";
import { resolveFeaturedStartHighlight } from "@/lib/data/featured-highlight-service";
import { getFormHome } from "@/lib/data/form-service";
import { getArchivedSlateStarts, getDailySlate, getHomeSlateDate, getHomeSlateNavigation, getRankedSlateCompletionState, getStartDetail, type RankedSlateCompletionState } from "@/lib/data/start-service";
import { getTonightMustWatch } from "@/lib/data/tonight-service";
import { resolveTopPerformerImage } from "@/lib/data/top-performer-image-service";
import { formatStartLine } from "@/lib/format";
import { startPath, upcomingDateHref } from "@/lib/routes";
import { jsonLdScript, websiteOpenGraph, largeImageTwitter } from "@/lib/seo";
import type { FeaturedStartHighlight, FormHomeResponse, FormSummary, StartDetail, StartSummary } from "@/lib/types";

export const revalidate = 60;

const homeTitle = "Toe the Slab: Every MLB start, ranked.";
const homeDescription = "Every MLB start ranked by GS+. Daily starting-pitcher rankings, rolling form, probable matchups, and the night's best pitching lines.";
const LIVE_TOP_PERFORMER_FLOOR = 58;

export const metadata: Metadata = {
  title: { absolute: homeTitle },
  description: homeDescription,
  alternates: { canonical: "/" },
  openGraph: websiteOpenGraph(homeTitle, homeDescription, "/"),
  twitter: largeImageTwitter(homeTitle, homeDescription),
};

export default async function Home() {
  const today = getHomeSlateDate();
  const slateNavigation = getHomeSlateNavigation(today);
  const yesterday = slateNavigation[0].date;
  const tomorrow = addDays(today, 1);
  const [yesterdayArchivedSlateStarts, formHome, tonight, tomorrowTonight, todayCompletion] = await Promise.all([
    getArchivedSlateStarts(yesterday),
    getFormHome({ window: 5 }),
    getTonightMustWatch({ date: today, window: 5 }),
    getTonightMustWatch({ date: tomorrow, window: 5 }),
    getRankedSlateCompletionState(today, today),
  ]);
  const gamesToday = tonight.scheduledGames;
  const liveGamesToday = tonight.games.filter((game) => game.status === "live").length;
  const startedGamesToday = todayCompletion.finalGames + liveGamesToday;
  const todaySlateStarts = startedGamesToday > 0 ? await getDailySlate({ window: "today", date: today }) : [];
  const yesterdaySlateStarts = yesterdayArchivedSlateStarts.length > 0 ? yesterdayArchivedSlateStarts : await getDailySlate({ window: "yesterday", date: yesterday });
  const formHomeWithHighlights = await attachHotHighlights(formHome);
  const todayCompletedSlateStarts = todaySlateStarts.filter((start) => start.source?.line !== "fixture");
  const isTodaySlateStarted = startedGamesToday > 0;
  const useTodaySlate = todayCompletedSlateStarts.length > 0;
  const slateStarts = useTodaySlate ? todaySlateStarts : yesterdaySlateStarts;
  const rankedDate = useTodaySlate ? today : yesterday;
  const rankedLabel = useTodaySlate ? "Today" : "Yesterday";
  const completedSlateStarts = slateStarts.filter((start) => start.source?.line !== "fixture");
  const topPerformerState = resolveTopPerformerState({
    today,
    yesterday,
    todayCompletion,
    isTodaySlateStarted,
    todayCompletedSlateStarts,
    yesterdaySlateStarts,
  });
  const topStart = topPerformerState?.start ?? null;
  const [featuredStart, bestWindows, topHighlights] = await Promise.all([
    topStart ? getStartDetail(topStart.id) : null,
    getBestStartWindows(yesterday),
    resolveSummaryHighlights(completedSlateStarts.slice(0, 5)),
  ]);
  const [featuredHighlight, weeklyHighlight, monthlyHighlight] = await Promise.all([
    resolveFeaturedStartHighlight(featuredStart),
    resolveSummaryHighlight(bestWindows.weekly),
    resolveSummaryHighlight(bestWindows.monthly),
  ]);
  const heroImage = await resolveTopPerformerImage(topStart ?? null, featuredHighlight);
  const tonightBand = tonight.games.length > 0 ? tonight : tomorrowTonight;
  const tonightBandDate = tonight.games.length > 0 ? today : tomorrow;
  const tonightDuels = await getPitchingDuels(tonightBandDate, "upcoming");
  const slateStatus = useTodaySlate
    ? {
        lead: `Today · ${formatLongDate(rankedDate)}`,
        detail: `${todayCompletedSlateStarts.length} QUALIFYING ${todayCompletedSlateStarts.length === 1 ? "START" : "STARTS"} POSTED`,
      }
    : startedGamesToday > 0
      ? {
          lead: `Today · ${formatLongDate(today)}`,
          detail: `AWAITING FIRST COMPLETED START · ${liveGamesToday}/${gamesToday} ${liveGamesToday === 1 ? "GAME" : "GAMES"} IN PROGRESS`,
        }
    : {
        lead: `Today · ${formatLongDate(today)}`,
        detail: `${gamesToday} MLB GAMES SCHEDULED`,
      };
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Toe the Slab",
      url: "https://www.toetheslab.com/",
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Toe the Slab",
      url: "https://www.toetheslab.com/",
      description: homeDescription,
    },
  ];

  return (
    <main className="min-h-screen bg-[#08080a] text-zinc-100">
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <section className="relative overflow-hidden px-4 pb-6 pt-6 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[#08080a]" />
        <div
          className="absolute inset-x-0 top-0 h-[520px] bg-no-repeat opacity-[0.44] saturate-[0.92] sm:h-[440px] lg:hidden"
          style={{
            backgroundImage: "url('/images/header-baseball-bg.jpg')",
            backgroundPosition: "right -54px top 82px",
            backgroundSize: "clamp(360px, 108vw, 520px) auto",
          }}
          aria-hidden="true"
          data-responsive-check="home-header-background-mobile"
        />
        <div
          className="absolute inset-x-0 top-0 hidden h-[380px] bg-no-repeat opacity-100 saturate-[0.92] lg:block"
          style={{
            backgroundImage: "url('/images/header-baseball-bg.jpg')",
            backgroundPosition: "76% 74%",
            backgroundSize: "min(720px, 115vw) auto",
          }}
          aria-hidden="true"
          data-responsive-check="home-header-background"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,8,10,0.98)_0%,rgba(8,8,10,0.82)_42%,rgba(8,8,10,0.42)_74%,rgba(8,8,10,0.58)_100%),linear-gradient(180deg,rgba(8,8,10,0.78)_0%,rgba(8,8,10,0.26)_44%,#08080a_100%)]" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-7xl">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-300">Toe the Slab</p>
            </div>
            <SiteNav active="home" today={today} rankedDate={rankedDate} />
          </header>

          <div className="grid gap-5 py-4 lg:py-5" data-responsive-check="home-masthead">
            <div className="min-w-0 lg:max-w-3xl">
              <SlateStatusPill lead={slateStatus.lead} detail={slateStatus.detail} />
              <h1 className="font-serif text-5xl font-black leading-none text-zinc-50 sm:text-6xl">Every MLB start, ranked.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-300 sm:text-base sm:leading-7">
                Probable starters, form, matchup context, and last night&apos;s best pitching lines.
              </p>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-zinc-400 sm:mt-3 sm:text-sm sm:leading-6 lg:mb-[10px]">
                GS+ scores a single start on a 0-100 scale, with league average around 50.
                <a href="/methodology" className="ml-[10px] font-mono text-xs uppercase tracking-[0.12em] text-amber-300 underline-offset-4 hover:underline">
                  Methodology
                </a>
              </p>
            </div>
            {topPerformerState ? (
              <div className="mt-4 sm:mt-0">
                <TopPerformerCard
                  href={startPath(topPerformerState.start.id)}
                  pitcherName={topPerformerState.start.pitcher.name}
                  team={topPerformerState.start.pitcher.team}
                  opponent={topPerformerState.start.opponent}
                  dateLabel={topPerformerState.dateLabel}
                  score={topPerformerState.start.gameScorePlus}
                  line={topPerformerState.start.line}
                  rank={1}
                  slateCount={topPerformerState.slateCount}
                  image={heroImage}
                  highlight={featuredHighlight}
                  isProvisional={topPerformerState.status === "live"}
                  whiffRate={featuredStart ? startWhiffRate(featuredStart) : null}
                  topVelo={featuredStart ? startTopVelo(featuredStart) : null}
                  veloSparkline={featuredStart?.inningTimeline?.map((inning) => Number(inning.avgVelocityMph.toFixed(1))) ?? []}
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <TonightsMustWatch
        tonight={tonightBand}
        fullSlateHref={upcomingDateHref(tonightBandDate)}
        fullSlateLabel="See tonight's full slate"
        eyebrow={tonight.games.length > 0 ? "Tonight" : "Tomorrow"}
        title="Tonight's Must-Watch Games"
        previewLimit={3}
      />

      <PitchingDuelsModule duels={tonightDuels} title="Best Duels Today" compact />

      <HeatCheckHero home={formHomeWithHighlights} />

      <RankedStartsRecap
        date={rankedDate}
        label={rankedLabel}
        starts={slateStarts}
        highlights={topHighlights}
      />

      <BestStartsShowcase weekly={bestWindows.weekly} monthly={bestWindows.monthly} weeklyHighlight={weeklyHighlight} monthlyHighlight={monthlyHighlight} />
    </main>
  );
}

async function attachHotHighlights(home: FormHomeResponse): Promise<FormHomeResponse> {
  const highlightedHot = await Promise.all(home.hot.map(attachLastStartHighlight));
  return { ...home, hot: highlightedHot };
}

function resolveTopPerformerState({
  today,
  yesterday,
  todayCompletion,
  isTodaySlateStarted,
  todayCompletedSlateStarts,
  yesterdaySlateStarts,
}: {
  today: string;
  yesterday: string;
  todayCompletion: RankedSlateCompletionState;
  isTodaySlateStarted: boolean;
  todayCompletedSlateStarts: StartSummary[];
  yesterdaySlateStarts: StartSummary[];
}) {
  const todayLeader = todayCompletedSlateStarts[0] ?? null;

  if (todayCompletion.isFinal) {
    if (!todayLeader) return null;
    return {
      status: "final" as const,
      start: todayLeader,
      slateCount: todayCompletedSlateStarts.length,
      dateLabel: `Final · ${formatLongDate(today)}`,
    };
  }

  if (isTodaySlateStarted) {
    if (!todayLeader || todayLeader.gameScorePlus < LIVE_TOP_PERFORMER_FLOOR) return null;
    return {
      status: "live" as const,
      start: todayLeader,
      slateCount: todayCompletedSlateStarts.length,
      dateLabel: `Live leader · ${todayCompletion.finalGames} of ${todayCompletion.totalGames} final`,
    };
  }

  const yesterdayLeader = yesterdaySlateStarts.filter((start) => start.source?.line !== "fixture")[0] ?? null;
  if (!yesterdayLeader) return null;
  return {
    status: "previous" as const,
    start: yesterdayLeader,
    slateCount: yesterdaySlateStarts.filter((start) => start.source?.line !== "fixture").length,
    dateLabel: `Last night · ${formatLongDate(yesterday)}`,
  };
}

async function attachLastStartHighlight(pitcher: FormSummary): Promise<FormSummary> {
  if (!pitcher.lastStart) return pitcher;
  const start = await getStartDetail(pitcher.lastStart.id);
  const highlight = await resolveFeaturedStartHighlight(start);
  return { ...pitcher, highlight };
}

function SlateStatusPill({ lead, detail }: { lead: string; detail: string }) {
  return (
    <p className="mb-3 inline-flex flex-col font-mono text-xs uppercase tracking-[0.18em] text-amber-200">
      <span>{lead}</span>
      <span className="mt-1">{detail}</span>
    </p>
  );
}

function BestStartsShowcase({
  weekly,
  monthly,
  weeklyHighlight,
  monthlyHighlight,
}: {
  weekly: StartSummary | null;
  monthly: StartSummary | null;
  weeklyHighlight?: FeaturedStartHighlight | null;
  monthlyHighlight?: FeaturedStartHighlight | null;
}) {
  const monthKey = monthly?.date.slice(0, 7) ?? new Date().toISOString().slice(0, 7);
  const sameStart = weekly && monthly && weekly.id === monthly.id;
  return (
    <section className="border-t border-white/10 bg-[#08080a] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col justify-between gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-amber-300">Evergreen</p>
            <h2 className="mt-2 font-serif text-4xl font-bold text-zinc-50">Start of the Week / Month</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">The daily Spotlight is disposable. These are the rolling-window starts worth revisiting.</p>
          </div>
          <a href={`/best-starts/${monthKey}`} className="inline-flex min-h-11 items-center rounded border border-amber-300/40 px-3 font-mono text-xs uppercase tracking-[0.16em] text-amber-300">
            Best starts archive
          </a>
        </div>
        <div className={`grid gap-3 ${sameStart ? "" : "md:grid-cols-2"}`}>
          {sameStart ? (
            <BestStartCard title="7-day / 30-day best" badge="Tops the last 7 and 30 days" start={monthly} highlight={monthlyHighlight ?? weeklyHighlight} />
          ) : (
            <>
              <BestStartCard title="7-day best" start={weekly} highlight={weeklyHighlight} />
              <BestStartCard title="30-day best" start={monthly} highlight={monthlyHighlight} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function BestStartCard({ title, start, highlight, badge }: { title: string; start: StartSummary | null; highlight?: FeaturedStartHighlight | null; badge?: string }) {
  if (!start) {
    return (
      <div className="rounded border border-white/10 bg-[#101014] p-5">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">{title}</p>
        <p className="mt-3 text-sm text-zinc-400">Pending a completed start.</p>
      </div>
    );
  }

  return (
    <div className="rounded border border-white/10 bg-[#101014] p-5">
      <a href={startPath(start.id)} className="grid min-w-0 grid-cols-[66px_minmax(0,1fr)] items-center gap-2">
        <Headshot playerId={start.pitcher.mlbId} name={start.pitcher.name} team={start.pitcher.team} size="xl" decorative className="ml-1" />
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-300">{title}</p>
          {badge ? <p className="mt-1 inline-flex max-w-full rounded border border-amber-300/30 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-200">{badge}</p> : null}
          <h3 className="mt-1 font-serif text-3xl font-bold leading-tight text-zinc-50">{start.pitcher.name}</h3>
          <p className="mt-2 font-mono text-xs leading-5 text-zinc-400">{start.pitcher.team} vs {start.opponent} / {formatLongDate(start.date)}</p>
        </div>
      </a>
      <div className="mt-5 border-t border-white/10 pt-4">
        <p className="font-serif text-5xl font-bold leading-none text-amber-300">{start.gameScorePlus}</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">GS+</p>
      </div>
      <div className="mt-4">
        <ShareStartButton
          title={`${start.pitcher.name}: ${start.gameScorePlus} GS+`}
          text={`${start.pitcher.name} ${formatStartLine(start.line)} on Toe the Slab`}
          path={startPath(start.id)}
        />
        {highlight ? (
          <div className="mt-4">
            <FeaturedStartHighlightEmbed highlight={highlight} pitcherName={start.pitcher.name} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

async function resolveSummaryHighlight(start: StartSummary | null) {
  if (!start) return null;
  const detail = await getStartDetail(start.id);
  return resolveFeaturedStartHighlight(detail);
}

async function resolveSummaryHighlights(starts: StartSummary[]) {
  const entries = await Promise.all(starts.map(async (start) => {
    const highlight = await resolveSummaryHighlight(start);
    return [start.id, highlight] as const;
  }));
  return new Map<string, FeaturedStartHighlight | null>(entries);
}

async function getBestStartWindows(anchorDate: string) {
  const [weekly, monthly] = await Promise.all([getBestStartWindow(anchorDate, 7), getBestStartWindow(anchorDate, 30)]);
  return { weekly, monthly };
}

async function getBestStartWindow(anchorDate: string, days: number) {
  const dates = Array.from({ length: days }, (_, index) => addDays(anchorDate, -index));
  const slates = await Promise.all(dates.map((date) => getDailySlate({ window: "yesterday", date })));
  const starts = slates.flat().filter((start) => start.source?.line !== "fixture");
  return starts.sort((a, b) => b.gameScorePlus - a.gameScorePlus)[0] ?? null;
}

function formatLongDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function startWhiffRate(start: StartDetail) {
  const whiffs = start.pitchEvents.filter((pitch) => pitch.result === "swinging_strike").length;
  return start.pitchEvents.length ? (whiffs / start.pitchEvents.length) * 100 : null;
}

function startTopVelo(start: StartDetail) {
  return start.pitchEvents.length ? Math.max(...start.pitchEvents.map((pitch) => pitch.velocityMph)) : null;
}
