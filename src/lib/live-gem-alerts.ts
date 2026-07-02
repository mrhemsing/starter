import type { LiveScoreboardRow } from "@/lib/data/live-scoreboard-service";
import { inningsFromIP } from "@/lib/innings";

export const LIVE_GEM_ALERT_THRESHOLDS = [65, 75, 85] as const;
export const LIVE_GEM_ALERT_MIN_NO_HIT_INNINGS = 5;
export const LIVE_GEM_ALERT_STRIKEOUT_MILESTONE = 10;

export type LiveGemAlertType =
  | "GS_PLUS_65"
  | "GS_PLUS_75"
  | "GS_PLUS_85"
  | "NO_HITTER_THROUGH_5"
  | "PERFECT_GAME_THROUGH_5"
  | "TEN_STRIKEOUTS";

export type LiveGemAlertEvent = {
  id: string;
  type: LiveGemAlertType;
  dedupeKey: string;
  startId: string;
  gamePk: number;
  pitcherId: string;
  pitcherName: string;
  team: string;
  opponent: string;
  gsPlus: number | null;
  href: string;
  message: string;
};

export function evaluateLiveGemAlerts(
  rows: LiveScoreboardRow[],
  previousRows: LiveScoreboardRow[] = [],
): LiveGemAlertEvent[] {
  const previousByStart = new Map(previousRows.map((row) => [row.startId, row]));
  const events: LiveGemAlertEvent[] = [];

  for (const row of rows) {
    if (!isLiveAlertEligible(row)) continue;
    const previous = previousByStart.get(row.startId);

    for (const threshold of LIVE_GEM_ALERT_THRESHOLDS) {
      if (crossedGsPlusThreshold(row, previous, threshold)) {
        events.push(buildAlertEvent(row, `GS_PLUS_${threshold}` as LiveGemAlertType));
      }
    }

    if (isNoHitterCandidate(row)) {
      events.push(buildAlertEvent(row, "NO_HITTER_THROUGH_5"));
    }

    if (isPerfectGameCandidate(row)) {
      events.push(buildAlertEvent(row, "PERFECT_GAME_THROUGH_5"));
    }

    if (row.line.strikeouts >= LIVE_GEM_ALERT_STRIKEOUT_MILESTONE) {
      events.push(buildAlertEvent(row, "TEN_STRIKEOUTS"));
    }
  }

  return events;
}

export function liveGemAlertDedupeKey(row: Pick<LiveScoreboardRow, "startId" | "gamePk" | "pitcherMlbId">, type: LiveGemAlertType) {
  return `live-gem:${row.startId}:${row.gamePk}:${row.pitcherMlbId}:${type}`;
}

function isLiveAlertEligible(row: LiveScoreboardRow) {
  return row.scoreLabel === "PROV" && row.status === "live";
}

function crossedGsPlusThreshold(row: LiveScoreboardRow, previous: LiveScoreboardRow | undefined, threshold: (typeof LIVE_GEM_ALERT_THRESHOLDS)[number]) {
  if (row.gsPlus === null || row.gsPlus < threshold) return false;
  return previous?.gsPlus === null || previous?.gsPlus === undefined || previous.gsPlus < threshold;
}

function isNoHitterCandidate(row: LiveScoreboardRow) {
  return inningsFromIP(row.line.inningsPitched) >= LIVE_GEM_ALERT_MIN_NO_HIT_INNINGS && row.line.hits === 0;
}

function isPerfectGameCandidate(row: LiveScoreboardRow) {
  return isNoHitterCandidate(row) && row.line.walks === 0;
}

function buildAlertEvent(row: LiveScoreboardRow, type: LiveGemAlertType): LiveGemAlertEvent {
  return {
    id: liveGemAlertDedupeKey(row, type),
    type,
    dedupeKey: liveGemAlertDedupeKey(row, type),
    startId: row.startId,
    gamePk: row.gamePk,
    pitcherId: row.pitcherId,
    pitcherName: row.pitcherName,
    team: row.team,
    opponent: row.opponent,
    gsPlus: row.gsPlus,
    href: row.startHref,
    message: liveGemAlertMessage(row, type),
  };
}

function liveGemAlertMessage(row: LiveScoreboardRow, type: LiveGemAlertType) {
  const score = row.gsPlus === null ? "live" : `GS+ ${Math.round(row.gsPlus)}`;

  if (type === "GS_PLUS_65") return `${row.pitcherName} has crossed GS+ 65 live against ${row.opponent}.`;
  if (type === "GS_PLUS_75") return `${row.pitcherName} has crossed GS+ 75 live against ${row.opponent}.`;
  if (type === "GS_PLUS_85") return `${row.pitcherName} has crossed GS+ 85 live against ${row.opponent}.`;
  if (type === "NO_HITTER_THROUGH_5") return `${row.pitcherName} has a no-hit bid through 5 innings with ${score}.`;
  if (type === "PERFECT_GAME_THROUGH_5") return `${row.pitcherName} has a perfect-game candidate through 5 innings with ${score}.`;
  return `${row.pitcherName} has reached ${LIVE_GEM_ALERT_STRIKEOUT_MILESTONE} strikeouts with ${score}.`;
}
