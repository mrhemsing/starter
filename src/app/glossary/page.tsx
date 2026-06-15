import Link from "next/link";

const terms = [
  ["GS+", "Front Five's completed-start score. It rates one start using line quality, workload, strikeouts, walks, run prevention, park, opponent, and calibration context."],
  ["RGS", "Rolling GS+. A starter's recent-form average over the selected Heat Check window."],
  ["Projected GS+", "Forward-looking starter estimate from current form, line-backed workload, park, weather, rest, and opponent handedness splits when available."],
  ["Driver chip", "Compact data chip explaining what moved form: strikeouts, walks, depth, or run prevention."],
  ["ERA anchor", "Traditional ERA shown as secondary context. It is descriptive only and never drives rank."],
  ["Opponent split", "Team hitting context against the starter's handedness, sourced from MLB team stat splits and shown as OPS, K%, BB%, ISO, and slate rank context."],
  ["Pitch data pending", "A start has a real MLB line but no verified pitch-event feed. Front Five hides pitch charts rather than showing synthetic data."],
];

export const metadata = {
  title: "Glossary | Front Five",
  description: "Definitions for GS+, RGS, projected GS+, driver chips, ERA anchors, and Front Five pitching terms.",
};

export default function GlossaryPage() {
  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">Front Five</Link>
        <header className="mt-6 border-b border-white/10 pb-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Reference</p>
          <h1 className="mt-3 font-serif text-5xl font-black leading-none text-zinc-50 sm:text-6xl">Glossary</h1>
        </header>
        <section className="grid gap-3 py-8">
          {terms.map(([term, definition]) => (
            <article key={term} className="rounded border border-white/10 bg-[#101014] p-4">
              <h2 className="font-serif text-2xl font-bold text-zinc-50">{term}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">{definition}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
