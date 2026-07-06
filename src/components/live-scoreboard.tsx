"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CtaArrow } from "@/components/cta-arrow";
import { Headshot } from "@/components/headshot";
import { LIVE_NAV_STATE_EVENT } from "@/components/live-nav-label";
import type { LivePregameSlate, LiveScoreboard as LiveScoreboardData, LiveScoreboardRow } from "@/lib/data/live-scoreboard-service";
import { evaluateLiveGemAlerts, type LiveGemAlertEvent } from "@/lib/live-gem-alerts";
import { qualityTierOf, watchTierOf } from "@/lib/form-tokens";
import { formatStartLine } from "@/lib/format";
import { pitcherHref, rankedStartsPath, sourceParams, upcomingDateHref } from "@/lib/routes";
import { formatGameScorePlus, formatWatchScore } from "@/lib/score-display";
import { formatFirstPitchCountdown, type SlateProgressState } from "@/lib/slate-state";
import type { TonightGame, TonightStarter } from "@/lib/types";
import { watchScoreConfidenceLabel } from "@/lib/watch-score-confidence";

type LiveScoreboardProps = {
  initialBoard: LiveScoreboardData;
  initialSlateProgress: SlateProgressState;
};

const PREGAME_CLOCK_THRESHOLD_MS = 6 * 60 * 60 * 1000;
const PREGAME_STARTING_SOON_MS = 60 * 1000;
const PREGAME_CLOCK_WINDOW_MS = PREGAME_CLOCK_THRESHOLD_MS - PREGAME_STARTING_SOON_MS;
const LIVE_GEM_ALERT_STORAGE_PREFIX = "tts-live-gem-alerts:";
const LIVE_GEM_ALERT_MAX_VISIBLE = 3;

export function LiveScoreboard({ initialBoard, initialSlateProgress }: LiveScoreboardProps) {
  const [board, setBoard] = useState(initialBoard);
  const [slateProgress, setSlateProgress] = useState(initialSlateProgress);
  const [pregameNowMs, setPregameNowMs] = useState<number | null>(null);
  const [liveGemAlerts, setLiveGemAlerts] = useState<LiveGemAlertEvent[]>([]);
  const latestRowsRef = useRef(initialBoard.rows);
  const seenLiveGemAlertKeysRef = useRef<Set<string>>(new Set());
  const pregame = isPregame(board);
  const pregameFirstPitchAt = board.pregameSlate?.firstPitchAt ?? slateProgress.firstPitchAt;

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(LIVE_NAV_STATE_EVENT, { detail: { liveStarts: board.liveStarts, warmingStarts: board.warmingStarts } }));
  }, [board.liveStarts, board.warmingStarts]);

  useEffect(() => {
    seenLiveGemAlertKeysRef.current = loadSeenLiveGemAlertKeys(initialBoard.date);
  }, [initialBoard.date]);

  useEffect(() => {
    if (!board.hasActiveStarts && !pregame) return;
    let cancelled = false;

    const refresh = async () => {
      try {
        const response = await fetch(`/api/live/${encodeURIComponent(initialBoard.date)}`, { cache: "no-store" });
        if (!response.ok) return;
        const nextBoard = (await response.json()) as LiveScoreboardData;
        if (!cancelled) {
          const newAlerts = takeUnseenLiveGemAlerts(evaluateLiveGemAlerts(nextBoard.rows, latestRowsRef.current), initialBoard.date, seenLiveGemAlertKeysRef.current);
          latestRowsRef.current = nextBoard.rows;
          if (newAlerts.length > 0) {
            setLiveGemAlerts((current) => [...newAlerts, ...current].slice(0, LIVE_GEM_ALERT_MAX_VISIBLE));
          }
          setBoard(nextBoard);
          setSlateProgress(nextBoard.slateProgress);
        }
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
    if (!pregame || !pregameFirstPitchAt) return;
    const firstPitchMs = new Date(pregameFirstPitchAt).getTime();
    if (!Number.isFinite(firstPitchMs)) return;

    let interval: number | null = null;

    const updateCountdown = () => {
      const nowMs = Date.now();
      setPregameNowMs(nowMs);
      setSlateProgress((current) => {
        const countdownLabel = formatFirstPitchCountdown(firstPitchMs - nowMs);
        return countdownLabel === current.countdownLabel && current.firstPitchAt === pregameFirstPitchAt
          ? current
          : { ...current, firstPitchAt: pregameFirstPitchAt, countdownLabel };
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
  }, [pregame, pregameFirstPitchAt]);

  const updatedLabel = useMemo(() => formatUpdatedLabel(board.generatedAt), [board.generatedAt]);

  if (!board.hasGames && !board.pregameSlate) {
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
          <p suppressHydrationWarning>{updatedLabel}</p>
        </div>
        <SlateCompleteHandoff board={board} rows={scoredRows} />
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
        <p suppressHydrationWarning>{updatedLabel}</p>
      </div>

      <LiveGemAlertStack alerts={liveGemAlerts} onDismiss={(id) => setLiveGemAlerts((current) => current.filter((alert) => alert.id !== id))} />

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

export function LiveScoreboardLoading({ board }: { board: LiveScoreboardData }) {
  const pregame = isPregame(board);
  const slateComplete = isSlateComplete(board);

  if (!board.hasGames) {
    return (
      <section className="rounded border border-white/10 bg-[#101014] p-6 text-zinc-300" data-live-loading-mode="empty">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">No games today.</p>
      </section>
    );
  }

  if (slateComplete) {
    return (
      <section className="space-y-4" data-live-loading-mode="final" data-live-loading-count={board.totalStarts}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-white/10 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
          <p>{board.liveStarts} live · {board.finalStarts} final</p>
          <span className="route-shell-shimmer h-3 w-24 rounded" />
        </div>
        <SlateCompleteHandoffLoading board={board} />
      </section>
    );
  }

  if (pregame) {
    return (
      <section className="space-y-4" data-live-loading-mode="pregame" data-live-loading-count={board.totalStarts}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-white/10 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
          <p>{scoreboardSummaryLabel(board)}</p>
        </div>
        <PregameHandoffLoading board={board} />
      </section>
    );
  }

  const scoredRows = board.rows.filter(isScoredRow);
  const warmingRows = board.rows.filter((row) => !isScoredRow(row));

  return (
    <section className="space-y-3" data-live-loading-mode="scoreboard" data-live-loading-count={board.totalStarts}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-white/10 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
        <p>{scoreboardSummaryLabel(board)}</p>
        <span className="route-shell-shimmer h-3 w-24 rounded" />
      </div>
      <div className="overflow-hidden rounded border border-white/10 bg-[#0B0C0F]">
        {scoredRows.length > 0 ? (
          <div>
            <LiveSectionHeader title="In progress" count={scoredRows.length} />
            {scoredRows.map((row, index) => <LiveScoreboardRowLoading key={row.id} row={row} scored index={index} />)}
          </div>
        ) : null}
        {warmingRows.length > 0 ? (
          <div className={scoredRows.length > 0 ? "border-t border-white/10 bg-white/[0.025]" : ""}>
            <LiveSectionHeader title="Warming up" count={warmingRows.length} />
            {warmingRows.map((row, index) => <LiveScoreboardRowLoading key={row.id} row={row} muted={scoredRows.length > 0} index={index} />)}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function LiveGemAlertStack({ alerts, onDismiss }: { alerts: LiveGemAlertEvent[]; onDismiss: (id: string) => void }) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2" data-live-gem-alerts="true" role="status" aria-live="polite">
      {alerts.map((alert) => (
        <article key={alert.id} className="flex items-start justify-between gap-3 rounded border border-[#FF5A1F]/35 bg-[#FF5A1F]/10 px-3 py-3 text-sm text-zinc-100 shadow-[0_0_24px_rgba(255,90,31,0.12)]">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#FF9A62]">Live gem alert</p>
            <Link href={alert.href} className="mt-1 block text-pretty font-serif text-lg font-bold leading-tight text-zinc-50 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
              {alert.message}
            </Link>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
              {alert.team} vs {alert.opponent}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded border border-white/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition hover:border-white/30 hover:text-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            onClick={() => onDismiss(alert.id)}
            aria-label={`Dismiss live gem alert for ${alert.pitcherName}`}
          >
            Close
          </button>
        </article>
      ))}
    </div>
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
  const nextSlateLine = formatNextSlateLine(board);
  const verdictLine = formatSlateCompleteVerdict(board, rows);
  const topRows = rows.slice(0, 5);
  const slateAverage = average(rows.map((row) => row.gsPlus).filter((score): score is number => score !== null));
  const signals = buildSlateSignals(rows, board.date);

  return (
    <div className="space-y-6" data-live-final-recap="true">
      <section className="rounded border border-white/10 bg-[#101014] p-4 sm:p-6" data-live-final-header="true">
        <p className="max-w-3xl text-sm leading-6 text-zinc-300">{verdictLine}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
          <span>{board.finalStarts} final</span>
          <span suppressHydrationWarning>{formatUpdatedLabel(board.generatedAt)}</span>
          {nextSlateLine ? <span data-live-next-slate>{nextSlateLine}</span> : null}
        </div>
      </section>

      <section className="rounded border border-white/10 bg-[#101014] p-4 sm:p-6" data-live-final-day="true">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#FF9A62]">The day</p>
            <h2 className="mt-1 font-serif text-3xl font-bold text-zinc-50">Recap at a glance</h2>
          </div>
          <CtaArrow
            href={rankedStartsPath(board.date)}
            hideTailOnMobile
            className="bg-[#FF5A1F]/10 hover:bg-[#FF5A1F]/20"
          >
            View all<br className="sm:hidden" /> ranked starts for {formatBoardDate(board.date)}
          </CtaArrow>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-stretch">
          <TopFinalList rows={topRows} total={rows.length} />
          <LiveSlateScatter rows={rows} slateAverage={slateAverage} />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-live-final-signals="true">
        {signals.map((signal) => (
          <Link key={signal.label} href={signal.href} className="min-h-[112px] rounded border border-white/10 bg-[#101014] p-4 transition hover:border-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{signal.label}</p>
            <p className="mt-2 font-serif text-2xl font-bold leading-tight text-zinc-50">{signal.value}</p>
            <p className="mt-2 text-xs leading-5 text-zinc-500">{signal.detail}</p>
          </Link>
        ))}
      </section>

      <TomorrowBridge board={board} />
    </div>
  );
}

function SlateCompleteHandoffLoading({ board }: { board: LiveScoreboardData }) {
  const topRowCount = Math.min(5, Math.max(1, board.rows.length));

  return (
    <div className="space-y-6" data-live-final-recap="true" data-loading-mode="true">
      <section className="rounded border border-white/10 bg-[#101014] p-4 sm:p-6" data-live-final-header="true">
        <span className="route-shell-shimmer block h-5 max-w-xl rounded" />
        <span className="route-shell-shimmer mt-3 block h-4 max-w-2xl rounded" />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="route-shell-shimmer h-3 w-16 rounded" />
          <span className="route-shell-shimmer h-3 w-28 rounded" />
          <span className="route-shell-shimmer h-3 w-48 rounded" />
        </div>
      </section>

      <section className="rounded border border-white/10 bg-[#101014] p-4 sm:p-6" data-live-final-day="true">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#FF9A62]">The day</p>
            <span className="route-shell-shimmer mt-2 block h-9 w-64 rounded" />
          </div>
          <span className="route-shell-shimmer h-11 w-56 rounded" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-stretch">
          <div className="overflow-hidden rounded border border-white/10 bg-[#0B0C0F]" data-live-final-top-five="true">
            <LiveSectionHeader title="Top final GS+" count={board.totalStarts} />
            {Array.from({ length: topRowCount }).map((_, index) => (
              <article key={index} className="grid grid-cols-[2ch_29px_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 px-3 py-3 last:border-b-0 md:grid-cols-[2ch_54px_minmax(0,1fr)_auto]">
                <span className="route-shell-shimmer h-4 w-4 rounded" />
                <span className="route-shell-shimmer h-[36px] w-[29px] rounded md:h-[72px] md:w-[54px]" />
                <div className="min-w-0 space-y-2">
                  <span className="route-shell-shimmer block h-6 w-3/4 rounded" />
                  <span className="route-shell-shimmer block h-3 w-full rounded" />
                </div>
                <span className="route-shell-shimmer h-12 w-14 rounded" />
              </article>
            ))}
          </div>
          <div className="min-h-[320px] rounded border border-white/10 bg-[#0B0C0F] p-3" data-live-final-scatter="true">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="route-shell-shimmer h-3 w-24 rounded" />
              <span className="route-shell-shimmer h-3 w-24 rounded" />
            </div>
            <span className="route-shell-shimmer block h-[300px] w-full rounded sm:h-[360px]" />
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-live-final-signals="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="min-h-[112px] rounded border border-white/10 bg-[#101014] p-4">
            <span className="route-shell-shimmer block h-3 w-24 rounded" />
            <span className="route-shell-shimmer mt-3 block h-8 w-2/3 rounded" />
            <span className="route-shell-shimmer mt-3 block h-3 w-full rounded" />
          </div>
        ))}
      </section>

      <section className="rounded border border-white/10 bg-[#101014] p-4 sm:p-6" data-live-final-tomorrow="true">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#F6C445]">Tomorrow</p>
            <span className="route-shell-shimmer mt-2 block h-9 w-72 max-w-full rounded" />
            <span className="route-shell-shimmer mt-3 block h-4 w-96 max-w-full rounded" />
          </div>
          <span className="route-shell-shimmer h-[118px] rounded md:min-w-[320px]" />
        </div>
      </section>
    </div>
  );
}

function TopFinalList({ rows, total }: { rows: LiveScoreboardRow[]; total: number }) {
  return (
    <div className="overflow-hidden rounded border border-white/10 bg-[#0B0C0F]" data-live-final-top-five="true">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
        <p>Top final GS+</p>
        <p>{total} starters</p>
      </div>
      {rows.map((row, index) => {
        const tier = row.gsPlus === null ? null : qualityTierOf(row.gsPlus);
        return (
          <article key={row.id} className="grid grid-cols-[2ch_29px_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 px-3 py-3 last:border-b-0 md:grid-cols-[2ch_54px_minmax(0,1fr)_auto]">
            <p className="font-mono text-xs text-zinc-500">{index + 1}</p>
            <Link href={row.startHref} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" aria-label={`Open ${row.pitcherName} start detail`}>
              <Headshot playerId={row.pitcherMlbId} name={row.pitcherName} team={row.team} size="sm" decorative className="ml-0 md:h-[72px] md:w-[54px]" />
            </Link>
            <div className="min-w-0">
              <Link href={row.startHref} className="block truncate font-serif text-xl font-bold leading-tight text-zinc-50 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
                {row.pitcherName}
              </Link>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                {row.team} {row.side === "home" ? "vs" : "@"} {row.opponent} · {lineText(row)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-2xl font-black tabular-nums leading-none" style={{ color: tier?.color ?? "#f4f4f5" }}>{formatScore(row.gsPlus)}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{tier?.label ?? row.scoreLabel}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function LiveSlateScatter({ rows, slateAverage }: { rows: LiveScoreboardRow[]; slateAverage: number }) {
  const width = 760;
  const height = 390;
  const pad = { left: 44, right: 26, top: 30, bottom: 36 };
  const points = rows
    .filter((row): row is LiveScoreboardRow & { gsPlus: number } => row.gsPlus !== null)
    .map((row, index) => {
      const score = clamp(row.gsPlus, 20, 80);
      const x = pad.left + ((index + 0.5) / Math.max(1, rows.length)) * (width - pad.left - pad.right);
      const y = pad.top + ((80 - score) / 60) * (height - pad.top - pad.bottom);
      return { row, x, y };
    });
  const yFor = (score: number) => pad.top + ((80 - score) / 60) * (height - pad.top - pad.bottom);
  const ticks = [20, 35, 50, 65, 80];
  const averageY = yFor(clamp(slateAverage, 20, 80));

  return (
    <div className="min-h-[320px] rounded border border-white/10 bg-[#0B0C0F] p-3" data-live-final-scatter="true" data-scatter-points={points.length}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Slate shape</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">SLATE AVG {slateAverage.toFixed(1)}</p>
      </div>
      <svg className="h-[300px] w-full sm:h-[360px]" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${points.length} final ranked starts plotted by start sequence and GS+`}>
        <rect x={pad.left} y={pad.top} width={width - pad.left - pad.right} height={height - pad.top - pad.bottom} fill="#08080a" opacity="0.7" />
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={yFor(tick)} y2={yFor(tick)} stroke="#27272a" />
            <text x={pad.left - 10} y={yFor(tick) + 4} textAnchor="end" fill="#71717a" fontSize="11">{tick}</text>
          </g>
        ))}
        <line x1={pad.left} x2={width - pad.right} y1={averageY} y2={averageY} stroke="#a1a1aa" strokeDasharray="5 5" />
        <text x={width - pad.right - 104} y={averageY - 8} fill="#a1a1aa" fontSize="12">SLATE AVG {slateAverage.toFixed(1)}</text>
        <text x={pad.left + 10} y={yFor(50) - 8} fill="#a1a1aa" fontSize="12">LEAGUE AVG 50.0</text>
        <text x={(pad.left + width - pad.right) / 2} y={height - 5} textAnchor="middle" fill="#71717a" fontSize="11" fontFamily="monospace">START SEQUENCE</text>
        <text x="14" y={(pad.top + height - pad.bottom) / 2} textAnchor="middle" fill="#71717a" fontSize="11" fontFamily="monospace" transform={`rotate(-90 14 ${(pad.top + height - pad.bottom) / 2})`}>GS+</text>
        {points.map(({ row, x, y }, index) => {
          const tier = qualityTierOf(row.gsPlus);
          return (
            <a key={row.id} href={row.startHref} aria-label={`${row.pitcherName}, GS+ ${row.gsPlus}, ${lineText(row)}`}>
              <circle cx={x} cy={y} r="15" fill="transparent" />
              <circle cx={x} cy={y} r={index === 0 ? 8.8 : 7.4} fill={index === 0 ? "#facc15" : tier.color} stroke="#08080a" strokeWidth="2">
                <title>{`${row.pitcherName} / ${lineText(row)} / GS+ ${row.gsPlus}`}</title>
              </circle>
            </a>
          );
        })}
      </svg>
    </div>
  );
}

function TomorrowBridge({ board }: { board: LiveScoreboardData }) {
  const game = board.nextSlateTopGame;
  if (!game || !board.nextSlateDate) return null;
  const tier = watchTierOf(game.gameWatchScore);
  const firstPitch = formatFirstPitch(game.firstPitch);
  const starters = game.starters.filter((starter) => starter.name).map((starter) => starter.name).join(" vs ") || "Probables updating";

  return (
    <section className="rounded border border-white/10 bg-[#101014] p-4 sm:p-6" data-live-final-tomorrow="true" data-first-pitch={game.firstPitch}>
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#F6C445]">Tomorrow</p>
          <h2 className="mt-1 font-serif text-3xl font-bold text-zinc-50">Top watch-score matchup</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">{game.label} · {starters}</p>
        </div>
        <Link href={upcomingDateHref(board.nextSlateDate)} className="grid gap-3 rounded border border-white/10 bg-black/20 p-4 transition hover:border-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 md:min-w-[320px]">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Watch score</span>
            <span className="rounded border border-[#F6C445]/30 bg-[#F6C445]/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#F6C445]">{firstPitch}</span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate font-serif text-2xl font-bold text-zinc-50">{game.label}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">View tomorrow&apos;s matchups</p>
            </div>
            <p className="font-mono text-5xl font-black leading-none" style={{ color: tier.color }}>{game.gameWatchScore.toFixed(1)}</p>
          </div>
        </Link>
      </div>
    </section>
  );
}

function buildSlateSignals(rows: LiveScoreboardRow[], date: string) {
  const scored = rows.filter((row): row is LiveScoreboardRow & { gsPlus: number } => row.gsPlus !== null);
  const gems = scored.filter((row) => row.gsPlus >= 70);
  const rough = scored.filter((row) => row.gsPlus <= 25);
  const projected = scored
    .filter((row) => typeof row.projectedGsPlus === "number")
    .map((row) => ({ row, delta: row.gsPlus - (row.projectedGsPlus ?? row.gsPlus) }))
    .sort((a, b) => b.delta - a.delta);
  const beat = projected[0] ?? null;
  const miss = projected.at(-1) ?? null;
  const fallbackGem = scored[1] ?? scored[0] ?? null;
  const fallbackRough = [...scored].reverse()[1] ?? scored.at(-1) ?? null;

  return [
    {
      label: "Gems",
      value: String(gems.length),
      detail: "Starts at GS+ 70 plus",
      href: rankedStartsPath(date),
    },
    {
      label: "Rough days",
      value: String(rough.length),
      detail: "Starts at GS+ 25 or lower",
      href: rankedStartsPath(date),
    },
    {
      label: "Beat of the day",
      value: beat ? `${lastName(beat.row.pitcherName)} +${beat.delta.toFixed(1)} over proj` : fallbackGem ? `${lastName(fallbackGem.pitcherName)} ${formatScore(fallbackGem.gsPlus)}` : "No scored starts",
      detail: beat ? "Largest settled edge over projection" : "Fallback: second-best gem",
      href: beat?.row.startHref ?? fallbackGem?.startHref ?? rankedStartsPath(date),
    },
    {
      label: "Miss of the day",
      value: miss ? `${lastName(miss.row.pitcherName)} ${miss.delta.toFixed(1)} under proj` : fallbackRough ? `${lastName(fallbackRough.pitcherName)} ${formatScore(fallbackRough.gsPlus)}` : "No scored starts",
      detail: miss ? "Largest settled miss against projection" : "Fallback: second-roughest start",
      href: miss?.row.startHref ?? fallbackRough?.startHref ?? rankedStartsPath(date),
    },
  ];
}

function formatSlateCompleteVerdict(board: LiveScoreboardData, rows: LiveScoreboardRow[]) {
  const eligibleRows = rows.filter((row) => row.gsPlus !== null && row.gsPlus >= 50);
  const leader = eligibleRows[0];
  if (!leader?.gsPlus) return `All ${board.totalStarts} starts are in.`;

  const tiedLeaders = eligibleRows.filter((row) => row.gsPlus === leader.gsPlus);
  if (tiedLeaders.length === 2) {
    return `All ${board.totalStarts} starts are in. ${lastName(tiedLeaders[0].pitcherName)} and ${lastName(tiedLeaders[1].pitcherName)} split the day at ${leader.gsPlus}.`;
  }
  if (tiedLeaders.length > 2) return `All ${board.totalStarts} starts are in.`;

  return `All ${board.totalStarts} starts are in. ${possessiveLastName(leader.pitcherName)} ${leader.gsPlus} took the day.`;
}

function PregameHandoff({ board, slateProgress, nowMs }: { board: LiveScoreboardData; slateProgress: SlateProgressState; nowMs: number | null }) {
  const pregameSlate = board.pregameSlate;
  const firstPitchAt = pregameSlate?.firstPitchAt ?? slateProgress.firstPitchAt;
  const countdown = getPregameCountdownView(firstPitchAt, slateProgress.countdownLabel, nowMs);
  const marqueeGame = pregameSlate?.marqueeGame ?? null;
  const slateDate = pregameSlate?.date ?? board.date;
  const previewHref = pregameSlate?.upcomingHref ?? upcomingDateHref(board.date);

  return (
    <div className="space-y-4" data-live-pregame-first-pitch={firstPitchAt ?? ""} data-live-pregame-slate-date={slateDate}>
      <section className="overflow-hidden rounded border border-white/10 bg-[#101014]" data-live-pregame-countdown="true">
        <div className="relative isolate overflow-hidden">
        <Image
          src="/images/slab-2.png"
          alt=""
          fill
          sizes="(min-width: 1024px) 1120px, 100vw"
          className="live-slab-background-image absolute inset-0 -z-20 h-full w-full object-cover opacity-55"
          priority={false}
        />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black via-black/80 to-black/55" aria-hidden="true" />

          <div className="relative flex flex-col items-start justify-start px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5 lg:px-8">
          <div className="w-full max-w-4xl text-left">
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#F6C445] sm:text-xs">
              <span className="h-2 w-2 rounded-full bg-[#FF5A1F] shadow-[0_0_18px_rgba(255,90,31,0.8)] motion-safe:animate-pulse" />
              Scoreboard opens at first pitch
            </p>
            <div className="mt-5" style={{ marginTop: "2rem" }} data-live-pregame-countdown-mode={countdown.mode}>
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
              {formatPregameFirstPitchLine(board.date, slateDate, firstPitchAt)} · {board.totalStarts || pregameSlate?.starterCount || 0} starters
            </p>
          </div>
        </div>
      </div>
      </section>

      {marqueeGame && pregameSlate ? (
        <PregameMarquee slate={pregameSlate} game={marqueeGame} />
      ) : null}

      {pregameSlate?.nextUpGames.length ? <PregameNextUpRows slate={pregameSlate} /> : null}

      <CtaArrow
        href={previewHref}
        tone="amber"
        className="bg-[#F6C445]/10 hover:bg-[#F6C445]/20"
      >
        Preview all matchups
      </CtaArrow>
    </div>
  );
}

function PregameHandoffLoading({ board }: { board: LiveScoreboardData }) {
  return (
    <div className="space-y-4" data-live-pregame-first-pitch={board.pregameSlate?.firstPitchAt ?? board.slateProgress.firstPitchAt ?? ""} data-loading-mode="true">
      <section className="overflow-hidden rounded border border-white/10 bg-[#101014]" data-live-pregame-countdown="true">
      <div className="relative isolate overflow-hidden">
        <Image
          src="/images/slab-2.png"
          alt=""
          fill
          sizes="(min-width: 1024px) 1120px, 100vw"
          className="live-slab-background-image absolute inset-0 -z-20 h-full w-full object-cover opacity-55"
          priority={false}
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black via-black/80 to-black/55" aria-hidden="true" />

        <div className="relative flex flex-col items-start justify-start px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5 lg:px-8">
          <div className="w-full max-w-4xl text-left">
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#F6C445] sm:text-xs">
              <span className="h-2 w-2 rounded-full bg-[#FF5A1F] shadow-[0_0_18px_rgba(255,90,31,0.8)] motion-safe:animate-pulse" />
              Scoreboard opens at first pitch
            </p>
            <div className="mt-5 grid max-w-[720px] grid-cols-3 gap-2 sm:gap-3" style={{ marginTop: "2rem" }} data-live-pregame-countdown-mode="loading">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="min-w-0 rounded border border-white/10 bg-black/35 px-2 py-3 text-center shadow-[inset_0_0_30px_rgba(0,0,0,0.3)] sm:px-4 sm:py-4">
                  <span className="route-shell-shimmer mx-auto block h-[3.75rem] w-20 rounded sm:h-[5.25rem] lg:h-[6rem]" />
                  <span className="route-shell-shimmer mx-auto mt-2 block h-3 w-10 rounded" />
                </div>
              ))}
            </div>
            <div className="mt-5 h-1.5 max-w-[720px] overflow-hidden rounded-full bg-white/15" aria-hidden="true">
              <span className="route-shell-shimmer block h-full w-1/3 rounded-full" />
            </div>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-white sm:text-xs">
              First pitch {board.slateProgress.firstPitchAt ? formatFirstPitch(board.slateProgress.firstPitchAt) : "TBD"} · {board.totalStarts} starters
            </p>
          </div>
        </div>
      </div>
      </section>
      <section className="rounded border border-white/10 bg-[#101014] p-4 sm:p-5" data-live-pregame-marquee="loading">
        <span className="route-shell-shimmer block h-3 w-24 rounded" />
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.72fr)_minmax(0,1fr)]">
          <span className="route-shell-shimmer h-40 rounded" />
          <span className="route-shell-shimmer h-40 rounded" />
          <span className="route-shell-shimmer h-40 rounded" />
        </div>
      </section>
      <span className="route-shell-shimmer block h-11 w-56 rounded" />
    </div>
  );
}

function PregameMarquee({ slate, game }: { slate: LivePregameSlate; game: TonightGame }) {
  const [awayStarter, homeStarter] = game.starters;
  const tier = watchTierOf(game.gameWatchScore);
  const gameHref = `${slate.upcomingHref}#upcoming-game-${game.gamePk}`;

  return (
    <section
      className="rounded border border-amber-300/25 bg-[#101014] p-4 sm:p-5"
      data-live-pregame-marquee="true"
      data-live-pregame-header={slate.headerLabel}
      data-game-pk={game.gamePk}
      data-first-pitch={game.firstPitch}
      data-watch-score={formatWatchScore(game.gameWatchScore)}
      data-watch-score-confidence={game.watchScoreConfidence}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#F6C445]">{slate.headerLabel}</p>
          <h2 className="mt-1 font-serif text-2xl font-black text-zinc-50 sm:text-3xl">{game.label}</h2>
        </div>
        <Link href={gameHref} className="rounded border border-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-300 transition hover:border-amber-300/40 hover:text-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
          Upcoming card
        </Link>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.72fr)_minmax(0,1fr)] lg:items-stretch">
        <PregameStarterBlock starter={awayStarter} align="away" />
        <div className="flex min-h-full flex-col justify-center rounded border border-amber-300/25 bg-black/35 p-4 text-center shadow-[inset_0_0_42px_rgba(251,191,36,0.08)]" data-responsive-check="live-pregame-hook">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-200">{formatFirstPitch(game.firstPitch)}</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">{game.park}</p>
          <div className="mt-3 flex flex-wrap items-end justify-center gap-2">
            <p className="font-serif text-5xl font-black leading-none" style={{ color: tier.color }}>{formatWatchScore(game.gameWatchScore)}</p>
            <PregameConfidenceChip game={game} />
          </div>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-zinc-400">Watch score</p>
        </div>
        <PregameStarterBlock starter={homeStarter} align="home" />
      </div>
    </section>
  );
}

function PregameStarterBlock({ starter, align }: { starter: TonightStarter; align: "away" | "home" }) {
  const name = starter.name ?? "TBD";
  const href = starter.pitcherId ? pitcherHref({ pitcherId: starter.pitcherId, name: starter.name }, sourceParams("live")) : null;
  const projection = starter.projection?.projectedGsPlus;
  const baselineProjection = starter.formStatus === "cold_start";

  return (
    <div className={`rounded border border-white/10 bg-black/25 p-4 ${align === "home" ? "lg:text-right" : ""}`} data-live-pregame-starter={starter.side} data-starter-pitcher-id={starter.pitcherId ?? "tbd"}>
      <div className={`flex items-center gap-4 ${align === "home" ? "lg:flex-row-reverse" : ""}`}>
        <Headshot playerId={starter.pitcherId} name={name} team={starter.team} size="marquee" band={starter.tier ?? null} sampleSufficient={starter.formStatus === "ok"} decorative={!href} />
        <div className="min-w-0">
          {href ? (
            <Link href={href} className="pitcher-name block font-serif text-2xl font-bold leading-tight text-zinc-50 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
              {name}
            </Link>
          ) : (
            <p className="pitcher-name font-serif text-2xl font-bold leading-tight text-zinc-50">{name}</p>
          )}
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
            {starter.team} · {starter.side === "away" ? "Away starter" : "Home starter"}
          </p>
          <div className={`mt-3 flex flex-wrap gap-1.5 ${align === "home" ? "lg:justify-end" : ""}`}>
            <PregameFormChip starter={starter} />
            <span className="inline-flex min-h-6 items-center rounded border border-white/10 bg-white/[0.04] px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-300">
              Proj GS+ {projection === null || projection === undefined ? "pending" : projection.toFixed(1)}
            </span>
            {baselineProjection ? (
              <span className="inline-flex min-h-6 items-center rounded border border-amber-300/25 bg-amber-300/10 px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-200">
                BASELINE
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function PregameFormChip({ starter }: { starter: TonightStarter }) {
  if (starter.formStatus === "ok" && typeof starter.rgs === "number") {
    const tier = starter.tier ? qualityTierOf(starter.rgs) : null;
    return (
      <span className="inline-flex min-h-6 items-center rounded border border-white/10 bg-white/[0.04] px-2 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: tier?.color ?? "#d4d4d8" }}>
        Form {starter.rgs.toFixed(1)}{starter.tier ? ` · ${starter.tier}` : ""}
      </span>
    );
  }

  const label = starter.status === "tbd" ? "TBD" : starter.formStatus === "mlb_debut" ? "MLB debut" : starter.formStatus === "join_gap" ? "Form pending" : "Limited";
  return (
    <span className="inline-flex min-h-6 items-center rounded border border-white/10 bg-white/[0.04] px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
      {label}
    </span>
  );
}

function PregameNextUpRows({ slate }: { slate: LivePregameSlate }) {
  return (
    <section className="overflow-hidden rounded border border-white/10 bg-[#101014]" data-live-pregame-next-up-count={slate.nextUpGames.length}>
      <div className="border-b border-white/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Next up</div>
      {slate.nextUpGames.map((game) => (
        <Link key={game.gamePk} href={`${slate.upcomingHref}#upcoming-game-${game.gamePk}`} className="grid gap-2 border-b border-white/10 px-4 py-3 text-sm transition last:border-b-0 hover:bg-white/[0.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:grid-cols-[88px_minmax(0,1fr)_auto] sm:items-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{formatFirstPitch(game.firstPitch)}</p>
          <div className="min-w-0">
            <p className="font-serif text-lg font-bold leading-tight text-zinc-50">{game.label}</p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
              {nextUpStarterLabel(game.starters[0])} vs {nextUpStarterLabel(game.starters[1])}
            </p>
          </div>
          <p className="font-mono text-2xl font-black leading-none text-amber-100">{formatWatchScore(game.gameWatchScore)}</p>
        </Link>
      ))}
    </section>
  );
}

function PregameConfidenceChip({ game }: { game: TonightGame }) {
  const label = watchScoreConfidenceLabel(game.watchScoreConfidence);
  if (!label) return null;

  return (
    <span className="inline-flex items-center rounded border border-amber-300/30 bg-amber-300/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-100">
      {label}
    </span>
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
      <LiveSectionHeader title={title} count={rows.length} />
      {rows.map((row) => (
        <LiveScoreboardRow key={row.id} row={row} muted={muted} />
      ))}
    </div>
  );
}

function LiveSectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 sm:px-4">
      <p>{title}</p>
      <p>{count} starters</p>
    </div>
  );
}

export function LiveScoreboardRowSkeleton({ muted = false, scored = true }: { muted?: boolean; scored?: boolean }) {
  return (
    <article className={`scroll-mt-24 grid min-h-[88px] grid-cols-[35px_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 px-3 py-3 last:border-b-0 sm:grid-cols-[43px_minmax(0,1fr)_120px] sm:px-4 ${muted ? "opacity-75" : ""}`} data-skeleton-row="live-board">
      <span className="route-shell-shimmer ml-0 block h-[65px] w-[52px] rounded" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="route-shell-shimmer h-7 w-16 rounded" />
          <span className="route-shell-shimmer h-3 w-24 rounded" />
        </div>
        <span className="route-shell-shimmer mt-2 block h-7 w-2/3 rounded" />
        <span className="route-shell-shimmer mt-2 block h-4 w-5/6 rounded" />
      </div>
      <div className="text-right">
        <span className={`route-shell-shimmer ml-auto block rounded ${scored ? "h-10 w-16" : "h-8 w-20"}`} />
        <span className="route-shell-shimmer mt-2 ml-auto block h-3 w-12 rounded" />
        {scored ? <span className="route-shell-shimmer mt-2 ml-auto block h-3 w-10 rounded" /> : null}
      </div>
    </article>
  );
}

function LiveScoreboardRowLoading({ row, muted = false, scored = false, index = 0 }: { row: LiveScoreboardRow; muted?: boolean; scored?: boolean; index?: number }) {
  return (
    <article className={`scroll-mt-24 grid min-h-[88px] grid-cols-[35px_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 px-3 py-3 last:border-b-0 sm:grid-cols-[43px_minmax(0,1fr)_120px] sm:px-4 ${muted ? "opacity-75" : ""}`} data-skeleton-row="live-board" data-live-loading-row={row.id}>
      <span className="route-shell-shimmer ml-0 block h-[65px] w-[52px] rounded" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={row.status} />
          <span className="route-shell-shimmer h-3 w-24 rounded" />
        </div>
        <span className={`route-shell-shimmer mt-2 block h-7 rounded ${index % 2 === 0 ? "w-2/3" : "w-1/2"}`} />
        <span className="route-shell-shimmer mt-2 block h-4 w-5/6 rounded" />
      </div>
      <div className="text-right">
        <span className={`route-shell-shimmer ml-auto block rounded ${scored ? "h-10 w-16" : "h-8 w-20"}`} />
        <span className="route-shell-shimmer mt-2 ml-auto block h-3 w-12 rounded" />
        {scored ? <span className="route-shell-shimmer mt-2 ml-auto block h-3 w-10 rounded" /> : null}
      </div>
    </article>
  );
}

function LiveScoreboardRow({ row, muted = false }: { row: LiveScoreboardRow; muted?: boolean }) {
  const statusTone = statusClass(row.status);
  const liveOrFinalScore = isScoredRow(row);

  return (
    <article id={`live-start-${row.pitcherId}`} data-live-start-row={row.pitcherId} className={`scroll-mt-24 grid min-h-[88px] grid-cols-[35px_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/10 px-3 py-3 last:border-b-0 sm:grid-cols-[43px_minmax(0,1fr)_120px] sm:px-4 ${muted ? "opacity-75" : ""}`}>
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
        <p className="mt-1 font-mono text-xs leading-5 text-zinc-400">
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
  const stats = [
    `${line.inningsPitched.toFixed(1)} IP`,
    `${line.hits} H`,
    `${line.earnedRuns} ER`,
    `${line.walks} BB`,
    `${line.strikeouts} K`,
  ];

  return (
    <>
      {stats.map((stat, index) => (
        <span key={stat}>
          {index > 0 ? ", " : null}
          <span className="whitespace-nowrap">{stat}</span>
        </span>
      ))}
      {typeof row.pitchCount === "number" ? (
        <span className="hidden sm:inline">
          {", "}
          <span className="whitespace-nowrap">{row.pitchCount} pitches</span>
        </span>
      ) : null}
    </>
  );
}

function lineText(row: LiveScoreboardRow) {
  return formatStartLine(row.line);
}

function formatScore(score: number | null) {
  return formatGameScorePlus(score);
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

function formatPregameFirstPitchLine(currentDate: string, slateDate: string, firstPitchAt: string | null) {
  if (!firstPitchAt) return "First pitch TBD";
  const datePrefix = currentDate === slateDate ? "" : `${formatBoardDate(slateDate)} · `;
  return `First pitch ${datePrefix}${formatFirstPitch(firstPitchAt)}`;
}

function nextUpStarterLabel(starter: TonightStarter) {
  const name = starter.name ? lastName(starter.name) : "TBD";
  const form = starter.formStatus === "ok" && typeof starter.rgs === "number" ? ` ${starter.rgs.toFixed(1)}` : "";
  return `${name}${form}`;
}

function formatNextSlateLine(board: LiveScoreboardData) {
  if (!board.nextSlateFirstPitchAt) return null;
  const parsed = new Date(board.nextSlateFirstPitchAt);
  if (Number.isNaN(parsed.valueOf())) return null;
  const timeLabel = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
    timeZoneName: "short",
  }).format(parsed).replace(/\bPST\b|\bPDT\b/, "PT");
  const relative = board.nextSlateDate ? formatRelativeSlateDate(board.date, board.nextSlateDate, parsed) : formatRelativePacificDate(parsed);

  return `First pitch ${relative}: ${timeLabel}`;
}

function formatRelativeSlateDate(currentSlateDate: string, nextSlateDate: string, firstPitch: Date) {
  const tomorrow = addPacificDays(currentSlateDate, 1);
  if (nextSlateDate === currentSlateDate) return "today";
  if (nextSlateDate === tomorrow) return "tomorrow";

  const deltaDays = daysBetweenPacificDates(currentSlateDate, nextSlateDate);
  if (deltaDays > 1 && deltaDays <= 6) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: "America/Los_Angeles",
    }).format(firstPitch);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${nextSlateDate}T00:00:00.000Z`));
}

function toPacificDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Los_Angeles",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? String(date.getUTCFullYear());
  const month = parts.find((part) => part.type === "month")?.value ?? String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = parts.find((part) => part.type === "day")?.value ?? String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatRelativePacificDate(date: Date, now = new Date()) {
  const targetDate = toPacificDate(date);
  const today = toPacificDate(now);
  const tomorrow = addPacificDays(today, 1);
  if (targetDate === today) return "today";
  if (targetDate === tomorrow) return "tomorrow";

  const deltaDays = daysBetweenPacificDates(today, targetDate);
  if (deltaDays > 1 && deltaDays <= 6) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: "America/Los_Angeles",
    }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(date);
}

function addPacificDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function daysBetweenPacificDates(left: string, right: string) {
  return Math.round((new Date(`${right}T00:00:00.000Z`).getTime() - new Date(`${left}T00:00:00.000Z`).getTime()) / 86_400_000);
}

function lastName(name: string) {
  return name.trim().split(/\s+/).at(-1) ?? name;
}

function possessiveLastName(name: string) {
  const namePart = lastName(name);
  return `${namePart}'s`;
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

function average(values: number[]) {
  if (values.length === 0) return 50;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isScoredRow(row: LiveScoreboardRow) {
  return row.scoreLabel !== "PROJ";
}

function isSlateComplete(board: LiveScoreboardData) {
  return board.hasGames && board.totalStarts > 0 && board.finalStarts === board.totalStarts;
}

function isPregame(board: LiveScoreboardData) {
  return Boolean(board.pregameSlate?.marqueeGame) && board.finalStarts === 0 && board.liveStarts === 0 && board.warmingStarts === 0 && board.delayStarts === 0;
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

function takeUnseenLiveGemAlerts(events: LiveGemAlertEvent[], date: string, seenKeys: Set<string>) {
  const unseen: LiveGemAlertEvent[] = [];

  for (const event of events) {
    if (seenKeys.has(event.dedupeKey)) continue;
    seenKeys.add(event.dedupeKey);
    unseen.push(event);
  }

  if (unseen.length > 0) {
    persistSeenLiveGemAlertKeys(date, seenKeys);
  }

  return unseen;
}

function loadSeenLiveGemAlertKeys(date: string) {
  if (typeof window === "undefined") return new Set<string>();

  try {
    const raw = window.localStorage.getItem(liveGemAlertStorageKey(date));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === "string") : []);
  } catch {
    return new Set<string>();
  }
}

function persistSeenLiveGemAlertKeys(date: string, seenKeys: Set<string>) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(liveGemAlertStorageKey(date), JSON.stringify([...seenKeys].slice(-80)));
  } catch {
    // Alert delivery should not depend on storage availability.
  }
}

function liveGemAlertStorageKey(date: string) {
  return `${LIVE_GEM_ALERT_STORAGE_PREFIX}${date}`;
}
