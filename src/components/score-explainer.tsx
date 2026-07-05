import type { SlateApiScoreScale } from "@/lib/types";

type ScoreExplainerProps = {
  scoreScale?: SlateApiScoreScale;
};

const fallbackExplanation: SlateApiScoreScale["explanation"] = [
  {
    label: "Start line",
    value: "IP / K / ER / traffic",
    description: "Length and missed bats lift the score; runs, hits, and walks pull it back.",
  },
  {
    label: "Context",
    value: "Park / opponent",
    description: "The same line gets adjusted for run environment and matchup quality.",
  },
  {
    label: "Display",
    value: "20-80 GS+",
    description: "The raw total is calibrated onto a scouting-style range so slate ranks are easy to scan.",
  },
];

export function ScoreExplainer({ scoreScale }: ScoreExplainerProps) {
  const explanation = scoreScale?.explanation?.length ? scoreScale.explanation : fallbackExplanation;

  return (
    <section className="rounded border border-white/10 bg-[#101014] p-5" data-responsive-check="score-explainer">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">How rankings work</p>
          <h3 className="mt-1 font-serif text-2xl font-bold text-zinc-50">Game Score+ composition</h3>
        </div>
        <p className="font-mono text-xs text-amber-300">{scoreScale?.formulaVersion ?? "context-v8"}</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {explanation.map((step) => (
          <div key={step.label} className="rounded border border-white/10 bg-black/15 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{step.label}</p>
            <p className="mt-2 font-mono text-xs font-semibold text-zinc-200">{step.value}</p>
            <p className="mt-2 text-xs leading-5 text-zinc-500">{step.description}</p>
          </div>
        ))}
      </div>

      {scoreScale ? (
        <div className="mt-4 grid gap-2 font-mono text-xs text-zinc-500 sm:grid-cols-3">
          <ScalePill label="Slate range" value={`${scoreScale.low}-${scoreScale.high}`} />
          <ScalePill label="Average" value={String(scoreScale.average)} />
          <ScalePill label="Scale" value={scoreScale.displayRange} />
        </div>
      ) : null}
    </section>
  );
}

function ScalePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded border border-white/10 bg-black/10 px-3 py-2">
      <span className="uppercase tracking-[0.14em]">{label}</span>
      <span className="text-zinc-200">{value}</span>
    </div>
  );
}
