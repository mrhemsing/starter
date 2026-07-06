import { cappedRawGameScorePlus } from "@/lib/gs-plus-raw";
import { rawGameScorePlus } from "@/lib/gs-plus-raw";
import type { CSSProperties } from "react";
import type { StartApiGameScorePlusBreakdown } from "@/lib/types";

export function RawGsPlusLine({ score, breakdown, className = "", style }: { score: number; breakdown?: StartApiGameScorePlusBreakdown | null; className?: string; style?: CSSProperties }) {
  const raw = cappedRawGameScorePlus(score, breakdown);
  if (raw === null) return null;
  return (
    <span className={`block font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 ${className}`} style={style} data-raw-gs-plus={raw.toFixed(1)}>
      RAW {raw.toFixed(1)}
    </span>
  );
}

export function RawGsPlusValueLine({ score, breakdown, className = "" }: { score: number; breakdown?: StartApiGameScorePlusBreakdown | null; className?: string }) {
  const raw = rawGameScorePlus(breakdown) ?? score;
  return (
    <span className={`block font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 ${className}`} data-raw-gs-plus={raw.toFixed(1)}>
      RAW {raw.toFixed(1)}
    </span>
  );
}
