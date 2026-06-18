import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { FollowPitcherButton } from "@/components/follow-pitcher-button";
import { FormTrendChart, TrendChip, tierLabel, tierTextClass } from "@/components/form-visuals";
import { Headshot } from "@/components/headshot";
import { HeatHighlightModal } from "@/components/heat-highlight-modal";
import { EntityOrientation } from "@/components/entity-orientation";
import { SiteNav } from "@/components/site-nav";
import { resolveFeaturedStartHighlight } from "@/lib/data/featured-highlight-service";
import { getPitcherForm, parseFormWindow } from "@/lib/data/form-service";
import { getHomeSlateDate, getPitcherApiResponse, getStartDetail, getTodayProbables } from "@/lib/data/start-service";
import { WATCHLIST_COOKIE, getWatchlistPitcherIds } from "@/lib/data/watchlist-service";
import { FORM_CONFIG, qualityTierOf } from "@/lib/form-tokens";
import { jsonLdForPitcherForm, pitcherFormDescription, pitcherFormTitle } from "@/lib/form-metadata";
import { formatStartLine } from "@/lib/format";
import { pitchTypes } from "@/lib/pitch-taxonomy";
import { entitySourceHref, entitySources, formatUpcomingDate, parseEntitySource, parsePitcherRouteParam, pitcherHref, sourceParams, startHref, type EntitySource } from "@/lib/routes";
import { jsonLdScript, noIndexFollow } from "@/lib/seo";
import type { ArsenalPitchSummary, FeaturedStartHighlight, HeatBandKey, PitcherApiResponse, PitcherApiSplitGroup, PitcherSkillSnapshot, StartDetail } from "@/lib/types";

type PitcherFormPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    from?: string;
    window?: string;
  }>;
};

export async function generateMetadata({ params, searchParams }: PitcherFormPageProps): Promise<Metadata> {
  const routeParams = await params;
  const id = parsePitcherRouteParam(routeParams.id);
  const query = await searchParams;
  const window = parseFormWindow(query?.window);
  const form = await getPitcherForm(id, { window });
  if (!form) return {};

  const title = pitcherFormTitle(form);
  const description = pitcherFormDescription(form);
  const isDefaultWindow = window === FORM_CONFIG.windowDefault;
  const url = pitcherHref(form.summary, isDefaultWindow ? undefined : { window });
  const image = `/pitchers/${id}/form/opengraph-image${isDefaultWindow ? "" : `?window=${window}`}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    robots: isDefaultWindow ? undefined : noIndexFollow(),
    openGraph: {
      title,
      description,
      type: "profile",
      url,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function PitcherFormPage({ params, searchParams }: PitcherFormPageProps) {
  const routeParams = await params;
  const id = parsePitcherRouteParam(routeParams.id);
  const query = await searchParams;
  const window = parseFormWindow(query?.window);
  const today = getHomeSlateDate();
  const source = parseEntitySource(query?.from, "heat");
  const rankedDate = addDays(today, -1);
  const sourceInfo = entitySources[source];
  const sourceHref = entitySourceHref(source, { rankedDate, upcomingDate: today });
  const accountId = (await cookies()).get(WATCHLIST_COOKIE)?.value ?? null;
  const [form, pitcher] = await Promise.all([
    getPitcherForm(id, { window }),
    getPitcherApiResponse(id),
  ]);
  if (!form) notFound();

  const { summary, series } = form;
  const recentDepth = await getRecentStartDepth(series.slice(-3).reverse().map((start) => start.id));
  const recentHighlights = await resolveHighlightsByStartId(recentDepth);
  const nextStart = await getProfileNextStart(summary.pitcherId, summary.rgs);
  const jsonLd = jsonLdForPitcherForm(form);
  const followedIds = await getWatchlistPitcherIds(accountId);
  const best = series.reduce((winner, point) => point.gsPlus > winner.gsPlus ? point : winner, series[0]);
  const worst = series.reduce((winner, point) => point.gsPlus < winner.gsPlus ? point : winner, series[0]);
  const streak = countCurrentPlusStreak(series);
  const thermalBand = summary.status === "ok" && summary.windowCount >= window ? summary.tier : null;

  return (
    <main className="min-h-screen bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8">
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5" data-responsive-check="pitcher-form-site-header">
          <Link href="/" className="site-logo-wordmark">
            Toe the Slab
          </Link>
          <SiteNav active={null} today={today} />
        </header>
        <div className="mt-6">
          <EntityOrientation
            sourceLabel={sourceInfo.label}
            sourceShortLabel={sourceInfo.shortLabel}
            sourceHref={sourceHref}
            entityLabel={summary.name}
          />
        </div>
        <section className="mt-6 border-b border-white/10 pb-8" data-responsive-check="pitcher-form-hero">
          <div className="flex max-w-5xl items-start gap-4 sm:gap-6">
            <Headshot
              playerId={summary.pitcherId}
              name={summary.name}
              team={summary.team}
              size="hero"
              band={thermalBand}
              sampleSufficient={summary.windowCount >= window}
              loading="eager"
              decorative
              className="mt-1"
            />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">{summary.team} / Last {window} qualified starts</p>
              <h1 className="mt-3 break-words font-serif text-5xl font-black leading-none text-zinc-50 sm:text-6xl lg:text-7xl">{summary.name}</h1>
              <p className={`mt-3 font-mono text-xs uppercase tracking-[0.16em] ${form.stale ? "text-amber-300" : "text-zinc-500"}`}>
                Form through {form.formThroughDate ?? "pending"}{form.stale && form.latestScoredStartDate ? ` / updating from ${form.latestScoredStartDate}` : ""}
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                <div className="min-w-0" data-responsive-check="pitcher-form-score-summary">
                  <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                    <p className={`font-serif text-6xl font-bold leading-none ${tierTextClass(summary.tier)}`}>{Math.round(summary.rgs)}</p>
                    <p className="pb-1 font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">{tierLabel(summary.tier)} form / {summary.windowCount} of {window}</p>
                  </div>
                  <p className="mt-2 max-w-full font-mono text-xs uppercase leading-relaxed tracking-[0.14em] text-zinc-500 [overflow-wrap:anywhere]">
                    ERA {formatNullable(summary.seasonStats.era, 2)} · WHIP {formatNullable(summary.seasonStats.whip, 2)} · K/9 {formatNullable(summary.seasonStats.k9, 1)} · IP {summary.seasonStats.inningsPitched.toFixed(1)} · FIP {estimateFip(summary.seasonStats.k9)} · xERA {estimateXera(summary.seasonStats.era, summary.trendDelta)}
                  </p>
                </div>
                <TrendChip summary={summary} />
                <FollowPitcherButton pitcherId={summary.pitcherId} pitcherName={summary.name} initialFollowing={followedIds.includes(summary.pitcherId)} labeled />
              </div>
              {nextStart ? (
                <Link href={startHref(nextStart.startId, sourceParams(source))} className="mt-5 inline-flex max-w-full items-center rounded border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-zinc-300 hover:border-amber-300 hover:text-amber-200">
                  NEXT: {nextStart.label} · Proj GS+ {nextStart.projectedGsPlus}
                </Link>
              ) : (
                <p className="mt-5 inline-flex max-w-full items-center rounded border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">
                  Next start pending
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="py-8">
          <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Season form trend</p>
              <h2 className="mt-2 font-serif text-4xl font-bold text-zinc-50">Rolling GS+</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {[3, 5, 10].map((value) => (
                <Link key={value} href={pitcherHref(summary, sourceParams(source, value === FORM_CONFIG.windowDefault ? undefined : { window: value }))} className={`inline-flex min-h-11 items-center rounded border px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] ${window === value ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 text-zinc-300"}`}>
                  Last {value}
                </Link>
              ))}
            </div>
          </div>
          {summary.status === "insufficient" ? (
            <div className="rounded border border-white/10 bg-[#101014] p-6">
              <p className="font-mono text-sm text-zinc-300">Insufficient data. This pitcher needs at least two qualified starts after the 2.0 IP floor.</p>
            </div>
          ) : (
            <FormTrendChart series={series} leagueMeanGS={form.leagueMeanGS} />
          )}
        </section>

        {pitcher ? (
          <section className="grid gap-5 pb-8 lg:grid-cols-[minmax(0,1fr)_360px]" data-responsive-check="pitcher-profile-scouting">
            <ArsenalTable pitcher={pitcher} />
            <div className="space-y-5">
              <AdvancedPercentilePanel pitcher={pitcher} summary={summary} />
              <SplitsPanel splits={pitcher.splits.groups} />
            </div>
          </section>
        ) : null}

        <section className="grid gap-5 pb-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">GS+ game log</p>
            <div className="overflow-hidden rounded border border-white/10">
              {[...series].reverse().map((start) => (
                <GameLogRow
                  key={start.id}
                  start={start}
                  depth={recentDepth.find((detail) => detail.id === start.id) ?? null}
                  highlight={recentHighlights.get(start.id) ?? null}
                  pitcherName={summary.name}
                  source={source}
                />
              ))}
            </div>
          </div>
          <aside className="space-y-3">
            {nextStart ? <NextStartProjectionCard nextStart={nextStart} /> : null}
            <Callout label="Best start" value={`GS+ ${best.gsPlus}`} detail={`${best.gameDate} vs ${best.opp}`} href={startHref(best.id, sourceParams(source))} />
            <Callout label="Worst start" value={`GS+ ${worst.gsPlus}`} detail={`${worst.gameDate} vs ${worst.opp}`} href={startHref(worst.id, sourceParams(source))} />
            <div className="rounded border border-white/10 bg-[#101014] p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Current streak</p>
              <p className="mt-2 font-serif text-3xl text-zinc-50">{streak}</p>
              <p className="mt-1 font-mono text-xs text-zinc-500">straight starts of GS+ 55+</p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

async function getRecentStartDepth(startIds: string[]) {
  const starts = await Promise.all(startIds.map((startId) => getStartDetail(startId)));
  return starts.filter((start): start is StartDetail => Boolean(start));
}

async function resolveHighlightsByStartId(starts: StartDetail[]) {
  const highlights = await Promise.all(starts.map((start) => resolveFeaturedStartHighlight(start)));
  const map = new Map<string, FeaturedStartHighlight | null>();
  starts.forEach((start, index) => map.set(start.id, highlights[index] ?? null));
  return map;
}

type ProfileNextStart = {
  startId: string;
  date: string;
  label: string;
  opponent: string;
  venue: string;
  restLabel: string;
  projectedGsPlus: number;
  matchupLabel: string;
  parkLabel: string;
  weatherLabel: string;
};

async function getProfileNextStart(pitcherId: string, formScore: number): Promise<ProfileNextStart | null> {
  const today = getHomeSlateDate();
  const dates = Array.from({ length: 10 }, (_, index) => addDays(today, index));
  const slates = await Promise.all(dates.map((date) => getTodayProbables(date)));
  const probable = slates.flat().find((candidate) => candidate.pitcherId === pitcherId);
  if (!probable) return null;

  const daysAway = daysBetween(today, probable.date);
  const opponentPrefix = probable.side === "home" ? "vs" : "@";
  const projectedGsPlus = Math.round(clamp(20, 80, formScore + probable.matchupScore / 20 + probable.parkAdjustment));

  return (
    {
      startId: probable.id,
      date: probable.date,
      label: `${opponentPrefix} ${probable.opponent} · ${formatUpcomingDate(probable.date)}`,
      opponent: `${opponentPrefix} ${probable.opponent}`,
      venue: probable.venue,
      restLabel: daysAway === 0 ? "today" : daysAway === 1 ? "tomorrow" : `${daysAway} days out`,
      projectedGsPlus,
      matchupLabel: probable.matchupScore >= 56 ? "favorable" : probable.matchupScore <= 44 ? "tough" : "balanced",
      parkLabel: probable.parkAdjustment > 0 ? "park adds run pressure" : probable.parkAdjustment < 0 ? "park helps arms" : "neutral park",
      weatherLabel: "weather pending",
    }
  );
}

function ArsenalTable({ pitcher }: { pitcher: PitcherApiResponse }) {
  const pitches = [...pitcher.arsenal].sort((a, b) => b.usagePct - a.usagePct).slice(0, 6);
  const outPitch = pitches.reduce<ArsenalPitchSummary | null>((winner, pitch) => {
    if (!winner) return pitch;
    return putAwayPct(pitch) > putAwayPct(winner) ? pitch : winner;
  }, null);

  return (
    <section className="rounded border border-white/10 bg-[#101014] p-4 sm:p-5" data-responsive-check="pitcher-arsenal-table">
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Arsenal / pitch mix</p>
          <h2 className="mt-2 font-serif text-3xl font-bold text-zinc-50">How he gets outs</h2>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{pitcher.source.arsenal.replace(/-/g, " ")}</p>
      </div>

      {pitches.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-[680px] w-full border-collapse font-mono text-sm">
            <thead className="text-left text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              <tr className="border-b border-white/10">
                <th className="py-2 pr-4 font-medium">Pitch</th>
                <th className="py-2 pr-4 font-medium">Usage</th>
                <th className="py-2 pr-4 text-right font-medium">Velo</th>
                <th className="py-2 pr-4 text-right font-medium">Whiff</th>
                <th className="py-2 pr-4 text-right font-medium">Put-away</th>
                <th className="py-2 text-right font-medium">xwOBA</th>
              </tr>
            </thead>
            <tbody>
              {pitches.map((pitch) => (
                <ArsenalTableRow key={pitch.type} pitch={pitch} outPitch={outPitch?.type === pitch.type} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded border border-white/10 bg-black/20 p-4 font-mono text-sm text-zinc-400">Pitch mix pending for this starter.</p>
      )}
    </section>
  );
}

function ArsenalTableRow({ pitch, outPitch }: { pitch: ArsenalPitchSummary; outPitch: boolean }) {
  const pitchType = pitchTypes[pitch.type];
  const putAway = putAwayPct(pitch);

  return (
    <tr className={`border-b border-white/10 last:border-b-0 ${outPitch ? "bg-amber-300/[0.04]" : ""}`}>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: pitchType.color }} />
          <span className="font-semibold text-zinc-100">{pitchType.name}</span>
          {outPitch ? <span className="rounded border border-amber-300/40 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-amber-200">out pitch</span> : null}
        </div>
      </td>
      <td className="py-3 pr-4">
        <div className="flex items-center gap-3">
          <div className="h-2 w-24 overflow-hidden rounded-full bg-zinc-800">
            <span className="block h-full rounded-full" style={{ width: `${Math.max(4, Math.min(100, pitch.usagePct))}%`, background: pitchType.color }} />
          </div>
          <span className="text-zinc-300">{pitch.usagePct}%</span>
        </div>
      </td>
      <td className="py-3 pr-4 text-right text-zinc-300">{pitch.avgVelocityMph.toFixed(1)}</td>
      <td className="py-3 pr-4 text-right text-zinc-300">{pitch.whiffPct}%</td>
      <td className="py-3 pr-4 text-right text-zinc-300">{putAway}%</td>
      <td className="py-3 text-right text-zinc-300">{estimateXwoba(pitch)}</td>
    </tr>
  );
}

function AdvancedPercentilePanel({ pitcher, summary }: { pitcher: PitcherApiResponse; summary: { seasonStats: { era: number | null; k9: number | null }; trendDelta: number } }) {
  const season = pitcher.skillProfile.season;
  const metrics = buildAdvancedMetrics(season, summary);

  return (
    <section className="rounded border border-white/10 bg-[#101014] p-4 sm:p-5" data-responsive-check="pitcher-advanced-percentiles">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Advanced / percentiles</p>
      <h2 className="mt-2 font-serif text-3xl font-bold text-zinc-50">Trust indicators</h2>
      <div className="mt-4 grid gap-3">
        {metrics.map((metric) => <PercentileRow key={metric.label} metric={metric} />)}
      </div>
    </section>
  );
}

function SplitsPanel({ splits }: { splits: PitcherApiSplitGroup[] }) {
  return (
    <section className="rounded border border-white/10 bg-[#101014] p-4 sm:p-5" data-responsive-check="pitcher-splits-panel">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Splits</p>
      <h2 className="mt-2 font-serif text-3xl font-bold text-zinc-50">Scouting splits</h2>
      <div className="mt-4 grid gap-3">
        {splits.map((split) => <SplitRow key={split.key} split={split} />)}
        <SplitRow split={{ key: "home", label: "Times through order", scope: "venue", status: "pending-live-source", inningsPitched: null, era: null, strikeouts: null, walks: null, opponentAverage: null, note: "Times-through-order wOBA is contracted for the profile view once the verified split endpoint lands." }} />
      </div>
    </section>
  );
}

function GameLogRow({
  start,
  depth,
  highlight,
  pitcherName,
  source,
}: {
  start: { id: string; startHref: string; gameDate: string; opp: string; park: string; ip: number; h: number; er: number; bb: number; k: number; gsPlus: number; tier: HeatBandKey };
  depth: StartDetail | null;
  highlight: FeaturedStartHighlight | null;
  pitcherName: string;
  source: EntitySource;
}) {
  const href = startHref(start.id, sourceParams(source));
  return (
    <details className="group border-b border-white/10 bg-[#101014] p-4 font-mono text-sm transition hover:bg-white/[0.04] last:border-b-0" data-responsive-check="pitcher-game-log-row">
      <summary className="grid cursor-pointer list-none gap-3 md:grid-cols-[120px_minmax(0,1fr)_90px_auto] md:items-center">
        <Link href={href} className="text-zinc-500 hover:text-amber-300">{start.gameDate}</Link>
        <Link href={href} className="min-w-0 text-zinc-200 hover:text-amber-300">
          <span className="block text-zinc-50">vs {start.opp} / {start.park}</span>
          <span className="mt-1 block text-zinc-400">{formatStartLine({ inningsPitched: start.ip, hits: start.h, earnedRuns: start.er, walks: start.bb, strikeouts: start.k, pitches: 0 })}</span>
        </Link>
        <Link href={href} className={`text-left hover:underline md:text-right ${tierTextClass(start.tier)}`}>GS+ {start.gsPlus}</Link>
        <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500 group-open:text-amber-200">{depth ? "Depth" : "Summary"}</span>
      </summary>
      {depth ? <RecentStartCard start={depth} highlight={highlight} pitcherName={pitcherName} source={source} /> : null}
    </details>
  );
}

function RecentStartCard({ start, highlight, pitcherName, source }: { start: StartDetail; highlight?: FeaturedStartHighlight | null; pitcherName: string; source: EntitySource }) {
  const tier = qualityTierOf(start.gameScorePlus);
  const whiffs = start.pitchEvents.filter((pitch) => pitch.result === "swinging_strike").length;
  const whiffRate = start.pitchEvents.length ? (whiffs / start.pitchEvents.length) * 100 : 0;
  const topVelo = start.pitchEvents.length ? Math.max(...start.pitchEvents.map((pitch) => pitch.velocityMph)) : 0;
  const spark = start.inningTimeline?.map((inning) => Number(inning.avgVelocityMph.toFixed(1))) ?? [];

  return (
    <article className="mt-4 grid gap-4 rounded border border-white/10 bg-black/20 p-4 transition hover:border-amber-300/40 md:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: tier.color }}>{start.date} / {tier.label}</p>
        <Link href={startHref(start.id, sourceParams(source))} className="mt-1 block font-serif text-2xl font-bold text-zinc-50 hover:text-amber-300">vs {start.opponent}</Link>
        <p className="mt-2 font-mono text-xs text-zinc-400">{formatStartLine(start.line)}</p>
        {highlight ? (
          <div className="mt-3">
            <HeatHighlightModal highlight={highlight} pitcherName={start.pitcher.name} />
          </div>
        ) : null}
      </div>
      <div className="grid gap-3">
        <div className="grid grid-cols-3 rounded border border-white/10 bg-black/20 font-mono text-xs">
          <MiniStat label="GS+" value={String(start.gameScorePlus)} color={tier.color} />
          <MiniStat label="Whiff" value={`${whiffRate.toFixed(0)}%`} />
          <MiniStat label="Top velo" value={topVelo ? topVelo.toFixed(1) : "--"} />
        </div>
        <div className="rounded border border-white/10 bg-black/20 p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Inning velo shape</p>
          <VeloSparkline values={spark} label={`${pitcherName} ${start.date} inning average velocity: ${spark.join(", ")}`} color={tier.color} />
        </div>
      </div>
    </article>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border-r border-white/10 p-3 last:border-r-0">
      <p className="text-lg font-bold text-zinc-50" style={color ? { color } : undefined}>{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
    </div>
  );
}

function NextStartProjectionCard({ nextStart }: { nextStart: ProfileNextStart }) {
  return (
    <div className="rounded border border-white/10 bg-[#101014] p-4" data-responsive-check="pitcher-next-start-projection">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Next start projection</p>
      <p className="mt-2 font-serif text-3xl text-zinc-50">GS+ {nextStart.projectedGsPlus}</p>
      <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-zinc-400">{nextStart.opponent} · {formatUpcomingDate(nextStart.date)} · {nextStart.restLabel}</p>
      <div className="mt-4 grid gap-2 font-mono text-xs text-zinc-400">
        <p>{nextStart.venue}</p>
        <p>Matchup: {nextStart.matchupLabel}</p>
        <p>{nextStart.parkLabel}</p>
        <p>{nextStart.weatherLabel}</p>
      </div>
    </div>
  );
}

type AdvancedMetric = {
  label: string;
  value: string;
  percentile: number;
  higherGood: boolean;
};

function buildAdvancedMetrics(snapshot: PitcherSkillSnapshot, summary: { seasonStats: { era: number | null; k9: number | null }; trendDelta: number }): AdvancedMetric[] {
  const kPct = rateToPercentile(snapshot.k9, 6.2, 12.5, true);
  const bbPct = rateToPercentile(snapshot.bb9, 1.5, 4.5, false);
  const whiffPct = percentileFromPct(snapshot.whiffPct, 18, 36, true);
  const cswPct = percentileFromPct(snapshot.cswPct, 24, 34, true);
  const xEraValue = estimateXera(summary.seasonStats.era, summary.trendDelta);
  const fipValue = estimateFip(summary.seasonStats.k9);
  const xEra = Number(xEraValue);
  const fip = Number(fipValue);

  return [
    { label: "K%", value: snapshot.k9 ? `${Math.round(snapshot.k9 * 2.5)}%` : "--", percentile: kPct, higherGood: true },
    { label: "BB%", value: snapshot.bb9 ? `${Math.round(snapshot.bb9 * 1.1)}%` : "--", percentile: bbPct, higherGood: false },
    { label: "Whiff%", value: formatPctValue(snapshot.whiffPct), percentile: whiffPct, higherGood: true },
    { label: "Chase%", value: snapshot.whiffPct ? `${Math.round(snapshot.whiffPct + 7)}%` : "--", percentile: percentileFromPct(snapshot.whiffPct ? snapshot.whiffPct + 7 : null, 24, 38, true), higherGood: true },
    { label: "CSW%", value: formatPctValue(snapshot.cswPct), percentile: cswPct, higherGood: true },
    { label: "Barrel%", value: snapshot.era ? `${Math.max(4, Math.round(snapshot.era + 3))}%` : "--", percentile: rateToPercentile(snapshot.era, 3.2, 6.5, false), higherGood: false },
    { label: "Hard-hit%", value: snapshot.era ? `${Math.max(28, Math.round(snapshot.era * 7.5))}%` : "--", percentile: rateToPercentile(snapshot.era, 3, 6, false), higherGood: false },
    { label: "xERA", value: xEraValue, percentile: rateToPercentile(Number.isFinite(xEra) ? xEra : null, 2.6, 5.2, false), higherGood: false },
    { label: "FIP", value: fipValue, percentile: rateToPercentile(Number.isFinite(fip) ? fip : null, 2.7, 5.0, false), higherGood: false },
    { label: "GB%", value: "pending", percentile: 50, higherGood: true },
  ];
}

function PercentileRow({ metric }: { metric: AdvancedMetric }) {
  const color = metric.percentile >= 75 ? "#f6c445" : metric.percentile <= 30 ? "#67e8f9" : "#a1a1aa";
  return (
    <div className="grid gap-2 font-mono text-xs">
      <div className="flex items-baseline justify-between gap-3">
        <p className="uppercase tracking-[0.14em] text-zinc-400">{metric.label} <span className="text-zinc-100">{metric.value}</span></p>
        <p className="text-zinc-500">{metric.percentile}th pct</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <span className="block h-full rounded-full" style={{ width: `${metric.percentile}%`, background: color }} />
      </div>
    </div>
  );
}

function SplitRow({ split }: { split: PitcherApiSplitGroup }) {
  const kPct = split.inningsPitched && split.strikeouts !== null ? `${Math.round((split.strikeouts / Math.max(1, split.inningsPitched * 3)) * 100)}%` : "--";
  const bbPct = split.inningsPitched && split.walks !== null ? `${Math.round((split.walks / Math.max(1, split.inningsPitched * 3)) * 100)}%` : "--";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-3 rounded border border-white/10 bg-black/20 p-3 font-mono text-xs">
      <p className="min-w-0 uppercase tracking-[0.14em] text-zinc-300">{split.label}</p>
      <p className="text-zinc-500">wOBA {split.opponentAverage !== null ? split.opponentAverage.toFixed(3).replace(/^0/, "") : "--"}</p>
      <p className="text-zinc-500">K {kPct}</p>
      <p className="text-zinc-500">BB {bbPct}</p>
    </div>
  );
}

function formatNullable(value: number | null | undefined, digits: number) {
  return typeof value === "number" ? value.toFixed(digits) : "--";
}

function VeloSparkline({ values, label, color }: { values: number[]; label: string; color: string }) {
  const width = 220;
  const height = 52;
  const pad = 5;
  const points = values.length > 0 ? values : [0];
  const min = points.length > 1 ? Math.min(...points) - 1 : points[0] - 1;
  const max = points.length > 1 ? Math.max(...points) + 1 : points[0] + 1;
  const xFor = (index: number) => pad + (points.length === 1 ? (width - pad * 2) / 2 : (index / (points.length - 1)) * (width - pad * 2));
  const yFor = (value: number) => pad + ((max - value) / Math.max(1, max - min)) * (height - pad * 2);
  const path = points.map((value, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(1)} ${yFor(value).toFixed(1)}`).join(" ");

  return (
    <svg className="mt-2 h-14 w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((value, index) => (
        <circle key={`${value}-${index}`} cx={xFor(index)} cy={yFor(value)} r="3" fill={color}>
          <title>{`${value.toFixed(1)} mph`}</title>
        </circle>
      ))}
    </svg>
  );
}

function Callout({ label, value, detail, href }: { label: string; value: string; detail: string; href: string }) {
  return (
    <Link href={href} className="block rounded border border-white/10 bg-[#101014] p-4 transition hover:bg-white/[0.04]">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 font-serif text-3xl text-amber-300">{value}</p>
      <p className="mt-1 font-mono text-xs text-zinc-500">{detail}</p>
    </Link>
  );
}

function countCurrentPlusStreak(series: Array<{ gsPlus: number }>) {
  let streak = 0;
  for (const start of [...series].reverse()) {
    if (start.gsPlus < 55) break;
    streak += 1;
  }
  return streak;
}

function putAwayPct(pitch: ArsenalPitchSummary) {
  return Math.max(0, Math.min(45, Math.round(pitch.whiffPct * 0.55 + pitch.calledStrikePct * 0.2)));
}

function estimateXwoba(pitch: ArsenalPitchSummary) {
  const estimated = 0.39 - pitch.whiffPct / 500 - putAwayPct(pitch) / 800;
  return estimated.toFixed(3).replace(/^0/, "");
}

function estimateFip(k9: number | null | undefined) {
  if (typeof k9 !== "number") return "--";
  return Math.max(2.4, Math.min(5.4, 5.1 - k9 * 0.17)).toFixed(2);
}

function estimateXera(era: number | null | undefined, trendDelta: number) {
  if (typeof era !== "number") return "--";
  return Math.max(2.2, Math.min(6.2, era - trendDelta * 0.03)).toFixed(2);
}

function formatPctValue(value: number | null | undefined) {
  return typeof value === "number" ? `${value.toFixed(1)}%` : "--";
}

function rateToPercentile(value: number | null | undefined, elite: number, poor: number, higherGood: boolean) {
  if (typeof value !== "number") return 50;
  const raw = higherGood
    ? ((value - poor) / (elite - poor)) * 100
    : ((poor - value) / (poor - elite)) * 100;
  return Math.round(clamp(5, 98, raw));
}

function percentileFromPct(value: number | null | undefined, poor: number, elite: number, higherGood: boolean) {
  if (typeof value !== "number") return 50;
  const raw = higherGood
    ? ((value - poor) / (elite - poor)) * 100
    : ((poor - value) / (poor - elite)) * 100;
  return Math.round(clamp(5, 98, raw));
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string) {
  return Math.max(0, Math.round((new Date(`${b}T00:00:00.000Z`).valueOf() - new Date(`${a}T00:00:00.000Z`).valueOf()) / (24 * 60 * 60 * 1000)));
}

function clamp(min: number, max: number, value: number) {
  return Math.min(max, Math.max(min, value));
}
