import { roundToScorePrecision, SCORE_DISPLAY_PRECISION } from "@/lib/score-display";
import { calculateGameScoreV2 } from "@/lib/game-score-v2";
import type { StartApiGameScorePlusBreakdown, StartContext, StartDataSource, StartEventFlag, StartLine, StartSummary } from "@/lib/types";

export type CanonicalStartStatus = "scheduled" | "live" | "final";

export type CanonicalStartAuditEntry = {
  at: string;
  event: "created" | "live-updated" | "final-reconciled" | "final-correction" | "context-freeze-sweep";
  source: StartDataSource["line"];
  note: string;
  diffs?: CanonicalStartLineDiff[];
};

export type CanonicalStartLineDiff = {
  field: keyof StartLine | "gameScorePlus" | "gameScoreV2" | "result" | "venue";
  before: number | string | undefined;
  after: number | string | undefined;
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
  venue?: string;
  status: CanonicalStartStatus;
  line: StartLine;
  gameScorePlus: number;
  gameScoreV2: number;
  eventFlags: StartEventFlag[];
  gameScorePlusBreakdown?: StartApiGameScorePlusBreakdown;
  contextSnapshot?: StartContext;
  result: StartSummary["result"];
  source: StartDataSource;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
  frozen: boolean;
  audit: CanonicalStartAuditEntry[];
};

export type CanonicalReconciliationReport = {
  date: string;
  totalRecords: number;
  finalRecords: number;
  frozenRecords: number;
  reconciledFinalRecords: number;
  correctionRecords: number;
  correctionDiffs: CanonicalStartLineDiff[];
  latestAuditAt: string | null;
};

const FALLBACK_START_SOURCE: StartDataSource = {
  schedule: "fixture",
  line: "fixture",
  ranking: "schedule-derived-fixture-line",
};

export function canonicalStartRecordFromSummary(start: StartSummary, now = new Date()): CanonicalStartRecord {
  const source = start.source ?? FALLBACK_START_SOURCE;
  const timestamp = now.toISOString();
  const final = source.line === "archive-gamefeed" || source.lineStatus === "final";
  const live = source.line === "live-gamefeed";
  const gameScorePlus = roundToScorePrecision(start.gameScorePlus, SCORE_DISPLAY_PRECISION.gameScorePlus);
  const gameScoreV2 = start.gameScoreV2 ?? calculateGameScoreV2(start.line);
  const eventFlags = start.eventFlags ?? deriveStartEventFlags(start.result, gameScorePlus);

  return {
    id: start.id,
    gamePk: start.gamePk,
    date: start.date,
    pitcherMlbId: start.pitcher.mlbId,
    pitcherName: start.pitcher.name,
    team: start.pitcher.team,
    opponent: start.opponent,
    side: start.side,
    venue: safeCanonicalVenue(start.context.parkLabel),
    status: final ? "final" : live ? "live" : "scheduled",
    line: start.line,
    gameScorePlus,
    gameScoreV2,
    eventFlags,
    gameScorePlusBreakdown: start.gameScorePlusBreakdown ? freezeGameScorePlusBreakdown(start.gameScorePlusBreakdown, gameScorePlus, final) : undefined,
    contextSnapshot: final ? freezeStartContextSnapshot(start.context) : undefined,
    result: start.result,
    source,
    createdAt: timestamp,
    updatedAt: timestamp,
    finalizedAt: final ? timestamp : null,
    frozen: final,
    audit: [
      {
        at: timestamp,
        event: final ? "final-reconciled" : live ? "live-updated" : "created",
        source: source.line,
        note: final
          ? "Canonical record reflects a reconciled completed starter line."
          : live
            ? "Canonical record reflects a provisional live starter line."
            : "Canonical record reflects a scheduled starter projection.",
      },
    ],
  };
}

export function startSummaryFromCanonicalRecord(record: CanonicalStartRecord, start: StartSummary): StartSummary {
  return {
    ...start,
    line: record.line,
    gameScorePlus: record.gameScorePlus,
    gameScoreV2: record.gameScoreV2,
    eventFlags: record.eventFlags,
    gameScorePlusBreakdown: record.gameScorePlusBreakdown,
    result: record.result,
    source: record.source,
    context: {
      ...(record.contextSnapshot ?? start.context),
      ...(record.venue ? { parkLabel: record.venue } : {}),
    },
  };
}

export function canonicalizeStartSummary(start: StartSummary, now = new Date()) {
  return startSummaryFromCanonicalRecord(canonicalStartRecordFromSummary(start, now), start);
}

export function canonicalizeStartSummaries(starts: StartSummary[], now = new Date()) {
  return starts.map((start) => canonicalizeStartSummary(start, now));
}

export function reconcileCanonicalStartRecord(
  record: CanonicalStartRecord,
  official: {
    line: StartLine;
    gameScorePlus: number;
    gameScoreV2?: number;
    gameScorePlusBreakdown?: StartApiGameScorePlusBreakdown;
    contextSnapshot?: StartContext;
    result?: StartSummary["result"];
    venue?: string;
    source: Extract<StartDataSource["line"], "archive-gamefeed" | "live-gamefeed">;
  },
  now = new Date(),
): CanonicalStartRecord {
  const timestamp = now.toISOString();
  const gameScorePlus = roundToScorePrecision(official.gameScorePlus, SCORE_DISPLAY_PRECISION.gameScorePlus);
  const gameScoreV2 = official.gameScoreV2 ?? calculateGameScoreV2(official.line);
  const result = official.result ?? record.result;
  const venue = safeCanonicalVenue(official.venue) ?? record.venue;
  const eventFlags = deriveStartEventFlags(result, gameScorePlus);
  const diffs = diffCanonicalStartRecord(record, official.line, gameScorePlus, gameScoreV2, result, venue);
  const contextSnapshot = official.contextSnapshot ?? record.contextSnapshot;

  return {
    ...record,
    status: "final",
    line: official.line,
    venue,
    gameScorePlus,
    gameScoreV2,
    eventFlags,
    gameScorePlusBreakdown: official.gameScorePlusBreakdown ? freezeGameScorePlusBreakdown(official.gameScorePlusBreakdown, gameScorePlus, true) : record.gameScorePlusBreakdown,
    contextSnapshot: contextSnapshot ? freezeStartContextSnapshot(contextSnapshot) : record.contextSnapshot,
    result,
    source: {
      ...record.source,
      line: official.source,
      lineStatus: "final",
      ranking: official.source === "archive-gamefeed" ? "schedule-derived-archive-line" : "schedule-derived-gamefeed-line",
    },
    updatedAt: timestamp,
    finalizedAt: record.finalizedAt ?? timestamp,
    frozen: true,
    audit: [
      ...record.audit,
      {
        at: timestamp,
        event: record.frozen && diffs.length > 0 ? "final-correction" : "final-reconciled",
        source: official.source,
        note: diffs.length > 0 ? "Canonical final record reconciled with an explicit line or score diff." : "Canonical final record reconciled with no line or score diff.",
        ...(diffs.length > 0 ? { diffs } : {}),
      },
    ],
  };
}

function freezeStartContextSnapshot(context: StartContext): StartContext {
  return {
    ...context,
    opponentQualityLabel: labelContextAtSettle(context.opponentQualityLabel),
    opponentOffenseLabel: labelContextAtSettle(context.opponentOffenseLabel),
  };
}

function freezeGameScorePlusBreakdown(breakdown: StartApiGameScorePlusBreakdown, total: number, frozen: boolean): StartApiGameScorePlusBreakdown {
  return {
    ...breakdown,
    total,
    components: breakdown.components.map((component) => {
      if (!frozen || !["whiffDelta", "velocityDelta", "parkContext", "opponentQuality", "opponentOffense", "calibration"].includes(component.key)) return component;
      return {
        ...component,
        label: labelContextAtSettle(component.label),
        description: labelContextAtSettle(component.description),
      };
    }),
    rankingReasons: breakdown.rankingReasons.map((component) => {
      if (!frozen || !["whiffDelta", "velocityDelta", "parkContext", "opponentQuality", "opponentOffense", "calibration"].includes(component.key)) return component;
      return {
        ...component,
        label: labelContextAtSettle(component.label),
        description: labelContextAtSettle(component.description),
      };
    }),
  };
}

function labelContextAtSettle(value: string) {
  return /\bcontext at settle\b/i.test(value) ? value : `${value} Context at settle.`;
}

export function deriveStartEventFlags(result: StartSummary["result"], gameScorePlus: number): StartEventFlag[] {
  if ((result === "L" || result === "ND") && gameScorePlus >= 60) return ["HARD_LUCK"];
  if (result === "W" && gameScorePlus <= 35) return ["VULTURE"];
  return [];
}

export function diffCanonicalStartRecord(
  record: CanonicalStartRecord,
  officialLine: StartLine,
  officialGameScorePlus: number,
  officialGameScoreV2 = calculateGameScoreV2(officialLine),
  officialResult?: StartSummary["result"],
  officialVenue?: string,
): CanonicalStartLineDiff[] {
  const diffs: CanonicalStartLineDiff[] = [];
  const fields: Array<keyof StartLine> = ["inningsPitched", "hits", "earnedRuns", "runsAllowed", "homeRunsAllowed", "walks", "strikeouts", "pitches"];

  for (const field of fields) {
    if (record.line[field] === undefined && officialLine[field] === undefined) continue;
    if (record.line[field] !== officialLine[field]) {
      diffs.push({ field, before: record.line[field], after: officialLine[field] });
    }
  }

  if (record.gameScorePlus !== officialGameScorePlus) {
    diffs.push({ field: "gameScorePlus", before: record.gameScorePlus, after: officialGameScorePlus });
  }

  if (record.gameScoreV2 !== officialGameScoreV2) {
    diffs.push({ field: "gameScoreV2", before: record.gameScoreV2, after: officialGameScoreV2 });
  }

  if (officialResult && record.result !== officialResult) {
    diffs.push({ field: "result", before: record.result, after: officialResult });
  }

  if (officialVenue && record.venue !== officialVenue) {
    diffs.push({ field: "venue", before: record.venue, after: officialVenue });
  }

  return diffs;
}

function safeCanonicalVenue(venue: string | undefined) {
  const trimmed = venue?.trim();
  if (!trimmed || /\b(canonical|slate|fixture)\b/i.test(trimmed)) return undefined;
  return trimmed;
}

export function summarizeCanonicalReconciliation(date: string, records: CanonicalStartRecord[]): CanonicalReconciliationReport {
  const finalRecords = records.filter((record) => record.status === "final");
  const correctionAuditEntries = records.flatMap((record) => record.audit.filter((entry) => entry.event === "final-correction"));
  const correctionDiffs = correctionAuditEntries.flatMap((entry) => entry.diffs ?? []);
  const auditTimes = records.flatMap((record) => record.audit.map((entry) => entry.at)).sort();

  return {
    date,
    totalRecords: records.length,
    finalRecords: finalRecords.length,
    frozenRecords: records.filter((record) => record.frozen).length,
    reconciledFinalRecords: records.filter((record) => record.audit.some((entry) => entry.event === "final-reconciled")).length,
    correctionRecords: records.filter((record) => record.audit.some((entry) => entry.event === "final-correction")).length,
    correctionDiffs,
    latestAuditAt: auditTimes.at(-1) ?? null,
  };
}
