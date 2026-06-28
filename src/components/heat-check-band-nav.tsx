"use client";

import { useEffect, useMemo, useState } from "react";
import type { HeatBand } from "@/lib/types";

type BandWithCount = HeatBand & { count: number };

export function HeatCheckBandNav({ bands }: { bands: BandWithCount[] }) {
  const visibleBands = useMemo(() => bands.filter((band) => band.count > 0), [bands]);
  const [activeBand, setActiveBand] = useState(visibleBands[0]?.key ?? "");
  const active = visibleBands.find((band) => band.key === activeBand) ?? visibleBands[0] ?? null;

  useEffect(() => {
    if (visibleBands.length === 0) return;

    const updateActiveBand = () => {
      const headers = visibleBands
        .map((band) => ({
          band,
          element: document.querySelector<HTMLElement>(`[data-heat-band-header="${band.key}"]`),
        }))
        .filter((entry): entry is { band: BandWithCount; element: HTMLElement } => Boolean(entry.element));
      if (headers.length === 0) return;

      const targetY = Math.max(96, window.innerHeight * 0.22);
      const current = headers.reduce((winner, entry) => {
        const top = entry.element.getBoundingClientRect().top;
        if (top <= targetY && top > winner.top) return { band: entry.band, top };
        return winner;
      }, { band: headers[0].band, top: Number.NEGATIVE_INFINITY });
      const fallback = headers.find((entry) => entry.element.getBoundingClientRect().top > targetY)?.band ?? headers.at(-1)?.band;
      setActiveBand((current.top === Number.NEGATIVE_INFINITY ? fallback : current.band)?.key ?? visibleBands[0].key);
    };

    updateActiveBand();
    window.addEventListener("scroll", updateActiveBand, { passive: true });
    window.addEventListener("resize", updateActiveBand);

    return () => {
      window.removeEventListener("scroll", updateActiveBand);
      window.removeEventListener("resize", updateActiveBand);
    };
  }, [visibleBands]);

  return (
    <MobileBandJumper bands={visibleBands} active={active} />
  );
}

function MobileBandJumper({ bands, active }: { bands: BandWithCount[]; active: BandWithCount | null }) {
  return (
    <nav className="z-10 col-span-full -mx-1 flex self-start overflow-x-auto rounded border border-white/10 bg-[#101014]/95 p-2 font-mono text-[10px] uppercase tracking-[0.14em] backdrop-blur lg:hidden" aria-label="Jump to heat band" data-temperature-job="mobile-jump" data-active-heat-band={active?.key ?? ""}>
      {bands.map((band) => {
        const selected = active?.key === band.key;
        return (
          <a key={band.key} href={`#band-${band.key}`} className={`shrink-0 rounded border px-2 py-2 ${selected ? "text-zinc-50" : "border-white/10 text-zinc-200"}`} style={{ borderColor: selected ? band.color : `${band.color}66` }} aria-current={selected ? "location" : undefined}>
            {band.label}
          </a>
        );
      })}
    </nav>
  );
}
