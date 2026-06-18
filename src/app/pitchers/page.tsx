import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getFormLeaderboard } from "@/lib/data/form-service";
import { addDays, getHomeSlateDate } from "@/lib/data/start-service";
import { pitcherHref, sourceParams } from "@/lib/routes";

export const metadata = {
  title: "Pitcher Directory",
  description: "Searchable directory of qualified starting pitchers with links to Toe the Slab form pages.",
};

export default async function PitchersIndexPage() {
  const today = getHomeSlateDate();
  const rankedDate = addDays(today, -1);
  const leaderboard = await getFormLeaderboard({ window: 5, qualifiedOnly: true });
  const pitchers = [...leaderboard.pitchers].sort((a, b) => a.name.localeCompare(b.name));
  const teams = [...new Set(pitchers.map((pitcher) => pitcher.team).filter(Boolean))].sort();

  return (
    <main className="min-h-screen bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SiteHeader active="heat" today={today} rankedDate={rankedDate} />
        <header className="mt-6 border-b border-white/10 pb-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Directory</p>
          <h1 className="mt-3 font-serif text-5xl font-black leading-none text-zinc-50">Pitchers</h1>
          <p className="mt-4 text-sm text-zinc-400">{pitchers.length} qualified starters / {teams.length} teams</p>
        </header>

        <section className="grid gap-3 py-8 sm:grid-cols-2 lg:grid-cols-3">
          {pitchers.map((pitcher) => (
            <Link key={pitcher.pitcherId} href={pitcherHref(pitcher, sourceParams("heat", { window: 5 }))} className="rounded border border-white/10 bg-[#101014] p-4 transition hover:bg-white/[0.04]">
              <p className="font-serif text-2xl font-bold text-zinc-50">{pitcher.name}</p>
              <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">{pitcher.team} / Form {pitcher.rgs.toFixed(1)} / Avg {pitcher.bgs.toFixed(1)}</p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
