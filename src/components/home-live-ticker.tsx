"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LIVE_NAV_STATE_EVENT } from "@/components/live-nav-label";
import { upcomingDateHref } from "@/lib/routes";
import type { LiveScoreboard, LiveScoreboardRow } from "@/lib/data/live-scoreboard-service";

const HOME_LIVE_TICKER_POLL_MS = 30 * 1000;
const HOME_LIVE_TICKER_FIRST_PITCH_GRACE_MS = 15 * 1000;
const HOME_LIVE_TICKER_AUTO_RESUME_MS = 4 * 1000;

type TickerEntry = {
  key: string;
  label: string;
  href: string;
  score?: number;
  glyph?: "up" | "down";
  time?: string;
  state: "live" | "final" | "upcoming";
};

export function HomeLiveTicker({ initialBoard, today }: { initialBoard: LiveScoreboard | null; today: string }) {
  const [board, setBoard] = useState(initialBoard);
  const [touchPaused, setTouchPaused] = useState(false);
  const autoResumeTimer = useRef(0);
  const staleSlateVerifyKey = useRef<string | null>(null);
  const visible = shouldRenderTicker(board);
  const shouldPoll = Boolean(board?.hasActiveStarts && visible);
  const shouldVerifyStaleSlate = Boolean(visible && board && !shouldPoll && (board.finalStarts > 0 || board.delayStarts > 0));
  const phase = board && (board.liveStarts > 0 || board.delayStarts > 0) ? "live" : "today";

  useEffect(() => {
    if (!board) return;
    window.dispatchEvent(new CustomEvent(LIVE_NAV_STATE_EVENT, { detail: { liveStarts: board.liveStarts, warmingStarts: board.warmingStarts } }));
  }, [board]);

  useEffect(() => {
    if (!visible || !board) return;

    let cancelled = false;
    let livePoll = 0;
    let firstPitchTimer = 0;

    const syncTicker = async () => {
      const nextBoard = await fetchJson<LiveScoreboard>(`/api/live/${today}`);
      if (cancelled) return;
      setBoard(nextBoard);

      if (!nextBoard.hasActiveStarts && nextBoard.slateProgress.state !== "all-starts-complete") {
        scheduleFirstPitchSync(nextBoard);
      }

      if (nextBoard.slateProgress.state === "all-starts-complete") {
        window.clearInterval(livePoll);
        window.clearTimeout(firstPitchTimer);
      }
    };

    const scheduleFirstPitchSync = (current: LiveScoreboard) => {
      window.clearTimeout(firstPitchTimer);
      const firstPitchMs = current.slateProgress.firstPitchAt ? new Date(current.slateProgress.firstPitchAt).getTime() : NaN;
      if (!Number.isFinite(firstPitchMs)) return;
      const delayMs = Math.max(HOME_LIVE_TICKER_FIRST_PITCH_GRACE_MS, firstPitchMs - Date.now() + HOME_LIVE_TICKER_FIRST_PITCH_GRACE_MS);
      firstPitchTimer = window.setTimeout(() => {
        syncTicker().catch(() => undefined);
      }, delayMs);
    };

    if (shouldPoll) {
      syncTicker().catch(() => undefined);
      livePoll = window.setInterval(() => {
        syncTicker().catch(() => undefined);
      }, HOME_LIVE_TICKER_POLL_MS);
    } else {
      const verifyKey = `${board.date}:${board.liveStarts}:${board.finalStarts}:${board.warmingStarts}:${board.scheduledStarts}:${board.delayStarts}`;
      if (shouldVerifyStaleSlate && staleSlateVerifyKey.current !== verifyKey) {
        staleSlateVerifyKey.current = verifyKey;
        syncTicker().catch(() => undefined);
      }
      scheduleFirstPitchSync(board);
    }

    return () => {
      cancelled = true;
      window.clearInterval(livePoll);
      window.clearTimeout(firstPitchTimer);
    };
  }, [board, shouldPoll, shouldVerifyStaleSlate, today, visible]);

  useEffect(() => () => window.clearTimeout(autoResumeTimer.current), []);

  const entries = useMemo(() => buildTickerEntries(board), [board]);
  if (!visible || entries.length === 0) return null;

  const marqueeEntries = [...entries, ...entries];
  const pauseForTouch = () => {
    window.clearTimeout(autoResumeTimer.current);
    setTouchPaused(true);
  };
  const scheduleTouchResume = () => {
    window.clearTimeout(autoResumeTimer.current);
    autoResumeTimer.current = window.setTimeout(() => setTouchPaused(false), HOME_LIVE_TICKER_AUTO_RESUME_MS);
  };

  return (
    <section
      className="mt-4 overflow-hidden rounded border border-white/10 bg-[#101014]/95"
      aria-label="Live GS+ ticker"
      data-responsive-check="home-live-gs-ticker"
      data-home-live-ticker-phase={phase}
      data-home-live-ticker-polling={shouldPoll ? "true" : "false"}
    >
      <div className="flex min-h-11 items-center gap-3">
        <div className="flex min-h-11 shrink-0 items-center gap-2 border-r border-white/10 px-3 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
          {phase === "live" ? <span className="ranked-live-dot h-2 w-2 rounded-full bg-[#FF5A1F]" aria-hidden="true" /> : null}
          <span className={phase === "live" ? "text-[#FF9A62]" : "text-zinc-400"}>{phase === "live" ? "LIVE" : "TODAY"}</span>
        </div>
        <div className="home-live-ticker-scrollbarless min-w-0 flex-1 overflow-x-auto motion-reduce:overflow-x-auto">
          <div
            className="home-live-ticker-track flex w-max items-center gap-5 py-2 pr-5 motion-reduce:animate-none"
            data-touch-paused={touchPaused ? "true" : "false"}
            onPointerDown={pauseForTouch}
            onPointerUp={scheduleTouchResume}
            onPointerCancel={scheduleTouchResume}
            onPointerLeave={scheduleTouchResume}
          >
            {marqueeEntries.map((entry, index) => <TickerEntryItem key={`${entry.key}-${index}`} entry={entry} duplicate={index >= entries.length} />)}
          </div>
        </div>
      </div>
    </section>
  );
}

function TickerEntryItem({ entry, duplicate }: { entry: TickerEntry; duplicate: boolean }) {
  return (
    <a
      href={entry.href}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.13em] hover:text-amber-200 ${entry.state === "final" ? "text-zinc-500" : "text-zinc-300"}`}
      aria-hidden={duplicate ? "true" : undefined}
      tabIndex={duplicate ? -1 : undefined}
    >
      {entry.state === "upcoming" ? <span className="text-zinc-500">NEXT</span> : null}
      <span className={entry.state === "final" ? "font-semibold text-zinc-400" : "font-semibold text-zinc-50"}>{entry.label}</span>
      {entry.score !== undefined ? <span className={entry.state === "final" ? "text-zinc-500" : "text-zinc-300"}>{Math.round(entry.score)}</span> : entry.state === "live" ? <span className="text-zinc-500">--</span> : null}
      {entry.glyph ? <span className={entry.glyph === "up" ? "text-[#FF9A62]" : "text-[#7EC8FF]"}>{entry.glyph === "up" ? "▲" : "▼"}</span> : null}
      {entry.time ? <span className="text-zinc-400">{entry.time}</span> : null}
    </a>
  );
}

function shouldRenderTicker(board: LiveScoreboard | null) {
  return Boolean(board?.hasGames && board.totalStarts > 0 && board.finalStarts < board.totalStarts);
}

function buildTickerEntries(board: LiveScoreboard | null): TickerEntry[] {
  if (!board) return [];
  const liveRows = board.rows
    .filter((row) => row.status === "live")
    .sort((a, b) => (b.gsPlus ?? 0) - (a.gsPlus ?? 0) || a.pitcherName.localeCompare(b.pitcherName));
  const finalRows = board.rows
    .filter((row) => row.scoreLabel === "FINAL")
    .sort((a, b) => (b.gsPlus ?? 0) - (a.gsPlus ?? 0) || a.pitcherName.localeCompare(b.pitcherName));
  const upcomingRows = board.rows
    .filter((row) => row.scoreLabel === "PROJ" && (row.status === "scheduled" || row.status === "warming"))
    .sort((a, b) => Number(b.status === "warming") - Number(a.status === "warming") || new Date(a.firstPitch).getTime() - new Date(b.firstPitch).getTime());
  const liveNames = disambiguatedNames(liveRows);
  const finalNames = disambiguatedNames(finalRows);
  const upcomingNames = disambiguatedNames(upcomingRows);

  return [
    ...liveRows.map((row) => ({
      key: `live-${row.id}`,
      label: liveNames.get(row.id) ?? lastName(row.pitcherName),
      href: row.liveHref,
      score: row.gsPlus ?? undefined,
      glyph: row.gsPlus === null ? undefined : (row.gsPlus ?? 0) >= (row.projectedGsPlus ?? 50) ? "up" as const : "down" as const,
      state: "live" as const,
    })),
    ...finalRows.map((row) => ({
      key: `final-${row.id}`,
      label: finalNames.get(row.id) ?? lastName(row.pitcherName),
      href: row.liveHref,
      score: row.gsPlus ?? undefined,
      state: "final" as const,
    })),
    ...upcomingRows.map((row) => ({
      key: `upcoming-${row.id}`,
      label: upcomingNames.get(row.id) ?? lastName(row.pitcherName),
      href: upcomingDateHref(board.date),
      time: formatTickerTime(row.firstPitch),
      state: "upcoming" as const,
    })),
  ];
}

function disambiguatedNames(rows: LiveScoreboardRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = lastName(row.pitcherName);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return new Map(rows.map((row) => {
    const last = lastName(row.pitcherName);
    const first = row.pitcherName.trim()[0]?.toUpperCase();
    return [row.id, counts.get(last)! > 1 && first ? `${first}.${last}` : last];
  }));
}

function lastName(name: string) {
  const parts = name.trim().split(/\s+/);
  return (parts.at(-1) ?? name).toUpperCase();
}

function formatTickerTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  }).format(parsed).replace(/\s/g, "");
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Request failed: ${url}`);
  return response.json() as Promise<T>;
}
