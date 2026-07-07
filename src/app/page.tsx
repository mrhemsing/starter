import { HomeDeferredSections } from "@/components/home-deferred-sections";
import { HomeLiveBoardProvider } from "@/components/home-live-board-provider";
import { HomeLiveTicker } from "@/components/home-live-ticker";
import { SlateCounts } from "@/components/slate-counts";
import { SiteHeader } from "@/components/site-header";
import type { Metadata } from "next";
import { getPitchingDuels } from "@/lib/data/duels-service";
import { getFormHome } from "@/lib/data/form-service";
import { getBestStartsHome } from "@/lib/data/home-best-starts-service";
import { getRankedHome } from "@/lib/data/home-ranked-service";
import { getLiveScoreboard } from "@/lib/data/live-scoreboard-service";
import { getHomeSlateDate, getSlateStartProgress } from "@/lib/data/start-service";
import { getTonightMustWatch } from "@/lib/data/tonight-service";
import { getHomeSlatePhase, isHomeSlatePhaseExperimentEnabled } from "@/lib/home-slate-phase";
import { jsonLdScript, websiteOpenGraph, largeImageTwitter } from "@/lib/seo";
import type { TonightResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

const homeTitle = "Toe the Slab: Every MLB start, ranked.";
const homeDescription = "Every MLB start ranked by GS+. Daily starting-pitcher rankings, rolling form, probable matchups, and the night's best pitching lines.";
const GS_PLUS_HERO_WHY_LINE = "It's Game Score with the context added back in: park, opponent, and swing-and-miss, so the games worth watching rise to the top.";
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
  const duelsPromise = todayWatchPromise
    .then((watch) => getPitchingDuels(hasPregameWatchGames(watch) ? today : tomorrow, "upcoming"))
    .catch(() => null);
  const bestStartsPromise = getBestStartsHome().catch(() => null);
  const formHomePromise = getFormHome({ window: 5 }).catch(() => null);
  const homeTickerBoardPromise = getLiveScoreboard({ date: today }).catch(() => null);
  const [slateStatus, ranked, todayWatch, tomorrowWatch, duels, bestStarts, formHome, homeTickerBoard] = await Promise.all([
    getSlateStartProgress({ window: "today", date: today }),
    getRankedHome().catch(() => null),
    todayWatchPromise,
    tomorrowWatchPromise,
    duelsPromise,
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
              <div className="min-w-0 lg:max-w-3xl">
                <SlateCounts initialState={slateStatus} variant="home" />
                <h1 className="section-title font-serif text-[2.4rem] font-black leading-none text-zinc-50 sm:text-6xl">
                  <span className="block">Every MLB start,</span>
                  <span className="block">ranked.</span>
                </h1>
                <p className="mt-3 max-w-2xl text-xs leading-5 text-zinc-400 sm:text-[13px] sm:leading-6 lg:mb-[10px]" data-home-hero-why-line>
                  {GS_PLUS_HERO_WHY_LINE}
                </p>
                <a href="/methodology" className="mt-2 block w-fit font-mono text-xs uppercase tracking-[0.12em] text-amber-300 underline-offset-4 hover:underline">
                  Methodology
                </a>
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
            duels,
            bestStarts,
            formHome,
          }}
        />
      </HomeLiveBoardProvider>
    </main>
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

function hasPregameWatchGames(watch: TonightResponse | null) {
  return watch?.games.some((game) => game.status === "pregame") ?? false;
}
