"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

export function EntityOrientation({
  sourceLabel,
  sourceShortLabel,
  sourceHref,
  entityLabel,
}: {
  sourceLabel: string;
  sourceShortLabel?: string;
  sourceHref: string;
  entityLabel: string;
}) {
  const router = useRouter();

  function handleBack(event: MouseEvent<HTMLAnchorElement>) {
    if (typeof window === "undefined" || window.history.length <= 1) return;
    const state = window.history.state as { idx?: number } | null;
    const hasNextAppHistory = typeof state?.idx === "number" && state.idx > 0;
    if (!hasNextAppHistory && !document.referrer) return;

    if (!hasNextAppHistory) {
      try {
        const referrer = new URL(document.referrer);
        if (referrer.origin !== window.location.origin) return;
      } catch {
        return;
      }
    }

    event.preventDefault();
    router.back();
  }

  return (
    <nav className="mb-5 font-mono text-xs uppercase tracking-[0.16em]" aria-label="Entity orientation" data-responsive-check="entity-orientation">
      <Link
        href={sourceHref}
        onClick={handleBack}
        className="inline-flex min-h-11 max-w-full items-center rounded border border-amber-300/40 px-3 py-2 text-amber-300 transition hover:border-amber-200 hover:text-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        data-entity-back-control="true"
        data-entity-source-label={sourceLabel}
      >
        <span className="hidden sm:inline">← Back to {sourceLabel}</span>
        <span className="sm:hidden">← {sourceShortLabel ?? sourceLabel}</span>
      </Link>
      <ol className="mt-3 flex min-w-0 flex-wrap items-center gap-2 text-[10px] text-zinc-500" aria-label="Breadcrumb">
        <li>
          <Link href={sourceHref} className="text-zinc-400 hover:text-amber-300">
            {sourceLabel}
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li className="min-w-0 max-w-full truncate text-zinc-300" aria-current="page">
          {entityLabel}
        </li>
      </ol>
    </nav>
  );
}
