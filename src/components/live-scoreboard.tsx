"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Headshot } from "@/components/headshot";
import type { FormTier } from "@/lib/types";
import type { LiveScoreboard as LiveScoreboardData, LiveScoreboardRow } from "@/lib/data/live-scoreboard-service";

type LiveScoreboardProps = {
  initialBoard: LiveScoreboardData;
};

export function LiveScoreboard({ initialBoard }: LiveScoreboardProps) {
  const [board, setBoard] = useState(initialBoard);

  useEffect(() => {
    if (!board.hasActiveStarts) return;
    let cancelled = false;

    const refresh = async () => {
      try {
        const response = await fetch(`/api/live/${encodeURIComponent(initialBoard.date)}`, { cache: "no-store" });
        if (!response.ok) return;
        const nextBoard = (await response.json()) as LiveScoreboardData;
        if (!cancelled) setBoard(nextBoard);
      } catch {
        // Keep the last server/cached board during transient live-feed misses.
      }
    };

    const interval = window.setInterval(refresh, 30 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [board.hasActiveStarts, initialBoard.date]);

  const updatedLabel = useMemo(() => formatUpdatedLabel(board.generatedAt), [board.generatedAt]);

  if (!board.hasGames) {
    return (
      <section className="rounded border border-white/10 bg-[#101014] p-6 text-zinc-300">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">No games today.</p>
      </section>
    );
  }

  return (
    <section className="space-y-3" data-live-board-date={board.date} data-live-starts={board.liveStarts} data-final-starts={board.finalStarts}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-white/10 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
        <p>{scoreboardSummaryLabel(board)}</p>
        <p>{updatedLabel}</p>
      </div>

      <div className="overflow-hidden rounded border border-white/10 bg-[#0B0C0F]">
        {board.rows.map((row, index) => (
          <LiveScoreboardRow key={row.id} row={row} rank={index + 1} />
        ))}
      </div>
    </section>
  );
}

function scoreboardSummaryLabel(board: LiveScoreboardData) {
  if (board.liveStarts > 0) {
    return (
      <>
        <span className="text-[#FF9A62]">{board.liveStarts} live</span>
        <span> · {board.finalStarts} final · {board.totalStarts} starters</span>
      </>
    );
  }

  if (board.warmingStarts > 0) return `${board.warmingStarts} warming · ${board.finalStarts} final · ${board.totalStarts} starters`;
  if (board.totalStarts > 0 && board.finalStarts >= board.totalStarts) return `All ${board.totalStarts} starters final`;
  return `${board.finalStarts} final · ${board.totalStarts} starters`;
}

function LiveScoreboardRow({ row, rank }: { row: LiveScoreboardRow; rank: number }) {
  const scored = row.gsPlus !== null;
  const statusTone = statusClass(row.status);
  const headshotBand = scored ? scoreBand(row.gsPlus ?? 0) : null;

  return (
    <article className="grid min-h-[88px] grid-cols-[42px_35px_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 px-3 py-3 last:border-b-0 sm:grid-cols-[54px_43px_minmax(0,1fr)_120px] sm:px-4">
      <p className="font-serif text-2xl font-bold text-zinc-500">#{rank}</p>
      <Link href={row.startHref} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" aria-label={`Open ${row.pitcherName} start page`}>
        <Headshot playerId={row.pitcherMlbId} name={row.pitcherName} team={row.team} size="md" band={headshotBand} sampleSufficient={scored} decorative className="ml-0" />
      </Link>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={row.status} />
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            {row.team} vs {row.opponent}
          </p>
        </div>
        <Link href={row.startHref} className="mt-1 block truncate font-serif text-2xl font-bold text-zinc-50 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
          {row.pitcherName}
        </Link>
        <p className="mt-1 font-mono text-xs text-zinc-400">
          {scored ? formatLine(row) : `Projected GS+ ${row.projectedGsPlus}`}
          {row.inningLabel ? <span className="text-zinc-600"> · {row.inningLabel}</span> : null}
        </p>
      </div>
      <div className="text-right">
        <p className={`font-mono text-4xl font-black tabular-nums leading-none ${statusTone}`}>{scored ? row.gsPlus : "--"}</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">GS+</p>
        {row.qualityLabel ? (
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
            {row.qualityLabel}
            {row.provisional ? " · Prov." : ""}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function StatusChip({ status }: { status: LiveScoreboardRow["status"] }) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-2 rounded border border-[#FF5A1F]/40 bg-[#FF5A1F]/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#FF9A62]">
        <span className="ranked-live-dot h-2 w-2 rounded-full bg-[#FF5A1F]" aria-hidden="true" />
        Live
      </span>
    );
  }

  const label = status === "delay" ? "Delay" : status === "final" ? "Final" : "Warming";
  return <span className="rounded border border-white/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400">{label}</span>;
}

function statusClass(status: LiveScoreboardRow["status"]) {
  if (status === "live" || status === "delay") return "text-[#F6C445]";
  if (status === "final") return "text-zinc-100";
  return "text-zinc-600";
}

function scoreBand(score: number): FormTier {
  if (score >= 69) return "onfire";
  if (score >= 58) return "hot";
  if (score >= 46) return "even";
  if (score >= 30) return "cooling";
  return "ice";
}

function formatLine(row: LiveScoreboardRow) {
  const line = row.line;
  const pitches = typeof row.pitchCount === "number" ? `, ${row.pitchCount} pitches` : "";
  return `${line.inningsPitched.toFixed(1)} IP, ${line.strikeouts} K, ${line.earnedRuns} ER${pitches}`;
}

function formatUpdatedLabel(iso: string) {
  const updatedAt = new Date(iso).getTime();
  if (!Number.isFinite(updatedAt)) return "Updated just now";
  const seconds = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
  if (seconds < 5) return "Updated just now";
  if (seconds < 60) return `Updated ${seconds}s ago`;
  return `Updated ${Math.round(seconds / 60)}m ago`;
}
