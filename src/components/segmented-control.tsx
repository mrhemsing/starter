"use client";

import type React from "react";
import { FastFilterLink } from "@/components/fast-filter-link";

type Segment = {
  value: string;
  label: string;
  href?: string;
  controlKey?: string;
};

type SegmentedControlProps = {
  label: string;
  segments: Segment[];
  activeValue: string;
  ariaLabel?: string;
  storageKey?: string;
  pendingRegion?: string;
  pendingLabel?: string;
  ariaControls?: string;
  onValueChange?: (value: string) => void;
};

export function SegmentedControl({
  label,
  segments,
  activeValue,
  ariaLabel,
  storageKey,
  pendingRegion = "route-data",
  pendingLabel,
  ariaControls,
  onValueChange,
}: SegmentedControlProps) {
  const activeIndex = Math.max(0, segments.findIndex((segment) => segment.value === activeValue));
  const segmentCount = Math.min(Math.max(segments.length, 1), 3);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = segments.findIndex((segment) => segment.value === activeValue);
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    let nextIndex = safeIndex;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (safeIndex - 1 + segments.length) % segments.length;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (safeIndex + 1) % segments.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = segments.length - 1;
    const nextValue = segments[nextIndex]?.value;
    if (!nextValue) return;
    const nextElement = event.currentTarget.querySelector<HTMLElement>(`[data-segmented-control-option="${nextValue}"]`);
    nextElement?.focus();
    nextElement?.click();
  }

  return (
    <div
      role="group"
      aria-label={ariaLabel ?? `${label} options`}
      className="min-w-0 shrink-0"
      data-segmented-control={label.toLowerCase()}
      data-segmented-control-active={activeValue}
      data-segmented-control-count={segmentCount}
      data-segmented-control-storage-key={storageKey}
      onKeyDown={handleKeyDown}
    >
      <div className="flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-2 py-1.5 shadow-inner shadow-black/20">
        <p className="shrink-0 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
        <span
          aria-hidden="true"
          className="segmented-control-indicator sr-only"
          data-segmented-control-indicator
          data-segmented-control-indicator-index={activeIndex}
          style={{ transform: `translateX(${activeIndex * 100}%)` }}
        />
        {segments.map((segment, index) => {
          const active = segment.value === activeValue;
          const className = segmentedOptionClass(active, index > 0);
          const controlKey = segment.controlKey ?? segment.value;
          if (segment.href) {
            return (
              <FastFilterLink
                key={segment.value}
                className={className}
                href={segment.href}
                ariaCurrent={active ? "location" : undefined}
                aria-controls={ariaControls}
                data-control-link-active={String(active)}
                data-control-link-key={controlKey}
                data-segmented-control-option={segment.value}
                pendingRegion={pendingRegion}
                pendingLabel={pendingLabel}
                scroll={false}
              >
                {segment.label}
              </FastFilterLink>
            );
          }
          return (
            <button
              key={segment.value}
              type="button"
              className={className}
              aria-pressed={active}
              data-segmented-control-option={segment.value}
              data-view-mode-option={segment.value}
              data-control-link-active={String(active)}
              data-control-link-key={controlKey}
              onClick={() => onValueChange?.(segment.value)}
            >
              {segment.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function segmentedOptionClass(active: boolean, hasDivider: boolean) {
  return [
    "relative z-10 inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 before:h-2 before:w-2 before:rounded-full before:border before:content-[''] sm:min-h-10 sm:px-3 sm:text-[11px]",
    active ? "bg-amber-300 text-zinc-950 before:border-zinc-950 before:bg-zinc-950" : "text-zinc-300 hover:bg-white/[0.04] hover:text-zinc-50 before:border-white/25 before:bg-transparent",
    hasDivider ? "" : "",
  ].filter(Boolean).join(" ");
}
