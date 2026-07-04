"use client";

import { useEffect, useMemo, useState } from "react";
import type { SlateProgressState } from "@/lib/slate-state";

const RANKED_STATUS_POLL_MS = 30_000;

type RankedSlateStatusIslandProps = {
  date: string;
  initialLabel: string;
  initialLive: boolean;
  initialProgress: SlateProgressState;
};

export function RankedSlateStatusIsland({ date, initialLabel, initialLive, initialProgress }: RankedSlateStatusIslandProps) {
  const [progress, setProgress] = useState(initialProgress);
  const [label, setLabel] = useState(initialLabel);
  const [isLive, setIsLive] = useState(initialLive);

  useEffect(() => {
    let cancelled = false;
    let timeout: number | undefined;
    let shouldContinuePolling = initialProgress.liveStarts > 0;

    const refresh = async () => {
      try {
        const response = await fetch(`/api/home/status?date=${encodeURIComponent(date)}`, { cache: "no-store" });
        if (!response.ok) return;
        const nextProgress = (await response.json()) as SlateProgressState;
        if (cancelled) return;

        setProgress(nextProgress);
        setLabel(rankedProgressStatusLabel(nextProgress));
        setIsLive(nextProgress.liveStarts > 0);
        shouldContinuePolling = nextProgress.liveStarts > 0;

        if (shouldContinuePolling) {
          timeout = window.setTimeout(refresh, RANKED_STATUS_POLL_MS);
        }
      } catch {
        if (!cancelled && shouldContinuePolling) {
          timeout = window.setTimeout(refresh, RANKED_STATUS_POLL_MS);
        }
      }
    };

    void refresh();

    return () => {
      cancelled = true;
      if (timeout) window.clearTimeout(timeout);
    };
  }, [date, initialProgress.liveStarts]);

  const ariaLabel = useMemo(() => `Slate completion: ${label}`, [label]);
  if (!label) return null;

  return (
    <p
      className="inline-flex min-h-8 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400"
      role="status"
      aria-label={ariaLabel}
      data-responsive-check="ranked-slate-status-island"
      data-slate-state={progress.state}
      data-slate-live-starts={progress.liveStarts}
      data-slate-completed-starts={progress.completedStarts}
    >
      {isLive ? <span className="ranked-live-dot h-2 w-2 rounded-full bg-[#FF5A1F]" aria-hidden="true" /> : null}
      <span>{label}</span>
    </p>
  );
}

function rankedProgressStatusLabel(progress: SlateProgressState) {
  if (progress.totalGames === 0 && progress.totalStarts === 0) return "";
  if (progress.state === "all-starts-complete") return `SLATE COMPLETE · ${progress.totalStarts} STARTS`;
  if (progress.liveStarts > 0 || progress.state === "starts-in-progress") return inProgressStartsLabel(progress);

  const firstPitchLabel = formatRankedFirstPitch(progress.firstPitchAt);
  if (!firstPitchLabel) return "";
  return `PROBABLES · FIRST PITCH ${firstPitchLabel}`;
}

function inProgressStartsLabel(state: { completedStarts: number; liveStarts: number; totalStarts: number }) {
  const finalStarts = Math.max(0, state.completedStarts);
  const liveStarts = Math.max(0, state.liveStarts);
  const upcomingStarts = Math.max(0, state.totalStarts - finalStarts - liveStarts);
  const upcomingSegment = upcomingStarts > 0 ? ` · ${upcomingStarts} UPCOMING` : "";
  return `${finalStarts} FINAL · ${liveStarts} IN PROGRESS${upcomingSegment}`;
}

function formatRankedFirstPitch(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return null;
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  }).format(parsed);
  return `${time} PT`;
}
