"use client";

import { useState } from "react";
import Link from "next/link";
import { FollowPitcherButton } from "@/components/follow-pitcher-button";
import { PitcherAvailabilityNote } from "@/components/pitcher-availability";
import { tierLabel } from "@/components/form-visuals";
import { hasQualifiedFormSummarySample, LIMITED_SAMPLE_FORM_LABEL } from "@/components/limited-sample-form-chip";
import { pitcherHref, sourceParams } from "@/lib/routes";
import type { FormSummary } from "@/lib/types";

type WatchlistSuggestedFollowsProps = {
  results: FormSummary[];
  followedIds: string[];
  query: string;
};

const DISMISSED_KEY = "toe-the-slab-watchlist-suggestions-dismissed";

export function WatchlistSuggestedFollows({ results, followedIds, query }: WatchlistSuggestedFollowsProps) {
  const [dismissed, setDismissed] = useState(() => typeof window !== "undefined" && window.localStorage.getItem(DISMISSED_KEY) === "1");
  const followed = new Set(followedIds);
  const isSuggestionMode = query.length === 0;
  const visibleResults = results.filter((pitcher) => !followed.has(pitcher.pitcherId));

  function dismiss() {
    window.localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  function restore() {
    window.localStorage.removeItem(DISMISSED_KEY);
    setDismissed(false);
  }

  if (visibleResults.length === 0) {
    if (!query) return null;
    return <p className="mt-3 text-sm text-zinc-500">No pitcher matches for &quot;{query}&quot;.</p>;
  }

  if (isSuggestionMode && dismissed) {
    return (
      <div className="mt-4 border-t border-white/10 pt-3">
        <button type="button" onClick={restore} className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 hover:text-amber-200">
          Suggestions
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 border-t border-white/10 pt-4" data-responsive-check="watchlist-follow-search-results">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{query ? "Search results" : "Suggested follows"}</p>
        {isSuggestionMode ? (
          <button type="button" onClick={dismiss} className="inline-flex min-h-8 min-w-8 items-center justify-center rounded border border-white/10 text-zinc-500 hover:border-amber-300/40 hover:text-amber-200" aria-label="Dismiss suggested follows">
            ×
          </button>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {visibleResults.map((pitcher) => (
          <div key={pitcher.pitcherId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded border border-white/10 bg-black/20 p-3">
            <Link href={pitcherHref(pitcher, sourceParams("watchlist"))} className="min-w-0">
              <p className="truncate font-serif text-lg font-bold text-zinc-50">{pitcher.name}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{pitcher.team} · {hasQualifiedFormSummarySample(pitcher) ? `${tierLabel(pitcher.tier)} ${Math.round(pitcher.rgs)}` : `${LIMITED_SAMPLE_FORM_LABEL} ${Math.round(pitcher.rgs)}`}</p>
              <PitcherAvailabilityNote availability={pitcher.availability} compact className="mt-2" />
            </Link>
            <FollowPitcherButton pitcherId={pitcher.pitcherId} pitcherName={pitcher.name} initialFollowing={followed.has(pitcher.pitcherId)} compact refreshOnChange />
          </div>
        ))}
      </div>
    </div>
  );
}
