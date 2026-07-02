import { roundToScorePrecision, SCORE_DISPLAY_PRECISION } from "@/lib/score-display";
import type { StartApiGameScorePlusBreakdown, StartDataSource, StartLine, StartSummary } from "@/lib/types";

export type CanonicalStartStatus = "scheduled" | "final";

export type CanonicalStartAuditEntry = {
  at: string;
  event: "created" | "final-reconciled";
  source: StartDataSource["line"];
  note: string;
};

export type CanonicalStartRecord = {
  id: string;
  gamePk: number;
  date: string;
  pitcherMlbId: number;
  pitcherName: string;
  team: string;
  opponent: string;
  side?: "home" | "away";
  status: CanonicalStartStatus;
  line: StartLine;
  gameScorePlus: number;
  gameScorePlusBreakdown?: StartApiGameScorePlusBreakdown;
  result: StartSummary["result"];
  source: StartDataSource;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  frozen: boolean;
  audit: CanonicalStartAuditEntry[];
};

const FALLBACK_START_SOURCE: StartDataSource = {
  schedule: "fixture",
  line: "fixture",
  ranking: "schedule-derived-fixture-line",
};

export function canonicalStartRecordFromSummary(start: StartSummary, now = new Date()): CanonicalStartRecord {
  const source = start.source ?? FALLBACK_START_SOURCE;
  const timestamp = now.toISOString();
  const final = source.line === "archive-gamefeed" || source.line === "live-gamefeed";
  const gameScorePlus = roundToScorePrecision(start.gameScorePlus, SCORE_DISPLAY_PRECISION.gameScorePlus);

  return {
    id: start.id,
    gamePk: start.gamePk,
    date: start.date,
    pitcherMlbId: start.pitcher.mlbId,
    pitcherName: start.pitcher.name,
    team: start.pitcher.team,
    opponent: start.opponent,
    side: start.side,
    status: final ? "final" : "scheduled",
    line: start.line,
    gameScorePlus,
    gameScorePlusBreakdown: start.gameScorePlusBreakdown ? { ...start.gameScorePlusBreakdown, total: gameScorePlus } : undefined,
    result: start.result,
    source,
    createdAt: timestamp,
    updatedAt: timestamp,
    finalizedAt: final ? timestamp : null,
    frozen: final,
    audit: [
      {
        at: timestamp,
        event: final ? "final-reconciled" : "created",
        source: source.line,
        note: final ? "Canonical record reflects a reconciled completed starter line." : "Canonical record reflects a scheduled starter projection.",
      },
    ],
  };
}

export function startSummaryFromCanonicalRecord(record: CanonicalStartRecord, start: StartSummary): StartSummary {
  return {
    ...start,
    line: record.line,
    gameScorePlus: record.gameScorePlus,
    gameScorePlusBreakdown: record.gameScorePlusBreakdown,
    result: record.result,
    source: record.source,
  };
}

export function canonicalizeStartSummary(start: StartSummary, now = new Date()) {
  return startSummaryFromCanonicalRecord(canonicalStartRecordFromSummary(start, now), start);
}

export function canonicalizeStartSummaries(starts: StartSummary[], now = new Date()) {
  return starts.map((start) => canonicalizeStartSummary(start, now));
}
