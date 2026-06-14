"use client";

import { useState } from "react";

type FollowPitcherButtonProps = {
  pitcherId: string;
  pitcherName: string;
  initialFollowing?: boolean;
  compact?: boolean;
};

export function FollowPitcherButton({ pitcherId, pitcherName, initialFollowing = false, compact = false }: FollowPitcherButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    const next = !following;
    setPending(true);
    setFollowing(next);
    try {
      const response = await fetch("/api/watchlist", {
        method: next ? "POST" : "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pitcherId }),
      });
      if (!response.ok) throw new Error("watchlist update failed");
    } catch {
      setFollowing(!next);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`inline-flex items-center rounded border font-mono uppercase tracking-[0.14em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:opacity-60 ${following ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 text-zinc-300 hover:border-amber-300/40 hover:text-amber-300"} ${compact ? "min-h-8 px-2 text-[10px]" : "min-h-11 px-3 text-xs"}`}
      aria-pressed={following}
      aria-label={`${following ? "Unfollow" : "Follow"} ${pitcherName}`}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
