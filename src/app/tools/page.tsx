import Link from "next/link";
import { SiteNav } from "@/components/site-nav";
import { getDecisionToolsFoundation } from "@/lib/data/decision-tools-service";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { formatUpcomingDate, upcomingDateHref } from "@/lib/routes";

type ToolsPageProps = {
  searchParams?: Promise<{
    start?: string;
    days?: string;
  }>;
};

export default async function ToolsPage({ searchParams }: ToolsPageProps) {
  const params = await searchParams;
  const today = getHomeSlateDate();
  const rankedDate = addDays(today, -1);
  const days = Number(params?.days ?? 7);
  const foundation = await getDecisionToolsFoundation({
    start: params?.start,
    days: Number.isFinite(days) ? days : 7,
  });
  const probableCount = foundation.games.flatMap((game) => game.starters).filter((starter) => starter.pitcherId).length;
  const weatherCount = foundation.games.filter((game) => game.weatherContext.source === "open-meteo").length;
  const opponentLive = foundation.source.opponent === "mlb-standings-and-team-offense";
  const previewGames = foundation.games.slice(0, 12);

  return (
    <main className="min-h-screen bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-white/10 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="font-mono text-2xl uppercase tracking-[0.18em] text-amber-300">Toe the Slab</Link>
            <SiteNav active="upcoming" today={today} rankedDate={rankedDate} />
          </div>
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.22em] text-zinc-500">Decision tools</p>
          <h1 className="mt-2 font-serif text-5xl font-black text-zinc-50">Tools Foundation</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Shared schedule, probable, opponent, park, and weather inputs for two-start pitchers, streaming targets, strikeout upside, and run-environment reads.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 font-mono text-xs uppercase tracking-[0.14em]">
            <Link className="inline-flex min-h-11 items-center rounded border border-white/10 px-3 text-zinc-300" href="/tools?days=3">3 days</Link>
            <Link className="inline-flex min-h-11 items-center rounded border border-amber-300/50 px-3 text-amber-300" href="/tools?days=7">7 days</Link>
            <Link className="inline-flex min-h-11 items-center rounded border border-white/10 px-3 text-zinc-300" href={upcomingDateHref(foundation.range.start)}>Upcoming slate</Link>
          </div>
        </header>

        <section className="grid gap-3 border-b border-white/10 py-6 sm:grid-cols-2 lg:grid-cols-4" aria-label="Foundation status">
          <Metric label="Range" value={`${formatUpcomingDate(foundation.range.start)}-${formatUpcomingDate(foundation.range.end)}`} />
          <Metric label="Games" value={String(foundation.games.length)} />
          <Metric label="Probables" value={String(probableCount)} />
          <Metric label="Weather" value={`${weatherCount} outdoor`} />
        </section>

        <section className="grid gap-3 border-b border-white/10 py-6 md:grid-cols-2" aria-label="Foundation sources">
          <SourceCard label="Schedule lookahead" value={`${foundation.source.schedule.length} day feeds`} detail={foundation.source.schedule.map((row) => `${row.date}: ${row.source}`).join(" / ")} />
          <SourceCard label="Opponent strength" value={opponentLive ? "Live MLB context" : "Fallback context"} detail="Quality and offense run values are attached to each starter's opponent." />
          <SourceCard label="Park factors" value="Shared venue run factors" detail="Each game and starter gets the same park context object for downstream tools." />
          <SourceCard label="Weather" value="Open-Meteo game-time forecast" detail="Outdoor parks get game-time temp, wind, precipitation, and a neutral/favorable run value." />
        </section>

        <section className="py-6" aria-label="Foundation sample">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Queryable input preview</p>
              <h2 className="mt-2 font-serif text-3xl font-bold text-zinc-50">Upcoming Context</h2>
            </div>
            <Link className="hidden rounded border border-white/10 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-zinc-300 sm:inline-flex" href={`/api/tools/foundation?start=${foundation.range.start}&days=7`}>
              JSON
            </Link>
          </div>
          <div className="grid gap-3">
            {previewGames.map((game) => (
              <article key={game.gamePk} className="rounded border border-white/10 bg-[#101014] p-4">
                <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{formatUpcomingDate(game.date)} / {game.status}</p>
                    <h3 className="mt-1 font-serif text-2xl font-bold text-zinc-50">{game.label}</h3>
                    <p className="mt-1 text-sm text-zinc-400">{game.parkContext.label} {game.weatherContext.label}</p>
                  </div>
                  <p className="font-mono text-xs uppercase tracking-[0.14em] text-amber-300">{game.parkContext.runValue >= 0 ? "+" : ""}{game.parkContext.runValue.toFixed(1)} park / {game.weatherContext.runValue >= 0 ? "+" : ""}{game.weatherContext.runValue.toFixed(1)} weather</p>
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {game.starters.map((starter) => (
                    <div key={`${game.gamePk}-${starter.side}`} className="rounded border border-white/10 bg-black/20 p-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{starter.team} vs {starter.opponent}</p>
                      <p className="mt-1 text-sm font-medium text-zinc-100">{starter.name ?? "Starter TBD"}</p>
                      <p className="mt-2 text-xs leading-5 text-zinc-400">{starter.opponentContext.offenseLabel}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-[#101014] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 font-serif text-2xl font-bold text-zinc-50">{value}</p>
    </div>
  );
}

function SourceCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded border border-white/10 bg-[#101014] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 font-serif text-2xl font-bold text-zinc-50">{value}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{detail}</p>
    </div>
  );
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
