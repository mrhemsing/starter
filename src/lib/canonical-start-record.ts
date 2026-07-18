import { roundToScorePrecision, SCORE_DISPLAY_PRECISION } from "@/lib/score-display";
import { calculateGameScoreV2 } from "@/lib/game-score-v2";
import type { StartApiGameScorePlusBreakdown, StartContext, StartDataSource, StartEventFlag, StartLine, StartNarrativeNotables, StartSummary } from "@/lib/types";

export type CanonicalStartStatus = "scheduled" | "live" | "final";

export type CanonicalStartAuditEntry = {
  at: string;
  event: "created" | "live-updated" | "final-reconciled" | "final-correction" | "context-freeze-sweep";
  source: StartDataSource["line"];
  note: string;
  diffs?: CanonicalStartLineDiff[];
};

export type CanonicalStartLineDiff = {
  field: keyof StartLine | "gameScorePlus" | "gameScoreV2" | "result" | "venue" | "narrativeNotables";
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
  side?: "home" | "away" | null;
  venue?: string;
  status: CanonicalStartStatus;
  line: StartLine;
  gameScorePlus: number;
  gameScoreV2: number;
  eventFlags: StartEventFlag[];
  narrativeNotables?: StartNarrativeNotables;
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

export type CanonicalSettledRecordValidationIssue = {
  field: "gameScoreV2" | "venue";
  message: string;
  expected?: number | string;
  actual?: number | string;
};

const FALLBACK_START_SOURCE: StartDataSource = {
  schedule: "fixture",
  line: "fixture",
  ranking: "schedule-derived-fixture-line",
};

const BANNED_VENUE_WORDS = /\b(canonical|context|fixture|slate|settle|stored|pipeline|cache|snapshot|source|implementation)\b/i;
const KNOWN_MLB_VENUES = new Set([
  "Angel Stadium",
  "American Family Field",
  "Busch Stadium",
  "Chase Field",
  "Citi Field",
  "Citizens Bank Park",
  "Comerica Park",
  "Coors Field",
  "Daikin Park",
  "Dodger Stadium",
  "Estadio Alfredo Harp Helu",
  "Fenway Park",
  "George M. Steinbrenner Field",
  "Globe Life Field",
  "Great American Ball Park",
  "Guaranteed Rate Field",
  "Kauffman Stadium",
  "Las Vegas Ballpark",
  "loanDepot park",
  "Minute Maid Park",
  "Nationals Park",
  "Oracle Park",
  "Oriole Park at Camden Yards",
  "Petco Park",
  "PNC Park",
  "Progressive Field",
  "Rate Field",
  "Rogers Centre",
  "T-Mobile Park",
  "Target Field",
  "Tropicana Field",
  "Truist Park",
  "Sutter Health Park",
  "UNIQLO Field at Dodger Stadium",
  "Wrigley Field",
  "Yankee Stadium",
]);

export function canonicalStartRecordFromSummary(start: StartSummary, now = new Date()): CanonicalStartRecord {
  const source = start.source ?? FALLBACK_START_SOURCE;
  const timestamp = now.toISOString();
  const final = source.line === "archive-gamefeed" || source.lineStatus === "final";
  const live = source.line === "live-gamefeed";
  const gameScorePlus = roundToScorePrecision(start.gameScorePlus, SCORE_DISPLAY_PRECISION.gameScorePlus);
  const gameScoreV2 = start.gameScoreV2 ?? calculateGameScoreV2(start.line);
  const eventFlags = start.eventFlags ?? deriveStartEventFlags(start.result, gameScorePlus);

  const record: CanonicalStartRecord = {
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
    narrativeNotables: normalizeNarrativeNotables(start.narrativeNotables),
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
  assertValidCanonicalSettledRecord(record);
  return record;
}

export function startSummaryFromCanonicalRecord(record: CanonicalStartRecord, start: StartSummary): StartSummary {
  return {
    ...start,
    line: record.line,
    gameScorePlus: record.gameScorePlus,
    gameScoreV2: record.gameScoreV2,
    eventFlags: record.eventFlags,
    narrativeNotables: record.narrativeNotables,
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
    narrativeNotables?: StartNarrativeNotables;
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
  const diffs = diffCanonicalStartRecord(record, official.line, gameScorePlus, gameScoreV2, result, venue, official.narrativeNotables);
  const contextSnapshot = official.contextSnapshot ?? record.contextSnapshot;
  const narrativeNotables = normalizeNarrativeNotables(official.narrativeNotables ?? record.narrativeNotables);

  const nextRecord: CanonicalStartRecord = {
    ...record,
    status: "final",
    line: official.line,
    venue,
    gameScorePlus,
    gameScoreV2,
    eventFlags,
    narrativeNotables,
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
  assertValidCanonicalSettledRecord(nextRecord);
  return nextRecord;
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
  return value.replace(/\s*context at settle\.?/gi, "").trim();
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
  officialNarrativeNotables?: StartNarrativeNotables,
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

  if (!sameStableJson(record.narrativeNotables, normalizeNarrativeNotables(officialNarrativeNotables ?? record.narrativeNotables))) {
    diffs.push({ field: "narrativeNotables", before: stableJson(record.narrativeNotables), after: stableJson(normalizeNarrativeNotables(officialNarrativeNotables)) });
  }

  return diffs;
}

export function diffCanonicalStartNarrativeNotables(record: CanonicalStartRecord, narrativeNotables?: StartNarrativeNotables): CanonicalStartLineDiff[] {
  if (sameStableJson(record.narrativeNotables, normalizeNarrativeNotables(narrativeNotables))) return [];
  return [{ field: "narrativeNotables", before: stableJson(record.narrativeNotables), after: stableJson(normalizeNarrativeNotables(narrativeNotables)) }];
}

function normalizeNarrativeNotables(notables: StartNarrativeNotables | undefined) {
  if (!notables) return undefined;
  const normalized: StartNarrativeNotables = {};
  if (notables.noHitDepth && notables.noHitDepth.innings >= 5) normalized.noHitDepth = notables.noHitDepth;
  if (notables.perfectDepth && notables.perfectDepth.innings >= 5) normalized.perfectDepth = notables.perfectDepth;
  if (notables.strikeouts?.doubleDigit) normalized.strikeouts = { doubleDigit: true };
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function stableJson(value: unknown) {
  return value === undefined ? undefined : JSON.stringify(value);
}

function sameStableJson(left: unknown, right: unknown) {
  return stableJson(left) === stableJson(right);
}

function safeCanonicalVenue(venue: string | undefined) {
  const trimmed = venue?.trim();
  if (!trimmed || BANNED_VENUE_WORDS.test(trimmed)) return undefined;
  return trimmed;
}

export function validateCanonicalSettledRecord(record: CanonicalStartRecord): CanonicalSettledRecordValidationIssue[] {
  if (record.status !== "final" && !record.frozen) return [];

  const issues: CanonicalSettledRecordValidationIssue[] = [];
  const expectedGameScoreV2 = calculateGameScoreV2(record.line);
  if (record.gameScoreV2 !== expectedGameScoreV2) {
    issues.push({
      field: "gameScoreV2",
      message: "settled canonical record GSv2 must match the shared formula",
      expected: expectedGameScoreV2,
      actual: record.gameScoreV2,
    });
  }

  const venue = safeCanonicalVenue(record.venue);
  if (!venue) {
    issues.push({
      field: "venue",
      message: "settled canonical record venue must not contain implementation vocabulary",
      expected: "known MLB venue",
      actual: record.venue,
    });
  } else if (!KNOWN_MLB_VENUES.has(venue)) {
    issues.push({
      field: "venue",
      message: "settled canonical record venue must match the known MLB venue set",
      expected: "known MLB venue",
      actual: venue,
    });
  }

  return issues;
}

export function assertValidCanonicalSettledRecord(record: CanonicalStartRecord) {
  const issues = validateCanonicalSettledRecord(record);
  if (issues.length === 0) return;
  throw new Error(`invalid settled canonical start record ${record.id}: ${issues.map((issue) => `${issue.field} ${issue.actual ?? "missing"} != ${issue.expected}`).join("; ")}`);
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
