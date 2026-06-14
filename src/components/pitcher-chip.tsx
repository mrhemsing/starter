"use client";

import { useState } from "react";
import type { ReactNode } from "react";

type PitcherChipProps = {
  pitcherId: string;
  name: string;
  team: string;
  metric?: string | number;
  metricLabel?: string;
  metricColor?: string;
  href?: string;
  imageWidth?: number;
  size?: "sm" | "md" | "lg" | "spotlight";
  loading?: "eager" | "lazy";
  className?: string;
  nameClassName?: string;
  children?: ReactNode;
};

const sizeClasses = {
  sm: {
    wrapper: "grid-cols-[40px_minmax(0,1fr)_auto]",
    image: "h-10 w-10",
    name: "text-base",
    metric: "text-2xl",
  },
  md: {
    wrapper: "grid-cols-[52px_minmax(0,1fr)_auto]",
    image: "h-12 w-12",
    name: "text-xl",
    metric: "text-3xl",
  },
  lg: {
    wrapper: "grid-cols-[76px_minmax(0,1fr)_auto]",
    image: "h-20 w-16",
    name: "text-2xl",
    metric: "text-4xl",
  },
  spotlight: {
    wrapper: "grid-cols-[150px_minmax(0,1fr)_auto]",
    image: "h-44 w-36",
    name: "text-4xl",
    metric: "text-5xl",
  },
};

export function PitcherChip({
  pitcherId,
  name,
  team,
  metric,
  metricLabel,
  metricColor,
  href,
  imageWidth = 120,
  size = "md",
  loading = "lazy",
  className = "",
  nameClassName = "",
  children,
}: PitcherChipProps) {
  const [failed, setFailed] = useState(false);
  const styles = sizeClasses[size];
  const content = (
    <>
      <div className={`${styles.image} overflow-hidden rounded border border-white/10 bg-black/25`}>
        {failed ? (
          <span className="flex h-full w-full items-center justify-center font-mono text-xs font-semibold text-zinc-400">{initials(name)}</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={headshotUrl(pitcherId, imageWidth)}
            alt={`${name}, ${team}`}
            loading={loading}
            onError={() => setFailed(true)}
            className="h-full w-full object-contain object-bottom"
          />
        )}
      </div>
      <div className="min-w-0">
        <p className={`truncate font-serif font-bold leading-tight text-zinc-50 ${styles.name} ${nameClassName}`} data-pitcher-name>{name}</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{team}</p>
        {children ? <div className="mt-2">{children}</div> : null}
      </div>
      {metric !== undefined ? (
        <div className="shrink-0 text-right">
          <p className={`font-serif font-bold leading-none ${styles.metric}`} style={metricColor ? { color: metricColor } : undefined}>{metric}</p>
          {metricLabel ? <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{metricLabel}</p> : null}
        </div>
      ) : null}
    </>
  );

  const classNames = `grid min-w-0 items-center gap-3 ${styles.wrapper} ${className}`;

  if (href) {
    return <a href={href} className={classNames}>{content}</a>;
  }

  return <div className={classNames}>{content}</div>;
}

export function headshotUrl(pitcherId: string, width: number) {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_${width},q_auto:best/v1/people/${pitcherId}/headshot/67/current`;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
