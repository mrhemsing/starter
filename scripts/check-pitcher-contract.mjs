const baseUrl = process.env.THE_BUMP_BASE_URL ?? "http://127.0.0.1:3000";
const pitcherId = process.env.THE_BUMP_PITCHER_ID ?? "694819";
const expectedArsenalSource = process.env.THE_BUMP_EXPECT_PITCHER_ARSENAL_SOURCE;
const expectedArsenalPitches = process.env.THE_BUMP_EXPECT_PITCHER_ARSENAL_PITCHES ? Number(process.env.THE_BUMP_EXPECT_PITCHER_ARSENAL_PITCHES) : null;
const expectedSeasonLineSource = process.env.THE_BUMP_EXPECT_PITCHER_SEASON_LINE_SOURCE;
const expectedStartHistorySource = process.env.THE_BUMP_EXPECT_PITCHER_START_HISTORY_SOURCE;
const expectedStartCount = process.env.THE_BUMP_EXPECT_PITCHER_STARTS ? Number(process.env.THE_BUMP_EXPECT_PITCHER_STARTS) : null;
const expectedArchiveProfileStart = process.env.THE_BUMP_EXPECT_PITCHER_ARCHIVE_START;
const expectedArchiveProfileEnd = process.env.THE_BUMP_EXPECT_PITCHER_ARCHIVE_END;
const expectedArchiveProfileSource = process.env.THE_BUMP_EXPECT_PITCHER_ARCHIVE_SOURCE;
const expectedArchiveProfileGames = readOptionalPositiveIntegerEnv("THE_BUMP_EXPECT_PITCHER_ARCHIVE_GAMES");
const expectedArchiveProfileCompletedGames = readOptionalPositiveIntegerEnv("THE_BUMP_EXPECT_PITCHER_ARCHIVE_COMPLETED_GAMES");
const expectedArchiveProfileCompletedGamesWithStarts = readOptionalNonNegativeIntegerEnv("THE_BUMP_EXPECT_PITCHER_ARCHIVE_COMPLETED_GAMES_WITH_STARTS");
const expectedArchiveProfileCompletedGamesMissingStarts = readOptionalNonNegativeIntegerEnv("THE_BUMP_EXPECT_PITCHER_ARCHIVE_COMPLETED_GAMES_MISSING_STARTS");
const expectedArchiveProfileStarts = readOptionalPositiveIntegerEnv("THE_BUMP_EXPECT_PITCHER_ARCHIVE_STARTS");
const expectedArchiveProfilePitchEvents = readOptionalPositiveIntegerEnv("THE_BUMP_EXPECT_PITCHER_ARCHIVE_PITCH_EVENTS");
const expectedArchiveArsenalSource = process.env.THE_BUMP_EXPECT_PITCHER_ARCHIVE_ARSENAL_SOURCE;
const expectedArchiveArsenalStarts = readOptionalPositiveIntegerEnv("THE_BUMP_EXPECT_PITCHER_ARCHIVE_ARSENAL_STARTS");
const expectedArchiveArsenalPitchEvents = readOptionalPositiveIntegerEnv("THE_BUMP_EXPECT_PITCHER_ARCHIVE_ARSENAL_PITCH_EVENTS");
const expectedArchiveArsenalFirstStart = process.env.THE_BUMP_EXPECT_PITCHER_ARCHIVE_ARSENAL_FIRST_START;
const expectedArchiveArsenalLastStart = process.env.THE_BUMP_EXPECT_PITCHER_ARCHIVE_ARSENAL_LAST_START;
const routeStartIdPattern = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+-[a-z0-9]+-\d+$/;
const routeSafeTeamPattern = /^[A-Z0-9]+$/;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNonNegativeInteger(value, field) {
  assert(Number.isInteger(value) && value >= 0, `${field} must be a non-negative integer`);
}

function readOptionalPositiveIntegerEnv(name) {
  const value = process.env[name];
  if (value === undefined || value === "") return null;
  const parsed = Number(value);
  assert(Number.isInteger(parsed) && parsed > 0, `${name} must be a positive integer`);
  return parsed;
}

function readOptionalNonNegativeIntegerEnv(name) {
  const value = process.env[name];
  if (value === undefined || value === "") return null;
  const parsed = Number(value);
  assert(Number.isInteger(parsed) && parsed >= 0, `${name} must be a non-negative integer`);
  return parsed;
}

function assertRouteSafeTeamAbbreviation(value, field) {
  assert(typeof value === "string" && routeSafeTeamPattern.test(value), `${field} must be route-safe uppercase letters/digits`);
}

function isIsoTimestamp(value) {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function isIsoTimestampOnOrAfterDate(value, date) {
  return isIsoTimestamp(value) && typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && value.slice(0, 10) >= date;
}

function inningsToOuts(value) {
  const whole = Math.trunc(value);
  const outs = Math.round((value - whole) * 10);
  assert(outs >= 0 && outs <= 2, `innings value must use baseball outs notation: ${value}`);
  return whole * 3 + outs;
}

function assertMatchingSeasonLine(candidate, expected, label) {
  assert(candidate?.starts === expected.starts, `${label} seasonLine starts must match base response`);
  assert(candidate.inningsPitched === expected.inningsPitched, `${label} seasonLine innings must match base response`);
  assert(candidate.era === expected.era, `${label} seasonLine ERA must match base response`);
  assert(candidate.strikeouts === expected.strikeouts, `${label} seasonLine strikeouts must match base response`);
  assert(candidate.walks === expected.walks, `${label} seasonLine walks must match base response`);
}

function assertMatchingArchiveProfile(candidate, expected, label) {
  assert(candidate, `${label} must include archive profile freshness metadata`);
  assert(candidate.season === expected.season, `${label} archive profile season must match base response`);
  assert(candidate.startDate === expected.startDate, `${label} archive profile startDate must match base response`);
  assert(candidate.endDate === expected.endDate, `${label} archive profile endDate must match base response`);
  assert(candidate.archivedAt === expected.archivedAt, `${label} archive profile archivedAt must match base response`);
  assert(candidate.source === expected.source, `${label} archive profile source must match base response`);
  assert(candidate.dates === expected.dates, `${label} archive profile date count must match base response`);
  assert(candidate.games === expected.games, `${label} archive profile game count must match base response`);
  assert(candidate.completedGames === expected.completedGames, `${label} archive profile completed-game count must match base response`);
  assert(candidate.completedGamesWithStarts === expected.completedGamesWithStarts, `${label} archive profile completed games with starts must match base response`);
  assert(candidate.completedGamesMissingStarts === expected.completedGamesMissingStarts, `${label} archive profile completed games missing starts must match base response`);
  assert(candidate.starts === expected.starts, `${label} archive profile start count must match base response`);
  assert(candidate.pitchEvents === expected.pitchEvents, `${label} archive profile pitch-event count must match base response`);
  assert(candidate.pitcherStarts === expected.pitcherStarts, `${label} archive profile pitcher start count must match base response`);
}

function assertMatchingArchiveArsenal(candidate, expected, label) {
  assert(candidate, `${label} must include archive arsenal freshness metadata`);
  assert(candidate.season === expected.season, `${label} archive arsenal season must match base response`);
  assert(candidate.startDate === expected.startDate, `${label} archive arsenal startDate must match base response`);
  assert(candidate.endDate === expected.endDate, `${label} archive arsenal endDate must match base response`);
  assert(candidate.archivedAt === expected.archivedAt, `${label} archive arsenal archivedAt must match base response`);
  assert(candidate.source === expected.source, `${label} archive arsenal source must match base response`);
  assert(candidate.starts === expected.starts, `${label} archive arsenal recent start count must match base response`);
  assert(candidate.pitchEvents === expected.pitchEvents, `${label} archive arsenal pitch-event count must match base response`);
  assert(candidate.firstStartDate === expected.firstStartDate, `${label} archive arsenal firstStartDate must match base response`);
  assert(candidate.lastStartDate === expected.lastStartDate, `${label} archive arsenal lastStartDate must match base response`);
}

function assertMatchingArsenalRows(candidateArsenal, expectedArsenal, label) {
  assert(Array.isArray(candidateArsenal), `${label} must include arsenal rows`);
  assert(candidateArsenal.length === expectedArsenal.length, `${label} arsenal count must match base response`);
  for (const [index, expected] of expectedArsenal.entries()) {
    const candidate = candidateArsenal[index];
    assert(candidate?.type === expected.type, `${label} arsenal pitch ${index + 1} type must match base response`);
    assert(candidate.usagePct === expected.usagePct, `${label} ${expected.type} usagePct must match base response`);
    assert(candidate.avgVelocityMph === expected.avgVelocityMph, `${label} ${expected.type} avgVelocityMph must match base response`);
    assert(candidate.whiffPct === expected.whiffPct, `${label} ${expected.type} whiffPct must match base response`);
    assert(candidate.calledStrikePct === expected.calledStrikePct, `${label} ${expected.type} calledStrikePct must match base response`);
  }
}

function assertMatchingArchivedStartRows(candidateStarts, startsById, label) {
  const observedStartIds = new Set();

  for (const candidate of candidateStarts) {
    const expected = startsById.get(candidate.id);
    assert(expected, `${label} archived start ${candidate.id} must come from the base archived start history`);
    assert(!observedStartIds.has(candidate.id), `${label} archived start ${candidate.id} must not be duplicated`);
    observedStartIds.add(candidate.id);
    assert(candidate.gamePk === expected.gamePk, `${label} archived start ${candidate.id} gamePk must match base response`);
    assert(candidate.date === expected.date, `${label} archived start ${candidate.id} date must match base response`);
    assert(candidate.opponent === expected.opponent, `${label} archived start ${candidate.id} opponent must match base response`);
    assert(candidate.result === expected.result, `${label} archived start ${candidate.id} result must match base response`);
    assert(candidate.startHref === expected.startHref, `${label} archived start ${candidate.id} startHref must match base response`);
    assert(candidate.gameScorePlus === expected.gameScorePlus, `${label} archived start ${candidate.id} GS+ must match base response`);
    assert(candidate.line?.inningsPitched === expected.line.inningsPitched, `${label} archived start ${candidate.id} innings must match base response`);
    assert(candidate.line.hits === expected.line.hits, `${label} archived start ${candidate.id} hits must match base response`);
    assert(candidate.line.earnedRuns === expected.line.earnedRuns, `${label} archived start ${candidate.id} earned runs must match base response`);
    assert(candidate.line.walks === expected.line.walks, `${label} archived start ${candidate.id} walks must match base response`);
    assert(candidate.line.strikeouts === expected.line.strikeouts, `${label} archived start ${candidate.id} strikeouts must match base response`);
    assert(candidate.line.pitches === expected.line.pitches, `${label} archived start ${candidate.id} pitches must match base response`);
  }
}

function assertSameArchivedStartIds(candidateStarts, expectedStarts, label) {
  assert(candidateStarts.length === expectedStarts.length, `${label} must preserve the archived start count`);
  const candidateStartIds = new Set(candidateStarts.map((start) => start.id));
  assert(candidateStartIds.size === expectedStarts.length, `${label} must not duplicate archived start ids`);
  for (const expectedStart of expectedStarts) {
    assert(candidateStartIds.has(expectedStart.id), `${label} must include archived start ${expectedStart.id}`);
  }
}

function assertSeasonLogSummaryMatchesStarts(candidate, label) {
  const startsById = new Map(candidate.starts.map((start) => [start.id, start]));

  assert(typeof candidate.seasonLogSummary === "object" && candidate.seasonLogSummary, `${label} missing seasonLogSummary`);
  assert(candidate.seasonLogSummary.recentStartCount === candidate.starts.length, `${label} seasonLogSummary recentStartCount must match returned starts`);
  assert(
    candidate.seasonLogSummary.averageGameScorePlus === Number((candidate.starts.reduce((sum, start) => sum + start.gameScorePlus, 0) / Math.max(candidate.starts.length, 1)).toFixed(1)),
    `${label} seasonLogSummary average GS+ must match returned starts`,
  );
  assert(
    candidate.seasonLogSummary.averageInningsPitched === Number((candidate.starts.reduce((sum, start) => sum + start.line.inningsPitched, 0) / Math.max(candidate.starts.length, 1)).toFixed(1)),
    `${label} seasonLogSummary average IP must match returned starts`,
  );
  if (candidate.starts.length === 0) return;

  for (const key of ["lastStart", "bestStart"]) {
    const summaryStart = candidate.seasonLogSummary[key];
    assert(typeof summaryStart?.id === "string" && summaryStart.id.length > 0, `${label} seasonLogSummary ${key} missing id`);
    const matchingStart = startsById.get(summaryStart.id);
    assert(matchingStart, `${label} seasonLogSummary ${key} must reference a returned start`);
    assert(summaryStart.date === matchingStart.date, `${label} seasonLogSummary ${key} date must match returned start`);
    assert(summaryStart.opponent === matchingStart.opponent, `${label} seasonLogSummary ${key} opponent must match returned start`);
    assert(summaryStart.result === matchingStart.result, `${label} seasonLogSummary ${key} result must match returned start`);
    assert(summaryStart.gameScorePlus === matchingStart.gameScorePlus, `${label} seasonLogSummary ${key} GS+ must match returned start`);
    assert(summaryStart.startHref === matchingStart.startHref, `${label} seasonLogSummary ${key} startHref must match returned start`);
  }

  const newestReturnedStart = [...candidate.starts].sort((a, b) => b.date.localeCompare(a.date) || (b.gamePk ?? 0) - (a.gamePk ?? 0))[0];
  assert(candidate.seasonLogSummary.lastStart.id === newestReturnedStart.id, `${label} seasonLogSummary lastStart must be the newest returned start`);
  const bestReturnedStart = candidate.starts.reduce((best, start) => (start.gameScorePlus > best.gameScorePlus ? start : best), candidate.starts[0]);
  assert(candidate.seasonLogSummary.bestStart.id === bestReturnedStart.id, `${label} seasonLogSummary bestStart must be the highest GS+ returned start`);
}

function assertSkillSnapshot(snapshot, label) {
  assert(snapshot?.status === "line-backed", `${label} skill snapshot must be line-backed`);
  assert(Number.isInteger(snapshot.starts) && snapshot.starts > 0, `${label} skill snapshot starts missing`);
  for (const key of ["inningsPitched", "era", "whip", "k9", "bb9", "kMinusBbPer9", "avgIpPerStart", "pitchesPerStart"]) {
    assert(typeof snapshot[key] === "number" && Number.isFinite(snapshot[key]), `${label} skill snapshot ${key} missing`);
  }
  assertNonNegativeInteger(snapshot.pitchCount, `${label} skill snapshot pitchCount`);
  if (snapshot.pitchCount > 0) {
    for (const key of ["cswPct", "swStrPct", "whiffPct", "avgVelocityMph", "maxVelocityMph"]) {
      assert(typeof snapshot[key] === "number" && Number.isFinite(snapshot[key]), `${label} skill snapshot ${key} missing`);
    }
  }
}

const response = await fetch(`${baseUrl}/api/pitchers/${pitcherId}`);
assert(response.ok, `pitcher ${pitcherId} returned HTTP ${response.status}`);

const pitcher = await response.json();
assert(typeof pitcher.id === "string" && pitcher.id.length > 0, "pitcher missing id");
assert(Number.isInteger(pitcher.mlbId), "pitcher missing mlbId");
assert(typeof pitcher.name === "string" && pitcher.name.length > 0, "pitcher missing name");
assert(typeof pitcher.team === "string" && pitcher.team.length > 0, "pitcher missing team");
assert(["R", "L"].includes(pitcher.throws), "pitcher throws must be R or L");
assert(typeof pitcher.headshotUrl === "string" && pitcher.headshotUrl.includes(String(pitcher.mlbId)), "pitcher headshotUrl must reference mlbId");

assert(Number.isInteger(pitcher.seasonLine?.starts) && pitcher.seasonLine.starts > 0, "pitcher seasonLine missing starts");
assert(typeof pitcher.seasonLine.inningsPitched === "number" && pitcher.seasonLine.inningsPitched > 0, "pitcher seasonLine missing innings");
assert(typeof pitcher.seasonLine.era === "number" && pitcher.seasonLine.era >= 0, "pitcher seasonLine missing era");
assert(Number.isInteger(pitcher.seasonLine.strikeouts) && pitcher.seasonLine.strikeouts >= 0, "pitcher seasonLine missing strikeouts");
assert(Number.isInteger(pitcher.seasonLine.walks) && pitcher.seasonLine.walks >= 0, "pitcher seasonLine missing walks");
assert(pitcher.skillProfile?.source === "archive-gamefeed-line", "pitcher skillProfile must use archived line data");
assert(["available", "partial", "pending"].includes(pitcher.skillProfile?.statcastStatus), "pitcher skillProfile must expose pitch-event skill availability");
assertSkillSnapshot(pitcher.skillProfile?.season, "season");
assertSkillSnapshot(pitcher.skillProfile?.trailing30, "trailing30");

assert(Array.isArray(pitcher.arsenal) && pitcher.arsenal.length > 0, "pitcher missing arsenal");
for (const pitch of pitcher.arsenal) {
  assert(typeof pitch.type === "string" && pitch.type.length > 0, "arsenal pitch missing type");
  assert(typeof pitch.usagePct === "number" && pitch.usagePct > 0, "arsenal pitch missing usagePct");
  assert(typeof pitch.avgVelocityMph === "number" && pitch.avgVelocityMph > 0, "arsenal pitch missing avgVelocityMph");
  assert(typeof pitch.whiffPct === "number" && pitch.whiffPct >= 0, "arsenal pitch missing whiffPct");
  assert(typeof pitch.calledStrikePct === "number" && pitch.calledStrikePct >= 0, "arsenal pitch missing calledStrikePct");
}

assert(Array.isArray(pitcher.starts) && pitcher.starts.length > 0, "pitcher missing starts");
if (expectedStartCount !== null) {
  assert(Number.isInteger(expectedStartCount) && expectedStartCount > 0, "THE_BUMP_EXPECT_PITCHER_STARTS must be a positive integer");
  assert(pitcher.starts.length === expectedStartCount, `pitcher starts expected ${expectedStartCount}, got ${pitcher.starts.length}`);
  assert(pitcher.seasonLine.starts === expectedStartCount, `pitcher seasonLine starts expected ${expectedStartCount}, got ${pitcher.seasonLine.starts}`);
}
assert(pitcher.seasonLogControls?.sort === "date-desc", "pitcher seasonLogControls default sort mismatch");
assert(pitcher.seasonLogControls?.result === "all", "pitcher seasonLogControls default result mismatch");
assert(pitcher.seasonLogControls.totalStartCount === pitcher.starts.length, "pitcher seasonLogControls total mismatch");
assert(pitcher.seasonLogControls.shownStartCount === pitcher.starts.length, "pitcher seasonLogControls shown mismatch");
assert(Array.isArray(pitcher.seasonLogControls.options?.sort) && pitcher.seasonLogControls.options.sort.includes("gs-desc"), "pitcher seasonLogControls sort options missing");
assert(Array.isArray(pitcher.seasonLogControls.options?.result) && pitcher.seasonLogControls.options.result.includes("ND"), "pitcher seasonLogControls result options missing");
for (const start of pitcher.starts) {
  assert(typeof start.id === "string" && start.id.length > 0, "pitcher start missing id");
  assert(typeof start.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(start.date), "pitcher start missing date");
  assert(typeof start.opponent === "string" && start.opponent.length > 0, "pitcher start missing opponent");
  assert(["W", "L", "ND"].includes(start.result), "pitcher start result must be W, L, or ND");
  assert(typeof start.line?.inningsPitched === "number" && start.line.inningsPitched > 0, "pitcher start missing line");
  assert(Number.isInteger(start.gameScorePlus) && start.gameScorePlus >= 20 && start.gameScorePlus <= 80, "pitcher start GS+ must use 20-80 scale");
  assert(start.startHref === `/starts/${start.id}`, "pitcher startHref must link to start page");
}
for (let index = 1; index < pitcher.starts.length; index += 1) {
  assert(pitcher.starts[index - 1].date >= pitcher.starts[index].date, "pitcher default starts must sort newest first");
}

const sortedResponse = await fetch(`${baseUrl}/api/pitchers/${pitcherId}?sort=gs-desc`);
assert(sortedResponse.ok, `pitcher ${pitcherId} sorted returned HTTP ${sortedResponse.status}`);
const sortedPitcher = await sortedResponse.json();
assert(sortedPitcher.seasonLogControls.sort === "gs-desc", "pitcher sorted seasonLogControls mismatch");
for (let index = 1; index < sortedPitcher.starts.length; index += 1) {
  assert(sortedPitcher.starts[index - 1].gameScorePlus >= sortedPitcher.starts[index].gameScorePlus, "pitcher starts must sort by GS+ desc");
}

const filteredResponse = await fetch(`${baseUrl}/api/pitchers/${pitcherId}?result=ND`);
assert(filteredResponse.ok, `pitcher ${pitcherId} filtered returned HTTP ${filteredResponse.status}`);
const filteredPitcher = await filteredResponse.json();
assert(filteredPitcher.seasonLogControls.result === "ND", "pitcher filtered seasonLogControls mismatch");
assert(filteredPitcher.seasonLogControls.shownStartCount === filteredPitcher.starts.length, "pitcher filtered shown count mismatch");
for (const start of filteredPitcher.starts) {
  assert(start.result === "ND", "pitcher result filter must only return ND starts");
}

const emptyFilterResponse = await fetch(`${baseUrl}/api/pitchers/${pitcherId}?result=L`);
assert(emptyFilterResponse.ok, `pitcher ${pitcherId} empty filter returned HTTP ${emptyFilterResponse.status}`);
const emptyFilterPitcher = await emptyFilterResponse.json();
assert(emptyFilterPitcher.seasonLogControls.result === "L", "pitcher empty filter controls mismatch");
assert(emptyFilterPitcher.seasonLogControls.shownStartCount === emptyFilterPitcher.starts.length, "pitcher empty filter shown count mismatch");
for (const start of emptyFilterPitcher.starts) {
  assert(start.result === "L", "pitcher empty result filter must only return L starts");
}

assert(typeof pitcher.seasonLogSummary === "object" && pitcher.seasonLogSummary, "pitcher missing seasonLogSummary");
assert(pitcher.seasonLogSummary.recentStartCount === pitcher.starts.length, "pitcher seasonLogSummary recentStartCount mismatch");
assert(typeof pitcher.seasonLogSummary.averageGameScorePlus === "number" && pitcher.seasonLogSummary.averageGameScorePlus >= 20 && pitcher.seasonLogSummary.averageGameScorePlus <= 80, "pitcher seasonLogSummary average GS+ invalid");
assert(typeof pitcher.seasonLogSummary.averageInningsPitched === "number" && pitcher.seasonLogSummary.averageInningsPitched > 0, "pitcher seasonLogSummary average IP invalid");
const startsById = new Map(pitcher.starts.map((start) => [start.id, start]));
for (const key of ["lastStart", "bestStart"]) {
  const summaryStart = pitcher.seasonLogSummary[key];
  assert(typeof summaryStart?.id === "string" && summaryStart.id.length > 0, `pitcher seasonLogSummary ${key} missing id`);
  assert(typeof summaryStart.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(summaryStart.date), `pitcher seasonLogSummary ${key} missing date`);
  assert(typeof summaryStart.opponent === "string" && summaryStart.opponent.length > 0, `pitcher seasonLogSummary ${key} missing opponent`);
  assert(["W", "L", "ND"].includes(summaryStart.result), `pitcher seasonLogSummary ${key} result invalid`);
  assert(Number.isInteger(summaryStart.gameScorePlus) && summaryStart.gameScorePlus >= 20 && summaryStart.gameScorePlus <= 80, `pitcher seasonLogSummary ${key} GS+ invalid`);
  assert(summaryStart.startHref === `/starts/${summaryStart.id}`, `pitcher seasonLogSummary ${key} startHref invalid`);
  const matchingStart = startsById.get(summaryStart.id);
  assert(matchingStart, `pitcher seasonLogSummary ${key} must reference a returned start`);
  assert(summaryStart.date === matchingStart.date, `pitcher seasonLogSummary ${key} date must match returned start`);
  assert(summaryStart.opponent === matchingStart.opponent, `pitcher seasonLogSummary ${key} opponent must match returned start`);
  assert(summaryStart.result === matchingStart.result, `pitcher seasonLogSummary ${key} result must match returned start`);
  assert(summaryStart.gameScorePlus === matchingStart.gameScorePlus, `pitcher seasonLogSummary ${key} GS+ must match returned start`);
}
assert(pitcher.seasonLogSummary.lastStart.id === pitcher.starts[0].id, "pitcher seasonLogSummary lastStart must be the newest returned start");
const bestReturnedStart = pitcher.starts.reduce((best, start) => (start.gameScorePlus > best.gameScorePlus ? start : best), pitcher.starts[0]);
assert(pitcher.seasonLogSummary.bestStart.id === bestReturnedStart.id, "pitcher seasonLogSummary bestStart must be the highest GS+ returned start");

assert(["fixture", "live-people-stats"].includes(pitcher.source?.identity), "pitcher identity source missing");
assert(["fixture", "archive-gamefeed", "live-people-stats"].includes(pitcher.source?.seasonLine), "pitcher seasonLine source missing");
assert(["fixture", "archive-gamefeed", "live-people-stats"].includes(pitcher.source?.startHistory), "pitcher startHistory source missing");
assert(["fixture", "archive-gamefeed", "live-gamefeed"].includes(pitcher.source?.arsenal), "pitcher arsenal source missing");
assert(pitcher.source.archiveArsenal === null || typeof pitcher.source.archiveArsenal === "object", "pitcher archiveArsenal source metadata must be null or object");
assert(pitcher.source.archiveProfile === null || typeof pitcher.source.archiveProfile === "object", "pitcher archiveProfile source metadata must be null or object");
if (expectedSeasonLineSource) {
  assert(pitcher.source.seasonLine === expectedSeasonLineSource, `pitcher seasonLine source expected ${expectedSeasonLineSource}, got ${pitcher.source.seasonLine}`);
}
if (expectedStartHistorySource) {
  assert(pitcher.source.startHistory === expectedStartHistorySource, `pitcher startHistory source expected ${expectedStartHistorySource}, got ${pitcher.source.startHistory}`);
}
if (expectedArsenalSource) {
  assert(pitcher.source.arsenal === expectedArsenalSource, `pitcher arsenal source expected ${expectedArsenalSource}, got ${pitcher.source.arsenal}`);
}
if (expectedArsenalPitches !== null) {
  assert(Number.isInteger(expectedArsenalPitches) && expectedArsenalPitches > 0, "THE_BUMP_EXPECT_PITCHER_ARSENAL_PITCHES must be a positive integer");
  assert(pitcher.arsenal.length === expectedArsenalPitches, `pitcher arsenal pitch count expected ${expectedArsenalPitches}, got ${pitcher.arsenal.length}`);
}
if (pitcher.source.startHistory === "archive-gamefeed") {
  const archivedGamePks = new Set();
  const archiveProfile = pitcher.source.archiveProfile;

  assert(pitcher.source.seasonLine === "archive-gamefeed", "archived pitcher start history must also use archived season line");
  assert(pitcher.seasonLine.starts === pitcher.seasonLogControls.totalStartCount, `archived pitcher seasonLine starts must match total start history, got ${pitcher.seasonLine.starts} vs ${pitcher.seasonLogControls.totalStartCount}`);
  assert(archiveProfile, "archived pitcher start history must include archive profile freshness metadata");
  assert(/^\d{4}$/.test(archiveProfile.season), "archive profile season must be a year");
  assert(/^\d{4}-\d{2}-\d{2}$/.test(archiveProfile.startDate), "archive profile startDate must be a date");
  assert(/^\d{4}-\d{2}-\d{2}$/.test(archiveProfile.endDate), "archive profile endDate must be a date");
  assert(archiveProfile.startDate <= archiveProfile.endDate, "archive profile date range must be ordered");
  assert(isIsoTimestampOnOrAfterDate(archiveProfile.archivedAt, archiveProfile.endDate), "archive profile archivedAt must be on or after archive endDate");
  assert(archiveProfile.source === "mlb-stats-api", "archive profile source must be mlb-stats-api");
  assertNonNegativeInteger(archiveProfile.dates, "archiveProfile.dates");
  assertNonNegativeInteger(archiveProfile.games, "archiveProfile.games");
  assertNonNegativeInteger(archiveProfile.completedGames, "archiveProfile.completedGames");
  assertNonNegativeInteger(archiveProfile.completedGamesWithStarts, "archiveProfile.completedGamesWithStarts");
  assertNonNegativeInteger(archiveProfile.completedGamesMissingStarts, "archiveProfile.completedGamesMissingStarts");
  assertNonNegativeInteger(archiveProfile.starts, "archiveProfile.starts");
  assertNonNegativeInteger(archiveProfile.pitchEvents, "archiveProfile.pitchEvents");
  assertNonNegativeInteger(archiveProfile.pitcherStarts, "archiveProfile.pitcherStarts");
  assert(archiveProfile.dates > 0, "archive profile must expose stored date count");
  assert(archiveProfile.games >= archiveProfile.completedGames, "archive profile completed games cannot exceed games");
  assert(
    archiveProfile.completedGamesWithStarts + archiveProfile.completedGamesMissingStarts === archiveProfile.completedGames,
    "archive profile completed-game starter coverage buckets must add to completed games",
  );
  assert(archiveProfile.starts === archiveProfile.completedGamesWithStarts * 2, "archive profile starts must equal two starts per completed game with starts");
  assert(archiveProfile.starts >= pitcher.starts.length, "archive profile stored starts must cover pitcher starts");
  assert(archiveProfile.pitchEvents > 0, "archive profile must expose stored pitch-event count");
  assert(archiveProfile.pitcherStarts === pitcher.seasonLogControls.totalStartCount, `archive profile pitcherStarts must match total start history, got ${archiveProfile.pitcherStarts} vs ${pitcher.seasonLogControls.totalStartCount}`);
  if (expectedArchiveProfileStart) {
    assert(/^\d{4}-\d{2}-\d{2}$/.test(expectedArchiveProfileStart), "THE_BUMP_EXPECT_PITCHER_ARCHIVE_START must be YYYY-MM-DD");
    assert(archiveProfile.startDate === expectedArchiveProfileStart, `archive profile startDate expected ${expectedArchiveProfileStart}, got ${archiveProfile.startDate}`);
  }
  if (expectedArchiveProfileEnd) {
    assert(archiveProfile.endDate === expectedArchiveProfileEnd, `archive profile endDate expected ${expectedArchiveProfileEnd}, got ${archiveProfile.endDate}`);
  }
  if (expectedArchiveProfileSource) {
    assert(archiveProfile.source === expectedArchiveProfileSource, `archive profile source expected ${expectedArchiveProfileSource}, got ${archiveProfile.source}`);
  }
  if (expectedArchiveProfileGames !== null) {
    assert(archiveProfile.games === expectedArchiveProfileGames, `archive profile games expected ${expectedArchiveProfileGames}, got ${archiveProfile.games}`);
  }
  if (expectedArchiveProfileCompletedGames !== null) {
    assert(archiveProfile.completedGames === expectedArchiveProfileCompletedGames, `archive profile completedGames expected ${expectedArchiveProfileCompletedGames}, got ${archiveProfile.completedGames}`);
  }
  if (expectedArchiveProfileCompletedGamesWithStarts !== null) {
    assert(
      archiveProfile.completedGamesWithStarts === expectedArchiveProfileCompletedGamesWithStarts,
      `archive profile completedGamesWithStarts expected ${expectedArchiveProfileCompletedGamesWithStarts}, got ${archiveProfile.completedGamesWithStarts}`,
    );
  }
  if (expectedArchiveProfileCompletedGamesMissingStarts !== null) {
    assert(
      archiveProfile.completedGamesMissingStarts === expectedArchiveProfileCompletedGamesMissingStarts,
      `archive profile completedGamesMissingStarts expected ${expectedArchiveProfileCompletedGamesMissingStarts}, got ${archiveProfile.completedGamesMissingStarts}`,
    );
  }
  if (expectedArchiveProfileStarts !== null) {
    assert(archiveProfile.starts === expectedArchiveProfileStarts, `archive profile starts expected ${expectedArchiveProfileStarts}, got ${archiveProfile.starts}`);
  }
  if (expectedArchiveProfilePitchEvents !== null) {
    assert(archiveProfile.pitchEvents === expectedArchiveProfilePitchEvents, `archive profile pitchEvents expected ${expectedArchiveProfilePitchEvents}, got ${archiveProfile.pitchEvents}`);
  }
  for (const [label, variant] of [
    ["sorted pitcher response", sortedPitcher],
    ["filtered pitcher response", filteredPitcher],
    ["empty filtered pitcher response", emptyFilterPitcher],
  ]) {
    assert(variant.source?.seasonLine === "archive-gamefeed", `${label} must preserve archived season line source`);
    assert(variant.source?.startHistory === "archive-gamefeed", `${label} must preserve archived start history source`);
    assertMatchingSeasonLine(variant.seasonLine, pitcher.seasonLine, label);
    assertMatchingArchiveProfile(variant.source.archiveProfile, archiveProfile, label);
    assert(variant.seasonLogControls?.totalStartCount === archiveProfile.pitcherStarts, `${label} total start count must match archived pitcher starts`);
    assert(variant.seasonLogControls.shownStartCount === variant.starts.length, `${label} shown start count must match returned starts`);
    assert(variant.seasonLogControls.shownStartCount <= variant.seasonLogControls.totalStartCount, `${label} shown starts cannot exceed archived total starts`);
    assertMatchingArchivedStartRows(variant.starts, startsById, label);
    assertSeasonLogSummaryMatchesStarts(variant, label);
  }
  assertSameArchivedStartIds(sortedPitcher.starts, pitcher.starts, "sorted pitcher response");

  const archivedSeasonLine = pitcher.starts.reduce(
    (totals, start) => ({
      inningsOuts: totals.inningsOuts + inningsToOuts(start.line.inningsPitched),
      earnedRuns: totals.earnedRuns + start.line.earnedRuns,
      strikeouts: totals.strikeouts + start.line.strikeouts,
      walks: totals.walks + start.line.walks,
    }),
    { inningsOuts: 0, earnedRuns: 0, strikeouts: 0, walks: 0 },
  );
  const archivedEra = Number(((archivedSeasonLine.earnedRuns * 27) / archivedSeasonLine.inningsOuts).toFixed(2));
  assert(inningsToOuts(pitcher.seasonLine.inningsPitched) === archivedSeasonLine.inningsOuts, "archived pitcher seasonLine innings must match returned archived starts");
  assert(pitcher.seasonLine.era === archivedEra, "archived pitcher seasonLine ERA must match returned archived starts");
  assert(pitcher.seasonLine.strikeouts === archivedSeasonLine.strikeouts, "archived pitcher seasonLine strikeouts must match returned archived starts");
  assert(pitcher.seasonLine.walks === archivedSeasonLine.walks, "archived pitcher seasonLine walks must match returned archived starts");

  for (const start of pitcher.starts) {
    assert(routeStartIdPattern.test(start.id), `archived pitcher start id is not route-safe: ${start.id}`);
    assert(start.date >= archiveProfile.startDate && start.date <= archiveProfile.endDate, `archived pitcher start ${start.id} date must fall inside archive profile range`);
    assertRouteSafeTeamAbbreviation(start.opponent, `archived pitcher start ${start.id} opponent`);
    assert(start.opponent !== pitcher.team, `archived pitcher start ${start.id} opponent must differ from pitcher team ${pitcher.team}`);
    assert(start.id.endsWith(`-${pitcher.mlbId}`), `archived pitcher start id must end with pitcher mlbId ${pitcher.mlbId}: ${start.id}`);
    assert(start.startHref === `/starts/${start.id}`, `archived pitcher startHref mismatch for ${start.id}`);
    assert(Number.isInteger(start.gamePk) && start.gamePk > 0, `archived pitcher start ${start.id} missing gamePk`);
    assert(!archivedGamePks.has(start.gamePk), `archived pitcher start history repeated gamePk ${start.gamePk}`);
    assert(Number.isInteger(start.gameScorePlus) && start.gameScorePlus >= 20 && start.gameScorePlus <= 80, `archived pitcher start ${start.id} GS+ must stay on the public 20-80 scale`);
    archivedGamePks.add(start.gamePk);
  }
  for (let index = 1; index < pitcher.starts.length; index += 1) {
    const previousStart = pitcher.starts[index - 1];
    const currentStart = pitcher.starts[index];
    if (previousStart.date === currentStart.date) {
      assert(
        previousStart.gamePk >= currentStart.gamePk,
        `archived pitcher starts on ${currentStart.date} must use gamePk desc as the default date tie-breaker`,
      );
    }
  }
}
if (pitcher.source.seasonLine === "archive-gamefeed") {
  assert(pitcher.source.startHistory === "archive-gamefeed", "archived pitcher season line must also use archived start history");
  assert(pitcher.source.archiveProfile, "archived pitcher season line must include archive profile freshness metadata");
} else {
  assert(pitcher.source.archiveProfile === null, "non-archived pitcher season line must not include archive profile freshness metadata");
}
if (pitcher.source.arsenal === "archive-gamefeed") {
  const usageTotal = pitcher.arsenal.reduce((sum, pitch) => sum + pitch.usagePct, 0);
  const archiveArsenal = pitcher.source.archiveArsenal;

  assert(usageTotal >= 98 && usageTotal <= 102, `archived pitcher arsenal usage must total about 100 after whole-percent rounding, got ${usageTotal}`);
  assert(archiveArsenal, "archived pitcher arsenal must include archive arsenal freshness metadata");
  assert(/^\d{4}$/.test(archiveArsenal.season), "archive arsenal season must be a year");
  assert(/^\d{4}-\d{2}-\d{2}$/.test(archiveArsenal.startDate), "archive arsenal startDate must be a date");
  assert(/^\d{4}-\d{2}-\d{2}$/.test(archiveArsenal.endDate), "archive arsenal endDate must be a date");
  assert(/^\d{4}-\d{2}-\d{2}$/.test(archiveArsenal.firstStartDate), "archive arsenal firstStartDate must be a date");
  assert(/^\d{4}-\d{2}-\d{2}$/.test(archiveArsenal.lastStartDate), "archive arsenal lastStartDate must be a date");
  assert(archiveArsenal.startDate <= archiveArsenal.firstStartDate, "archive arsenal firstStartDate must fall inside archive range");
  assert(archiveArsenal.firstStartDate <= archiveArsenal.lastStartDate, "archive arsenal start dates must be ordered");
  assert(archiveArsenal.lastStartDate <= archiveArsenal.endDate, "archive arsenal lastStartDate must fall inside archive range");
  assert(isIsoTimestampOnOrAfterDate(archiveArsenal.archivedAt, archiveArsenal.endDate), "archive arsenal archivedAt must be on or after archive endDate");
  assert(archiveArsenal.source === "mlb-stats-api", "archive arsenal source must be mlb-stats-api");
  assertNonNegativeInteger(archiveArsenal.starts, "archiveArsenal.starts");
  assertNonNegativeInteger(archiveArsenal.pitchEvents, "archiveArsenal.pitchEvents");
  assert(archiveArsenal.starts > 0, "archive arsenal must expose recent archived start count");
  assert(archiveArsenal.pitchEvents > 0, "archive arsenal must expose recent archived pitch-event count");
  assert(archiveArsenal.pitchEvents >= pitcher.arsenal.length, "archive arsenal pitch events must cover arsenal pitch types");
  if (expectedArchiveProfileEnd) {
    assert(archiveArsenal.endDate === expectedArchiveProfileEnd, `archive arsenal endDate expected ${expectedArchiveProfileEnd}, got ${archiveArsenal.endDate}`);
  }
  if (expectedArchiveArsenalSource) {
    assert(archiveArsenal.source === expectedArchiveArsenalSource, `archive arsenal source expected ${expectedArchiveArsenalSource}, got ${archiveArsenal.source}`);
  }
  if (expectedArchiveArsenalStarts !== null) {
    assert(archiveArsenal.starts === expectedArchiveArsenalStarts, `archive arsenal starts expected ${expectedArchiveArsenalStarts}, got ${archiveArsenal.starts}`);
  }
  if (expectedArchiveArsenalPitchEvents !== null) {
    assert(archiveArsenal.pitchEvents === expectedArchiveArsenalPitchEvents, `archive arsenal pitchEvents expected ${expectedArchiveArsenalPitchEvents}, got ${archiveArsenal.pitchEvents}`);
  }
  if (expectedArchiveArsenalFirstStart) {
    assert(/^\d{4}-\d{2}-\d{2}$/.test(expectedArchiveArsenalFirstStart), "THE_BUMP_EXPECT_PITCHER_ARCHIVE_ARSENAL_FIRST_START must be YYYY-MM-DD");
    assert(archiveArsenal.firstStartDate === expectedArchiveArsenalFirstStart, `archive arsenal firstStartDate expected ${expectedArchiveArsenalFirstStart}, got ${archiveArsenal.firstStartDate}`);
  }
  if (expectedArchiveArsenalLastStart) {
    assert(/^\d{4}-\d{2}-\d{2}$/.test(expectedArchiveArsenalLastStart), "THE_BUMP_EXPECT_PITCHER_ARCHIVE_ARSENAL_LAST_START must be YYYY-MM-DD");
    assert(archiveArsenal.lastStartDate === expectedArchiveArsenalLastStart, `archive arsenal lastStartDate expected ${expectedArchiveArsenalLastStart}, got ${archiveArsenal.lastStartDate}`);
  }
  for (const [label, variant] of [
    ["sorted pitcher response", sortedPitcher],
    ["filtered pitcher response", filteredPitcher],
    ["empty filtered pitcher response", emptyFilterPitcher],
  ]) {
    assert(variant.source?.arsenal === "archive-gamefeed", `${label} must preserve archived arsenal source`);
    assertMatchingArchiveArsenal(variant.source.archiveArsenal, archiveArsenal, label);
    assertMatchingArsenalRows(variant.arsenal, pitcher.arsenal, label);
  }
  if (pitcher.source.startHistory === "archive-gamefeed") {
    const archivedStartDates = new Set(pitcher.starts.map((start) => start.date));
    const archiveProfile = pitcher.source.archiveProfile;

    assert(archiveProfile, "archived pitcher arsenal must share archive profile metadata when start history is archived");
    assert(archiveArsenal.season === archiveProfile.season, "archive arsenal season must match archive profile season");
    assert(archiveArsenal.startDate === archiveProfile.startDate, "archive arsenal startDate must match archive profile startDate");
    assert(archiveArsenal.endDate === archiveProfile.endDate, "archive arsenal endDate must match archive profile endDate");
    assert(archiveArsenal.archivedAt === archiveProfile.archivedAt, "archive arsenal archivedAt must match archive profile archivedAt");
    assert(archiveArsenal.source === archiveProfile.source, "archive arsenal source must match archive profile source");
    assert(archiveArsenal.pitchEvents <= archiveProfile.pitchEvents, "archive arsenal pitch events cannot exceed archive profile pitch events");
    assert(archiveArsenal.starts <= pitcher.seasonLogControls.totalStartCount, "archive arsenal recent starts cannot exceed archived pitcher start history");
    assert(archivedStartDates.has(archiveArsenal.firstStartDate), "archive arsenal firstStartDate must appear in archived pitcher start history");
    assert(archivedStartDates.has(archiveArsenal.lastStartDate), "archive arsenal lastStartDate must appear in archived pitcher start history");

    const recentArsenalStarts = [...pitcher.starts]
      .sort((a, b) => b.date.localeCompare(a.date) || b.gamePk - a.gamePk)
      .slice(0, archiveArsenal.starts);
    assert(recentArsenalStarts.length === archiveArsenal.starts, "archive arsenal recent start count must be covered by archived pitcher start history");
    assert(archiveArsenal.lastStartDate === recentArsenalStarts[0]?.date, "archive arsenal lastStartDate must match the newest archived pitcher start");
    assert(archiveArsenal.firstStartDate === recentArsenalStarts.at(-1)?.date, "archive arsenal firstStartDate must match the oldest start in the recent archive window");
    assert(
      recentArsenalStarts.every((start) => start.date >= archiveArsenal.firstStartDate && start.date <= archiveArsenal.lastStartDate),
      "archive arsenal recent start window must contain only starts between firstStartDate and lastStartDate",
    );
  }
} else {
  assert(pitcher.source.archiveArsenal === null, "non-archived pitcher arsenal must not include archive arsenal freshness metadata");
}
assert(["pending-live-source", "live-people-stat-splits"].includes(pitcher.source?.splits), "pitcher splits source missing");
if (process.env.THE_BUMP_LIVE_MLB === "1") {
  assert(pitcher.source.identity === "live-people-stats", "live pitcher identity should use MLB people stats");
  assert(["archive-gamefeed", "live-people-stats"].includes(pitcher.source.seasonLine), "live pitcher seasonLine should use stored archive or MLB people stats");
  assert(["archive-gamefeed", "live-people-stats"].includes(pitcher.source.startHistory), "live pitcher startHistory should use stored archive or MLB people stats");
  assert(["archive-gamefeed", "live-gamefeed"].includes(pitcher.source.arsenal), "live pitcher arsenal should use stored archive or live MLB gamefeed pitch events");
  assert(pitcher.source.splits === "live-people-stat-splits", "live pitcher splits should use MLB statSplits");
}

assert(["pending-live-source", "live-people-stat-splits"].includes(pitcher.splits?.status), "pitcher splits status mismatch");
assert(Array.isArray(pitcher.splits?.groups) && pitcher.splits.groups.length >= 4, "pitcher splits groups missing");
for (const split of pitcher.splits.groups) {
  assert(typeof split.key === "string" && split.key.length > 0, "pitcher split missing key");
  assert(typeof split.label === "string" && split.label.length > 0, "pitcher split missing label");
  assert(["batter-hand", "venue"].includes(split.scope), "pitcher split scope mismatch");
  assert(["pending-live-source", "live-people-stat-splits"].includes(split.status), "pitcher split status mismatch");
  if (split.status === "live-people-stat-splits") {
    assert(typeof split.inningsPitched === "number" && split.inningsPitched > 0, "live pitcher split innings missing");
    assert(split.era === null || (typeof split.era === "number" && split.era >= 0), "live pitcher split era invalid");
    assert(Number.isInteger(split.strikeouts) && split.strikeouts >= 0, "live pitcher split strikeouts missing");
    assert(Number.isInteger(split.walks) && split.walks >= 0, "live pitcher split walks missing");
    assert(typeof split.opponentAverage === "number" && split.opponentAverage >= 0, "live pitcher split opponentAverage missing");
  } else {
    assert(split.inningsPitched === null, "pending pitcher split innings should be null");
    assert(split.era === null, "pending pitcher split era should be null");
    assert(split.strikeouts === null, "pending pitcher split strikeouts should be null");
    assert(split.walks === null, "pending pitcher split walks should be null");
    assert(split.opponentAverage === null, "pending pitcher split opponentAverage should be null");
  }
  assert(typeof split.note === "string" && split.note.includes("MLB"), "pitcher split note should describe live MLB source state");
}

console.log(`pitcher contract ok: ${pitcher.name} / ${pitcher.starts.length} starts / ${pitcher.arsenal.length} pitches / ${pitcher.splits.status}`);
