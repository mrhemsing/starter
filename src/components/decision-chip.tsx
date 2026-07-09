import type { StartSummary } from "@/lib/types";

type DecisionChipSurface = "start" | "pitcher-start" | "home-start" | "home-best-start" | "slate-start";

type DecisionChipProps = {
  result: StartSummary["result"];
  className?: string;
  compact?: boolean;
  surface?: DecisionChipSurface;
};

const SURFACE_DATA_ATTRIBUTE: Record<DecisionChipSurface, string> = {
  start: "data-start-decision",
  "pitcher-start": "data-pitcher-start-decision",
  "home-start": "data-home-start-decision",
  "home-best-start": "data-home-best-start-decision",
  "slate-start": "data-slate-start-decision",
};

export function DecisionChip({ result, className = "", compact = false, surface = "start" }: DecisionChipProps) {
  const dataAttributes = { [SURFACE_DATA_ATTRIBUTE[surface]]: result };

  return (
    <span
      className={`inline-flex ${compact ? "min-h-6 w-12 text-[9px]" : "min-h-7 w-16 text-[10px]"} items-center justify-center rounded border border-white/10 bg-white/5 px-2 font-mono uppercase tracking-[0.12em] text-zinc-300 ${className}`}
      aria-label={decisionAccessibleLabel(result)}
      title="Official pitcher decision, shown as context only"
      {...dataAttributes}
    >
      {decisionChipLabel(result)}
    </span>
  );
}

export function decisionAccessibleLabel(result: StartSummary["result"]) {
  if (result === "W") return "Win";
  if (result === "L") return "Loss";
  return "No decision";
}

function decisionChipLabel(result: StartSummary["result"]) {
  if (result === "W") return "WIN";
  if (result === "L") return "LOSS";
  return "ND";
}
