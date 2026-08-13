"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useHomeLiveBoard } from "@/components/home-live-board-provider";
import { evaluateActiveLiveGemAlerts } from "@/lib/live-gem-alerts";

export function HomeLiveGemAlerts() {
  const { board, boardUnverified } = useHomeLiveBoard();
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const alerts = useMemo(() => {
    if (!board || boardUnverified) return [];
    return evaluateActiveLiveGemAlerts(board.rows).filter((alert) => !dismissed.has(alert.id)).slice(0, 3);
  }, [board, boardUnverified, dismissed]);

  if (alerts.length === 0) return null;

  return (
    <section className="mt-3 grid gap-2" aria-label="Live gem alerts" data-home-live-gem-alert-count={alerts.length}>
      {alerts.map((alert) => (
        <article key={alert.id} className="flex items-start justify-between gap-3 rounded border border-[#FF5A1F]/40 bg-[#FF5A1F]/10 px-3 py-3 shadow-[0_0_24px_rgba(255,90,31,0.12)]">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#FF9A62]">Live gem alert</p>
            <Link href={alert.href} className="mt-1 block font-serif text-lg font-bold leading-tight text-zinc-50 hover:text-amber-300">
              {alert.message}
            </Link>
          </div>
          <button
            type="button"
            className="shrink-0 rounded border border-white/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 hover:border-white/30 hover:text-zinc-100"
            onClick={() => setDismissed((current) => new Set([...current, alert.id]))}
            aria-label={`Dismiss live gem alert for ${alert.pitcherName}`}
          >
            Close
          </button>
        </article>
      ))}
    </section>
  );
}
