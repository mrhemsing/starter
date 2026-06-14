import Link from "next/link";
import { notFound } from "next/navigation";
import { getPitcherApiResponse } from "@/lib/data/start-service";
import { formatStartLine } from "@/lib/format";
import { pitchTypes } from "@/lib/pitch-taxonomy";
import type { PitcherApiSeasonLogResultFilter, PitcherApiSeasonLogSort } from "@/lib/types";

type PitcherPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    sort?: string;
    result?: string;
  }>;
};

const sourceLabels = {
  fixture: "Fixture fallback",
  "archive-gamefeed": "Archived gamefeed",
  "live-people-stats": "MLB people stats",
  "live-gamefeed": "MLB gamefeed",
  "live-people-stat-splits": "MLB stat splits",
  "pending-live-source": "Pending live source",
} as const;

function formatNullableStat(value: number | null, digits: number) {
  return typeof value === "number" ? value.toFixed(digits) : "--";
}

const sortLabels: Record<PitcherApiSeasonLogSort, string> = {
  "date-desc": "Recent",
  "gs-desc": "Best GS+",
  "ip-desc": "Most IP",
};

const resultLabels: Record<PitcherApiSeasonLogResultFilter, string> = {
  all: "All",
  W: "Wins",
  L: "Losses",
  ND: "ND",
};

function pitcherSeasonLogHref(id: string, sort: PitcherApiSeasonLogSort, result: PitcherApiSeasonLogResultFilter) {
  const params = new URLSearchParams();
  if (sort !== "date-desc") params.set("sort", sort);
  if (result !== "all") params.set("result", result);
  const query = params.toString();
  return `/pitchers/${id}${query ? `?${query}` : ""}`;
}

export default async function PitcherPage({ params, searchParams }: PitcherPageProps) {
  const { id } = await params;
  const controls = await searchParams;
  const pitcher = await getPitcherApiResponse(id, controls);
  if (!pitcher) notFound();

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">
          The Bump
        </Link>
        <Link href={`/pitchers/${id}/form`} className="ml-4 font-mono text-xs uppercase tracking-[0.2em] text-zinc-400">
          Form
        </Link>
        <header className="mt-6 grid gap-6 border-b border-white/10 pb-8 md:grid-cols-[1fr_240px] lg:grid-cols-[1fr_320px]">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
              {pitcher.team} / Throws {pitcher.throws}
            </p>
            <h1 className="mt-3 font-serif text-5xl font-black leading-none text-zinc-50 sm:text-6xl lg:text-7xl">{pitcher.name}</h1>
            <p className="mt-4 font-mono text-sm text-zinc-400">
              {pitcher.seasonLine.starts} starts / {pitcher.seasonLine.inningsPitched.toFixed(1)} IP / {pitcher.seasonLine.era.toFixed(2)} ERA / {pitcher.seasonLine.strikeouts} K
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pitcher.headshotUrl} alt="" className="mx-auto h-64 w-full max-w-72 object-contain object-bottom md:max-w-none" />
        </header>

        <section className="grid gap-6 py-8 lg:grid-cols-[360px_1fr]">
          <div>
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Arsenal report</p>
            <div className="space-y-3">
              {pitcher.arsenal.map((pitch) => (
                <div key={pitch.type} className="rounded border border-white/10 bg-[#101014] p-4" style={{ borderLeftColor: pitchTypes[pitch.type].color, borderLeftWidth: 4 }}>
                  <div className="flex items-baseline justify-between">
                    <p className="font-mono text-sm font-semibold" style={{ color: pitchTypes[pitch.type].color }}>
                      {pitchTypes[pitch.type].name}
                    </p>
                    <p className="font-mono text-xs text-zinc-500">{pitch.usagePct}%</p>
                  </div>
                  <p className="mt-2 font-serif text-3xl text-zinc-50">{pitch.avgVelocityMph.toFixed(1)} mph</p>
                  <p className="mt-2 font-mono text-xs text-zinc-500">
                    {pitch.whiffPct}% whiff / {pitch.calledStrikePct}% called strike
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded border border-white/10 bg-[#101014] p-4">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Data sources</p>
              <dl className="mt-4 grid gap-3 font-mono text-xs">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-zinc-500">Identity</dt>
                  <dd className="text-right text-zinc-200">{sourceLabels[pitcher.source.identity]}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-zinc-500">Season line</dt>
                  <dd className="text-right text-zinc-200">{sourceLabels[pitcher.source.seasonLine]}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-zinc-500">Start history</dt>
                  <dd className="text-right text-zinc-200">{sourceLabels[pitcher.source.startHistory]}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-zinc-500">Arsenal</dt>
                  <dd className="text-right text-zinc-200">{sourceLabels[pitcher.source.arsenal]}</dd>
                </div>
              </dl>
            </div>

            <div className="mt-4 rounded border border-dashed border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-4">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Splits</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{sourceLabels[pitcher.source.splits]}</p>
              </div>
              <div className="mt-4 grid gap-2">
                {pitcher.splits.groups.map((split) => (
                  <div key={split.key} className="rounded border border-white/10 bg-[#101014] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-xs font-semibold text-zinc-200">{split.label}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{split.scope}</p>
                    </div>
                    {split.status === "live-people-stat-splits" ? (
                      <dl className="mt-3 grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-5">
                        <div>
                          <dt className="text-zinc-500">IP</dt>
                          <dd className="mt-1 text-zinc-100">{split.inningsPitched?.toFixed(1)}</dd>
                        </div>
                        <div>
                          <dt className="text-zinc-500">ERA</dt>
                          <dd className="mt-1 text-zinc-100">{formatNullableStat(split.era, 2)}</dd>
                        </div>
                        <div>
                          <dt className="text-zinc-500">K</dt>
                          <dd className="mt-1 text-zinc-100">{split.strikeouts}</dd>
                        </div>
                        <div>
                          <dt className="text-zinc-500">BB</dt>
                          <dd className="mt-1 text-zinc-100">{split.walks}</dd>
                        </div>
                        <div>
                          <dt className="text-zinc-500">AVG</dt>
                          <dd className="mt-1 text-zinc-100">{formatNullableStat(split.opponentAverage, 3)}</dd>
                        </div>
                      </dl>
                    ) : null}
                    <p className="mt-2 text-xs leading-5 text-zinc-500">{split.note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Start history</p>
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded border border-white/10 bg-[#101014] p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Recent starts</p>
                <p className="mt-2 font-serif text-3xl text-zinc-50">{pitcher.seasonLogSummary.recentStartCount}</p>
                <p className="mt-1 font-mono text-xs text-zinc-500">{pitcher.seasonLogSummary.averageInningsPitched.toFixed(1)} avg IP</p>
              </div>
              {pitcher.seasonLogSummary.lastStart ? <Link href={pitcher.seasonLogSummary.lastStart.startHref} className="rounded border border-white/10 bg-[#101014] p-4 transition hover:bg-white/[0.04]">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Last start</p>
                <p className="mt-2 font-mono text-sm text-zinc-50">
                  {pitcher.seasonLogSummary.lastStart.date} vs {pitcher.seasonLogSummary.lastStart.opponent}
                </p>
                <p className="mt-1 font-mono text-xs text-zinc-500">
                  {pitcher.seasonLogSummary.lastStart.result} / GS+ {pitcher.seasonLogSummary.lastStart.gameScorePlus}
                </p>
              </Link> : null}
              {pitcher.seasonLogSummary.bestStart ? <Link href={pitcher.seasonLogSummary.bestStart.startHref} className="rounded border border-white/10 bg-[#101014] p-4 transition hover:bg-white/[0.04]">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Best GS+</p>
                <p className="mt-2 font-serif text-3xl text-amber-300">{pitcher.seasonLogSummary.bestStart.gameScorePlus}</p>
                <p className="mt-1 font-mono text-xs text-zinc-500">
                  Avg GS+ {pitcher.seasonLogSummary.averageGameScorePlus.toFixed(1)}
                </p>
              </Link> : null}
            </div>
            <div className="mb-4 grid gap-3 rounded border border-white/10 bg-[#101014] p-3 md:grid-cols-[1fr_auto]">
              <div className="flex flex-wrap gap-2">
                {pitcher.seasonLogControls.options.sort.map((sort) => (
                  <Link
                    key={sort}
                    href={pitcherSeasonLogHref(pitcher.id, sort, pitcher.seasonLogControls.result)}
                    className={`min-h-11 rounded border px-3 py-2 font-mono text-xs transition ${pitcher.seasonLogControls.sort === sort ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 text-zinc-300 hover:bg-white/[0.04]"}`}
                  >
                    {sortLabels[sort]}
                  </Link>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {pitcher.seasonLogControls.options.result.map((result) => (
                  <Link
                    key={result}
                    href={pitcherSeasonLogHref(pitcher.id, pitcher.seasonLogControls.sort, result)}
                    className={`min-h-11 rounded border px-3 py-2 font-mono text-xs transition ${pitcher.seasonLogControls.result === result ? "border-zinc-100 bg-zinc-100 text-zinc-950" : "border-white/10 text-zinc-300 hover:bg-white/[0.04]"}`}
                  >
                    {resultLabels[result]}
                  </Link>
                ))}
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 md:col-span-2">
                Showing {pitcher.seasonLogControls.shownStartCount} of {pitcher.seasonLogControls.totalStartCount} starts
              </p>
            </div>
            <div className="overflow-hidden rounded border border-white/10">
              {pitcher.starts.length === 0 ? (
                <div className="bg-[#101014] p-6">
                  <p className="font-mono text-sm text-zinc-300">No starts match this season-log filter.</p>
                  <Link
                    href={pitcherSeasonLogHref(pitcher.id, pitcher.seasonLogControls.sort, "all")}
                    className="mt-3 inline-flex min-h-11 items-center rounded border border-white/10 px-3 py-2 font-mono text-xs text-amber-300 transition hover:bg-white/[0.04]"
                    data-responsive-check="pitcher-empty-filter-reset"
                  >
                    Show all starts
                  </Link>
                </div>
              ) : pitcher.starts.map((start) => (
                <Link
                  key={start.id}
                  href={start.startHref}
                  className="grid gap-3 border-b border-white/10 bg-[#101014] p-4 font-mono text-sm transition hover:bg-white/[0.04] last:border-b-0 md:grid-cols-[120px_minmax(0,1fr)_80px]"
                  data-responsive-check="pitcher-start-row"
                >
                  <span className="text-zinc-500">{start.date}</span>
                  <span className="min-w-0 text-zinc-200">
                    <span className="block text-zinc-50">
                      {start.result} vs {start.opponent}
                    </span>
                    <span className="mt-1 block text-zinc-400">{formatStartLine(start.line)}</span>
                  </span>
                  <span className="flex items-center justify-between gap-3 text-amber-300 md:block md:text-right">
                    <span>GS+ {start.gameScorePlus}</span>
                    <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-500 md:hidden" data-responsive-check="pitcher-start-affordance">
                      Start page
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
