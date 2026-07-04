"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { LIVE_NAV_STATE_EVENT } from "@/components/live-nav-label";
import type { LiveScoreboard } from "@/lib/data/live-scoreboard-service";

export const HOME_LIVE_BOARD_POLL_MS = 30 * 1000;
const HOME_LIVE_BOARD_FIRST_PITCH_GRACE_MS = 15 * 1000;

type HomeLiveBoardContextValue = {
  board: LiveScoreboard | null;
  shouldPoll: boolean;
  today: string;
};

const HomeLiveBoardContext = createContext<HomeLiveBoardContextValue | null>(null);

export function HomeLiveBoardProvider({ initialBoard, today, children }: { initialBoard: LiveScoreboard | null; today: string; children: React.ReactNode }) {
  const [board, setBoard] = useState(initialBoard);
  const boardRef = useRef(initialBoard);
  const shouldPoll = Boolean(board?.hasGames && board.liveStarts > 0 && board.slateProgress.state !== "all-starts-complete");

  useEffect(() => {
    boardRef.current = board;
    if (!board) return;
    window.dispatchEvent(new CustomEvent(LIVE_NAV_STATE_EVENT, { detail: { liveStarts: board.liveStarts, warmingStarts: board.warmingStarts } }));
  }, [board]);

  useEffect(() => {
    if (!shouldPoll) return;

    let cancelled = false;
    let livePoll = 0;

    const syncLiveBoard = async () => {
      const nextBoard = await fetchJson<LiveScoreboard>(`/api/live/${today}`);
      if (cancelled) return;
      boardRef.current = nextBoard;
      setBoard(nextBoard);

      if (nextBoard.slateProgress.state === "all-starts-complete" || nextBoard.liveStarts === 0) {
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
  }, [shouldPoll, today]);

  useEffect(() => {
    if (shouldPoll || !board || board.slateProgress.state === "all-starts-complete") return;
    const nextFirstPitchMs = board.rows
      .filter((row) => row.status === "scheduled" || row.status === "warming")
      .map((row) => new Date(row.firstPitch).getTime())
      .filter((value) => Number.isFinite(value) && value >= Date.now() - HOME_LIVE_BOARD_FIRST_PITCH_GRACE_MS)
      .sort((a, b) => a - b)[0];
    if (!nextFirstPitchMs) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetchJson<LiveScoreboard>(`/api/live/${today}`)
        .then((nextBoard) => {
          if (cancelled) return;
          boardRef.current = nextBoard;
          setBoard(nextBoard);
        })
        .catch(() => undefined);
    }, Math.max(HOME_LIVE_BOARD_FIRST_PITCH_GRACE_MS, nextFirstPitchMs - Date.now() + HOME_LIVE_BOARD_FIRST_PITCH_GRACE_MS));

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [board, shouldPoll, today]);

  const value = useMemo(() => ({ board, shouldPoll, today }), [board, shouldPoll, today]);
  return <HomeLiveBoardContext.Provider value={value}>{children}</HomeLiveBoardContext.Provider>;
}

export function useHomeLiveBoard() {
  const value = useContext(HomeLiveBoardContext);
  if (!value) {
    return { board: null, shouldPoll: false, today: "" };
  }
  return value;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Request failed: ${url}`);
  return response.json() as Promise<T>;
}
