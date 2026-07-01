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

const PREGAME_CLOCK_THRESHOLD_MS = 6 * 60 * 60 * 1000;
const PREGAME_STARTING_SOON_MS = 60 * 1000;
const PREGAME_CLOCK_WINDOW_MS = PREGAME_CLOCK_THRESHOLD_MS - PREGAME_STARTING_SOON_MS;

export function LiveScoreboard({ initialBoard, initialSlateProgress }: LiveScoreboardProps) {
  const [board, setBoard] = useState(initialBoard);
  const [slateProgress, setSlateProgress] = useState(initialSlateProgress);
  const [pregameNowMs, setPregameNowMs] = useState<number | null>(null);
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
    const firstPitchMs = new Date(slateProgress.firstPitchAt).getTime();
    if (!Number.isFinite(firstPitchMs)) return;

    let interval: number | null = null;

    const updateCountdown = () => {
      const nowMs = Date.now();
      setPregameNowMs(nowMs);
      setSlateProgress((current) => {
        if (!current.firstPitchAt) return current;
        const countdownLabel = formatFirstPitchCountdown(new Date(current.firstPitchAt).getTime() - nowMs);
        return countdownLabel === current.countdownLabel ? current : { ...current, countdownLabel };
      });
    };

    const clearCountdownInterval = () => {
      if (interval === null) return;
      window.clearInterval(interval);
      interval = null;
    };

    const startCountdownInterval = () => {
      clearCountdownInterval();
      if (document.visibilityState === "hidden") return;
      const remainingMs = firstPitchMs - Date.now();
      const clockMode = remainingMs > PREGAME_STARTING_SOON_MS && remainingMs <= PREGAME_CLOCK_THRESHOLD_MS;
      interval = window.setInterval(updateCountdown, clockMode ? 1000 : 60 * 1000);
    };

    const handleVisibilityChange = () => {
      updateCountdown();
      startCountdownInterval();
    };

    updateCountdown();
    startCountdownInterval();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearCountdownInterval();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
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
      <section className="space-y-4" data-live-board-date={board.date} data-live-starts={board.liveStarts} data-final-starts={board.finalStarts} data-scheduled-starts={board.scheduledStarts} data-live-board-complete="true">
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
      <section className="space-y-4" data-live-board-date={board.date} data-live-starts={board.liveStarts} data-final-starts={board.finalStarts} data-scheduled-starts={board.scheduledStarts} data-live-board-pregame="true">
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-white/10 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
          <p>{scoreboardSummaryLabel(board)}</p>
        </div>
        <PregameHandoff board={board} slateProgress={slateProgress} nowMs={pregameNowMs} />
      </section>
    );
  }

  return (
    <section className="space-y-3" data-live-board-date={board.date} data-live-starts={board.liveStarts} data-final-starts={board.finalStarts} data-scheduled-starts={board.scheduledStarts}>
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
  const optionalBuckets = [
    board.warmingStarts > 0 ? `${board.warmingStarts} warming` : null,
    board.scheduledStarts > 0 ? `${board.scheduledStarts} scheduled` : null,
  ].filter((bucket): bucket is string => Boolean(bucket));

  return (
    <>
      <span className={board.liveStarts > 0 ? "text-[#FF9A62]" : undefined}>{board.liveStarts} live</span>
      <span> · {board.finalStarts} final</span>
      {optionalBuckets.map((bucket) => (
        <span key={bucket}> · {bucket}</span>
      ))}
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

function PregameHandoff({ board, slateProgress, nowMs }: { board: LiveScoreboardData; slateProgress: SlateProgressState; nowMs: number | null }) {
  const countdown = getPregameCountdownView(slateProgress.firstPitchAt, slateProgress.countdownLabel, nowMs);

  return (
    <div className="overflow-hidden rounded border border-white/10 bg-[#101014]" data-live-pregame-first-pitch={slateProgress.firstPitchAt ?? ""}>
      <div className="relative isolate overflow-hidden">
        <Image
          src="/images/slab-2.png"
          alt=""
          fill
          sizes="(min-width: 1024px) 1120px, 100vw"
          className="absolute inset-0 -z-20 h-full w-full object-cover"
          priority={false}
        />

        <div className="relative flex flex-col items-start justify-start px-4 pb-5 pt-3 sm:px-6 sm:pb-6 sm:pt-4 lg:px-8 lg:pt-5">
          <div className="w-full max-w-4xl text-left">
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#F6C445] sm:text-xs">
              <span className="h-2 w-2 rounded-full bg-[#FF5A1F] shadow-[0_0_18px_rgba(255,90,31,0.8)] motion-safe:animate-pulse" />
              Scoreboard opens at first pitch
            </p>
            <div className="mt-5" data-live-pregame-countdown-mode={countdown.mode}>
              {countdown.mode === "clock" ? (
                <div className="grid max-w-[720px] grid-cols-3 gap-2 sm:gap-3" aria-label={countdown.ariaLabel}>
                  <ClockUnit value={countdown.hours} label="HRS" toneClass={countdown.toneClass} />
                  <ClockUnit value={countdown.minutes} label="MIN" toneClass={countdown.toneClass} />
                  <ClockUnit value={countdown.seconds} label="SEC" toneClass={countdown.toneClass} />
                </div>
              ) : (
                <h2 className={`font-serif text-5xl font-black leading-none tracking-normal sm:text-7xl ${countdown.toneClass}`}>{countdown.label}</h2>
              )}
            </div>
            <div className="mt-5 h-1.5 max-w-[720px] overflow-hidden rounded-full bg-white/15" aria-hidden="true">
              <div className="h-full rounded-full bg-[#FF5A1F] shadow-[0_0_24px_rgba(255,90,31,0.45)] motion-safe:transition-[width,background-color] motion-safe:duration-500" style={{ width: `${countdown.progressPct}%` }} />
            </div>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-white sm:text-xs">
              First pitch {slateProgress.firstPitchAt ? formatFirstPitch(slateProgress.firstPitchAt) : "TBD"} · {board.totalStarts} starters
            </p>
            <Link
              href={upcomingDateHref(board.date)}
              className="mt-5 inline-flex max-w-full items-center rounded border border-[#F6C445]/50 bg-black/35 px-4 py-3 font-mono text-xs uppercase tracking-[0.14em] text-[#F6C445] transition hover:border-[#F6C445] hover:bg-[#F6C445]/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              Preview matchups -&gt;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClockUnit({ value, label, toneClass }: { value: string; label: string; toneClass: string }) {
  return (
    <div className="min-w-0 rounded border border-white/10 bg-black/35 px-2 py-3 text-center shadow-[inset_0_0_30px_rgba(0,0,0,0.3)] sm:px-4 sm:py-4">
      <p className={`font-mono text-5xl font-black leading-none tracking-normal tabular-nums motion-safe:transition-colors motion-safe:duration-200 sm:text-7xl lg:text-8xl ${toneClass}`}>{value}</p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400 sm:text-xs">{label}</p>
    </div>
  );
}

function SlabImage() {
  return (
    <div className="mt-8 max-w-[900px] overflow-hidden rounded border border-white/10 bg-black/30">
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

  const label = status === "delay" ? "Delay" : status === "final" ? "Final" : status === "scheduled" ? "Scheduled" : "Warming";
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

function getPregameCountdownView(firstPitchAt: string | null, countdownLabel: string | null, nowMs: number | null) {
  const fallbackLabel = firstPitchAt ? formatPregameCountdown(countdownLabel) : "TBD";

  if (!firstPitchAt || nowMs === null) {
    return {
      mode: "static" as const,
      label: fallbackLabel,
      ariaLabel: fallbackLabel,
      hours: "00",
      minutes: "00",
      seconds: "00",
      progressPct: 0,
      toneClass: "text-[#F6C445]",
    };
  }

  if (countdownLabel === "DELAYED") {
    return {
      mode: "status" as const,
      label: "DELAYED",
      ariaLabel: "Delayed",
      hours: "00",
      minutes: "00",
      seconds: "00",
      progressPct: 100,
      toneClass: "text-[#FF9A62]",
    };
  }

  const firstPitchMs = new Date(firstPitchAt).getTime();
  if (!Number.isFinite(firstPitchMs)) {
    return {
      mode: "status" as const,
      label: "TBD",
      ariaLabel: "First pitch to be determined",
      hours: "00",
      minutes: "00",
      seconds: "00",
      progressPct: 0,
      toneClass: "text-[#F6C445]",
    };
  }

  const remainingMs = firstPitchMs - nowMs;
  if (remainingMs <= PREGAME_STARTING_SOON_MS) {
    return {
      mode: "status" as const,
      label: "STARTING SOON",
      ariaLabel: "Starting soon",
      hours: "00",
      minutes: "00",
      seconds: "00",
      progressPct: 100,
      toneClass: "text-[#FF9A62]",
    };
  }

  if (remainingMs > PREGAME_CLOCK_THRESHOLD_MS) {
    const label = formatPregameCountdown(formatFirstPitchCountdown(remainingMs));
    return {
      mode: "static" as const,
      label,
      ariaLabel: label,
      hours: "00",
      minutes: "00",
      seconds: "00",
      progressPct: 0,
      toneClass: "text-[#F6C445]",
    };
  }

  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const progressPct = clamp(((PREGAME_CLOCK_THRESHOLD_MS - remainingMs) / PREGAME_CLOCK_WINDOW_MS) * 100, 0, 100);
  const toneClass = progressPct > 72 ? "text-[#FF9A62]" : "text-[#F6C445]";

  return {
    mode: "clock" as const,
    label: `${padClockUnit(hours)}:${padClockUnit(minutes)}:${padClockUnit(seconds)}`,
    ariaLabel: `${hours} hours, ${minutes} minutes, ${seconds} seconds until first pitch`,
    hours: padClockUnit(hours),
    minutes: padClockUnit(minutes),
    seconds: padClockUnit(seconds),
    progressPct,
    toneClass,
  };
}

function padClockUnit(value: number) {
  return String(value).padStart(2, "0");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
