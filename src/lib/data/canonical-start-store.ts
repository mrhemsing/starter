import { canonicalStartRecordFromSummary, diffCanonicalStartRecord, reconcileCanonicalStartRecord, startSummaryFromCanonicalRecord } from "@/lib/canonical-start-record";
import type { CanonicalStartRecord } from "@/lib/canonical-start-record";
import type { StartDataSource, StartSummary } from "@/lib/types";

type CanonicalStartStoreFile = {
  date: string;
  updatedAt: string;
  records: CanonicalStartRecord[];
};

const NEXT_PRODUCTION_BUILD_PHASE = "phase-production-build";
const volatileCanonicalStartStores = new Map<string, CanonicalStartStoreFile>();

export async function canonicalizeStartSummariesWithStore(date: string, starts: StartSummary[], now = new Date()): Promise<StartSummary[]> {
  if (shouldSkipCanonicalStartStore(starts)) {
    return starts.map((start) => startSummaryFromCanonicalRecord(canonicalStartRecordFromSummary(start, now), start));
  }

  const store = readCanonicalStartStore(date);
  const recordsById = new Map(store.records.map((record) => [record.id, record]));
  const canonicalStarts = starts.map((start) => {
    const next = upsertCanonicalStartRecord(recordsById.get(start.id), start, now);
    recordsById.set(start.id, next);
    return startSummaryFromCanonicalRecord(next, start);
  });

  writeCanonicalStartStore({
    date,
    updatedAt: now.toISOString(),
    records: Array.from(recordsById.values()).sort(compareCanonicalStartRecords),
  });

  return canonicalStarts;
}

export async function readCanonicalStartRecords(date: string): Promise<CanonicalStartRecord[]> {
  return readCanonicalStartStore(date).records;
}

function upsertCanonicalStartRecord(existing: CanonicalStartRecord | undefined, start: StartSummary, now: Date) {
  const next = canonicalStartRecordFromSummary(start, now);

  if (!existing) return next;

  if (existing.frozen) {
    if (next.status !== "final") return existing;

    const diffs = diffCanonicalStartRecord(existing, next.line, next.gameScorePlus);
    return diffs.length > 0
      ? reconcileCanonicalStartRecord(existing, {
        line: next.line,
        gameScorePlus: next.gameScorePlus,
        gameScoreV2: next.gameScoreV2,
        gameScorePlusBreakdown: next.gameScorePlusBreakdown,
        source: officialCanonicalLineSource(next.source.line),
      }, now)
      : existing;
  }

  if (next.status === "final") {
    return reconcileCanonicalStartRecord(existing, {
      line: next.line,
      gameScorePlus: next.gameScorePlus,
      gameScoreV2: next.gameScoreV2,
      gameScorePlusBreakdown: next.gameScorePlusBreakdown,
      source: officialCanonicalLineSource(next.source.line),
    }, now);
  }

  const changed = existing.status !== next.status
    || existing.source.line !== next.source.line
    || diffCanonicalStartRecord(existing, next.line, next.gameScorePlus).length > 0;

  if (!changed) return existing;

  return {
    ...next,
    createdAt: existing.createdAt,
    audit: [
      ...existing.audit,
      ...next.audit.filter((entry) => entry.event !== "created"),
    ],
  };
}

function readCanonicalStartStore(date: string): CanonicalStartStoreFile {
  assertCanonicalStartStoreDate(date);
  return volatileCanonicalStartStores.get(date) ?? emptyCanonicalStartStore(date);
}

function writeCanonicalStartStore(store: CanonicalStartStoreFile) {
  assertCanonicalStartStoreDate(store.date);
  volatileCanonicalStartStores.set(store.date, store);
}

function emptyCanonicalStartStore(date: string): CanonicalStartStoreFile {
  return { date, updatedAt: new Date(0).toISOString(), records: [] };
}

function assertCanonicalStartStoreDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("invalid canonical start store date");
}

function shouldSkipCanonicalStartStore(starts: StartSummary[]) {
  return process.env.NEXT_PHASE === NEXT_PRODUCTION_BUILD_PHASE
    || starts.length === 0
    || starts.every((start) => start.source?.line === "fixture");
}

function officialCanonicalLineSource(source: StartDataSource["line"]): Extract<StartDataSource["line"], "archive-gamefeed" | "live-gamefeed"> {
  return source === "live-gamefeed" ? "live-gamefeed" : "archive-gamefeed";
}

function compareCanonicalStartRecords(a: CanonicalStartRecord, b: CanonicalStartRecord) {
  return a.date.localeCompare(b.date) || a.gamePk - b.gamePk || a.pitcherMlbId - b.pitcherMlbId;
}
