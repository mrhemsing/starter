import { formatSigned } from "@/lib/format";
import type { StartApiGameScorePlusBreakdown } from "@/lib/types";

type ScoreReason = StartApiGameScorePlusBreakdown["rankingReasons"][number];

export function ScoreReasonList({ reasons }: { reasons: ScoreReason[] }) {
  return (
    <ol className="space-y-2" data-responsive-check="score-reason-list">
      {reasons.map((reason, index) => (
        <li key={reason.key} className="rounded border border-white/10 bg-black/15 p-2" title={reason.description}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 font-mono text-xs font-semibold text-zinc-200">
              {index + 1}. {reason.label}
            </p>
            <p className={`shrink-0 font-mono text-xs ${reason.impact === "positive" ? "text-emerald-300" : "text-rose-300"}`}>
              {formatSigned(reason.value)}
            </p>
          </div>
          <p className="mt-1 text-xs leading-4 text-zinc-500">{reason.description}</p>
        </li>
      ))}
    </ol>
  );
}
