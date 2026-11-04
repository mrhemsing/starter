"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { FeaturedStartHighlightEmbed } from "@/components/featured-start-highlight";
import type { FeaturedStartHighlight } from "@/lib/types";

type HeatHighlightModalProps = {
  highlight: FeaturedStartHighlight;
  pitcherName: string;
  date?: string;
  label?: string;
  eyebrow?: string;
  className?: string;
};

export function HeatHighlightModal({ highlight, pitcherName, date, label, eyebrow = "Recent MLB highlight", className }: HeatHighlightModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();
  const modalRoot = typeof document === "undefined" ? null : document.body;
  const buttonLabel = label ?? "";
  const compact = label === undefined;
  const attribution = highlight.source === "mlb-game-content" ? "MLB" : "MLB on YouTube";

  return (
    <>
      <button
        type="button"
        className={compact ? "group relative inline-grid aspect-video w-20 shrink-0 place-items-center overflow-hidden rounded border border-amber-300/35 bg-black text-amber-200 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:w-28" : className}
        data-highlight-thumbnail={compact ? "true" : undefined}
        aria-label={compact ? `Watch highlight: ${pitcherName}${date ? `, ${date}` : ""}` : `Open ${pitcherName} MLB highlight`}
        title={`Highlight · ${attribution}`}
        onClick={() => setIsOpen(true)}
      >
        {compact ? <Image src={highlight.thumbnailUrl.replace("maxresdefault.jpg", "hqdefault.jpg")} alt="" fill sizes="(min-width: 640px) 112px, 80px" className="object-cover opacity-80 transition group-hover:opacity-100" /> : null}
        <svg aria-hidden="true" viewBox="0 0 24 24" className={compact ? "relative z-10 h-7 w-7 rounded bg-black/70 p-1" : "h-4 w-4"} fill="currentColor">
          <path d="M8 5.8v12.4L18.2 12 8 5.8Z" />
        </svg>
        {buttonLabel ? <span>{buttonLabel}</span> : null}
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
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-300">{eyebrow}</p>
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
            <FeaturedStartHighlightEmbed highlight={highlight} pitcherName={pitcherName} loadImmediately />
          </div>
        </div>,
        modalRoot,
      ) : null}
    </>
  );
}
