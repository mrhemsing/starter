"use client";

import type { ReactNode } from "react";
import { Headshot } from "@/components/headshot";

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
  const styles = sizeClasses[size];
  const content = (
    <>
      <Headshot playerId={pitcherId} name={name} team={team} loading={loading} imageWidth={imageWidth} decorative className={styles.image} />
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
