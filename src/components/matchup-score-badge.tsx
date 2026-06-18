export function MatchupScoreBadge({
  score,
  rank,
  max = 100,
  compact = false,
  rankLabel = "today",
}: {
  score: number;
  rank?: number;
  max?: number;
  compact?: boolean;
  rankLabel?: string;
}) {
  const pct = Math.max(0, Math.min(100, (score / (max || 100)) * 100));

  return (
    <div className="space-y-2 font-mono text-xs text-zinc-400" role="img" aria-label={`Matchup score ${Math.round(score)}${rank ? `, ranked ${ordinal(rank)} ${rankLabel}` : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="uppercase tracking-[0.16em] text-zinc-500">Matchup</span>
        <span className="text-zinc-200">{Math.round(score)}</span>
        {rank ? <span className="text-amber-300">{ordinal(rank)} {rankLabel}</span> : null}
      </div>
      {!compact ? (
        <div className="h-1.5 overflow-hidden rounded bg-white/10">
          <span className="block h-full rounded bg-amber-300" style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}

function ordinal(value: number) {
  const suffix = value % 10 === 1 && value % 100 !== 11
    ? "st"
    : value % 10 === 2 && value % 100 !== 12
      ? "nd"
      : value % 10 === 3 && value % 100 !== 13
        ? "rd"
        : "th";
  return `${value}${suffix}`;
}
