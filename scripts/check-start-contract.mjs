const baseUrl = process.env.THE_BUMP_BASE_URL ?? "http://127.0.0.1:3000";
const startId = process.env.THE_BUMP_START_ID ?? "2026-05-23-pit-chc-694973";
const expectedStartLine = process.env.THE_BUMP_EXPECT_START_LINE_SOURCE;
const expectedPitchDetail = process.env.THE_BUMP_EXPECT_PITCH_DETAIL_SOURCE;
const expectedArchivePitchDetailStatus = process.env.THE_BUMP_EXPECT_ARCHIVE_PITCH_DETAIL_STATUS;
const expectedArchiveCompletedLineStatus = process.env.THE_BUMP_EXPECT_ARCHIVE_COMPLETED_LINE_STATUS;
const expectedStartArchiveDate = process.env.THE_BUMP_EXPECT_START_ARCHIVE_DATE;
const expectedStartArchiveSource = process.env.THE_BUMP_EXPECT_START_ARCHIVE_SOURCE;
const expectedStartArchivePitchEvents = readOptionalIntegerEnv("THE_BUMP_EXPECT_START_ARCHIVE_PITCH_EVENTS");
const expectedStartLinePitches = readOptionalIntegerEnv("THE_BUMP_EXPECT_START_LINE_PITCHES");
const pitchResultKeys = new Set(["called_strike", "swinging_strike", "foul", "ball", "hit_into_play"]);
const pitchTypeKeys = new Set(["FF", "SI", "SL", "CH", "CU", "FC"]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readOptionalIntegerEnv(name) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === "") return null;
  const value = Number(rawValue);
  assert(Number.isInteger(value) && value >= 0, `${name} must be a non-negative integer`);
  return value;
}

function isIsoTimestamp(value) {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function isIsoTimestampOnOrAfterDate(value, date) {
  return isIsoTimestamp(value) && typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && value.slice(0, 10) >= date;
}

function isRouteSafeTeamAbbreviation(value) {
  return typeof value === "string" && /^[A-Z0-9]+$/.test(value);
}

function assertSource(value, allowed, field) {
  assert(allowed.includes(value), `${field} expected one of ${allowed.join(", ")}, got ${value}`);
}

function assertExactKeys(value, expectedKeys, field) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${field} must be an object`);
  const keys = Object.keys(value);
  assert(keys.length === expectedKeys.length, `${field} expected keys ${expectedKeys.join(", ")}, got ${keys.join(", ")}`);
  for (const key of expectedKeys) {
    assert(Object.prototype.hasOwnProperty.call(value, key), `${field} missing key ${key}`);
  }
}

function nearlyEqual(a, b) {
  return Math.abs(a - b) < 0.000000001;
}

function summarizePitchEvents(pitchEvents) {
  const pitchTypes = Array.from(new Set(pitchEvents.map((pitch) => pitch.type)));

  return pitchTypes.map((type) => {
    const ofType = pitchEvents.filter((pitch) => pitch.type === type);
    const velocities = ofType.map((pitch) => pitch.velocityMph);
    const whiffs = ofType.filter((pitch) => pitch.result === "swinging_strike").length;
    const swings = ofType.filter((pitch) => ["swinging_strike", "foul", "hit_into_play"].includes(pitch.result)).length;
    const calledStrikes = ofType.filter((pitch) => pitch.result === "called_strike").length;

    return {
      type,
      usagePct: Math.max(1, Math.round((ofType.length / pitchEvents.length) * 100)),
      avgVelocityMph: Number((velocities.reduce((total, velocity) => total + velocity, 0) / velocities.length).toFixed(1)),
      whiffPct: swings > 0 ? Math.round((whiffs / swings) * 100) : 0,
      calledStrikePct: Math.round((calledStrikes / ofType.length) * 100),
    };
  });
}

const response = await fetch(`${baseUrl}/api/starts/${startId}`);
assert(response.ok, `start ${startId} returned HTTP ${response.status}`);

const start = await response.json();
assert(start.id === startId, "start id mismatch");
assert(Number.isInteger(start.gamePk), "start missing gamePk");
assert(Number.isInteger(start.pitcherMlbId), "start missing pitcherMlbId");
assert(typeof start.pitcherName === "string" && start.pitcherName.length > 0, "start missing pitcherName");
assert(isRouteSafeTeamAbbreviation(start.team), "start team must be route-safe uppercase letters/digits");
assert(isRouteSafeTeamAbbreviation(start.opponent), "start opponent must be route-safe uppercase letters/digits");
assert(start.team !== start.opponent, "start team and opponent must be different");
assert(
  start.id === `${start.date}-${start.team.toLowerCase()}-${start.opponent.toLowerCase()}-${start.pitcherMlbId}`,
  "start id must match date/team/opponent/pitcher route identity",
);
assertExactKeys(start.source, ["schedule", "line", "ranking", "pitchDetail", "archivePitchDetail", "archiveCompletedLine"], "source");
assertSource(start.source.schedule, ["fixture", "live"], "source.schedule");
assertSource(start.source.line, ["fixture", "archive-gamefeed", "live-gamefeed"], "source.line");
assertSource(start.source.ranking, ["schedule-derived-fixture-line", "schedule-derived-archive-line", "schedule-derived-gamefeed-line"], "source.ranking");
assertSource(start.source.pitchDetail, ["fixture", "archive-gamefeed", "live-gamefeed", "statcast-savant"], "source.pitchDetail");
assertSource(start.source.archivePitchDetail.status, ["stored", "missing-gamefeed-pitches", "not-archived"], "source.archivePitchDetail.status");
assert(Number.isInteger(start.source.archivePitchDetail.pitchEvents) && start.source.archivePitchDetail.pitchEvents >= 0, "source.archivePitchDetail.pitchEvents must be non-negative");
assertSource(start.source.archiveCompletedLine?.status, ["stored", "not-archived"], "source.archiveCompletedLine.status");
if (start.source.archivePitchDetail.status === "not-archived") {
  assertExactKeys(start.source.archivePitchDetail, ["status", "pitchEvents"], "source.archivePitchDetail");
} else {
  assertExactKeys(start.source.archivePitchDetail, ["status", "pitchEvents", "date", "archivedAt", "source"], "source.archivePitchDetail");
}

if (start.source.line === "archive-gamefeed") {
  assert(start.source.ranking === "schedule-derived-archive-line", "archive completed line must use archive-derived ranking");
} else if (start.source.line === "live-gamefeed") {
  assert(start.source.ranking === "schedule-derived-gamefeed-line", "live completed line must use gamefeed-derived ranking");
} else {
  assert(start.source.ranking === "schedule-derived-fixture-line", "fixture completed line must use fixture-derived ranking");
}

if (expectedPitchDetail) {
  assert(start.source.pitchDetail === expectedPitchDetail, `source.pitchDetail expected ${expectedPitchDetail}, got ${start.source.pitchDetail}`);
  if (expectedPitchDetail === "archive-gamefeed") {
    assert(start.source.archivePitchDetail.status === "stored", "archive-gamefeed pitch detail must report stored archive detail");
  }
}

if (expectedArchivePitchDetailStatus) {
  assert(
    start.source.archivePitchDetail.status === expectedArchivePitchDetailStatus,
    `source.archivePitchDetail.status expected ${expectedArchivePitchDetailStatus}, got ${start.source.archivePitchDetail.status}`,
  );
}

if (expectedArchiveCompletedLineStatus) {
  assert(
    start.source.archiveCompletedLine.status === expectedArchiveCompletedLineStatus,
    `source.archiveCompletedLine.status expected ${expectedArchiveCompletedLineStatus}, got ${start.source.archiveCompletedLine.status}`,
  );
  if (expectedArchiveCompletedLineStatus === "stored") {
    assert(start.source.line === "archive-gamefeed", "stored archive completed line expectation must use archive-gamefeed line source");
  }
}

if (expectedStartArchivePitchEvents !== null) {
  assert(
    start.source.archivePitchDetail.pitchEvents === expectedStartArchivePitchEvents,
    `source.archivePitchDetail.pitchEvents expected ${expectedStartArchivePitchEvents}, got ${start.source.archivePitchDetail.pitchEvents}`,
  );
  assert(
    start.pitchCounts.total === expectedStartArchivePitchEvents,
    `pitchCounts.total expected archived pitch-event count ${expectedStartArchivePitchEvents}, got ${start.pitchCounts.total}`,
  );
  assert(
    start.pitchEvents.length === expectedStartArchivePitchEvents,
    `pitchEvents length expected archived pitch-event count ${expectedStartArchivePitchEvents}, got ${start.pitchEvents.length}`,
  );
  assert(
    start.pitchSequence.length === expectedStartArchivePitchEvents,
    `pitchSequence length expected archived pitch-event count ${expectedStartArchivePitchEvents}, got ${start.pitchSequence.length}`,
  );
}

if (expectedStartArchiveDate) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(expectedStartArchiveDate), "THE_BUMP_EXPECT_START_ARCHIVE_DATE must be YYYY-MM-DD");
  assert(
    start.source.archiveCompletedLine.date === expectedStartArchiveDate,
    `source.archiveCompletedLine.date expected ${expectedStartArchiveDate}, got ${start.source.archiveCompletedLine.date}`,
  );
  if (start.source.archivePitchDetail.status !== "not-archived") {
    assert(
      start.source.archivePitchDetail.date === expectedStartArchiveDate,
      `source.archivePitchDetail.date expected ${expectedStartArchiveDate}, got ${start.source.archivePitchDetail.date}`,
    );
  }
}

if (expectedStartArchiveSource) {
  assert(
    start.source.archiveCompletedLine.source === expectedStartArchiveSource,
    `source.archiveCompletedLine.source expected ${expectedStartArchiveSource}, got ${start.source.archiveCompletedLine.source}`,
  );
  if (start.source.archivePitchDetail.status !== "not-archived") {
    assert(
      start.source.archivePitchDetail.source === expectedStartArchiveSource,
      `source.archivePitchDetail.source expected ${expectedStartArchiveSource}, got ${start.source.archivePitchDetail.source}`,
    );
  }
}

if (expectedStartLine) {
  assert(start.source.line === expectedStartLine, `source.line expected ${expectedStartLine}, got ${start.source.line}`);
}

if (expectedStartLinePitches !== null) {
  assert(start.source.line === "archive-gamefeed", "line.pitches archive expectation must use archive-gamefeed line source");
  assert(start.source.archiveCompletedLine.status === "stored", "line.pitches archive expectation must report stored archive completed-line metadata");
  assert(
    start.line.pitches === expectedStartLinePitches,
    `line.pitches expected archived completed-line pitch count ${expectedStartLinePitches}, got ${start.line.pitches}`,
  );
}

if (start.source.line === "archive-gamefeed") {
  assertExactKeys(start.source.archiveCompletedLine, ["status", "date", "archivedAt", "source"], "source.archiveCompletedLine");
  assert(start.source.archiveCompletedLine.status === "stored", "archive completed line must report stored archive metadata");
  assert(start.source.archivePitchDetail.status !== "not-archived", "archive completed line must report stored or intentionally missing archive pitch detail metadata");
  assert(start.source.archiveCompletedLine.date === start.date, "archive completed line date must match start date");
  assert(isIsoTimestamp(start.source.archiveCompletedLine.archivedAt), "archive completed line archivedAt must be an ISO timestamp");
  assert(
    isIsoTimestampOnOrAfterDate(start.source.archiveCompletedLine.archivedAt, start.date),
    "archive completed line archivedAt must be on or after the start date",
  );
  assert(start.source.archiveCompletedLine.source === "mlb-stats-api", "archive completed line source must be mlb-stats-api");
} else {
  assertExactKeys(start.source.archiveCompletedLine, ["status"], "source.archiveCompletedLine");
  assert(start.source.archiveCompletedLine.status === "not-archived", "non-archive line must not report stored archive metadata");
  assert(start.source.archiveCompletedLine.date === undefined, "non-archive line must not report archive completed line date");
  assert(start.source.archiveCompletedLine.source === undefined, "non-archive line must not report archive completed line source");
  assert(start.source.archiveCompletedLine.archivedAt === undefined, "non-archive line must not report archive completed line archivedAt");
}
if (start.source.archiveCompletedLine.status === "stored") {
  assert(start.source.line === "archive-gamefeed", "stored archive completed line metadata must drive archive-gamefeed line source");
}

const hasPitchDetails = start.source.pitchDetail !== "fixture";
assert(Number.isInteger(start.pitchCounts?.total) && start.pitchCounts.total >= 0, "start missing pitch total");
if (hasPitchDetails) {
  assert(start.pitchCounts.total > 0, "start missing positive pitch total");
}
assert(start.pitchCounts.total <= start.line.pitches, "pitch detail count must not exceed official line pitch count");
assert(Array.isArray(start.pitchCounts?.byInning), "start missing inning pitch counts");
if (hasPitchDetails) {
  assert(start.pitchCounts.byInning.length > 0, "start missing inning pitch counts");
}
assert(Array.isArray(start.velocityTrend) && start.velocityTrend.length === start.pitchCounts.byInning.length, "velocityTrend must match inning count");
assert(Array.isArray(start.inningTimeline) && start.inningTimeline.length === start.pitchCounts.byInning.length, "inningTimeline must match inning count");
assert(Array.isArray(start.countLeverage) && start.countLeverage.length === start.pitchCounts.byInning.length, "countLeverage must match inning count");
assert(Array.isArray(start.pitchSequence) && start.pitchSequence.length === start.pitchCounts.total, "pitchSequence length must match pitch total");
assert(start.gameScorePlusBreakdown?.total === start.gameScorePlus, "gameScorePlusBreakdown total must match gameScorePlus");
assert(start.gameScorePlusBreakdown?.formulaVersion === "context-v7", "gameScorePlusBreakdown formulaVersion must be context-v7");
assert(start.gameScorePlusBreakdown.total >= 20 && start.gameScorePlusBreakdown.total <= 80, "gameScorePlusBreakdown total must use the 20-80 display scale");
assert(typeof start.gameScorePlusBreakdown.gradeBand?.label === "string" && start.gameScorePlusBreakdown.gradeBand.label.length > 0, "gameScorePlusBreakdown gradeBand label must be present");
assert(typeof start.gameScorePlusBreakdown.gradeBand?.percentileLabel === "string" && start.gameScorePlusBreakdown.gradeBand.percentileLabel.length > 0, "gameScorePlusBreakdown gradeBand percentileLabel must be present");
assert(typeof start.gameScorePlusBreakdown.gradeBand?.rangeLabel === "string" && start.gameScorePlusBreakdown.gradeBand.rangeLabel.length > 0, "gameScorePlusBreakdown gradeBand rangeLabel must be present");
assert(typeof start.gameScorePlusBreakdown.gradeBand?.description === "string" && start.gameScorePlusBreakdown.gradeBand.description.length > 0, "gameScorePlusBreakdown gradeBand description must be present");
assert(Array.isArray(start.gameScorePlusBreakdown?.components) && start.gameScorePlusBreakdown.components.length >= 11, "gameScorePlusBreakdown must include explainable line, stuff, park, opponent quality, and opponent offense components");
assert(Array.isArray(start.gameScorePlusBreakdown?.rankingReasons) && start.gameScorePlusBreakdown.rankingReasons.length === 3, "gameScorePlusBreakdown must include 3 ranked reasons");
assert(Array.isArray(start.arsenal), "start missing arsenal");
if (hasPitchDetails) {
  assert(start.arsenal.length > 0, "start missing arsenal");
} else {
  assert(start.arsenal.length === 0, "missing pitch detail must not return synthetic arsenal");
  assert(start.pitchCounts.total === 0, "missing pitch detail must not return synthetic pitch counts");
  assert(start.velocityTrend.length === 0, "missing pitch detail must not return synthetic velocity trend");
  assert(start.inningTimeline.length === 0, "missing pitch detail must not return synthetic inning timeline");
  assert(start.countLeverage.length === 0, "missing pitch detail must not return synthetic count leverage");
  assert(start.pitchSequence.length === 0, "missing pitch detail must not return synthetic pitch sequence");
}
assert(Array.isArray(start.pitchEvents) && start.pitchEvents.length === start.pitchCounts.total, "pitchEvents length must match pitch total");
if (start.source.pitchDetail === "archive-gamefeed") {
  assert(start.source.archivePitchDetail.status === "stored", "archive-gamefeed pitch detail must report stored archive detail");
}
if (start.source.pitchDetail === "statcast-savant") {
  assert(start.pitchEvents.length > 0, "statcast-savant pitch detail must include pitch events");
  assert(start.arsenal.length > 0, "statcast-savant pitch detail must include arsenal");
}
if (start.source.archivePitchDetail.status === "stored") {
  assert(start.source.archivePitchDetail.pitchEvents === start.pitchCounts.total, "stored archive pitch detail count must match pitch total");
  assert(start.source.archivePitchDetail.date === start.date, "stored archive pitch detail date must match start date");
  assert(isIsoTimestamp(start.source.archivePitchDetail.archivedAt), "stored archive pitch detail archivedAt must be an ISO timestamp");
  assert(
    isIsoTimestampOnOrAfterDate(start.source.archivePitchDetail.archivedAt, start.date),
    "stored archive pitch detail archivedAt must be on or after the start date",
  );
  assert(start.source.archivePitchDetail.source === "mlb-stats-api", "stored archive pitch detail source must be mlb-stats-api");
  assert(start.source.pitchDetail === "archive-gamefeed", "stored archive pitch detail must drive archive-gamefeed pitch detail");
  assert(start.source.line === "archive-gamefeed", "stored archive pitch detail must keep the archived completed line");
  assert(start.source.archiveCompletedLine.status === "stored", "stored archive pitch detail must include stored archive completed line metadata");
  assert(
    start.source.archiveCompletedLine.archivedAt === start.source.archivePitchDetail.archivedAt,
    "stored archive pitch detail and completed line archivedAt must match",
  );
  assert(
    start.source.archiveCompletedLine.date === start.source.archivePitchDetail.date,
    "stored archive pitch detail and completed line date must match",
  );
  assert(
    start.source.archiveCompletedLine.source === start.source.archivePitchDetail.source,
    "stored archive pitch detail and completed line source must match",
  );
}
if (start.source.archivePitchDetail.status === "missing-gamefeed-pitches") {
  assert(start.source.line === "archive-gamefeed", "missing archive pitch detail must keep the archived completed line");
  assert(["fixture", "statcast-savant"].includes(start.source.pitchDetail), "missing archive pitch detail must use pending or Statcast pitch detail");
  assert(start.source.archivePitchDetail.pitchEvents === 0, "missing archive pitch detail must report zero archived pitch events");
  assert(start.source.archivePitchDetail.date === start.date, "missing archive pitch detail date must match start date");
  assert(isIsoTimestamp(start.source.archivePitchDetail.archivedAt), "missing archive pitch detail archivedAt must be an ISO timestamp");
  assert(
    isIsoTimestampOnOrAfterDate(start.source.archivePitchDetail.archivedAt, start.date),
    "missing archive pitch detail archivedAt must be on or after the start date",
  );
  assert(start.source.archivePitchDetail.source === "mlb-stats-api", "missing archive pitch detail source must be mlb-stats-api");
  assert(start.source.archiveCompletedLine.status === "stored", "missing archive pitch detail must include stored archive completed line metadata");
  assert(
    start.source.archiveCompletedLine.archivedAt === start.source.archivePitchDetail.archivedAt,
    "missing archive pitch detail and completed line archivedAt must match",
  );
  assert(
    start.source.archiveCompletedLine.date === start.source.archivePitchDetail.date,
    "missing archive pitch detail and completed line date must match",
  );
  assert(
    start.source.archiveCompletedLine.source === start.source.archivePitchDetail.source,
    "missing archive pitch detail and completed line source must match",
  );
}
if (start.source.archivePitchDetail.status === "not-archived") {
  assert(start.source.archivePitchDetail.pitchEvents === 0, "not-archived pitch detail must report zero archived pitch events");
  assert(start.source.archivePitchDetail.date === undefined, "not-archived pitch detail must not report archive date");
  assert(start.source.archivePitchDetail.source === undefined, "not-archived pitch detail must not report archive source");
  assert(start.source.archivePitchDetail.archivedAt === undefined, "not-archived pitch detail must not report archive archivedAt");
}

const typeTotal = Object.values(start.pitchCounts.byType ?? {}).reduce((total, count) => total + count, 0);
const inningTotal = start.pitchCounts.byInning.reduce((total, inning) => total + inning.pitches, 0);
const timelineTotal = start.inningTimeline.reduce((total, inning) => total + inning.pitches, 0);
const leverageTotal = start.countLeverage.reduce((total, inning) => total + inning.ahead + inning.even + inning.behind, 0);
assert(typeTotal === start.pitchCounts.total, "pitch type counts must add to pitch total");
assert(inningTotal === start.pitchCounts.total, "inning pitch counts must add to pitch total");
assert(timelineTotal === start.pitchCounts.total, "inning timeline counts must add to pitch total");
assert(leverageTotal === start.pitchCounts.total, "count leverage totals must add to pitch total");

for (const inning of start.inningTimeline) {
  assert(Number.isInteger(inning.inning), "inningTimeline inning must be an integer");
  assert(Number.isInteger(inning.pitches) && inning.pitches > 0, "inningTimeline pitches must be positive");
  assert(Number.isInteger(inning.strikes), "inningTimeline strikes must be an integer");
  assert(Number.isInteger(inning.whiffs), "inningTimeline whiffs must be an integer");
  assert(Number.isInteger(inning.inPlay), "inningTimeline inPlay must be an integer");
  assert(typeof inning.avgVelocityMph === "number" && inning.avgVelocityMph > 0, "inningTimeline avgVelocityMph must be positive");
  assert(typeof inning.maxVelocityMph === "number" && inning.maxVelocityMph >= inning.avgVelocityMph, "inningTimeline maxVelocityMph must be at least avgVelocityMph");
}

for (const inning of start.velocityTrend) {
  assert(Number.isInteger(inning.inning), "velocityTrend inning must be an integer");
  assert(typeof inning.avgVelocityMph === "number" && inning.avgVelocityMph > 0, "velocityTrend avgVelocityMph must be positive");
  assert(typeof inning.maxVelocityMph === "number" && inning.maxVelocityMph >= inning.avgVelocityMph, "velocityTrend maxVelocityMph must be at least avgVelocityMph");
}

for (const inning of start.countLeverage) {
  assert(Number.isInteger(inning.inning), "countLeverage inning must be an integer");
  assert(Number.isInteger(inning.ahead) && inning.ahead >= 0, "countLeverage ahead must be non-negative");
  assert(Number.isInteger(inning.even) && inning.even >= 0, "countLeverage even must be non-negative");
  assert(Number.isInteger(inning.behind) && inning.behind >= 0, "countLeverage behind must be non-negative");
  assert(Number.isInteger(inning.twoStrike) && inning.twoStrike >= 0, "countLeverage twoStrike must be non-negative");
}

for (const pitch of start.pitchEvents) {
  assert(typeof pitch.id === "string" && pitch.id.length > 0, "pitch event id must be present");
  assert(pitch.gamePk === start.gamePk, "pitch event gamePk must match start gamePk");
  assert(Number.isInteger(pitch.pitchNumber) && pitch.pitchNumber > 0, "pitch event pitchNumber must be positive");
  assert(Number.isInteger(pitch.inning) && pitch.inning > 0, "pitch event inning must be positive");
  assert(pitchTypeKeys.has(pitch.type), "pitch type must be supported");
  assert(pitchResultKeys.has(pitch.result), "pitch result must be supported");
  assert(Number.isInteger(pitch.count?.balls) && pitch.count.balls >= 0 && pitch.count.balls <= 3, "pitch count balls must be 0-3");
  assert(Number.isInteger(pitch.count?.strikes) && pitch.count.strikes >= 0 && pitch.count.strikes <= 2, "pitch count strikes must be 0-2");
  assert(typeof pitch.velocityMph === "number" && pitch.velocityMph > 0, "pitch velocityMph must be positive");
  assert(typeof pitch.plateX === "number" && Number.isFinite(pitch.plateX), "pitch plateX must be finite");
  assert(typeof pitch.plateZ === "number" && Number.isFinite(pitch.plateZ), "pitch plateZ must be finite");
}

if (start.source.archivePitchDetail.status === "stored") {
  const storedPitchEventIds = new Set();
  const storedPitchNumbers = new Set();
  const storedPitchTypeCounts = start.pitchEvents.reduce((counts, pitch) => {
    counts[pitch.type] = (counts[pitch.type] ?? 0) + 1;
    return counts;
  }, {});

  for (const pitch of start.pitchEvents) {
    assert(!storedPitchEventIds.has(pitch.id), `stored archive pitch event id must be unique: ${pitch.id}`);
    assert(!storedPitchNumbers.has(pitch.pitchNumber), `stored archive pitchNumber must be unique: ${pitch.pitchNumber}`);
    storedPitchEventIds.add(pitch.id);
    storedPitchNumbers.add(pitch.pitchNumber);
  }

  assert(
    Object.keys(start.pitchCounts.byType ?? {}).length === Object.keys(storedPitchTypeCounts).length,
    "stored archive pitch type count keys must match archived pitch-event types",
  );
  for (const [type, count] of Object.entries(storedPitchTypeCounts)) {
    assert(start.pitchCounts.byType?.[type] === count, `stored archive ${type} pitch count must match pitch events`);
  }

  const storedInnings = new Map();
  for (const pitch of start.pitchEvents) {
    const inning = storedInnings.get(pitch.inning) ?? {
      pitches: 0,
      strikes: 0,
      whiffs: 0,
      inPlay: 0,
      velocities: [],
      ahead: 0,
      even: 0,
      behind: 0,
      twoStrike: 0,
    };

    inning.pitches += 1;
    inning.velocities.push(pitch.velocityMph);
    if (pitch.result === "called_strike" || pitch.result === "swinging_strike") inning.strikes += 1;
    if (pitch.result === "swinging_strike") inning.whiffs += 1;
    if (pitch.result === "hit_into_play") inning.inPlay += 1;
    if (pitch.count.strikes === 2) inning.twoStrike += 1;
    if (pitch.count.strikes > pitch.count.balls) inning.ahead += 1;
    else if (pitch.count.strikes === pitch.count.balls) inning.even += 1;
    else inning.behind += 1;

    storedInnings.set(pitch.inning, inning);
  }

  assert(start.pitchCounts.byInning.length === storedInnings.size, "stored archive inning pitch count rows must match archived pitch-event innings");
  assert(start.inningTimeline.length === storedInnings.size, "stored archive inning timeline rows must match archived pitch-event innings");
  assert(start.velocityTrend.length === storedInnings.size, "stored archive velocity trend rows must match archived pitch-event innings");
  assert(start.countLeverage.length === storedInnings.size, "stored archive count leverage rows must match archived pitch-event innings");

  const archivedInningOrder = Array.from(storedInnings.keys());
  const assertArchivedInningOrder = (rows, field) => {
    const actualOrder = rows.map((inning) => inning.inning);
    assert(
      actualOrder.length === archivedInningOrder.length && actualOrder.every((inning, index) => inning === archivedInningOrder[index]),
      `stored archive ${field} inning order must match archived pitch-event order`,
    );
  };

  assertArchivedInningOrder(start.pitchCounts.byInning, "pitch count");
  assertArchivedInningOrder(start.inningTimeline, "timeline");
  assertArchivedInningOrder(start.velocityTrend, "velocity trend");
  assertArchivedInningOrder(start.countLeverage, "count leverage");

  for (const [inningNumber, storedInning] of storedInnings.entries()) {
    const pitchCountRow = start.pitchCounts.byInning.find((inning) => inning.inning === inningNumber);
    const timelineRow = start.inningTimeline.find((inning) => inning.inning === inningNumber);
    const velocityRow = start.velocityTrend.find((inning) => inning.inning === inningNumber);
    const leverageRow = start.countLeverage.find((inning) => inning.inning === inningNumber);
    const avgVelocityMph = storedInning.velocities.reduce((total, velocity) => total + velocity, 0) / storedInning.velocities.length;
    const maxVelocityMph = Math.max(...storedInning.velocities);

    assert(pitchCountRow?.pitches === storedInning.pitches, `stored archive inning ${inningNumber} pitch count must match pitch events`);
    assert(timelineRow?.pitches === storedInning.pitches, `stored archive inning ${inningNumber} timeline pitches must match pitch events`);
    assert(timelineRow.strikes === storedInning.strikes, `stored archive inning ${inningNumber} timeline strikes must match pitch events`);
    assert(timelineRow.whiffs === storedInning.whiffs, `stored archive inning ${inningNumber} timeline whiffs must match pitch events`);
    assert(timelineRow.inPlay === storedInning.inPlay, `stored archive inning ${inningNumber} timeline in-play count must match pitch events`);
    assert(nearlyEqual(timelineRow.avgVelocityMph, avgVelocityMph), `stored archive inning ${inningNumber} timeline avg velocity must match pitch events`);
    assert(timelineRow.maxVelocityMph === maxVelocityMph, `stored archive inning ${inningNumber} timeline max velocity must match pitch events`);
    assert(nearlyEqual(velocityRow?.avgVelocityMph, avgVelocityMph), `stored archive inning ${inningNumber} velocity trend avg must match pitch events`);
    assert(velocityRow.maxVelocityMph === maxVelocityMph, `stored archive inning ${inningNumber} velocity trend max must match pitch events`);
    assert(leverageRow?.ahead === storedInning.ahead, `stored archive inning ${inningNumber} ahead count must match pitch events`);
    assert(leverageRow.even === storedInning.even, `stored archive inning ${inningNumber} even count must match pitch events`);
    assert(leverageRow.behind === storedInning.behind, `stored archive inning ${inningNumber} behind count must match pitch events`);
    assert(leverageRow.twoStrike === storedInning.twoStrike, `stored archive inning ${inningNumber} two-strike count must match pitch events`);
  }

  for (const [index, pitch] of start.pitchEvents.entries()) {
    const sequenceRow = start.pitchSequence[index];
    const previousPitch = start.pitchEvents[index - 1];

    assert(pitch.id === `${start.gamePk}-${start.pitcherMlbId}-${index + 1}`, "stored archive pitch event id must match start and order");
    assert(pitch.pitchNumber === index + 1, "stored archive pitch events must be sequential");
    if (previousPitch) {
      assert(pitch.inning >= previousPitch.inning, "stored archive pitch events must preserve non-decreasing inning order");
    }
    assert(sequenceRow.id === pitch.id, "stored archive pitchSequence row id must match pitch event id");
    assert(sequenceRow.pitchNumber === pitch.pitchNumber, "stored archive pitchSequence row order must match pitch event order");
    assert(sequenceRow.inning === pitch.inning, "stored archive pitchSequence row inning must match pitch event");
    assert(sequenceRow.type === pitch.type, "stored archive pitchSequence row type must match pitch event");
    assert(sequenceRow.result === pitch.result, "stored archive pitchSequence row result must match pitch event");
    assert(sequenceRow.count?.balls === pitch.count.balls, "stored archive pitchSequence row balls must match pitch event");
    assert(sequenceRow.count?.strikes === pitch.count.strikes, "stored archive pitchSequence row strikes must match pitch event");
    assert(sequenceRow.countLabel === `${pitch.count.balls}-${pitch.count.strikes}`, "stored archive pitchSequence row countLabel must match pitch event count");
    assert(sequenceRow.velocityMph === pitch.velocityMph, "stored archive pitchSequence row velocity must match pitch event");
    assert(sequenceRow.plateX === pitch.plateX, "stored archive pitchSequence row plateX must match pitch event");
    assert(sequenceRow.plateZ === pitch.plateZ, "stored archive pitchSequence row plateZ must match pitch event");
    assert(sequenceRow.locationLabel === `${pitch.plateX.toFixed(2)} / ${pitch.plateZ.toFixed(2)}`, "stored archive pitchSequence row locationLabel must match pitch event location");
  }

  const expectedArsenal = summarizePitchEvents(start.pitchEvents);
  assert(start.arsenal.length === expectedArsenal.length, "stored archive arsenal count must match pitch-event types");
  assert(
    start.arsenal.every((pitch, index) => pitch.type === expectedArsenal[index]?.type),
    "stored archive arsenal order must match archived pitch-event type order",
  );

  for (const expectedPitch of expectedArsenal) {
    const actualPitch = start.arsenal.find((pitch) => pitch.type === expectedPitch.type);
    assert(actualPitch, `stored archive arsenal missing ${expectedPitch.type}`);
    assert(actualPitch.usagePct === expectedPitch.usagePct, `stored archive ${expectedPitch.type} usagePct mismatch`);
    assert(actualPitch.avgVelocityMph === expectedPitch.avgVelocityMph, `stored archive ${expectedPitch.type} avgVelocityMph mismatch`);
    assert(actualPitch.whiffPct === expectedPitch.whiffPct, `stored archive ${expectedPitch.type} whiffPct mismatch`);
    assert(actualPitch.calledStrikePct === expectedPitch.calledStrikePct, `stored archive ${expectedPitch.type} calledStrikePct mismatch`);
  }
}

for (const row of start.pitchSequence) {
  assert(Number.isInteger(row.pitchNumber) && row.pitchNumber > 0, "pitchSequence pitchNumber must be positive");
  assert(Number.isInteger(row.inning) && row.inning > 0, "pitchSequence inning must be positive");
  assert(typeof row.countLabel === "string" && /^\d-\d$/.test(row.countLabel), "pitchSequence countLabel must be N-N");
  assert(typeof row.locationLabel === "string" && row.locationLabel.includes(" / "), "pitchSequence locationLabel must be formatted");
  assert(typeof row.velocityMph === "number" && row.velocityMph > 0, "pitchSequence velocityMph must be positive");
}

for (const component of start.gameScorePlusBreakdown.components) {
  assert(typeof component.key === "string" && component.key.length > 0, "gameScorePlusBreakdown component key must be present");
  assert(typeof component.label === "string" && component.label.length > 0, "gameScorePlusBreakdown component label must be present");
  assert(typeof component.value === "number", "gameScorePlusBreakdown component value must be numeric");
  assert(typeof component.description === "string" && component.description.length > 0, "gameScorePlusBreakdown component description must be present");
}

for (const reason of start.gameScorePlusBreakdown.rankingReasons) {
  assert(typeof reason.key === "string" && reason.key.length > 0, "ranking reason key must be present");
  assert(typeof reason.label === "string" && reason.label.length > 0, "ranking reason label must be present");
  assert(typeof reason.value === "number" && reason.value !== 0, "ranking reason value must be non-zero");
  assert(typeof reason.description === "string" && reason.description.length > 0, "ranking reason description must be present");
  assert(["positive", "negative"].includes(reason.impact), "ranking reason impact must be positive or negative");
  assert(reason.key !== "baseline" && reason.key !== "calibration", "ranking reasons must exclude baseline and calibration");
}

const scoreKeys = new Set(start.gameScorePlusBreakdown.components.map((component) => component.key));
assert(scoreKeys.has("whiffDelta"), "gameScorePlusBreakdown must include whiffDelta context");
assert(scoreKeys.has("velocityDelta"), "gameScorePlusBreakdown must include velocityDelta context");
assert(scoreKeys.has("parkContext"), "gameScorePlusBreakdown must include parkContext context");
assert(scoreKeys.has("opponentQuality"), "gameScorePlusBreakdown must include opponentQuality context");
assert(scoreKeys.has("opponentOffense"), "gameScorePlusBreakdown must include opponentOffense context");

console.log(`start contract ok: ${start.pitcherName} / GS+ ${start.gameScorePlusBreakdown.total} explained / ${start.pitchCounts.total} pitches / ${start.inningTimeline.length} innings / ${start.source.pitchDetail}`);
