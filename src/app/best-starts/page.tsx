import Link from "next/link";
import type { Metadata } from "next";
import { FeaturedStartHighlightEmbed } from "@/components/featured-start-highlight";
import { RawGsPlusLine } from "@/components/gs-plus-score";
import { Headshot } from "@/components/headshot";
import { SiteHeader } from "@/components/site-header";
import { rankBestStarts } from "@/lib/best-starts-ranking";
import { getBestStartsHome } from "@/lib/data/home-best-starts-service";
import { getArchivedSeasonStartSummaries, getHomeSlateDate } from "@/lib/data/start-service";
import { formatStartLine } from "@/lib/format";
import { sourceParams, startHref } from "@/lib/routes";
import { formatMonth, largeImageTwitter, websiteOpenGraph } from "@/lib/seo";
import { startMatchupLabel } from "@/lib/start-matchup-label";
import type { FeaturedStartHighlight, StartSummary } from "@/lib/types";

export const metadata: Metadata = {
  title: "Best Starts of 2026",
  description: "The best starts of the 2026 season, with rolling 7 and 30-day leaders up top.",
  alternates: { canonical: "/best-starts" },
  openGraph: websiteOpenGraph("Best Starts of 2026", "The best starts of the 2026 season, with rolling 7 and 30-day leaders up top.", "/best-starts"),
  twitter: largeImageTwitter("Best Starts of 2026", "The best starts of the 2026 season, with rolling 7 and 30-day leaders up top."),
};

export default async function BestStartsSeasonHubPage() {
  const today = getHomeSlateDate();
  const season = today.slice(0, 4);
  const [homeBestStarts, seasonStarts] = await Promise.all([
    getBestStartsHome(),
    getArchivedSeasonStartSummaries(season),
  ]);
  const leaderboard = rankBestStarts(seasonStarts).slice(0, 25);
  const rollingCards = dedupedRollingCards(homeBestStarts.weekly, homeBestStarts.monthly, homeBestStarts.monthlyRunnerUp, homeBestStarts.weeklyHighlight, homeBestStarts.monthlyHighlight, homeBestStarts.monthlyRunnerUpHighlight);
  const months = seasonMonths(today);

  return (
    <main className="min-h-screen bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="pb-6">
          <SiteHeader active="starts" today={today} rankedDate={today} />
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.22em] text-amber-300">Best starts</p>
          <h1 className="mt-2 font-serif text-5xl font-black text-zinc-50">Best Starts of 2026</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            The best starts of the 2026 season, with rolling 7 and 30-day leaders up top.
          </p>
          <MonthChips months={months} className="mt-5" />
        </header>

        <section className="grid gap-3 border-y border-white/10 py-6 md:grid-cols-2" data-best-starts-rolling-heroes="true">
          {rollingCards.map((card) => (
            <RollingHeroCard key={card.label} label={card.label} start={card.start} highlight={card.highlight} />
          ))}
        </section>

        <section className="py-6">
          <div className="border-b border-white/10 pb-4">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Season</p>
            <h2 className="font-serif text-3xl font-bold text-zinc-50">2026 leaderboard</h2>
          </div>
          <div className="mt-4 grid gap-2" data-best-starts-season-leaderboard="true">
            {leaderboard.map((start, index) => (
              <SeasonLeaderboardRow key={start.id} start={start} rank={index + 1} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function RollingHeroCard({ label, start, highlight }: { label: string; start: StartSummary | null; highlight: FeaturedStartHighlight | null }) {
  if (!start) {
    return (
      <div className="rounded border border-white/10 bg-[#101014] p-5">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</p>
        <p className="mt-3 text-sm text-zinc-400">Pending a completed start.</p>
      </div>
    );
  }

  return (
    <article className="rounded border border-white/10 bg-[#101014] p-5">
      <Link href={startHref(start, sourceParams("starts"))} className="grid gap-4 sm:grid-cols-[80px_minmax(0,1fr)_auto] sm:items-center">
        <Headshot playerId={start.pitcher.mlbId} name={start.pitcher.name} team={start.pitcher.team} size="xl" decorative />
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-300">{label}</p>
          <h3 className="mt-1 truncate font-serif text-3xl font-bold text-zinc-50">{start.pitcher.name}</h3>
          <p className="mt-2 font-mono text-xs uppercase tracking-[0.12em] text-zinc-400">{startMatchupLabel(start)} · {formatShortDate(start.date)}</p>
          <p className="mt-2 text-sm text-zinc-400">{formatStartLine(start.line)}</p>
        </div>
        <ScorePanel start={start} />
      </Link>
      {highlight ? (
        <div className="mt-4">
          <FeaturedStartHighlightEmbed highlight={highlight} pitcherName={start.pitcher.name} />
        </div>
      ) : null}
    </article>
  );
}

function SeasonLeaderboardRow({ start, rank }: { start: StartSummary; rank: number }) {
  const color = scoreBandColor(start.gameScorePlus);
  return (
    <Link href={startHref(start, sourceParams("starts"))} className={`grid min-h-16 grid-cols-[42px_44px_minmax(0,1fr)_auto] items-center gap-3 rounded border bg-[#101014] px-3 py-2 transition hover:border-amber-300/40 ${start.gameScorePlus >= 69 ? "border-amber-300/35 shadow-[inset_3px_0_0_var(--level-onfire)]" : "border-white/10"}`} data-best-starts-season-row="true">
      <p className="font-serif text-2xl font-bold" style={{ color }}>#{rank}</p>
      <Headshot playerId={start.pitcher.mlbId} name={start.pitcher.name} team={start.pitcher.team} size="sm" decorative />
      <div className="min-w-0">
        <p className="truncate font-serif text-xl font-bold text-zinc-50">{start.pitcher.name}</p>
        <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">{startMatchupLabel(start)} · {formatShortDate(start.date)}</p>
        <p className="truncate text-xs text-zinc-400">{formatStartLine(start.line)}</p>
      </div>
      <ScorePanel start={start} compact />
    </Link>
  );
}

function ScorePanel({ start, compact = false }: { start: StartSummary; compact?: boolean }) {
  const color = scoreBandColor(start.gameScorePlus);
  return (
    <div className="text-right">
      <p className={`${compact ? "text-3xl" : "text-5xl"} font-serif font-black leading-none`} style={{ color }}>{start.gameScorePlus}</p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">GS+</p>
      <RawGsPlusLine score={start.gameScorePlus} breakdown={start.gameScorePlusBreakdown} className="mt-1 text-right text-zinc-300" />
    </div>
  );
}

function MonthChips({ months, className = "" }: { months: string[]; className?: string }) {
  return (
    <nav className={`flex flex-wrap gap-2 ${className}`} aria-label="Best starts months" data-best-starts-month-chips="true">
      {months.map((month) => (
        <Link key={month} href={`/best-starts/${month}`} className="rounded border border-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 hover:border-amber-300/50 hover:text-amber-300">
          {formatMonth(month).replace(/\s+\d{4}$/, "")}
        </Link>
      ))}
    </nav>
  );
}

function dedupedRollingCards(weekly: StartSummary | null, monthly: StartSummary | null, monthlyRunnerUp: StartSummary | null, weeklyHighlight: FeaturedStartHighlight | null, monthlyHighlight: FeaturedStartHighlight | null, monthlyRunnerUpHighlight: FeaturedStartHighlight | null) {
  if (weekly && monthly && weekly.id === monthly.id) {
    return [
      { label: "7 AND 30-DAY BEST", start: weekly, highlight: weeklyHighlight ?? monthlyHighlight },
      { label: "30-DAY NEXT BEST", start: monthlyRunnerUp, highlight: monthlyRunnerUpHighlight },
    ];
  }
  return [
    { label: "7-DAY BEST", start: weekly, highlight: weeklyHighlight },
    { label: "30-DAY BEST", start: monthly, highlight: monthlyHighlight },
  ];
}

function seasonMonths(today: string) {
  const currentMonth = today.slice(0, 7);
  const season = today.slice(0, 4);
  const months = [`${season}-04`, `${season}-05`, `${season}-06`, `${season}-07`, `${season}-08`, `${season}-09`, `${season}-10`];
  return months.filter((month) => month <= currentMonth);
}

function formatShortDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(parsed);
}

function scoreBandColor(score: number) {
  if (score >= 69) return "var(--level-onfire)";
  if (score >= 58) return "var(--level-hot)";
  if (score >= 46) return "var(--level-even-text)";
  if (score >= 30) return "var(--level-cooling)";
  return "var(--level-ice)";
}
