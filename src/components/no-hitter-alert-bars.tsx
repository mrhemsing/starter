"use client";

import { useEffect, useMemo, useState } from "react";
import { HOME_LIVE_BOARD_POLL_MS, useHomeLiveBoard } from "@/components/home-live-board-provider";
import type { LiveScoreboard } from "@/lib/data/live-scoreboard-service";
import type { NoHitterBidAlert } from "@/lib/data/no-hitter-alert-service";

const NO_HITTER_DISMISS_PREFIX = "tts-no-hitter-alert";

export function NoHitterAlertBars({ today }: { today: string }) {
  const { board, boardUnverified, today: contextToday } = useHomeLiveBoard();
  const [fallbackBoard, setFallbackBoard] = useState<LiveScoreboard | null>(null);
  const [dismissed, setDismissed] = useState(() => readDismissedBidIds());
  const [nowMs, setNowMs] = useState(0);
  const contextBoard = board && !boardUnverified ? board : null;
  const effectiveToday = contextToday || today;

  useEffect(() => {
    const initialTimer = window.setTimeout(() => setNowMs(Date.now()), 0);
    const interval = window.setInterval(() => setNowMs(Date.now()), 60 * 1000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (contextBoard || !effectiveToday) return;

    let cancelled = false;
    let livePoll = 0;

    const syncLiveBoard = async () => {
      const nextBoard = await fetchJson<LiveScoreboard>(`/api/live/${effectiveToday}`);
      if (cancelled) return;
      setFallbackBoard(nextBoard);

      if (nextBoard.slateProgress.state === "all-starts-complete" && (nextBoard.noHitterAlerts ?? []).length === 0) {
        window.clearInterval(livePoll);
      }
    };

    syncLiveBoard().catch(() => undefined);
    livePoll = window.setInterval(() => {
      syncLiveBoard().catch(() => undefined);
    }, HOME_LIVE_BOARD_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(livePoll);
    };
  }, [contextBoard, effectiveToday]);

  const alerts = useMemo(() => {
    const sourceAlerts = (contextBoard ?? fallbackBoard)?.noHitterAlerts ?? [];
    return sourceAlerts
      .filter((alert) => nowMs === 0 || Date.parse(alert.expiresAt) > nowMs)
      .filter((alert) => !dismissed.has(alert.id))
      .sort((a, b) => b.outsRecorded - a.outsRecorded || a.pitcherName.localeCompare(b.pitcherName));
  }, [contextBoard, dismissed, fallbackBoard, nowMs]);

  if (alerts.length === 0) return null;

  return (
    <section className="mt-3 grid gap-2" aria-label="Live no-hitter alerts" data-responsive-check="no-hitter-alert-bars" data-no-hitter-alert-count={alerts.length}>
      {alerts.map((alert) => (
        <NoHitterAlertBar key={alert.id} alert={alert} onDismiss={() => {
          rememberDismissedBid(alert.id);
          setDismissed(readDismissedBidIds());
        }} />
      ))}
    </section>
  );
}

function NoHitterAlertBar({ alert, onDismiss }: { alert: NoHitterBidAlert; onDismiss: () => void }) {
  const elevated = alert.status === "active" && alert.outsRecorded >= 24;
  const label = alert.kind === "perfect-game" && alert.status === "active" ? "Perfect game bid" : alert.status === "completed" ? alert.kind === "perfect-game" ? "Perfect game" : "No-hitter" : "No-hit bid";
  const copy = alertCopy(alert, label);

  return (
    <div
      className={`flex flex-col gap-3 rounded border px-3 py-3 shadow-[0_18px_44px_rgba(0,0,0,0.28)] sm:flex-row sm:items-center sm:justify-between ${elevated ? "border-[#FF5A1F]/60 bg-[#FF5A1F]/15" : "border-amber-300/35 bg-amber-300/[0.08]"}`}
      data-no-hitter-alert={alert.id}
      data-no-hitter-alert-status={alert.status}
      data-no-hitter-alert-kind={alert.kind}
      data-no-hitter-alert-elevated={elevated ? "true" : "false"}
    >
      <a href={alert.liveHref} className="min-w-0 text-sm leading-5 text-zinc-100 hover:text-amber-100">
        <span className={`mr-2 inline-flex rounded px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${elevated ? "bg-[#FF5A1F] text-zinc-950" : "bg-amber-300 text-zinc-950"}`}>
          {label}
        </span>
        <span className="font-semibold">{copy}</span>
        {alert.pitchCount !== null ? <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">{alert.pitchCount} pitches</span> : null}
      </a>
      <button
        type="button"
        className="min-h-8 shrink-0 rounded border border-white/15 px-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 hover:border-white/35 hover:text-zinc-100"
        onClick={onDismiss}
        aria-label={`Dismiss ${label} alert for ${alert.pitcherName}`}
      >
        Dismiss
      </button>
    </div>
  );
}

function alertCopy(alert: NoHitterBidAlert, label: string) {
  const innings = formatBidInnings(alert.inningsPitched);
  if (alert.status === "broken") return `Broken: ${alert.pitcherName} (${alert.team}), ${innings} IP`;
  if (alert.status === "removed") return `${alert.pitcherName} removed after ${innings} no-hit IP`;
  if (alert.status === "completed") return `${label}: ${alert.pitcherName} (${alert.team})`;
  return `${alert.pitcherName} (${alert.team}), ${innings} IP`;
}

function readDismissedBidIds() {
  if (typeof window === "undefined") return new Set<string>();
  const ids = new Set<string>();
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(`${NO_HITTER_DISMISS_PREFIX}:`)) ids.add(key.slice(NO_HITTER_DISMISS_PREFIX.length + 1));
  }
  return ids;
}

function rememberDismissedBid(id: string) {
  window.localStorage.setItem(`${NO_HITTER_DISMISS_PREFIX}:${id}`, new Date().toISOString());
}

function formatBidInnings(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Request failed: ${url}`);
  return response.json() as Promise<T>;
}
