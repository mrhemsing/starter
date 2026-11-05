import { Suspense } from "react";
import HomeLoading from "@/components/home-loading";
import { getSeasonState } from "@/lib/season-state";
import { OffseasonHome } from "@/components/offseason-home";
import { HomeDeferredSections } from "@/components/home-deferred-sections";
import { HomeLiveBoardProvider } from "@/components/home-live-board-provider";
import { HomeLiveTicker } from "@/components/home-live-ticker";
import { HomeLiveGemAlerts } from "@/components/home-live-gem-alerts";
import { SlateCounts } from "@/components/slate-counts";
import { SiteHeader } from "@/components/site-header";
import type { Metadata } from "next";
import Image from "next/image";
import { getFormHome } from "@/lib/data/form-service";
import { getBestStartsHome } from "@/lib/data/home-best-starts-service";
import { readHomeGsPlusProofs } from "@/lib/data/home-gs-plus-proof-service";
import { getRankedHome, type LiveLeaderboardEntry } from "@/lib/data/home-ranked-service";
import { getLiveScoreboard } from "@/lib/data/live-scoreboard-service";
import { getHomeSlateDate, getSlateStartProgress } from "@/lib/data/start-service";
import { getTonightMustWatch } from "@/lib/data/tonight-service";
import { getHomeSlatePhase, isHomeSlatePhaseExperimentEnabled } from "@/lib/home-slate-phase";
import { liveDateHref } from "@/lib/routes";
import { WhyGsPlusBand } from "@/components/why-gs-plus-band";
import { jsonLdScript, websiteOpenGraph, largeImageTwitter } from "@/lib/seo";
import type { SlateProgressState } from "@/lib/slate-state";

export const revalidate = false;
export const dynamic = "force-static";

const homeTitle = "Toe the Slab: Every MLB start, ranked.";
const homeDescription = "Every MLB start ranked by GS+. Daily starting-pitcher rankings, rolling form, probable matchups, and the night's best pitching lines.";
const GS_PLUS_HERO_WHY_LINE = "Game Score, adjusted for park, opponent, and swing-and-miss, so the arms worth watching rise to the top.";
export const metadata: Metadata = {
  title: { absolute: homeTitle },
  description: homeDescription,
  alternates: { canonical: "/" },
  openGraph: websiteOpenGraph(homeTitle, homeDescription, "/"),
  twitter: largeImageTwitter(homeTitle, homeDescription),
};

export default async function Home() {
  const state = await getSeasonState();
  if (state.status === "season_complete") return <OffseasonHome state={state} />;
  return <Suspense fallback={<HomeLoading />}><InSeasonHome /></Suspense>;
}

async function InSeasonHome() {
  const today = getHomeSlateDate();
  const tomorrow = addDays(today, 1);
  const todayWatchPromise = getTonightMustWatch({ date: today, window: 5 }).catch(() => null);
  const tomorrowWatchPromise = getTonightMustWatch({ date: tomorrow, window: 5 }).catch(() => null);
  const bestStartsPromise = getBestStartsHome().catch(() => null);
  const formHomePromise = getFormHome({ window: 5 }).catch(() => null);
  const homeTickerBoardPromise = getLiveScoreboard({ date: today }).catch(() => null);
  const gsPlusProofsPromise = readHomeGsPlusProofs();
  const [slateStatus, ranked, todayWatch, tomorrowWatch, bestStarts, formHome, homeTickerBoard, gsPlusProofs] = await Promise.all([
    getSlateStartProgress({ window: "today", date: today }),
    getRankedHome().catch(() => null),
    todayWatchPromise,
    tomorrowWatchPromise,
    bestStartsPromise,
    formHomePromise,
    homeTickerBoardPromise,
    gsPlusProofsPromise,
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
          <div className="absolute inset-x-0 top-0 h-[755px] overflow-hidden opacity-90 saturate-[0.92] sm:h-[647px] sm:opacity-80 lg:h-[590px]" aria-hidden="true" data-responsive-check="home-header-background">
            <Image
              src="/images/header-baseball-bg-mobile.jpg"
              alt=""
              fill
              priority
              sizes="(max-width: 639px) 100vw, 0px"
              className="translate-x-[8%] object-cover object-center sm:hidden"
            />
            <Image
              src="/images/header-baseball-bg-desktop.jpg"
              alt=""
              fill
              priority
              sizes="(min-width: 640px) 676px, 0px"
              className="hidden object-contain object-right sm:block"
            />
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,8,10,0.98)_0%,rgba(8,8,10,0.82)_42%,rgba(8,8,10,0.42)_74%,rgba(8,8,10,0.58)_100%),linear-gradient(180deg,rgba(8,8,10,0.78)_0%,rgba(8,8,10,0.26)_44%,#08080a_100%)]" aria-hidden="true" />
          <div className="relative z-10 mx-auto max-w-7xl">
            <SiteHeader active="home" today={today} rankedDate={rankedDate} />
            <HomeLiveGemAlerts />
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
          slateStatus={slateStatus}
          slatePhase={homeSlatePhase}
          slatePhaseExperiment={homeSlatePhaseExperiment}
          whyGsPlusBand={<WhyGsPlusBand proof={gsPlusProofs} />}
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
      className="mt-4 max-w-2xl rounded border border-white/10 bg-black/25 px-3 py-3 shadow-[0_16px_34px_rgba(0,0,0,0.2)] backdrop-blur-sm lg:max-w-none"
      data-responsive-check="home-hero-state-banner"
      data-home-hero-state-banner={slateStatus.state}
    >
      <SlateCounts initialState={slateStatus} variant="home" className="mb-0" />
      {hasLiveLeaders ? (
        <div className="mt-3 flex max-w-full items-center gap-2 overflow-x-auto border-t border-white/10 pt-3 lg:flex-wrap lg:overflow-x-visible" data-home-hero-live-leaders-strip>
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

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
