import { ScoreExplainer } from "@/components/score-explainer";
import { SiteHeader } from "@/components/site-header";
import { getDailySlate, getHomeSlateDate, summarizeSlateScoreScale } from "@/lib/data/start-service";

export default async function HowItWorksPage() {
  const today = getHomeSlateDate();
  const rankedDate = addDays(today, -1);
  const starts = (await getDailySlate({ window: "yesterday", date: rankedDate })).filter((start) => start.source?.line !== "fixture");
  const scoreScale = summarizeSlateScoreScale(starts);

  return (
    <main className="min-h-screen bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="pb-6">
          <SiteHeader active="starts" today={today} rankedDate={rankedDate} />
          <h1 className="mt-5 font-serif text-5xl font-black text-zinc-50">How rankings work</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Game Score+ turns a starter line into a 20-80 daily ranking, then calibrates it so each slate scans like a scouting board.
          </p>
        </header>

        <div className="mt-6">
          <ScoreExplainer scoreScale={scoreScale} />
        </div>

        <section className="mt-6 rounded border border-white/10 bg-[#101014] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Calibration</p>
          <h2 className="mt-1 font-serif text-2xl font-bold text-zinc-50">Earned components first, display scale second</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            Length, misses, runs, traffic, free passes, park, and opponent context make up the earned total. The final GS+ then applies the shared 20-80 display transform so daily ranks stay comparable and readable.
          </p>
        </section>
      </div>
    </main>
  );
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
