import Link from "next/link";
import type { Metadata } from "next";
import { UpcomingSlateRangeToggle } from "@/components/slate-date-nav";
import { SiteHeader } from "@/components/site-header";
import { LocalTime } from "@/components/local-time";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { getUpcomingStreamers, type StreamerCandidate } from "@/lib/data/streamers-service";
import { formatUpcomingDate } from "@/lib/routes";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MLB Pitcher Streamers This Week",
  description: "Fantasy pitcher streamers from the upcoming probable starters board, built from form, matchup, and park context.",
  alternates: {
    canonical: "/upcoming/streamers",
  },
  openGraph: {
    title: "MLB Pitcher Streamers This Week",
    description: "Two-start pitchers and form risers with soft upcoming matchups.",
    type: "website",
    url: absoluteUrl("/upcoming/streamers"),
  },
  twitter: {
    card: "summary",
    title: "MLB Pitcher Streamers This Week",
    description: "Two-start pitchers and form risers with soft upcoming matchups.",
  },
};

export default async function UpcomingStreamersPage() {
  const today = getHomeSlateDate();
  const tomorrow = addDays(today, 1);
  const rankedDate = addDays(today, -1);
  const streamers = await getUpcomingStreamers(today);

  return (
    <main className="min-h-screen bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 pb-3">
          <SiteHeader active="upcoming" today={today} rankedDate={rankedDate} />
          <h1 className="mt-4 font-serif text-5xl font-black text-zinc-50">Upcoming Matchups</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Streamers are the upcoming board through a fantasy lens: form, matchup, and park context.
          </p>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500" data-responsive-check="upcoming-streamers-stamp">
            Week of {formatUpcomingDate(streamers.range.start)} · {formatUpcomingDate(streamers.range.end)}
          </p>
          <UpcomingSlateRangeToggle activeDate={today} today={today} tomorrow={tomorrow} streamersActive />
        </header>
      </div>

      <section
        className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
        data-responsive-check="upcoming-streamers"
        data-two-start-count={streamers.twoStartPitchers.length}
        data-form-riser-count={streamers.formRisers.length}
      >
        <StreamerSection
          title="Two-start pitchers"
          eyebrow="Fantasy week"
          emptyCopy="No two-start streamers are visible yet."
          candidates={streamers.twoStartPitchers}
        />
        <StreamerSection
          title="Form risers with soft matchups"
          eyebrow="Pickup lens"
          emptyCopy="No form risers with soft matchups are visible yet."
          candidates={streamers.formRisers}
        />
      </section>
    </main>
  );
}

function StreamerSection({
  eyebrow,
  title,
  emptyCopy,
  candidates,
}: {
  eyebrow: string;
  title: string;
  emptyCopy: string;
  candidates: StreamerCandidate[];
}) {
  return (
    <section className="rounded border border-white/10 bg-[#101014] p-4" aria-labelledby={`${slugLabel(title)}-heading`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-300">{eyebrow}</p>
      <h2 id={`${slugLabel(title)}-heading`} className="mt-2 font-serif text-2xl font-black text-zinc-50">
        {title}
      </h2>
      <div className="mt-4 space-y-3">
        {candidates.length ? candidates.map((candidate, index) => <StreamerCard key={`${candidate.pitcherId}-${index}`} candidate={candidate} rank={index + 1} />) : (
          <p className="rounded border border-dashed border-white/10 p-4 text-sm text-zinc-500">{emptyCopy}</p>
        )}
      </div>
    </section>
  );
}

function StreamerCard({ candidate, rank }: { candidate: StreamerCandidate; rank: number }) {
  return (
    <article className="rounded border border-white/10 bg-[#0b0b0e] p-4" data-streamer-card data-streamer-rank={rank} data-stream-score={candidate.streamScore}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            #{rank} · {candidate.team} · {candidate.heatLabel}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-zinc-50">
            <Link href={candidate.pitcherHref} className="hover:text-amber-200">
              {candidate.pitcherName}
            </Link>
          </h3>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Stream</p>
          <p className="font-mono text-2xl font-black text-amber-300">{candidate.streamScore.toFixed(1)}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
        <ScoreChip label="Form" value={candidate.components.form} />
        <ScoreChip label="Matchup" value={candidate.components.matchup} />
        <ScoreChip label="Park" value={candidate.components.park} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
        <span className="rounded border border-white/10 px-2 py-1">W-L-ND {candidate.seasonContext.record}</span>
        <span className="rounded border border-white/10 px-2 py-1">QS {candidate.seasonContext.qualityStarts ?? "--"}</span>
        <span className="rounded border border-white/10 px-2 py-1">K/9 {candidate.seasonContext.k9 === null ? "--" : candidate.seasonContext.k9.toFixed(1)}</span>
        {candidate.changed ? <span className="rounded border border-amber-300/40 px-2 py-1 text-amber-300">Changed</span> : null}
      </div>

      <div className="mt-4 space-y-2">
        {candidate.matchups.map((matchup) => (
          <Link key={`${matchup.date}-${matchup.gamePk}`} href={matchup.dayHref} className="flex items-center justify-between gap-3 rounded border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:border-amber-300/40 hover:text-zinc-50">
            <span className="min-w-0 truncate">
              {formatUpcomingDate(matchup.date)} · vs {matchup.opponent} · {matchup.parkLabel}
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

function ScoreChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded border border-white/10 px-2 py-2">
      <span className="block text-zinc-500">{label}</span>
      <span className="mt-1 block text-sm text-zinc-100">{value.toFixed(1)}</span>
    </span>
  );
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function slugLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
