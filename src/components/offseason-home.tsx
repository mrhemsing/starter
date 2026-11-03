import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { TopPerformerCard } from "@/components/top-performer-card";
import { readCanonicalStartRecords } from "@/lib/data/canonical-start-store";
import type { SeasonState } from "@/lib/season-state";

export async function OffseasonHome({ state }: { state: SeasonState }) {
  const starts = (await readCanonicalStartRecords(state.finalSlateDate))
    .filter((start) => start.status === "final" && start.frozen)
    .sort((a, b) => b.gameScorePlus - a.gameScorePlus || a.id.localeCompare(b.id));
  const start = starts[0];
  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-6 text-zinc-100 sm:px-6 lg:px-8" data-season-complete="home">
      <div className="mx-auto max-w-7xl">
        <SiteHeader active="home" today={state.finalSlateDate} />
        <h1 className="mt-8 font-serif text-4xl font-black sm:text-6xl">{state.year} season complete</h1>
        <p className="my-5 font-mono text-sm text-amber-300">Final slate of {state.year} · {state.finalSlateDate}</p>
        {start ? <TopPerformerCard href={`/starts/${start.id}`} pitcherName={start.pitcherName} team={start.team} opponent={start.opponent} side={start.side} dateLabel={start.date} score={start.gameScorePlus} line={start.line} rank={1} slateCount={starts.length} image={null} status="archived" /> : <p>Final slate details are unavailable.</p>}
        <Link className="my-8 inline-flex min-h-11 items-center text-amber-300 underline" href={state.recapPath}>Explore the {state.year} season</Link>
      </div>
    </main>
  );
}
