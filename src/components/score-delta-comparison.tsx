import { formatSigned } from "@/lib/format";
import type { StartSummary } from "@/lib/types";

type ComparedStart = Pick<StartSummary, "rank" | "pitcher" | "gameScorePlus" | "gameScorePlusBreakdown">;

export function ScoreDeltaComparison({ starts }: { starts: ComparedStart[] }) {
  const comparedStarts = starts.filter((start) => start.gameScorePlusBreakdown).slice(0, 3);
  const leader = comparedStarts[0];

  if (!leader?.gameScorePlusBreakdown) return null;

  const componentKeys = leader.gameScorePlusBreakdown.rankingReasons.map((reason) => reason.key);
  const leaderComponents = leader.gameScorePlusBreakdown.components.filter((component) => componentKeys.includes(component.key));

  return (
    <div className="rounded border border-white/10 bg-[#101014] p-5" data-responsive-check="score-delta-comparison">
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Ranking delta</p>
          <h3 className="mt-1 font-serif text-2xl font-bold text-zinc-50">Why the leaderboard separated</h3>
        </div>
        <p className="font-mono text-xs text-zinc-500">
          Compared to #{leader.rank} {leader.pitcher.name}
        </p>
      </div>

      <div className="space-y-3">
        {leaderComponents.map((leaderComponent) => (
          <div key={leaderComponent.key} className="rounded border border-white/10 bg-black/15 p-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <p className="font-mono text-xs font-semibold text-zinc-200">{leaderComponent.label}</p>
              <p className="text-xs leading-5 text-zinc-500">{leaderComponent.description}</p>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              {comparedStarts.map((start) => {
                const component = start.gameScorePlusBreakdown?.components.find((item) => item.key === leaderComponent.key);
                const value = component?.value ?? 0;
                const delta = value - leaderComponent.value;

                return (
                  <div key={`${start.rank}-${leaderComponent.key}`} className="rounded border border-white/5 bg-black/20 p-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate font-mono text-xs text-zinc-300">
                        #{start.rank} {start.pitcher.name}
                      </p>
                      <p className="shrink-0 font-mono text-xs text-amber-300">GS+ {start.gameScorePlus}</p>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between gap-3 font-mono text-xs">
                      <span className={value >= 0 ? "text-emerald-300" : "text-rose-300"}>{formatSigned(value)}</span>
                      <span className={delta === 0 ? "text-zinc-500" : delta > 0 ? "text-emerald-300" : "text-rose-300"}>
                        {delta === 0 ? "Leader" : `${formatSigned(delta)} vs leader`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
