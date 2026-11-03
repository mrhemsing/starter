import Link from "next/link";
import { Headshot } from "@/components/headshot";
import { TopStartRow } from "@/components/ranked-starts-recap";
import { FeaturedStartHighlightEmbed } from "@/components/featured-start-highlight";
import { seasonReviewMedia2026 as media } from "@/lib/season-review-media";
import { SiteHeader } from "@/components/site-header";
import { TopPerformerCard } from "@/components/top-performer-card";
import { HeatCheckHero } from "@/components/heat-check-hero";
import { formatStartLine } from "@/lib/format";
import { startRecapPath, pitcherHref } from "@/lib/routes";
import type { FrozenSeasonReview } from "@/lib/season-review-data";
import type { StartSummary } from "@/lib/types";
import type { ReactNode } from "react";

export function SeasonReviewHeader({ review }: { review: FrozenSeasonReview }) {
  return <SiteHeader active="home" today={review.finalDate} showNoHitterAlerts={false} frozenSeason={{ status: "season_complete", year: review.year, finalSlateDate: review.finalDate, recapPath: `/${review.year}` }} />;
}

export function SeasonReviewHero({ review, landing = false }: { review: FrozenSeasonReview; landing?: boolean }) {
  const start = review.startOfYear;
  return <section className="my-8" data-season-review-hero>
    <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">{review.year} season complete</p>
    <h1 className="mt-3 font-serif text-4xl font-black leading-tight sm:text-6xl">{landing ? <Link href={`/${review.year}`}>{`${review.year} Season in Review`}</Link> : `${review.year} Season in Review`}</h1>
    <p className="my-5 max-w-3xl text-base leading-7 text-zinc-300">{review.copy.intro.text}</p>
    <h2 className="mb-3 font-serif text-3xl font-bold">Start of the Year</h2>
    <p className="mb-5 max-w-3xl text-sm leading-6 text-zinc-400">{review.copy.start.text}</p>
    <TopPerformerCard href={startRecapPath(start)} pitcherHref={pitcherHref(start.pitcher)} headingLabel={`Start of the Year / ${review.year}`} leagueAverage={Number(review.leagueMean.toFixed(1))} pitcherName={start.pitcher.name} team={start.pitcher.team} opponent={start.opponent} side={start.side} dateLabel={start.date} score={start.gameScorePlus} line={start.line} recap={review.frozenRecap.recap} rank={1} slateCount={review.count} image={media.image} fallbackPitcherId={start.pitcher.mlbId} priority highlight={review.highlight} status="archived" />
    <Link href={startRecapPath(start)} className="mt-4 inline-flex min-h-11 items-center text-amber-300 underline">Full start breakdown</Link>
    {start.narrativeNotables?.noHitDepth ? <p>{start.narrativeNotables.noHitDepth.innings} hitless innings.</p> : null}
    {landing ? <Link href={`/${review.year}`} className="ml-6 inline-flex min-h-11 items-center text-amber-300 underline">Explore all season awards</Link> : null}
  </section>;
}

export function SeasonReviewTopStarts({ review, limit = 25 }: { review: FrozenSeasonReview; limit?: number }) {
  return <ReviewSection title={`Top ${limit === 25 ? 25 : "Starts"} ${limit === 25 ? "Starts " : ""}of ${review.year}`} id="top-starts" intro={review.copy.top.text}>
    <ol className="divide-y divide-white/10" data-review-top-starts>
      {review.topStarts.slice(0, limit).map((start, index) => <li key={start.id} className="py-3" data-review-start-id={start.id}>
        <TopStartRow start={{ ...start, rank: index + 1 }} href={startRecapPath(start)} showDate />
        {index < 3 && media.highlights[start.id] ? <div className="mt-3 max-w-xl" data-review-gem><FeaturedStartHighlightEmbed highlight={media.highlights[start.id]!} pitcherName={start.pitcher.name} /></div> : null}
      </li>)}
    </ol>
    {limit < 25 ? <Link href={`/${review.year}#top-starts`} className="mt-4 inline-flex min-h-11 items-center text-amber-300 underline">See all 25 starts</Link> : null}
  </ReviewSection>;
}

export function SeasonReviewAwards({ review }: { review: FrozenSeasonReview }) {
  return <>
    <ReviewSection title="Arm of the Year" id="arm" intro={review.copy.arm.text}>
      <ol className="grid gap-3 sm:grid-cols-3">{review.arms.map((arm, index) => <li className="rounded border border-white/10 p-4" key={arm.pitcherId}>
        <Headshot playerId={arm.pitcherId} name={arm.name} size="hero" /><p className="mt-3 font-mono text-xs text-amber-300">#{index + 1}</p>
        <Link className="my-2 block font-serif text-2xl font-bold" href={pitcherHref({ pitcherId: arm.pitcherId, name: arm.name })}>{arm.name}</Link>
        <p>{arm.mean.toFixed(1)} mean GS+ · {arm.starts} starts</p>
        <p className="mt-2 text-xs text-zinc-400">Qualification: {arm.minStarts} starts</p>
      </li>)}</ol>
    </ReviewSection>
    <ReviewSection title="Rotation of the Year" id="rotation" intro={review.copy.rotation.text}>
      <Link className="inline-flex min-h-11 items-center text-amber-300 underline" href={`/${review.year}/rotations`}>Final 30-team rotation standings</Link>
    </ReviewSection>
    <ReviewSection title={`The No-Hitter Bids of ${review.year}`} id="no-hitter-bids" intro={review.copy.bids.text}>
      <ol className="divide-y divide-white/10" data-review-no-hit-bids>{review.noHitBids.map((start) => <li key={start.id} data-start-id={start.id}><StartRow start={start} prefix={`${start.narrativeNotables!.noHitDepth!.innings} hitless innings`} /></li>)}</ol>
    </ReviewSection>
    <ReviewSection title="Gem Leaders" id="gems" intro={review.copy.gems.text}>
      <ol className="grid gap-2 sm:grid-cols-2">{review.gemLeaders.map((arm) => <li key={arm.pitcherId}><Link className="flex justify-between gap-4 rounded border border-white/10 p-3" href={pitcherHref({ pitcherId: arm.pitcherId, name: arm.name })}><Headshot playerId={arm.pitcherId} name={arm.name} size="md" /><span className="flex-1">{arm.name}</span><strong className="text-amber-300">{arm.count}</strong></Link></li>)}</ol>
    </ReviewSection>
    <ReviewSection title="Biggest Blowup" id="blowup" intro={review.copy.blowup.text}><StartRow start={review.biggestBlowup} /></ReviewSection>
    <ReviewSection title="Hottest Streak" id="streak" intro={review.copy.streak.text}>
      <Headshot playerId={review.hottestStreak.pitcherId} name={review.hottestStreak.name} size="hero" /><p className="mt-3 text-sm text-zinc-400">{review.hottestStreak.from} through {review.hottestStreak.through}</p>
      <Link className="inline-flex min-h-11 items-center text-amber-300 underline" href={pitcherHref({ pitcherId: review.hottestStreak.pitcherId, name: review.hottestStreak.name })}>Explore the game log</Link>
    </ReviewSection>
    <ReviewSection title="League Context" id="league" intro={review.copy.league.text}>
      <div className="space-y-3" aria-label="Season GS+ distribution">{review.distribution.map((bin) => <div key={bin.low} className="grid grid-cols-[64px_1fr_48px] items-center gap-3 font-mono text-xs">
        <span>{bin.low === bin.high ? bin.low : `${bin.low}-${bin.high}`}</span>
        <div className="h-5 bg-white/5"><div className="h-full bg-amber-300" style={{ width: `${100 * bin.count / Math.max(...review.distribution.map((row) => row.count))}%` }} /></div>
        <span className="text-right">{bin.count}</span>
      </div>)}</div>
    </ReviewSection>
  </>;
}

export function SeasonReviewFinalForm({ review }: { review: FrozenSeasonReview }) {
  return <HeatCheckHero home={review.home} finalYear={review.year} />;
}

function StartRow({ start, prefix }: { start: StartSummary; prefix?: string }) {
  return <Link href={startRecapPath(start)} className="flex items-center justify-between gap-4 py-4">
    <Headshot playerId={start.pitcher.mlbId} name={start.pitcher.name} team={start.pitcher.team} size="lg" /><div className="min-w-0 flex-1">{prefix ? <p className="font-mono text-xs text-amber-300">{prefix}</p> : null}<p className="font-serif text-xl font-bold">{start.pitcher.name}</p><p className="mt-1 text-xs text-zinc-400">{start.date} · {start.pitcher.team} vs {start.opponent}</p><p className="mt-1 text-xs text-zinc-300">{formatStartLine(start.line)}</p></div>
    <strong className="shrink-0 text-2xl text-amber-300">{start.gameScorePlus}<span className="block text-[10px] font-normal text-zinc-400">GS+</span></strong>
  </Link>;
}

function ReviewSection({ title, id, intro, children }: { title: string; id: string; intro: string; children: ReactNode }) {
  return <section id={id} className="my-8 rounded border border-white/10 bg-[#101014] p-4 sm:p-6"><h2 className="font-serif text-3xl font-bold">{title}</h2><p className="mb-5 mt-3 max-w-3xl text-sm leading-6 text-zinc-400">{intro}</p>{children}</section>;
}
