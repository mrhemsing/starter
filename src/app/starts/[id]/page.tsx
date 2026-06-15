import Link from "next/link";
import type { Metadata } from "next";
import type React from "react";
import { notFound } from "next/navigation";
import { FeaturedStartHighlightEmbed } from "@/components/featured-start-highlight";
import { HeatHighlightModal } from "@/components/heat-highlight-modal";
import { PitchChart } from "@/components/pitch-chart";
import { ScoreComponentList } from "@/components/score-component-list";
import { ScoreReasonList } from "@/components/score-reason-list";
import { ShareStartButton } from "@/components/share-start-button";
import { SiteNav } from "@/components/site-nav";
import { resolveFeaturedStartHighlight } from "@/lib/data/featured-highlight-service";
import { getDailySlate, getHomeSlateDate, getRankedSlateCompletionState, getStartDetail, summarizeSlateScoreScale } from "@/lib/data/start-service";
import { QUALITY_BANDS, qualityTierOf } from "@/lib/form-tokens";
import { formatSigned, formatStartLine } from "@/lib/format";
import { inningsFromIP } from "@/lib/innings";
import { pitcherPath, rankedStartsPath, startPath, startShareImagePath } from "@/lib/routes";
import { absoluteUrl, formatLongDate, formatShortDate, jsonLdScript, noIndexFollow } from "@/lib/seo";
import type { FeaturedStartHighlight, StartApiGameScorePlusBreakdown, StartSummary } from "@/lib/types";

type StartPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    band?: string;
    team?: string;
    sort?: string;
  }>;
};

export async function generateMetadata({ params, searchParams }: StartPageProps): Promise<Metadata> {
  const { id } = await params;
  const query = await searchParams;
  if (/^\d{4}-\d{2}-\d{2}$/.test(id)) {
    const starts = (await getDailySlate({ window: "yesterday", date: id })).filter((start) => start.source?.line !== "fixture");
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
      description: "Single-start pitch log and GS+ breakdown from Front Five.",
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

  const start = await getStartDetail(id);
  if (!start) notFound();
  const highlight = await resolveFeaturedStartHighlight(start);
  const jsonLd = jsonLdForStartDetail(start);
  const lineSourceLabel = getLineSourceLabel(start.source?.line);
  const rankingSourceLabel = getRankingSourceLabel(start.source?.ranking);
  const pitchSourceLabel = getPitchSourceLabel(start.pitchDetailSource);

  return (
    <main className="min-h-screen bg-[#08080a] text-zinc-100">
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">
            Front Five
          </Link>
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
                  text={`${start.pitcher.name} ${formatStartLine(start.line)} on Front Five`}
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
              <Link href={pitcherPath(start.pitcher.id)} className="mt-4 inline-block font-mono text-xs uppercase tracking-[0.16em] text-zinc-300">
                Pitcher page
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
  const rankedDate = addDays(today, -1);
  const [slateStarts, completionState] = await Promise.all([
    getDailySlate({ window: "yesterday", date }),
    getRankedSlateCompletionState(date, today),
  ]);
  const starts = slateStarts.filter((start) => start.source?.line !== "fixture");
  const scoreScale = summarizeSlateScoreScale(starts);
  const sort = isRankedStartSort(params?.sort) ? params?.sort ?? "rank" : "rank";
  const band = parseQualityBand(params?.band);
  const qualityBandCounts = countQualityBands(starts);
  const pairs = pairedStarts(starts);
  const highlights = await resolveRankedStartHighlights(starts);
  const jsonLd = jsonLdForRankedStarts(date, starts);
  const visibleStarts = starts
    .filter((start) => band === "all" || qualityBandSlug(qualityTierOf(start.gameScorePlus).label) === band)
    .sort((a, b) => {
      if (sort === "k") return b.line.strikeouts - a.line.strikeouts || a.rank - b.rank;
      if (sort === "ip") return inningsFromIP(b.line.inningsPitched) - inningsFromIP(a.line.inningsPitched) || a.rank - b.rank;
      return a.rank - b.rank;
    });
  const groupedStarts = rankedStartGroups(visibleStarts, sort, band, qualityBandCounts);

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 border-b border-white/10 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">Front Five</Link>
            <SiteNav active="starts" today={today} rankedDate={rankedDate} />
          </div>
          <h1 className="mt-4 font-serif text-5xl font-black text-zinc-50">MLB Starting Pitcher Rankings / {formatMetadataDate(date)}</h1>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-sm text-zinc-500">{date} / completed starts recap</p>
              <span className="inline-flex min-h-8 items-center rounded border border-amber-300/30 bg-amber-300/10 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-200" role="status" aria-label={`Slate completion: ${completionStatusLabel(completionState)}`}>
                {completionStatusLabel(completionState)}
              </span>
            </div>
            <Link className="font-mono text-xs uppercase tracking-[0.16em] text-amber-300" href="/methodology">How rankings work</Link>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-[0.14em]">
            <Link className="inline-flex min-h-11 items-center rounded border border-white/10 px-3 text-zinc-300" href={`/starts/${addDays(date, -1)}`}>Previous day</Link>
            <Link className="inline-flex min-h-11 items-center rounded border border-white/10 px-3 text-zinc-300" href={`/starts/${addDays(date, 1)}`}>Next day</Link>
            <ScaleLegend scoreScale={scoreScale} />
          </div>
          {starts.length > 0 ? (
            <div className="mt-4 grid gap-3 rounded border border-white/10 bg-[#101014] p-3 font-mono text-xs uppercase tracking-[0.14em]" data-responsive-check="ranked-start-controls">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-zinc-500">Sort</span>
                <ControlLink active={sort === "rank"} href={rankedStartsHref(date, { band, sort: "rank" })}>GS+ rank</ControlLink>
                <ControlLink active={sort === "k"} href={rankedStartsHref(date, { band, sort: "k" })}>Strikeouts</ControlLink>
                <ControlLink active={sort === "ip"} href={rankedStartsHref(date, { band, sort: "ip" })}>IP</ControlLink>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-zinc-500">Band</span>
                <ControlLink active={band === "all"} href={rankedStartsHref(date, { sort })}>All <span className="opacity-60">{starts.length}</span></ControlLink>
                {QUALITY_BANDS.map((qualityBand) => (
                  <ControlLink
                    key={qualityBand.label}
                    active={band === qualityBandSlug(qualityBand.label)}
                    href={rankedStartsHref(date, { band: qualityBandSlug(qualityBand.label), sort })}
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
            <StartsDistributionStrip starts={starts} />
            {visibleStarts.length > 0 ? (
              <section className="mt-4 space-y-4" data-responsive-check="ranked-starts-recap" data-sort={sort} data-band-filter={band}>
                {groupedStarts.map((group) => (
                  <div key={group.key} className="space-y-2">
                    {group.label ? <BandHeader label={group.label} count={group.count} color={group.color} /> : null}
                    <div className="grid gap-2">
                      {group.starts.map((start) => (
                        <RankedStartCard
                          key={start.id}
                          start={start}
                          displayRank={visibleStarts.findIndex((candidate) => candidate.id === start.id) + 1}
                          pairedStart={pairs.get(start.id)}
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
                <ControlLink active={false} href={rankedStartsHref(date, { sort })}>Show all starts</ControlLink>
              </section>
            )}
            {completionState.isPartialToday ? (
              <section className="mt-4 rounded border border-white/10 bg-[#101014] p-5" data-responsive-check="ranked-starts-remaining">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">Still moving</p>
                <Link href={`/upcoming/${date}`} className="mt-2 inline-flex min-h-11 items-center rounded border border-amber-300/40 px-3 font-mono text-xs uppercase tracking-[0.14em] text-amber-300">
                  {completionState.remainingGames} {completionState.remainingGames === 1 ? "game" : "games"} still to come tonight
                </Link>
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
    <div className="sticky top-0 z-20 flex items-center gap-3 bg-[#08080a]/92 py-2 backdrop-blur sm:static sm:bg-transparent sm:backdrop-blur-none">
      <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${color}, rgba(255,255,255,0.08))` }} />
      <p className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color }}>
        {label} · {count}
      </p>
    </div>
  );
}

function RankedStartCard({ start, displayRank, pairedStart, highlight, provisionalLeader, grouped }: { start: StartSummary; displayRank: number; pairedStart?: StartSummary; highlight?: FeaturedStartHighlight | null; provisionalLeader?: boolean; grouped?: boolean }) {
  const tier = qualityTierOf(start.gameScorePlus);
  const profile = rankedBandProfile(tier.label);
  const tierTextColor = profile.scoreColor;
  const contextLabel = start.context.label.split(" / ").at(-1) ?? start.context.label;
  const gas = isGasStart(start, tier.label);
  const topReason = topInlineReason(start);
  const initials = pitcherInitials(start.pitcher.name);

  return (
    <article
      id={start.id}
      className={`group relative overflow-hidden rounded border ${profile.borderClass} ${profile.paddingClass} ${profile.minHeightClass}`}
      style={{
        background: profile.background,
        boxShadow: profile.shadow,
      }}
      data-responsive-check="ranked-start-card"
      data-band={qualityBandSlug(tier.label)}
      data-gas={gas ? "true" : "false"}
      data-grouped={grouped ? "true" : "false"}
    >
      <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: profile.rail }} aria-hidden="true" />
      {profile.ghostRank ? (
        <div className="pointer-events-none absolute -left-2 top-1/2 hidden -translate-y-1/2 font-mono text-8xl font-black leading-none text-white/[0.035] sm:block" aria-hidden="true">
          #{start.rank}
        </div>
      ) : null}
      <div className={`relative grid gap-3 ${profile.gridClass}`}>
        <div className="min-w-0">
          <p className={`${profile.rankClass} font-serif font-bold leading-none text-zinc-500`}>#{displayRank}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: tierTextColor }}>{tier.label}</p>
          {provisionalLeader ? <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-amber-300">Leader so far</p> : null}
        </div>
        <Link href={startPath(start.id)} className={`relative grid min-w-0 items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${profile.pitcherGridClass}`}>
          <div className={`${profile.plateClass} relative grid place-items-center overflow-hidden rounded-xl border-2`} style={{ borderColor: profile.ringColor, background: profile.plateBackground }}>
            <span className="absolute font-mono text-xs font-semibold text-zinc-300">{initials}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={rankedHeadshotUrl(String(start.pitcher.mlbId), profile.imageWidth)}
              alt={`${start.pitcher.name}, ${start.pitcher.team}`}
              loading="lazy"
              className={`relative h-full w-full object-contain object-bottom ${profile.imageClass}`}
            />
          </div>
          <div className="min-w-0">
            <h2 className={`${profile.nameClass} font-serif font-bold leading-tight text-zinc-50`}>{start.pitcher.name}</h2>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{start.pitcher.team} vs {start.opponent}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {gas ? <span className="inline-flex min-h-7 items-center rounded border border-[#FF7A3D]/40 bg-[#FF7A3D]/15 px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#F6C445]">GAS</span> : null}
              {topReason && profile.showReason ? <span className="inline-flex min-h-7 items-center rounded border border-white/10 bg-black/25 px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-300">{topReason}</span> : null}
            </div>
          </div>
        </Link>
        <div className="flex items-center justify-end gap-2 sm:text-right">
          {highlight ? (
            <div>
              <HeatHighlightModal
                highlight={highlight}
                pitcherName={start.pitcher.name}
                className="grid h-11 w-11 place-items-center rounded-full border border-amber-300/35 bg-black/45 text-amber-200 shadow-sm transition hover:border-amber-300/70 hover:bg-amber-300/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              />
            </div>
          ) : null}
          <Link href={startPath(start.id)} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
            <p className={`${profile.scoreClass} font-mono font-black leading-none tabular-nums`} style={{ color: tierTextColor }}>{start.gameScorePlus}</p>
            <div className="mt-1 flex items-center justify-end gap-1.5">
              <span className="h-px w-6" style={{ backgroundColor: tierTextColor }} />
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">GS+</span>
            </div>
          </Link>
        </div>
        <div className={`min-w-0 ${profile.lineClass}`}>
          <p className={`${profile.statClass} font-mono text-zinc-300`}>{formatStartLine(start.line)}</p>
          <p className="mt-1 truncate text-xs text-zinc-500">{contextLabel}</p>
          {pairedStart ? (
            <Link href={`#${pairedStart.id}`} className="mt-1 inline-flex font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
              Paired with {pairedStart.pitcher.name} / GS+ {pairedStart.gameScorePlus}
            </Link>
          ) : null}
        </div>
      </div>
      <details className="border-t border-white/10">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center px-4 py-3 text-zinc-400 marker:text-amber-300" aria-label={`Show breakdown and links for ${start.pitcher.name}`}>
          <span aria-hidden="true" className="font-mono text-lg leading-none text-amber-300">⌄</span>
        </summary>
        <div className="grid gap-4 px-4 pb-4 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]" data-responsive-check="starts-score-breakdown">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Ranking reasons</p>
            <div className="mt-3">
              <ScoreReasonList reasons={visibleRankingReasons(start.gameScorePlusBreakdown?.rankingReasons ?? [])} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2 font-mono text-xs uppercase tracking-[0.16em]">
              <Link href={startPath(start.id)} className="inline-flex min-h-11 items-center rounded border border-amber-300/30 px-3 text-amber-300">Start Log</Link>
              <Link href={pitcherPath(start.pitcher.id)} className="inline-flex min-h-11 items-center rounded border border-white/10 px-3 text-zinc-400">Pitcher</Link>
              {pairedStart ? <Link href={`#${pairedStart.id}`} className="inline-flex min-h-11 items-center rounded border border-white/10 px-3 text-zinc-400">Same game starter</Link> : null}
            </div>
          </div>
          {start.gameScorePlusBreakdown ? <ExpandedScoreBreakdown breakdown={start.gameScorePlusBreakdown} /> : null}
        </div>
      </details>
    </article>
  );
}

async function resolveRankedStartHighlights(starts: StartSummary[]) {
  const map = new Map<string, FeaturedStartHighlight | null>();
  const details = await Promise.all(starts.map((start) => getStartDetail(start.id)));
  const highlights = await Promise.all(details.map((detail) => resolveFeaturedStartHighlight(detail)));
  starts.forEach((start, index) => map.set(start.id, highlights[index] ?? null));
  return map;
}

function ScaleLegend({ scoreScale }: { scoreScale: ReturnType<typeof summarizeSlateScoreScale> }) {
  return (
    <span className="inline-flex min-h-11 items-center rounded border border-white/10 px-3 text-zinc-400">
      Slate range {scoreScale.low}-{scoreScale.high} / Avg {scoreScale.average} / Scale {scoreScale.displayRange}
    </span>
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

function ControlLink({ active, href, children, color }: { active: boolean; href: string; children: React.ReactNode; color?: string }) {
  return (
    <Link
      className={`inline-flex min-h-9 items-center gap-2 rounded border px-3 py-1.5 ${active ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 text-zinc-300"}`}
      href={href}
      style={active && color ? { borderColor: color, backgroundColor: color } : undefined}
    >
      {children}
    </Link>
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

function pitcherInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function rankedHeadshotUrl(pitcherId: string, width: number) {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_${width},q_auto:best/v1/people/${pitcherId}/headshot/67/current`;
}

function rankedBandProfile(label: string) {
  if (label === "Elite") {
    return {
      scoreColor: "#F6C445",
      ringColor: "#F6C445",
      rail: "linear-gradient(180deg,#F6C445,#FF7A3D)",
      background: "linear-gradient(90deg,rgba(255,122,61,0.20),rgba(21,24,28,0.98) 38%,rgba(10,11,13,0.98))",
      shadow: "0 14px 48px rgba(246,196,69,0.15), inset 0 0 54px rgba(246,196,69,0.055)",
      borderClass: "border-[#F6C445]/35",
      paddingClass: "p-4 sm:p-5",
      minHeightClass: "min-h-[156px] sm:min-h-[132px]",
      gridClass: "grid-cols-[42px_minmax(0,1fr)_auto] sm:grid-cols-[62px_minmax(0,1.35fr)_minmax(0,1fr)_auto] sm:items-center",
      pitcherGridClass: "grid-cols-[64px_minmax(0,1fr)] sm:grid-cols-[88px_minmax(0,1fr)]",
      plateClass: "h-16 w-16 sm:h-[88px] sm:w-[88px]",
      imageWidth: 180,
      imageClass: "",
      nameClass: "text-3xl sm:text-4xl",
      rankClass: "text-3xl sm:text-4xl",
      scoreClass: "text-6xl sm:text-[64px]",
      statClass: "text-sm",
      lineClass: "col-span-full sm:col-span-1",
      plateBackground: "radial-gradient(circle at 50% 18%,rgba(246,196,69,0.28),rgba(10,11,13,0.92))",
      showReason: true,
      ghostRank: true,
    };
  }

  if (label === "Plus") {
    return {
      scoreColor: "#F6C445",
      ringColor: "#EF9F27",
      rail: "linear-gradient(180deg,#F6C445,#FF7A3D)",
      background: "linear-gradient(90deg,rgba(255,122,61,0.14),rgba(21,24,28,0.98) 36%,rgba(10,11,13,0.98))",
      shadow: "0 10px 34px rgba(239,159,39,0.12)",
      borderClass: "border-[#F6C445]/25",
      paddingClass: "p-3 sm:p-4",
      minHeightClass: "min-h-[134px] sm:min-h-[118px]",
      gridClass: "grid-cols-[40px_minmax(0,1fr)_auto] sm:grid-cols-[58px_minmax(0,1.35fr)_minmax(0,1fr)_auto] sm:items-center",
      pitcherGridClass: "grid-cols-[56px_minmax(0,1fr)] sm:grid-cols-[72px_minmax(0,1fr)]",
      plateClass: "h-14 w-14 sm:h-[72px] sm:w-[72px]",
      imageWidth: 160,
      imageClass: "",
      nameClass: "text-2xl sm:text-3xl",
      rankClass: "text-3xl",
      scoreClass: "text-5xl sm:text-[52px]",
      statClass: "text-sm",
      lineClass: "col-span-full sm:col-span-1",
      plateBackground: "radial-gradient(circle at 50% 18%,rgba(239,159,39,0.22),rgba(10,11,13,0.92))",
      showReason: true,
      ghostRank: false,
    };
  }

  if (label === "Solid") {
    return {
      scoreColor: "#F5F2EA",
      ringColor: "#888780",
      rail: "#888780",
      background: "linear-gradient(90deg,rgba(136,135,128,0.08),rgba(21,24,28,0.96))",
      shadow: "none",
      borderClass: "border-white/10",
      paddingClass: "p-3",
      minHeightClass: "min-h-[112px] sm:min-h-[96px]",
      gridClass: "grid-cols-[38px_minmax(0,1fr)_auto] sm:grid-cols-[52px_minmax(0,1.25fr)_minmax(0,1fr)_auto] sm:items-center",
      pitcherGridClass: "grid-cols-[48px_minmax(0,1fr)] sm:grid-cols-[56px_minmax(0,1fr)]",
      plateClass: "h-12 w-12 sm:h-14 sm:w-14",
      imageWidth: 120,
      imageClass: "",
      nameClass: "text-xl sm:text-2xl",
      rankClass: "text-2xl",
      scoreClass: "text-4xl",
      statClass: "text-sm",
      lineClass: "col-span-full sm:col-span-1",
      plateBackground: "rgba(21,24,28,0.95)",
      showReason: false,
      ghostRank: false,
    };
  }

  if (label === "Below") {
    return {
      scoreColor: "#85B7EB",
      ringColor: "#5BA8FF",
      rail: "rgba(91,168,255,0.64)",
      background: "linear-gradient(90deg,rgba(91,168,255,0.10),rgba(14,18,24,0.92))",
      shadow: "none",
      borderClass: "border-white/8",
      paddingClass: "p-2.5",
      minHeightClass: "min-h-[88px] sm:min-h-[76px]",
      gridClass: "grid-cols-[34px_minmax(0,1fr)_auto] sm:grid-cols-[46px_minmax(0,1.35fr)_minmax(0,1fr)_auto] sm:items-center",
      pitcherGridClass: "grid-cols-[40px_minmax(0,1fr)] sm:grid-cols-[44px_minmax(0,1fr)]",
      plateClass: "h-10 w-10 sm:h-11 sm:w-11",
      imageWidth: 100,
      imageClass: "grayscale opacity-80",
      nameClass: "text-lg sm:text-xl",
      rankClass: "text-xl",
      scoreClass: "text-3xl sm:text-[32px]",
      statClass: "text-xs",
      lineClass: "col-span-full sm:col-span-1",
      plateBackground: "rgba(16,24,34,0.92)",
      showReason: false,
      ghostRank: false,
    };
  }

  return {
    scoreColor: "#5BA8FF",
    ringColor: "rgba(91,168,255,0.65)",
    rail: "rgba(91,168,255,0.42)",
    background: "linear-gradient(90deg,rgba(91,168,255,0.07),rgba(10,13,18,0.9))",
    shadow: "none",
    borderClass: "border-white/5",
    paddingClass: "p-2",
    minHeightClass: "min-h-[72px]",
    gridClass: "grid-cols-[30px_minmax(0,1fr)_auto] sm:grid-cols-[42px_minmax(0,1.45fr)_minmax(0,1fr)_auto] sm:items-center",
    pitcherGridClass: "grid-cols-[36px_minmax(0,1fr)]",
    plateClass: "h-9 w-9",
    imageWidth: 80,
    imageClass: "grayscale opacity-65",
    nameClass: "text-base sm:text-lg",
    rankClass: "text-lg",
    scoreClass: "text-3xl sm:text-[28px]",
    statClass: "text-xs",
    lineClass: "col-span-full sm:col-span-1",
    plateBackground: "rgba(12,18,26,0.88)",
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

function rankedStartsHref(date: string, values: { band?: QualityBandFilter; sort?: string }) {
  const params = new URLSearchParams();
  if (values.sort && values.sort !== "rank") params.set("sort", values.sort);
  if (values.band && values.band !== "all") params.set("band", values.band);
  const query = params.toString();
  return `/starts/${date}${query ? `?${query}` : ""}`;
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

function completionStatusLabel(state: { date: string; finalGames: number; totalGames: number; isToday: boolean; isFinal: boolean; isPartialToday: boolean }) {
  if (state.isPartialToday) return `Today · ${state.finalGames} of ${state.totalGames} final · updating`;
  if (state.isToday && state.isFinal) return "Today · final";
  if (state.isToday) return `Today · ${state.finalGames} of ${state.totalGames} final`;
  return `${formatMetadataDate(state.date)} · final`;
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

function formatMetadataDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(parsed);
}
