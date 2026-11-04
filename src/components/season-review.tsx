import { ArchiveType } from "@/components/archive-type";
import { AwardPersonLayout } from "@/components/award-person-layout";
import { SeasonRotationRow } from "@/components/season-rotation-row";
import { seasonNoHitterLine, seasonNoHitterBids, combinedNoHitterForStart } from "@/lib/season-no-hitters";
import Link from "next/link";
import { Headshot } from "@/components/headshot";
import { TopStartRow } from "@/components/ranked-starts-recap";
import { FeaturedStartHighlightEmbed } from "@/components/featured-start-highlight";
import { HeatHighlightModal } from "@/components/heat-highlight-modal";
import { seasonReviewMedia2026 as media } from "@/lib/season-review-media";
import { SiteHeader } from "@/components/site-header";
import { TopPerformerCard } from "@/components/top-performer-card";
import { HeatCheckHero } from "@/components/heat-check-hero";
import { formatStartLine } from "@/lib/format";
import { startMatchupLabel } from "@/lib/start-matchup-label";
import { startRecapPath, pitcherHref } from "@/lib/routes";
import type { FrozenSeasonReview } from "@/lib/season-review-data";
import type { StartSummary } from "@/lib/types";
import type { ReactNode } from "react";

export function SeasonReviewHeader({ review }: { review: FrozenSeasonReview }) {
  return <SiteHeader active="home" today={review.finalDate} showNoHitterAlerts={false} frozenSeason={{ status: "season_complete", year: review.year, finalSlateDate: review.finalDate, recapPath: `/${review.year}` }} />;
}

export function SeasonReviewIntro({ review, landing = false }: { review: FrozenSeasonReview; landing?: boolean }) {
  return <div className={landing ? "my-8" : undefined} data-review-heading>
    <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">{review.year} season complete</p>
    <h1 className="mt-3 font-serif text-4xl font-black leading-tight sm:text-6xl">{landing ? <Link href={`/${review.year}`}>{`${review.year} Season in Review`}</Link> : `${review.year} Season in Review`}</h1>
    <p className="my-5 max-w-3xl text-base leading-7 text-zinc-300">{review.copy.intro.text}</p>
  </div>;
}

export function SeasonReviewHero({ review, landing = false, showIntro = true }: { review: FrozenSeasonReview; landing?: boolean; showIntro?: boolean }) {
  const start = review.startOfYear;
  return <section className="my-8" data-season-review-hero>
    {showIntro ? <SeasonReviewIntro review={review} landing={landing} /> : null}
    <h2 className="mb-3 font-serif text-3xl font-bold">Start of the Year</h2>
    <p className="mb-5 max-w-3xl text-sm leading-6 text-zinc-400">{review.copy.start.text}</p>
    <TopPerformerCard href={startRecapPath(start)} pitcherHref={pitcherHref(start.pitcher)} headingLabel={`Start of the Year / ${review.year}`} leagueAverage={Number(review.leagueMean.toFixed(1))} pitcherName={start.pitcher.name} team={start.pitcher.team} opponent={start.opponent} side={start.side} dateLabel={start.date} score={start.gameScorePlus} line={start.line} recap={review.frozenRecap.recap} rank={1} slateCount={review.count} image={media.image} fallbackPitcherId={start.pitcher.mlbId} priority highlight={media.highlights[start.id] ?? review.highlight} status="archived" />
    <Link href={startRecapPath(start)} className="mt-4 inline-flex min-h-11 items-center text-amber-300 underline">Full start breakdown</Link>
    {start.narrativeNotables?.noHitDepth ? <p>{start.narrativeNotables.noHitDepth.innings} hitless innings.</p> : null}
    {landing ? <Link href={`/${review.year}`} className="ml-6 inline-flex min-h-11 items-center text-amber-300 underline">Explore all season awards</Link> : null}
  </section>;
}

export function SeasonReviewTopStarts({ review, limit = 25 }: { review: FrozenSeasonReview; limit?: number }) {
  return <ReviewSection title={`Top ${limit === 25 ? 25 : "Starts"} ${limit === 25 ? "Starts " : ""}of ${review.year}`} id="top-starts" names={awardNames(review)} intro={review.copy.top.text}>
    <p className="mb-4 font-mono text-xs text-zinc-400">#1 is featured above as Start of the Year. Continuing with #2.</p>
    <ol className="archive-start-grid" data-review-top-starts>
      {review.topStarts.slice(0, limit).map((start, index) => start.id === review.startOfYear.id ? null : <li key={start.id} className="archive-start-unit" data-review-start-id={start.id}>
        <TopStartRow start={{ ...start, rank: index + 1 }} href={startRecapPath(start)} highlight={index >= 5 ? media.highlights[start.id] : null} showDate />
        {index < 5 && media.highlights[start.id] ? <div className="mt-3" data-review-gem><FeaturedStartHighlightEmbed highlight={media.highlights[start.id]!} pitcherName={start.pitcher.name} /></div> : null}
      </li>)}
    </ol>
    {limit < 25 ? <Link href={`/${review.year}#top-starts`} className="mt-4 inline-flex min-h-11 items-center font-mono text-sm text-amber-300 underline">See all 25 starts</Link> : null}
  </ReviewSection>;
}

export function SeasonReviewAwards({ review, landing = false }: { review: FrozenSeasonReview; landing?: boolean }) {
  return <section className="archive-awards" data-season-awards>
    <h2 className="font-serif text-3xl font-bold">{`${review.year} Season Awards`}</h2>
    <div className="archive-award-grid" data-award-grid="podium-bids"><ArmOfTheYear review={review} landing={landing} /><NoHitterBids review={review} landing={landing} /></div>
    <div><RotationOfTheYear review={review} landing={landing} /></div>
    <div className="archive-award-grid" data-award-grid="gems-blowup-streak"><GemLeaders review={review} landing={landing} /><div className="archive-award-stack" data-award-stack><BiggestBlowup review={review} landing={landing} /><HottestStreak review={review} landing={landing} /></div></div>
    {!landing ? <div><LeagueContext review={review} /></div> : null}
  </section>;
}

export function ArmOfTheYear({ review, landing = false }: { review: FrozenSeasonReview; landing?: boolean }) {
  return <ReviewSection names={awardNames(review)} year={review.year} linked={landing} compact title="Arm of the Year" id="arm" intro={review.copy.arm.text}>
      <ol className="award-podium grid gap-3 lg:grid-cols-3">{review.arms.map((arm, index) => <li className="archive-linked-panel rounded border border-white/10 p-4" key={arm.pitcherId}>
        <AwardPersonLayout playerId={arm.pitcherId} name={arm.name}><div className="award-person-heading"><p className="mt-3 font-mono text-xs text-amber-300">#{index + 1}</p>
        <Link className="my-2 block font-serif text-2xl font-bold" href={pitcherHref({ pitcherId: arm.pitcherId, name: arm.name })}>{arm.name}</Link>
        </div>
        <p className="font-mono text-xs leading-6">{arm.mean.toFixed(1)} mean GS+ · {arm.starts} starts</p>
        <p className="mt-2 font-mono text-xs text-zinc-400">Qualification: {arm.minStarts} starts</p>
        </AwardPersonLayout>
      </li>)}</ol>
    </ReviewSection>;
}

export function RotationOfTheYear({ review, landing = false }: { review: FrozenSeasonReview; landing?: boolean }) {
  return <ReviewSection names={awardNames(review)} year={review.year} linked={landing} compact title="Rotation of the Year" id="rotation" intro={review.copy.rotation.text}>
      <ol data-rotation-top-five>{review.rotation.slice(0,5).map(row => <SeasonRotationRow key={row.team} row={row} winner={row.rank === 1} />)}</ol>
      <details className="mt-4" data-rotation-disclosure><summary className="cursor-pointer py-3 font-mono text-sm text-amber-300">SHOW ALL 30</summary><ol data-rotation-all>{review.rotation.map(row => <SeasonRotationRow key={row.team} row={row} winner={row.rank === 1} dense />)}</ol></details>
      <Link className="inline-flex min-h-11 items-center font-mono text-sm text-amber-300 underline" href={`/${review.year}/rotations`}>Final 30-team rotation standings</Link>
    </ReviewSection>;
}

export function NoHitterBids({ review, landing = false }: { review: FrozenSeasonReview; landing?: boolean }) {
  const bids = seasonNoHitterBids(review);
  const leading = bids.filter((start, index) => index < 2 || combinedNoHitterForStart(start.id, review.year));
  const remaining = bids.filter(start => !leading.includes(start));
  const row = (start: StartSummary) => <li key={start.id} data-start-id={start.id}><CombinedNoHitterTag startId={start.id} year={review.year} /><StartRow start={start} prefix={`${start.narrativeNotables!.noHitDepth!.innings} hitless innings`} /></li>;
  return <ReviewSection names={awardNames(review)} year={review.year} linked={landing} compact title={`The No-Hitter Bids of ${review.year}`} id="no-hitter-bids" intro={`${bids.length} starts have a recorded no-hitter bid of at least six innings.`}>
    <p className="mb-4 text-sm leading-6 text-zinc-200" data-no-hitter-verdict><ArchiveType text={seasonNoHitterLine(review)} names={awardNames(review)} /></p>
    <ol className="divide-y divide-white/10" data-review-no-hit-bids>{leading.map(row)}</ol>
    {remaining.length ? <details className="mt-3" data-bid-disclosure><summary className="cursor-pointer py-3 font-mono text-xs text-amber-300">SHOW ALL {bids.length} BIDS</summary><ol className="divide-y divide-white/10" data-review-no-hit-bids>{remaining.map(row)}</ol></details> : null}
  </ReviewSection>;
}

export function GemLeaders({ review, landing = false }: { review: FrozenSeasonReview; landing?: boolean }) {
  return <ReviewSection names={awardNames(review)} year={review.year} linked={landing} compact title="Gem Leaders" id="gems" intro={review.copy.gems.text}>
      <ol className="grid gap-2">{review.gemLeaders.map((arm) => <li key={arm.pitcherId}><Link className="archive-linked-panel flex items-center justify-between gap-4 rounded border border-white/10 p-3" href={pitcherHref({ pitcherId: arm.pitcherId, name: arm.name })}><Headshot playerId={arm.pitcherId} name={arm.name} size="md" /><span className="flex-1 font-serif text-lg">{arm.name}</span><strong className="font-mono text-amber-300">{arm.count}</strong></Link></li>)}</ol>
    </ReviewSection>;
}

export function BiggestBlowup({ review, landing = false }: { review: FrozenSeasonReview; landing?: boolean }) {
  return <ReviewSection names={awardNames(review)} year={review.year} linked={landing} compact title="Biggest Blowup" id="blowup" intro={review.copy.blowup.text}><StartRow start={review.biggestBlowup} /></ReviewSection>;
}

export function HottestStreak({ review, landing = false }: { review: FrozenSeasonReview; landing?: boolean }) {
  return <ReviewSection names={awardNames(review)} year={review.year} linked={landing} compact title="Hottest Streak" id="streak" intro={review.copy.streak.text}>
      <AwardPersonLayout playerId={review.hottestStreak.pitcherId} name={review.hottestStreak.name}><p className="mt-3 font-mono text-xs text-zinc-400">{review.hottestStreak.from} through {review.hottestStreak.through}</p>
      <Link className="inline-flex min-h-11 items-center text-amber-300 underline" href={pitcherHref({ pitcherId: review.hottestStreak.pitcherId, name: review.hottestStreak.name })}>Explore the game log</Link>
      </AwardPersonLayout>
    </ReviewSection>;
}

export function LeagueContext({ review, landing = false }: { review: FrozenSeasonReview; landing?: boolean }) {
  return <ReviewSection names={awardNames(review)} year={review.year} linked={landing} compact title="League Context" id="league" intro={review.copy.league.text}>
      <div className="space-y-3" aria-label="Season GS+ distribution">{review.distribution.map((bin) => <div key={bin.low} className="grid grid-cols-[64px_1fr_48px] items-center gap-3 font-mono text-xs">
        <span>{bin.low === bin.high ? bin.low : `${bin.low}-${bin.high}`}</span>
        <div className="h-5 bg-white/5"><div className="h-full bg-amber-300" style={{ width: `${100 * bin.count / Math.max(...review.distribution.map((row) => row.count))}%` }} /></div>
        <span className="text-right">{bin.count}</span>
      </div>)}</div>
    </ReviewSection>;
}

export function SeasonReviewFinalForm({ review }: { review: FrozenSeasonReview }) {
  return <HeatCheckHero home={review.home} finalYear={review.year} />;
}

function StartRow({ start, prefix }: { start: StartSummary; prefix?: string }) {
  return <div className="archive-linked-panel flex items-center gap-3 rounded"><Link href={startRecapPath(start)} className="flex min-w-0 flex-1 items-center justify-between gap-4 py-4">
    <Headshot playerId={start.pitcher.mlbId} name={start.pitcher.name} team={start.pitcher.team} size="lg" /><div className="min-w-0 flex-1">{prefix ? <p className="font-mono text-xs text-amber-300">{prefix}</p> : null}<p className="font-serif text-xl font-bold">{start.pitcher.name}</p><p className="mt-1 font-mono text-xs text-zinc-400">{start.date} · {startMatchupLabel(start)}</p><p className="mt-1 font-mono text-xs text-zinc-300">{formatStartLine(start.line)}</p></div>
    <strong className="shrink-0 font-mono text-2xl text-amber-300">{start.gameScorePlus}<span className="block text-[10px] font-normal text-zinc-400">GS+</span></strong>
  </Link>{media.highlights[start.id] ? <HeatHighlightModal highlight={media.highlights[start.id]!} pitcherName={start.pitcher.name} date={start.date} eyebrow="Archived MLB highlight" /> : null}</div>;
}

function ReviewSection({ title, id, intro, children, compact = false, linked = false, year, names = [] }: { names?: string[]; title: string; id: string; intro: string; children: ReactNode; compact?: boolean; linked?: boolean; year?: number }) {
  return <section id={id} data-award-panel={compact || undefined} className={`${compact ? "" : "my-8 "}rounded border border-white/10 bg-[#101014] p-4 sm:p-6`}><h2 className="font-serif text-3xl font-bold">{linked ? <Link href={`/${year}#${id}`} className="hover:text-amber-300">{title}</Link> : title}</h2><p className="mb-5 mt-3 max-w-3xl text-sm leading-6 text-zinc-400"><ArchiveType text={intro} names={names} /></p>{children}</section>;
}

function CombinedNoHitterTag({ startId, year }: { startId: string; year: number }) { return combinedNoHitterForStart(startId, year) ? <p className="pt-3 font-mono text-xs text-amber-300" data-combined-no-hitter>COMBINED NO-HITTER</p> : null; }

function awardNames(review: FrozenSeasonReview) { return [...review.arms.map(row => row.name), ...review.gemLeaders.map(row => row.name), ...seasonNoHitterBids(review).map(row => row.pitcher.name), review.biggestBlowup.pitcher.name, review.hottestStreak.name]; }
