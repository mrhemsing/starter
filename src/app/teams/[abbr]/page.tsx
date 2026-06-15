import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormLeaderboard } from "@/lib/data/form-service";

type TeamPageProps = {
  params: Promise<{ abbr: string }>;
};

export async function generateMetadata({ params }: TeamPageProps) {
  const { abbr } = await params;
  return {
    title: `${abbr.toUpperCase()} Starting Rotation | Front Five`,
    description: `${abbr.toUpperCase()} starting pitcher form, season GS+, and next-start context.`,
  };
}

export default async function TeamPage({ params }: TeamPageProps) {
  const { abbr } = await params;
  const team = abbr.toUpperCase();
  const leaderboard = await getFormLeaderboard({ window: 5, qualifiedOnly: false });
  const rotation = leaderboard.pitchers
    .filter((pitcher) => pitcher.team === team)
    .sort((a, b) => b.bgs - a.bgs || b.rgs - a.rgs);

  if (rotation.length === 0) notFound();

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">Front Five</Link>
        <header className="mt-6 border-b border-white/10 pb-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Team rotation</p>
          <h1 className="mt-3 font-serif text-5xl font-black leading-none text-zinc-50 sm:text-6xl">{team} starters</h1>
          <p className="mt-4 text-sm text-zinc-400">{rotation.length} tracked starters / avg GS+ {(rotation.reduce((sum, pitcher) => sum + pitcher.bgs, 0) / rotation.length).toFixed(1)}</p>
        </header>

        <section className="grid gap-3 py-8">
          {rotation.map((pitcher, index) => (
            <Link key={pitcher.pitcherId} href={`/pitchers/${pitcher.pitcherId}/form?window=5`} className="grid gap-3 rounded border border-white/10 bg-[#101014] p-4 transition hover:bg-white/[0.04] md:grid-cols-[70px_minmax(0,1fr)_120px_120px] md:items-center">
              <span className="font-serif text-2xl text-zinc-500">#{index + 1}</span>
              <span>
                <span className="block text-lg font-semibold text-zinc-50">{pitcher.name}</span>
                <span className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">{pitcher.throws ?? "-"}HP / {pitcher.status}</span>
              </span>
              <Metric label="Avg GS+" value={pitcher.bgs.toFixed(1)} />
              <Metric label="Form" value={pitcher.rgs.toFixed(1)} />
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="font-mono text-sm md:text-right">
      <span className="block text-lg font-semibold text-amber-300">{value}</span>
      <span className="text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</span>
    </span>
  );
}
