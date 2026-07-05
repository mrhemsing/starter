"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { liveDateHref } from "@/lib/routes";
import { formatFirstPitchCountdown, formatSlateStatusLine, type SlateProgressState } from "@/lib/slate-state";

const SLATE_COUNTS_POLL_MS = 30_000;

type SlateCountsProps = {
  initialState: SlateProgressState;
  initialLabel?: string;
  variant: "home" | "ranked";
};

export function SlateCounts({ initialState, initialLabel, variant }: SlateCountsProps) {
  const [slateState, setSlateState] = useState(initialState);
  const [label, setLabel] = useState(initialLabel ?? slateCountsLabel(variant, initialState));

  useEffect(() => {
    let cancelled = false;
    let timeout: number | undefined;
    let shouldContinuePolling = initialState.liveStarts > 0;

    const refresh = async () => {
      try {
        const statusPath = variant === "home" ? "/api/home/status" : `/api/home/status?date=${encodeURIComponent(initialState.date)}`;
        const response = await fetch(statusPath, { cache: "no-store" });
        if (!response.ok) return;
        const nextState = (await response.json()) as SlateProgressState;
        if (cancelled) return;

        setSlateState(nextState);
        setLabel(slateCountsLabel(variant, nextState));
        shouldContinuePolling = nextState.liveStarts > 0;

        if (shouldContinuePolling) {
          timeout = window.setTimeout(refresh, SLATE_COUNTS_POLL_MS);
        }
      } catch {
        if (!cancelled && shouldContinuePolling) {
          timeout = window.setTimeout(refresh, SLATE_COUNTS_POLL_MS);
        }
      }
    };

    void refresh();

    return () => {
      cancelled = true;
      if (timeout) window.clearTimeout(timeout);
    };
  }, [initialState.date, initialState.liveStarts, variant]);

  useEffect(() => {
    if (variant !== "home" || slateState.state !== "pre-first-pitch" || !slateState.firstPitchAt) return;

    const updateCountdown = () => {
      setSlateState((current) => {
        if (current.state !== "pre-first-pitch" || !current.firstPitchAt) return current;
        const countdownLabel = formatFirstPitchCountdown(new Date(current.firstPitchAt).getTime() - Date.now());
        const nextState = countdownLabel === current.countdownLabel ? current : { ...current, countdownLabel };
        setLabel(slateCountsLabel(variant, nextState));
        return nextState;
      });
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 60 * 1000);

    return () => window.clearInterval(interval);
  }, [slateState, variant]);

  if (!label) return null;
  if (variant === "ranked") return <RankedSlateCounts state={slateState} label={label} />;
  return <HomeSlateCounts state={slateState} label={label} />;
}

function HomeSlateCounts({ state, label }: { state: SlateProgressState; label: string }) {
  const mobilePreFirstPitchLine = splitPreFirstPitchStatusLine(label, state.state);
  const liveHref = shouldLinkLiveScoreboard(state) ? liveDateHref(state.date) : null;
  const upcomingStarts = slateUpcomingStarts(state);
  const content = mobilePreFirstPitchLine ? (
    <>
      <span className="sm:hidden" aria-hidden="true">
        <span>{mobilePreFirstPitchLine.prefix}</span>
        <br />
        <span>{mobilePreFirstPitchLine.detail}</span>
      </span>
      <span className="hidden sm:inline" aria-hidden="true">
        {label}
      </span>
    </>
  ) : (
    label
  );

  return (
    <div
      className="mb-4 block max-w-full overflow-hidden font-mono text-[10px] leading-5 tracking-[0.12em] text-white sm:whitespace-nowrap sm:text-ellipsis sm:text-xs sm:leading-normal sm:tracking-[0.18em]"
      data-responsive-check="home-slate-status-line"
      data-slate-counts="home"
      data-slate-date={state.date}
      data-slate-state={state.state}
      data-slate-total-starts={state.totalStarts}
      data-slate-completed-starts={state.completedStarts}
      data-slate-live-starts={state.liveStarts}
      data-slate-upcoming-starts={upcomingStarts}
      aria-label={label}
    >
      {liveHref ? (
        <Link href={liveHref} className="inline-flex max-w-full text-white transition hover:text-[#FF9A62] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
          <span className="truncate">{content}</span>
        </Link>
      ) : (
        content
      )}
    </div>
  );
}

function RankedSlateCounts({ state, label }: { state: SlateProgressState; label: string }) {
  const ariaLabel = useMemo(() => `Slate completion: ${label}`, [label]);
  const upcomingStarts = slateUpcomingStarts(state);

  return (
    <p
      className="inline-flex min-h-8 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400"
      role="status"
      aria-label={ariaLabel}
      data-responsive-check="ranked-slate-status-island"
      data-slate-counts="ranked"
      data-slate-date={state.date}
      data-slate-state={state.state}
      data-slate-total-starts={state.totalStarts}
      data-slate-live-starts={state.liveStarts}
      data-slate-completed-starts={state.completedStarts}
      data-slate-upcoming-starts={upcomingStarts}
    >
      {state.liveStarts > 0 ? <span className="ranked-live-dot h-2 w-2 rounded-full bg-[#FF5A1F]" aria-hidden="true" /> : null}
      <span>{label}</span>
    </p>
  );
}

function slateCountsLabel(variant: "home" | "ranked", state: SlateProgressState) {
  return variant === "ranked" ? rankedProgressStatusLabel(state) : formatSlateStatusLine(state);
}

function rankedProgressStatusLabel(progress: SlateProgressState) {
  if (progress.totalGames === 0 && progress.totalStarts === 0) return "";
  if (progress.state === "all-starts-complete") return `SLATE COMPLETE · ${progress.totalStarts} STARTS`;
  if (progress.state === "reconciling") return `RECONCILING · ${progress.completedStarts} OF ${progress.totalStarts} STARTS FINAL`;
  if (progress.liveStarts > 0 || progress.state === "starts-in-progress") return inProgressStartsLabel(progress);

  const firstPitchLabel = formatRankedFirstPitch(progress.firstPitchAt);
  if (!firstPitchLabel) return "";
  return `PROBABLES · FIRST PITCH ${firstPitchLabel}`;
}

function inProgressStartsLabel(state: { completedStarts: number; liveStarts: number; totalStarts: number }) {
  const finalStarts = Math.max(0, state.completedStarts);
  const liveStarts = Math.max(0, state.liveStarts);
  const upcomingStarts = slateUpcomingStarts(state);
  const upcomingSegment = upcomingStarts > 0 ? ` · ${upcomingStarts} UPCOMING` : "";
  return `${finalStarts} FINAL · ${liveStarts} IN PROGRESS${upcomingSegment}`;
}

function slateUpcomingStarts(state: { completedStarts: number; liveStarts: number; totalStarts: number }) {
  return Math.max(0, state.totalStarts - Math.max(0, state.completedStarts) - Math.max(0, state.liveStarts));
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

function shouldLinkLiveScoreboard(state: SlateProgressState) {
  return state.state === "starts-in-progress" || state.state === "pre-first-pitch" || state.state === "reconciling" || state.state === "all-starts-complete";
}

function splitPreFirstPitchStatusLine(line: string, state: SlateProgressState["state"]) {
  if (state !== "pre-first-pitch") return null;

  const marker = " · first ";
  const markerIndex = line.indexOf(marker);
  if (markerIndex === -1) return null;

  return {
    prefix: line.slice(0, markerIndex),
    detail: `first ${line.slice(markerIndex + marker.length)}`,
  };
}
