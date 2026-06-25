"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { liveDateHref } from "@/lib/routes";
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
  const mobilePreFirstPitchLine = splitPreFirstPitchStatusLine(line, slateState.state);
  const liveHref = slateState.liveGames > 0 ? liveDateHref(slateState.date) : null;
  const content = mobilePreFirstPitchLine ? (
    <>
      <span className="sm:hidden" aria-hidden="true">
        <span>{mobilePreFirstPitchLine.prefix}</span>
        <br />
        <span>{mobilePreFirstPitchLine.detail}</span>
      </span>
      <span className="hidden sm:inline" aria-hidden="true">
        {line}
      </span>
    </>
  ) : (
    line
  );

  return (
    <div
      className="mb-4 block max-w-full overflow-hidden font-mono text-[10px] uppercase leading-5 tracking-[0.12em] text-white sm:whitespace-nowrap sm:text-ellipsis sm:text-xs sm:leading-normal sm:tracking-[0.18em]"
      data-responsive-check="home-slate-status-line"
      data-slate-state={slateState.state}
      data-slate-total-starts={slateState.totalStarts}
      data-slate-completed-starts={slateState.completedStarts}
      aria-label={line}
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

function splitPreFirstPitchStatusLine(line: string, state: SlateProgressState["state"]) {
  if (state !== "pre-first-pitch") return null;

  const marker = " · FIRST ";
  const markerIndex = line.indexOf(marker);
  if (markerIndex === -1) return null;

  return {
    prefix: line.slice(0, markerIndex),
    detail: `FIRST ${line.slice(markerIndex + marker.length)}`,
  };
}
