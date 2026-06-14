const baseUrl = process.env.THE_BUMP_BASE_URL ?? "http://127.0.0.1:3000";
const slateDate = process.env.THE_BUMP_CONTRACT_DATE ?? "2026-05-24";
const expectedSchedule = process.env.THE_BUMP_EXPECT_SCHEDULE_SOURCE;
const expectedCompletedStats = process.env.THE_BUMP_EXPECT_COMPLETED_STATS_SOURCE;
const expectedArchiveDate = process.env.THE_BUMP_EXPECT_ARCHIVE_DATE;
const expectedArchiveSource = process.env.THE_BUMP_EXPECT_ARCHIVE_SOURCE;
const expectedArchiveCompletedGames = readOptionalIntegerEnv("THE_BUMP_EXPECT_ARCHIVE_COMPLETED_GAMES");
const expectedArchiveCompletedGamesWithStarts = readOptionalIntegerEnv("THE_BUMP_EXPECT_ARCHIVE_COMPLETED_GAMES_WITH_STARTS");
const expectedArchiveCompletedGamesMissingStarts = readOptionalIntegerEnv("THE_BUMP_EXPECT_ARCHIVE_COMPLETED_GAMES_MISSING_STARTS");
const expectedArchiveReturnedFinalGames = readOptionalIntegerEnv("THE_BUMP_EXPECT_ARCHIVE_RETURNED_FINAL_GAMES");
const expectedArchiveGames = readOptionalIntegerEnv("THE_BUMP_EXPECT_ARCHIVE_GAMES");
const expectedArchiveStarts = readOptionalIntegerEnv("THE_BUMP_EXPECT_ARCHIVE_STARTS");
const expectedArchivePitchEvents = readOptionalIntegerEnv("THE_BUMP_EXPECT_ARCHIVE_PITCH_EVENTS");
const expectedArchiveStartsWithPitchEvents = readOptionalIntegerEnv("THE_BUMP_EXPECT_ARCHIVE_STARTS_WITH_PITCH_EVENTS");
const expectedArchiveMissingPitchStarts = readOptionalIntegerEnv("THE_BUMP_EXPECT_ARCHIVE_MISSING_PITCH_STARTS");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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

function readOptionalIntegerEnv(name) {
  const value = process.env[name];
  if (value === undefined || value === "") return null;
  const parsed = Number(value);
  assert(Number.isInteger(parsed) && parsed >= 0, `${name} must be a non-negative integer`);
  return parsed;
}

function assertNonNegativeInteger(value, field) {
  assert(Number.isInteger(value) && value >= 0, `${field} must be a non-negative integer`);
}

function assertInningsPitched(value, field) {
  assert(Number.isFinite(value) && value >= 0, `${field} must be a non-negative number`);
  assert(Math.round(value * 10) % 10 <= 2, `${field} must use baseball outs notation`);
}

function assertStartLine(line, field) {
  assert(line && typeof line === "object", `${field} line must be an object`);
  assertInningsPitched(line.inningsPitched, `${field}.line.inningsPitched`);
  assertNonNegativeInteger(line.hits, `${field}.line.hits`);
  assertNonNegativeInteger(line.earnedRuns, `${field}.line.earnedRuns`);
  assertNonNegativeInteger(line.walks, `${field}.line.walks`);
  assertNonNegativeInteger(line.strikeouts, `${field}.line.strikeouts`);
  assert(Number.isInteger(line.pitches) && line.pitches > 0, `${field}.line.pitches must be a positive integer`);
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

function isFinalGameStatus(value) {
  return typeof value === "string" && value.toLowerCase() === "final";
}

function isUnstartedGameStatus(value) {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return ["preview", "pre-game", "scheduled", "warmup"].includes(normalized) || /\b\d{1,2}:\d{2}\s?(am|pm)\b/.test(normalized);
}

function parseGameLabelTeams(game) {
  assert(typeof game.label === "string" && game.label.includes(" @ "), `game ${game.gamePk} label must include away/home teams`);
  const [awayTeam, homeTeam] = game.label.split(" @ ");
  assert(isRouteSafeTeamAbbreviation(awayTeam), `game ${game.gamePk} away label team must be route-safe`);
  assert(isRouteSafeTeamAbbreviation(homeTeam), `game ${game.gamePk} home label team must be route-safe`);
  assert(awayTeam !== homeTeam, `game ${game.gamePk} label teams must differ`);
  return { awayTeam, homeTeam };
}

async function checkSlate(window, date) {
  const response = await fetch(`${baseUrl}/api/slate/${window}/${date}`);
  assert(response.ok, `${window} slate returned HTTP ${response.status}`);

  const slate = await response.json();
  assert(slate.window === window, `${window} slate window mismatch`);
  assert(slate.date === date, `${window} slate date mismatch`);
  assert(Number.isInteger(slate.counts?.starts), `${window} slate missing starts count`);
  assert(Number.isInteger(slate.counts?.probables), `${window} slate missing probable count`);
  assert(Number.isInteger(slate.counts?.games), `${window} slate missing game count`);
  assert(Array.isArray(slate.games), `${window} slate missing games[]`);
  assert(Array.isArray(slate.probables), `${window} slate missing probables[]`);
  assert(Array.isArray(slate.starts), `${window} slate missing starts[]`);
  assert(slate.counts.games === slate.games.length, `${window} slate game count must match games[] length`);
  assert(slate.counts.probables === slate.probables.length, `${window} slate probable count must match probables[] length`);
  assert(slate.counts.starts === slate.starts.length, `${window} slate starts count must match starts[] length`);
  const slateGamePks = new Set(slate.games.map((game) => game.gamePk));
  const slateGamesByPk = new Map(slate.games.map((game) => [game.gamePk, game]));
  assert(slateGamePks.size === slate.games.length, `${window} slate games must not contain duplicate gamePk values`);
  assert(slate.scoreScale?.formulaVersion === "context-v7", `${window} slate scoreScale formula mismatch`);
  assert(slate.scoreScale?.displayRange === "20-80", `${window} slate scoreScale display range mismatch`);
  assert(typeof slate.scoreScale?.average === "number", `${window} slate scoreScale missing average`);
  assert(Number.isInteger(slate.scoreScale?.low), `${window} slate scoreScale missing low`);
  assert(Number.isInteger(slate.scoreScale?.high), `${window} slate scoreScale missing high`);
  assert(Array.isArray(slate.scoreScale?.explanation) && slate.scoreScale.explanation.length === 3, `${window} slate scoreScale missing contracted explanation steps`);
  for (const step of slate.scoreScale.explanation) {
    assert(typeof step.label === "string" && step.label.length > 0, `${window} slate scoreScale explanation label missing`);
    assert(typeof step.value === "string" && step.value.length > 0, `${window} slate scoreScale explanation value missing`);
    assert(typeof step.description === "string" && step.description.length > 0, `${window} slate scoreScale explanation description missing`);
  }
  assert(Array.isArray(slate.scoreScale?.gradeBandCounts) && slate.scoreScale.gradeBandCounts.length === 5, `${window} slate scoreScale missing grade band counts`);
  assert(slate.scoreScale.low >= 20 && slate.scoreScale.high <= 80 && slate.scoreScale.low <= slate.scoreScale.high, `${window} slate scoreScale range must stay on 20-80 scale`);
  assert(slate.scoreDeltaComparison && typeof slate.scoreDeltaComparison === "object", `${window} slate missing scoreDeltaComparison`);
  assert(slate.scoreDeltaComparison.leader?.rank === 1, `${window} slate scoreDeltaComparison leader must be rank 1`);
  assert(typeof slate.scoreDeltaComparison.leader?.pitcherName === "string" && slate.scoreDeltaComparison.leader.pitcherName.length > 0, `${window} slate scoreDeltaComparison leader pitcher missing`);
  assert(typeof slate.scoreDeltaComparison.leader?.gameScorePlus === "number", `${window} slate scoreDeltaComparison leader score missing`);
  assert(Array.isArray(slate.scoreDeltaComparison.comparedStarts) && slate.scoreDeltaComparison.comparedStarts.length >= 2 && slate.scoreDeltaComparison.comparedStarts.length <= 3, `${window} slate scoreDeltaComparison compared starts invalid`);
  assert(Array.isArray(slate.scoreDeltaComparison.components) && slate.scoreDeltaComparison.components.length === 3, `${window} slate scoreDeltaComparison must expose the leader's three ranking drivers`);
  for (const component of slate.scoreDeltaComparison.components) {
    assert(typeof component.key === "string" && component.key.length > 0, `${window} slate scoreDeltaComparison component key missing`);
    assert(typeof component.label === "string" && component.label.length > 0, `${window} slate scoreDeltaComparison component label missing`);
    assert(typeof component.description === "string" && component.description.length > 0, `${window} slate scoreDeltaComparison component description missing`);
    assert(typeof component.leaderValue === "number", `${window} slate scoreDeltaComparison leader value missing`);
    assert(Array.isArray(component.rows) && component.rows.length === slate.scoreDeltaComparison.comparedStarts.length, `${window} slate scoreDeltaComparison component rows mismatch`);
    assert(component.rows[0]?.rank === slate.scoreDeltaComparison.leader.rank, `${window} slate scoreDeltaComparison first row must be leader`);
    assert(component.rows[0]?.deltaVsLeader === 0, `${window} slate scoreDeltaComparison leader delta must be zero`);
    for (const row of component.rows) {
      assert(typeof row.pitcherName === "string" && row.pitcherName.length > 0, `${window} slate scoreDeltaComparison row pitcher missing`);
      assert(typeof row.value === "number", `${window} slate scoreDeltaComparison row value missing`);
      assert(typeof row.deltaVsLeader === "number", `${window} slate scoreDeltaComparison row delta missing`);
    }
  }
  assertExactKeys(slate.source, ["schedule", "completedStartStats", "completedStartStatsCoverage", "archiveDate"], "source");
  assertExactKeys(slate.source.completedStartStatsCoverage, ["total", "archiveGamefeed", "liveGamefeed", "fixture"], "source.completedStartStatsCoverage");
  assertSource(slate.source.schedule, ["fixture", "live"], "source.schedule");
  assertSource(slate.source?.completedStartStats, ["fixture", "archive-gamefeed", "live-gamefeed"], "source.completedStartStats");
  assertNonNegativeInteger(slate.source?.completedStartStatsCoverage?.total, "source.completedStartStatsCoverage.total");
  assertNonNegativeInteger(slate.source.completedStartStatsCoverage.archiveGamefeed, "source.completedStartStatsCoverage.archiveGamefeed");
  assertNonNegativeInteger(slate.source.completedStartStatsCoverage.liveGamefeed, "source.completedStartStatsCoverage.liveGamefeed");
  assertNonNegativeInteger(slate.source.completedStartStatsCoverage.fixture, "source.completedStartStatsCoverage.fixture");
  assert(
    slate.source.completedStartStatsCoverage.total === slate.counts.starts,
    "source.completedStartStatsCoverage total must match starts count",
  );
  assert(
    slate.source.completedStartStatsCoverage.archiveGamefeed + slate.source.completedStartStatsCoverage.liveGamefeed + slate.source.completedStartStatsCoverage.fixture === slate.source.completedStartStatsCoverage.total,
    "source.completedStartStatsCoverage buckets must add to total",
  );
  if (slate.source.completedStartStatsCoverage.archiveGamefeed > 0) {
    assert(slate.source.completedStartStats === "archive-gamefeed", "archived completed-start rows must drive source.completedStartStats");
  } else if (slate.source.completedStartStatsCoverage.liveGamefeed > 0) {
    assert(slate.source.completedStartStats === "live-gamefeed", "live completed-start rows must drive source.completedStartStats when archive rows are absent");
  } else {
    assert(slate.source.completedStartStats === "fixture", "fixture-only completed-start rows must drive source.completedStartStats");
  }
  assert(slate.source.archiveDate === null || typeof slate.source.archiveDate === "object", "source.archiveDate must be null or object");
  if (slate.source.completedStartStatsCoverage.archiveGamefeed > 0) {
    assert(slate.source.archiveDate, "archive completed-start coverage must include archive date freshness metadata");
  }
  if (slate.source.archiveDate) {
    assertExactKeys(slate.source.archiveDate, ["date", "archivedAt", "source", "games", "completedGames", "completedGamesWithStarts", "completedGamesMissingStarts", "starts", "pitchEvents", "startsWithPitchEvents", "startsMissingPitchEvents"], "source.archiveDate");
    assert(slate.source.archiveDate.date === date, "source.archiveDate date must match slate date");
    assert(isIsoTimestamp(slate.source.archiveDate.archivedAt), "source.archiveDate archivedAt must be an ISO timestamp");
    assert(isIsoTimestampOnOrAfterDate(slate.source.archiveDate.archivedAt, date), "source.archiveDate archivedAt must be on or after the slate date");
    assert(slate.source.archiveDate.source === "mlb-stats-api", "source.archiveDate source must be mlb-stats-api");
    assertNonNegativeInteger(slate.source.archiveDate.games, "source.archiveDate.games");
    assertNonNegativeInteger(slate.source.archiveDate.completedGames, "source.archiveDate.completedGames");
    assertNonNegativeInteger(slate.source.archiveDate.completedGamesWithStarts, "source.archiveDate.completedGamesWithStarts");
    assertNonNegativeInteger(slate.source.archiveDate.completedGamesMissingStarts, "source.archiveDate.completedGamesMissingStarts");
    assertNonNegativeInteger(slate.source.archiveDate.starts, "source.archiveDate.starts");
    assertNonNegativeInteger(slate.source.archiveDate.pitchEvents, "source.archiveDate.pitchEvents");
    assertNonNegativeInteger(slate.source.archiveDate.startsWithPitchEvents, "source.archiveDate.startsWithPitchEvents");
    assertNonNegativeInteger(slate.source.archiveDate.startsMissingPitchEvents, "source.archiveDate.startsMissingPitchEvents");
    assert(slate.source.archiveDate.completedGames <= slate.source.archiveDate.games, "source.archiveDate completedGames cannot exceed games");
    assert(
      slate.source.archiveDate.completedGamesWithStarts + slate.source.archiveDate.completedGamesMissingStarts === slate.source.archiveDate.completedGames,
      "source.archiveDate completed game starter coverage buckets must add to completed games",
    );
    assert(
      slate.source.archiveDate.starts <= slate.source.archiveDate.completedGamesWithStarts * 2,
      "source.archiveDate starts cannot exceed two starts per completed game with stored starts",
    );
    assert(
      slate.source.archiveDate.completedGamesWithStarts === 0 ? slate.source.archiveDate.starts === 0 : slate.source.archiveDate.starts > 0,
      "source.archiveDate starts must match completed-game starter coverage",
    );
    if (slate.source.completedStartStatsCoverage.archiveGamefeed > 0) {
      assert(slate.counts.games === slate.source.archiveDate.games, "archive-backed slate game count must match stored archive date games");
    }
    assert(slate.source.archiveDate.starts <= slate.source.archiveDate.completedGames * 2, "source.archiveDate starts cannot exceed two archived starts per completed game");
    assert(slate.source.archiveDate.starts % 2 === 0, "source.archiveDate starts must be even");
    assert(
      slate.source.archiveDate.startsWithPitchEvents + slate.source.archiveDate.startsMissingPitchEvents === slate.source.archiveDate.starts,
      "source.archiveDate pitch-detail coverage buckets must add to archived starts",
    );
    assert(
      slate.source.archiveDate.startsWithPitchEvents === 0 ? slate.source.archiveDate.pitchEvents === 0 : slate.source.archiveDate.pitchEvents > 0,
      "source.archiveDate pitchEvents must match startsWithPitchEvents coverage",
    );
    assert(
      slate.source.archiveDate.pitchEvents >= slate.source.archiveDate.startsWithPitchEvents,
      "source.archiveDate pitchEvents must cover archived starts with pitch events",
    );
    assert(
      slate.source.completedStartStatsCoverage.archiveGamefeed <= slate.source.archiveDate.starts,
      "source.archiveDate starts must cover archived completed-start rows",
    );
    if (slate.source.completedStartStatsCoverage.archiveGamefeed > 0) {
      assert(
        slate.source.completedStartStatsCoverage.archiveGamefeed === slate.source.archiveDate.starts,
        "archive-backed slate coverage must expose every stored archived start",
      );
    }
    if (slate.source.completedStartStats === "archive-gamefeed") {
      assert(slate.source.completedStartStatsCoverage.archiveGamefeed > 0, "archive-gamefeed completed stats must report archived row coverage");
    }
  } else {
    assert(slate.source.completedStartStatsCoverage.archiveGamefeed === 0, "missing archive date metadata cannot report archived row coverage");
    assert(slate.source.completedStartStats !== "archive-gamefeed", "missing archive date metadata cannot report archive-gamefeed completed stats");
  }

  for (const probable of slate.probables) {
    assert(typeof probable.id === "string" && probable.id.length > 0, `${window} probable missing id`);
    assert(Number.isInteger(probable.gamePk), `${window} probable ${probable.id} missing gamePk`);
    assert(slateGamePks.has(probable.gamePk), `${window} probable ${probable.id} gamePk must belong to a slate game`);
    const probableGame = slateGamesByPk.get(probable.gamePk);
    assert(probableGame && isUnstartedGameStatus(probableGame.status), `${window} probable ${probable.id} must belong to an unstarted game`);
    assert(isUnstartedGameStatus(probable.status), `${window} probable ${probable.id} must expose an unstarted status`);
  }

  if (expectedSchedule) {
    assert(slate.source.schedule === expectedSchedule, `source.schedule expected ${expectedSchedule}, got ${slate.source.schedule}`);
  }

  if (expectedCompletedStats) {
    assert(slate.source.completedStartStats === expectedCompletedStats, `source.completedStartStats expected ${expectedCompletedStats}, got ${slate.source.completedStartStats}`);
    if (expectedCompletedStats === "archive-gamefeed") {
      assert(slate.source.completedStartStatsCoverage.archiveGamefeed > 0, "expected archived completed starts coverage");
      assert(slate.source.archiveDate, "expected archive date freshness metadata");
      if (expectedArchiveDate && window === "today") {
        assert(/^\d{4}-\d{2}-\d{2}$/.test(expectedArchiveDate), "THE_BUMP_EXPECT_ARCHIVE_DATE must be YYYY-MM-DD");
        assert(slate.source.archiveDate.date === expectedArchiveDate, `source.archiveDate.date expected ${expectedArchiveDate}, got ${slate.source.archiveDate.date}`);
      }
      if (expectedArchiveSource && window === "today") {
        assert(slate.source.archiveDate.source === expectedArchiveSource, `source.archiveDate.source expected ${expectedArchiveSource}, got ${slate.source.archiveDate.source}`);
      }
      if (expectedArchiveGames !== null && window === "today") {
        assert(slate.source.archiveDate.games === expectedArchiveGames, `source.archiveDate.games expected ${expectedArchiveGames}, got ${slate.source.archiveDate.games}`);
      }
      if (expectedArchiveCompletedGames !== null && window === "today") {
        assert(slate.source.archiveDate.completedGames === expectedArchiveCompletedGames, `source.archiveDate.completedGames expected ${expectedArchiveCompletedGames}, got ${slate.source.archiveDate.completedGames}`);
      }
      if (expectedArchiveCompletedGamesWithStarts !== null && window === "today") {
        assert(
          slate.source.archiveDate.completedGamesWithStarts === expectedArchiveCompletedGamesWithStarts,
          `source.archiveDate.completedGamesWithStarts expected ${expectedArchiveCompletedGamesWithStarts}, got ${slate.source.archiveDate.completedGamesWithStarts}`,
        );
      }
      if (expectedArchiveCompletedGamesMissingStarts !== null && window === "today") {
        assert(
          slate.source.archiveDate.completedGamesMissingStarts === expectedArchiveCompletedGamesMissingStarts,
          `source.archiveDate.completedGamesMissingStarts expected ${expectedArchiveCompletedGamesMissingStarts}, got ${slate.source.archiveDate.completedGamesMissingStarts}`,
        );
      }
      if (expectedArchiveStarts !== null && window === "today") {
        assert(slate.source.archiveDate.starts === expectedArchiveStarts, `source.archiveDate.starts expected ${expectedArchiveStarts}, got ${slate.source.archiveDate.starts}`);
        assert(
          slate.source.completedStartStatsCoverage.archiveGamefeed === expectedArchiveStarts,
          `source.completedStartStatsCoverage.archiveGamefeed expected ${expectedArchiveStarts}, got ${slate.source.completedStartStatsCoverage.archiveGamefeed}`,
        );
      }
      if (expectedArchivePitchEvents !== null && window === "today") {
        assert(slate.source.archiveDate.pitchEvents === expectedArchivePitchEvents, `source.archiveDate.pitchEvents expected ${expectedArchivePitchEvents}, got ${slate.source.archiveDate.pitchEvents}`);
      }
      if (expectedArchiveStartsWithPitchEvents !== null && window === "today") {
        assert(
          slate.source.archiveDate.startsWithPitchEvents === expectedArchiveStartsWithPitchEvents,
          `source.archiveDate.startsWithPitchEvents expected ${expectedArchiveStartsWithPitchEvents}, got ${slate.source.archiveDate.startsWithPitchEvents}`,
        );
      }
      if (expectedArchiveMissingPitchStarts !== null && window === "today") {
        assert(slate.source.archiveDate.startsMissingPitchEvents === expectedArchiveMissingPitchStarts, `source.archiveDate.startsMissingPitchEvents expected ${expectedArchiveMissingPitchStarts}, got ${slate.source.archiveDate.startsMissingPitchEvents}`);
      }
    }
    if (expectedCompletedStats === "live-gamefeed") {
      assert(slate.source.completedStartStatsCoverage.liveGamefeed > 0, "expected live completed starts coverage");
    }
  }

  const observedCompletedStatsCoverage = {
    archiveGamefeed: 0,
    liveGamefeed: 0,
    fixture: 0,
  };
  const observedStartRanks = new Set();
  const observedStartsByGame = new Map();
  const observedFinalGamePks = new Set();
  let previousRankedScore = null;

  for (const [index, start] of slate.starts.entries()) {
    assert(typeof start.id === "string" && start.id.length > 0, `${window} start missing id`);
    assert(start.date === date, `${window} start ${start.id} date must match slate date`);
    assert(Number.isInteger(start.rank) && start.rank === index + 1, `${window} start ${start.id} rank must match ranked slate order`);
    assert(!observedStartRanks.has(start.rank), `${window} start rank ${start.rank} must be unique`);
    observedStartRanks.add(start.rank);
    assert(Number.isInteger(start.gamePk), `${window} start ${start.id} missing gamePk`);
    assert(slateGamePks.has(start.gamePk), `${window} start ${start.id} gamePk must belong to a slate game`);
    const slateGame = slateGamesByPk.get(start.gamePk);
    assert(Number.isInteger(start.pitcherMlbId), `${window} start ${start.id} missing pitcherMlbId`);
    assert(isRouteSafeTeamAbbreviation(start.team), `${window} start ${start.id} team must be route-safe uppercase letters/digits`);
    assert(isRouteSafeTeamAbbreviation(start.opponent), `${window} start ${start.id} opponent must be route-safe uppercase letters/digits`);
    assert(start.team !== start.opponent, `${window} start ${start.id} team and opponent must be different`);
    assert(
      start.id === `${start.date}-${start.team.toLowerCase()}-${start.opponent.toLowerCase()}-${start.pitcherMlbId}`,
      `${window} start ${start.id} id must match date/team/opponent/pitcher route identity`,
    );
    assertStartLine(start.line, `${window} start ${start.id}`);
    const gameStarts = observedStartsByGame.get(start.gamePk) ?? { count: 0, pitcherIds: new Set(), pitcherIdsByTeam: new Map(), opponentsByTeam: new Map(), teams: new Set(), opponents: new Set() };
    gameStarts.count += 1;
    assert(gameStarts.count <= 2, `${window} game ${start.gamePk} cannot expose more than two starts`);
    assert(!gameStarts.pitcherIds.has(start.pitcherMlbId), `${window} game ${start.gamePk} cannot repeat starter pitcher ${start.pitcherMlbId}`);
    gameStarts.pitcherIds.add(start.pitcherMlbId);
    gameStarts.pitcherIdsByTeam.set(start.team, start.pitcherMlbId);
    gameStarts.opponentsByTeam.set(start.team, start.opponent);
    gameStarts.teams.add(start.team);
    gameStarts.opponents.add(start.opponent);
    observedStartsByGame.set(start.gamePk, gameStarts);
    assert(start.gameScorePlusBreakdown?.total === start.gameScorePlus, `${window} start ${start.id} GS+ breakdown total mismatch`);
    assert(start.gameScorePlusBreakdown?.formulaVersion === "context-v7", `${window} start ${start.id} GS+ breakdown formula mismatch`);
    assert(start.gameScorePlusBreakdown.total >= 20 && start.gameScorePlusBreakdown.total <= 80, `${window} start ${start.id} GS+ total must use the 20-80 display scale`);
    assert(previousRankedScore === null || start.gameScorePlus <= previousRankedScore, `${window} start ${start.id} rank order must follow descending GS+`);
    previousRankedScore = start.gameScorePlus;
    assert(typeof start.gameScorePlusBreakdown.gradeBand?.label === "string" && start.gameScorePlusBreakdown.gradeBand.label.length > 0, `${window} start ${start.id} missing GS+ grade label`);
    assert(typeof start.gameScorePlusBreakdown.gradeBand?.percentileLabel === "string" && start.gameScorePlusBreakdown.gradeBand.percentileLabel.length > 0, `${window} start ${start.id} missing GS+ percentile label`);
    assert(typeof start.gameScorePlusBreakdown.gradeBand?.rangeLabel === "string" && start.gameScorePlusBreakdown.gradeBand.rangeLabel.length > 0, `${window} start ${start.id} missing GS+ range label`);
    assert(Array.isArray(start.gameScorePlusBreakdown?.components) && start.gameScorePlusBreakdown.components.length >= 11, `${window} start ${start.id} missing GS+ line/stuff/park/opponent/offense components`);
    assert(Array.isArray(start.gameScorePlusBreakdown?.rankingReasons) && start.gameScorePlusBreakdown.rankingReasons.length === 3, `${window} start ${start.id} missing 3 ranking reasons`);
    for (const reason of start.gameScorePlusBreakdown.rankingReasons) {
      assert(typeof reason.key === "string" && reason.key.length > 0, `${window} start ${start.id} ranking reason key missing`);
      assert(typeof reason.label === "string" && reason.label.length > 0, `${window} start ${start.id} ranking reason label missing`);
      assert(typeof reason.value === "number" && reason.value !== 0, `${window} start ${start.id} ranking reason value invalid`);
      assert(typeof reason.description === "string" && reason.description.length > 0, `${window} start ${start.id} ranking reason description missing`);
      assert(["positive", "negative"].includes(reason.impact), `${window} start ${start.id} ranking reason impact invalid`);
      assert(reason.key !== "baseline" && reason.key !== "calibration", `${window} start ${start.id} ranking reason must exclude baseline/calibration`);
    }
    const scoreKeys = new Set(start.gameScorePlusBreakdown.components.map((component) => component.key));
    assert(scoreKeys.has("whiffDelta"), `${window} start ${start.id} missing whiffDelta context`);
    assert(scoreKeys.has("velocityDelta"), `${window} start ${start.id} missing velocityDelta context`);
    assert(scoreKeys.has("parkContext"), `${window} start ${start.id} missing parkContext context`);
    assert(scoreKeys.has("opponentQuality"), `${window} start ${start.id} missing opponentQuality context`);
    assert(scoreKeys.has("opponentOffense"), `${window} start ${start.id} missing opponentOffense context`);
    assertSource(start.source?.schedule, ["fixture", "live"], `${start.id}.source.schedule`);
    assertSource(start.source?.line, ["fixture", "archive-gamefeed", "live-gamefeed"], `${start.id}.source.line`);
    assertSource(start.source?.ranking, ["schedule-derived-fixture-line", "schedule-derived-archive-line", "schedule-derived-gamefeed-line"], `${start.id}.source.ranking`);
    if (start.source.line === "archive-gamefeed") {
      observedCompletedStatsCoverage.archiveGamefeed += 1;
      assert(slateGame && isFinalGameStatus(slateGame.status), `${window} archived start ${start.id} must belong to a returned final game`);
      assert(start.source.ranking === "schedule-derived-archive-line", `${window} start ${start.id} archived line must use archive-derived ranking`);
    } else if (start.source.line === "live-gamefeed") {
      observedCompletedStatsCoverage.liveGamefeed += 1;
      assert(start.source.ranking === "schedule-derived-gamefeed-line", `${window} start ${start.id} live line must use gamefeed-derived ranking`);
    } else {
      observedCompletedStatsCoverage.fixture += 1;
      assert(start.source.ranking === "schedule-derived-fixture-line", `${window} start ${start.id} fixture line must use fixture-derived ranking`);
    }
  }

  if (slate.source.completedStartStatsCoverage.archiveGamefeed > 0) {
    for (const game of slate.games.filter((slateGame) => isFinalGameStatus(slateGame.status))) {
      observedFinalGamePks.add(game.gamePk);
      const gameStarts = observedStartsByGame.get(game.gamePk);
      const { awayTeam, homeTeam } = parseGameLabelTeams(game);

      assert(gameStarts?.count === 2, `${window} archived final game ${game.gamePk} must expose two starter rows`);
      assert(gameStarts.teams.size === 2, `${window} archived final game ${game.gamePk} must expose two starter teams`);
      assert(gameStarts.opponents.size === 2, `${window} archived final game ${game.gamePk} must expose two starter opponents`);
      assert(gameStarts.teams.has(awayTeam), `${window} archived final game ${game.gamePk} must expose an away starter for ${awayTeam}`);
      assert(gameStarts.teams.has(homeTeam), `${window} archived final game ${game.gamePk} must expose a home starter for ${homeTeam}`);
      assert(gameStarts.opponents.has(awayTeam), `${window} archived final game ${game.gamePk} must expose ${awayTeam} as an opponent`);
      assert(gameStarts.opponents.has(homeTeam), `${window} archived final game ${game.gamePk} must expose ${homeTeam} as an opponent`);
      assert(game.probablePitcherIds.length === 2, `${window} archived final game ${game.gamePk} must expose two probable pitcher ids`);
      assert(
        game.probablePitcherIds.every((pitcherId) => gameStarts.pitcherIds.has(pitcherId)),
        `${window} archived final game ${game.gamePk} probable pitcher ids must match archived starter rows`,
      );
      assert(
        game.probablePitcherIds[0] === gameStarts.pitcherIdsByTeam.get(awayTeam),
        `${window} archived final game ${game.gamePk} first probable pitcher id must match the archived away starter`,
      );
      assert(
        game.probablePitcherIds[1] === gameStarts.pitcherIdsByTeam.get(homeTeam),
        `${window} archived final game ${game.gamePk} second probable pitcher id must match the archived home starter`,
      );
      assert(
        gameStarts.opponentsByTeam.get(awayTeam) === homeTeam,
        `${window} archived final game ${game.gamePk} away starter opponent must match home team ${homeTeam}`,
      );
      assert(
        gameStarts.opponentsByTeam.get(homeTeam) === awayTeam,
        `${window} archived final game ${game.gamePk} home starter opponent must match away team ${awayTeam}`,
      );
      assert(
        [...gameStarts.teams].every((team) => gameStarts.opponents.has(team)),
        `${window} archived final game ${game.gamePk} starter teams and opponents must mirror each other`,
      );
    }

    assert(
      slate.source.archiveDate.completedGamesWithStarts === observedFinalGamePks.size,
      `${window} archiveDate completedGamesWithStarts must match returned final games with starter rows`,
    );
    assert(
      slate.source.archiveDate.completedGamesMissingStarts === slate.source.archiveDate.completedGames - observedFinalGamePks.size,
      `${window} archiveDate completedGamesMissingStarts must match archived completed games absent from returned final starter rows`,
    );
    if (expectedArchiveReturnedFinalGames !== null && window === "today") {
      assert(
        observedFinalGamePks.size === expectedArchiveReturnedFinalGames,
        `${window} returned final archive games expected ${expectedArchiveReturnedFinalGames}, got ${observedFinalGamePks.size}`,
      );
    }
  }

  assert(
    observedCompletedStatsCoverage.archiveGamefeed === slate.source.completedStartStatsCoverage.archiveGamefeed,
    `${window} archive completed-start coverage must match start source lines`,
  );
  assert(
    observedCompletedStatsCoverage.liveGamefeed === slate.source.completedStartStatsCoverage.liveGamefeed,
    `${window} live completed-start coverage must match start source lines`,
  );
  assert(
    observedCompletedStatsCoverage.fixture === slate.source.completedStartStatsCoverage.fixture,
    `${window} fixture completed-start coverage must match start source lines`,
  );
  assert(observedStartRanks.size === slate.starts.length, `${window} start ranks must cover every returned start`);

  return slate;
}

const today = await checkSlate("today", slateDate);
const yesterdayDate = new Date(`${slateDate}T00:00:00.000Z`);
yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
const yesterday = await checkSlate("yesterday", yesterdayDate.toISOString().slice(0, 10));

console.log(`slate contract ok: today ${today.counts.games} games / yesterday ${yesterday.counts.starts} starts / ${yesterday.source.completedStartStats}`);
