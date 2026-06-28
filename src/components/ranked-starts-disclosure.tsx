"use client";

import { useEffect, useRef } from "react";
import type React from "react";

export function RankedStartsDisclosure({
  storageKey,
  label,
  meta,
  children,
  className = "",
  panelClassName = "",
}: {
  storageKey: string;
  label: string;
  meta?: string;
  children: React.ReactNode;
  className?: string;
  panelClassName?: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const details = detailsRef.current;
    if (!details) return;
    details.open = window.sessionStorage.getItem(storageKey) === "open";
  }, [storageKey]);

  return (
    <details
      ref={detailsRef}
      className={`group rounded border border-white/10 bg-[#101014] ${className}`}
      onToggle={(event) => {
        const nextOpen = event.currentTarget.open;
        window.sessionStorage.setItem(storageKey, nextOpen ? "open" : "closed");
      }}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-zinc-300 outline-none transition hover:border-amber-300 hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-300 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-amber-300">{label}</span>
          {meta ? <span className="truncate text-[10px] text-zinc-500">{meta}</span> : null}
        </span>
        <span className="text-zinc-500 transition group-open:rotate-180" aria-hidden="true">v</span>
      </summary>
      <div className={`border-t border-white/10 p-3 ${panelClassName}`}>{children}</div>
    </details>
  );
}
