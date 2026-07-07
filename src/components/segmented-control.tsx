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
      <div
        className="relative grid min-h-11 items-center rounded-lg border border-white/10 bg-black/35 p-1 shadow-inner shadow-black/20"
        style={{ gridTemplateColumns: `repeat(${segmentCount}, minmax(0, 1fr))` }}
      >
        <span
          aria-hidden="true"
          className="segmented-control-indicator pointer-events-none absolute inset-y-1 left-1 rounded-md border border-white/10 bg-zinc-700 shadow-[0_8px_22px_rgba(0,0,0,0.25)] transition-transform duration-200 ease-out motion-reduce:transition-none"
          data-segmented-control-indicator
          data-segmented-control-indicator-index={activeIndex}
          style={{
            width: `calc((100% - 0.5rem) / ${segmentCount})`,
            transform: `translateX(${activeIndex * 100}%)`,
          }}
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
                <SegmentedOptionLabel active={active}>{segment.label}</SegmentedOptionLabel>
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
              <SegmentedOptionLabel active={active}>{segment.label}</SegmentedOptionLabel>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function segmentedOptionClass(active: boolean, hasDivider: boolean) {
  return [
    "relative z-10 inline-flex min-h-9 cursor-pointer items-center justify-center gap-1 rounded-md px-2 text-center font-mono text-[9px] font-semibold uppercase tracking-[0.08em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200 sm:px-2.5 sm:text-[10px]",
    active ? "text-white" : "text-zinc-300 hover:text-zinc-50",
    hasDivider ? "before:absolute before:left-0 before:top-1/2 before:h-4 before:w-px before:-translate-y-1/2 before:bg-white/10 before:content-['']" : "",
  ].filter(Boolean).join(" ");
}

function SegmentedOptionLabel({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center gap-1.5 leading-none" data-segmented-option-label>
      {active ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/90" aria-hidden="true" data-segmented-active-dot /> : null}
      <span>{children}</span>
    </span>
  );
}
