import Link from "next/link";
import type { Metadata } from "next";
import { FormSparkline } from "@/components/form-visuals";
import { Headshot } from "@/components/headshot";
import { UpcomingSlateRangeToggle } from "@/components/slate-date-nav";
import { SiteHeader } from "@/components/site-header";
import { LocalTime } from "@/components/local-time";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { getUpcomingStreamers, type StreamerCandidate, type UpcomingStreamersResponse } from "@/lib/data/streamers-service";
import { formatUpcomingDate } from "@/lib/routes";
import { absoluteUrl, jsonLdScript, SITE_NAME } from "@/lib/seo";

export const dynamic = "force-dynamic";

const title = "MLB Pitcher Streamers This Week";
const description = "Widely-available arms worth a one-start pickup this week, plus everyone scheduled to start twice.";
const socialDescription = "Two-start pitchers and form risers with soft upcoming matchups.";
const canonicalPath = "/upcoming/streamers";
const imagePath = `${canonicalPath}/opengraph-image`;
const imageUrl = absoluteUrl(imagePath);

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: canonicalPath,
  },
  openGraph: {
    title,
    description: socialDescription,
    type: "website",
    url: absoluteUrl(canonicalPath),
    siteName: SITE_NAME,
    images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: socialDescription,
    images: [{ url: imageUrl, alt: title }],
  },
};

export default async function UpcomingStreamersPage() {
  const today = getHomeSlateDate();
  const tomorrow = addDays(today, 1);
  const rankedDate = addDays(today, -1);
  const streamers = await getUpcomingStreamers(today);
  const jsonLd = jsonLdForUpcomingStreamers(streamers);

  return (
    <main className="min-h-screen bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8">
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 pb-3">
          <SiteHeader active="upcoming" today={today} rankedDate={rankedDate} />
          <h1 className="mt-4 font-serif text-5xl font-black text-zinc-50">Upcoming Matchups</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Two-start pitchers and form risers for the fantasy week. Streamer pickups are flagged where lineups are soft.
          </p>
          <details className="mt-3 max-w-2xl rounded border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-zinc-400">
            <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-300">What is streaming?</summary>
            <p className="mt-2 leading-6">
              Streaming means adding a widely available starter for a short window instead of holding him all season. The goal is to catch extra starts, strikeouts, and ratios when form and matchup line up.
            </p>
          </details>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500" data-responsive-check="upcoming-streamers-stamp">
            WEEK OF {formatUpcomingDate(streamers.range.start).toUpperCase()} - {formatUpcomingDate(streamers.range.end).toUpperCase()}
          </p>
          {streamers.coverage.copy ? (
            <p className="mt-2 max-w-2xl text-xs leading-5 text-zinc-500" data-streamers-coverage>
              {streamers.coverage.copy}
            </p>
          ) : null}
          <UpcomingSlateRangeToggle activeDate={today} today={today} tomorrow={tomorrow} streamersActive />
        </header>
      </div>

      <section
        className="mx-auto grid min-w-0 max-w-7xl gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
        data-responsive-check="upcoming-streamers"
        data-two-start-count={streamers.twoStartPitchers.length}
        data-form-riser-count={streamers.formRisers.length}
      >
        <StreamerSection
          title="Two-start pitchers"
          eyebrow="Fantasy week"
          description="Two starts in one fantasy week doubles the counting stats."
          emptyCopy="No two-start pitchers are visible yet."
          candidates={streamers.twoStartPitchers}
          range={streamers.range}
        />
        <StreamerSection
          title="Form risers with soft matchups"
          eyebrow="Pickup lens"
          description="Trending arms drawing a weak lineup in their next start."
          emptyCopy={streamers.funnel.emptyReason ?? "No form risers with soft matchups are visible yet."}
          candidates={streamers.formRisers}
          range={streamers.range}
          maxVisible={10}
        />
      </section>
    </main>
  );
}

function StreamerSection({
  eyebrow,
  title,
  description,
  emptyCopy,
  candidates,
  range,
  maxVisible,
}: {
  eyebrow: string;
  title: string;
  description: string;
  emptyCopy: string;
  candidates: StreamerCandidate[];
  range: UpcomingStreamersResponse["range"];
  maxVisible?: number;
}) {
  const visibleCandidates = maxVisible ? candidates.slice(0, maxVisible) : candidates;
  const hiddenCandidates = maxVisible ? candidates.slice(maxVisible) : [];

  return (
    <section className="min-w-0 rounded border border-white/10 bg-[#101014] p-4" aria-labelledby={`${slugLabel(title)}-heading`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-300">{eyebrow}</p>
      <h2 id={`${slugLabel(title)}-heading`} className="mt-2 font-serif text-2xl font-black text-zinc-50">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
      <div className="mt-4 space-y-3">
        {visibleCandidates.length ? visibleCandidates.map((candidate, index) => <StreamerCard key={`${candidate.pitcherId}-${index}`} candidate={candidate} rank={index + 1} range={range} />) : (
          <p className="rounded border border-dashed border-white/10 p-4 text-sm text-zinc-500">{emptyCopy}</p>
        )}
        {hiddenCandidates.length ? (
          <details className="rounded border border-white/10 bg-white/[0.03] p-3">
            <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">Show {hiddenCandidates.length} more</summary>
            <div className="mt-3 space-y-3">
              {hiddenCandidates.map((candidate, index) => (
                <StreamerCard key={`${candidate.pitcherId}-hidden-${index}`} candidate={candidate} rank={visibleCandidates.length + index + 1} range={range} />
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}

function StreamerCard({ candidate, rank, range }: { candidate: StreamerCandidate; rank: number; range: UpcomingStreamersResponse["range"] }) {
  return (
    <article className="min-w-0 rounded border border-white/10 bg-[#0b0b0e] p-4" data-streamer-card data-streamer-rank={rank} data-stream-score={candidate.streamScore} data-streamer-form-riser={String(candidate.formRiser)}>
      <div className="grid min-w-0 grid-cols-[52px_minmax(0,1fr)_auto] items-start gap-3">
        <Headshot playerId={candidate.pitcherId} name={candidate.pitcherName} team={candidate.team} size="lg" band={candidate.heatBand} />
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            #{rank} · {candidate.team} · {candidate.heatLabel}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-zinc-50">
            <Link href={candidate.pitcherHref} className="hover:text-amber-200">
              {candidate.pitcherName}
            </Link>
          </h3>
          {candidate.formRiser ? (
            <span className="mt-2 inline-flex rounded border border-amber-300/40 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-amber-300">Form riser</span>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Stream</p>
          <p className="font-mono text-2xl font-black text-amber-300">{candidate.streamScore.toFixed(1)}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500 min-[520px]:grid-cols-3">
        <ScoreChip label="Form" value={candidate.components.form} spark={candidate.spark} tier={candidate.formTier} trend={candidate.formTrend} pitcherName={candidate.pitcherName} />
        <ScoreChip label="Matchup" value={candidate.components.matchup} pending={!candidate.matchupDataAvailable} />
        <ScoreChip label="Park" value={candidate.components.park} />
      </div>

      <StreamerWeekStrip candidate={candidate} range={range} />

      <div className="mt-4 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
        <span className="rounded border border-white/10 px-2 py-1">W-L-ND {candidate.seasonContext.record}</span>
        <span className="rounded border border-white/10 px-2 py-1">QS {candidate.seasonContext.qualityStarts ?? "--"}</span>
        <span className="rounded border border-white/10 px-2 py-1">K/9 {candidate.seasonContext.k9 === null ? "--" : candidate.seasonContext.k9.toFixed(1)}</span>
        {candidate.trendDelta > 0 ? <span className="rounded border border-white/10 px-2 py-1">Trend +{candidate.trendDelta.toFixed(1)}</span> : null}
        {candidate.changed ? <span className="rounded border border-amber-300/40 px-2 py-1 text-amber-300">CHANGED · NOW 1 START</span> : null}
      </div>

      <div className="mt-4 space-y-2">
        {candidate.matchups.map((matchup) => (
          <Link key={`${matchup.date}-${matchup.gamePk}`} href={matchup.dayHref} className="flex items-center justify-between gap-3 rounded border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:border-amber-300/40 hover:text-zinc-50">
            <span className="min-w-0 truncate">
              {formatUpcomingDate(matchup.date)} · vs {matchup.opponent} · <span className={matchupTierClass(matchup.opponentLineupTier)}>{matchup.opponentLineupTier}</span> lineup{formatLineupRank(matchup)} · Park {matchup.parkFactor.toFixed(2)}
            </span>
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
              <LocalTime value={matchup.firstPitch} fallback="First pitch" />
            </span>
          </Link>
        ))}
      </div>
    </article>
  );
}

function ScoreChip({
  label,
  value,
  pending = false,
  spark = [],
  tier = "even",
  trend = "steady",
  pitcherName,
}: {
  label: string;
  value: number;
  pending?: boolean;
  spark?: number[];
  tier?: StreamerCandidate["formTier"];
  trend?: StreamerCandidate["formTrend"];
  pitcherName?: string;
}) {
  return (
    <div className="rounded border border-white/10 px-2 py-2">
      <span className="block text-zinc-500">{label}</span>
      <div className="mt-1 flex items-center gap-2 text-sm text-zinc-100">
        <span>{label.toUpperCase()} {pending ? "PENDING" : value.toFixed(1)}</span>
        {label === "Form" && spark.length ? (
          <div className="min-w-20 flex-1" data-streamer-form-spark>
            <FormSparkline values={spark} tier={tier} leagueMeanGS={50} label={`${pitcherName ?? "Pitcher"} recent form GS+: ${spark.join(", ")}`} trend={trend} variant="mini" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StreamerWeekStrip({ candidate, range }: { candidate: StreamerCandidate; range: UpcomingStreamersResponse["range"] }) {
  const startsByDate = new Map(candidate.matchups.map((matchup) => [matchup.date, matchup.dayHref]));
  const days = Array.from({ length: 7 }, (_, index) => addDays(range.start, index));

  return (
    <div className="mt-4 grid grid-cols-7 gap-1.5" aria-label={`${candidate.pitcherName} weekly start schedule`} data-streamer-week-strip>
      {days.map((date) => {
        const href = startsByDate.get(date);
        const label = formatWeekdayInitial(date);
        const marker = (
          <>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-500">{label}</span>
            <span className={`mt-1 h-2 w-2 rounded-full ${href ? "bg-amber-300" : "bg-zinc-700"}`} aria-hidden="true" />
          </>
        );

        return href ? (
          <Link key={date} href={href} className="grid min-h-10 place-items-center rounded border border-amber-300/30 bg-amber-300/10 hover:border-amber-300/60" aria-label={`${candidate.pitcherName} starts ${formatUpcomingDate(date)}`}>
            {marker}
          </Link>
        ) : (
          <span key={date} className="grid min-h-10 place-items-center rounded border border-white/10 bg-white/[0.02]" aria-label={`${formatUpcomingDate(date)} no scheduled start`}>
            {marker}
          </span>
        );
      })}
    </div>
  );
}

function matchupTierClass(tier: StreamerCandidate["matchups"][number]["opponentLineupTier"]) {
  if (tier === "Soft") return "font-semibold text-[var(--level-hot)]";
  if (tier === "Tough") return "font-semibold text-[var(--level-cooling)]";
  if (tier === "Pending") return "font-semibold text-zinc-500";
  return "font-semibold text-zinc-300";
}

function formatLineupRank(matchup: StreamerCandidate["matchups"][number]) {
  if (!matchup.opponentLineupRank || !matchup.opponentLineupCount) return "";
  return ` #${matchup.opponentLineupRank} of ${matchup.opponentLineupCount}`;
}

function formatWeekdayInitial(date: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "narrow", timeZone: "UTC" }).format(new Date(`${date}T00:00:00.000Z`));
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function jsonLdForUpcomingStreamers(streamers: UpcomingStreamersResponse) {
  const candidates = uniqueStreamerCandidates([...streamers.twoStartPitchers, ...streamers.formRisers]);
  const itemListCandidates = candidates.slice(0, 10);

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: title,
    description,
    url: absoluteUrl(canonicalPath),
    numberOfItems: itemListCandidates.length,
    itemListOrder: "https://schema.org/ItemListOrderDescending",
    itemListElement: itemListCandidates.map((candidate, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteUrl(candidate.pitcherHref),
      item: {
        "@type": "Person",
        name: candidate.pitcherName,
        identifier: candidate.pitcherId,
        memberOf: { "@type": "SportsTeam", name: candidate.team },
        additionalProperty: [
          { "@type": "PropertyValue", name: "Stream Score", value: candidate.streamScore },
          { "@type": "PropertyValue", name: "Upcoming Matchups", value: candidate.matchups.length },
          { "@type": "PropertyValue", name: "Heat Label", value: candidate.heatLabel },
        ],
      },
    })),
  };
}

function uniqueStreamerCandidates(candidates: StreamerCandidate[]) {
  const byPitcher = new Map<string, StreamerCandidate>();
  for (const candidate of candidates) {
    byPitcher.set(candidate.pitcherId, candidate);
  }
  return [...byPitcher.values()];
}

function slugLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
