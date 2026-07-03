"use client";

import type React from "react";
import { useEffect, useState, useTransition } from "react";

const PENDING_EVENT = "route-control-pending";
const PENDING_CLEAR_EVENT = "route-control-pending-clear";
const PENDING_MIN_MS = 150;
const PENDING_MAX_MS = 8000;

type RouteControlPendingDetail = {
  href: string;
  from: string;
  region?: string;
};

export function useRouteControlPending({
  href,
  currentHref,
  active,
  region,
}: {
  href: string;
  currentHref: string;
  active?: boolean;
  region?: string;
}) {
  const [isTransitionPending, startTransition] = useTransition();
  const [intent, setIntent] = useState<RouteControlPendingDetail | null>(null);
  const pending = !active && intent?.href === href && intent.from === currentHref;

  useEffect(() => {
    if (!intent) return;
    const timer = window.setTimeout(() => setIntent(null), PENDING_MAX_MS);
    return () => window.clearTimeout(timer);
  }, [intent]);

  useEffect(() => {
    if (pending || isTransitionPending) return;
    window.dispatchEvent(new CustomEvent(PENDING_CLEAR_EVENT, { detail: { region } }));
  }, [isTransitionPending, pending, region]);

  const beginPending = (callback?: () => void) => {
    if (href === currentHref) {
      callback?.();
      return;
    }

    const detail = { href, from: currentHref, region };
    setIntent(detail);
    window.dispatchEvent(new CustomEvent(PENDING_EVENT, { detail }));
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(PENDING_CLEAR_EVENT, { detail: { region } }));
    }, PENDING_MIN_MS);
    startTransition(() => {
      callback?.();
    });
  };

  return { pending: pending || isTransitionPending, beginPending };
}

export function PendingRegion({ region, className, children }: { region: string; className?: string; children: React.ReactNode }) {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let minTimer: number | null = null;
    let maxTimer: number | null = null;

    const clear = () => {
      if (minTimer !== null) window.clearTimeout(minTimer);
      minTimer = window.setTimeout(() => setPending(false), PENDING_MIN_MS);
    };
    const onPending = (event: Event) => {
      const detail = (event as CustomEvent<RouteControlPendingDetail>).detail;
      if (detail?.region && detail.region !== region) return;
      setPending(true);
      if (maxTimer !== null) window.clearTimeout(maxTimer);
      maxTimer = window.setTimeout(() => setPending(false), PENDING_MAX_MS);
    };
    const onClear = (event: Event) => {
      const detail = (event as CustomEvent<{ region?: string }>).detail;
      if (detail?.region && detail.region !== region) return;
      clear();
    };

    window.addEventListener(PENDING_EVENT, onPending);
    window.addEventListener(PENDING_CLEAR_EVENT, onClear);
    return () => {
      window.removeEventListener(PENDING_EVENT, onPending);
      window.removeEventListener(PENDING_CLEAR_EVENT, onClear);
      if (minTimer !== null) window.clearTimeout(minTimer);
      if (maxTimer !== null) window.clearTimeout(maxTimer);
    };
  }, [region]);

  return (
    <div className={className} data-route-pending-region={region} data-route-pending={pending ? "true" : "false"}>
      {children}
    </div>
  );
}
