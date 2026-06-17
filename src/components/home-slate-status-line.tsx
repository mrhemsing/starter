"use client";

import { useEffect, useMemo, useState } from "react";
import { formatFirstPitchCountdown, formatSlateStatusLine, type SlateProgressState } from "@/lib/slate-state";

type HomeSlateStatusLineProps = {
  initialState: SlateProgressState;
  href: string;
};

export function HomeSlateStatusLine({ initialState, href }: HomeSlateStatusLineProps) {
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
      className="mb-4 block max-w-full font-mono text-[10px] uppercase leading-5 tracking-[0.12em] text-amber-200 sm:text-xs sm:leading-normal sm:tracking-[0.18em]"
      data-responsive-check="home-slate-status-line"
      data-slate-state={slateState.state}
      data-slate-total-games={slateState.totalGames}
      data-slate-live-games={slateState.liveGames}
      data-slate-final-games={slateState.finalGames}
    >
      <span className="status-token block sm:inline">{line}</span>
      <span className="mx-1.5 hidden sm:inline">·</span>
      <a href={href} className="nowrap-token block underline-offset-4 hover:text-amber-100 hover:underline sm:inline">
        Upcoming{"\u00A0"}starts{"\u00A0"}{"->"}
      </a>
    </p>
  );
}
