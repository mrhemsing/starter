import Link from "next/link";
import { getParkFactorRows } from "@/lib/data/run-environment";

export const metadata = {
  title: "MLB Park Factors | Front Five",
  description: "Run-environment park factors used as context for Front Five starter projections and matchup cards.",
};

export default function ParksPage() {
  const parks = getParkFactorRows();
  const hitterFriendly = parks.filter((park) => park.runFactor > 1.02);
  const pitcherFriendly = parks.filter((park) => park.runFactor < 0.98);

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">Front Five</Link>
        <header className="mt-6 border-b border-white/10 pb-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Reference</p>
          <h1 className="mt-3 font-serif text-5xl font-black leading-none text-zinc-50 sm:text-6xl">MLB Park Factors</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
            Run factors are display context for projections and matchup cards. They are not a standalone rank key, and they stay secondary to starter form and opponent context.
          </p>
        </header>

        <section className="grid gap-3 py-6 md:grid-cols-3">
          <SummaryCard label="Most hitter-friendly" value={hitterFriendly[0]?.venue ?? "--"} detail={`${hitterFriendly[0]?.runFactor.toFixed(2) ?? "--"} run factor`} />
          <SummaryCard label="Most pitcher-friendly" value={pitcherFriendly.at(-1)?.venue ?? "--"} detail={`${pitcherFriendly.at(-1)?.runFactor.toFixed(2) ?? "--"} run factor`} />
          <SummaryCard label="Tracked parks" value={String(parks.length)} detail="Run factor + weather profile coverage" />
        </section>

        <section className="overflow-hidden rounded border border-white/10 bg-[#101014]">
          <div className="grid grid-cols-[minmax(0,1fr)_80px_90px] gap-3 border-b border-white/10 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 md:grid-cols-[minmax(0,1fr)_90px_90px_160px_140px]">
            <span>Park</span>
            <span className="text-right">Factor</span>
            <span className="text-right">Adj</span>
            <span className="hidden md:block">Environment</span>
            <span className="hidden md:block">Location</span>
          </div>
          {parks.map((park) => (
            <article key={park.venue} className="grid grid-cols-[minmax(0,1fr)_80px_90px] gap-3 border-b border-white/10 px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_90px_90px_160px_140px]">
              <div className="min-w-0">
                <h2 className="truncate font-serif text-xl font-bold text-zinc-50">{park.venue}</h2>
                <p className="mt-1 text-xs leading-5 text-zinc-500">{park.label}</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-600 md:hidden">{park.environment} / {park.location}</p>
              </div>
              <p className="font-mono text-sm text-zinc-100 text-right">{park.runFactor.toFixed(2)}</p>
              <p className={`font-mono text-sm text-right ${park.runValue < 0 ? "text-rose-300" : park.runValue > 0 ? "text-sky-300" : "text-zinc-400"}`}>
                {park.runValue > 0 ? "+" : ""}{park.runValue.toFixed(1)}
              </p>
              <p className="hidden font-mono text-xs text-zinc-400 md:block">{park.environment}</p>
              <p className="hidden font-mono text-xs text-zinc-400 md:block">{park.location}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded border border-white/10 bg-[#101014] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 font-serif text-2xl font-bold text-zinc-50">{value}</p>
      <p className="mt-1 font-mono text-xs text-zinc-500">{detail}</p>
    </div>
  );
}
