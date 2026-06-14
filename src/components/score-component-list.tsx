import { formatSigned } from "@/lib/format";
import type { StartApiGameScorePlusBreakdown } from "@/lib/types";

type ScoreComponent = StartApiGameScorePlusBreakdown["components"][number];

export function ScoreComponentList({ components, compact = false }: { components: ScoreComponent[]; compact?: boolean }) {
  return (
    <div className={compact ? "grid gap-2 sm:grid-cols-2 lg:grid-cols-3" : "space-y-3"} data-responsive-check="score-component-list">
      {components.map((component) => (
        <div key={component.key} className={compact ? "rounded border border-white/10 bg-black/15 p-3" : "border-t border-white/5 pt-3"}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-mono text-xs font-semibold text-zinc-200">{component.label}</p>
            <p className={`shrink-0 font-mono text-xs ${component.value >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
              {formatSigned(component.value)}
            </p>
          </div>
          <p className="mt-1 text-xs leading-5 text-zinc-500">{component.description}</p>
        </div>
      ))}
    </div>
  );
}
