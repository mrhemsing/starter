"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type FollowPitcherButtonProps = {
  pitcherId: string;
  pitcherName: string;
  initialFollowing?: boolean;
  compact?: boolean;
  labeled?: boolean;
  refreshOnChange?: boolean;
};

const followState = new Map<string, boolean>();
let followStateHydration: Promise<void> | null = null;

const FOLLOW_STATE_EVENT = "toe-the-slab-follow-state";

type FollowStateEvent = CustomEvent<{ pitcherId: string; following: boolean }>;

export function FollowPitcherButton({ pitcherId, pitcherName, initialFollowing = false, compact = false, labeled = false, refreshOnChange = false }: FollowPitcherButtonProps) {
  const router = useRouter();
  const [following, setFollowing] = useState(() => initialFollowing || (followState.get(pitcherId) ?? false));
  const [error, setError] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);
  const [pending, setPending] = useState(false);
  const latestIntent = useRef(initialFollowing);
  const persisted = useRef(initialFollowing);
  const requestInFlight = useRef(false);

  useEffect(() => {
    if (initialFollowing || !followState.has(pitcherId)) {
      followState.set(pitcherId, initialFollowing || (followState.get(pitcherId) ?? false));
    }
    const current = initialFollowing || (followState.get(pitcherId) ?? false);
    latestIntent.current = current;
    persisted.current = current;

    function onFollowStateChange(event: Event) {
      const detail = (event as FollowStateEvent).detail;
      if (detail.pitcherId !== pitcherId) return;
      latestIntent.current = detail.following;
      setFollowing(detail.following);
      setPulse(true);
    }

    window.addEventListener(FOLLOW_STATE_EVENT, onFollowStateChange);
    void hydrateFollowState();
    return () => window.removeEventListener(FOLLOW_STATE_EVENT, onFollowStateChange);
  }, [initialFollowing, pitcherId]);

  useEffect(() => {
    if (!pulse) return;
    const timer = window.setTimeout(() => setPulse(false), 360);
    return () => window.clearTimeout(timer);
  }, [pulse]);

  function setSharedFollowing(next: boolean) {
    followState.set(pitcherId, next);
    latestIntent.current = next;
    setFollowing(next);
    setPulse(true);
    window.dispatchEvent(new CustomEvent(FOLLOW_STATE_EVENT, { detail: { pitcherId, following: next } }));
  }

  async function persistIntent(target: boolean) {
    try {
      const response = await fetch("/api/watchlist", {
        method: target ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pitcherId }),
      });
      if (!response.ok) throw new Error("watchlist update failed");
      persisted.current = target;
      setError(null);
      if (refreshOnChange) router.refresh();
    } catch {
      latestIntent.current = persisted.current;
      setSharedFollowing(persisted.current);
      setError("Could not update watchlist.");
      return;
    }

    if (latestIntent.current !== target) {
      await persistIntent(latestIntent.current);
    }
  }

  async function toggle() {
    const next = !latestIntent.current;
    setSharedFollowing(next);

    if (requestInFlight.current) return;

    requestInFlight.current = true;
    setPending(true);
    await persistIntent(next);
    requestInFlight.current = false;
    setPending(false);
  }

  const tooltip = following ? "Following" : "Follow";
  const label = `${following ? "Following" : "Follow"} ${pitcherName}`;
  const iconSize = compact ? 18 : 20;

  return (
    <span className="relative inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={toggle}
        className={`group/follow relative inline-flex min-h-11 min-w-11 items-center justify-center rounded border font-mono uppercase tracking-[0.14em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 ${following ? "border-amber-300/80 bg-amber-300/10 text-amber-300 hover:bg-amber-300/15" : "border-white/10 text-zinc-400 hover:border-amber-300/40 hover:text-amber-300"} ${labeled ? "gap-2 px-3 text-xs" : "px-0"} ${compact && !labeled ? "text-[10px]" : "text-xs"} ${pending ? "opacity-80" : ""}`}
        aria-pressed={following}
        aria-label={label}
        title={tooltip}
      >
        <StarIcon filled={following} size={iconSize} className={pulse ? "follow-star-pulse" : ""} />
        {labeled ? <span>{tooltip}</span> : null}
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-950 px-2 py-1 text-[10px] font-medium normal-case tracking-normal text-zinc-100 opacity-0 shadow-lg ring-1 ring-white/10 transition group-hover/follow:opacity-100 group-focus-visible/follow:opacity-100"
        >
          {tooltip}
        </span>
      </button>
      {error ? <span className="max-w-36 text-right text-[10px] leading-tight text-amber-300" role="status">{error}</span> : null}
    </span>
  );
}

async function hydrateFollowState() {
  followStateHydration ??= fetch("/api/watchlist", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) return;
      const view = await response.json() as { pitcherIds?: string[] };
      const ids = Array.isArray(view.pitcherIds) ? view.pitcherIds.map(String) : [];
      for (const pitcherId of ids) {
        followState.set(pitcherId, true);
        window.dispatchEvent(new CustomEvent(FOLLOW_STATE_EVENT, { detail: { pitcherId, following: true } }));
      }
    })
    .catch(() => undefined);

  return followStateHydration;
}

function StarIcon({ filled, size, className }: { filled: boolean; size: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`shrink-0 transition ${className ?? ""}`}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 2.8 2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.36l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93L12 2.8Z" />
    </svg>
  );
}
