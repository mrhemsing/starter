import type { LiveScoreboard, LiveScoreboardRow } from "@/lib/data/live-scoreboard-service";
import { RANKED_START_IP_FLOOR } from "@/lib/start-classification";

export const HOME_LIVE_LEADER_FLOOR = 50;
export const HOME_LIVE_LEADER_MIN_INNINGS = RANKED_START_IP_FLOOR;

export type HomeLiveLeaderSignature = {
  startId: string;
  gsPlus: number;
  scoreLabel: "PROV" | "FINAL";
};

export function resolveHomeLiveLeaderRow(board: LiveScoreboard | null): LiveScoreboardRow | null {
  if (!board?.hasGames) return null;

  return [...board.rows]
    .filter(isHomeLiveLeaderEligibleRow)
    .sort(compareHomeLiveLeaderRows)[0] ?? null;
}

export function homeLiveLeaderSignature(row: LiveScoreboardRow | null): HomeLiveLeaderSignature | null {
  if (!row || row.gsPlus === null || row.scoreLabel === "PROJ") return null;
  return {
    startId: row.startId,
    gsPlus: row.gsPlus,
    scoreLabel: row.scoreLabel,
  };
}

function compareHomeLiveLeaderRows(a: LiveScoreboardRow, b: LiveScoreboardRow) {
  const scoreDelta = (b.gsPlus ?? Number.NEGATIVE_INFINITY) - (a.gsPlus ?? Number.NEGATIVE_INFINITY);
  if (scoreDelta !== 0) return scoreDelta;
  return new Date(a.firstPitch).getTime() - new Date(b.firstPitch).getTime();
}

function isHomeLiveLeaderEligibleRow(row: LiveScoreboardRow) {
  return row.scoreLabel !== "PROJ"
    && row.gsPlus !== null
    && row.gsPlus >= HOME_LIVE_LEADER_FLOOR
    && row.outingStatus !== "short";
}
