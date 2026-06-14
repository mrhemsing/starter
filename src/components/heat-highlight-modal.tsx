"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { FeaturedStartHighlightEmbed } from "@/components/featured-start-highlight";
import type { FeaturedStartHighlight } from "@/lib/types";

type HeatHighlightModalProps = {
  highlight: FeaturedStartHighlight;
  pitcherName: string;
};

export function HeatHighlightModal({ highlight, pitcherName }: HeatHighlightModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const modalRoot = typeof document === "undefined" ? null : document.body;

  return (
    <>
      <button
        type="button"
        className="relative z-40 inline-grid h-8 w-8 place-items-center rounded-full border border-amber-300/35 bg-black/45 text-amber-200 shadow-sm transition hover:border-amber-300/70 hover:bg-amber-300/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        aria-label={`Open ${pitcherName} MLB highlight`}
        title="MLB highlight"
        onClick={() => setIsOpen(true)}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <path d="M8 5.8v12.4L18.2 12 8 5.8Z" />
        </svg>
      </button>

      {isOpen && modalRoot ? createPortal(
        <div
          className="fixed inset-0 z-[1000] grid place-items-center bg-black/75 p-3 backdrop-blur-sm sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={() => setIsOpen(false)}
        >
          <div className="relative max-h-[calc(100svh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded border border-white/10 bg-[#101014] p-3 shadow-2xl sm:p-4" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 pr-12">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-300">Recent MLB highlight</p>
                <h3 id={titleId} className="mt-1 font-serif text-2xl font-bold leading-none text-zinc-50 sm:text-3xl">{pitcherName}</h3>
              </div>
              <button
                type="button"
                className="absolute right-3 top-3 grid h-10 w-10 shrink-0 place-items-center rounded border border-white/10 bg-black/60 font-mono text-lg text-zinc-300 shadow-lg hover:border-white/30 hover:text-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:right-4 sm:top-4"
                aria-label="Close highlight"
                onClick={() => setIsOpen(false)}
              >
                ×
              </button>
            </div>
            <FeaturedStartHighlightEmbed highlight={highlight} pitcherName={pitcherName} />
          </div>
        </div>,
        modalRoot,
      ) : null}
    </>
  );
}
