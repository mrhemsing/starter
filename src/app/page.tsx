import { HomeDeferredSections } from "@/components/home-deferred-sections";
import { HomeLiveBoardProvider } from "@/components/home-live-board-provider";
import { HomeLiveTicker } from "@/components/home-live-ticker";
import { SlateCounts } from "@/components/slate-counts";
import { SiteHeader } from "@/components/site-header";
import type { Metadata } from "next";
import { getFormHome } from "@/lib/data/form-service";
import { getBestStartsHome } from "@/lib/data/home-best-starts-service";
import { getRankedHome, type LiveLeaderboardEntry } from "@/lib/data/home-ranked-service";
import { getLiveScoreboard } from "@/lib/data/live-scoreboard-service";
import { getHomeSlateDate, getSlateStartProgress } from "@/lib/data/start-service";
import { getTonightMustWatch } from "@/lib/data/tonight-service";
import { getHomeSlatePhase, isHomeSlatePhaseExperimentEnabled } from "@/lib/home-slate-phase";
import { liveDateHref } from "@/lib/routes";
import { jsonLdScript, websiteOpenGraph, largeImageTwitter } from "@/lib/seo";
import type { SlateProgressState } from "@/lib/slate-state";

export const dynamic = "force-dynamic";

const homeTitle = "Toe the Slab: Every MLB start, ranked.";
const homeDescription = "Every MLB start ranked by GS+. Daily starting-pitcher rankings, rolling form, probable matchups, and the night's best pitching lines.";
const GS_PLUS_HERO_WHY_LINE = "Game Score, adjusted for park, opponent, and swing-and-miss, so the best matchups rise to the top.";
const GS_PLUS_DIFFERENTIATORS = [
  {
    title: "Context, not just the line.",
    body: "Seven scoreless against the Yankees in the Bronx is not seven against the A's in Sacramento. GS+ knows the difference.",
  },
  {
    title: "Stuff counts.",
    body: "Velocity and swing-and-miss factor in, so the electric starts you would actually want to watch grade like it.",
  },
  {
    title: "Show your work.",
    body: "Every score's full breakdown is public, and settled scores never change.",
  },
] as const;

export const metadata: Metadata = {
  title: { absolute: homeTitle },
  description: homeDescription,
  alternates: { canonical: "/" },
  openGraph: websiteOpenGraph(homeTitle, homeDescription, "/"),
  twitter: largeImageTwitter(homeTitle, homeDescription),
};

export default async function Home() {
  const today = getHomeSlateDate();
  const tomorrow = addDays(today, 1);
  const todayWatchPromise = getTonightMustWatch({ date: today, window: 5 }).catch(() => null);
  const tomorrowWatchPromise = getTonightMustWatch({ date: tomorrow, window: 5 }).catch(() => null);
  const bestStartsPromise = getBestStartsHome().catch(() => null);
  const formHomePromise = getFormHome({ window: 5 }).catch(() => null);
  const homeTickerBoardPromise = getLiveScoreboard({ date: today }).catch(() => null);
  const [slateStatus, ranked, todayWatch, tomorrowWatch, bestStarts, formHome, homeTickerBoard] = await Promise.all([
    getSlateStartProgress({ window: "today", date: today }),
    getRankedHome().catch(() => null),
    todayWatchPromise,
    tomorrowWatchPromise,
    bestStartsPromise,
    formHomePromise,
    homeTickerBoardPromise,
  ]);
  const rankedDate = today;
  const homeSlatePhaseExperiment = isHomeSlatePhaseExperimentEnabled();
  const homeSlatePhase = getHomeSlatePhase({ slateProgress: slateStatus, ranked });
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
      <HomeLiveBoardProvider initialBoard={homeTickerBoard} today={today}>
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
            <SiteHeader active="home" today={today} rankedDate={rankedDate} />
            <HomeLiveTicker />

            <div className="grid gap-5 py-4 lg:pb-0 lg:pt-5" data-responsive-check="home-masthead">
              <div className="min-w-0 lg:max-w-none">
                <h1 className="section-title font-serif text-[2.4rem] font-black leading-none text-zinc-50 sm:text-6xl">
                  <span className="block lg:inline">Every MLB start,</span>
                  {" "}
                  <span className="block lg:inline">ranked.</span>
                </h1>
                <p className="mt-3 max-w-2xl text-[15px] leading-6 text-zinc-400 lg:mb-[10px] lg:max-w-none" data-home-hero-why-line>
                  {GS_PLUS_HERO_WHY_LINE}
                </p>
                <a href="/methodology" className="mt-2 block w-fit font-mono text-xs uppercase tracking-[0.12em] text-amber-300 underline-offset-4 hover:underline">
                  Methodology
                </a>
                <HomeHeroStateBanner slateStatus={slateStatus} liveLeaderboard={ranked?.liveLeaderboard ?? null} />
              </div>
            </div>
          </div>
        </section>

        <HomeDeferredSections
          today={today}
          tomorrow={tomorrow}
          slatePhase={homeSlatePhase}
          slatePhaseExperiment={homeSlatePhaseExperiment}
          whyGsPlusBand={<WhyGsPlusBand />}
          initialData={{
            ranked,
            todayWatch,
            tomorrowWatch,
            bestStarts,
            formHome,
          }}
        />
      </HomeLiveBoardProvider>
    </main>
  );
}

function HomeHeroStateBanner({ slateStatus, liveLeaderboard }: { slateStatus: SlateProgressState; liveLeaderboard: LiveLeaderboardEntry[] | null }) {
  const liveHref = liveDateHref(slateStatus.date);
  const hasLiveLeaders = Boolean(liveLeaderboard?.length);

  return (
    <div
      className="mt-4 max-w-2xl rounded border border-white/10 bg-black/25 px-3 py-3 shadow-[0_16px_34px_rgba(0,0,0,0.2)] backdrop-blur-sm"
      data-responsive-check="home-hero-state-banner"
      data-home-hero-state-banner={slateStatus.state}
    >
      <SlateCounts initialState={slateStatus} variant="home" className="mb-0" />
      {hasLiveLeaders ? (
        <div className="mt-3 flex max-w-full items-center gap-2 overflow-x-auto border-t border-white/10 pt-3" data-home-hero-live-leaders-strip>
          <p className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-300">Live leaders</p>
          {liveLeaderboard?.slice(0, 3).map((entry) => (
            <a key={entry.id} href={entry.href} className="flex shrink-0 items-center gap-2 rounded border border-white/10 bg-white/[0.04] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-zinc-300 transition hover:border-amber-300/35 hover:text-amber-200">
              <span className="font-serif text-base normal-case tracking-normal text-zinc-50">{entry.pitcherLastName}</span>
              <span className="text-[#FF7A3D]">Live {entry.score.toFixed(1)}</span>
            </a>
          ))}
          <a href={liveHref} className="shrink-0 rounded border border-amber-300/25 bg-amber-300/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-amber-300 transition hover:border-amber-300/50 hover:text-amber-200">
            Full live results
          </a>
        </div>
      ) : null}
    </div>
  );
}

function WhyGsPlusBand() {
  return (
    <section className="border-y border-white/10 bg-[#0c0c10] px-4 py-5 sm:px-6 lg:px-8" data-responsive-check="home-gs-plus-differentiator-band" aria-labelledby="home-gs-plus-differentiator-kicker">
      <div className="mx-auto max-w-7xl">
        <p id="home-gs-plus-differentiator-kicker" className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
          WHY GS+
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3" data-home-gs-plus-differentiator-cards>
          {GS_PLUS_DIFFERENTIATORS.map((card, index) => (
            <article key={card.title} className="rounded-lg border border-white/10 bg-[#101014] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.18)]" data-home-gs-plus-differentiator-card={String(index + 1)}>
              <h2 className="font-serif text-lg font-bold leading-tight text-zinc-50" data-home-gs-plus-differentiator-title>{card.title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400" data-home-gs-plus-differentiator-body={card.body}>
                {index === 2 ? (
                  <>
                    Every score&apos;s <a href="/methodology" className="text-amber-300 underline-offset-4 hover:underline" data-home-gs-plus-methodology-link>full breakdown is public</a>, and settled scores never change.
                  </>
                ) : card.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
