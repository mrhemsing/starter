import Link from "next/link";
import type { Metadata } from "next";
import { FeaturedStartHighlightEmbed } from "@/components/featured-start-highlight";
import { RawGsPlusLine } from "@/components/gs-plus-score";
import { Headshot } from "@/components/headshot";
import { ShareStartButton } from "@/components/share-start-button";
import { SiteHeader } from "@/components/site-header";
import { rankBestStarts } from "@/lib/best-starts-ranking";
import { resolveFeaturedStartHighlight } from "@/lib/data/featured-highlight-service";
import { getArchivedSeasonStartSummaries, getHomeSlateDate } from "@/lib/data/start-service";
import { resolveTopPerformerImage } from "@/lib/data/top-performer-image-service";
import { formatStartLine } from "@/lib/format";
import { rawGameScorePlus } from "@/lib/gs-plus-raw";
import { pitcherHref, sourceParams, startHref, startPath } from "@/lib/routes";
import { formatMonth, largeImageTwitter, websiteOpenGraph } from "@/lib/seo";
import { startMatchupLabel } from "@/lib/start-matchup-label";
import type { FeaturedStartHighlight, StartSummary } from "@/lib/types";

type BestStartsPageProps = {
  params: Promise<{ month: string }>;
};

export async function generateMetadata({ params }: BestStartsPageProps): Promise<Metadata> {
  const { month } = await params;
  const monthLabel = formatMonth(month);
  const title = `Best Starts / ${monthLabel} archive`;
  const description = `The strongest starts of ${monthLabel}, ranked by GS+. Capped 80s show their raw score.`;
  return {
    title,
    description,
    alternates: { canonical: `/best-starts/${month}` },
    openGraph: websiteOpenGraph(title, description, `/best-starts/${month}`),
    twitter: largeImageTwitter(title, description),
  };
}

export default async function BestStartsMonthPage({ params }: BestStartsPageProps) {
  const { month } = await params;
  const today = getHomeSlateDate();
  const safeMonth = /^\d{4}-\d{2}$/.test(month) ? month : today.slice(0, 7);
  const monthLabel = formatMonth(safeMonth);
  const monthName = monthLabel.replace(/\s+\d{4}$/, "");
  const season = safeMonth.slice(0, 4);
  const starts = rankBestStarts((await getArchivedSeasonStartSummaries(season)).filter((start) => start.date.startsWith(`${safeMonth}-`)));
  const topStart = starts[0] ?? null;
  const [heroHighlight, heroImage] = await Promise.all([
    resolveSummaryHighlight(topStart),
    topStart ? resolveTopPerformerImage(topStart, null) : Promise.resolve(null),
  ]);
  const monthStats = monthStatCells(starts);
  const months = seasonMonths(today);
  const activeIndex = months.indexOf(safeMonth);
  const previousMonth = activeIndex > 0 ? months[activeIndex - 1] : null;
  const nextMonth = activeIndex >= 0 && activeIndex < months.length - 1 ? months[activeIndex + 1] : null;

  return (
    <main className="min-h-screen bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="pb-6">
          <SiteHeader active="starts" today={today} rankedDate={today} />
          <div className="mt-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-amber-300">Best starts archive</p>
              <h1 className="mt-2 font-serif text-5xl font-black text-zinc-50">{monthLabel}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
                The strongest starts of {monthLabel}, ranked by GS+. Capped 80s show their raw score.
              </p>
            </div>
            <MonthPager previousMonth={previousMonth} nextMonth={nextMonth} />
          </div>
          <MonthChips months={months} activeMonth={safeMonth} className="mt-5" />
          <StatStrip cells={monthStats} className="mt-5" />
        </header>

        {topStart ? (
          <section className="py-5">
            <MonthHero start={topStart} monthName={monthName} highlight={heroHighlight} imageUrl={heroImage?.imageUrl ?? topStart.pitcher.headshotUrl} />
          </section>
        ) : (
          <section className="rounded border border-white/10 bg-[#101014] p-6 text-sm text-zinc-400">No settled starts this month yet.</section>
        )}

        <section className="py-6">
          <div className="flex flex-col justify-between gap-3 border-b border-white/10 pb-4 md:flex-row md:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Leaderboard</p>
              <h2 className="font-serif text-3xl font-bold text-zinc-50">{monthLabel} leaderboard</h2>
            </div>
            <Link href="/best-starts" className="font-mono text-xs uppercase tracking-[0.16em] text-amber-300 underline-offset-4 hover:underline">
              Season hub
            </Link>
          </div>
          <div className="mt-4 grid gap-2" data-best-starts-month-leaderboard="true">
            {starts.slice(1, 5).map((start, index) => (
              <RichStartRow key={start.id} start={start} rank={index + 2} />
            ))}
            {starts.slice(5, 25).map((start, index) => (
              <CompactStartRow key={start.id} start={start} rank={index + 6} />
            ))}
          </div>
        </section>

        <footer className="flex flex-col justify-between gap-4 border-t border-white/10 pt-5 md:flex-row md:items-center">
          <MonthChips months={months} activeMonth={safeMonth} />
          <MonthPager previousMonth={previousMonth} nextMonth={nextMonth} />
        </footer>
      </div>
    </main>
  );
}

function MonthHero({ start, monthName, highlight, imageUrl }: { start: StartSummary; monthName: string; highlight: FeaturedStartHighlight | null; imageUrl: string }) {
  const color = scoreBandColor(start.gameScorePlus);
  return (
    <article className="overflow-hidden rounded border border-amber-300/35 bg-[#101014] shadow-[inset_3px_0_0_var(--level-onfire)]" data-best-starts-month-hero="true">
      <div className="relative grid min-h-[320px] grid-cols-[76px_minmax(0,1fr)_auto] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={`${start.pitcher.name} pitching`} className="absolute inset-0 z-0 h-full w-full object-cover" style={{ objectPosition: "50% 4%" }} />
        <span className="absolute inset-0 z-[1] bg-[linear-gradient(90deg,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.58)_55%,rgba(0,0,0,0.18)_100%)]" aria-hidden="true" />
        <div className="relative z-10 flex flex-col items-center justify-center border-r border-white/15 bg-black/55 px-2 text-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--level-onfire)] drop-shadow-[0_0_8px_rgba(251,146,60,0.85)]">Gem</span>
          <span className="mt-1 font-serif text-4xl font-black leading-none" style={{ color }}>#1</span>
          <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-400">of {monthName}</span>
        </div>
        <div className="relative z-10 min-w-0 self-center px-4 py-5">
          <Link href={pitcherHref(start.pitcher, sourceParams("starts"))} className="font-serif text-4xl font-black leading-tight text-zinc-50 hover:text-amber-300">
            {start.pitcher.name}
          </Link>
          <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-zinc-300">
            {startMatchupLabel(start)} · {formatShortDate(start.date)}
          </p>
          <p className="mt-3 text-sm text-zinc-300">{formatStartLine(start.line)}</p>
          <div className="mt-4">
            <ShareStartButton title={`${start.pitcher.name}: ${start.gameScorePlus} GS+`} text={`${start.pitcher.name} ${formatStartLine(start.line)} on Toe the Slab`} path={startPath(start.id)} />
          </div>
        </div>
        <div className="relative z-10 flex items-center px-4">
          <ScorePanel start={start} />
        </div>
      </div>
      {highlight ? (
        <div className="border-t border-white/10 p-4">
          <FeaturedStartHighlightEmbed highlight={highlight} pitcherName={start.pitcher.name} />
        </div>
      ) : null}
    </article>
  );
}

function RichStartRow({ start, rank }: { start: StartSummary; rank: number }) {
  const color = scoreBandColor(start.gameScorePlus);
  return (
    <Link href={startHref(start, sourceParams("starts"))} className={`group relative grid min-h-[128px] overflow-hidden rounded border bg-black/20 transition hover:border-amber-300/40 sm:grid-cols-[72px_minmax(0,1fr)_auto] ${start.gameScorePlus >= 69 ? "border-amber-300/35 shadow-[inset_3px_0_0_var(--level-onfire)]" : "border-white/10"}`} data-best-starts-rich-row="true">
      <div className="flex min-h-full w-[72px] flex-col items-center justify-center border-r border-white/15 bg-black/50 px-2 py-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--level-onfire)]">Gem</span>
        <span className="mt-1 font-serif text-[40px] font-black leading-none" style={{ color }}>#{rank}</span>
      </div>
      <div className="min-w-0 px-3 py-3">
        <p className="font-serif text-2xl font-bold text-zinc-50">{start.pitcher.name}</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">{startMatchupLabel(start)} · {formatShortDate(start.date)}</p>
        <p className="mt-2 text-sm text-zinc-300">{formatStartLine(start.line)}</p>
      </div>
      <div className="flex items-center px-3 pb-3 sm:py-3">
        <ScorePanel start={start} />
      </div>
    </Link>
  );
}

function CompactStartRow({ start, rank }: { start: StartSummary; rank: number }) {
  const color = scoreBandColor(start.gameScorePlus);
  return (
    <Link href={startHref(start, sourceParams("starts"))} className={`grid min-h-16 grid-cols-[38px_44px_minmax(0,1fr)_auto] items-center gap-3 rounded border bg-[#101014] px-3 py-2 transition hover:border-amber-300/40 ${start.gameScorePlus >= 69 ? "border-amber-300/35 shadow-[inset_3px_0_0_var(--level-onfire)]" : "border-white/10"}`} data-best-starts-compact-row="true">
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
    <div className={`text-right ${compact ? "" : "min-w-[76px] rounded border border-white/35 bg-[rgba(10,10,10,0.6)] px-3 py-2 text-center backdrop-blur-[6px]"}`}>
      <p className={`${compact ? "text-3xl" : "text-4xl"} font-serif font-black leading-none`} style={{ color }}>{start.gameScorePlus}</p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-300">GS+</p>
      <RawGsPlusLine score={start.gameScorePlus} breakdown={start.gameScorePlusBreakdown} className="mt-1 text-right text-zinc-300" />
    </div>
  );
}

function StatStrip({ cells, className = "" }: { cells: Array<{ value: string; label: string }>; className?: string }) {
  return (
    <div className={`grid gap-2 sm:grid-cols-4 ${className}`} data-best-starts-stat-strip="true">
      {cells.map((cell) => (
        <div key={cell.label} className="rounded border border-white/10 bg-[#101014] px-3 py-2">
          <p className="font-serif text-2xl font-bold text-zinc-50">{cell.value}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{cell.label}</p>
        </div>
      ))}
    </div>
  );
}

function MonthChips({ months, activeMonth, className = "" }: { months: string[]; activeMonth?: string; className?: string }) {
  return (
    <nav className={`flex flex-wrap gap-2 ${className}`} aria-label="Best starts months" data-best-starts-month-chips="true">
      {months.map((month) => {
        const active = month === activeMonth;
        return (
          <Link key={month} href={`/best-starts/${month}`} className={`rounded border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] ${active ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 text-zinc-400 hover:border-amber-300/50 hover:text-amber-300"}`}>
            {formatMonth(month).replace(/\s+\d{4}$/, "")}
          </Link>
        );
      })}
    </nav>
  );
}

function MonthPager({ previousMonth, nextMonth }: { previousMonth: string | null; nextMonth: string | null }) {
  return (
    <div className="flex gap-2 font-mono text-[10px] uppercase tracking-[0.14em]" data-best-starts-month-pager="true">
      {previousMonth ? <Link href={`/best-starts/${previousMonth}`} className="rounded border border-white/10 px-3 py-2 text-zinc-300 hover:border-amber-300/50">Previous</Link> : <span className="rounded border border-white/5 px-3 py-2 text-zinc-700">Previous</span>}
      {nextMonth ? <Link href={`/best-starts/${nextMonth}`} className="rounded border border-white/10 px-3 py-2 text-zinc-300 hover:border-amber-300/50">Next</Link> : <span className="rounded border border-white/5 px-3 py-2 text-zinc-700">Next</span>}
    </div>
  );
}

async function resolveSummaryHighlight(start: StartSummary | null) {
  return start ? resolveFeaturedStartHighlight(start) : null;
}

function monthStatCells(starts: StartSummary[]) {
  const starts70 = starts.filter((start) => start.gameScorePlus >= 70).length;
  const average = starts.length ? starts.reduce((sum, start) => sum + start.gameScorePlus, 0) / starts.length : 0;
  const topRaw = starts.reduce((max, start) => Math.max(max, rawGameScorePlus(start.gameScorePlusBreakdown) ?? start.gameScorePlus), 0);
  return [
    { value: String(starts70), label: "STARTS 70+" },
    { value: String(starts70), label: "GEMS" },
    { value: average.toFixed(1), label: "MONTH AVG" },
    { value: topRaw.toFixed(1), label: "TOP RAW" },
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
