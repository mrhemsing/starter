import { getSeasonArchive } from "@/lib/data/season-archive-service";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import type { SeasonState } from "@/lib/season-state";

export async function SeasonComplete({ state, surface }: { state: SeasonState; surface: "live" | "upcoming" | "fantasy" }) {
  const archive = await getSeasonArchive(state.year);
  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-6 text-zinc-100 sm:px-6 lg:px-8" data-season-complete={surface}>
      <div className="mx-auto max-w-7xl">
        <SiteHeader active={surface === "live" ? "live" : "upcoming"} today={archive.finalSlateDate} />
        <section className="my-10 rounded border border-white/10 bg-[#101014] p-6 sm:p-10">
          <p className="font-mono text-xs uppercase tracking-widest text-amber-300">{surface === "fantasy" ? "Fantasy offseason" : "Season archive"}</p>
          <h1 className="mt-4 font-serif text-4xl font-black sm:text-6xl">{state.year} season complete</h1>
          <p className="mt-4 text-zinc-400">Final slate: <time dateTime={archive.finalSlateDate}>{archive.finalSlateDate}</time></p>
          {surface === "fantasy" ? <p className="mt-4 text-zinc-300">Draft prep content arrives before the {state.year + 1} season.</p> : null}
          <Link className="mt-6 inline-flex min-h-11 items-center text-amber-300 underline" href={state.recapPath}>Explore the {state.year} season</Link>
          {surface === "upcoming" ? <Link className="ml-6 inline-flex min-h-11 items-center text-zinc-300 underline" href="/upcoming/streamers">Fantasy</Link> : null}
        </section>
      </div>
    </main>
  );
}
