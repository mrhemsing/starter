"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import { QUALITY_BANDS, qualityTierOf } from "@/lib/form-tokens";
import { formatStartLine } from "@/lib/format";
import { inningsFromIP } from "@/lib/innings";
import type { StartSummary } from "@/lib/types";

const STORAGE_KEY = "ranked-starts-shape-open";
const PANEL_EVENT = "ranked-starts-panel-open";
const LEAGUE_AVERAGE_GS_PLUS = 50;
const DESKTOP_OVERLAY_HEIGHT = 390;

type OverlayRect = {
  left: number;
  top: number;
  width: number;
};

export function RankedStartsSlateShape({
  starts,
  slateAverage,
}: {
  starts: StartSummary[];
  slateAverage: number;
}) {
  const [open, setOpen] = useState(false);
  const [overlayRect, setOverlayRect] = useState<OverlayRect | null>(null);
  const [isMobileSheet, setIsMobileSheet] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const pointerStartY = useRef<number | null>(null);

  const updatePosition = useCallback(() => {
    const panelRow = buttonRef.current?.closest<HTMLElement>("[data-responsive-check='ranked-start-controls']");
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    setIsMobileSheet(mobile);
    if (!panelRow || mobile) {
      setOverlayRect(null);
      return;
    }
    const rect = panelRow.getBoundingClientRect();
    setOverlayRect({
      left: rect.left,
      top: rect.bottom + 8,
      width: rect.width,
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    window.sessionStorage.setItem(STORAGE_KEY, "closed");
  }, []);

  const openOverlay = useCallback(() => {
    window.dispatchEvent(new CustomEvent(PANEL_EVENT, { detail: STORAGE_KEY }));
    window.sessionStorage.setItem(STORAGE_KEY, "open");
    setOpen(true);
    updatePosition();
  }, [updatePosition]);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(STORAGE_KEY) === "open";
    if (!stored) return;
    const frame = window.requestAnimationFrame(() => {
      setOpen(true);
      updatePosition();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [updatePosition]);

  useEffect(() => {
    function handlePanelEvent(event: Event) {
      if (!(event instanceof CustomEvent) || event.detail === STORAGE_KEY) return;
      close();
    }

    window.addEventListener(PANEL_EVENT, handlePanelEvent);
    return () => window.removeEventListener(PANEL_EVENT, handlePanelEvent);
  }, [close]);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(updatePosition);

    function handleKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (overlayRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close();
    }

    function handleResizeOrScroll() {
      updatePosition();
    }

    document.addEventListener("keydown", handleKeydown);
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleResizeOrScroll);
    window.addEventListener("scroll", handleResizeOrScroll, true);

    return () => {
      document.removeEventListener("keydown", handleKeydown);
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleResizeOrScroll);
      window.removeEventListener("scroll", handleResizeOrScroll, true);
      window.cancelAnimationFrame(frame);
    };
  }, [close, open, updatePosition]);

  useEffect(() => {
    if (!open || !isMobileSheet) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileSheet, open]);

  const overlayStyle: React.CSSProperties = isMobileSheet
    ? { height: "70vh" }
    : {
        left: overlayRect?.left ?? 0,
        top: overlayRect?.top ?? 0,
        width: overlayRect?.width ?? "100%",
        height: DESKTOP_OVERLAY_HEIGHT,
      };

  return (
    <div className="min-w-0 rounded border border-white/10 bg-[#101014]" data-responsive-check="ranked-starts-shape-overlay-control">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="ranked-starts-shape-overlay"
        className="group flex min-h-11 w-full cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-left font-mono text-xs uppercase tracking-[0.14em] text-zinc-300 outline-none transition hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-300"
        data-ranked-starts-shape-chip
        data-ranked-starts-shape-active={open ? "true" : "false"}
        onClick={() => {
          if (open) close();
          else openOverlay();
        }}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-amber-300">Slate shape</span>
          <span className="truncate text-[10px] text-zinc-500">Scatter</span>
        </span>
        <span
          className={`grid h-6 w-6 shrink-0 place-items-center rounded border font-mono text-sm leading-none transition ${
            open ? "border-amber-300/60 text-amber-300" : "border-white/15 text-zinc-400 group-hover:border-amber-300/60 group-hover:text-amber-300"
          }`}
          aria-hidden="true"
        >
          {open ? "\u2212" : "+"}
        </span>
      </button>
      {open ? (
        <div
          ref={overlayRef}
          id="ranked-starts-shape-overlay"
          role="dialog"
          aria-modal={isMobileSheet ? "true" : "false"}
          aria-label="Expanded slate shape chart"
          className={`z-40 overflow-hidden border border-amber-300/25 bg-[#101014] shadow-2xl shadow-black/50 ${
            isMobileSheet
              ? "fixed inset-x-0 bottom-0 rounded-t-2xl"
              : "fixed rounded"
          }`}
          style={overlayStyle}
          data-responsive-check="ranked-starts-shape-overlay"
          data-ranked-starts-shape-overlay-height={isMobileSheet ? "70vh" : String(DESKTOP_OVERLAY_HEIGHT)}
          onPointerDown={(event) => {
            pointerStartY.current = event.clientY;
          }}
          onPointerUp={(event) => {
            if (!isMobileSheet || pointerStartY.current === null) return;
            if (event.clientY - pointerStartY.current > 80) close();
            pointerStartY.current = null;
          }}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300">Slate shape</p>
                <p className="mt-1 text-xs text-zinc-500">GS+ by innings pitched</p>
              </div>
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded border border-white/10 font-mono text-sm text-zinc-300 transition hover:border-amber-300 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                aria-label="Close slate shape"
                onClick={close}
              >
                ×
              </button>
            </div>
            <div className="min-h-0 flex-1 px-3 pb-3 pt-2 sm:px-4">
              <SlateShapeChart starts={starts} slateAverage={slateAverage} onSelect={close} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SlateShapeChart({
  starts,
  slateAverage,
  onSelect,
}: {
  starts: StartSummary[];
  slateAverage: number;
  onSelect: () => void;
}) {
  const width = 920;
  const height = 300;
  const pad = { left: 48, right: 30, top: 30, bottom: 42 };
  const maxInnings = Math.max(9, ...starts.map((start) => inningsFromIP(start.line.inningsPitched)));
  const xFor = (score: number) => pad.left + (clamp(score, 20, 80) - 20) / 60 * (width - pad.left - pad.right);
  const yFor = (innings: number) => pad.top + ((maxInnings - innings) / maxInnings) * (height - pad.top - pad.bottom);
  const bandCounts = QUALITY_BANDS.map((band) => ({
    ...band,
    count: starts.filter((start) => qualityTierOf(start.gameScorePlus).label === band.label).length,
  })).filter((band) => band.count > 0);
  const points = [...starts]
    .sort((a, b) => a.rank - b.rank)
    .map((start) => {
      const seed = stableHash(start.pitcher.id || start.id);
      const xDodge = ((seed % 5) - 2) * 2.8;
      const yDodge = ((Math.floor(seed / 5) % 5) - 2) * 2.8;
      const innings = inningsFromIP(start.line.inningsPitched);
      return {
        start,
        innings,
        x: clamp(xFor(start.gameScorePlus) + xDodge, pad.left + 10, width - pad.right - 10),
        y: clamp(yFor(innings) + yDodge, pad.top + 10, height - pad.bottom - 10),
      };
    });
  const labeledPointIds = new Set(starts.slice(0, 3).map((start) => start.id));

  function selectStart(startId: string) {
    onSelect();
    window.setTimeout(() => {
      const target = document.getElementById(startId);
      if (!target) return;
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      target.setAttribute("data-slate-shape-highlight", "true");
      window.setTimeout(() => target.removeAttribute("data-slate-shape-highlight"), 2000);
    }, 0);
  }

  return (
    <div className="grid h-full min-h-0 gap-2" data-ranked-starts-shape-point-count={points.length}>
      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
        <span>Click or focus a point to jump to the row</span>
        <div className="flex flex-wrap gap-2" aria-label="Slate shape band legend" data-ranked-starts-shape-legend>
          {bandCounts.map((band) => (
            <span key={band.key} className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: band.color }} />
              {band.label} {band.count}
            </span>
          ))}
        </div>
      </div>
      <svg className="min-h-0 w-full flex-1" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${starts.length} ranked starts distributed by GS+ and innings pitched`}>
        <rect x={pad.left} y={pad.top} width={width - pad.left - pad.right} height={height - pad.top - pad.bottom} fill="#0b0b0e" opacity="0.72" style={{ pointerEvents: "none" }} />
        {[20, 35, 50, 65, 80].map((tick) => (
          <g key={`x-${tick}`}>
            <line x1={xFor(tick)} x2={xFor(tick)} y1={pad.top} y2={height - pad.bottom} stroke="#27272a" style={{ pointerEvents: "none" }} />
            <text x={xFor(tick)} y={height - 16} textAnchor="middle" fill="#71717a" fontSize="11" style={{ pointerEvents: "none" }}>{tick}</text>
          </g>
        ))}
        {[0, 3, 6, 9].map((tick) => (
          <g key={`y-${tick}`}>
            <line x1={pad.left} x2={width - pad.right} y1={yFor(tick)} y2={yFor(tick)} stroke="#27272a" style={{ pointerEvents: "none" }} />
            <text x={pad.left - 12} y={yFor(tick) + 4} textAnchor="end" fill="#71717a" fontSize="11" style={{ pointerEvents: "none" }}>{tick}</text>
          </g>
        ))}
        <line x1={pad.left} x2={width - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} stroke="#3f3f46" style={{ pointerEvents: "none" }} />
        <line x1={pad.left} x2={pad.left} y1={pad.top} y2={height - pad.bottom} stroke="#3f3f46" style={{ pointerEvents: "none" }} />
        <line x1={xFor(LEAGUE_AVERAGE_GS_PLUS)} x2={xFor(LEAGUE_AVERAGE_GS_PLUS)} y1={pad.top} y2={height - pad.bottom} stroke="#d4d4d8" strokeDasharray="6 5" opacity="0.78" style={{ pointerEvents: "none" }} />
        <text x={Math.min(width - 126, xFor(LEAGUE_AVERAGE_GS_PLUS) + 8)} y={pad.top + 15} fill="#d4d4d8" fontSize="12" style={{ pointerEvents: "none" }}>LEAGUE AVG {LEAGUE_AVERAGE_GS_PLUS.toFixed(1)}</text>
        <line x1={xFor(slateAverage)} x2={xFor(slateAverage)} y1={pad.top} y2={height - pad.bottom} stroke="#f59e0b" strokeDasharray="3 5" opacity="0.9" style={{ pointerEvents: "none" }} />
        <text x={Math.min(width - 118, xFor(slateAverage) + 8)} y={pad.top + 31} fill="#fbbf24" fontSize="12" style={{ pointerEvents: "none" }}>SLATE AVG {slateAverage.toFixed(1)}</text>
        <text x={(pad.left + width - pad.right) / 2} y={height - 4} textAnchor="middle" fill="#71717a" fontSize="11" fontFamily="monospace" style={{ pointerEvents: "none" }}>GS+</text>
        <text x="14" y={(pad.top + height - pad.bottom) / 2} textAnchor="middle" fill="#71717a" fontSize="11" fontFamily="monospace" transform={`rotate(-90 14 ${(pad.top + height - pad.bottom) / 2})`} style={{ pointerEvents: "none" }}>IP</text>
        {points.map(({ start, x, y }) => {
          const band = qualityTierOf(start.gameScorePlus);
          const shouldLabel = labeledPointIds.has(start.id);
          const labelX = Math.min(width - 96, Math.max(pad.left + 8, x + (start.rank <= 2 ? 14 : -68)));
          const labelY = Math.min(height - pad.bottom - 10, Math.max(pad.top + 16, y + (start.rank <= 2 ? -14 : 22)));
          const ariaLabel = `${start.rank} of ${starts.length}, ${start.pitcher.name}, ${start.pitcher.team}, GS+ ${start.gameScorePlus}, ${formatStartLine(start.line)}`;
          return (
            <g key={start.id}>
              <a
                href={`#${start.id}`}
                aria-label={ariaLabel}
                onClick={(event) => {
                  event.preventDefault();
                  selectStart(start.id);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  selectStart(start.id);
                }}
              >
                <circle cx={x} cy={y} r="22" fill="transparent" stroke="transparent">
                  <title>{`${start.pitcher.name} / ${start.pitcher.team} / GS+ ${start.gameScorePlus} / ${formatStartLine(start.line)}`}</title>
                </circle>
                <circle cx={x} cy={y} r={start.rank <= 3 ? 8.8 : 7.2} fill={band.color} stroke="#08080a" strokeWidth="2" style={{ pointerEvents: "none" }} />
              </a>
              {shouldLabel ? (
                <>
                  <line x1={x} y1={y} x2={labelX} y2={labelY + 4} stroke={band.color} strokeOpacity="0.65" style={{ pointerEvents: "none" }} />
                  <text x={labelX} y={labelY} fill={band.color} fontSize="11" fontWeight="700" style={{ pointerEvents: "none" }}>{lastName(start.pitcher.name)}</text>
                </>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function stableHash(value: string) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function lastName(name: string) {
  return name.trim().split(/\s+/).at(-1) ?? name;
}
