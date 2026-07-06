"use client";

import { track } from "@vercel/analytics";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { FeaturedStartHighlightEmbed } from "@/components/featured-start-highlight";
import { RawGsPlusLine } from "@/components/gs-plus-score";
import { HeatCheckHero } from "@/components/heat-check-hero";
import { Headshot } from "@/components/headshot";
import { useHomeLiveBoard } from "@/components/home-live-board-provider";
import { PitchingDuelsModule } from "@/components/pitching-duels";
import { RankedStartsRecap } from "@/components/ranked-starts-recap";
import { TonightsMustWatch } from "@/components/tonights-must-watch";
import { TopPerformerCard } from "@/components/top-performer-card";
import { MetaLine, StartLineText } from "@/components/wrap-safe-text";
import { pitcherHref, sourceParams, startHref, upcomingDateHref } from "@/lib/routes";
import { getHomeModuleOrder, type HomeModuleKey, type HomeSlatePhase, type HomeSlatePhaseVariant } from "@/lib/home-slate-phase";
import { startMatchupLabel } from "@/lib/start-matchup-label";
import { slateTimeWord, slateTimeWordTitle } from "@/lib/time-words";
import type { BestStartsHomeResponse, HomeSeasonTopStart } from "@/lib/data/home-best-starts-service";
import type { LiveScoreboard, LiveScoreboardRow } from "@/lib/data/live-scoreboard-service";
import type { RankedHomeResponse } from "@/lib/data/home-ranked-service";
import { formatStartLine } from "@/lib/format";
import { resolveHomeLiveLeaderRow } from "@/lib/home-live-leader";
import type { FeaturedStartHighlight, FormHomeResponse, FormTier, PitchingDuelsResponse, StartSummary, TonightResponse } from "@/lib/types";

const HOME_SCROLL_DEPTH_THRESHOLDS = [25, 50, 75, 100] as const;

export type HomeDeferredInitialData = {
  todayWatch?: TonightResponse | null;
  tomorrowWatch?: TonightResponse | null;
  duels?: PitchingDuelsResponse | null;
  ranked?: RankedHomeResponse | null;
  bestStarts?: BestStartsHomeResponse | null;
  formHome?: FormHomeResponse | null;
};

export function HomeDeferredSections({
  today,
  tomorrow,
  slatePhase,
  slatePhaseExperiment = false,
  initialData,
}: {
  today: string;
  tomorrow: string;
  slatePhase: HomeSlatePhase;
  slatePhaseExperiment?: boolean;
  initialData?: HomeDeferredInitialData;
}) {
  const [todayWatch, setTodayWatch] = useState<TonightResponse | null>(initialData?.todayWatch ?? null);
  const [tomorrowWatch, setTomorrowWatch] = useState<TonightResponse | null>(initialData?.tomorrowWatch ?? null);
  const [duels, setDuels] = useState<PitchingDuelsResponse | null>(initialData?.duels ?? null);
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

    const todayWatchPromise = todayWatch
      ? Promise.resolve(todayWatch)
      : fetchJson<TonightResponse>(`/api/tonight?date=${today}&window=5`).then((value) => {
          setIfLive(setTodayWatch)(value);
          return value;
        });

    if (!tomorrowWatch) {
      fetchJson<TonightResponse>(`/api/tonight?date=${tomorrow}&window=5`).then(setIfLive(setTomorrowWatch)).catch(() => undefined);
    }

    if (!duels) {
      todayWatchPromise
        .then((watch) => fetchJson<PitchingDuelsResponse>(`/api/duels?date=${hasPregameMustWatchGames(watch) ? today : tomorrow}&mode=upcoming`))
        .then(setIfLive(setDuels))
        .catch(() => undefined);
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
  }, [bestStarts, duels, formHome, ranked, today, todayWatch, tomorrow, tomorrowWatch]);

  const activeTodayWatch = filterHomeMustWatchGames(todayWatch);
  const activeTomorrowWatch = filterHomeMustWatchGames(tomorrowWatch);
  const watch = activeTodayWatch?.games.length ? activeTodayWatch : activeTomorrowWatch;
  const watchDate = resolveHomeMustWatchDate(watch, activeTodayWatch?.games.length ? today : tomorrow);
  const watchWord = watch ? slateTimeWord({ date: watchDate }, { today }) : "today";
  const watchEyebrow = watch ? slateTimeWordTitle({ date: watchDate }, { today }) : "Today";

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
        ) : ranked.liveLeaderboard ? (
          <LiveLeaderboardStrip entries={ranked.liveLeaderboard} />
        ) : null,
      watch: watch ? (
        <TonightsMustWatch
          tonight={watch}
          fullSlateHref={upcomingDateHref(watchDate)}
          fullSlateLabel={`See ${watchWord}'s full slate`}
          eyebrow={watchEyebrow}
          title="Must-Watch Games"
          rankLabel={watchWord}
          previewLimit={3}
        />
      ) : null,
      duels: duels ? <PitchingDuelsModule duels={duels} title="Best Duels Today" compact /> : null,
      heat: formHome ? <HeatCheckHero home={formHome} /> : null,
      ranked: ranked ? <RankedStartsRecap date={ranked.date} label={ranked.label} starts={ranked.starts} highlights={new Map()} compact={slatePhase === "PREGAME"} /> : null,
      best: bestStarts ? (
        <BestStartsLite
          weekly={bestStarts.weekly}
          monthly={bestStarts.monthly}
          weeklyHighlight={bestStarts.weeklyHighlight}
          monthlyHighlight={bestStarts.monthlyHighlight}
          seasonTopStarts={bestStarts.seasonTopStarts}
        />
      ) : null,
    };

    return (
      <div data-home-slate-phase={slatePhase} data-home-slate-phase-variant={slatePhaseVariant} data-home-module-order={getHomeModuleOrder(slatePhase, slatePhaseVariant).join(",")}>
        {getHomeModuleOrder(slatePhase, slatePhaseVariant).map((module) => (
          <div key={module} data-home-module={module} onClickCapture={() => trackModuleClick(module)}>
            {modules[module]}
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
      ) : ranked.liveLeaderboard ? (
        <LiveLeaderboardStrip entries={ranked.liveLeaderboard} />
      ) : null}

      {watch ? (
        <TonightsMustWatch
          tonight={watch}
          fullSlateHref={upcomingDateHref(watchDate)}
          fullSlateLabel={`See ${watchWord}'s full slate`}
          eyebrow={watchEyebrow}
          title="Must-Watch Games"
          rankLabel={watchWord}
          previewLimit={3}
        />
      ) : null}

      {duels ? <PitchingDuelsModule duels={duels} title="Best Duels Today" compact /> : null}
      {formHome ? <HeatCheckHero home={formHome} /> : null}
      {ranked ? <RankedStartsRecap date={ranked.date} label={ranked.label} starts={ranked.starts} highlights={new Map()} /> : null}
      {bestStarts ? (
        <BestStartsLite
          weekly={bestStarts.weekly}
          monthly={bestStarts.monthly}
          weeklyHighlight={bestStarts.weeklyHighlight}
          monthlyHighlight={bestStarts.monthlyHighlight}
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
  side?: "home" | "away";
  dateLabel: string;
  score: number;
  line: HomeTopPerformer["start"]["line"];
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

function LiveLeaderboardStrip({ entries }: { entries: NonNullable<RankedHomeResponse["liveLeaderboard"]> }) {
  const liveHref = entries[0]?.href ?? "/live";

  return (
    <section className="bg-[#08080a] px-4 pb-6 sm:px-6 lg:px-8" data-responsive-check="home-live-leaderboard-strip">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-full overflow-hidden rounded border border-white/10 bg-[#101014] p-3">
          <div className="flex max-w-full min-w-0 items-center gap-3 overflow-x-auto pb-3 sm:pb-1">
            <p className="shrink-0 font-mono text-xs uppercase leading-5 tracking-[0.2em] text-amber-300 sm:whitespace-nowrap">
              <span className="block sm:inline">Live</span>
              <span className="hidden sm:inline"> </span>
              <span className="block sm:inline">Leaders</span>
            </p>
            {entries.map((entry) => (
              <a key={entry.id} href={entry.href} className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs uppercase tracking-[0.12em] text-zinc-300 transition hover:border-amber-300/30 hover:text-amber-200">
                <span className="font-serif text-lg normal-case tracking-normal text-zinc-50">{entry.pitcherLastName}</span>
                <span className="text-[#FF7A3D]">Live {entry.score.toFixed(1)}</span>
              </a>
            ))}
            <a href={liveHref} className="flex shrink-0 items-center whitespace-nowrap rounded border border-amber-300/25 bg-black/20 px-3 py-2 font-mono text-xs uppercase tracking-[0.12em] text-amber-300 transition hover:border-amber-300/50 hover:text-amber-200">
              Full live results
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function hasMissingBestStartHighlight(bestStarts: BestStartsHomeResponse) {
  const weeklyMissing = Boolean(bestStarts.weekly && !bestStarts.weeklyHighlight);
  const monthlyIsWeekly = bestStarts.monthly?.id === bestStarts.weekly?.id;
  const monthlyMissing = Boolean(bestStarts.monthly && !monthlyIsWeekly && !bestStarts.monthlyHighlight);
  return weeklyMissing || monthlyMissing;
}

function filterHomeMustWatchGames(watch: TonightResponse | null) {
  if (!watch) return null;
  const games = watch.games.filter((game) => game.status === "pregame");
  return { ...watch, games };
}

function hasPregameMustWatchGames(watch: TonightResponse | null) {
  return watch?.games.some((game) => game.status === "pregame") ?? false;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${url}`);
  return response.json() as Promise<T>;
}

function BestStartsLite({
  weekly,
  monthly,
  weeklyHighlight,
  monthlyHighlight,
  seasonTopStarts,
}: {
  weekly: StartSummary | null;
  monthly: StartSummary | null;
  weeklyHighlight: FeaturedStartHighlight | null;
  monthlyHighlight: FeaturedStartHighlight | null;
  seasonTopStarts?: HomeSeasonTopStart[];
}) {
  const monthKey = monthly?.date.slice(0, 7) ?? new Date().toISOString().slice(0, 7);
  const cards: Array<{ badge: string; start: StartSummary | null; highlight: FeaturedStartHighlight | null }> = [
    { badge: "7-DAY BEST", start: weekly, highlight: weeklyHighlight },
    { badge: "30-DAY BEST", start: monthly, highlight: monthlyHighlight ?? (monthly?.id === weekly?.id ? weeklyHighlight : null) },
  ];
  const visibleCards = cards.flatMap((card) => (card.start ? [{ badge: card.badge, start: card.start, highlight: card.highlight }] : []));
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
          <a href={`/best-starts/${monthKey}`} className="inline-flex min-h-11 items-center rounded border border-amber-300/40 px-3 font-mono text-xs uppercase tracking-[0.16em] text-amber-300">
            Season archive
          </a>
        </div>
        <div className="grid items-stretch gap-3 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]" data-responsive-check="home-best-starts-2026-layout">
          <div className="grid gap-3 lg:grid-rows-2">
            {visibleCards.map((card) => (
              <BestStartCard key={`${card.badge}-${card.start.id}`} badge={card.badge} start={card.start} highlight={card.highlight} compact />
            ))}
          </div>
          {topStarts.length > 0 ? <SeasonTopStartsPanel starts={topStarts} monthKey={monthKey} /> : null}
        </div>
      </div>
    </section>
  );
}

function BestStartCard({ start, badge, highlight, compact = false }: { start: StartSummary; badge: string; highlight?: FeaturedStartHighlight | null; compact?: boolean }) {
  return (
    <article className={`group relative min-h-0 overflow-hidden rounded border border-white/10 bg-[#101014] transition hover:border-amber-300/40 ${compact ? "p-4" : "p-5"}`}>
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
          <span
            className="mt-2 inline-flex rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-400"
            data-home-best-start-decision={start.result}
            title="Official pitcher decision, shown as context only"
          >
            {formatDecisionLabel(start.result)}
          </span>
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
      ) : null}
    </article>
  );
}

function SeasonTopStartsPanel({ starts, monthKey }: { starts: HomeSeasonTopStart[]; monthKey: string }) {
  return (
    <article className="min-h-full rounded border border-white/10 bg-[#101014] p-4" data-responsive-check="home-top-starts-2026">
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">Top starts of 2026</p>
          <h3 className="mt-1 font-serif text-2xl font-bold text-zinc-50">Season leaderboard</h3>
        </div>
        <a href={`/best-starts/${monthKey}`} className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300 underline-offset-4 hover:underline">
          Season archive
        </a>
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
  const imagePosition = actionImage?.objectPosition ?? "50% 33%";
  const rowHref = startHref(start, sourceParams("home"));
  const fullBleed = Boolean(actionImage);

  return (
    <article
      className={`group relative grid min-h-24 overflow-hidden rounded border bg-black/20 transition hover:border-amber-300/40 sm:min-h-28 ${fullBleed ? "grid-cols-[58px_minmax(0,1fr)_auto] sm:grid-cols-[76px_minmax(0,1fr)_auto]" : "sm:grid-cols-[76px_minmax(0,120px)_minmax(0,1fr)_auto]"} ${rank === 1 ? "border-amber-300/35 shadow-[inset_3px_0_0_var(--level-onfire)]" : "border-white/10"}`}
      data-home-top-start-row={rank}
      data-full-bleed-action={fullBleed ? "true" : "false"}
    >
      {fullBleed ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={`${start.pitcher.name} pitching`} className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover" style={{ objectPosition: imagePosition }} data-home-top-start-bg="true" />
          <span className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-black/90 via-black/62 to-black/18" aria-hidden="true" data-home-top-start-scrim="true" />
        </>
      ) : null}
      <a href={rowHref} className="absolute inset-0 z-0" aria-label={`Open ${start.pitcher.name} start deep dive`} />
      <div className="relative z-10 flex items-center justify-center border-b border-white/10 px-3 py-3 sm:border-b-0 sm:border-r">
        <span className="font-serif text-4xl font-black leading-none" style={{ color }}>{rank}</span>
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
          <a href={pitcherHref(start.pitcher, sourceParams("home"))} className="pitcher-name pointer-events-auto font-serif text-xl font-bold leading-tight text-zinc-50 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
            {start.pitcher.name}
          </a>
          {entry.isNew ? <span className="rounded border border-amber-300/35 bg-amber-300/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-amber-200">New</span> : null}
        </div>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
          <MetaLine segments={[start.pitcher.team, startMatchupLabel(start), formatShortDate(start.date)]} />
        </p>
        <p className="mt-2 text-sm leading-5 text-zinc-300">{formatStartLine(start.line)}</p>
        {entry.highlightUrl ? (
          <a href={entry.highlightUrl} target="_blank" rel="noopener" className="pointer-events-auto mt-2 inline-flex min-h-7 items-center rounded border border-amber-300/25 bg-amber-300/10 px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-200 hover:border-amber-300/50">
            Highlights
          </a>
        ) : null}
      </div>
      <div className="relative z-10 flex items-center justify-start px-3 pb-3 sm:justify-end sm:py-3">
        <div className="min-w-[70px] rounded border border-white/10 bg-white/5 px-3 py-2 text-center">
          <p className="font-serif text-4xl font-black leading-none" style={{ color }}>{start.gameScorePlus}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">GS+</p>
          <RawGsPlusLine score={start.gameScorePlus} breakdown={start.gameScorePlusBreakdown} className="mt-1" />
        </div>
      </div>
    </article>
  );
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

function formatDecisionLabel(result: StartSummary["result"]) {
  if (result === "W") return "Win";
  if (result === "L") return "Loss";
  return "No decision";
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
