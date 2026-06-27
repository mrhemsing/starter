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

  const scoredRows = board.rows.filter(isScoredRow);
  const warmingRows = board.rows.filter((row) => !isScoredRow(row));

  return (
    <section className="space-y-3" data-live-board-date={board.date} data-live-starts={board.liveStarts} data-final-starts={board.finalStarts}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-white/10 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
        <p>{scoreboardSummaryLabel(board)}</p>
        <p>{updatedLabel}</p>
      </div>

      <div className="overflow-hidden rounded border border-white/10 bg-[#0B0C0F]">
        {scoredRows.length > 0 ? (
          <LiveScoreboardSection title="In progress" rows={scoredRows} startRank={1} />
        ) : null}
        {warmingRows.length > 0 ? (
          <LiveScoreboardSection title="Warming up" rows={warmingRows} startRank={scoredRows.length + 1} muted={scoredRows.length > 0} />
        ) : null}
      </div>
    </section>
  );
}

function scoreboardSummaryLabel(board: LiveScoreboardData) {
  return (
    <>
      <span className={board.liveStarts > 0 ? "text-[#FF9A62]" : undefined}>{board.liveStarts} live</span>
      <span> · {board.finalStarts} final · {board.warmingStarts} warming · {board.totalStarts} starters</span>
    </>
  );
}

function LiveScoreboardSection({
  title,
  rows,
  startRank,
  muted = false,
}: {
  title: string;
  rows: LiveScoreboardRow[];
  startRank: number;
  muted?: boolean;
}) {
  return (
    <div className={muted ? "border-t border-white/10 bg-white/[0.025]" : ""}>
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 sm:px-4">
        <p>{title}</p>
        <p>{rows.length} starters</p>
      </div>
      {rows.map((row, index) => (
        <LiveScoreboardRow key={row.id} row={row} rank={startRank + index} muted={muted} />
      ))}
    </div>
  );
}

function LiveScoreboardRow({ row, rank, muted = false }: { row: LiveScoreboardRow; rank: number; muted?: boolean }) {
  const scored = row.gsPlus !== null;
  const statusTone = statusClass(row.status);
  const liveOrFinalScore = isScoredRow(row);
  const headshotBand = liveOrFinalScore && scored ? scoreBand(row.gsPlus ?? 0) : null;

  return (
    <article className={`grid min-h-[88px] grid-cols-[42px_35px_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 px-3 py-3 last:border-b-0 sm:grid-cols-[54px_43px_minmax(0,1fr)_120px] sm:px-4 ${muted ? "opacity-75" : ""}`}>
      <p className="font-serif text-2xl font-bold text-zinc-500">#{rank}</p>
      <Link href={row.startHref} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" aria-label={`Open ${row.pitcherName} start page`}>
        <Headshot playerId={row.pitcherMlbId} name={row.pitcherName} team={row.team} size="md" band={headshotBand} sampleSufficient={liveOrFinalScore} decorative className="ml-0" />
      </Link>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={row.status} />
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            {row.team} vs {row.opponent}
          </p>
        </div>
        <Link href={row.startHref} className="pitcher-name mt-1 block break-words font-serif text-2xl font-bold leading-tight text-zinc-50 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 [overflow-wrap:anywhere]">
          <MobileStackedPitcherName name={row.pitcherName} />
        </Link>
        <p className="mt-1 font-mono text-xs text-zinc-400">
          {liveOrFinalScore ? formatLine(row) : projectionLabel(row)}
          {row.inningLabel ? <InningLabel label={row.inningLabel} /> : null}
        </p>
      </div>
      {liveOrFinalScore ? (
        <div className="text-right">
          <p className={`font-mono text-4xl font-black tabular-nums leading-none ${statusTone}`}>{formatScore(row.gsPlus)}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{row.scoreLabel}</p>
          {row.qualityLabel ? (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
              {row.qualityLabel}
              {row.provisional ? " · Prov." : ""}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="text-right">
          <p className="font-mono text-xl font-black tabular-nums leading-none text-zinc-300 sm:text-2xl">{formatFirstPitch(row.firstPitch)}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">First pitch</p>
        </div>
      )}
    </article>
  );
}

function InningLabel({ label }: { label: string }) {
  const forceMobileBreak = /^(top|bottom)\b/i.test(label);

  if (!forceMobileBreak) return <span className="text-zinc-600"> · {label}</span>;

  return (
    <>
      <span className="hidden text-zinc-600 sm:inline"> · </span>
      <span className="block text-zinc-600 sm:inline">{label}</span>
    </>
  );
}

function MobileStackedPitcherName({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const lastName = parts.pop();
  const firstNames = parts.join(" ");

  if (!firstNames || !lastName) return <>{name}</>;

  return (
    <>
      <span className="block sm:inline">{firstNames}</span>
      <span className="hidden sm:inline"> </span>
      <span className="block sm:inline">{lastName}</span>
    </>
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

function formatScore(score: number | null) {
  if (score === null) return "--";
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function projectionLabel(row: LiveScoreboardRow) {
  return `Projected GS+ ${formatScore(row.projectedGsPlus)}`;
}

function formatFirstPitch(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.valueOf())) return "TBD";
  return `${new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  }).format(parsed)} PT`;
}

function isScoredRow(row: LiveScoreboardRow) {
  return row.scoreLabel !== "PROJ";
}

function formatUpdatedLabel(iso: string) {
  const updatedAt = new Date(iso).getTime();
  if (!Number.isFinite(updatedAt)) return "Updated just now";
  const seconds = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
  if (seconds < 5) return "Updated just now";
  if (seconds < 60) return `Updated ${seconds}s ago`;
  return `Updated ${Math.round(seconds / 60)}m ago`;
}
