import Link from "next/link";
import type { Metadata } from "next";
import type React from "react";
import { notFound } from "next/navigation";
import { FastFilterLink } from "@/components/fast-filter-link";
import { FeaturedStartHighlightEmbed } from "@/components/featured-start-highlight";
import { Headshot, type HeadshotSize } from "@/components/headshot";
import { HeatHighlightModal } from "@/components/heat-highlight-modal";
import { EntityOrientation } from "@/components/entity-orientation";
import { PitcherAvailabilityNote } from "@/components/pitcher-availability";
import { PitchChart } from "@/components/pitch-chart";
import { ScoreComponentList } from "@/components/score-component-list";
import { ScoreReasonList } from "@/components/score-reason-list";
import { ShareStartButton } from "@/components/share-start-button";
import { RankedStartsArchiveNav } from "@/components/slate-date-nav";
import { SiteHeader } from "@/components/site-header";
import { resolveFeaturedStartHighlight } from "@/lib/data/featured-highlight-service";
import { getRankedStartsPageData } from "@/lib/data/ranked-starts-page-service";
import { getHomeSlateDate, getStartDetail, summarizeSlateScoreScale } from "@/lib/data/start-service";
import { FORM_CONFIG, QUALITY_BANDS, qualityTierOf } from "@/lib/form-tokens";
import { formatSigned, formatStartLine } from "@/lib/format";
import { inningsFromIP } from "@/lib/innings";
import { entitySourceHref, entitySources, parseEntitySource, pitcherHref, rankedStartsPath, sourceParams, startHref, startPath, startShareImagePath, upcomingDateHref } from "@/lib/routes";
import { absoluteUrl, formatLongDate, formatShortDate, jsonLdScript, noIndexFollow } from "@/lib/seo";
import type { SlateProgressState } from "@/lib/slate-state";
import { isRankedRegularStart } from "@/lib/start-classification";
import type { FeaturedStartHighlight, FormSummary, FormTier, StartApiGameScorePlusBreakdown, StartSummary } from "@/lib/types";

type StartPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    band?: string;
    from?: string;
    openers?: string;
    team?: string;
    sort?: string;
  }>;
};

export async function generateMetadata({ params, searchParams }: StartPageProps): Promise<Metadata> {
  const { id } = await params;
  const query = await searchParams;
  if (/^\d{4}-\d{2}-\d{2}$/.test(id)) {
    const starts = (await getRankedStartsPageData(id)).slateStarts.filter((start) => start.source?.line !== "fixture");
    const topStart = starts[0];
    const title = `MLB Starting Pitcher Rankings - ${formatShortDate(id)}`;
    const description = topStart
      ? `All ${starts.length} MLB starts on ${formatLongDate(id)} ranked by GS+. ${topStart.pitcher.name} led at ${topStart.gameScorePlus}. Full lines, matchups, and the night's best and worst starts.`
      : `Every completed MLB start from ${formatLongDate(id)}, ranked by GS+.`;
    return {
      title,
      description,
      alternates: { canonical: rankedStartsPath(id) },
      robots: query && Object.keys(query).length > 0 ? noIndexFollow() : undefined,
    };
  }

  const start = await getStartDetail(id);
  if (!start) {
    return {
      title: "Start Log",
      description: "Single-start pitch log and GS+ breakdown from Toe the Slab.",
    };
  }

  const title = `${start.pitcher.name} vs ${start.opponent} - ${formatShortDate(start.date)} (GS+ ${start.gameScorePlus})`;
  const hasPitchDetails = start.pitchDetailSource !== "fixture" && start.pitchEvents.length > 0;
  const description = hasPitchDetails
    ? `${start.pitcher.name}'s ${formatLongDate(start.date)} start vs ${start.opponent}: ${formatStartLine(start.line)}. GS+ ${start.gameScorePlus}, whiff, velo, pitch mix, and ranking breakdown.`
    : `${start.pitcher.name}'s ${formatLongDate(start.date)} start vs ${start.opponent}: ${formatStartLine(start.line)}. GS+ ${start.gameScorePlus} and ranking breakdown.`;
  const url = startPath(start.id);
  const image = startShareImagePath(start.id);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      images: [{ url: image, width: 1200, height: 630, alt: `${start.pitcher.name} start card` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function StartPage({ params, searchParams }: StartPageProps) {
  const { id } = await params;
  if (/^\d{4}-\d{2}-\d{2}$/.test(id)) return <RankedStartsDate date={id} searchParams={searchParams} />;

  const query = await searchParams;
  const start = await getStartDetail(id);
  if (!start) notFound();
  const today = getHomeSlateDate();
  const source = parseEntitySource(query?.from, "starts");
  const sourceInfo = entitySources[source];
  const sourceHref = source === "starts"
    ? rankedStartsPath(start.date)
    : source === "upcoming"
      ? upcomingDateHref(start.date)
      : entitySourceHref(source, { rankedDate: addDays(today, -1), upcomingDate: today });
  const highlight = await resolveFeaturedStartHighlight(start);
  const jsonLd = jsonLdForStartDetail(start);
  const lineSourceLabel = getLineSourceLabel(start.source?.line);
  const rankingSourceLabel = getRankingSourceLabel(start.source?.ranking);
  const pitchSourceLabel = getPitchSourceLabel(start.pitchDetailSource);

  return (
    <main className="min-h-screen bg-[#08080a] text-zinc-100">
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <section className="px-4 pb-8 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SiteHeader active={null} today={today} responsiveCheck="start-detail-site-header" />
          <div className="mt-6">
            <EntityOrientation
              sourceLabel={sourceInfo.label}
              sourceShortLabel={sourceInfo.shortLabel}
              sourceHref={sourceHref}
              entityLabel={`${start.pitcher.name} / ${start.game.awayTeam.abbreviation} at ${start.game.homeTeam.abbreviation}`}
            />
          </div>
          <div className="mt-6 grid gap-6 border-b border-white/10 pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
                {start.game.awayTeam.abbreviation} at {start.game.homeTeam.abbreviation} / {start.game.venue}
              </p>
              <h1 className="mt-3 font-serif text-6xl font-black text-zinc-50">{start.pitcher.name}</h1>
              <p className="mt-3 font-mono text-sm text-zinc-400">{formatStartLine(start.line)}</p>
              <p className="mt-4 inline-block rounded border border-white/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
                {lineSourceLabel} / {rankingSourceLabel} / {pitchSourceLabel}
              </p>
              <div className="mt-4">
                <ShareStartButton
                  title={`${start.pitcher.name}: ${start.gameScorePlus} GS+`}
                  text={`${start.pitcher.name} ${formatStartLine(start.line)} on Toe the Slab`}
                  path={startPath(start.id)}
                />
              </div>
            </div>
            <div className="lg:text-right">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Game Score+</p>
              <p className="font-serif text-7xl font-black leading-none text-amber-300">{start.gameScorePlus}</p>
              {start.gameScorePlusBreakdown ? (
                <p className="mt-2 font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
                  {start.gameScorePlusBreakdown.gradeBand.label} / {start.gameScorePlusBreakdown.gradeBand.percentileLabel}
                </p>
              ) : null}
              <Link
                href={pitcherHref({ id: start.pitcher.id, name: start.pitcher.name }, sourceParams(source))}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded border border-amber-300/40 bg-amber-300/10 px-3 py-2 font-mono text-xs uppercase tracking-[0.16em] text-amber-300 transition hover:border-amber-200 hover:bg-amber-300 hover:text-zinc-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                Pitcher page
                <span aria-hidden="true">-&gt;</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
      {highlight ? (
        <section className="px-4 pb-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="mb-3">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">MLB highlight</p>
              <h2 className="mt-1 font-serif text-3xl font-bold text-zinc-50">Watch the start</h2>
            </div>
            <FeaturedStartHighlightEmbed highlight={highlight} pitcherName={start.pitcher.name} />
          </div>
        </section>
      ) : null}
      <PitchChart start={start} />
    </main>
  );
}

async function RankedStartsDate({ date, searchParams }: { date: string; searchParams?: StartPageProps["searchParams"] }) {
  const params = await searchParams;
  const today = getHomeSlateDate();
  const pageData = await getRankedStartsPageData(date, today);
  const { slateStarts, completionState, slateProgress, archiveNavigation } = pageData;
  const rankedDate = archiveNavigation.latestDate;
  const starts = slateStarts.filter((start) => start.source?.line !== "fixture");
  const qualifiedStarts = starts.filter(isQualifiedRankedStart);
  const shortStarts = starts.filter((start) => !isQualifiedRankedStart(start));
  const scoreScale = summarizeSlateScoreScale(qualifiedStarts);
  const sort = isRankedStartSort(params?.sort) ? params?.sort ?? "rank" : "rank";
  const band = parseQualityBand(params?.band);
  const showOpeners = params?.openers === "1";
  const qualityBandCounts = countQualityBands(qualifiedStarts);
  const pairs = pairedStarts(starts);
  const highlights = new Map(pageData.highlights);
  const formByPitcher = new Map(pageData.formByPitcher);
  const jsonLd = jsonLdForRankedStarts(date, qualifiedStarts);
  const visibleStarts = qualifiedStarts
    .filter((start) => band === "all" || qualityBandSlug(qualityTierOf(start.gameScorePlus).label) === band)
    .sort((a, b) => {
      if (sort === "k") return b.line.strikeouts - a.line.strikeouts || a.rank - b.rank;
      if (sort === "ip") return inningsFromIP(b.line.inningsPitched) - inningsFromIP(a.line.inningsPitched) || a.rank - b.rank;
      return a.rank - b.rank;
    });
  const groupedStarts = rankedStartGroups(visibleStarts, sort, band, qualityBandCounts);

  return (
    <main className="min-h-screen bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8">
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 pb-6">
          <SiteHeader active="starts" today={today} rankedDate={rankedDate} hideUpcoming />
          <h1 className="mt-4 font-serif text-5xl font-black text-zinc-50">Ranked Starts</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Every completed start ranked by GS+, with full lines, matchup context, and breakdowns.
          </p>
          <div className="mt-3 flex flex-col items-start gap-2">
            <RankedSlateStatus state={completionState} slateProgress={slateProgress} />
            <Link className="font-mono text-xs uppercase tracking-[0.16em] text-amber-300" href="/methodology">How rankings work</Link>
          </div>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500" data-responsive-check="ranked-starts-slate-stamp">
            <ScaleLegend scoreScale={scoreScale} />
          </p>
          <RankedStartsArchiveNav
            activeDate={archiveNavigation.activeDate}
            latestDate={archiveNavigation.latestDate}
            previousDate={archiveNavigation.previousDate}
            nextDate={archiveNavigation.nextDate}
            isLatest={archiveNavigation.isLatest}
          />
          {starts.length > 0 ? (
            <div className="mt-4 grid gap-3 rounded border border-white/10 bg-[#101014] p-3 font-mono text-xs uppercase tracking-[0.14em]" data-responsive-check="ranked-start-controls">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-zinc-500">Sort</span>
                <ControlLink active={sort === "rank"} href={rankedStartsHref(date, { band, sort: "rank", showOpeners })}>GS+ rank</ControlLink>
                <ControlLink active={sort === "k"} href={rankedStartsHref(date, { band, sort: "k", showOpeners })}>Strikeouts</ControlLink>
                <ControlLink active={sort === "ip"} href={rankedStartsHref(date, { band, sort: "ip", showOpeners })}>IP</ControlLink>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-zinc-500">Band</span>
                <ControlLink active={band === "all"} href={rankedStartsHref(date, { sort, showOpeners })}>All <span className="opacity-60">{qualifiedStarts.length}</span></ControlLink>
                {QUALITY_BANDS.map((qualityBand) => (
                  <ControlLink
                    key={qualityBand.label}
                    active={band === qualityBandSlug(qualityBand.label)}
                    href={rankedStartsHref(date, { band: qualityBandSlug(qualityBand.label), sort, showOpeners })}
                    color={qualityBand.color}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: qualityBand.color }} />
                    {qualityBand.label}
                    <span className="opacity-60">{qualityBandCounts.get(qualityBand.label) ?? 0}</span>
                  </ControlLink>
                ))}
              </div>
            </div>
          ) : null}
        </header>

        {starts.length === 0 ? (
          <section className="rounded border border-white/10 bg-[#101014] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">No completed starts ready</p>
            <p className="mt-3 text-sm text-zinc-400">Final gamefeed data has not settled for this date yet.</p>
          </section>
        ) : (
          <>
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
              Board ranks starts of 2.0+ innings; openers and short outings are listed separately.
            </p>
            <section className="mb-4" data-responsive-check="ranked-starts-board-heading">
              <h2 className="font-serif text-3xl font-bold text-zinc-50">Ranked Board</h2>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300">{formatBoardEyebrowDate(date)}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                MLB Stats API / Baseball Savant
              </p>
            </section>
            <StartsDistributionStrip starts={qualifiedStarts} />
            {visibleStarts.length > 0 ? (
              <section className="mt-4 space-y-4" data-responsive-check="ranked-starts-recap" data-sort={sort} data-band-filter={band}>
                {groupedStarts.map((group) => (
                  <div key={group.key} className="space-y-2">
                    {group.label ? <BandHeader label={group.label} count={group.count} color={group.color} /> : null}
                    <div className="grid gap-0">
                      {group.starts.map((start) => (
                        <RankedStartCard
                          key={start.id}
                          start={start}
                          displayRank={visibleStarts.findIndex((candidate) => candidate.id === start.id) + 1}
                          pairedStart={pairs.get(start.id)}
                          formSummary={formByPitcher.get(String(start.pitcher.mlbId))}
                          highlight={highlights.get(start.id) ?? null}
                          provisionalLeader={visibleStarts[0]?.id === start.id && completionState.isPartialToday && band === "all" && sort === "rank"}
                          grouped={Boolean(group.label)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            ) : (
              <section className="mt-4 rounded border border-white/10 bg-[#101014] p-6" role="status" data-responsive-check="ranked-starts-empty-band">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">No starts in this band</p>
                <p className="mt-3 text-sm text-zinc-400">Try another GS+ quality band or return to all starts for this slate.</p>
                <ControlLink active={false} href={rankedStartsHref(date, { sort, showOpeners })}>Show all starts</ControlLink>
              </section>
            )}
            {shortStarts.length > 0 ? (
              <section className="mt-6 rounded border border-white/10 bg-[#101014] p-4" data-responsive-check="ranked-starts-openers" data-openers-visible={showOpeners ? "true" : "false"}>
                <div className="flex flex-col justify-between gap-3 border-b border-white/10 pb-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Openers & short outings · {shortStarts.length}</p>
                    <p className="mt-1 text-sm text-zinc-400">Starts under 2.0 innings are kept out of the ranked positions but remain visible for slate completeness.</p>
                  </div>
                  <ControlLink active={showOpeners} href={rankedStartsHref(date, { band, sort, showOpeners: !showOpeners })} scroll={false}>
                    {showOpeners ? "Hide short outings" : "Show openers & short outings"}
                  </ControlLink>
                </div>
                {showOpeners ? (
                  <div className="mt-3 grid gap-2">
                    {shortStarts.map((start) => (
                      <ShortStartCard key={start.id} start={start} formSummary={formByPitcher.get(String(start.pitcher.mlbId))} />
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

function BandHeader({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="sticky top-0 z-20 mt-6 mb-3 flex items-center gap-3 bg-[#08080a]/92 py-2 backdrop-blur sm:static sm:bg-transparent sm:backdrop-blur-none">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color }}>
        {label} · {count}
      </p>
      <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${color}, rgba(255,255,255,0.08))` }} />
    </div>
  );
}

function RankedStartCard({ start, displayRank, pairedStart, formSummary, highlight, provisionalLeader, grouped }: { start: StartSummary; displayRank: number; pairedStart?: StartSummary; formSummary?: FormSummary; highlight?: FeaturedStartHighlight | null; provisionalLeader?: boolean; grouped?: boolean }) {
  const tier = qualityTierOf(start.gameScorePlus);
  const profile = rankedBandProfile(tier.label);
  const tierTextColor = profile.scoreColor;
  const contextLabel = start.context.label.split(" / ").at(-1) ?? start.context.label;
  const gas = isGasStart(start, tier.label);
  const topReason = topInlineReason(start);
  const thermalBand = thermalBandForForm(formSummary);

  return (
    <article
      id={start.id}
      className={`group relative scroll-mt-28 overflow-hidden border-l-4 px-4 sm:px-5 ${profile.paddingClass} ${profile.cardClass}`}
      style={{
        "--ranked-band-color": profile.railColor,
        background: profile.background,
        boxShadow: profile.shadow,
        borderLeftColor: profile.railColor,
      } as React.CSSProperties}
      data-responsive-check="ranked-start-card"
      data-band={qualityBandSlug(tier.label)}
      data-gas={gas ? "true" : "false"}
      data-grouped={grouped ? "true" : "false"}
    >
      {profile.ghostRank ? (
        <div className="pointer-events-none absolute -left-2 top-1/2 hidden -translate-y-1/2 font-mono text-8xl font-black leading-none text-white/[0.035] sm:block" aria-hidden="true">
          #{start.rank}
        </div>
      ) : null}
      <div className={`relative grid items-center gap-x-4 gap-y-2 sm:pr-20 ${profile.gridClass}`}>
        <div className="min-w-0">
          <p className={`${profile.rankClass} font-serif font-bold leading-none text-zinc-500`}>#{displayRank}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: tierTextColor }}>{tier.label}</p>
          {provisionalLeader ? <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-amber-300">Leader so far</p> : null}
        </div>
        <Headshot playerId={start.pitcher.mlbId} name={start.pitcher.name} team={start.pitcher.team} size={profile.headshotSize} band={thermalBand} decorative className={`ranked-start-plate ${profile.plateClass}`} />
        <div className="grid min-w-0 gap-1">
          <h2 className={`${profile.nameClass} break-words [overflow-wrap:anywhere] font-serif font-bold leading-tight text-zinc-50`}>{start.pitcher.name}</h2>
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{start.pitcher.team} vs {start.opponent}</p>
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {gas ? <span className="inline-flex min-h-7 items-center rounded border border-[#FF7A3D]/40 bg-[#FF7A3D]/15 px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#F6C445]">GAS</span> : null}
            {topReason && profile.showReason ? <span className="inline-flex min-h-7 items-center rounded border border-white/10 bg-black/25 px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-300">{topReason}</span> : null}
            <PitcherAvailabilityNote availability={formSummary?.availability} compact />
          </div>
        </div>
        <div className={`order-4 min-w-0 sm:order-none ${profile.lineClass}`}>
          <p className={`${profile.statClass} font-mono text-zinc-300`}>{formatStartLine(start.line)}</p>
          <p className="mt-1 truncate text-xs text-zinc-500">{contextLabel}</p>
          {pairedStart ? (
            <span className="mt-1 inline-flex font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
              Paired with {pairedStart.pitcher.name} / GS+ {pairedStart.gameScorePlus}
            </span>
          ) : null}
        </div>
        <div className="order-3 flex items-center justify-end gap-2 sm:order-none sm:text-right">
          {highlight ? (
            <div>
              <HeatHighlightModal
                highlight={highlight}
                pitcherName={start.pitcher.name}
                className="grid h-11 w-11 place-items-center rounded-full border border-amber-300/35 bg-black/45 text-amber-200 shadow-sm transition hover:border-amber-300/70 hover:bg-amber-300/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              />
            </div>
          ) : null}
          <div>
            <p className={`${profile.scoreClass} font-mono font-black leading-none tabular-nums`} style={{ color: tierTextColor }}>{start.gameScorePlus}</p>
            <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">GS+</span>
          </div>
        </div>
      </div>
      <details className="ranked-start-details">
        <summary className="cursor-pointer list-none rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 [&::-webkit-details-marker]:hidden" aria-label={`Toggle breakdown for ${start.pitcher.name}`}>
          <span aria-hidden="true" className="ranked-start-toggle-icon">
            <span className="ranked-start-toggle-chevron" />
          </span>
        </summary>
        <div className="grid gap-4 pb-4 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]" data-responsive-check="starts-score-breakdown">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Ranking reasons</p>
            <div className="mt-3">
              <ScoreReasonList reasons={visibleRankingReasons(start.gameScorePlusBreakdown?.rankingReasons ?? [])} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 font-mono text-xs uppercase tracking-[0.16em]">
              <Link href={startHref(start, sourceParams("starts"))} className="inline-flex min-h-11 items-center rounded border border-amber-300/30 px-3 text-amber-300">Start Log</Link>
              <Link href={pitcherHref({ id: start.pitcher.id, name: start.pitcher.name }, sourceParams("starts"))} className="inline-flex min-h-11 items-center rounded border border-white/10 px-3 text-zinc-400">Pitcher Profile</Link>
              {pairedStart ? <Link href={`#${pairedStart.id}`} className="inline-flex min-h-11 items-center rounded border border-white/10 px-3 text-zinc-400">Same game starter</Link> : null}
            </div>
          </div>
          {start.gameScorePlusBreakdown ? <ExpandedScoreBreakdown breakdown={start.gameScorePlusBreakdown} /> : null}
        </div>
      </details>
    </article>
  );
}

function ShortStartCard({ start, formSummary }: { start: StartSummary; formSummary?: FormSummary }) {
  const thermalBand = thermalBandForForm(formSummary);
  const badge = shortStartBadge(start);
  return (
    <article
      id={start.id}
      className="grid items-center gap-3 rounded border border-white/10 bg-black/20 p-3 sm:grid-cols-[auto_42px_minmax(0,1fr)_auto]"
      data-short-start-kind={badge}
      data-responsive-check="short-start-card"
    >
      <span className={`inline-flex min-h-7 w-fit items-center rounded border px-2 font-mono text-[10px] uppercase tracking-[0.12em] ${badge === "OPENER" ? "border-amber-300/35 bg-amber-300/10 text-amber-200" : "border-sky-300/25 bg-sky-300/10 text-sky-200"}`}>
        {badge}
      </span>
      <Link href={startHref(start, sourceParams("starts"))} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" aria-label={`Open ${start.pitcher.name} start log`}>
        <Headshot playerId={start.pitcher.mlbId} name={start.pitcher.name} team={start.pitcher.team} size="md" band={thermalBand} decorative className="ml-1" />
      </Link>
      <div className="min-w-0">
        <Link href={pitcherHref({ id: start.pitcher.id, name: start.pitcher.name }, sourceParams("starts"))} className="block min-w-0 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
          <h3 className="truncate font-serif text-xl font-bold text-zinc-50">{start.pitcher.name}</h3>
        </Link>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{start.pitcher.team} vs {start.opponent} / not ranked</p>
        <PitcherAvailabilityNote availability={formSummary?.availability} compact className="mt-1" />
      </div>
      <div className="font-mono text-xs text-zinc-400 sm:text-right">
        <p>{formatStartLine(start.line)}</p>
        <p className="mt-1 text-zinc-500">GS+ {start.gameScorePlus}</p>
      </div>
    </article>
  );
}

function ScaleLegend({ scoreScale }: { scoreScale: ReturnType<typeof summarizeSlateScoreScale> }) {
  return (
    <span>Slate range {scoreScale.low}-{scoreScale.high} / Avg {scoreScale.average} / Scale {scoreScale.displayRange}</span>
  );
}

function StartsDistributionStrip({ starts }: { starts: StartSummary[] }) {
  const width = 760;
  const height = 360;
  const pad = { left: 48, right: 28, top: 34, bottom: 44 };
  const xFor = (score: number) => pad.left + (clamp(score, 0, 100) / 100) * (width - pad.left - pad.right);
  const maxInnings = Math.max(9, ...starts.map((start) => inningsFromIP(start.line.inningsPitched)));
  const yFor = (innings: number) => pad.top + ((maxInnings - innings) / maxInnings) * (height - pad.top - pad.bottom);
  const mean = starts.reduce((sum, start) => sum + start.gameScorePlus, 0) / Math.max(1, starts.length);
  const points = [...starts]
    .sort((a, b) => a.gameScorePlus - b.gameScorePlus || inningsFromIP(a.line.inningsPitched) - inningsFromIP(b.line.inningsPitched) || a.pitcher.name.localeCompare(b.pitcher.name))
    .map((start) => {
      const seed = stableHash(start.pitcher.id || start.id);
      const xDodge = ((seed % 5) - 2) * 3.2;
      const yDodge = ((Math.floor(seed / 5) % 5) - 2) * 3.2;
      return {
        start,
        innings: inningsFromIP(start.line.inningsPitched),
        x: clamp(xFor(start.gameScorePlus) + xDodge, pad.left + 8, width - pad.right - 8),
        y: clamp(yFor(inningsFromIP(start.line.inningsPitched)) + yDodge, pad.top + 8, height - pad.bottom - 8),
      };
    });
  const labelIds = new Set(starts.slice(0, 2).map((start) => start.id));
  const worst = starts.at(-1);
  if (worst) labelIds.add(worst.id);

  return (
    <section className="rounded border border-white/10 bg-[#101014] p-3" data-responsive-check="ranked-start-distribution">
      <div className="mb-2 flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Slate scatter</p>
          <h2 className="font-serif text-2xl font-bold text-zinc-50">Slate shape</h2>
        </div>
        <p className="font-mono text-xs text-zinc-500">Click a point to jump to the row</p>
      </div>
      <svg className="h-[320px] w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${starts.length} starts distributed by GS+ and innings pitched`}>
        <rect x={pad.left} y={pad.top} width={width - pad.left - pad.right} height={height - pad.top - pad.bottom} fill="#0b0b0e" opacity="0.58" />
        {[20, 40, 60, 80].map((tick) => (
          <g key={`x-${tick}`}>
            <line x1={xFor(tick)} x2={xFor(tick)} y1={pad.top} y2={height - pad.bottom} stroke="#27272a" />
            <text x={xFor(tick)} y={height - 15} textAnchor="middle" fill="#71717a" fontSize="11">{tick}</text>
          </g>
        ))}
        {[0, 3, 6, 9].map((tick) => (
          <g key={`y-${tick}`}>
            <line x1={pad.left} x2={width - pad.right} y1={yFor(tick)} y2={yFor(tick)} stroke="#27272a" />
            <text x={pad.left - 12} y={yFor(tick) + 4} textAnchor="end" fill="#71717a" fontSize="11">{tick}</text>
          </g>
        ))}
        <line x1={pad.left} x2={width - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} stroke="#3f3f46" />
        <line x1={pad.left} x2={pad.left} y1={pad.top} y2={height - pad.bottom} stroke="#3f3f46" />
        <line x1={xFor(mean)} x2={xFor(mean)} y1={pad.top} y2={height - pad.bottom} stroke="#a1a1aa" strokeDasharray="4 5" />
        <line x1={pad.left} x2={width - pad.right} y1={yFor(5)} y2={yFor(5)} stroke="#a1a1aa" strokeDasharray="4 5" opacity="0.85" />
        <text x={Math.min(width - 122, xFor(mean) + 8)} y={pad.top + 16} fill="#a1a1aa" fontSize="12">avg {mean.toFixed(1)} GS+</text>
        <text x={width - pad.right - 88} y={yFor(5) - 8} fill="#a1a1aa" fontSize="12">5.0 IP</text>
        <text x={(pad.left + width - pad.right) / 2} y={height - 4} textAnchor="middle" fill="#71717a" fontSize="11" fontFamily="monospace">GS+</text>
        <text x="14" y={(pad.top + height - pad.bottom) / 2} textAnchor="middle" fill="#71717a" fontSize="11" fontFamily="monospace" transform={`rotate(-90 14 ${(pad.top + height - pad.bottom) / 2})`}>IP</text>
        {points.map(({ start, x, y }) => {
          const band = qualityTierOf(start.gameScorePlus);
          const shouldLabel = labelIds.has(start.id);
          const labelX = Math.min(width - 82, Math.max(pad.left + 8, x + (start.rank <= 2 ? 13 : -58)));
          const labelY = Math.min(height - pad.bottom - 10, Math.max(pad.top + 16, y + (start.rank <= 2 ? -14 : 22)));
          return (
            <a key={start.id} href={`#${start.id}`} aria-label={`Jump to ${start.pitcher.name}, GS+ ${start.gameScorePlus}`}>
              <circle cx={x} cy={y} r={start.rank <= 3 ? 8.8 : 7.2} fill={band.color} stroke="#08080a" strokeWidth="2">
                <title>{`${start.pitcher.name} / ${formatStartLine(start.line)} / GS+ ${start.gameScorePlus} / ${band.label}`}</title>
              </circle>
              {shouldLabel ? (
                <>
                  <line x1={x} y1={y} x2={labelX} y2={labelY + 4} stroke={band.color} strokeOpacity="0.65" />
                  <text x={labelX} y={labelY} fill={band.color} fontSize="11" fontWeight="700">{lastName(start.pitcher.name)}</text>
                </>
              ) : null}
            </a>
          );
        })}
      </svg>
    </section>
  );
}

function ControlLink({ active, href, children, color, scroll = true }: { active: boolean; href: string; children: React.ReactNode; color?: string; scroll?: boolean }) {
  return (
    <FastFilterLink
      className={`inline-flex min-h-9 items-center gap-2 rounded border px-3 py-1.5 ${active ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 text-zinc-300"}`}
      href={href}
      style={active && color ? { borderColor: color, backgroundColor: color } : undefined}
      ariaCurrent={active ? "page" : undefined}
      scroll={scroll}
    >
      {children}
    </FastFilterLink>
  );
}

function ExpandedScoreBreakdown({ breakdown }: { breakdown: StartApiGameScorePlusBreakdown }) {
  const components = visibleScoreComponents(breakdown.components);
  const earnedTotal = components.reduce((sum, component) => sum + component.value, 0);

  return (
    <div>
      <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Additive breakdown</p>
          <p className="mt-1 font-mono text-xs text-zinc-400">
            Earned total {formatSigned(earnedTotal)} -&gt; Calibrated GS+ {breakdown.total}
          </p>
        </div>
        <p className="font-mono text-xs text-zinc-500">{breakdown.gradeBand.percentileLabel}</p>
      </div>
      <ScoreComponentList components={components} compact />
    </div>
  );
}

function visibleScoreComponents(components: StartApiGameScorePlusBreakdown["components"]) {
  const hiddenKeys = new Set(["baseline", "calibration", "whiffDelta", "velocityDelta"]);
  return components.filter((component) => !hiddenKeys.has(component.key));
}

function visibleRankingReasons(reasons: StartApiGameScorePlusBreakdown["rankingReasons"]) {
  const hiddenKeys = new Set(["whiffDelta", "velocityDelta"]);
  return reasons.filter((reason) => !hiddenKeys.has(reason.key));
}

function topInlineReason(start: StartSummary) {
  if (start.line.strikeouts >= 8) return `${start.line.strikeouts} K`;
  if (inningsFromIP(start.line.inningsPitched) >= 7) return `${start.line.inningsPitched.toFixed(1)} IP`;
  const reason = visibleRankingReasons(start.gameScorePlusBreakdown?.rankingReasons ?? [])[0];
  return reason ? reason.label : null;
}

function isGasStart(start: StartSummary, bandLabel: string) {
  return (bandLabel === "Elite" || bandLabel === "Plus") && (start.line.strikeouts >= 8 || inningsFromIP(start.line.inningsPitched) >= 7);
}

function rankedBandProfile(label: string) {
  if (label === "Elite") {
    return {
      scoreColor: "#F6C445",
      ringColor: "#F6C445",
      railColor: "#F6C445",
      background: "linear-gradient(90deg,rgba(255,122,61,0.20),rgba(21,24,28,0.98) 38%,rgba(10,11,13,0.98))",
      shadow: "0 14px 48px rgba(246,196,69,0.15), inset 0 0 54px rgba(246,196,69,0.055)",
      cardClass: "rounded border border-[#F6C445]/35",
      paddingClass: "py-4 sm:py-[18px]",
      gridClass: "grid-cols-[48px_52px_minmax(0,1fr)_auto] sm:grid-cols-[48px_64px_minmax(0,1fr)_auto_auto]",
      headshotSize: "lg" as HeadshotSize,
      plateClass: "!h-[65px] !w-[52px] sm:!h-20 sm:!w-16",
      nameClass: "text-3xl sm:text-4xl",
      rankClass: "text-3xl sm:text-4xl",
      scoreClass: "text-6xl sm:text-[44px]",
      statClass: "text-sm",
      lineClass: "col-span-full pl-16 sm:col-span-1 sm:pl-0 sm:text-right",
      showReason: true,
      ghostRank: true,
    };
  }

  if (label === "Plus") {
    return {
      scoreColor: "#F6C445",
      ringColor: "#EF9F27",
      railColor: "#EF9F27",
      background: "linear-gradient(90deg,rgba(255,122,61,0.14),rgba(21,24,28,0.98) 36%,rgba(10,11,13,0.98))",
      shadow: "0 10px 34px rgba(239,159,39,0.12)",
      cardClass: "rounded border border-[#F6C445]/25",
      paddingClass: "py-4 sm:py-[18px]",
      gridClass: "grid-cols-[48px_52px_minmax(0,1fr)_auto] sm:grid-cols-[48px_64px_minmax(0,1fr)_auto_auto]",
      headshotSize: "lg" as HeadshotSize,
      plateClass: "!h-[65px] !w-[52px] sm:!h-20 sm:!w-16",
      nameClass: "text-2xl sm:text-3xl",
      rankClass: "text-3xl",
      scoreClass: "text-5xl sm:text-[44px]",
      statClass: "text-sm",
      lineClass: "col-span-full pl-16 sm:col-span-1 sm:pl-0 sm:text-right",
      showReason: true,
      ghostRank: false,
    };
  }

  if (label === "Solid") {
    return {
      scoreColor: "#F5F2EA",
      ringColor: "#888780",
      railColor: "#888780",
      background: "linear-gradient(90deg,rgba(136,135,128,0.08),rgba(21,24,28,0.96))",
      shadow: "none",
      cardClass: "border-b border-white/10",
      paddingClass: "py-3 sm:py-3.5",
      gridClass: "grid-cols-[48px_44px_minmax(0,1fr)_auto] sm:grid-cols-[48px_52px_minmax(0,1fr)_auto_auto]",
      headshotSize: "md" as HeadshotSize,
      plateClass: "!h-[55px] !w-11 sm:!h-[65px] sm:!w-[52px]",
      nameClass: "text-xl sm:text-2xl",
      rankClass: "text-2xl",
      scoreClass: "text-4xl sm:text-[36px]",
      statClass: "text-sm",
      lineClass: "col-span-full pl-[60px] sm:col-span-1 sm:pl-0 sm:text-right",
      showReason: false,
      ghostRank: false,
    };
  }

  if (label === "Below") {
    return {
      scoreColor: "#85B7EB",
      ringColor: "#5BA8FF",
      railColor: "#5BA8FF",
      background: "linear-gradient(90deg,rgba(91,168,255,0.10),rgba(14,18,24,0.92))",
      shadow: "none",
      cardClass: "border-b border-white/10",
      paddingClass: "py-3",
      gridClass: "grid-cols-[48px_40px_minmax(0,1fr)_auto] sm:grid-cols-[48px_44px_minmax(0,1fr)_auto_auto]",
      headshotSize: "sm" as HeadshotSize,
      plateClass: "!h-[50px] !w-10 sm:!h-[55px] sm:!w-11",
      nameClass: "text-lg sm:text-xl",
      rankClass: "text-xl",
      scoreClass: "text-3xl sm:text-[30px]",
      statClass: "text-xs",
      lineClass: "col-span-full pl-14 sm:col-span-1 sm:pl-0 sm:text-right",
      showReason: false,
      ghostRank: false,
    };
  }

  return {
    scoreColor: "#5BA8FF",
    ringColor: "rgba(91,168,255,0.65)",
    railColor: "#5BA8FF",
    background: "linear-gradient(90deg,rgba(91,168,255,0.07),rgba(10,13,18,0.9))",
    shadow: "none",
    cardClass: "border-b border-white/10",
    paddingClass: "py-2.5",
    gridClass: "grid-cols-[48px_40px_minmax(0,1fr)_auto] sm:grid-cols-[48px_40px_minmax(0,1fr)_auto_auto]",
    headshotSize: "xs" as HeadshotSize,
    plateClass: "!h-[50px] !w-10",
    nameClass: "text-base sm:text-lg",
    rankClass: "text-lg",
    scoreClass: "text-3xl sm:text-[28px]",
    statClass: "text-xs",
    lineClass: "col-span-full pl-14 sm:col-span-1 sm:pl-0 sm:text-right",
    showReason: false,
    ghostRank: false,
  };
}

type RankedStartSort = "rank" | "k" | "ip";
type QualityBandFilter = "all" | "elite" | "plus" | "solid" | "below" | "poor";

function isRankedStartSort(value: string | undefined): value is RankedStartSort {
  return value === "rank" || value === "k" || value === "ip";
}

function parseQualityBand(value: string | undefined): QualityBandFilter {
  return isQualityBandFilter(value) ? value : "all";
}

function isQualityBandFilter(value: string | undefined): value is QualityBandFilter {
  return value === "all" || QUALITY_BANDS.some((band) => qualityBandSlug(band.label) === value);
}

function rankedStartGroups(starts: StartSummary[], sort: RankedStartSort, band: QualityBandFilter, counts: Map<string, number>) {
  if (sort !== "rank") {
    return [{ key: `sort-${sort}`, starts, label: null, count: starts.length, color: "#878D97" }];
  }

  if (band !== "all") {
    const qualityBand = QUALITY_BANDS.find((candidate) => qualityBandSlug(candidate.label) === band);
    return [{ key: band, starts, label: null, count: starts.length, color: qualityBand?.color ?? "#878D97" }];
  }

  return QUALITY_BANDS
    .map((qualityBand) => {
      const groupStarts = starts.filter((start) => qualityTierOf(start.gameScorePlus).label === qualityBand.label);
      return {
        key: qualityBand.label,
        starts: groupStarts,
        label: groupStarts.length > 0 ? qualityBand.label.toUpperCase() : null,
        count: counts.get(qualityBand.label) ?? groupStarts.length,
        color: qualityBand.color,
      };
    })
    .filter((group) => group.starts.length > 0);
}

function qualityBandSlug(label: string): QualityBandFilter {
  return label.toLowerCase().replace(/\s+/g, "-") as QualityBandFilter;
}

function countQualityBands(starts: StartSummary[]) {
  const counts = new Map<string, number>(QUALITY_BANDS.map((band) => [band.label, 0]));
  for (const start of starts) {
    const label = qualityTierOf(start.gameScorePlus).label;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return counts;
}

function rankedStartsHref(date: string, values: { band?: QualityBandFilter; sort?: string; showOpeners?: boolean }) {
  const params = new URLSearchParams();
  if (values.sort && values.sort !== "rank") params.set("sort", values.sort);
  if (values.band && values.band !== "all") params.set("band", values.band);
  if (values.showOpeners) params.set("openers", "1");
  const query = params.toString();
  return `/starts/${date}${query ? `?${query}` : ""}`;
}

function isQualifiedRankedStart(start: StartSummary) {
  return isRankedRegularStart(start);
}

function shortStartBadge(start: StartSummary): "OPENER" | "SHORT" {
  return inningsFromIP(start.line.inningsPitched) < 2 ? "OPENER" : "SHORT";
}

function thermalBandForForm(summary: FormSummary | undefined): FormTier | null {
  if (!summary || summary.status !== "ok" || summary.windowCount < FORM_CONFIG.minStartsToQualify) return null;
  return summary.tier;
}

function jsonLdForRankedStarts(date: string, starts: StartSummary[]) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "Starts", item: absoluteUrl("/starts") },
        { "@type": "ListItem", position: 3, name: formatLongDate(date), item: absoluteUrl(rankedStartsPath(date)) },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `MLB Starting Pitcher Rankings - ${formatShortDate(date)}`,
      numberOfItems: starts.length,
      itemListElement: starts.slice(0, 50).map((start, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(startPath(start.id)),
        name: `${start.pitcher.name} vs ${start.opponent}`,
        item: {
          "@type": "SportsEvent",
          name: `${start.pitcher.name} vs ${start.opponent}`,
          startDate: start.date,
          location: { "@type": "Place", name: start.context.parkLabel },
          performer: { "@type": "Person", name: start.pitcher.name, identifier: start.pitcher.id },
          additionalProperty: { "@type": "PropertyValue", name: "GS+", value: start.gameScorePlus },
        },
      })),
    },
  ];
}

function jsonLdForStartDetail(start: NonNullable<Awaited<ReturnType<typeof getStartDetail>>>) {
  return [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: "Starts", item: absoluteUrl("/starts") },
        { "@type": "ListItem", position: 3, name: formatLongDate(start.date), item: absoluteUrl(rankedStartsPath(start.date)) },
        { "@type": "ListItem", position: 4, name: start.pitcher.name, item: absoluteUrl(startPath(start.id)) },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "SportsEvent",
      name: `${start.pitcher.name} vs ${start.opponent} - ${formatLongDate(start.date)}`,
      url: absoluteUrl(startPath(start.id)),
      startDate: start.date,
      eventStatus: "https://schema.org/EventCompleted",
      location: { "@type": "Place", name: start.game.venue },
      competitor: [
        { "@type": "SportsTeam", name: start.game.awayTeam.name },
        { "@type": "SportsTeam", name: start.game.homeTeam.name },
      ],
      performer: {
        "@type": "Person",
        name: start.pitcher.name,
        identifier: start.pitcher.id,
        image: start.pitcher.headshotUrl,
        memberOf: { "@type": "SportsTeam", name: start.pitcher.team },
      },
      additionalProperty: [
        { "@type": "PropertyValue", name: "GS+", value: start.gameScorePlus },
        { "@type": "PropertyValue", name: "Innings Pitched", value: start.line.inningsPitched },
        { "@type": "PropertyValue", name: "Strikeouts", value: start.line.strikeouts },
      ],
    },
  ];
}

function pairedStarts(starts: StartSummary[]) {
  const byGame = new Map<number, StartSummary[]>();
  for (const start of starts) {
    const group = byGame.get(start.gamePk) ?? [];
    group.push(start);
    byGame.set(start.gamePk, group);
  }

  const pairs = new Map<string, StartSummary>();
  for (const group of byGame.values()) {
    if (group.length < 2) continue;
    for (const start of group) {
      const paired = group.find((candidate) => candidate.id !== start.id);
      if (paired) pairs.set(start.id, paired);
    }
  }
  return pairs;
}

function getLineSourceLabel(source?: string) {
  if (source === "archive-gamefeed") return "Archive line";
  if (source === "live-gamefeed") return "MLB gamefeed line";
  return "Scheduled line estimate";
}

function getRankingSourceLabel(source?: string) {
  if (source === "schedule-derived-archive-line") return "Ranked from archive stats";
  if (source === "schedule-derived-gamefeed-line") return "Ranked from live gamefeed stats";
  return "Ranked from scheduled estimate";
}

function getPitchSourceLabel(source?: string) {
  if (source === "archive-gamefeed") return "Pitch chart from archive";
  if (source === "live-gamefeed") return "Pitch chart from MLB gamefeed";
  return "Pitch data pending";
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function RankedSlateStatus({ state, slateProgress }: { state: { date: string; completedStarts: number; totalStarts: number; isToday: boolean; isFinal: boolean; isPartialToday: boolean }; slateProgress: SlateProgressState }) {
  const isLive = state.isToday && slateProgress.state === "starts-in-progress";
  const label = completionStatusLabel(state, slateProgress);

  return (
    <p className="inline-flex min-h-6 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-300" role="status" aria-label={`Slate completion: ${label}`}>
      {isLive ? <span className="ranked-live-dot h-2 w-2 rounded-full bg-[#FF5A1F]" aria-hidden="true" /> : null}
      <span>{label}</span>
    </p>
  );
}

function completionStatusLabel(state: { date: string; completedStarts: number; totalStarts: number; isToday: boolean; isFinal: boolean; isPartialToday: boolean }, slateProgress: SlateProgressState) {
  if (state.isToday && slateProgress.state === "starts-in-progress") return `${state.completedStarts} final, ${Math.max(0, state.totalStarts - state.completedStarts)} in progress`;
  if (state.isFinal) return `All ${state.totalStarts} final`;
  if (state.isToday) return `Probables · Today · first starter toes the slab ${formatSlateCountdownLabel(slateProgress.countdownLabel)}`;
  return `${state.completedStarts} final`;
}

function formatSlateCountdownLabel(countdownLabel: string | null) {
  if (!countdownLabel || countdownLabel === "STARTING SOON" || countdownLabel === "DELAYED") return (countdownLabel ?? "STARTING SOON").toLowerCase();
  return `in ${countdownLabel}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lastName(name: string) {
  return name.trim().split(/\s+/).at(-1) ?? name;
}

function stableHash(value: string) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function formatBoardEyebrowDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(parsed);
}
