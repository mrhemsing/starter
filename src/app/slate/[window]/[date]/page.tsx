import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MatchupScoreBadge } from "@/components/matchup-score-badge";
import { ScoreComponentList } from "@/components/score-component-list";
import { ScoreDeltaComparison } from "@/components/score-delta-comparison";
import { ScoreExplainer } from "@/components/score-explainer";
import { ScoreReasonList } from "@/components/score-reason-list";
import { SiteHeader } from "@/components/site-header";
import { FormSparkline, TrendChip, tierLabel, tierTextClass } from "@/components/form-visuals";
import { PitcherAvailabilityNote } from "@/components/pitcher-availability";
import { getPitcherFormMap } from "@/lib/data/form-service";
import { addDays, getDailySlate, getHomeSlateDate, getSlateSchedule, getTodayProbables, summarizeSlateScoreScale } from "@/lib/data/start-service";
import { formatPct, formatSigned, formatStartLine } from "@/lib/format";
import { formatUpcomingDate, isSlateWindow, pitcherHref, sourceParams, startHref, upcomingDateHref, upcomingWeekHref } from "@/lib/routes";
import { assertValidDateRouteParam } from "@/lib/route-date-response";
import type { FormSummary, ProbableStart, StartSummary } from "@/lib/types";

type SlatePageProps = {
  params: Promise<{
    window: string;
    date: string;
  }>;
};

export default async function SlatePage({ params }: SlatePageProps) {
  const { window, date } = await params;
  if (!isSlateWindow(window)) notFound();
  assertValidDateRouteParam(date);
  if (window === "today" || window === "tomorrow") redirect(upcomingDateHref(date));
  if (window === "week") redirect(upcomingWeekHref(date));
  const today = getHomeSlateDate();
  const rankedDate = addDays(today, -1);

  const [starts, probables, schedule] = await Promise.all([getDailySlate({ window, date }), getTodayProbables(date), getSlateSchedule({ window, date })]);
  const formByPitcher = await getPitcherFormMap([...starts.map((start) => String(start.pitcher.mlbId)), ...probables.map((probable) => probable.pitcherId)], { window: 5, qualifiedOnly: false });
  const isToday = false;
  const completedSourceLabel = getCompletedSourceLabel(starts);
  const scoreScale = summarizeSlateScoreScale(starts);
  const gradeBandSummary = scoreScale.gradeBandCounts.filter((band) => band.count > 0).map((band) => `${band.label} ${band.count}`).join(" / ");
  const topCompletedStart = starts[0];
  const matchupRanks = rankProbableMatchups(probables);

  return (
    <main className="min-h-screen bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 border-b border-white/10 pb-6">
          <SiteHeader active="starts" today={today} rankedDate={rankedDate} />
          <h1 className="mt-4 font-serif text-5xl font-black capitalize text-zinc-50">{window} slate</h1>
          <p className="mt-2 font-mono text-sm text-zinc-500">
            {date} / {schedule.games.length} scheduled games
          </p>
          <p className="mt-3 inline-block rounded border border-white/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.16em] text-zinc-400">
            Schedule {schedule.source} / {completedSourceLabel}
          </p>
          {!isToday ? (
            <div className="mt-5 grid gap-3 font-mono text-xs sm:grid-cols-4">
              <ScaleStat label="GS+ range" value={`${scoreScale.low}-${scoreScale.high}`} />
              <ScaleStat label="Slate average" value={String(scoreScale.average)} />
              <ScaleStat label="Display scale" value={scoreScale.displayRange} />
              <ScaleStat label="Bands" value={gradeBandSummary || "No starts"} />
            </div>
          ) : null}
        </header>

        {isToday ? (
          <section className="grid gap-3 md:grid-cols-3">
            {probables.map((probable) => (
              <ProbableCard key={probable.id} probable={probable} form={formByPitcher.get(probable.pitcherId)} matchupRank={matchupRanks.get(probable.id)} date={date} />
            ))}
          </section>
        ) : (
          <>
            {topCompletedStart?.gameScorePlusBreakdown ? (
              <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <ScoreExplainer scoreScale={scoreScale} />
                <section className="rounded border border-white/10 bg-[#101014] p-5" data-responsive-check="slate-score-breakdown">
                  <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-end">
                    <div>
                      <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Full Game Score+ breakdown</p>
                      <h2 className="mt-2 font-serif text-3xl font-bold text-zinc-50">
                        #{topCompletedStart.rank} {topCompletedStart.pitcher.name}
                      </h2>
                      <p className="mt-2 text-sm text-zinc-400">{topCompletedStart.gameScorePlusBreakdown.gradeBand.description}</p>
                    </div>
                    <div className="font-mono text-xs text-zinc-500 md:text-right">
                      <p className="text-amber-300">{topCompletedStart.gameScorePlusBreakdown.formulaVersion}</p>
                      <p>
                        {topCompletedStart.gameScorePlusBreakdown.gradeBand.rangeLabel} / {topCompletedStart.gameScorePlusBreakdown.gradeBand.percentileLabel}
                      </p>
                    </div>
                  </div>
                  <ScoreComponentList components={topCompletedStart.gameScorePlusBreakdown.components} compact />
                </section>
                <ScoreDeltaComparison starts={starts} />
              </div>
            ) : null}

            <section className="grid gap-4 lg:grid-cols-3">
              {starts.map((start) => (
                <article key={start.id} className="rounded border border-white/10 bg-[#101014]" data-responsive-check="completed-slate-card">
                  <div className="p-5" style={{ borderTop: `4px solid ${start.accentColor}` }}>
                    <p className="font-mono text-xs uppercase tracking-[0.2em]" style={{ color: start.accentColor }}>
                      #{start.rank} / {start.pitcher.team}
                    </p>
                    <h2 className="mt-2 font-serif text-4xl font-bold text-white">{start.pitcher.name}</h2>
                    <p className="mt-3 font-mono text-sm text-zinc-300">{formatStartLine(start.line)}</p>
                    <p className="mt-3 text-sm text-zinc-400">{start.context.label}</p>
                    <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
                      Line source: {getStartLineSourceLabel(start)}
                    </p>
                    {formByPitcher.get(String(start.pitcher.mlbId)) ? (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className={`rounded border border-white/10 px-2.5 py-1 font-mono text-xs uppercase tracking-[0.12em] ${tierTextClass(formByPitcher.get(String(start.pitcher.mlbId))!.tier)}`}>
                          Form {Math.round(formByPitcher.get(String(start.pitcher.mlbId))!.rgs)} / {tierLabel(formByPitcher.get(String(start.pitcher.mlbId))!.tier)}
                        </span>
                        <TrendChip summary={formByPitcher.get(String(start.pitcher.mlbId))!} compact />
                        <PitcherAvailabilityNote availability={formByPitcher.get(String(start.pitcher.mlbId))!.availability} compact />
                      </div>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-5 font-mono text-xs text-zinc-400 sm:grid-cols-5">
                    <span>GS+ {start.gameScorePlus}</span>
                    {typeof start.gameScoreV2 === "number" ? <span>GSv2 {start.gameScoreV2}</span> : null}
                    <span data-slate-start-decision={start.result}>{formatDecisionLabel(start.result)}</span>
                    <span>{start.gameScorePlusBreakdown?.gradeBand.label ?? "Unbanded"}</span>
                    <span>{formatGsAdjustment(start)}</span>
                  </div>
                  {start.eventFlags?.length ? (
                    <div className="flex flex-wrap gap-1.5 border-t border-white/10 px-5 py-3" data-slate-start-event-flags={start.eventFlags.join(",")}>
                      {start.eventFlags.map((flag) => (
                        <span key={flag} className="rounded border border-white/10 bg-black/20 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-300">
                          {formatStartEventFlag(flag)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-2 border-t border-white/10 p-5 font-mono text-xs text-zinc-400">
                    <span>Velo {formatSigned(start.context.velocityDeltaMph)}</span>
                    <span>Whiff {formatPct(start.context.whiffDeltaPct)}</span>
                  </div>
                  <div className="border-t border-white/10 px-5 py-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Ranking reasons</p>
                    <div className="mt-3">
                      <ScoreReasonList reasons={getScoreReasons(start)} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-white/10 p-5 font-mono text-xs uppercase tracking-[0.16em]" data-responsive-check="slate-card-actions">
                    <Link href={startHref(start, sourceParams("starts"))} className="inline-flex min-h-11 items-center rounded border border-amber-300/30 px-3 text-amber-300">
                      Start page
                    </Link>
                    <Link href={pitcherHref({ id: start.pitcher.id, name: start.pitcher.name }, sourceParams("starts"))} className="inline-flex min-h-11 items-center rounded border border-white/10 px-3 text-zinc-400">
                      Pitcher
                    </Link>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function ProbableCard({
  probable,
  form,
  matchupRank,
  date,
}: {
  probable: ProbableStart;
  form?: FormSummary;
  matchupRank?: number;
  date: string;
}) {
  return (
    <article className="rounded border border-white/10 bg-[#101014] p-5">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-300">{probable.status}</p>
      <p className="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">{probable.gameLabel}</p>
      <h2 className="mt-3 font-serif text-3xl font-bold text-zinc-50">
        {probable.pitcherName} vs {probable.opponent}
      </h2>
      <p className="mt-2 text-sm text-zinc-400">{probable.venue}</p>
      <div className="mt-3">
        <MatchupScoreBadge score={probable.matchupScore} rank={matchupRank} compact rankLabel={`on ${formatUpcomingDate(date)}`} />
        <p className="mt-2 font-mono text-xs text-zinc-500">Park adj {formatSigned(probable.parkAdjustment)}</p>
      </div>
      {form ? (
        <div className="mt-4 rounded border border-white/10 bg-black/20 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded border border-white/10 px-2.5 py-1 font-mono text-xs uppercase tracking-[0.12em] ${tierTextClass(form.tier)}`}>
              Form {Math.round(form.rgs)} / {tierLabel(form.tier)}
            </span>
            <TrendChip summary={form} compact />
            <PitcherAvailabilityNote availability={form.availability} compact />
          </div>
          <div className="mt-3">
            <FormSparkline values={form.spark} tier={form.tier} leagueMeanGS={form.bgs} label={`${form.name} recent form GS+: ${form.spark.join(", ")}`} />
          </div>
        </div>
      ) : null}
      <Link
        href={pitcherHref({ pitcherId: probable.pitcherId, name: probable.pitcherName }, sourceParams("upcoming"))}
        className="mt-5 inline-flex min-h-11 items-center rounded border border-white/10 px-3 font-mono text-xs uppercase tracking-[0.16em] text-zinc-300"
        data-responsive-check="probable-pitcher-affordance"
      >
        Pitcher page
      </Link>
    </article>
  );
}

function ScaleStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-[#101014] p-3">
      <p className="text-zinc-50">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
    </div>
  );
}

function getScoreReasons(start: StartSummary) {
  return start.gameScorePlusBreakdown?.rankingReasons ?? [];
}

function getCompletedSourceLabel(starts: StartSummary[]) {
  if (starts.some((start) => start.source?.line === "archive-gamefeed")) return "Archived gamefeed lines";
  if (starts.some((start) => start.source?.line === "live-gamefeed")) return "Live gamefeed lines";
  return "Scheduled line estimate";
}

function getStartLineSourceLabel(start: StartSummary) {
  if (start.source?.line === "archive-gamefeed") return "archive";
  if (start.source?.line === "live-gamefeed") return "MLB gamefeed";
  return "scheduled estimate";
}

function formatGsAdjustment(start: StartSummary) {
  if (typeof start.gameScoreV2 !== "number") return start.gameScorePlusBreakdown?.gradeBand.percentileLabel ?? "20-80 scale";
  return `GS+ ${formatSigned(start.gameScorePlus - start.gameScoreV2)} adj`;
}

function formatStartEventFlag(flag: NonNullable<StartSummary["eventFlags"]>[number]) {
  if (flag === "HARD_LUCK") return "Hard luck";
  return "Vulture";
}

function formatDecisionLabel(result: StartSummary["result"]) {
  if (result === "W") return "Win";
  if (result === "L") return "Loss";
  return "No decision";
}

function rankProbableMatchups(probables: Array<{ id: string; matchupScore: number }>) {
  return new Map(
    [...probables]
      .sort((a, b) => b.matchupScore - a.matchupScore || a.id.localeCompare(b.id))
      .map((probable, index) => [probable.id, index + 1]),
  );
}
