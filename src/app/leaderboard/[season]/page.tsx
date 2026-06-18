import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getFormLeaderboard } from "@/lib/data/form-service";
import { addDays, getHomeSlateDate } from "@/lib/data/start-service";
import { pitcherHref, sourceParams } from "@/lib/routes";

type PageProps = {
  params: Promise<{ season: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { season } = await params;
  if (!isSeason(season)) return {};
  return {
    title: `${season} GS+ Leaderboard`,
    description: `${season} season-average GS+ leaderboard for qualified MLB starting pitchers.`,
  };
}

export default async function SeasonLeaderboardPage({ params }: PageProps) {
  const { season } = await params;
  if (!isSeason(season)) notFound();
  const today = getHomeSlateDate();
  const rankedDate = addDays(today, -1);

  const leaderboard = await getFormLeaderboard({ season, window: 10, qualifiedOnly: true });
  if (leaderboard.pitchers.length === 0) notFound();

  const pitchers = [...leaderboard.pitchers].sort((a, b) => b.bgs - a.bgs || b.rgs - a.rgs);

  return (
    <main className="min-h-screen bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SiteHeader active="starts" today={today} rankedDate={rankedDate} />
        <header className="mt-6 border-b border-white/10 pb-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">{season} season leaderboard</p>
          <h1 className="mt-3 font-serif text-5xl font-black leading-none text-zinc-50">{season} GS+</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
            Qualified starters ranked by season-average GS+. ERA is shown only as a reference anchor and is not used to sort this board.
          </p>
          <nav className="mt-5 flex flex-wrap gap-2 font-mono text-[11px] uppercase tracking-[0.14em]" aria-label="Leaderboard views">
            <Link href="/leaderboard" className="rounded border border-white/10 px-3 py-2 text-zinc-400 transition hover:border-white/25 hover:text-zinc-100">Current</Link>
            <Link href="/leaderboard/consistency" className="rounded border border-white/10 px-3 py-2 text-zinc-400 transition hover:border-white/25 hover:text-zinc-100">Consistency</Link>
            <Link href="/leaderboard/ceiling" className="rounded border border-white/10 px-3 py-2 text-zinc-400 transition hover:border-white/25 hover:text-zinc-100">Ceiling</Link>
          </nav>
        </header>

        <section className="py-8">
          <div className="overflow-hidden rounded border border-white/10">
            {pitchers.map((pitcher, index) => (
              <Link
                key={pitcher.pitcherId}
                href={pitcherHref(pitcher, sourceParams("heat", { window: 5 }))}
                className="grid gap-3 border-b border-white/10 bg-[#101014] p-4 transition hover:bg-white/[0.04] last:border-b-0 md:grid-cols-[70px_minmax(0,1fr)_repeat(4,110px)] md:items-center"
              >
                <span className="font-serif text-2xl text-zinc-500">#{index + 1}</span>
                <span className="min-w-0">
                  <span className="block text-lg font-semibold text-zinc-50">{pitcher.name}</span>
                  <span className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">{pitcher.team} / {pitcher.seasonStats.inningsPitched.toFixed(1)} IP</span>
                </span>
                <Metric label="Avg GS+" value={pitcher.bgs.toFixed(1)} accent />
                <Metric label="Form" value={pitcher.rgs.toFixed(1)} />
                <Metric label="Best recent" value={String(Math.max(...pitcher.spark))} />
                <Metric label="ERA" value={pitcher.seasonStats.era === null ? "--" : pitcher.seasonStats.era.toFixed(2)} />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <span className="font-mono text-sm md:text-right">
      <span className={`block text-lg font-semibold ${accent ? "text-amber-300" : "text-zinc-100"}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</span>
    </span>
  );
}

function isSeason(value: string) {
  return /^\d{4}$/.test(value);
}
