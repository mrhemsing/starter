"use client";

import type { ReactNode } from "react";
import { Headshot, type HeadshotSize } from "@/components/headshot";

type PitcherChipProps = {
  pitcherId: string;
  name: string;
  team: string;
  metric?: string | number;
  metricLabel?: string;
  metricColor?: string;
  href?: string;
  size?: "sm" | "md" | "lg" | "spotlight";
  loading?: "eager" | "lazy";
  className?: string;
  nameClassName?: string;
  children?: ReactNode;
};

const sizeClasses = {
  sm: {
    wrapper: "grid-cols-[30px_minmax(0,1fr)_auto]",
    imageSize: "xs",
    name: "text-base",
    metric: "text-2xl",
  },
  md: {
    wrapper: "grid-cols-[41px_minmax(0,1fr)_auto]",
    imageSize: "md",
    name: "text-xl",
    metric: "text-3xl",
  },
  lg: {
    wrapper: "grid-cols-[50px_minmax(0,1fr)_auto]",
    imageSize: "lg",
    name: "text-2xl",
    metric: "text-4xl",
  },
  spotlight: {
    wrapper: "grid-cols-[66px_minmax(0,1fr)_auto]",
    imageSize: "xl",
    name: "text-4xl",
    metric: "text-5xl",
  },
} satisfies Record<string, { wrapper: string; imageSize: HeadshotSize; name: string; metric: string }>;

export function PitcherChip({
  pitcherId,
  name,
  team,
  metric,
  metricLabel,
  metricColor,
  href,
  size = "md",
  loading = "lazy",
  className = "",
  nameClassName = "",
  children,
}: PitcherChipProps) {
  const styles = sizeClasses[size];
  const content = (
    <>
      <Headshot playerId={pitcherId} name={name} team={team} size={styles.imageSize} loading={loading} decorative className="ml-1" />
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

  const classNames = `grid min-w-0 items-center gap-2 ${styles.wrapper} ${className}`;

  if (href) {
    return <a href={href} className={classNames}>{content}</a>;
  }

  return <div className={classNames}>{content}</div>;
}
