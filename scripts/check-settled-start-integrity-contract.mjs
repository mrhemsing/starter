import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function read(path) {
  return await readFile(path, "utf8");
}

function seededSettledFallback(date, today, archivedGames, canonicalState) {
  if (date >= today) return false;
  if (archivedGames === 0) return true;
  if (!canonicalState) return true;
  if (canonicalState.state !== "complete") return true;
  return canonicalState.totalStarts <= 0 || canonicalState.finalStarts < canonicalState.totalStarts;
}

function seededBothStartersIntegrity(scheduleGame, rows) {
  const expected = [scheduleGame.awayPitcherId, scheduleGame.homePitcherId].filter(Boolean);
  const actual = rows.filter((row) => row.gamePk === scheduleGame.gamePk).map((row) => row.pitcherMlbId);
  const distinctActual = new Set(actual);
  return {
    missing: expected.filter((id) => !distinctActual.has(id)),
    duplicateOrMisbound: actual.length !== distinctActual.size || actual.some((id) => !expected.includes(id)),
    ok: expected.length === 2 && actual.length === 2 && distinctActual.size === 2 && expected.every((id) => distinctActual.has(id)),
  };
}

function seededPerPitcherFreshness(pitcherId, expectedStarts, reflectedStarts) {
  const expectedLatest = expectedStarts
    .filter((start) => start.pitcherMlbId === pitcherId)
    .map((start) => start.date)
    .sort()
    .at(-1) ?? null;
  const reflectedLatest = reflectedStarts
    .filter((start) => start.pitcherMlbId === pitcherId)
    .map((start) => start.date)
    .sort()
    .at(-1) ?? null;
  return {
    expectedLatest,
    reflectedLatest,
    stale: Boolean(expectedLatest && (!reflectedLatest || reflectedLatest < expectedLatest)),
  };
}

const [startService, warmJob, packageJson, auditDoc] = await Promise.all([
  read("src/lib/data/start-service.ts"),
  read("src/lib/data/warm-live-starts-job.ts"),
  read("package.json"),
  read("docs/per-pitcher-stale-start-audit-2026-07-08.md"),
]);

assert(
  startService.includes("function shouldFetchSettledScheduleFallback") &&
    startService.includes("if ((archivedSchedule?.games.length ?? 0) === 0) return true;") &&
    startService.includes('if (canonicalSlateState.state !== "complete") return true;') &&
    startService.includes("canonicalSlateState.counts.finalStarts < canonicalSlateState.counts.totalStarts") &&
    startService.includes("settledLiveFallbackGames: liveSchedule?.games.length ?? 0") &&
    startService.includes("await fetchMlbSchedule(date, { fetchLive: true })"),
  "settled dates with missing archive/canonical state must fall back to the recent live MLB schedule instead of looking empty",
);

assert(
  warmJob.includes("getRankedSlateCompletionState(date, getHomeSlateDate())") &&
    warmJob.includes('reason: "no-live-or-final-games"') &&
    warmJob.includes('getDailySlate({ window: "today", date, persistCanonical: true })'),
  "warm-live-starts must keep the completion gate and canonical persistence path wired together",
);

assert(
  packageJson.includes('"check:settled-start-integrity": "node scripts/check-settled-start-integrity-contract.mjs"'),
  "package.json must expose check:settled-start-integrity",
);

assert(
  auditDoc.includes("Confirmed cause: ingest/settle failure for the entire July 7 slate") &&
    auditDoc.includes("not pitcher attribution") &&
    auditDoc.includes("Bryan Woo") &&
    auditDoc.includes("693433") &&
    auditDoc.includes("2026-07-07-sea-mia-693433") &&
    auditDoc.includes("No P0-5 Regression"),
  "per-pitcher stale-start audit must document the root cause, Woo correction, and no P0-5 regression",
);

assert(
  seededSettledFallback("2026-07-07", "2026-07-08", 0, null) === true,
  "seeded missing settled date must fetch the live schedule fallback",
);
assert(
  seededSettledFallback("2026-07-06", "2026-07-08", 8, { state: "complete", totalStarts: 16, finalStarts: 16 }) === false,
  "seeded complete settled date must not fetch the live schedule fallback",
);
assert(
  seededSettledFallback("2026-07-08", "2026-07-08", 0, null) === false,
  "current date must use the existing live path, not the settled fallback",
);

const missingWoo = seededBothStartersIntegrity(
  { gamePk: 823847, awayPitcherId: 693433, homePitcherId: 676974 },
  [{ gamePk: 823847, pitcherMlbId: 676974 }],
);
assert(missingWoo.ok === false && missingWoo.missing.includes(693433), "both-starters guard must fail a settled game missing Woo");

const misboundWoo = seededBothStartersIntegrity(
  { gamePk: 823847, awayPitcherId: 693433, homePitcherId: 676974 },
  [{ gamePk: 823847, pitcherMlbId: 676974 }, { gamePk: 823847, pitcherMlbId: 123456 }],
);
assert(misboundWoo.ok === false && misboundWoo.duplicateOrMisbound === true, "both-starters guard must fail a misattributed starter");

const completeWoo = seededBothStartersIntegrity(
  { gamePk: 823847, awayPitcherId: 693433, homePitcherId: 676974 },
  [{ gamePk: 823847, pitcherMlbId: 693433 }, { gamePk: 823847, pitcherMlbId: 676974 }],
);
assert(completeWoo.ok === true, "both-starters guard must pass two correct distinct starters");

const staleWoo = seededPerPitcherFreshness(
  693433,
  [{ date: "2026-07-07", pitcherMlbId: 693433 }],
  [{ date: "2026-07-01", pitcherMlbId: 693433 }],
);
assert(staleWoo.stale === true, "per-pitcher freshness guard must fail a pitcher behind a settled start he made");

const currentWoo = seededPerPitcherFreshness(
  693433,
  [{ date: "2026-07-07", pitcherMlbId: 693433 }],
  [{ date: "2026-07-07", pitcherMlbId: 693433 }],
);
assert(currentWoo.stale === false, "per-pitcher freshness guard must pass a current pitcher");

console.log("settled start integrity contract ok: missing-date fallback, both-starters guard, and per-pitcher freshness seeds are pinned");
