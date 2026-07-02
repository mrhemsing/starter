"use client";

import { useEffect, useState } from "react";

export type LiveNavIndicatorState = "active" | "warming" | "idle";

export type LiveNavSnapshot = {
  liveStarts: number;
  warmingStarts: number;
};

export const LIVE_NAV_STATE_EVENT = "toe-the-slab:live-nav-state";

export function LiveNavLabel({ initialSnapshot, routeActive = false }: { initialSnapshot: LiveNavSnapshot; routeActive?: boolean }) {
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

  return (
    <span className={`inline-flex items-center gap-2 ${toneClass}`} data-live-nav-state={state} data-live-nav-active={active ? "true" : "false"} data-live-nav-route-active={routeActive ? "true" : "false"}>
      {state === "idle" ? null : <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />}
      Live
    </span>
  );
}

function getLiveNavIndicatorState(snapshot: LiveNavSnapshot): LiveNavIndicatorState {
  if (snapshot.liveStarts > 0) return "active";
  if (snapshot.warmingStarts > 0) return "warming";
  return "idle";
}
