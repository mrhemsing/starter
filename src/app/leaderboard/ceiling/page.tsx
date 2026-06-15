import Link from "next/link";
import { getFormLeaderboard } from "@/lib/data/form-service";

export const metadata = {
  title: "Highest Ceiling Starting Pitchers | Front Five",
  description: "Qualified MLB starters ranked by recent GS+ ceiling and spike-start upside.",
};

export default async function CeilingLeaderboardPage() {
  const leaderboard = await getFormLeaderboard({ window: 10, qualifiedOnly: true });
  const pitchers = leaderboard.pitchers
    .map((pitcher) => {
      const ceiling = Math.max(...pitcher.spark);
      const spikeStarts = pitcher.spark.filter((score) => score >= 60).length;
      return {
        ...pitcher,
        ceiling,
        spikeStarts,
        floor: Math.min(...pitcher.spark),
      };
    })
    .sort((a, b) => b.ceiling - a.ceiling || b.spikeStarts - a.spikeStarts || b.bgs - a.bgs);

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">Front Five</Link>
        <header className="mt-6 border-b border-white/10 pb-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Leaderboard</p>
          <h1 className="mt-3 font-serif text-5xl font-black leading-none text-zinc-50 sm:text-6xl">Highest Ceiling Arms</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
            Qualified starters ranked by their best recent GS+ and count of 60+ spike starts. Built for upside checks before DFS and prop research.
          </p>
          <nav className="mt-5 flex flex-wrap gap-2 font-mono text-[11px] uppercase tracking-[0.14em]" aria-label="Leaderboard views">
            <Link href="/leaderboard" className="rounded border border-white/10 px-3 py-2 text-zinc-400 transition hover:border-white/25 hover:text-zinc-100">Season GS+</Link>
            <Link href="/leaderboard/consistency" className="rounded border border-white/10 px-3 py-2 text-zinc-400 transition hover:border-white/25 hover:text-zinc-100">Consistency</Link>
            <span className="rounded border border-sky-300/50 bg-sky-300/10 px-3 py-2 text-sky-200">Ceiling</span>
          </nav>
        </header>

        <section className="py-8">
          <div className="overflow-hidden rounded border border-white/10">
            {pitchers.map((pitcher, index) => (
              <Link
                key={pitcher.pitcherId}
                href={`/pitchers/${pitcher.pitcherId}/form?window=5`}
                className="grid gap-3 border-b border-white/10 bg-[#101014] p-4 transition hover:bg-white/[0.04] last:border-b-0 md:grid-cols-[70px_minmax(0,1fr)_repeat(4,110px)] md:items-center"
              >
                <span className="font-serif text-2xl text-zinc-500">#{index + 1}</span>
                <span className="min-w-0">
                  <span className="block text-lg font-semibold text-zinc-50">{pitcher.name}</span>
                  <span className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">{pitcher.team} / last {pitcher.spark.length}</span>
                </span>
                <Metric label="Ceiling" value={pitcher.ceiling.toFixed(0)} accent />
                <Metric label="60+ starts" value={String(pitcher.spikeStarts)} />
                <Metric label="Avg GS+" value={pitcher.bgs.toFixed(1)} />
                <Metric label="Floor" value={pitcher.floor.toFixed(0)} />
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
      <span className={`block text-lg font-semibold ${accent ? "text-sky-300" : "text-zinc-100"}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</span>
    </span>
  );
}
