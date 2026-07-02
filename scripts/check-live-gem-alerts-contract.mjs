import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const alerts = await readFile("src/lib/live-gem-alerts.ts", "utf8");

assert(
  alerts.includes("export const LIVE_GEM_ALERT_THRESHOLDS = [65, 75, 85] as const;") &&
    alerts.includes('export const LIVE_GEM_ALERT_MIN_NO_HIT_INNINGS = 5;') &&
    alerts.includes('export const LIVE_GEM_ALERT_STRIKEOUT_MILESTONE = 10;'),
  "live gem alerts must use named thresholds for GS+, no-hit depth, and strikeout milestones",
);

assert(
  alerts.includes('export type LiveGemAlertType =') &&
    alerts.includes('"GS_PLUS_65"') &&
    alerts.includes('"GS_PLUS_75"') &&
    alerts.includes('"GS_PLUS_85"') &&
    alerts.includes('"NO_HITTER_THROUGH_5"') &&
    alerts.includes('"PERFECT_GAME_THROUGH_5"') &&
    alerts.includes('"TEN_STRIKEOUTS"'),
  "live gem alerts must cover GS+ crossings, no-hit/perfect candidates, and 10 strikeouts",
);

assert(
  alerts.includes('export function evaluateLiveGemAlerts(') &&
    alerts.includes('const previousByStart = new Map(previousRows.map((row) => [row.startId, row]));') &&
    alerts.includes("crossedGsPlusThreshold(row, previous, threshold)") &&
    alerts.includes("previous.gsPlus < threshold"),
  "live gem GS+ alerts must be rising crossings against previous poll state, not repeated threshold snapshots",
);

assert(
  alerts.includes('return row.scoreLabel === "PROV" && row.status === "live";') &&
    alerts.includes("inningsFromIP(row.line.inningsPitched) >= LIVE_GEM_ALERT_MIN_NO_HIT_INNINGS && row.line.hits === 0") &&
    alerts.includes("isNoHitterCandidate(row) && row.line.walks === 0") &&
    alerts.includes("row.line.strikeouts >= LIVE_GEM_ALERT_STRIKEOUT_MILESTONE"),
  "live gem alerts must only inspect live provisional rows and must gate no-hit, perfect candidate, and strikeout alerts from the line",
);

assert(
  alerts.includes("export function liveGemAlertDedupeKey(") &&
    alerts.includes("`live-gem:${row.startId}:${row.gamePk}:${row.pitcherMlbId}:${type}`") &&
    alerts.includes("dedupeKey: liveGemAlertDedupeKey(row, type),"),
  "live gem alerts must expose stable event-specific dedupe keys",
);

assert(
  alerts.includes("has a perfect-game candidate through 5 innings") &&
    !alerts.includes("perfect game through 5 innings with"),
  "perfect-game copy must stay candid about current data limits by using candidate language",
);

console.log("live gem alerts contract ok: evaluator thresholds, rising crossings, line gates, and dedupe keys are pinned");
