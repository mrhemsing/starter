"use client";

import { useEffect, useState } from "react";
import { HeatCheckHero } from "@/components/heat-check-hero";
import { Headshot } from "@/components/headshot";
import { PitchingDuelsModule } from "@/components/pitching-duels";
import { RankedStartsRecap } from "@/components/ranked-starts-recap";
import { TonightsMustWatch } from "@/components/tonights-must-watch";
import { TopPerformerCard } from "@/components/top-performer-card";
import { formatStartLine } from "@/lib/format";
import { startPath, upcomingDateHref } from "@/lib/routes";
import type { TopPerformerImage } from "@/lib/data/top-performer-image-service";
import type { FormHomeResponse, PitchingDuelsResponse, StartSummary, TonightResponse } from "@/lib/types";

type RankedHomeResponse = {
  date: string;
  label: string;
  starts: StartSummary[];
  topPerformer: {
    status: "final" | "live" | "previous";
    start: StartSummary;
    slateCount: number;
    dateLabel: string;
    image: TopPerformerImage | null;
  } | null;
};

type BestStartsHomeResponse = {
  weekly: StartSummary | null;
  monthly: StartSummary | null;
};

export function HomeDeferredSections({ today, tomorrow }: { today: string; tomorrow: string }) {
  const [todayWatch, setTodayWatch] = useState<TonightResponse | null>(null);
  const [tomorrowWatch, setTomorrowWatch] = useState<TonightResponse | null>(null);
  const [duels, setDuels] = useState<PitchingDuelsResponse | null>(null);
  const [formHome, setFormHome] = useState<FormHomeResponse | null>(null);
  const [ranked, setRanked] = useState<RankedHomeResponse | null>(null);
  const [bestStarts, setBestStarts] = useState<BestStartsHomeResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const setIfLive = <T,>(setter: (value: T) => void) => (value: T) => {
      if (!cancelled) setter(value);
    };

    const todayWatchPromise = fetchJson<TonightResponse>(`/api/tonight?date=${today}&window=5`);
    todayWatchPromise.then(setIfLive(setTodayWatch)).catch(() => undefined);
    fetchJson<TonightResponse>(`/api/tonight?date=${tomorrow}&window=5`).then(setIfLive(setTomorrowWatch)).catch(() => undefined);
    todayWatchPromise
      .then((watch) => fetchJson<PitchingDuelsResponse>(`/api/duels?date=${watch.games.length > 0 ? today : tomorrow}&mode=upcoming`))
      .then(setIfLive(setDuels))
      .catch(() => undefined);
    fetchJson<FormHomeResponse>("/api/form/home?window=5").then(setIfLive(setFormHome)).catch(() => undefined);
    fetchJson<RankedHomeResponse>("/api/home/ranked").then(setIfLive(setRanked)).catch(() => undefined);
    fetchJson<BestStartsHomeResponse>("/api/home/best-starts").then(setIfLive(setBestStarts)).catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [today, tomorrow]);

  const watch = todayWatch?.games.length ? todayWatch : tomorrowWatch;
  const watchDate = todayWatch?.games.length ? today : tomorrow;

  return (
    <>
      {ranked?.topPerformer ? (
        <section className="bg-[#08080a] px-4 pb-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <TopPerformerCard
              href={startPath(ranked.topPerformer.start.id)}
              pitcherName={ranked.topPerformer.start.pitcher.name}
              team={ranked.topPerformer.start.pitcher.team}
              opponent={ranked.topPerformer.start.opponent}
              dateLabel={ranked.topPerformer.dateLabel}
              score={ranked.topPerformer.start.gameScorePlus}
              line={ranked.topPerformer.start.line}
              rank={1}
              slateCount={ranked.topPerformer.slateCount}
              image={ranked.topPerformer.image}
              highlight={null}
              isProvisional={ranked.topPerformer.status === "live"}
              whiffRate={null}
              topVelo={null}
              veloSparkline={[]}
            />
          </div>
        </section>
      ) : null}

      {watch ? (
        <TonightsMustWatch
          tonight={watch}
          fullSlateHref={upcomingDateHref(watchDate)}
          fullSlateLabel="See tonight's full slate"
          eyebrow={todayWatch?.games.length ? "Tonight" : "Tomorrow"}
          title="Tonight's Must-Watch Games"
          previewLimit={3}
        />
      ) : <HomeDeferredFallback />}

      {duels ? <PitchingDuelsModule duels={duels} title="Best Duels Today" compact /> : <HomeDeferredFallback />}
      {formHome ? <HeatCheckHero home={formHome} /> : <HomeDeferredFallback />}
      {ranked ? <RankedStartsRecap date={ranked.date} label={ranked.label} starts={ranked.starts} highlights={new Map()} /> : <HomeDeferredFallback />}
      {bestStarts ? <BestStartsLite weekly={bestStarts.weekly} monthly={bestStarts.monthly} /> : <HomeDeferredFallback />}
    </>
  );
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${url}`);
  return response.json() as Promise<T>;
}

function HomeDeferredFallback() {
  return <div className="border-t border-white/10 bg-[#08080a] px-4 py-8 sm:px-6 lg:px-8" aria-hidden="true" />;
}

function BestStartsLite({ weekly, monthly }: { weekly: StartSummary | null; monthly: StartSummary | null }) {
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
            <BestStartCard title="7-day / 30-day best" badge="Tops the last 7 and 30 days" start={monthly} />
          ) : (
            <>
              <BestStartCard title="7-day best" start={weekly} />
              <BestStartCard title="30-day best" start={monthly} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function BestStartCard({ title, start, badge }: { title: string; start: StartSummary | null; badge?: string }) {
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
      <a href={startPath(start.id)} className="grid min-w-0 grid-cols-[66px_minmax(0,1fr)] items-center gap-3">
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
      <p className="mt-4 text-sm leading-6 text-zinc-400">{formatStartLine(start.line)}</p>
    </div>
  );
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
