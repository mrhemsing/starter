import type { WatchlistNextStart } from "@/lib/data/watchlist-service";

export function WatchlistNextStartBlock({ nextStart, compact = false }: { nextStart: WatchlistNextStart | null; compact?: boolean }) {
  if (!nextStart) {
    return (
      <div className="font-mono text-xs uppercase tracking-[0.12em] text-zinc-500" data-responsive-check="watchlist-next-start-block">
        NEXT: TBD
      </div>
    );
  }

  const status = nextStart.probableStatus === "confirmed" ? "CONFIRMED" : "PROJECTED";
  const matchup = `${nextStart.side === "away" ? "@" : "vs"} ${nextStart.opponent}`;

  return (
    <div className="grid gap-2 font-mono uppercase tracking-[0.12em]" data-responsive-check="watchlist-next-start-block">
      <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${compact ? "text-[10px]" : "text-xs"} text-zinc-300`} data-watchlist-next-start-row="matchup">
        <span>NEXT: {matchup} · {formatShortDate(nextStart.date)}</span>
        <span className={`inline-flex min-h-6 items-center rounded border px-2 text-[10px] tracking-[0.12em] ${nextStart.probableStatus === "confirmed" ? "border-emerald-300/30 text-emerald-200" : "border-white/10 text-zinc-400"}`}>
          {status}
        </span>
      </div>
      <div className="grid max-w-full grid-cols-2 gap-2 text-[10px] sm:grid-cols-3" data-watchlist-next-start-row="context">
        {nextStart.parkRunFactor && nextStart.parkRunFactor > 0 ? <MicroColumn label="Park" value={nextStart.parkRunFactor.toFixed(2)} /> : null}
        <MicroColumn label="Rest" value={nextStart.daysRest === null ? "TBD" : `${nextStart.daysRest} days`} />
        <MicroColumn label="Proj GS+" value={String(nextStart.projectedGsPlus)} badge={nextStart.projectionSource === "baseline" ? "BASELINE" : undefined} />
      </div>
    </div>
  );
}

function MicroColumn({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <div className="min-w-0 rounded border border-white/10 bg-black/20 px-2 py-2">
      <p className="text-[9px] tracking-[0.14em] text-zinc-600">{label}</p>
      <p className="mt-1 flex flex-wrap items-center gap-1 text-zinc-300">
        <span>{value}</span>
        {badge ? <span className="rounded border border-amber-300/30 px-1 py-0.5 text-[8px] text-amber-200">{badge}</span> : null}
      </p>
    </div>
  );
}

function formatShortDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(parsed);
}
