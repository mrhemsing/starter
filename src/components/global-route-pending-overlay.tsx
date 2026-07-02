"use client";

import { useEffect, useRef, useState } from "react";
import { ROUTE_PENDING_EVENT, type RoutePendingDetail } from "@/lib/route-pending-event";

const PENDING_DELAY_MS = 900;
const PENDING_TIMEOUT_MS = 12000;

type PendingCopy = {
  label: string;
  secondary: string;
};

const defaultCopy: PendingCopy = {
  label: "Loading page",
  secondary: "Fetching data...",
};

export function GlobalRoutePendingOverlay() {
  const [copy, setCopy] = useState<PendingCopy>(defaultCopy);
  const [visible, setVisible] = useState(false);
  const delayRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const pendingFromRef = useRef<string | null>(null);

  useEffect(() => {
    const clearTimers = () => {
      if (delayRef.current !== null) window.clearTimeout(delayRef.current);
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      delayRef.current = null;
      timeoutRef.current = null;
    };

    const clearPending = () => {
      clearTimers();
      pendingFromRef.current = null;
      setVisible(false);
      setCopy(defaultCopy);
    };

    const onPending = (event: Event) => {
      const detail = event instanceof CustomEvent ? (event.detail as RoutePendingDetail | undefined) : undefined;
      clearTimers();
      pendingFromRef.current = window.location.href;
      setCopy({
        label: detail?.label ?? defaultCopy.label,
        secondary: detail?.secondary ?? defaultCopy.secondary,
      });
      delayRef.current = window.setTimeout(() => setVisible(true), PENDING_DELAY_MS);
      timeoutRef.current = window.setTimeout(clearPending, PENDING_TIMEOUT_MS);
    };

    window.addEventListener(ROUTE_PENDING_EVENT, onPending);
    const locationCheck = window.setInterval(() => {
      if (pendingFromRef.current && window.location.href !== pendingFromRef.current) clearPending();
    }, 100);
    return () => {
      window.removeEventListener(ROUTE_PENDING_EVENT, onPending);
      window.clearInterval(locationCheck);
      clearTimers();
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[240] flex items-center justify-center bg-[#08080a]/72 px-4 backdrop-blur-sm" role="status" aria-live="polite" aria-busy="true" data-responsive-check="global-route-pending">
      <div className="flex min-h-24 w-full max-w-sm items-center gap-4 rounded border border-white/10 bg-[#101014]/95 px-5 py-4 shadow-2xl shadow-black/40">
        <span className="route-loading-spinner" aria-hidden="true" />
        <span>
          <span className="block font-mono text-xs uppercase tracking-[0.18em] text-zinc-300">{copy.label}</span>
          <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">{copy.secondary}</span>
        </span>
      </div>
    </div>
  );
}
