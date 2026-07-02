"use client";

import { track } from "@vercel/analytics";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { FeaturedStartHighlightEmbed } from "@/components/featured-start-highlight";
import { HeatCheckHero } from "@/components/heat-check-hero";
import { Headshot } from "@/components/headshot";
import { PitchingDuelsModule } from "@/components/pitching-duels";
import { RankedStartsRecap } from "@/components/ranked-starts-recap";
import { TonightsMustWatch } from "@/components/tonights-must-watch";
import { TopPerformerCard } from "@/components/top-performer-card";
import { MetaLine, StartLineText } from "@/components/wrap-safe-text";
import { pitcherHref, sourceParams, startHref, upcomingDateHref } from "@/lib/routes";
import { getHomeModuleOrder, type HomeModuleKey, type HomeSlatePhase, type HomeSlatePhaseVariant } from "@/lib/home-slate-phase";
import { slateTimeWord, slateTimeWordTitle } from "@/lib/time-words";
import type { BestStartsHomeResponse } from "@/lib/data/home-best-starts-service";
import type { RankedHomeResponse } from "@/lib/data/home-ranked-service";
import type { FeaturedStartHighlight, FormHomeResponse, FormTier, PitchingDuelsResponse, StartSummary, TonightResponse } from "@/lib/types";

const HOME_MUST_WATCH_LIVE_MAX_AGE_MS = 60 * 60 * 1000;
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
  const [nowMs, setNowMs] = useState(() => Date.now());
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
        .then((watch) => fetchJson<PitchingDuelsResponse>(`/api/duels?date=${watch.games.length > 0 ? today : tomorrow}&mode=upcoming`))
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

    const rankedRefresh = window.setInterval(() => {
      fetchJson<RankedHomeResponse>("/api/home/ranked").then(setIfLive(setRanked)).catch(() => undefined);
    }, 60 * 1000);
    const homeClockRefresh = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(rankedRefresh);
      window.clearInterval(homeClockRefresh);
    };
  }, [bestStarts, duels, formHome, ranked, today, todayWatch, tomorrow, tomorrowWatch]);

  const activeTodayWatch = filterHomeMustWatchGames(todayWatch, nowMs);
  const activeTomorrowWatch = filterHomeMustWatchGames(tomorrowWatch, nowMs);
  const watch = activeTodayWatch?.games.length ? activeTodayWatch : activeTomorrowWatch;
  const watchDate = activeTodayWatch?.games.length ? today : tomorrow;
  const watchWord = watch ? slateTimeWord(watch, { today }) : "today";

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
          <section className="bg-[#08080a] px-4 pb-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
              <TopPerformerCard
                href={ranked.topPerformer.href ?? startHref(ranked.topPerformer.start, sourceParams("home"))}
                pitcherName={ranked.topPerformer.start.pitcher.name}
                team={ranked.topPerformer.start.pitcher.team}
                opponent={ranked.topPerformer.start.opponent}
                dateLabel={ranked.topPerformer.dateLabel}
                score={ranked.topPerformer.start.gameScorePlus}
                line={ranked.topPerformer.start.line}
                rank={1}
                slateCount={ranked.topPerformer.slateCount}
                image={ranked.topPerformer.image}
                highlight={ranked.topPerformer.highlight}
                status={ranked.topPerformer.status}
                whiffRate={ranked.topPerformer.metrics?.whiffRate ?? null}
                topVelo={ranked.topPerformer.metrics?.topVelo ?? null}
                veloSparkline={ranked.topPerformer.metrics?.veloSparkline ?? []}
              />
            </div>
          </section>
        ) : ranked.liveLeaderboard ? (
          <LiveLeaderboardStrip entries={ranked.liveLeaderboard} />
        ) : null,
      watch: watch ? (
        <TonightsMustWatch
          tonight={watch}
          fullSlateHref={upcomingDateHref(watchDate)}
          fullSlateLabel={`See ${watchWord}'s full slate`}
          eyebrow={slateTimeWordTitle(watch, { today })}
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
        <section className="bg-[#08080a] px-4 pb-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <TopPerformerCard
              href={ranked.topPerformer.href ?? startHref(ranked.topPerformer.start, sourceParams("home"))}
              pitcherName={ranked.topPerformer.start.pitcher.name}
              team={ranked.topPerformer.start.pitcher.team}
              opponent={ranked.topPerformer.start.opponent}
              dateLabel={ranked.topPerformer.dateLabel}
              score={ranked.topPerformer.start.gameScorePlus}
              line={ranked.topPerformer.start.line}
              rank={1}
              slateCount={ranked.topPerformer.slateCount}
              image={ranked.topPerformer.image}
              highlight={ranked.topPerformer.highlight}
              status={ranked.topPerformer.status}
              whiffRate={ranked.topPerformer.metrics?.whiffRate ?? null}
              topVelo={ranked.topPerformer.metrics?.topVelo ?? null}
              veloSparkline={ranked.topPerformer.metrics?.veloSparkline ?? []}
            />
          </div>
        </section>
      ) : ranked.liveLeaderboard ? (
        <LiveLeaderboardStrip entries={ranked.liveLeaderboard} />
      ) : null}

      {watch ? (
        <TonightsMustWatch
          tonight={watch}
          fullSlateHref={upcomingDateHref(watchDate)}
          fullSlateLabel={`See ${watchWord}'s full slate`}
          eyebrow={slateTimeWordTitle(watch, { today })}
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
        />
      ) : null}
    </>
  );
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

function filterHomeMustWatchGames(watch: TonightResponse | null, nowMs: number) {
  if (!watch) return null;
  const games = watch.games.filter((game) => {
    if (game.status !== "live") return true;
    const firstPitchMs = new Date(game.firstPitch).getTime();
    if (Number.isNaN(firstPitchMs)) return true;
    return nowMs - firstPitchMs <= HOME_MUST_WATCH_LIVE_MAX_AGE_MS;
  });
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
  weeklyHighlight,
  monthlyHighlight,
}: {
  weekly: StartSummary | null;
  monthly: StartSummary | null;
  weeklyHighlight: FeaturedStartHighlight | null;
  monthlyHighlight: FeaturedStartHighlight | null;
}) {
  const monthKey = monthly?.date.slice(0, 7) ?? new Date().toISOString().slice(0, 7);
  const sameStart = weekly && monthly && weekly.id === monthly.id;
  const cards: Array<{ badge: string; start: StartSummary | null; highlight: FeaturedStartHighlight | null }> = sameStart
    ? [{ badge: "7-DAY + 30-DAY BEST", start: monthly, highlight: monthlyHighlight ?? weeklyHighlight }]
    : [
        { badge: "7-DAY BEST", start: weekly, highlight: weeklyHighlight },
        { badge: "30-DAY BEST", start: monthly, highlight: monthlyHighlight },
      ];
  const visibleCards = cards.flatMap((card) => (card.start ? [{ badge: card.badge, start: card.start, highlight: card.highlight }] : []));

  if (visibleCards.length === 0) return null;

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
            Best starts archive
          </a>
        </div>
        <div className={`grid gap-3 ${visibleCards.length === 1 ? "" : "md:grid-cols-2"}`}>
          {visibleCards.map((card) => (
            <BestStartCard key={`${card.badge}-${card.start.id}`} badge={card.badge} start={card.start} highlight={card.highlight} />
          ))}
        </div>
      </div>
    </section>
  );
}

function BestStartCard({ start, badge, highlight }: { start: StartSummary; badge: string; highlight?: FeaturedStartHighlight | null }) {
  return (
    <article className="group relative overflow-hidden rounded border border-white/10 bg-[#101014] p-5 transition hover:border-amber-300/40">
      <a href={startHref(start, sourceParams("home"))} className="absolute inset-0 z-0" aria-label={`Open ${start.pitcher.name} start deep dive`} />
      <div className="relative z-10 grid min-w-0 grid-cols-[66px_minmax(0,1fr)_auto] items-start gap-3 pointer-events-none">
        <Headshot playerId={start.pitcher.mlbId} name={start.pitcher.name} team={start.pitcher.team} size="xl" band={scoreBand(start.gameScorePlus)} decorative className="ml-1" />
        <div className="min-w-0">
          <p className="inline-flex max-w-full whitespace-nowrap rounded border border-amber-300/30 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-200">{badge}</p>
          <a href={pitcherHref(start.pitcher, sourceParams("home"))} className="pitcher-name pointer-events-auto mt-2 block font-serif text-3xl font-bold leading-tight text-zinc-50 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
            {start.pitcher.name}
          </a>
          <p className="mt-2 font-mono text-xs leading-5 text-zinc-400">
            <MetaLine segments={[`${start.pitcher.team} vs ${start.opponent}`, formatShortDate(start.date)]} />
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
        </div>
      </div>
      <p className="relative z-10 mt-4 text-sm leading-6 text-zinc-400 pointer-events-none"><StartLineText line={start.line} /></p>
      {highlight ? (
        <div className="relative z-10 mt-4 pointer-events-auto">
          <FeaturedStartHighlightEmbed highlight={highlight} pitcherName={start.pitcher.name} />
        </div>
      ) : null}
    </article>
  );
}

function scoreBand(score: number): FormTier {
  if (score >= 69) return "onfire";
  if (score >= 58) return "hot";
  if (score >= 46) return "even";
  if (score >= 30) return "cooling";
  return "ice";
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
