"use client";

import { useEffect, useMemo, useState } from "react";
import { formatFirstPitchCountdown, formatSlateStatusLine, type SlateProgressState } from "@/lib/slate-state";

type HomeSlateStatusLineProps = {
  initialState: SlateProgressState;
};

export function HomeSlateStatusLine({ initialState }: HomeSlateStatusLineProps) {
  const [slateState, setSlateState] = useState(initialState);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const response = await fetch(`/api/home/status?date=${encodeURIComponent(initialState.date)}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const nextState = (await response.json()) as SlateProgressState;
        if (!cancelled) setSlateState(nextState);
      } catch {
        // Keep the server-rendered line if a transient refresh fails.
      }
    };

    const interval = window.setInterval(refresh, 30 * 1000);
    void refresh();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [initialState.date]);

  useEffect(() => {
    if (slateState.state !== "pre-first-pitch" || !slateState.firstPitchAt) return;

    const updateCountdown = () => {
      setSlateState((current) => {
        if (current.state !== "pre-first-pitch" || !current.firstPitchAt) return current;
        const countdownLabel = formatFirstPitchCountdown(new Date(current.firstPitchAt).getTime() - Date.now());
        return countdownLabel === current.countdownLabel ? current : { ...current, countdownLabel };
      });
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 60 * 1000);

    return () => window.clearInterval(interval);
  }, [slateState.firstPitchAt, slateState.state]);

  const line = useMemo(() => formatSlateStatusLine(slateState), [slateState]);

  return (
    <p
      className="mb-4 block max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[10px] uppercase leading-5 tracking-[0.12em] text-white sm:text-xs sm:leading-normal sm:tracking-[0.18em]"
      data-responsive-check="home-slate-status-line"
      data-slate-state={slateState.state}
      data-slate-total-games={slateState.totalGames}
      data-slate-live-games={slateState.liveGames}
      data-slate-final-games={slateState.finalGames}
    >
      {line}
    </p>
  );
}
