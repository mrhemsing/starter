"use client";

import { useEffect, useState } from "react";
import type { SlateProgressState } from "@/lib/slate-state";

export type LiveNavIndicatorState = "active" | "warming" | "idle";

export type LiveNavSnapshot = {
  liveStarts: number;
  warmingStarts: number;
};

export const LIVE_NAV_STATE_EVENT = "toe-the-slab:live-nav-state";
const LIVE_NAV_POLL_MS = 30_000;

type LiveNavStatusResponse = SlateProgressState & {
  nav?: LiveNavSnapshot;
};

export function LiveNavLabel({ initialSnapshot, statusDate, routeActive = false }: { initialSnapshot: LiveNavSnapshot; statusDate: string; routeActive?: boolean }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const state = getLiveNavIndicatorState(snapshot);
  const active = state === "active";
  const warming = state === "warming";
  const toneClass = routeActive ? "text-zinc-50" : active ? "text-[#FF9A62]" : "text-zinc-400";
  const dotClass = active
    ? "bg-[#FF5A1F]"
    : warming
      ? "border border-[#F6C445] bg-transparent"
      : "";

  useEffect(() => {
    const handleStateEvent = (event: Event) => {
      const detail = (event as CustomEvent<LiveNavSnapshot>).detail;
      if (!detail || typeof detail.liveStarts !== "number" || typeof detail.warmingStarts !== "number") return;
      setSnapshot(detail);
    };

    window.addEventListener(LIVE_NAV_STATE_EVENT, handleStateEvent);
    return () => window.removeEventListener(LIVE_NAV_STATE_EVENT, handleStateEvent);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timeout: number | undefined;
    let shouldContinuePolling = initialSnapshot.liveStarts > 0 || initialSnapshot.warmingStarts > 0;

    const refresh = async () => {
      try {
        const response = await fetch(`/api/home/status?date=${encodeURIComponent(statusDate)}`, { cache: "no-store" });
        if (!response.ok) return;
        const nextState = (await response.json()) as LiveNavStatusResponse;
        if (cancelled) return;

        const nextSnapshot = normalizeLiveNavSnapshot(nextState);
        setSnapshot(nextSnapshot);
        shouldContinuePolling = nextSnapshot.liveStarts > 0 || nextSnapshot.warmingStarts > 0;

        if (shouldContinuePolling) {
          timeout = window.setTimeout(refresh, LIVE_NAV_POLL_MS);
        }
      } catch {
        if (!cancelled && shouldContinuePolling) {
          timeout = window.setTimeout(refresh, LIVE_NAV_POLL_MS);
        }
      }
    };

    void refresh();

    return () => {
      cancelled = true;
      if (timeout) window.clearTimeout(timeout);
    };
  }, [initialSnapshot.liveStarts, initialSnapshot.warmingStarts, statusDate]);

  return (
    <span
      className={`inline-flex items-center gap-2 ${toneClass}`}
      data-live-nav-island="true"
      data-live-nav-state={state}
      data-live-nav-active={active ? "true" : "false"}
      data-live-nav-route-active={routeActive ? "true" : "false"}
      data-live-nav-live-starts={snapshot.liveStarts}
      data-live-nav-warming-starts={snapshot.warmingStarts}
    >
      {state === "idle" ? null : <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />}
      Live
    </span>
  );
}

function normalizeLiveNavSnapshot(state: LiveNavStatusResponse): LiveNavSnapshot {
  if (state.nav && Number.isFinite(state.nav.liveStarts) && Number.isFinite(state.nav.warmingStarts)) {
    return {
      liveStarts: Math.max(0, state.nav.liveStarts),
      warmingStarts: Math.max(0, state.nav.warmingStarts),
    };
  }

  return {
    liveStarts: Math.max(0, state.liveStarts),
    warmingStarts: state.state === "pre-first-pitch" ? 1 : 0,
  };
}

function getLiveNavIndicatorState(snapshot: LiveNavSnapshot): LiveNavIndicatorState {
  if (snapshot.liveStarts > 0) return "active";
  if (snapshot.warmingStarts > 0) return "warming";
  return "idle";
}
