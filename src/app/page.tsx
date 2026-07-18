import { HomeDeferredSections } from "@/components/home-deferred-sections";
import { HomeLiveBoardProvider } from "@/components/home-live-board-provider";
import { HomeLiveTicker } from "@/components/home-live-ticker";
import { SlateCounts } from "@/components/slate-counts";
import { SiteHeader } from "@/components/site-header";
import type { Metadata } from "next";
import { getFormHome } from "@/lib/data/form-service";
import { getBestStartsHome } from "@/lib/data/home-best-starts-service";
import { readHomeGsPlusProofs, type HomeGsPlusProofs, type HomeGsPlusProofStart } from "@/lib/data/home-gs-plus-proof-service";
import { getRankedHome, type LiveLeaderboardEntry } from "@/lib/data/home-ranked-service";
import { getLiveScoreboard } from "@/lib/data/live-scoreboard-service";
import { getHomeSlateDate, getSlateStartProgress } from "@/lib/data/start-service";
import { getTonightMustWatch } from "@/lib/data/tonight-service";
import { getHomeSlatePhase, isHomeSlatePhaseExperimentEnabled } from "@/lib/home-slate-phase";
import { liveDateHref } from "@/lib/routes";
import { startMatchupLabel } from "@/lib/start-matchup-label";
import { jsonLdScript, websiteOpenGraph, largeImageTwitter } from "@/lib/seo";
import type { SlateProgressState } from "@/lib/slate-state";

export const revalidate = 60;

const homeTitle = "Toe the Slab: Every MLB start, ranked.";
const homeDescription = "Every MLB start ranked by GS+. Daily starting-pitcher rankings, rolling form, probable matchups, and the night's best pitching lines.";
const GS_PLUS_HERO_WHY_LINE = "Game Score, adjusted for park, opponent, and swing-and-miss, so the arms worth watching rise to the top.";
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

function WhyGsPlusBand({ proof }: { proof: HomeGsPlusProofs }) {
  const [contextWinner, contextRunnerUp] = proof.contextPair;
  return (
    <section className="border-y border-white/10 bg-[#0c0c10] px-4 py-10 sm:px-6 lg:px-8" data-responsive-check="home-gs-plus-differentiator-band" aria-labelledby="home-gs-plus-differentiator-kicker">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col justify-between gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end">
          <div>
            <p id="home-gs-plus-differentiator-kicker" className="font-mono text-xs uppercase tracking-[0.24em] text-zinc-500">
              WHY GS+
            </p>
            <h2 className="section-title mt-2 font-serif text-4xl font-bold text-zinc-50">Why GS+ is different</h2>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500" data-home-gs-plus-proof-source={proof.source}>
            {proof.source === "cron" ? "Real comparison, updated daily" : "Real comparison, frozen examples"}
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)_minmax(0,0.9fr)]" data-home-gs-plus-differentiator-cards data-home-gs-plus-proof-panels>
          <article className="rounded border border-amber-300/25 bg-[#101014] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.18)]" data-home-gs-plus-differentiator-card="1" data-home-gs-plus-proof-card="context">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-300">01 / Context proof</p>
                <h3 className="mt-2 font-serif text-xl font-bold leading-tight text-zinc-50" data-home-gs-plus-differentiator-title>{GS_PLUS_DIFFERENTIATORS[0].title}</h3>
              </div>
              <span className="rounded border border-amber-300/25 px-2 py-1 font-mono text-[10px] text-amber-200">2 starts</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-400" data-home-gs-plus-differentiator-body={GS_PLUS_DIFFERENTIATORS[0].body}>{GS_PLUS_DIFFERENTIATORS[0].body}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2" data-home-gs-plus-context-pair>
              <ContextProofStart start={contextWinner} emphasis />
              <ContextProofStart start={contextRunnerUp} />
            </div>
            <p className="mt-3 text-xs leading-5 text-zinc-500">Similar lines, different park and opponent context. The GS+ gap is {Math.abs(contextWinner.gsPlus - contextRunnerUp.gsPlus)} points.</p>
          </article>

          <article className="rounded border border-white/10 bg-[#141418] p-4" data-home-gs-plus-differentiator-card="2" data-home-gs-plus-proof-card="stuff">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#8FCBFF]">02 / Stuff proof</p>
            <h3 className="mt-2 font-serif text-xl font-bold leading-tight text-zinc-50" data-home-gs-plus-differentiator-title>{GS_PLUS_DIFFERENTIATORS[1].title}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400" data-home-gs-plus-differentiator-body={GS_PLUS_DIFFERENTIATORS[1].body}>{GS_PLUS_DIFFERENTIATORS[1].body}</p>
            <div className="mt-4 rounded border border-white/10 bg-black/20 p-3" data-home-gs-plus-stuff-proof={proof.stuff.start.id}>
              <a href={proof.stuff.start.href} className="font-semibold text-zinc-50 hover:text-amber-200">{proof.stuff.start.pitcherName}</a>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">{proof.stuff.start.line} · {proof.stuff.start.gsPlus} GS+</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <ProofMetric label="Whiff credit" value={proof.stuff.whiffValue} detail={proof.stuff.whiffDescription} />
                <ProofMetric label="Velo credit" value={proof.stuff.velocityValue} detail={proof.stuff.velocityDescription} />
              </div>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#8FCBFF]">Stuff added {formatSignedProofValue(proof.stuff.totalStuffValue)} GS+ pts</p>
            </div>
          </article>

          <article className="rounded border border-white/10 bg-[#101014] p-4" data-home-gs-plus-differentiator-card="3" data-home-gs-plus-proof-card="breakdown">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">03 / Verification</p>
            <h3 className="mt-2 font-serif text-xl font-bold leading-tight text-zinc-50" data-home-gs-plus-differentiator-title>{GS_PLUS_DIFFERENTIATORS[2].title}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400" data-home-gs-plus-differentiator-body={GS_PLUS_DIFFERENTIATORS[2].body}>
              Every score&apos;s <a href="/methodology" className="text-amber-300 underline-offset-4 hover:underline" data-home-gs-plus-methodology-link>full breakdown is public</a>, and settled scores never change.
            </p>
            <div className="mt-4 rounded border border-white/10 bg-black/20 p-3" data-home-gs-plus-freeze-proof={proof.breakdown.id}>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1 rounded border border-white/15 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-300" data-home-gs-plus-lock>
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3 fill-none stroke-current stroke-[1.8]">
                    <rect x="3.5" y="7" width="9" height="6" rx="1.25" />
                    <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" />
                  </svg>
                  Locked
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">Frozen at settle</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-300">{proof.breakdown.pitcherName}: {proof.breakdown.line}, {proof.breakdown.gsPlus} GS+.</p>
              <a href={proof.breakdown.href} className="mt-3 inline-flex min-h-9 items-center rounded border border-amber-300/30 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-300 hover:border-amber-300/60" data-home-gs-plus-breakdown-link>
                Open full breakdown
              </a>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function ContextProofStart({ start, emphasis = false }: { start: HomeGsPlusProofStart; emphasis?: boolean }) {
  return (
    <a href={start.href} className={`block rounded border p-3 transition hover:border-amber-300/50 ${emphasis ? "border-amber-300/35 bg-amber-300/[0.08]" : "border-white/10 bg-black/20"}`} data-home-gs-plus-context-start={start.id}>
      <p className="truncate font-semibold text-zinc-50">{start.pitcherName}</p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">{startMatchupLabel({ pitcher: { team: start.team }, opponent: start.opponent, side: start.side })}</p>
      <p className="mt-2 text-sm text-zinc-300">{start.line}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">Context</p>
          <p className="font-mono text-xs text-zinc-300">Park {formatSignedProofValue(start.parkValue)} · Opp {formatSignedProofValue(start.opponentValue)}</p>
        </div>
        <p className="font-serif text-4xl font-black leading-none text-amber-300">{start.gsPlus}</p>
      </div>
    </a>
  );
}

function ProofMetric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded border border-white/10 px-2 py-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p className="mt-1 font-serif text-2xl font-black text-zinc-50">{formatSignedProofValue(value)}</p>
      <p className="mt-1 text-[11px] leading-4 text-zinc-500">{detail}</p>
    </div>
  );
}

function formatSignedProofValue(value: number) {
  if (!Number.isFinite(value)) return "0.0";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
