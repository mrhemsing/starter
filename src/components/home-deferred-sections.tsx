"use client";

import { track } from "@vercel/analytics";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { DecisionChip } from "@/components/decision-chip";
import { FeaturedStartHighlightEmbed } from "@/components/featured-start-highlight";
import { RawGsPlusLine } from "@/components/gs-plus-score";
import { HeatCheckHero } from "@/components/heat-check-hero";
import { Headshot } from "@/components/headshot";
import { useHomeLiveBoard } from "@/components/home-live-board-provider";
import { RankedStartsRecap } from "@/components/ranked-starts-recap";
import { RecentGemVeloChart } from "@/components/recent-gem-velo-chart";
import { TonightsMustWatch } from "@/components/tonights-must-watch";
import { TopPerformerCard } from "@/components/top-performer-card";
import { MetaLine, StartLineText } from "@/components/wrap-safe-text";
import { liveDateHref, pitcherHref, sourceParams, startHref, upcomingDateHref } from "@/lib/routes";
import { getHomeModuleOrder, type HomeModuleKey, type HomeSlatePhase, type HomeSlatePhaseVariant } from "@/lib/home-slate-phase";
import { isRankedRegularStart } from "@/lib/start-classification";
import { startMatchupLabel } from "@/lib/start-matchup-label";
import { slateTimeWord, slateTimeWordTitle } from "@/lib/time-words";
import type { BestStartsHomeResponse, HomeSeasonTopStart } from "@/lib/data/home-best-starts-service";
import type { StartVeloByInning } from "@/lib/data/start-velo-by-inning";
import type { LiveScoreboard, LiveScoreboardRow } from "@/lib/data/live-scoreboard-service";
import type { RankedHomeResponse } from "@/lib/data/home-ranked-service";
import { formatStartLine } from "@/lib/format";
import { resolveHomeLiveLeaderRow } from "@/lib/home-live-leader";
import type { SlateProgressState } from "@/lib/slate-state";
import type { FeaturedStartHighlight, FormHomeResponse, FormTier, StartNarrativeNotables, StartSummary, TonightResponse } from "@/lib/types";

const HOME_SCROLL_DEPTH_THRESHOLDS = [25, 50, 75, 100] as const;

export type HomeDeferredInitialData = {
  todayWatch?: TonightResponse | null;
  tomorrowWatch?: TonightResponse | null;
  ranked?: RankedHomeResponse | null;
  bestStarts?: BestStartsHomeResponse | null;
  formHome?: FormHomeResponse | null;
};

export function HomeDeferredSections({
  today,
  tomorrow,
  slateStatus,
  slatePhase,
  slatePhaseExperiment = false,
  whyGsPlusBand = null,
  initialData,
}: {
  today: string;
  tomorrow: string;
  slateStatus: SlateProgressState;
  slatePhase: HomeSlatePhase;
  slatePhaseExperiment?: boolean;
  whyGsPlusBand?: ReactNode;
  initialData?: HomeDeferredInitialData;
}) {
  const [todayWatch, setTodayWatch] = useState<TonightResponse | null>(initialData?.todayWatch ?? null);
  const [tomorrowWatch, setTomorrowWatch] = useState<TonightResponse | null>(initialData?.tomorrowWatch ?? null);
  const [formHome, setFormHome] = useState<FormHomeResponse | null>(initialData?.formHome ?? null);
  const [ranked, setRanked] = useState<RankedHomeResponse | null>(initialData?.ranked ?? null);
  const [bestStarts, setBestStarts] = useState<BestStartsHomeResponse | null>(initialData?.bestStarts ?? null);
  const bestStartsRefreshAttemptedRef = useRef(false);
  const slatePhaseVariant: HomeSlatePhaseVariant = slatePhaseExperiment ? "phase-aware" : "control";
  const scrollDepthsTrackedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const setIfLive = <T,>(setter: (value: T) => void) => (value: T) => {
      if (!cancelled) setter(value);
    };

    if (!todayWatch) {
      fetchJson<TonightResponse>(`/api/tonight?date=${today}&window=5`).then(setIfLive(setTodayWatch)).catch(() => undefined);
    }

    if (!tomorrowWatch) {
      fetchJson<TonightResponse>(`/api/tonight?date=${tomorrow}&window=5`).then(setIfLive(setTomorrowWatch)).catch(() => undefined);
    }

    if (!formHome) {
      fetchJson<FormHomeResponse>("/api/form/home?window=5").then(setIfLive(setFormHome)).catch(() => undefined);
    }
    if (!ranked) {
      fetchJson<RankedHomeResponse>("/api/home/ranked").then(setIfLive(setRanked)).catch(() => undefined);
    }
    if ((!bestStarts || hasMissingBestStartHighlight(bestStarts)) && !bestStartsRefreshAttemptedRef.current) {
      bestStartsRefreshAttemptedRef.current = true;
      fetchJson<BestStartsHomeResponse>("/api/home/best-starts").then(setIfLive(setBestStarts)).catch(() => undefined);
    }

    return () => {
      cancelled = true;
    };
  }, [bestStarts, formHome, ranked, today, todayWatch, tomorrow, tomorrowWatch]);

  const activeTodayWatch = filterHomeMustWatchGames(todayWatch);
  const activeTomorrowWatch = filterHomeMustWatchGames(tomorrowWatch);
  const watch = activeTodayWatch?.games.length ? activeTodayWatch : activeTomorrowWatch;
  const watchDate = resolveHomeMustWatchDate(watch, activeTodayWatch?.games.length ? today : tomorrow);
  const watchWord = watch ? slateTimeWord({ date: watchDate }, { today }) : "today";
  const watchEyebrow = watch ? slateTimeWordTitle({ date: watchDate }, { today }) : "Today";
  const topMatchupsTitle = `${watchEyebrow}'s Top Matchups`;

  useEffect(() => {
    if (!slatePhaseExperiment) return;

    track("home_slate_phase_view", { phase: slatePhase, variant: slatePhaseVariant });

    const handleScroll = () => {
      const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const depth = Math.min(100, Math.round((window.scrollY / scrollable) * 100));
      const threshold = HOME_SCROLL_DEPTH_THRESHOLDS.find((candidate) => depth >= candidate && !scrollDepthsTrackedRef.current.has(candidate));
      if (!threshold) return;
      scrollDepthsTrackedRef.current.add(threshold);
      track("home_slate_phase_scroll_depth", { phase: slatePhase, variant: slatePhaseVariant, depth: threshold });
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [slatePhase, slatePhaseExperiment, slatePhaseVariant]);

  const trackModuleClick = (module: HomeModuleKey) => {
    if (!slatePhaseExperiment) return;
    track("home_slate_phase_module_click", { phase: slatePhase, variant: slatePhaseVariant, module });
  };

  if (slatePhaseExperiment) {
    const modules: Record<HomeModuleKey, ReactNode> = {
      spotlight:
        ranked === null ? (
          null
        ) : ranked.topPerformer ? (
          <HomeTopPerformerIsland key={`${ranked.topPerformer.start.id}:${ranked.topPerformer.status}`} topPerformer={ranked.topPerformer} />
        ) : shouldShowHomeAllStarBreakSpotlight(slateStatus) ? (
          <HomeAllStarBreakIsland date={slateStatus.date} />
        ) : null,
      watch: watch ? (
          <TonightsMustWatch
            tonight={watch}
            fullSlateHref={upcomingDateHref(watchDate)}
            fullSlateLabel="See full slate"
            eyebrow={watchEyebrow}
            title={topMatchupsTitle}
            rankLabel={watchWord}
            previewLimit={3}
            showHookSpine={shouldShowHomeHookSpine(ranked, watchDate)}
            layout="top-matchups"
          />
      ) : null,
      heat: formHome ? <HeatCheckHero home={formHome} /> : null,
      ranked: shouldShowHomeRankedRecap(ranked) ? <RankedStartsRecap date={ranked.date} label={ranked.label} starts={ranked.starts} highlights={new Map()} compact={slatePhase === "PREGAME"} /> : null,
      best: bestStarts ? (
        <BestStartsLite
          weekly={bestStarts.weekly}
          monthly={bestStarts.monthly}
          monthlyRunnerUp={bestStarts.monthlyRunnerUp}
          weeklyHighlight={bestStarts.weeklyHighlight}
          monthlyHighlight={bestStarts.monthlyHighlight}
          monthlyRunnerUpHighlight={bestStarts.monthlyRunnerUpHighlight}
          weeklyVeloByInning={bestStarts.weeklyVeloByInning}
          monthlyVeloByInning={bestStarts.monthlyVeloByInning}
          monthlyRunnerUpVeloByInning={bestStarts.monthlyRunnerUpVeloByInning}
          seasonTopStarts={bestStarts.seasonTopStarts}
        />
      ) : null,
    };

    return (
      <div data-home-slate-phase={slatePhase} data-home-slate-phase-variant={slatePhaseVariant} data-home-module-order={getHomeModuleOrder(slatePhase, slatePhaseVariant).join(",")}>
        {getHomeModuleOrder(slatePhase, slatePhaseVariant).map((module) => (
          <div key={module} data-home-module={module} onClickCapture={() => trackModuleClick(module)}>
            {modules[module]}
            {module === "watch" ? whyGsPlusBand : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {ranked === null ? (
        null
      ) : ranked.topPerformer ? (
        <HomeTopPerformerIsland key={`${ranked.topPerformer.start.id}:${ranked.topPerformer.status}`} topPerformer={ranked.topPerformer} />
      ) : shouldShowHomeAllStarBreakSpotlight(slateStatus) ? (
        <HomeAllStarBreakIsland date={slateStatus.date} />
      ) : null}

      {watch ? (
        <TonightsMustWatch
          tonight={watch}
          fullSlateHref={upcomingDateHref(watchDate)}
          fullSlateLabel="See full slate"
          eyebrow={watchEyebrow}
          title={topMatchupsTitle}
          rankLabel={watchWord}
          previewLimit={3}
          showHookSpine={shouldShowHomeHookSpine(ranked, watchDate)}
          layout="top-matchups"
        />
      ) : null}

      {whyGsPlusBand}

      {formHome ? <HeatCheckHero home={formHome} /> : null}
      {shouldShowHomeRankedRecap(ranked) ? <RankedStartsRecap date={ranked.date} label={ranked.label} starts={ranked.starts} highlights={new Map()} /> : null}
      {bestStarts ? (
        <BestStartsLite
          weekly={bestStarts.weekly}
          monthly={bestStarts.monthly}
          monthlyRunnerUp={bestStarts.monthlyRunnerUp}
          weeklyHighlight={bestStarts.weeklyHighlight}
          monthlyHighlight={bestStarts.monthlyHighlight}
          monthlyRunnerUpHighlight={bestStarts.monthlyRunnerUpHighlight}
          weeklyVeloByInning={bestStarts.weeklyVeloByInning}
          monthlyVeloByInning={bestStarts.monthlyVeloByInning}
          monthlyRunnerUpVeloByInning={bestStarts.monthlyRunnerUpVeloByInning}
          seasonTopStarts={bestStarts.seasonTopStarts}
        />
      ) : null}
    </>
  );
}

type HomeTopPerformer = NonNullable<RankedHomeResponse["topPerformer"]>;
type HomeTopPerformerView = {
  startId: string;
  href: string;
  pitcherHref: string;
  pitcherName: string;
  team: string;
  opponent: string;
  side?: "home" | "away" | null;
  dateLabel: string;
  score: number;
  line: HomeTopPerformer["start"]["line"];
  narrativeNotables?: StartNarrativeNotables;
  recap: string | null;
  rank: number;
  slateCount: number;
  image: HomeTopPerformer["image"];
  highlight: HomeTopPerformer["highlight"];
  status: HomeTopPerformer["status"];
  scoreStatusLabel: "PROV" | null;
  whiffRate: number | null;
  topVelo: number | null;
  veloSparkline: number[];
};

function HomeTopPerformerIsland({ topPerformer }: { topPerformer: HomeTopPerformer }) {
  const { board, shouldPoll } = useHomeLiveBoard();
  const initialView = homeTopPerformerViewFromPayload(topPerformer);
  const viewRef = useRef<HomeTopPerformerView>(initialView);
  const [view, setView] = useState<HomeTopPerformerView>(initialView);
  const shouldPollLiveLeader = topPerformer.status === "live" && shouldPoll;

  useEffect(() => {
    let cancelled = false;
    const syncLiveLeader = async () => {
      if (topPerformer.status !== "live" || !board) return;
      const leader = resolveHomeLiveLeaderRow(board);
      if (leader) {
        const needsPhotoRefresh = leader.startId === viewRef.current.startId && isPlaceholderTopPerformerImage(viewRef.current.image);
        const rankedSnapshot = leader.startId !== viewRef.current.startId || needsPhotoRefresh ? await resolveRankedHomeTopPerformer(leader.startId) : null;
        if (cancelled) return;
        const next = homeTopPerformerViewFromLiveRow(viewRef.current, leader, board, topPerformer.dateLabel, rankedSnapshot);
        viewRef.current = next;
        setView(next);
      }
    };

    syncLiveLeader().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [board, topPerformer.dateLabel, topPerformer.status]);

  return (
    <section className="bg-[#08080a] px-4 pb-6 sm:px-6 lg:px-8" data-home-live-leader-island={shouldPollLiveLeader ? "polling" : "static"}>
      <div className="mx-auto max-w-7xl">
        <TopPerformerCard
          href={view.href}
          pitcherHref={view.pitcherHref}
          pitcherName={view.pitcherName}
          team={view.team}
          opponent={view.opponent}
          side={view.side}
          dateLabel={view.dateLabel}
          score={view.score}
          line={view.line}
          recap={view.recap}
          rank={view.rank}
          slateCount={view.slateCount}
          image={view.image}
          highlight={view.highlight}
          status={view.status}
          scoreStatusLabel={view.scoreStatusLabel}
          whiffRate={view.whiffRate}
          topVelo={view.topVelo}
          veloSparkline={view.veloSparkline}
        />
      </div>
    </section>
  );
}

function HomeAllStarBreakIsland({ date }: { date: string }) {
  return (
    <section className="bg-[#08080a] px-4 pb-6 sm:px-6 lg:px-8" data-home-all-star-break-island="true">
      <div className="mx-auto max-w-7xl">
        <article className="relative overflow-hidden rounded border border-[#173B8F]/70 bg-[#050506] text-[#F5F2EA] shadow-[0_18px_44px_rgba(0,0,0,0.22)]" data-responsive-check="home-all-star-break-spotlight" data-home-all-star-break-date={date}>
          <div className="grid lg:min-h-[500px] lg:grid-cols-[42%_58%]">
            <div className="relative z-10 order-2 flex flex-col justify-between gap-5 border-t border-[#173B8F]/70 bg-[#08080a] p-4 sm:p-5 lg:order-1 lg:border-r lg:border-t-0 lg:p-7">
              <div>
                <p className="font-mono text-[10px] uppercase leading-[1.25] tracking-[0.22em] text-[#F04A4D]">All-Star break</p>
                <h2 className="mt-3 max-w-[12ch] font-serif text-4xl font-black leading-[0.92] text-zinc-50 sm:text-5xl lg:text-6xl">
                  No games today.
                </h2>
                <p className="mt-4 max-w-md text-sm leading-6 text-zinc-300">
                  League is on the All-Star break. The live GS+ leader slot will return when regular-season starters are back on the slab.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded border border-white/10 bg-black/25 p-3 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">
                <div>
                  <p className="text-zinc-500">Live</p>
                  <p className="mt-1 text-2xl font-black text-zinc-50">0</p>
                </div>
                <div>
                  <p className="text-zinc-500">Scheduled</p>
                  <p className="mt-1 text-2xl font-black text-zinc-50">0</p>
                </div>
              </div>
              <Link
                href={liveDateHref(date)}
                className="inline-flex min-h-11 w-fit items-center justify-center rounded border border-[#F04A4D]/50 px-3 font-mono text-xs uppercase tracking-[0.16em] text-[#FFB5B7] transition hover:border-[#F04A4D] hover:text-zinc-50"
              >
                Live board
              </Link>
            </div>
            <div className="relative order-1 min-h-[390px] overflow-hidden bg-black lg:order-2 lg:min-h-[500px]">
              <Image
                src="/images/all-star-game-philadelphia-2026.jpg"
                alt="2026 MLB All-Star Game Philadelphia logo"
                fill
                sizes="(min-width: 1024px) 58vw, 100vw"
                className="object-contain p-5 sm:p-8 lg:p-10"
                priority
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0)_45%,rgba(8,8,10,0.74)_100%)] lg:bg-[linear-gradient(90deg,rgba(8,8,10,0.24)_0%,rgba(8,8,10,0)_42%,rgba(8,8,10,0.32)_100%)]" aria-hidden="true" />
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

async function resolveRankedHomeTopPerformer(startId: string) {
  const ranked = await fetchJson<RankedHomeResponse>("/api/home/ranked").catch(() => null);
  return ranked?.topPerformer?.start.id === startId ? ranked.topPerformer : null;
}

function homeTopPerformerViewFromPayload(topPerformer: HomeTopPerformer): HomeTopPerformerView {
  return {
    startId: topPerformer.start.id,
    href: topPerformer.href ?? startHref(topPerformer.start, sourceParams("home")),
    pitcherHref: pitcherHref(topPerformer.start.pitcher, sourceParams("home")),
    pitcherName: topPerformer.start.pitcher.name,
    team: topPerformer.start.pitcher.team,
    opponent: topPerformer.start.opponent,
    side: topPerformer.start.side,
    dateLabel: topPerformer.dateLabel,
    score: topPerformer.start.gameScorePlus,
    line: topPerformer.start.line,
    narrativeNotables: topPerformer.start.narrativeNotables,
    recap: homeTopPerformerRecap(topPerformer.start.pitcher.name, topPerformer.start.narrativeNotables, topPerformer.start.line),
    rank: 1,
    slateCount: topPerformer.slateCount,
    image: topPerformer.image,
    highlight: topPerformer.highlight,
    status: topPerformer.status,
    scoreStatusLabel: topPerformer.scoreStatusLabel,
    whiffRate: topPerformer.metrics?.whiffRate ?? null,
    topVelo: topPerformer.metrics?.topVelo ?? null,
    veloSparkline: topPerformer.metrics?.veloSparkline ?? [],
  };
}

function homeTopPerformerViewFromLiveRow(current: HomeTopPerformerView, row: LiveScoreboardRow, board: LiveScoreboard, dateLabel: string, rankedSnapshot: HomeTopPerformer | null = null): HomeTopPerformerView {
  const sameStart = current.startId === row.startId;
  const rankedView = rankedSnapshot ? homeTopPerformerViewFromPayload(rankedSnapshot) : null;

  return {
    startId: row.startId,
    href: row.liveHref,
    pitcherHref: row.pitcherHref,
    pitcherName: row.pitcherName,
    team: row.team,
    opponent: row.opponent,
    side: row.side,
    dateLabel,
    score: row.gsPlus ?? current.score,
    line: row.line,
    narrativeNotables: row.narrativeNotables,
    recap: homeTopPerformerRecap(row.pitcherName, row.narrativeNotables, row.line),
    rank: 1,
    slateCount: board.totalStarts,
    image: sameStart ? rankedView?.image ?? current.image : rankedView?.image ?? homeTopPerformerImageFromLiveRow(),
    highlight: sameStart ? rankedView?.highlight ?? current.highlight : rankedView?.highlight ?? null,
    status: board.slateProgress.state === "all-starts-complete" ? "final" : "live",
    scoreStatusLabel: row.scoreLabel === "PROV" ? "PROV" : null,
    whiffRate: sameStart ? rankedView?.whiffRate ?? current.whiffRate : rankedView?.whiffRate ?? null,
    topVelo: sameStart ? rankedView?.topVelo ?? current.topVelo : rankedView?.topVelo ?? null,
    veloSparkline: sameStart ? rankedView?.veloSparkline ?? current.veloSparkline : rankedView?.veloSparkline ?? [],
  };
}

function homeTopPerformerRecap(pitcherName: string, notables: StartNarrativeNotables | undefined, line: StartSummary["line"]) {
  const noHit = notables?.noHitDepth;
  if (noHit?.firstHitInning && noHit.innings >= 8) {
    return `${pitcherName} carried a no-hitter into the ${ordinal(noHit.firstHitInning)}.`;
  }
  if (noHit?.hitlessStintComplete && noHit.innings >= 5) {
    return `${pitcherName} worked ${noHit.innings}.0 hitless innings.`;
  }
  if (notables?.strikeouts?.doubleDigit) {
    return `${pitcherName} reached double digits with ${line.strikeouts} strikeouts.`;
  }
  return null;
}

function ordinal(value: number) {
  if (value === 8) return "eighth";
  if (value === 9) return "ninth";
  return `${value}th`;
}

function isPlaceholderTopPerformerImage(image: HomeTopPerformer["image"]) {
  return !image || image.source === "placeholder";
}

function homeTopPerformerImageFromLiveRow(): HomeTopPerformer["image"] {
  return {
    source: "placeholder",
    imageUrl: "/images/top-performer-placeholder.jpg",
    alt: "Pitcher's mound and rubber on a baseball field",
    objectPosition: "50% 45%",
    mobileObjectPosition: "50% 45%",
  };
}

function hasMissingBestStartHighlight(bestStarts: BestStartsHomeResponse) {
  const weeklyMissing = Boolean(bestStarts.weekly && !bestStarts.weeklyHighlight);
  const monthlyIsWeekly = bestStarts.monthly?.id === bestStarts.weekly?.id;
  const monthlyMissing = Boolean(bestStarts.monthly && !monthlyIsWeekly && !bestStarts.monthlyHighlight);
  const runnerUpMissing = Boolean(monthlyIsWeekly && bestStarts.monthlyRunnerUp && !bestStarts.monthlyRunnerUpHighlight);
  return weeklyMissing || monthlyMissing || runnerUpMissing;
}

function shouldShowHomeRankedRecap(ranked: RankedHomeResponse | null): ranked is RankedHomeResponse {
  if (!ranked?.areTodayStartsComplete) return false;
  return ranked.starts.some((start) => start.source?.line !== "fixture" && isRankedRegularStart(start));
}

function shouldShowHomeHookSpine(ranked: RankedHomeResponse | null, watchDate: string) {
  return ranked?.areTodayStartsComplete === true && ranked.date === watchDate;
}

function shouldShowHomeAllStarBreakSpotlight(slateStatus: SlateProgressState) {
  return slateStatus.state === "no-games" && slateStatus.date >= "2026-07-13" && slateStatus.date <= "2026-07-15";
}

function filterHomeMustWatchGames(watch: TonightResponse | null) {
  if (!watch) return null;
  const games = watch.games.filter((game) => game.status === "pregame");
  return { ...watch, games };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${url}`);
  return response.json() as Promise<T>;
}

function BestStartsLite({
  weekly,
  monthly,
  monthlyRunnerUp,
  weeklyHighlight,
  monthlyHighlight,
  monthlyRunnerUpHighlight,
  weeklyVeloByInning,
  monthlyVeloByInning,
  monthlyRunnerUpVeloByInning,
  seasonTopStarts,
}: {
  weekly: StartSummary | null;
  monthly: StartSummary | null;
  monthlyRunnerUp?: StartSummary | null;
  weeklyHighlight: FeaturedStartHighlight | null;
  monthlyHighlight: FeaturedStartHighlight | null;
  monthlyRunnerUpHighlight?: FeaturedStartHighlight | null;
  weeklyVeloByInning: StartVeloByInning | null;
  monthlyVeloByInning: StartVeloByInning | null;
  monthlyRunnerUpVeloByInning?: StartVeloByInning | null;
  seasonTopStarts?: HomeSeasonTopStart[];
}) {
  const sameWindowWinner = Boolean(weekly && monthly && weekly.id === monthly.id);
  const cards: Array<{ badge: string; start: StartSummary | null; highlight: FeaturedStartHighlight | null; veloByInning: StartVeloByInning | null }> = sameWindowWinner
    ? [
        { badge: "7 AND 30-DAY BEST", start: weekly, highlight: weeklyHighlight ?? monthlyHighlight, veloByInning: weeklyVeloByInning ?? monthlyVeloByInning },
        { badge: "30-DAY NEXT BEST", start: monthlyRunnerUp ?? null, highlight: monthlyRunnerUpHighlight ?? null, veloByInning: monthlyRunnerUpVeloByInning ?? null },
      ]
    : [
        { badge: "7-DAY BEST", start: weekly, highlight: weeklyHighlight, veloByInning: weeklyVeloByInning },
        { badge: "30-DAY BEST", start: monthly, highlight: monthlyHighlight, veloByInning: monthlyVeloByInning },
      ];
  const visibleCards = cards.flatMap((card) => (card.start ? [{ ...card, start: card.start }] : []));
  const topStarts = seasonTopStarts?.slice(0, 5) ?? [];

  if (visibleCards.length === 0 && topStarts.length === 0) return null;

  return (
    <section className="border-t border-white/10 bg-[#08080a] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col justify-between gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-amber-300">Best starts</p>
            <h2 className="section-title mt-2 font-serif text-4xl font-bold text-zinc-50">Recent Gems</h2>
            <p className="blurb mt-2 max-w-2xl text-sm leading-6 text-zinc-400">The best starts of the last 7 and 30 days, worth revisiting.</p>
          </div>
          <Link href="/best-starts" className="inline-flex min-h-11 items-center rounded border border-amber-300/40 px-3 font-mono text-xs uppercase tracking-[0.16em] text-amber-300">
            Season archive
          </Link>
        </div>
        <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]" data-responsive-check="home-best-starts-2026-layout">
          <div className="grid auto-rows-fr gap-3 lg:grid-rows-2" data-recent-gem-card-grid>
            {visibleCards.map((card) => (
              <BestStartCard key={`${card.badge}-${card.start.id}`} badge={card.badge} start={card.start} highlight={card.highlight} veloByInning={card.veloByInning} compact />
            ))}
          </div>
          {topStarts.length > 0 ? <SeasonTopStartsPanel starts={topStarts} /> : null}
        </div>
      </div>
    </section>
  );
}

function BestStartCard({ start, badge, highlight, veloByInning, compact = false }: { start: StartSummary; badge: string; highlight?: FeaturedStartHighlight | null; veloByInning: StartVeloByInning | null; compact?: boolean }) {
  return (
    <article className={`group relative min-h-0 overflow-hidden rounded border border-white/10 bg-[#101014] transition hover:border-amber-300/40 ${compact ? "p-4" : "p-5"}`} data-recent-gem-card data-recent-gem-media-state={highlight ? "highlight" : "velo-chart"}>
      <a href={startHref(start, sourceParams("home"))} className="absolute inset-0 z-0" aria-label={`Open ${start.pitcher.name} start deep dive`} />
      <div className="relative z-10 grid min-w-0 grid-cols-[66px_minmax(0,1fr)_auto] items-start gap-3 pointer-events-none">
        <Headshot playerId={start.pitcher.mlbId} name={start.pitcher.name} team={start.pitcher.team} size="xl" band={scoreBand(start.gameScorePlus)} decorative className="ml-1" />
        <div className="min-w-0">
          <p className="inline-flex max-w-full whitespace-nowrap rounded border border-amber-300/30 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-200">{badge}</p>
          <a href={pitcherHref(start.pitcher, sourceParams("home"))} className="pitcher-name pointer-events-auto mt-2 block font-serif text-3xl font-bold leading-tight text-zinc-50 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
            {start.pitcher.name}
          </a>
          <p className="mt-2 font-mono text-xs leading-5 text-zinc-400">
            <MetaLine segments={[startMatchupLabel(start), formatShortDate(start.date)]} />
          </p>
          <DecisionChip result={start.result} surface="home-best-start" compact className="mt-2 text-zinc-400" />
        </div>
        <div className="score-bug rounded border border-amber-300/30 bg-amber-300 px-3 py-2 text-center text-zinc-950">
          <p className="font-serif text-4xl font-bold leading-none">{start.gameScorePlus}</p>
          <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.16em]">GS+</p>
          <RawGsPlusLine score={start.gameScorePlus} breakdown={start.gameScorePlusBreakdown} className="mt-1 text-zinc-800" />
        </div>
      </div>
      <p className="relative z-10 mt-4 text-sm leading-6 text-zinc-400 pointer-events-none"><StartLineText line={start.line} /></p>
      {highlight ? (
        <div className={`relative z-10 pointer-events-auto ${compact ? "mt-3" : "mt-4"}`}>
          <FeaturedStartHighlightEmbed highlight={highlight} pitcherName={start.pitcher.name} />
        </div>
      ) : (
        <div className={`relative z-10 pointer-events-none ${compact ? "mt-3" : "mt-4"}`}>
          <RecentGemVeloChart pitcherName={start.pitcher.name} data={veloByInning} />
        </div>
      )}
    </article>
  );
}

function SeasonTopStartsPanel({ starts }: { starts: HomeSeasonTopStart[] }) {
  return (
    <article className="min-h-full rounded border border-white/10 bg-[#101014] p-4" data-responsive-check="home-top-starts-2026">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">Top starts of 2026</p>
          <h3 className="mt-1 font-serif text-2xl font-bold text-zinc-50">Season leaderboard</h3>
        </div>
        <Link href="/best-starts" className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300 underline-offset-4 hover:underline">
          Season archive
        </Link>
      </div>
      <div className="grid min-h-0 gap-2 lg:h-[calc(100%-4.25rem)] lg:grid-rows-5">
        {starts.map((entry, index) => (
          <SeasonTopStartRow key={entry.start.id} entry={entry} rank={index + 1} />
        ))}
      </div>
    </article>
  );
}

function SeasonTopStartRow({ entry, rank }: { entry: HomeSeasonTopStart; rank: number }) {
  const { start } = entry;
  const color = scoreBandColor(start.gameScorePlus);
  const actionImage = entry.image?.source === "action" ? entry.image : null;
  const imageUrl = actionImage?.imageUrl ?? start.pitcher.headshotUrl;
  const imagePosition = "50% 4%";
  const rowHref = startHref(start, sourceParams("home"));
  const fullBleed = Boolean(actionImage);
  const mobileName = splitPitcherNameForMobile(start.pitcher.name);

  return (
    <article
      className={`group relative grid min-h-[120px] overflow-hidden rounded border bg-black/20 transition hover:border-amber-300/40 sm:min-h-[160px] ${fullBleed ? "grid-cols-[56px_minmax(0,1fr)_auto] sm:grid-cols-[72px_minmax(0,1fr)_auto]" : "sm:grid-cols-[72px_minmax(0,120px)_minmax(0,1fr)_auto]"} ${rank === 1 ? "border-amber-300/35 shadow-[inset_3px_0_0_var(--level-onfire)]" : "border-white/10"}`}
      data-home-top-start-row={rank}
      data-full-bleed-action={fullBleed ? "true" : "false"}
      aria-label={`Gem number ${rank}: ${start.pitcher.name}, GS+ ${start.gameScorePlus}`}
    >
      {fullBleed ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={`${start.pitcher.name} pitching`} className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover" style={{ objectPosition: imagePosition }} data-home-top-start-bg="true" />
          <span className="pointer-events-none absolute inset-0 z-[1]" style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.15) 100%)" }} aria-hidden="true" data-home-top-start-scrim="true" />
        </>
      ) : null}
      <a href={rowHref} className="absolute inset-0 z-[2]" aria-label={`Open ${start.pitcher.name} start deep dive`} />
      <div
        className="relative z-10 flex min-h-full w-[56px] flex-col items-center justify-center overflow-hidden border-r border-white/15 px-2 py-3 sm:w-[72px]"
        style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.64) 60%, rgba(0,0,0,0.22) 100%)" }}
        data-home-top-start-gem-lockup="true"
      >
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 h-[92px] w-[92px] -translate-x-1/2 -translate-y-1/2 opacity-[0.16] sm:h-[118px] sm:w-[118px] sm:opacity-[0.12]"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 120 120\'%3E%3Cpath fill=\'%23fb5938\' d=\'M33 14h54l25 30-52 62L8 44 33 14Z\'/%3E%3Cpath fill=\'%23ffcc66\' fill-opacity=\'.7\' d=\'M33 14h54L72 44H48L33 14Z\'/%3E%3Cpath fill=\'%23000\' fill-opacity=\'.22\' d=\'M48 44h24l-12 62L48 44Z\'/%3E%3Cpath fill=\'none\' stroke=\'%23fff\' stroke-opacity=\'.55\' stroke-width=\'5\' d=\'M33 14h54l25 30-52 62L8 44 33 14Z\'/%3E%3C/svg%3E")',
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundSize: "contain",
          }}
          aria-hidden="true"
          data-home-top-start-gem-watermark="true"
        />
        <span className={`relative z-10 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--level-onfire)] ${rank === 1 ? "drop-shadow-[0_0_8px_rgba(251,146,60,0.85)]" : ""}`} data-home-top-start-gem-kicker={rank === 1 ? "elite" : "standard"}>
          Gem
        </span>
        <span className="relative z-10 mt-1 font-serif text-[32px] font-black leading-none sm:text-[44px]" style={{ color }}>#{rank}</span>
      </div>
      {!fullBleed ? (
        <div className="relative z-10 min-h-[112px] overflow-hidden border-b border-white/10 sm:border-b-0 sm:border-r" data-home-top-start-framed-photo="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={`${start.pitcher.name} pitching`} className="h-full w-full object-cover" style={{ objectPosition: imagePosition }} />
          <span className="absolute inset-0 bg-gradient-to-r from-black/5 via-transparent to-[#101014]/70" aria-hidden="true" />
        </div>
      ) : null}
      <div className="relative z-10 min-w-0 px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <a href={pitcherHref(start.pitcher, sourceParams("home"))} className="pitcher-name pointer-events-auto inline-block font-serif text-xl font-bold leading-tight text-zinc-50 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" aria-label={start.pitcher.name}>
            <span className="sm:hidden" data-home-top-start-mobile-name="two-line">
              <span className="block">{mobileName.firstLine}</span>
              <span className="block">{mobileName.secondLine}</span>
            </span>
            <span className="hidden sm:inline">{start.pitcher.name}</span>
          </a>
          {entry.isNew ? <span className="rounded border border-amber-300/35 bg-amber-300/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-amber-200">New</span> : null}
        </div>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-300">
          <MetaLine segments={[startMatchupLabel(start), formatShortDate(start.date)]} />
        </p>
        <p className="mt-2 text-sm leading-5 text-zinc-300">{formatStartLine(start.line)}</p>
        {entry.highlightUrl ? (
          <a href={entry.highlightUrl} target="_blank" rel="noopener" className="pointer-events-auto mt-2 inline-flex min-h-7 items-center rounded border border-amber-300/25 bg-amber-300/10 px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-200 hover:border-amber-300/50">
            Highlights
          </a>
        ) : null}
      </div>
      <div className="relative z-10 flex items-center justify-start px-3 pb-3 sm:justify-end sm:py-3">
        <div className="min-w-[76px] rounded border border-white/35 bg-[rgba(10,10,10,0.6)] px-3 py-2 text-center backdrop-blur-[6px]" data-home-top-start-score-panel="true">
          <p className="font-serif text-4xl font-black leading-none" style={{ color }}>{start.gameScorePlus}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-white">GS+</p>
          <RawGsPlusLine score={start.gameScorePlus} breakdown={start.gameScorePlusBreakdown} className="mt-1 !text-white" style={{ color: "#fff" }} />
        </div>
      </div>
    </article>
  );
}

function splitPitcherNameForMobile(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return { firstLine: name, secondLine: "" };

  return {
    firstLine: parts.slice(0, -1).join(" "),
    secondLine: parts[parts.length - 1],
  };
}

function resolveHomeMustWatchDate(watch: TonightResponse | null | undefined, fallbackDate: string) {
  return watch?.games.find((game) => game.date)?.date ?? watch?.date ?? fallbackDate;
}

function scoreBand(score: number): FormTier {
  if (score >= 69) return "onfire";
  if (score >= 58) return "hot";
  if (score >= 46) return "even";
  if (score >= 30) return "cooling";
  return "ice";
}

function scoreBandColor(score: number) {
  if (score >= 69) return "var(--level-onfire)";
  if (score >= 58) return "var(--level-hot)";
  if (score >= 46) return "var(--level-even-text)";
  if (score >= 30) return "var(--level-cooling)";
  return "var(--level-ice)";
}

function formatShortDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}
