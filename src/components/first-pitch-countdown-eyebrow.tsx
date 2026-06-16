"use client";

import { useEffect, useState } from "react";

export type FirstPitchCountdownEyebrowProps = {
  href: string;
  startsAt: string;
  gameCount: number;
  initialTimeLabel: string;
};

export function FirstPitchCountdownEyebrow({ href, startsAt, gameCount, initialTimeLabel }: FirstPitchCountdownEyebrowProps) {
  const [timeLabel, setTimeLabel] = useState(initialTimeLabel);
  const subject = gameCount === 1 ? "First game" : "First games";

  useEffect(() => {
    const update = () => setTimeLabel(formatCountdownDuration(new Date(startsAt).getTime() - Date.now()));
    update();
    const interval = window.setInterval(update, 1000);

    return () => window.clearInterval(interval);
  }, [startsAt]);

  return (
    <a
      href={href}
      className="mb-4 mt-1 block max-w-full truncate font-mono text-[10px] uppercase tracking-[0.12em] text-amber-200 underline-offset-4 hover:text-amber-100 hover:underline sm:text-xs sm:tracking-[0.18em]"
      data-responsive-check="first-pitch-countdown"
      data-first-pitch={startsAt}
      data-first-pitch-games={gameCount}
    >
      <span>{subject} in {timeLabel}</span>
      {" "}
      <span className="mx-1.5">·</span>
      {" "}
      <span>Upcoming starts {"->"}</span>
    </a>
  );
}

function formatCountdownDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}H ${minutes}M ${seconds}S`;
}
