"use client";

import { useMemo, useSyncExternalStore } from "react";

export function LocalTime({ value, fallback }: { value: string; fallback: string }) {
  const label = useSyncExternalStore(
    subscribe,
    () => formatBrowserTime(value, fallback),
    () => fallback,
  );
  const title = useMemo(() => formatBrowserTime(value, fallback, "long"), [fallback, value]);

  return (
    <time dateTime={value} title={title} suppressHydrationWarning>
      {label}
    </time>
  );
}

function subscribe() {
  return () => {};
}

function formatBrowserTime(value: string, fallback: string, timeZoneName: "short" | "long" = "short") {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return fallback;

  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
      timeZoneName,
    }).format(date);
  } catch {
    return fallback;
  }
}
