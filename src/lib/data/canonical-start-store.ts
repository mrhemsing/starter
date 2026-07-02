import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { canonicalStartRecordFromSummary, diffCanonicalStartRecord, reconcileCanonicalStartRecord, startSummaryFromCanonicalRecord } from "@/lib/canonical-start-record";
import type { CanonicalStartRecord } from "@/lib/canonical-start-record";
import type { StartDataSource, StartSummary } from "@/lib/types";

type CanonicalStartStoreFile = {
  date: string;
  updatedAt: string;
  records: CanonicalStartRecord[];
};

const CANONICAL_START_STORE_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), "toe-the-slab", "canonical-starts")
  : path.join(process.cwd(), ".data", "canonical-starts");
const NEXT_PRODUCTION_BUILD_PHASE = "phase-production-build";

export async function canonicalizeStartSummariesWithStore(date: string, starts: StartSummary[], now = new Date()): Promise<StartSummary[]> {
  if (shouldSkipCanonicalStartStore(starts)) {
    return starts.map((start) => startSummaryFromCanonicalRecord(canonicalStartRecordFromSummary(start, now), start));
  }

  try {
    const store = await readCanonicalStartStore(date);
    const recordsById = new Map(store.records.map((record) => [record.id, record]));
    const canonicalStarts = starts.map((start) => {
      const next = upsertCanonicalStartRecord(recordsById.get(start.id), start, now);
      recordsById.set(start.id, next);
      return startSummaryFromCanonicalRecord(next, start);
    });

    await writeCanonicalStartStore({
      date,
      updatedAt: now.toISOString(),
      records: Array.from(recordsById.values()).sort(compareCanonicalStartRecords),
    });

    return canonicalStarts;
  } catch (error) {
    if (!isCanonicalStoreUnavailableError(error)) throw error;
    return starts.map((start) => startSummaryFromCanonicalRecord(canonicalStartRecordFromSummary(start, now), start));
  }
}

export async function readCanonicalStartRecords(date: string): Promise<CanonicalStartRecord[]> {
  return (await readCanonicalStartStore(date)).records;
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

async function readCanonicalStartStore(date: string): Promise<CanonicalStartStoreFile> {
  try {
    const raw = await fs.readFile(canonicalStartStorePath(date), "utf8");
    const parsed = JSON.parse(raw) as CanonicalStartStoreFile;
    return {
      date,
      updatedAt: parsed.updatedAt ?? new Date(0).toISOString(),
      records: Array.isArray(parsed.records) ? parsed.records : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return { date, updatedAt: new Date(0).toISOString(), records: [] };
  }
}

async function writeCanonicalStartStore(store: CanonicalStartStoreFile) {
  await fs.mkdir(CANONICAL_START_STORE_DIR, { recursive: true });
  await fs.writeFile(canonicalStartStorePath(store.date), `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function canonicalStartStorePath(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("invalid canonical start store date");
  return path.join(CANONICAL_START_STORE_DIR, `${date}.json`);
}

function shouldSkipCanonicalStartStore(starts: StartSummary[]) {
  return process.env.NEXT_PHASE === NEXT_PRODUCTION_BUILD_PHASE
    || starts.length === 0
    || starts.every((start) => start.source?.line === "fixture");
}

function officialCanonicalLineSource(source: StartDataSource["line"]): Extract<StartDataSource["line"], "archive-gamefeed" | "live-gamefeed"> {
  return source === "live-gamefeed" ? "live-gamefeed" : "archive-gamefeed";
}

function isCanonicalStoreUnavailableError(error: unknown) {
  const code = (error as NodeJS.ErrnoException).code;
  return code === "EACCES" || code === "EPERM" || code === "EROFS";
}

function compareCanonicalStartRecords(a: CanonicalStartRecord, b: CanonicalStartRecord) {
  return a.date.localeCompare(b.date) || a.gamePk - b.gamePk || a.pitcherMlbId - b.pitcherMlbId;
}
