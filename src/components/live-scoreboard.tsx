"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Headshot } from "@/components/headshot";
import type { LiveScoreboard as LiveScoreboardData, LiveScoreboardRow } from "@/lib/data/live-scoreboard-service";
import { rankedStartsPath, upcomingDateHref } from "@/lib/routes";
import { formatFirstPitchCountdown, type SlateProgressState } from "@/lib/slate-state";

type LiveScoreboardProps = {
  initialBoard: LiveScoreboardData;
  initialSlateProgress: SlateProgressState;
};

export function LiveScoreboard({ initialBoard, initialSlateProgress }: LiveScoreboardProps) {
  const [board, setBoard] = useState(initialBoard);
  const [slateProgress, setSlateProgress] = useState(initialSlateProgress);
  const pregame = isPregame(board);

  useEffect(() => {
    if (!board.hasActiveStarts && !pregame) return;
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
  }, [board.hasActiveStarts, initialBoard.date, pregame]);

  useEffect(() => {
    if (!pregame || !slateProgress.firstPitchAt) return;

    const updateCountdown = () => {
      setSlateProgress((current) => {
        if (!current.firstPitchAt) return current;
        const countdownLabel = formatFirstPitchCountdown(new Date(current.firstPitchAt).getTime() - Date.now());
        return countdownLabel === current.countdownLabel ? current : { ...current, countdownLabel };
      });
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 60 * 1000);
    return () => window.clearInterval(interval);
  }, [pregame, slateProgress.firstPitchAt]);

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
  const slateComplete = isSlateComplete(board);

  if (slateComplete) {
    return (
      <section className="space-y-4" data-live-board-date={board.date} data-live-starts={board.liveStarts} data-final-starts={board.finalStarts} data-live-board-complete="true">
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-white/10 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
          <p>{scoreboardSummaryLabel(board)}</p>
          <p>{updatedLabel}</p>
        </div>
        <SlateCompleteHandoff board={board} rows={scoredRows.slice(0, 3)} />
      </section>
    );
  }

  if (pregame) {
    return (
      <section className="space-y-4" data-live-board-date={board.date} data-live-starts={board.liveStarts} data-final-starts={board.finalStarts} data-live-board-pregame="true">
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-white/10 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
          <p>{scoreboardSummaryLabel(board)}</p>
          <p>{updatedLabel}</p>
        </div>
        <PregameHandoff board={board} slateProgress={slateProgress} />
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
        {scoredRows.length > 0 ? (
          <LiveScoreboardSection title="In progress" rows={scoredRows} />
        ) : null}
        {warmingRows.length > 0 ? (
          <LiveScoreboardSection title="Warming up" rows={warmingRows} muted={scoredRows.length > 0} />
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

function SlateCompleteHandoff({ board, rows }: { board: LiveScoreboardData; rows: LiveScoreboardRow[] }) {
  return (
    <div className="rounded border border-white/10 bg-[#101014] p-4 sm:p-6">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] lg:items-start">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#FF9A62]">Slate complete</p>
          <h2 className="mt-2 font-serif text-3xl font-black tracking-normal text-zinc-50 sm:text-4xl">This slate is final.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">Live returns with the next slate. Full tiers, filters, and breakdowns are ready on Ranked Starts.</p>
          <Link
            href={rankedStartsPath(board.date)}
            className="mt-5 inline-flex max-w-full items-center rounded border border-[#FF9A62]/50 bg-[#FF5A1F]/10 px-4 py-3 font-mono text-xs uppercase tracking-[0.14em] text-[#FFB07C] transition hover:border-[#FF9A62] hover:bg-[#FF5A1F]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            View all ranked starts for {formatBoardDate(board.date)} -&gt;
          </Link>
          <SlabImage />
        </div>
        <div className="overflow-hidden rounded border border-white/10 bg-[#0B0C0F]">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            <p>Top final GS+</p>
            <p>{rows.length} starters</p>
          </div>
          {rows.map((row, index) => (
            <article key={row.id} className="grid grid-cols-[2ch_29px_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 px-3 py-3 last:border-b-0 md:grid-cols-[2ch_59px_minmax(0,1fr)_auto]">
              <p className="font-mono text-xs text-zinc-500">{index + 1}</p>
              <Link href={row.pitcherHref} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" aria-label={`Open ${row.pitcherName} pitcher page`}>
                <Headshot playerId={row.pitcherMlbId} name={row.pitcherName} team={row.team} size="sm" decorative className="ml-0 md:h-[88px] md:w-[59px]" />
              </Link>
              <div className="min-w-0">
                <Link href={row.pitcherHref} className="block truncate font-serif text-xl font-bold leading-tight text-zinc-50 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
                  {row.pitcherName}
                </Link>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                  {row.team} vs {row.opponent}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-2xl font-black tabular-nums leading-none text-zinc-100">{formatScore(row.gsPlus)}</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{row.scoreLabel}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function PregameHandoff({ board, slateProgress }: { board: LiveScoreboardData; slateProgress: SlateProgressState }) {
  const countdown = formatPregameCountdown(slateProgress.countdownLabel);

  return (
    <div className="rounded border border-white/10 bg-[#101014] p-4 sm:p-6" data-live-pregame-first-pitch={slateProgress.firstPitchAt ?? ""}>
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#F6C445]">Scoreboard opens at first pitch</p>
      <h2 className="mt-2 max-w-3xl font-serif text-3xl font-black tracking-normal text-zinc-50 sm:text-4xl">
        FIRST STARTER TOES THE SLAB {countdown}
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
        First pitch {slateProgress.firstPitchAt ? formatFirstPitch(slateProgress.firstPitchAt) : "TBD"} · {board.totalStarts} starters on the slate.
      </p>
      <Link
        href={upcomingDateHref(board.date)}
        className="mt-5 inline-flex max-w-full items-center rounded border border-[#F6C445]/50 bg-[#F6C445]/10 px-4 py-3 font-mono text-xs uppercase tracking-[0.14em] text-[#F6C445] transition hover:border-[#F6C445] hover:bg-[#F6C445]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
      >
        Preview tonight&apos;s matchups on Upcoming -&gt;
      </Link>
      <SlabImage />
    </div>
  );
}

function SlabImage() {
  return (
    <div className="mt-8 overflow-hidden rounded border border-white/10 bg-black/30">
      <Image
        src="/images/slab-2.png"
        alt=""
        width={1280}
        height={853}
        className="h-auto w-full object-cover"
        priority={false}
      />
    </div>
  );
}

function LiveScoreboardSection({
  title,
  rows,
  muted = false,
}: {
  title: string;
  rows: LiveScoreboardRow[];
  muted?: boolean;
}) {
  return (
    <div className={muted ? "border-t border-white/10 bg-white/[0.025]" : ""}>
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 sm:px-4">
        <p>{title}</p>
        <p>{rows.length} starters</p>
      </div>
      {rows.map((row) => (
        <LiveScoreboardRow key={row.id} row={row} muted={muted} />
      ))}
    </div>
  );
}

function LiveScoreboardRow({ row, muted = false }: { row: LiveScoreboardRow; muted?: boolean }) {
  const statusTone = statusClass(row.status);
  const liveOrFinalScore = isScoredRow(row);

  return (
    <article className={`grid min-h-[88px] grid-cols-[35px_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 px-3 py-3 last:border-b-0 sm:grid-cols-[43px_minmax(0,1fr)_120px] sm:px-4 ${muted ? "opacity-75" : ""}`}>
      <Link href={row.pitcherHref} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" aria-label={`Open ${row.pitcherName} pitcher page`}>
        <Headshot playerId={row.pitcherMlbId} name={row.pitcherName} team={row.team} size="md" decorative className="ml-0" />
      </Link>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={row.status} />
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            {row.team} vs {row.opponent}
          </p>
        </div>
        <Link href={row.pitcherHref} className="pitcher-name mt-1 block break-words font-serif text-2xl font-bold leading-tight text-zinc-50 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 [overflow-wrap:anywhere]">
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
          {row.provisional ? <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">Prov.</p> : null}
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

function formatPregameCountdown(countdownLabel: string | null) {
  if (!countdownLabel) return "SOON";
  if (countdownLabel === "STARTING SOON") return "STARTING SOON";
  if (countdownLabel === "DELAYED") return "DELAYED";
  return `IN ${countdownLabel}`;
}

function isScoredRow(row: LiveScoreboardRow) {
  return row.scoreLabel !== "PROJ";
}

function isSlateComplete(board: LiveScoreboardData) {
  return board.hasGames && board.totalStarts > 0 && board.finalStarts === board.totalStarts;
}

function isPregame(board: LiveScoreboardData) {
  return board.hasGames && board.finalStarts === 0 && board.liveStarts === 0 && board.delayStarts === 0;
}

function formatBoardDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(parsed);
}

function formatUpdatedLabel(iso: string) {
  const updatedAt = new Date(iso).getTime();
  if (!Number.isFinite(updatedAt)) return "Updated just now";
  const seconds = Math.max(0, Math.round((Date.now() - updatedAt) / 1000));
  if (seconds < 5) return "Updated just now";
  if (seconds < 60) return `Updated ${seconds}s ago`;
  return `Updated ${Math.round(seconds / 60)}m ago`;
}
