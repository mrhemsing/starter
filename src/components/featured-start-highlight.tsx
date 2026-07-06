"use client";

import { useState } from "react";
import type { FeaturedStartHighlight } from "@/lib/types";

type FeaturedStartHighlightEmbedProps = {
  highlight: FeaturedStartHighlight;
  pitcherName: string;
  loadImmediately?: boolean;
};

export function FeaturedStartHighlightEmbed({ highlight, pitcherName, loadImmediately = false }: FeaturedStartHighlightEmbedProps) {
  const [isLoaded, setIsLoaded] = useState(loadImmediately);
  const [isHidden, setIsHidden] = useState(false);

  if (isHidden) return null;

  const shouldLoadPlayer = loadImmediately || isLoaded;
  const aspectClass = highlight.isShort ? "mx-auto aspect-[9/16] w-full max-w-[280px] sm:max-w-[320px]" : "aspect-video";

  return (
    <div className="rounded border border-white/10 bg-black/20 p-2" data-responsive-check="featured-start-highlight">
      <div className={`relative overflow-hidden rounded bg-black ${aspectClass}`}>
        {shouldLoadPlayer ? (
          <iframe
            src={highlight.embedUrl}
            title={`${pitcherName} highlight via MLB on YouTube`}
            className="absolute inset-0 h-full w-full"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            className="group absolute inset-0 block h-full w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            aria-label={`Play ${pitcherName} highlight via MLB on YouTube`}
            onClick={() => setIsLoaded(true)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={highlight.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
              onError={() => setIsHidden(true)}
            />
            <span className="absolute inset-0 bg-black/20" />
            <span className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/40 bg-black/65 text-amber-200 shadow-lg transition group-hover:scale-105">
              <span className="ml-1 h-0 w-0 border-y-[9px] border-l-[14px] border-y-transparent border-l-current" />
            </span>
          </button>
        )}
      </div>
      <a
        href={highlight.watchUrl}
        target="_blank"
        rel="noopener"
        className="mt-2 inline-flex font-mono text-[10px] tracking-[0.14em] text-zinc-500 underline-offset-4 hover:text-amber-300 hover:underline"
      >
        Highlight · MLB on YouTube
      </a>
    </div>
  );
}
