import Link from "next/link";
import type { Metadata } from "next";
import { SiteNav } from "@/components/site-nav";
import { PitchingDuelsModule } from "@/components/pitching-duels";
import { getPitchingDuels } from "@/lib/data/duels-service";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { duelsPath, formatUpcomingDate, rankedStartsPath, upcomingDateHref } from "@/lib/routes";
import { largeImageTwitter, websiteOpenGraph } from "@/lib/seo";

type DuelsPageProps = {
  params: Promise<{ date: string }>;
  searchParams?: Promise<{ mode?: string }>;
};

export async function generateMetadata({ params, searchParams }: DuelsPageProps): Promise<Metadata> {
  const { date } = await params;
  const query = await searchParams;
  const mode = query?.mode === "settled" ? "settled" : "upcoming";
  const duels = await getPitchingDuels(date, mode);
  const top = duels.bestDuels[0] ?? duels.mismatches[0];
  const title = `Best MLB Pitching Duels - ${formatUpcomingDate(date)}`;
  const description = top
    ? `The best pitching duels and biggest mismatches for ${formatUpcomingDate(date)}. ${top.label} leads with ${top.combinedQuality} combined ${mode === "settled" ? "GS+" : "Form"}.`
    : `The best pitching duels and biggest mismatches for ${formatUpcomingDate(date)}, scored from both starters' form.`;
  const queryString = mode === "settled" ? "?mode=settled" : "";

  return {
    title,
    description,
    alternates: { canonical: `${duelsPath(date)}${queryString}` },
    openGraph: {
      ...websiteOpenGraph(title, description, `${duelsPath(date)}${queryString}`),
    },
    twitter: largeImageTwitter(title, description),
  };
}

export default async function DuelsPage({ params, searchParams }: DuelsPageProps) {
  const { date } = await params;
  const query = await searchParams;
  const mode = query?.mode === "settled" ? "settled" : "upcoming";
  const today = getHomeSlateDate();
  const rankedDate = addDays(today, -1);
  const duels = await getPitchingDuels(date, mode);

  return (
    <main className="min-h-screen bg-[#08080a] text-zinc-100">
      <header className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl border-b border-white/10 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">Front Five</Link>
            <SiteNav active="upcoming" today={today} rankedDate={rankedDate} />
          </div>
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.22em] text-zinc-500">Pitching duels</p>
          <h1 className="mt-2 font-serif text-5xl font-black text-zinc-50">Duels / {formatUpcomingDate(date)}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Best duels reward two strong, evenly matched starters. Mismatches expose the biggest head-to-head gaps.
          </p>
          <nav className="mt-5 flex flex-wrap gap-2 font-mono text-xs uppercase tracking-[0.14em]" aria-label="Duel mode">
            <Link className={toggleClass(mode === "upcoming")} href={duelsPath(date)}>Upcoming form</Link>
            <Link className={toggleClass(mode === "settled")} href={`${duelsPath(date)}?mode=settled`}>Settled GS+</Link>
            <Link className={toggleClass(false)} href={upcomingDateHref(date)}>Upcoming slate</Link>
            <Link className={toggleClass(false)} href={rankedStartsPath(date)}>Ranked starts</Link>
          </nav>
        </div>
      </header>
      <PitchingDuelsModule duels={duels} title={mode === "settled" ? "Duels & Mismatches" : "Best Duels Today"} />
    </main>
  );
}

function toggleClass(active: boolean) {
  return `inline-flex min-h-11 items-center rounded border px-3 ${active ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 text-zinc-300"}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
