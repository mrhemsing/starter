import Link from "next/link";
import type { Metadata } from "next";
import { FeaturedStartHighlightEmbed } from "@/components/featured-start-highlight";
import { Headshot } from "@/components/headshot";
import { ShareStartButton } from "@/components/share-start-button";
import { SiteNav } from "@/components/site-nav";
import { resolveFeaturedStartHighlight } from "@/lib/data/featured-highlight-service";
import { getDailySlate, getHomeSlateDate, getStartDetail } from "@/lib/data/start-service";
import { formatStartLine } from "@/lib/format";
import { startPath } from "@/lib/routes";
import { formatMonth, websiteOpenGraph, largeImageTwitter } from "@/lib/seo";
import type { FeaturedStartHighlight, StartSummary } from "@/lib/types";

type BestStartsPageProps = {
  params: Promise<{ month: string }>;
};

export async function generateMetadata({ params }: BestStartsPageProps): Promise<Metadata> {
  const { month } = await params;
  const monthLabel = formatMonth(month);
  const title = `Best MLB Starts - ${monthLabel}`;
  const description = `The highest-GS+ starting-pitcher performances of ${monthLabel}, ranked.`;
  return {
    title,
    description,
    alternates: { canonical: `/best-starts/${month}` },
    openGraph: websiteOpenGraph(title, description, `/best-starts/${month}`),
    twitter: largeImageTwitter(title, description),
  };
}

export default async function BestStartsPage({ params }: BestStartsPageProps) {
  const { month } = await params;
  const today = getHomeSlateDate();
  const rankedDate = addDays(today, -1);
  const starts = await getMonthStarts(month, today);
  const weekly = bestWindow(starts, 7);
  const monthly = starts[0] ?? null;
  const [weeklyHighlight, monthlyHighlight] = await Promise.all([
    resolveSummaryHighlight(weekly),
    resolveSummaryHighlight(monthly),
  ]);

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-white/10 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="font-mono text-2xl uppercase tracking-[0.18em] text-amber-300">Toe the Slab</Link>
            <SiteNav active="starts" today={today} rankedDate={rankedDate} />
          </div>
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.22em] text-zinc-500">Best starts archive</p>
          <h1 className="mt-2 font-serif text-5xl font-black text-zinc-50">Best Starts / {month}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Rolling 7- and 30-day leaders, then the strongest completed starts for the month.
          </p>
        </header>

        <section className="grid gap-3 border-b border-white/10 py-6 md:grid-cols-2">
          <FeatureCard label="7-day best" start={weekly} highlight={weeklyHighlight} />
          <FeatureCard label="30-day best" start={monthly} highlight={monthlyHighlight} />
        </section>

        <section className="py-6">
          <h2 className="font-serif text-3xl font-bold text-zinc-50">Monthly leaderboard</h2>
          <div className="mt-4 grid gap-2">
            {starts.slice(0, 20).map((start, index) => (
              <Link key={start.id} href={startPath(start.id)} className="grid min-h-16 grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 rounded border border-white/10 bg-[#101014] px-3 py-2 transition hover:border-amber-300/40">
                <p className="font-serif text-2xl text-zinc-500">#{index + 1}</p>
                <div className="min-w-0">
                  <p className="truncate font-serif text-xl font-bold text-zinc-50">{start.pitcher.name}</p>
                  <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">{start.pitcher.team} vs {start.opponent} / {formatStartLine(start.line)}</p>
                </div>
                <p className="font-serif text-3xl font-bold text-amber-300">{start.gameScorePlus}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function FeatureCard({ label, start, highlight }: { label: string; start: StartSummary | null; highlight?: FeaturedStartHighlight | null }) {
  if (!start) {
    return (
      <div className="rounded border border-white/10 bg-[#101014] p-5">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</p>
        <p className="mt-3 text-sm text-zinc-400">Pending a completed start.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 rounded border border-white/10 bg-[#101014] p-5 sm:grid-cols-[80px_minmax(0,1fr)_auto] sm:items-center">
      <Link href={startPath(start.id)} className="contents">
        <Headshot playerId={start.pitcher.mlbId} name={start.pitcher.name} team={start.pitcher.team} size="xl" decorative />
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-300">{label}</p>
          <h3 className="mt-1 truncate font-serif text-3xl font-bold text-zinc-50">{start.pitcher.name}</h3>
          <p className="mt-2 font-mono text-xs text-zinc-400">{start.pitcher.team} vs {start.opponent} / {formatShortDate(start.date)}</p>
        </div>
        <p className="font-serif text-5xl font-bold text-amber-300">{start.gameScorePlus}</p>
      </Link>
      <div className="sm:col-span-3">
        <ShareStartButton
          title={`${start.pitcher.name}: ${start.gameScorePlus} GS+`}
          text={`${start.pitcher.name} ${formatStartLine(start.line)} on Toe the Slab`}
          path={startPath(start.id)}
        />
        {highlight ? (
          <div className="mt-4">
            <FeaturedStartHighlightEmbed highlight={highlight} pitcherName={start.pitcher.name} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

async function resolveSummaryHighlight(start: StartSummary | null) {
  if (!start) return null;
  const detail = await getStartDetail(start.id);
  return resolveFeaturedStartHighlight(detail);
}

async function getMonthStarts(month: string, today: string) {
  const safeMonth = /^\d{4}-\d{2}$/.test(month) ? month : today.slice(0, 7);
  const dates = datesInMonth(safeMonth, today);
  const slates = await Promise.all(dates.map((date) => getDailySlate({ window: "yesterday", date })));
  return slates
    .flat()
    .filter((start) => start.source?.line !== "fixture")
    .sort((a, b) => b.gameScorePlus - a.gameScorePlus);
}

function bestWindow(starts: StartSummary[], days: number) {
  const latestDate = starts.map((start) => start.date).sort().at(-1);
  if (!latestDate) return null;
  const minDate = addDays(latestDate, -(days - 1));
  return starts.filter((start) => start.date >= minDate && start.date <= latestDate).sort((a, b) => b.gameScorePlus - a.gameScorePlus)[0] ?? null;
}

function datesInMonth(month: string, today: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const dates = [];
  for (let value = start; value.toISOString().slice(0, 7) === month; value = new Date(value.getTime() + 24 * 60 * 60 * 1000)) {
    const date = value.toISOString().slice(0, 10);
    if (date <= today) dates.push(date);
  }
  return dates.reverse();
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatShortDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(parsed);
}
