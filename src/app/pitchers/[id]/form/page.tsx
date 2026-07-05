import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { FollowPitcherButton } from "@/components/follow-pitcher-button";
import { TrendChip, tierLabel, tierTextClass } from "@/components/form-visuals";
import { Headshot } from "@/components/headshot";
import { HeatHighlightModal } from "@/components/heat-highlight-modal";
import { EntityOrientation } from "@/components/entity-orientation";
import { PitcherAvailabilityNote } from "@/components/pitcher-availability";
import { PitcherProfileScrollReset } from "@/components/pitcher-profile-scroll-reset";
import { SiteHeader } from "@/components/site-header";
import { PitcherFormWindowPanel } from "@/components/pitcher-form-window-panel";
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
import { startMatchupLabel } from "@/lib/start-matchup-label";
import type { ArsenalPitchSummary, FeaturedStartHighlight, FormPitcherResponse, FormStartPoint, FormSummary, FormVenueSplitLabel, PitcherApiResponse, PitcherApiSplitGroup, PitcherPitchMixStart, PitcherSkillSnapshot, PitcherVelocityStart, StartDetail } from "@/lib/types";

type PitcherFormPageProps = {
  params: Promise<{
    id: string;
  }>;
  initialForm?: FormPitcherResponse | null;
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

export default async function PitcherFormPage({ params, initialForm, searchParams }: PitcherFormPageProps) {
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
  const followedIdsPromise = getWatchlistPitcherIds(accountId);
  const form = initialForm ?? await getPitcherForm(id, { window });
  if (!form) notFound();

  const { summary, series } = form;
  const recentStartIds = series.slice(-3).reverse().map((start) => start.id);
  const pitcherPromise = getPitcherApiResponse(id);
  const recentDepthBundlePromise = getRecentStartDepthWithHighlights(recentStartIds);
  const nextStartPromise = getProfileNextStart(summary.pitcherId, summary.rgs);
  const followedIds = await followedIdsPromise;
  const jsonLd = jsonLdForPitcherForm(form);
  const best = series.reduce((winner, point) => point.gsPlus > winner.gsPlus ? point : winner, series[0]);
  const worst = series.reduce((winner, point) => point.gsPlus < winner.gsPlus ? point : winner, series[0]);
  const streak = countCurrentPlusStreak(series);
  const thermalBand = summary.status === "ok" && summary.windowCount >= window ? summary.tier : null;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8">
      <PitcherProfileScrollReset />
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <div className="mx-auto max-w-7xl">
        <SiteHeader active={null} today={today} responsiveCheck="pitcher-form-site-header" />
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
                {form.formThroughDate
                  ? `Form through ${form.formThroughDate}${form.stale && form.latestScoredStartDate ? ` / updating from ${form.latestScoredStartDate}` : ""}`
                  : "Form data loading"}
              </p>
              <PitcherAvailabilityNote availability={summary.availability} className="mt-3" />
              <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                <div className="min-w-0" data-responsive-check="pitcher-form-score-summary">
                  <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                    <p className={`font-serif text-6xl font-bold leading-none ${tierTextClass(summary.tier)}`}>{Math.round(summary.rgs)}</p>
                    <p className="pb-1 font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">{tierLabel(summary.tier)} form / {summary.windowCount} of {window}</p>
                  </div>
                  <p className="mt-2 max-w-full font-mono text-xs uppercase leading-relaxed tracking-[0.14em] text-zinc-500 [overflow-wrap:anywhere]">
                    ERA {formatNullable(summary.seasonStats.era, 2)} · WHIP {formatNullable(summary.seasonStats.whip, 2)} · K/9 {formatNullable(summary.seasonStats.k9, 1)} · IP {summary.seasonStats.inningsPitched.toFixed(1)} · W-L {formatSeasonDecisionRecord(summary.seasonDecisionRecord)}
                  </p>
                  {summary.venueSplit ? <HomeRoadSplitBadge split={summary.venueSplit} /> : null}
                </div>
                <TrendChip summary={summary} />
                <FollowPitcherButton pitcherId={summary.pitcherId} pitcherName={summary.name} initialFollowing={followedIds.includes(summary.pitcherId)} labeled />
              </div>
              <Suspense fallback={null}>
                <ProfileNextStartPill nextStartPromise={nextStartPromise} source={source} venueSplit={summary.venueSplit ?? null} />
              </Suspense>
            </div>
          </div>
        </section>

        <section className="py-8">
          <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Season form trend</p>
              <h2 className="mt-2 font-serif text-4xl font-bold text-zinc-50">Rolling GS+</h2>
            </div>
          </div>
          {summary.status === "insufficient" ? (
            <div className="rounded border border-white/10 bg-[#101014] p-6">
              <p className="font-mono text-sm text-zinc-300">Insufficient data. This pitcher needs at least two qualified starts after the 2.0 IP floor.</p>
            </div>
          ) : (
            <PitcherFormWindowPanel initialWindow={window} series={series} leagueMeanGS={form.leagueMeanGS} />
          )}
        </section>

        <Suspense fallback={null}>
          <PitcherProfileBody
            pitcherPromise={pitcherPromise}
            series={series}
            recentDepthBundlePromise={recentDepthBundlePromise}
            nextStartPromise={nextStartPromise}
            summary={summary}
            source={source}
            best={best}
            worst={worst}
            streak={streak}
          />
        </Suspense>
      </div>
    </main>
  );
}

async function ProfileNextStartPill({
  nextStartPromise,
  source,
  venueSplit,
}: {
  nextStartPromise: Promise<ProfileNextStart | null>;
  source: EntitySource;
  venueSplit: FormVenueSplitLabel | null;
}) {
  const nextStart = await nextStartPromise;
  const venueSplitContext = nextStart && venueSplit ? venueSplitContextForNextStart(venueSplit, nextStart.side) : null;

  if (!nextStart) {
    return (
      <p className="mt-5 inline-flex max-w-full items-center rounded border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">
        No confirmed next start
      </p>
    );
  }

  return (
    <Link href={startHref(nextStart.startId, sourceParams(source))} className="mt-5 inline-flex max-w-full items-center rounded border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-zinc-300 hover:border-amber-300 hover:text-amber-200">
      NEXT: {nextStart.label} · Proj GS+ {nextStart.projectedGsPlus}
      {venueSplitContext ? <span className={venueSplitContext.toneClass}> · {venueSplitContext.label}</span> : null}
    </Link>
  );
}

async function PitcherProfileBody({
  pitcherPromise,
  series,
  recentDepthBundlePromise,
  nextStartPromise,
  summary,
  source,
  best,
  worst,
  streak,
}: {
  pitcherPromise: Promise<PitcherApiResponse | null>;
  series: FormStartPoint[];
  recentDepthBundlePromise: Promise<Awaited<ReturnType<typeof getRecentStartDepthWithHighlights>>>;
  nextStartPromise: Promise<ProfileNextStart | null>;
  summary: FormSummary;
  source: EntitySource;
  best: FormStartPoint;
  worst: FormStartPoint;
  streak: number;
}) {
  const [pitcher, recentDepthBundle, nextStart] = await Promise.all([pitcherPromise, recentDepthBundlePromise, nextStartPromise]);
  const { recentDepth, recentHighlights } = recentDepthBundle;
  const venueSplitContext = nextStart && summary.venueSplit ? venueSplitContextForNextStart(summary.venueSplit, nextStart.side) : null;

  return (
    <section className="grid min-w-0 gap-5 pb-8 lg:grid-cols-[minmax(0,1fr)_360px]" data-responsive-check="pitcher-profile-stacks">
      <div className="min-w-0 space-y-5" data-responsive-check="pitcher-profile-left-stack">
        {pitcher ? <ArsenalTable pitcher={pitcher} /> : null}
        {pitcher ? <VelocityByStartPanel starts={pitcher.velocityByStart} /> : null}
        {pitcher ? <PitchMixByStartPanel starts={pitcher.pitchMixByStart} /> : null}
        {nextStart ? (
          <div className="lg:hidden">
            <NextStartProjectionCard nextStart={nextStart} venueSplitContext={venueSplitContext} />
          </div>
        ) : null}
        <GameLogPanel
          series={series}
          recentDepth={recentDepth}
          recentHighlights={recentHighlights}
          pitcherName={summary.name}
          source={source}
        />
      </div>
      <aside className="min-w-0 space-y-5" data-responsive-check="pitcher-profile-right-stack">
        {nextStart ? (
          <div className="hidden lg:block">
            <NextStartProjectionCard nextStart={nextStart} venueSplitContext={venueSplitContext} />
          </div>
        ) : null}
        {pitcher ? <AdvancedPercentilePanel pitcher={pitcher} /> : null}
        <SplitsPanel splits={pitcher?.splits.groups ?? []} venueSplit={summary.venueSplit ?? null} />
        <Callout label="Best start" value={`GS+ ${best.gsPlus}`} detail={`${best.gameDate} ${formStartMatchupLabel(best)}`} href={startHref(best.id, sourceParams(source))} />
        <Callout label="Worst start" value={`GS+ ${worst.gsPlus}`} detail={`${worst.gameDate} ${formStartMatchupLabel(worst)}`} href={startHref(worst.id, sourceParams(source))} />
        <div className="rounded border border-white/10 bg-[#101014] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Current streak</p>
          <p className="mt-2 font-serif text-3xl text-zinc-50">{streak}</p>
          <p className="mt-1 font-mono text-xs text-zinc-500">straight starts of GS+ 55+</p>
        </div>
      </aside>
    </section>
  );
}

function GameLogPanel({
  series,
  recentDepth,
  recentHighlights,
  pitcherName,
  source,
}: {
  series: FormStartPoint[];
  recentDepth: StartDetail[];
  recentHighlights: Map<string, FeaturedStartHighlight | null>;
  pitcherName: string;
  source: EntitySource;
}) {
  return (
    <div className="min-w-0" data-responsive-check="pitcher-profile-game-log">
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">GS+ game log</p>
      <div className="overflow-hidden rounded border border-white/10">
        {[...series].reverse().map((start) => (
          <GameLogRow
            key={start.id}
            start={start}
            depth={recentDepth.find((detail) => detail.id === start.id) ?? null}
            highlight={recentHighlights.get(start.id) ?? null}
            pitcherName={pitcherName}
            source={source}
          />
        ))}
      </div>
    </div>
  );
}

async function getRecentStartDepth(startIds: string[]) {
  const starts = await Promise.all(startIds.map((startId) => getStartDetail(startId)));
  return starts.filter((start): start is StartDetail => Boolean(start));
}

async function getRecentStartDepthWithHighlights(startIds: string[]) {
  const recentDepth = await getRecentStartDepth(startIds);
  const recentHighlights = await resolveHighlightsByStartId(recentDepth);

  return {
    recentDepth,
    recentHighlights,
  };
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
  side: "home" | "away";
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
      side: probable.side,
      venue: probable.venue,
      restLabel: daysAway === 0 ? "today" : daysAway === 1 ? "tomorrow" : `${daysAway} days out`,
      projectedGsPlus,
      matchupLabel: probable.matchupScore >= 56 ? "favorable" : probable.matchupScore <= 44 ? "tough" : "balanced",
      parkLabel: probable.parkAdjustment > 0 ? "park adds run pressure" : probable.parkAdjustment < 0 ? "park helps arms" : "neutral park",
      weatherLabel: "weather context closer to first pitch",
    }
  );
}

function ArsenalTable({ pitcher }: { pitcher: PitcherApiResponse }) {
  const pitches = [...pitcher.arsenal].sort((a, b) => b.usagePct - a.usagePct).slice(0, 6);
  if (pitches.length === 0) return null;

  const outPitch = pitches.reduce<ArsenalPitchSummary | null>((winner, pitch) => {
    if (!winner) return pitch;
    return putAwayPct(pitch) > putAwayPct(winner) ? pitch : winner;
  }, null);

  return (
    <section className="min-w-0 rounded border border-white/10 bg-[#101014] p-4 sm:p-5" data-responsive-check="pitcher-arsenal-table">
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Arsenal / pitch mix</p>
          <h2 className="mt-2 font-serif text-3xl font-bold text-zinc-50">How he gets outs</h2>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500" title={formatArsenalSourceTitle(pitcher)}>
          {formatArsenalSourceLabel(pitcher)}
        </p>
      </div>

      <div className="max-w-full overflow-x-auto">
        <table className="min-w-[680px] w-full border-collapse font-mono text-sm">
          <thead className="text-left text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            <tr className="border-b border-white/10">
              <th className="py-2 pr-4 font-medium">Pitch</th>
              <th className="py-2 pr-4 font-medium">Usage</th>
              <th className="py-2 pr-4 text-right font-medium">Velo</th>
              <th className="py-2 pr-4 text-right font-medium">Whiff</th>
              <th className="py-2 pr-4 text-right font-medium">Put-away</th>
              <th className="py-2 text-right font-medium">CSW</th>
            </tr>
          </thead>
          <tbody>
            {pitches.map((pitch) => (
              <ArsenalTableRow key={pitch.type} pitch={pitch} outPitch={outPitch?.type === pitch.type} />
            ))}
          </tbody>
        </table>
      </div>
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
      <td className="py-3 text-right text-zinc-300">{pitch.whiffPct + pitch.calledStrikePct}%</td>
    </tr>
  );
}

function formatArsenalSourceLabel(pitcher: PitcherApiResponse) {
  if (pitcher.source.archiveArsenal) return `Archive through ${pitcher.source.archiveArsenal.lastStartDate}`;
  if (pitcher.source.arsenal === "fixture") return "More data after next archive run";
  return pitcher.source.arsenal.replace(/-/g, " ");
}

function formatArsenalSourceTitle(pitcher: PitcherApiResponse) {
  const archive = pitcher.source.archiveArsenal;
  if (!archive) return "Pitch mix expands after the next archive run.";
  return `${archive.starts} starts, ${archive.pitchEvents} pitches archived from ${archive.firstStartDate} through ${archive.lastStartDate}. Last updated ${archive.archivedAt}.`;
}

function VelocityByStartPanel({ starts }: { starts: PitcherVelocityStart[] }) {
  const rows = starts.slice(0, 8);
  if (rows.length < 2) return null;

  const maxVelocity = Math.max(1, ...rows.map((start) => start.avgVelocityMph));

  return (
    <section className="min-w-0 rounded border border-white/10 bg-[#101014] p-4 sm:p-5" data-responsive-check="pitcher-velocity-by-start">
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Velocity / by start</p>
          <h2 className="mt-2 font-serif text-3xl font-bold text-zinc-50">Fastball shape</h2>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">last {rows.length || 0}</p>
      </div>

      <div className="space-y-3">
        {rows.map((start) => (
          <Link key={start.id} href={start.startHref} className="grid gap-2 rounded border border-white/10 bg-black/20 p-3 transition hover:border-amber-300/40 sm:grid-cols-[minmax(0,1fr)_120px] sm:items-center">
            <div className="min-w-0">
              <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{start.date} · vs {start.opponent}</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                <span className={`block h-full rounded-full ${start.belowSeasonMedian ? "bg-cyan-300" : "bg-amber-300"}`} style={{ width: `${Math.max(12, (start.avgVelocityMph / maxVelocity) * 100)}%` }} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 font-mono text-xs sm:block sm:text-right">
              <span className="text-zinc-100">{start.avgVelocityMph.toFixed(1)} avg</span>
              <span className="text-zinc-500 sm:mt-1 sm:block">{start.maxVelocityMph.toFixed(1)} max</span>
              {start.belowSeasonMedian ? <span className="rounded border border-cyan-300/30 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-cyan-200 sm:mt-2 sm:inline-block">low velo</span> : null}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function PitchMixByStartPanel({ starts }: { starts: PitcherPitchMixStart[] }) {
  const rows = starts.slice(0, 6);
  if (rows.length < 2) return null;

  return (
    <section className="min-w-0 rounded border border-white/10 bg-[#101014] p-4 sm:p-5" data-responsive-check="pitcher-pitch-mix-by-start">
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Pitch mix / by start</p>
          <h2 className="mt-2 font-serif text-3xl font-bold text-zinc-50">Usage shape</h2>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">last {rows.length || 0}</p>
      </div>

      <div className="space-y-3">
        {rows.map((start) => (
          <Link key={start.id} href={start.startHref} className="block rounded border border-white/10 bg-black/20 p-3 transition hover:border-amber-300/40">
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{start.date} · vs {start.opponent}</p>
              <p className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">{start.pitches} pitches</p>
            </div>
            {start.newPitchTypes.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {start.newPitchTypes.slice(0, 3).map((type) => (
                  <span key={type} className="rounded border border-amber-300/35 bg-amber-300/[0.08] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-amber-200">
                    New {pitchTypes[type].name}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-zinc-800" aria-hidden="true">
              {start.mix.map((pitch) => (
                <span key={pitch.type} className="block h-full" style={{ width: `${pitch.usagePct}%`, background: pitchTypes[pitch.type].color }} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
              {start.mix.slice(0, 4).map((pitch) => (
                <span key={pitch.type}>
                  {pitchTypes[pitch.type].name} {pitch.usagePct}%
                  {pitch.firstSeen ? <span className="ml-1 text-amber-200">new pitch</span> : null}
                  {pitch.usageDeltaPct !== null && Math.abs(pitch.usageDeltaPct) >= 5 ? (
                    <span className={pitch.usageDeltaPct > 0 ? "ml-1 text-emerald-300" : "ml-1 text-cyan-300"}>
                      {pitch.usageDeltaPct > 0 ? "+" : ""}{pitch.usageDeltaPct} usage shift
                    </span>
                  ) : null}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function AdvancedPercentilePanel({ pitcher }: { pitcher: PitcherApiResponse }) {
  const snapshots = [pitcher.skillProfile.season, pitcher.skillProfile.trailing30].filter((snapshot) => snapshot.pitchCount > 0);
  const hasTrend = pitcher.skillProfile.trend.status === "available";
  if (snapshots.length === 0 && !hasTrend) return null;

  return (
    <section className="min-w-0 rounded border border-white/10 bg-[#101014] p-4 sm:p-5" data-responsive-check="pitcher-advanced-percentiles">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Archive quality</p>
          <h2 className="mt-2 font-serif text-3xl font-bold text-zinc-50">Pitch-event skills</h2>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{pitcher.skillProfile.statcastStatus}</p>
      </div>
      <div className="mt-4 grid gap-3">
        {snapshots.map((snapshot) => <PitcherSkillSnapshotCard key={snapshot.label} snapshot={snapshot} />)}
      </div>
      {hasTrend ? <PitcherSkillTrendCard trend={pitcher.skillProfile.trend} /> : null}
      <p className="mt-4 text-xs leading-5 text-zinc-500">{pitcher.skillProfile.note}</p>
    </section>
  );
}

function HomeRoadSplitBadge({ split }: { split: FormVenueSplitLabel }) {
  const strong = split.strongSide === "home" ? split.home : split.away;
  const weak = split.weakSide === "home" ? split.home : split.away;
  const tone = split.strongSide === "home" ? "border-orange-300/35 text-orange-200" : "border-cyan-300/35 text-cyan-200";

  return (
    <div className={`mt-3 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded border bg-black/20 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] ${tone}`} data-responsive-check="home-road-split-badge">
      <span>{split.label}</span>
      <span className="text-zinc-500">·</span>
      <span>+{split.gap.toFixed(0)} vs {split.weakSide === "home" ? "home" : "road"}</span>
      <span className="text-zinc-500">·</span>
      <span className="text-zinc-400">{strong.starts}/{weak.starts} starts</span>
    </div>
  );
}

type VenueSplitContext = {
  label: string;
  toneClass: string;
};

function venueSplitContextForNextStart(split: FormVenueSplitLabel, side: "home" | "away"): VenueSplitContext {
  if (side === split.strongSide) {
    return {
      label: `${split.label === "HOME FORTRESS" ? "Home fortress" : "Road warrior"} — ${side === "home" ? "home" : "away"} start tailwind`,
      toneClass: "text-emerald-300",
    };
  }

  return {
    label: `${split.weakSide === "home" ? "Fades at home" : "Fades on the road"} — ${side === "home" ? "home" : "away"} start headwind`,
    toneClass: "text-amber-300",
  };
}

function SplitsPanel({ splits, venueSplit }: { splits: PitcherApiSplitGroup[]; venueSplit: FormVenueSplitLabel | null }) {
  const realSplits = splits.filter(hasRealSplitValues);
  if (!venueSplit && realSplits.length === 0) return null;

  return (
    <section className="min-w-0 rounded border border-white/10 bg-[#101014] p-4 sm:p-5" data-responsive-check="pitcher-splits-panel">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Splits</p>
      <h2 className="mt-2 font-serif text-3xl font-bold text-zinc-50">Scouting splits</h2>
      {venueSplit ? (
        <div className="mt-4 rounded border border-white/10 bg-black/20 p-3" data-responsive-check="home-road-split-evidence">
          <HomeRoadSplitBadge split={venueSplit} />
          <p className="mt-2 font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-zinc-500">
            Home GS+ {venueSplit.home.gsPlus.toFixed(1)} ({venueSplit.home.starts} starts) · Road GS+ {venueSplit.away.gsPlus.toFixed(1)} ({venueSplit.away.starts} starts) · current + prior seasons
          </p>
        </div>
      ) : null}
      {realSplits.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {realSplits.map((split) => <SplitRow key={split.key} split={split} />)}
        </div>
      ) : null}
    </section>
  );
}

function hasRealSplitValues(split: PitcherApiSplitGroup) {
  return split.status === "live-people-stat-splits" && (
    split.inningsPitched !== null ||
    split.opponentAverage !== null ||
    split.strikeouts !== null ||
    split.walks !== null
  );
}

function GameLogRow({
  start,
  depth,
  highlight,
  pitcherName,
  source,
}: {
  start: FormStartPoint;
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
          <span className="block text-zinc-50">{formStartMatchupLabel(start)} / {start.park}</span>
          <span className="mt-1 block text-zinc-400">{formatStartLine({ inningsPitched: start.ip, hits: start.h, earnedRuns: start.er, walks: start.bb, strikeouts: start.k, pitches: 0 })}</span>
        </Link>
        <Link href={href} className={`text-left hover:underline md:text-right ${tierTextClass(start.tier)}`}>GS+ {start.gsPlus}</Link>
        <span className="flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-zinc-500 group-open:text-amber-200">
          <DecisionPill result={start.result} />
          <span>{depth ? "Depth" : "Summary"}</span>
        </span>
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
        <Link href={startHref(start.id, sourceParams(source))} className="mt-1 block font-serif text-2xl font-bold text-zinc-50 hover:text-amber-300">{startMatchupLabel(start)}</Link>
        <p className="mt-2 font-mono text-xs text-zinc-400">{formatStartLine(start.line)}</p>
        <DecisionPill result={start.result} className="mt-3" />
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

function DecisionPill({ result, className = "" }: { result: FormStartPoint["result"]; className?: string }) {
  return (
    <span
      className={`inline-flex min-h-7 w-fit items-center rounded border border-white/10 bg-white/5 px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-300 ${className}`}
      data-pitcher-start-decision={result}
      title="Official pitcher decision, shown as context only"
    >
      {decisionLabel(result)}
    </span>
  );
}

function decisionLabel(result: FormStartPoint["result"]) {
  if (result === "W") return "Win";
  if (result === "L") return "Loss";
  return "No decision";
}

function formStartMatchupLabel(start: FormStartPoint) {
  return startMatchupLabel({ pitcher: { team: start.team }, opponent: start.opp, side: start.side });
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border-r border-white/10 p-3 last:border-r-0">
      <p className="text-lg font-bold text-zinc-50" style={color ? { color } : undefined}>{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
    </div>
  );
}

function NextStartProjectionCard({ nextStart, venueSplitContext }: { nextStart: ProfileNextStart; venueSplitContext: VenueSplitContext | null }) {
  return (
    <div className="rounded border border-white/10 bg-[#101014] p-4" data-responsive-check="pitcher-next-start-projection">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Next start projection</p>
      <p className="mt-2 font-serif text-3xl text-zinc-50">GS+ {nextStart.projectedGsPlus}</p>
      <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-zinc-400">{nextStart.opponent} · {formatUpcomingDate(nextStart.date)} · {nextStart.restLabel}</p>
      {venueSplitContext ? <p className={`mt-3 font-mono text-xs uppercase tracking-[0.12em] ${venueSplitContext.toneClass}`} data-responsive-check="home-road-next-start-context">{venueSplitContext.label}</p> : null}
      <div className="mt-4 grid gap-2 font-mono text-xs text-zinc-400">
        <p>{nextStart.venue}</p>
        <p>Matchup: {nextStart.matchupLabel}</p>
        <p>{nextStart.parkLabel}</p>
        <p>{nextStart.weatherLabel}</p>
      </div>
    </div>
  );
}

function PitcherSkillSnapshotCard({ snapshot }: { snapshot: PitcherSkillSnapshot }) {
  const cswScore = pctToBar(snapshot.cswPct, 20, 36);
  const whiffScore = pctToBar(snapshot.whiffPct, 12, 34);
  const swStrScore = pctToBar(snapshot.swStrPct, 8, 20);

  return (
    <div className="rounded border border-white/10 bg-black/20 p-3" data-responsive-check="pitcher-archive-quality-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-zinc-300">{snapshot.label}</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          {snapshot.starts} starts · {snapshot.pitchCount} pitches
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">
        <ArchiveQualityStat label="CSW" value={formatPctValue(snapshot.cswPct)} />
        <ArchiveQualityStat label="Whiff" value={formatPctValue(snapshot.whiffPct)} />
        <ArchiveQualityStat label="SwStr" value={formatPctValue(snapshot.swStrPct)} />
        {snapshot.maxVelocityMph ? <ArchiveQualityStat label="Top velo" value={snapshot.maxVelocityMph.toFixed(1)} /> : null}
      </div>
      <div className="mt-3 space-y-2">
        <ArchiveQualityBar label="CSW" value={formatPctValue(snapshot.cswPct)} width={cswScore} />
        <ArchiveQualityBar label="Whiff" value={formatPctValue(snapshot.whiffPct)} width={whiffScore} />
        <ArchiveQualityBar label="SwStr" value={formatPctValue(snapshot.swStrPct)} width={swStrScore} />
      </div>
    </div>
  );
}

function PitcherSkillTrendCard({ trend }: { trend: PitcherApiResponse["skillProfile"]["trend"] }) {
  if (trend.status !== "available") return null;

  return (
    <div className="mt-3 rounded border border-amber-300/15 bg-amber-300/5 p-3" data-responsive-check="pitcher-archive-quality-trend">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-amber-200">Last 30 trend</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{trend.starts} starts</p>
      </div>
      <p className="mt-2 text-xs leading-5 text-zinc-300">{trend.summary}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
        <ArchiveTrendStat label="CSW" value={trend.cswDeltaPct} suffix="pts" />
        <ArchiveTrendStat label="Whiff" value={trend.whiffDeltaPct} suffix="pts" />
        <ArchiveTrendStat label="SwStr" value={trend.swStrDeltaPct} suffix="pts" />
        <ArchiveTrendStat label="Velo" value={trend.avgVelocityDeltaMph} suffix="mph" />
      </div>
    </div>
  );
}

function ArchiveQualityStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-[#101014] p-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-1 font-serif text-2xl font-semibold text-zinc-50">{value}</p>
    </div>
  );
}

function ArchiveTrendStat({ label, value, suffix }: { label: string; value: number | null; suffix: "pts" | "mph" }) {
  if (typeof value !== "number") return null;

  const tone = value > 0 ? "text-emerald-300" : value < 0 ? "text-cyan-300" : "text-zinc-300";
  return (
    <div className="rounded border border-white/10 bg-[#101014] p-2">
      <p className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className={`mt-1 font-serif text-xl font-semibold ${tone}`}>
        {value > 0 ? "+" : ""}{value.toFixed(1)} {suffix}
      </p>
    </div>
  );
}

function ArchiveQualityBar({ label, value, width }: { label: string; value: string; width: number }) {
  const color = width >= 75 ? "#f6c445" : width <= 30 ? "#67e8f9" : "#a1a1aa";
  return (
    <div className="grid gap-1 font-mono text-[10px] uppercase tracking-[0.12em]">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-zinc-500">{label}</p>
        <p className="text-zinc-300">{value}</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <span className="block h-full rounded-full" style={{ width: `${width}%`, background: color }} />
      </div>
    </div>
  );
}

function SplitRow({ split }: { split: PitcherApiSplitGroup }) {
  const kPct = split.inningsPitched && split.strikeouts !== null ? `${Math.round((split.strikeouts / Math.max(1, split.inningsPitched * 3)) * 100)}%` : null;
  const bbPct = split.inningsPitched && split.walks !== null ? `${Math.round((split.walks / Math.max(1, split.inningsPitched * 3)) * 100)}%` : null;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-3 rounded border border-white/10 bg-black/20 p-3 font-mono text-xs">
      <p className="min-w-0 uppercase tracking-[0.14em] text-zinc-300">{split.label}</p>
      {split.opponentAverage !== null ? <p className="text-zinc-500">wOBA {split.opponentAverage.toFixed(3).replace(/^0/, "")}</p> : null}
      {kPct ? <p className="text-zinc-500">K {kPct}</p> : null}
      {bbPct ? <p className="text-zinc-500">BB {bbPct}</p> : null}
    </div>
  );
}

function formatNullable(value: number | null | undefined, digits: number) {
  return typeof value === "number" ? value.toFixed(digits) : "--";
}

function formatSeasonDecisionRecord(record: FormSummary["seasonDecisionRecord"]) {
  return `${record.wins}-${record.losses}${record.noDecisions > 0 ? ` (${record.noDecisions} ND)` : ""}`;
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

function formatPctValue(value: number | null | undefined) {
  return typeof value === "number" ? `${value.toFixed(1)}%` : "n/a";
}

function pctToBar(value: number | null | undefined, poor: number, elite: number) {
  if (typeof value !== "number") return 50;
  const raw = ((value - poor) / (elite - poor)) * 100;
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
