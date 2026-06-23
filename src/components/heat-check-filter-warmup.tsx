"use client";

import { useEffect } from "react";

const HEAT_WINDOWS = [3, 5, 10] as const;

type HeatCheckFilterWarmupProps = {
  activeTeam?: string;
};

export function HeatCheckFilterWarmup({ activeTeam = "" }: HeatCheckFilterWarmupProps) {
  useEffect(() => {
    const warm = () => {
      const team = activeTeam.trim().toUpperCase();
      for (const window of HEAT_WINDOWS) {
        void fetch(`/api/form/leaderboard?window=${window}`).catch(() => undefined);
        void fetch(`/api/form/leaderboard?window=${window}&qualified=false`).catch(() => undefined);
        if (team) {
          const teamParam = encodeURIComponent(team);
          void fetch(`/api/form/leaderboard?window=${window}&qualified=false&team=${teamParam}`).catch(() => undefined);
        }
        void fetch(`/api/tonight?window=${window}`).catch(() => undefined);
      }
    };

    if (activeTeam.trim()) {
      warm();
      return undefined;
    }

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(warm, { timeout: 1500 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = globalThis.setTimeout(warm, 300);
    return () => globalThis.clearTimeout(timeoutId);
  }, [activeTeam]);

  return null;
}
