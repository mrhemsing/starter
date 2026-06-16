import { FirstPitchCountdownEyebrow } from "@/components/first-pitch-countdown-eyebrow";
import { HomeDeferredSections } from "@/components/home-deferred-sections";
import { SiteNav } from "@/components/site-nav";
import type { Metadata } from "next";
import { getHomeSlateDate, getHomeSlateNavigation, getRankedSlateCompletionState, getSlateSchedule } from "@/lib/data/start-service";
import { upcomingDateHref } from "@/lib/routes";
import { jsonLdScript, websiteOpenGraph, largeImageTwitter } from "@/lib/seo";
import type { MlbSchedule } from "@/lib/types";

export const revalidate = 60;

const homeTitle = "Toe the Slab: Every MLB start, ranked.";
const homeDescription = "Every MLB start ranked by GS+. Daily starting-pitcher rankings, rolling form, probable matchups, and the night's best pitching lines.";

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
  const [todaySchedule, tomorrowSchedule, todayCompletion] = await Promise.all([
    getSlateSchedule({ window: "today", date: today }),
    getSlateSchedule({ window: "tomorrow", date: tomorrow }),
    getRankedSlateCompletionState(today, today),
  ]);
  const gamesToday = todaySchedule.games.length;
  const liveGamesToday = todaySchedule.games.filter((game) => normalizeScheduleStatus(game) === "live").length;
  const startedGamesToday = todayCompletion.finalGames + liveGamesToday;
  const rankedDate = todayCompletion.finalGames > 0 ? today : yesterday;
  const firstPitchSchedule = hasActiveScheduleGames(todaySchedule) ? todaySchedule : tomorrowSchedule;
  const firstPitchCountdown = getFirstPitchCountdown(firstPitchSchedule, upcomingDateHref(firstPitchSchedule.date));
  const slateStatus = todayCompletion.finalGames > 0
    ? {
        lead: `Today · ${formatLongDate(today)}`,
        detail: `${todayCompletion.finalGames} ${todayCompletion.finalGames === 1 ? "GAME" : "GAMES"} FINAL`,
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
              <p className="font-mono text-2xl uppercase tracking-[0.18em] text-amber-300">Toe the Slab</p>
            </div>
            <SiteNav active="home" today={today} rankedDate={rankedDate} />
          </header>

          <div className="grid gap-5 py-4 lg:py-5" data-responsive-check="home-masthead">
            <div className="min-w-0 lg:max-w-3xl">
              <SlateStatusPill lead={slateStatus.lead} detail={slateStatus.detail} />
              {firstPitchCountdown ? (
                <FirstPitchCountdownEyebrow
                  href={firstPitchCountdown.href}
                  startsAt={firstPitchCountdown.startsAt}
                  gameCount={firstPitchCountdown.gameCount}
                  initialTimeLabel={firstPitchCountdown.timeLabel}
                />
              ) : null}
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
          </div>
        </div>
      </section>

      <HomeDeferredSections today={today} tomorrow={tomorrow} />
    </main>
  );
}

function SlateStatusPill({ lead, detail }: { lead: string; detail: string }) {
  return (
    <p className="block max-w-full whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-amber-200 sm:text-xs sm:tracking-[0.18em]">
      <span>{lead}</span>{" "}
      <span className="mx-1.5">·</span>
      {" "}
      <span>{detail}</span>
    </p>
  );
}

type FirstPitchCountdown = {
  href: string;
  startsAt: string;
  gameCount: number;
  timeLabel: string;
};

function getFirstPitchCountdown(schedule: MlbSchedule, href: string, now = new Date()): FirstPitchCountdown | null {
  const pendingFirstPitches = schedule.games
    .filter((game) => normalizeScheduleStatus(game) === "pregame")
    .map((game) => ({ startsAt: game.gameDate, startsAtMs: new Date(game.gameDate).getTime() }))
    .filter((game) => Number.isFinite(game.startsAtMs) && game.startsAtMs > now.getTime())
    .sort((a, b) => a.startsAtMs - b.startsAtMs);

  const first = pendingFirstPitches[0];
  if (!first) return null;

  const firstPitchMinute = Math.floor(first.startsAtMs / 60000);
  const gameCount = pendingFirstPitches.filter((game) => Math.floor(game.startsAtMs / 60000) === firstPitchMinute).length;

  return {
    href,
    startsAt: first.startsAt,
    gameCount,
    timeLabel: formatCountdownDuration(first.startsAtMs - now.getTime()),
  };
}

function formatCountdownDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}H ${minutes}M ${seconds}S`;
}

function hasActiveScheduleGames(schedule: MlbSchedule) {
  return schedule.games.some((game) => {
    const status = normalizeScheduleStatus(game);
    return status === "pregame" || status === "live";
  });
}

function normalizeScheduleStatus(game: MlbSchedule["games"][number]) {
  const status = `${game.status} ${game.detailedState}`.toLowerCase();
  if (/\b(postponed|cancelled|canceled)\b/.test(status)) return "ppd";
  if (/\b(final|game over|completed early)\b/.test(status)) return "final";
  if (/\b(live|in progress|manager challenge|delayed|suspended)\b/.test(status)) return "live";
  return "pregame";
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
