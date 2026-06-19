import { HomeDeferredSections } from "@/components/home-deferred-sections";
import { HomeSlateStatusLine } from "@/components/home-slate-status-line";
import { SiteHeader } from "@/components/site-header";
import type { Metadata } from "next";
import { getPitchingDuels } from "@/lib/data/duels-service";
import { getBestStartsHome } from "@/lib/data/home-best-starts-service";
import { getRankedHome } from "@/lib/data/home-ranked-service";
import { getHomeSlateDate, getHomeSlateNavigation, getRankedSlateCompletionState, getSlateSchedule } from "@/lib/data/start-service";
import { getTonightMustWatch } from "@/lib/data/tonight-service";
import { jsonLdScript, websiteOpenGraph, largeImageTwitter } from "@/lib/seo";
import { getSlateProgressState } from "@/lib/slate-state";

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
  const todayWatchPromise = getTonightMustWatch({ date: today, window: 5 }).catch(() => null);
  const tomorrowWatchPromise = getTonightMustWatch({ date: tomorrow, window: 5 }).catch(() => null);
  const duelsPromise = todayWatchPromise
    .then((watch) => getPitchingDuels(watch && watch.games.length > 0 ? today : tomorrow, "upcoming"))
    .catch(() => null);
  const bestStartsPromise = getBestStartsHome().catch(() => null);
  const [todaySchedule, todayCompletion, ranked, todayWatch, tomorrowWatch, duels, bestStarts] = await Promise.all([
    getSlateSchedule({ window: "today", date: today }),
    getRankedSlateCompletionState(today, today),
    getRankedHome().catch(() => null),
    todayWatchPromise,
    tomorrowWatchPromise,
    duelsPromise,
    bestStartsPromise,
  ]);
  const rankedDate = todayCompletion.finalGames > 0 ? today : yesterday;
  const slateStatus = getSlateProgressState(todaySchedule);
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
          <SiteHeader active="home" today={today} rankedDate={rankedDate} />

          <div className="grid gap-5 py-4 lg:pb-0 lg:pt-5" data-responsive-check="home-masthead">
            <div className="min-w-0 lg:max-w-3xl">
              <HomeSlateStatusLine initialState={slateStatus} />
              <h1 className="section-title font-serif text-[2.4rem] font-black leading-none text-zinc-50 sm:text-6xl">
                <span className="block">Every MLB start,</span>
                <span className="block">ranked.</span>
              </h1>
              <p className="blurb mt-3 max-w-2xl leading-5 text-zinc-400 sm:text-sm sm:leading-6 lg:mb-[10px]">
                <span className="block whitespace-nowrap text-[11px] sm:inline sm:whitespace-normal sm:text-sm">GS+ scores a single start 0-100, league average ~50.</span>
                <a href="/methodology" className="mt-1 block font-mono text-xs uppercase tracking-[0.12em] text-amber-300 underline-offset-4 hover:underline sm:ml-[10px] sm:mt-0 sm:inline">
                  Methodology
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      <HomeDeferredSections
        today={today}
        tomorrow={tomorrow}
        initialData={{
          ranked,
          todayWatch,
          tomorrowWatch,
          duels,
          bestStarts,
        }}
      />
    </main>
  );
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
