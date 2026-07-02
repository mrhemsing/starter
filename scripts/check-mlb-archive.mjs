import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const season = readArg("season", process.env.THE_BUMP_ARCHIVE_SEASON ?? "2026");
const archiveRoot = readArg("dir", process.env.THE_BUMP_ARCHIVE_DIR ?? path.join("data", "mlb-archive", season));
const minStarts = Number(readArg("min-starts", process.env.THE_BUMP_ARCHIVE_MIN_STARTS ?? 1));
const expectedEndDate = readArg("expect-end", process.env.THE_BUMP_ARCHIVE_EXPECT_END_DATE);
const archivePlaceholderText = new Set(["TBA", "TBD"]);
const archivedPitchEventKeys = ["id", "gamePk", "pitchNumber", "count", "inning", "type", "velocityMph", "plateX", "plateZ", "result"];
const archivedPitchEventOptionalKeys = ["statcast"];
const archivedPitchEventStatcastKeys = [
  "zone",
  "description",
  "launchSpeedMph",
  "launchAngleDeg",
  "estimatedWoba",
  "barrel",
  "hardHit",
  "releaseExtensionFt",
  "spinRateRpm",
  "pfxX",
  "pfxZ",
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isIsoTimestamp(value) {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function isMlbUtcTimestamp(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && !Number.isNaN(new Date(value).valueOf());
}

function isIsoTimestampAtOrAfter(value, floor) {
  return isIsoTimestamp(value) && isIsoTimestamp(floor) && new Date(value).valueOf() >= new Date(floor).valueOf();
}

function isIsoTimestampAtOrAfterParsableTimestamp(value, floor) {
  return isIsoTimestamp(value) && typeof floor === "string" && !Number.isNaN(new Date(floor).valueOf()) && new Date(value).valueOf() >= new Date(floor).valueOf();
}

function isIsoTimestampOnOrAfterDate(value, date) {
  return isIsoTimestamp(value) && typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && value.slice(0, 10) >= date;
}

function normalizedArchiveRootPath(value) {
  return typeof value === "string" ? value.replaceAll("\\", "/") : "";
}

function assertNonNegativeInteger(value, label) {
  assert(Number.isInteger(value) && value >= 0, `${label} must be a non-negative integer`);
}

function assertExactKeys(value, expectedKeys, label) {
  assert(value && typeof value === "object", `${label} must be an object`);
  const keys = Object.keys(value);
  assert(keys.length === expectedKeys.length, `${label} must contain only ${expectedKeys.join(", ")}`);
  for (const key of expectedKeys) {
    assert(keys.includes(key), `${label} missing ${key}`);
  }
}

function assertRequiredKeysWithOptional(value, requiredKeys, optionalKeys, label) {
  if (!value || typeof value !== "object") {
    throw new Error(`${label} must be an object`);
  }
  const keys = Object.keys(value);
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  for (const key of requiredKeys) {
    assert(keys.includes(key), `${label} missing ${key}`);
  }
  for (const key of keys) {
    assert(allowed.has(key), `${label} contains unexpected ${key}`);
  }
}

function assertInningsPitched(value, label) {
  assert(Number.isFinite(value) && value >= 0, `${label} must be a non-negative number`);
  assert(Math.round(value * 10) % 10 <= 2, `${label} must use baseball outs notation`);
}

function inningsToOuts(value) {
  return Math.trunc(value) * 3 + Math.round((value - Math.trunc(value)) * 10);
}

function assertRouteSafeTeamAbbreviation(value, label) {
  assert(typeof value === "string" && /^[A-Z0-9]+$/.test(value), `${label} must be route-safe uppercase letters/digits`);
}

function assertKnownArchiveText(value, label) {
  assert(typeof value === "string" && value.trim().length > 0, `${label} must be present`);
  assert(!archivePlaceholderText.has(value.trim().toUpperCase()), `${label} must not be a placeholder for completed games`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

const manifestPath = path.join(archiveRoot, "manifest.json");
const manifest = await readJson(manifestPath);
assertExactKeys(manifest, ["season", "startDate", "endDate", "archivedAt", "source", "archiveRoot", "counts", "dates"], "manifest");
assert(manifest.season === season, `manifest season expected ${season}, got ${manifest.season}`);
assert(manifest.source === "mlb-stats-api", "manifest source must be mlb-stats-api");
assert(normalizedArchiveRootPath(manifest.archiveRoot) === normalizedArchiveRootPath(archiveRoot), `manifest archiveRoot ${manifest.archiveRoot ?? "missing"} must match ${archiveRoot}`);
assert(isIsoTimestamp(manifest.archivedAt), "manifest archivedAt must be an ISO timestamp");
assert(Array.isArray(manifest.dates) && manifest.dates.length > 0, "manifest dates must be a non-empty array");
assertExactKeys(manifest.counts, ["dates", "games", "completedGames", "starts", "pitchEvents"], "manifest counts");
assertNonNegativeInteger(manifest.counts?.dates, "manifest counts.dates");
assertNonNegativeInteger(manifest.counts?.games, "manifest counts.games");
assertNonNegativeInteger(manifest.counts?.completedGames, "manifest counts.completedGames");
assertNonNegativeInteger(manifest.counts?.starts, "manifest counts.starts");
assertNonNegativeInteger(manifest.counts?.pitchEvents, "manifest counts.pitchEvents");
assert(manifest.counts.dates === manifest.dates.length, "manifest counts.dates must match date summaries");
assert(manifest.counts.completedGames <= manifest.counts.games, "manifest completedGames cannot exceed games");
assert(manifest.counts.starts <= manifest.counts.completedGames * 2, "manifest starts cannot exceed two starts per completed game");
assert(manifest.counts.starts % 2 === 0, "manifest starts must be even");
assert(manifest.counts?.starts >= minStarts, `archive has ${manifest.counts?.starts ?? 0} starts, expected at least ${minStarts}`);
assert(typeof manifest.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(manifest.startDate) && manifest.startDate.startsWith(`${season}-`), `manifest startDate ${manifest.startDate ?? "missing"} must belong to season ${season}`);
assert(typeof manifest.endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(manifest.endDate) && manifest.endDate.startsWith(`${season}-`), `manifest endDate ${manifest.endDate ?? "missing"} must belong to season ${season}`);

const dateFiles = (await readdir(path.join(archiveRoot, "dates"))).filter((file) => file.endsWith(".json")).sort();
assert(dateFiles.length === manifest.counts.dates, `date file count ${dateFiles.length} does not match manifest ${manifest.counts.dates}`);

const fileDates = dateFiles.map((file) => file.replace(/\.json$/, ""));
assert(fileDates.every((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)), "date shard filenames must use YYYY-MM-DD");
assert(fileDates.every((date) => date.startsWith(`${season}-`)), `date shard filenames must belong to season ${season}`);
assert(manifest.startDate === fileDates[0], `manifest startDate ${manifest.startDate ?? "missing"} does not match first date shard ${fileDates[0] ?? "missing"}`);
assert(manifest.endDate === fileDates.at(-1), `manifest endDate ${manifest.endDate ?? "missing"} does not match last date shard ${fileDates.at(-1) ?? "missing"}`);
assert(isIsoTimestampOnOrAfterDate(manifest.archivedAt, manifest.endDate), `manifest archivedAt must be on or after endDate ${manifest.endDate ?? "missing"}`);
if (expectedEndDate) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(expectedEndDate), `expect-end must be YYYY-MM-DD, got ${expectedEndDate}`);
  assert(manifest.endDate === expectedEndDate, `manifest endDate ${manifest.endDate ?? "missing"} does not match expected ${expectedEndDate}`);
}

const manifestDateSummaries = new Map((manifest.dates ?? []).map((dateSummary) => [dateSummary.date, dateSummary]));
assert(manifestDateSummaries.size === dateFiles.length, `manifest date summaries ${manifestDateSummaries.size} do not match date file count ${dateFiles.length}`);
assert(
  (manifest.dates ?? []).every((dateSummary, index) => dateSummary.date === fileDates[index]),
  "manifest date summaries must match sorted date shards"
);
assert(
  fileDates.every((date, index) => index === 0 || date === nextArchiveDate(fileDates[index - 1])),
  "date shards must be continuous from manifest startDate through endDate"
);

const manifestDateTotals = (manifest.dates ?? []).reduce(
  (sum, dateSummary) => ({
    games: sum.games + (dateSummary.games ?? 0),
    completedGames: sum.completedGames + (dateSummary.completedGames ?? 0),
    starts: sum.starts + (dateSummary.starts ?? 0),
    pitchEvents: sum.pitchEvents + (dateSummary.pitchEvents ?? 0),
  }),
  { games: 0, completedGames: 0, starts: 0, pitchEvents: 0 }
);
assert(manifestDateTotals.games === manifest.counts.games, `manifest date game total ${manifestDateTotals.games} does not match counts.games ${manifest.counts.games}`);
assert(manifestDateTotals.completedGames === manifest.counts.completedGames, `manifest date completed-game total ${manifestDateTotals.completedGames} does not match counts.completedGames ${manifest.counts.completedGames}`);
assert(manifestDateTotals.starts === manifest.counts.starts, `manifest date start total ${manifestDateTotals.starts} does not match counts.starts ${manifest.counts.starts}`);
assert(manifestDateTotals.pitchEvents === manifest.counts.pitchEvents, `manifest date pitch-event total ${manifestDateTotals.pitchEvents} does not match counts.pitchEvents ${manifest.counts.pitchEvents}`);

for (const dateSummary of manifest.dates ?? []) {
  assertExactKeys(dateSummary, ["date", "games", "completedGames", "starts", "pitchEvents"], `manifest ${dateSummary.date ?? "missing"} summary`);
  assert(typeof dateSummary.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateSummary.date), `manifest date ${dateSummary.date ?? "missing"} must use YYYY-MM-DD`);
  assert(dateSummary.date.startsWith(`${season}-`), `manifest date ${dateSummary.date ?? "missing"} must belong to season ${season}`);
  assertNonNegativeInteger(dateSummary.games, `manifest ${dateSummary.date ?? "missing"} games`);
  assertNonNegativeInteger(dateSummary.completedGames, `manifest ${dateSummary.date ?? "missing"} completedGames`);
  assertNonNegativeInteger(dateSummary.starts, `manifest ${dateSummary.date ?? "missing"} starts`);
  assertNonNegativeInteger(dateSummary.pitchEvents, `manifest ${dateSummary.date ?? "missing"} pitchEvents`);
  assert(dateSummary.completedGames <= dateSummary.games, `manifest ${dateSummary.date ?? "missing"} completedGames cannot exceed games`);
  assert(dateSummary.starts <= dateSummary.completedGames * 2, `manifest ${dateSummary.date ?? "missing"} starts cannot exceed two starts per completed game`);
  assert(dateSummary.starts % 2 === 0, `manifest ${dateSummary.date ?? "missing"} starts must be even`);
}

let starts = 0;
let pitchEvents = 0;
let games = 0;
let completedGames = 0;
let dateFilesWithStarts = 0;
const missingPitchEventStarts = [];
const archivedStartRouteIds = new Map();
const archivedPitchTypes = new Set(["FF", "SI", "SL", "CH", "CU", "FC"]);
const archivedPitchResults = new Set(["called_strike", "swinging_strike", "foul", "ball", "hit_into_play"]);

function archivedStartRouteId(date, start) {
  return `${date}-${start.team.toLowerCase()}-${start.opponent.toLowerCase()}-${start.pitcherMlbId}`;
}

function isArchivedCompletedGame(game) {
  return game.status?.abstract === "Final" || game.status?.detailed === "Final" || game.status?.detailed === "Completed Early";
}

function archivedGameDateBelongsToShard(gameDate, archiveDate) {
  if (typeof gameDate !== "string" || Number.isNaN(new Date(gameDate).valueOf())) return false;
  const nextUtcDate = new Date(`${archiveDate}T00:00:00.000Z`);
  nextUtcDate.setUTCDate(nextUtcDate.getUTCDate() + 1);
  return gameDate.slice(0, 10) === archiveDate || gameDate.slice(0, 10) === nextUtcDate.toISOString().slice(0, 10);
}

function nextArchiveDate(date) {
  const nextUtcDate = new Date(`${date}T00:00:00.000Z`);
  nextUtcDate.setUTCDate(nextUtcDate.getUTCDate() + 1);
  return nextUtcDate.toISOString().slice(0, 10);
}

function assertArchivedTeam(team, label) {
  assertExactKeys(team, ["id", "abbreviation", "name"], label);
  assert(Number.isInteger(team?.id) && team.id > 0, `${label} id must be a positive integer`);
  assertRouteSafeTeamAbbreviation(team?.abbreviation, `${label} abbreviation`);
  assert(typeof team?.name === "string" && team.name.length > 0, `${label} name must be present`);
}

function assertArchivedGame(game, archiveDate, label) {
  assertExactKeys(
    game,
    game.error === undefined
      ? ["gamePk", "gameDate", "status", "venue", "awayTeam", "homeTeam", "starts"]
      : ["gamePk", "gameDate", "status", "venue", "awayTeam", "homeTeam", "starts", "error"],
    label
  );
  assert(Number.isInteger(game.gamePk) && game.gamePk > 0, `${label} gamePk must be a positive integer`);
  assert(isMlbUtcTimestamp(game.gameDate), `${label} gameDate must be an MLB UTC timestamp`);
  assert(archivedGameDateBelongsToShard(game.gameDate, archiveDate), `${label} gameDate must match the archive shard date or next UTC date`);
  assertExactKeys(game.status, ["abstract", "detailed"], `${label} status`);
  assert(typeof game.status?.abstract === "string" && game.status.abstract.length > 0, `${label} status.abstract must be present`);
  assert(typeof game.status?.detailed === "string" && game.status.detailed.length > 0, `${label} status.detailed must be present`);
  assert(typeof game.venue === "string" && game.venue.length > 0, `${label} venue must be present`);
  assert(game.error === undefined || (typeof game.error === "string" && game.error.length > 0), `${label} error must be a non-empty string when present`);
  assert(!isArchivedCompletedGame(game) || typeof game.error !== "string" || game.error.length === 0, `${label} completed game must not carry an archive error`);
  assertArchivedTeam(game.awayTeam, `${label} awayTeam`);
  assertArchivedTeam(game.homeTeam, `${label} homeTeam`);
  if (isArchivedCompletedGame(game)) {
    assertKnownArchiveText(game.venue, `${label} venue`);
    assertKnownArchiveText(game.awayTeam.abbreviation, `${label} awayTeam abbreviation`);
    assertKnownArchiveText(game.awayTeam.name, `${label} awayTeam name`);
    assertKnownArchiveText(game.homeTeam.abbreviation, `${label} homeTeam abbreviation`);
    assertKnownArchiveText(game.homeTeam.name, `${label} homeTeam name`);
  }
  assert(game.awayTeam.abbreviation !== game.homeTeam.abbreviation, `${label} away/home teams must be different`);
}

function assertArchivedCompletedGameFreshness(game, archivedAt, label) {
  if (isArchivedCompletedGame(game)) {
    assert(isIsoTimestampAtOrAfterParsableTimestamp(archivedAt, game.gameDate), `${label} archivedAt must be at or after completed gameDate`);
  }
}

function assertArchivedStartMatchesGameTeams(start, game, label) {
  const expectedTeam = start.side === "away" ? game.awayTeam?.abbreviation : game.homeTeam?.abbreviation;
  const expectedOpponent = start.side === "away" ? game.homeTeam?.abbreviation : game.awayTeam?.abbreviation;
  assert(start.team === expectedTeam, `${label} team ${start.team ?? "missing"} must match ${start.side} game team ${expectedTeam ?? "missing"}`);
  assert(start.opponent === expectedOpponent, `${label} opponent ${start.opponent ?? "missing"} must match ${start.side} game opponent ${expectedOpponent ?? "missing"}`);
}

function assertArchivedGameStartLayout(game, label) {
  assert(game.starts === undefined || Array.isArray(game.starts), `${label} starts must be an array when present`);

  const starts = game.starts ?? [];
  const sides = new Set(starts.map((start) => start.side));
  const pitcherIds = new Set(starts.map((start) => start.pitcherMlbId));
  if (isArchivedCompletedGame(game)) {
    assert(starts.length !== 1, `${label} completed game must store zero or two starter rows`);
  }
  assert(starts.length <= 2, `${label} must not store more than two starter rows`);
  assert(starts.length !== 2 || (starts[0].side === "away" && starts[1].side === "home"), `${label} full starter rows must be ordered away then home`);
  assert(sides.size === starts.length, `${label} must not store duplicate starter sides`);
  assert(pitcherIds.size === starts.length, `${label} must not store duplicate starter pitcher ids`);
}

function assertArchivedStartLine(start, label) {
  assertRequiredKeysWithOptional(start.line, ["inningsPitched", "hits", "earnedRuns", "walks", "strikeouts", "pitches"], ["runsAllowed", "homeRunsAllowed"], `${label} line`);
  assertInningsPitched(start.line?.inningsPitched, `${label} line inningsPitched`);
  assert(Number.isInteger(start.line?.hits) && start.line.hits >= 0, `${label} line hits must be a non-negative integer`);
  assert(Number.isInteger(start.line?.earnedRuns) && start.line.earnedRuns >= 0, `${label} line earnedRuns must be a non-negative integer`);
  if (start.line.runsAllowed !== undefined) {
    assert(Number.isInteger(start.line.runsAllowed) && start.line.runsAllowed >= 0, `${label} line runsAllowed must be a non-negative integer`);
  }
  if (start.line.homeRunsAllowed !== undefined) {
    assert(Number.isInteger(start.line.homeRunsAllowed) && start.line.homeRunsAllowed >= 0, `${label} line homeRunsAllowed must be a non-negative integer`);
  }
  assert(Number.isInteger(start.line?.walks) && start.line.walks >= 0, `${label} line walks must be a non-negative integer`);
  assert(Number.isInteger(start.line?.strikeouts) && start.line.strikeouts >= 0, `${label} line strikeouts must be a non-negative integer`);
  assert(start.line.strikeouts <= inningsToOuts(start.line.inningsPitched), `${label} line strikeouts cannot exceed recorded outs`);
  assert(Number.isInteger(start.line?.pitches) && start.line.pitches > 0, `${label} line pitches must be a positive integer`);
  const minimumCompletedPlateAppearances = inningsToOuts(start.line.inningsPitched) + start.line.hits + start.line.walks;
  assert(start.line.pitches >= minimumCompletedPlateAppearances, `${label} line pitches must cover recorded outs, hits, and walks`);
}

function assertArchivedArsenal(start, label) {
  assert(Array.isArray(start.arsenal), `${label} arsenal must be an array`);
  if ((start.pitchEventCount ?? 0) === 0) {
    assert(start.arsenal.length === 0, `${label} missing-pitch starts must not store arsenal rows`);
    return;
  }

  assert(start.arsenal.length > 0, `${label} starts with pitches must store arsenal rows`);
  for (const pitch of start.arsenal) {
    assertExactKeys(pitch, ["type", "usagePct", "avgVelocityMph", "whiffPct", "calledStrikePct"], `${label} arsenal ${pitch.type ?? "missing"}`);
    assert(archivedPitchTypes.has(pitch.type), `${label} arsenal type ${pitch.type ?? "missing"} is unsupported`);
    assert(Number.isInteger(pitch.usagePct) && pitch.usagePct >= 1 && pitch.usagePct <= 100, `${label} arsenal usagePct must be 1-100`);
    assert(Number.isFinite(pitch.avgVelocityMph) && pitch.avgVelocityMph > 0, `${label} arsenal avgVelocityMph must be positive`);
    assert(Number.isInteger(pitch.whiffPct) && pitch.whiffPct >= 0 && pitch.whiffPct <= 100, `${label} arsenal whiffPct must be 0-100`);
    assert(Number.isInteger(pitch.calledStrikePct) && pitch.calledStrikePct >= 0 && pitch.calledStrikePct <= 100, `${label} arsenal calledStrikePct must be 0-100`);
  }
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

function assertArchivedArsenalMatchesPitchEvents(start, label) {
  if ((start.pitchEventCount ?? 0) === 0) return;

  const expectedArsenal = summarizePitchEvents(start.pitchEvents);
  assert(start.arsenal.length === expectedArsenal.length, `${label} arsenal count must match pitch-event types`);
  assert(
    start.arsenal.every((pitch, index) => pitch.type === expectedArsenal[index]?.type),
    `${label} arsenal order must match archived pitch-event type order`
  );

  for (const expectedPitch of expectedArsenal) {
    const actualPitch = start.arsenal.find((pitch) => pitch.type === expectedPitch.type);
    assert(actualPitch, `${label} arsenal missing ${expectedPitch.type}`);
    assert(actualPitch.usagePct === expectedPitch.usagePct, `${label} ${expectedPitch.type} arsenal usagePct mismatch`);
    assert(actualPitch.avgVelocityMph === expectedPitch.avgVelocityMph, `${label} ${expectedPitch.type} arsenal avgVelocityMph mismatch`);
    assert(actualPitch.whiffPct === expectedPitch.whiffPct, `${label} ${expectedPitch.type} arsenal whiffPct mismatch`);
    assert(actualPitch.calledStrikePct === expectedPitch.calledStrikePct, `${label} ${expectedPitch.type} arsenal calledStrikePct mismatch`);
  }
}

function assertArchivedPitchDetailCoverage(starts, pitchEvents, label) {
  const startsWithPitchEvents = starts.filter((start) => (start.pitchEventCount ?? 0) > 0).length;
  const startsMissingPitchEvents = starts.filter((start) => start.source?.pitchEvents === "missing-gamefeed-pitches").length;

  assert(
    startsWithPitchEvents + startsMissingPitchEvents === starts.length,
    `${label} pitch-detail coverage buckets must add to archived starts`
  );
  assert(
    startsWithPitchEvents === 0 ? pitchEvents === 0 : pitchEvents >= startsWithPitchEvents,
    `${label} pitch events must cover starts marked with stored pitch detail`
  );
}

function assertArchivedPitchEvent(start, pitchEvent, index, label) {
  assertRequiredKeysWithOptional(pitchEvent, archivedPitchEventKeys, archivedPitchEventOptionalKeys, `${label} pitch ${index + 1}`);
  assert(pitchEvent.id === `${start.gamePk}-${start.pitcherMlbId}-${index + 1}`, `${label} pitch ${index + 1} id must match game/pitcher/sequence`);
  assert(pitchEvent.gamePk === start.gamePk, `${label} pitch ${index + 1} gamePk must match start`);
  assert(pitchEvent.pitchNumber === index + 1, `${label} pitch ${index + 1} pitchNumber must be sequential`);
  assert(Number.isInteger(pitchEvent.inning) && pitchEvent.inning > 0, `${label} pitch ${index + 1} inning must be a positive integer`);
  assertExactKeys(pitchEvent.count, ["balls", "strikes"], `${label} pitch ${index + 1} count`);
  assert(Number.isInteger(pitchEvent.count?.balls) && pitchEvent.count.balls >= 0 && pitchEvent.count.balls <= 3, `${label} pitch ${index + 1} balls must be 0-3`);
  assert(Number.isInteger(pitchEvent.count?.strikes) && pitchEvent.count.strikes >= 0 && pitchEvent.count.strikes <= 2, `${label} pitch ${index + 1} strikes must be 0-2`);
  assert(archivedPitchTypes.has(pitchEvent.type), `${label} pitch ${index + 1} type ${pitchEvent.type ?? "missing"} is unsupported`);
  assert(archivedPitchResults.has(pitchEvent.result), `${label} pitch ${index + 1} result ${pitchEvent.result ?? "missing"} is unsupported`);
  assert(Number.isFinite(pitchEvent.velocityMph) && pitchEvent.velocityMph > 0, `${label} pitch ${index + 1} velocityMph must be positive`);
  assert(Number.isFinite(pitchEvent.plateX), `${label} pitch ${index + 1} plateX must be finite`);
  assert(Number.isFinite(pitchEvent.plateZ), `${label} pitch ${index + 1} plateZ must be finite`);
  assertArchivedPitchEventStatcast(pitchEvent.statcast, `${label} pitch ${index + 1}`);
}

function assertArchivedPitchEventStatcast(statcast, label) {
  if (statcast === undefined) return;
  assertRequiredKeysWithOptional(statcast, [], archivedPitchEventStatcastKeys, `${label} statcast`);

  assertOptionalFiniteNumber(statcast.zone, `${label} statcast.zone`);
  assertOptionalString(statcast.description, `${label} statcast.description`);
  assertOptionalFiniteNumber(statcast.launchSpeedMph, `${label} statcast.launchSpeedMph`);
  assertOptionalFiniteNumber(statcast.launchAngleDeg, `${label} statcast.launchAngleDeg`);
  assertOptionalFiniteNumber(statcast.estimatedWoba, `${label} statcast.estimatedWoba`);
  assertOptionalBoolean(statcast.barrel, `${label} statcast.barrel`);
  assertOptionalBoolean(statcast.hardHit, `${label} statcast.hardHit`);
  assertOptionalFiniteNumber(statcast.releaseExtensionFt, `${label} statcast.releaseExtensionFt`);
  assertOptionalFiniteNumber(statcast.spinRateRpm, `${label} statcast.spinRateRpm`);
  assertOptionalFiniteNumber(statcast.pfxX, `${label} statcast.pfxX`);
  assertOptionalFiniteNumber(statcast.pfxZ, `${label} statcast.pfxZ`);
}

function assertOptionalFiniteNumber(value, label) {
  assert(value === undefined || value === null || Number.isFinite(value), `${label} must be finite, null, or omitted`);
}

function assertOptionalString(value, label) {
  assert(value === undefined || value === null || typeof value === "string", `${label} must be a string, null, or omitted`);
}

function assertOptionalBoolean(value, label) {
  assert(value === undefined || value === null || typeof value === "boolean", `${label} must be boolean, null, or omitted`);
}

function assertArchivedPitchEventOrder(start, label) {
  for (const [index, pitchEvent] of start.pitchEvents.entries()) {
    const previousPitchEvent = start.pitchEvents[index - 1];
    assert(
      !previousPitchEvent || pitchEvent.inning >= previousPitchEvent.inning,
      `${label} pitch ${index + 1} inning must not move before the previous archived pitch`,
    );
  }
}

function assertArchivedStartSource(start, label) {
  assert(start.source && Object.keys(start.source).length === 2, `${label} source must contain only line and pitchEvents`);
  assert(start.source.line === "live-gamefeed", `${label} line source must be live-gamefeed`);
  assert(
    start.source.pitchEvents === "live-gamefeed" || start.source.pitchEvents === "missing-gamefeed-pitches",
    `${label} pitch-event source must be live-gamefeed or missing-gamefeed-pitches`
  );
}

for (const file of dateFiles) {
  const dateArchive = await readJson(path.join(archiveRoot, "dates", file));
  const expectedDate = file.replace(/\.json$/, "");
  assertExactKeys(dateArchive, ["season", "date", "archivedAt", "source", "counts", "games"], file);
  assert(dateArchive.season === season, `${file} season expected ${season}, got ${dateArchive.season}`);
  assert(dateArchive.date === expectedDate, `${file} date expected ${expectedDate}, got ${dateArchive.date}`);
  assert(dateArchive.source === "mlb-stats-api", `${file} source must be mlb-stats-api`);
  assert(isIsoTimestamp(dateArchive.archivedAt), `${file} archivedAt must be an ISO timestamp`);
  assert(isIsoTimestampOnOrAfterDate(dateArchive.archivedAt, dateArchive.date), `${file} archivedAt must be on or after archive date ${dateArchive.date}`);
  assert(isIsoTimestampAtOrAfter(manifest.archivedAt, dateArchive.archivedAt), `manifest archivedAt must be at or after ${file} archivedAt`);
  assert(Array.isArray(dateArchive.games), `${file} games must be an array`);
  assertExactKeys(dateArchive.counts, ["games", "completedGames", "starts", "pitchEvents"], `${file} counts`);

  const gamePks = new Set();
  for (const game of dateArchive.games) {
    assertArchivedGame(game, dateArchive.date, `${file} game ${game.gamePk ?? "missing"}`);
    assertArchivedCompletedGameFreshness(game, dateArchive.archivedAt, `${file} game ${game.gamePk ?? "missing"}`);
    assertArchivedGameStartLayout(game, `${file} game ${game.gamePk ?? "missing"}`);
    assert(!gamePks.has(game.gamePk), `${file} duplicate gamePk ${game.gamePk}`);
    gamePks.add(game.gamePk);
    for (const start of game.starts ?? []) {
      assert(start.gamePk === game.gamePk, `${file} game ${game.gamePk} contains start for gamePk ${start.gamePk ?? "missing"}`);
    }
  }

  const fileGameCount = dateArchive.games.length;
  const fileCompletedGames = dateArchive.games.filter(isArchivedCompletedGame).length;
  const fileStarts = dateArchive.games.flatMap((game) => game.starts ?? []);
  const filePitchEvents = fileStarts.reduce((sum, start) => sum + (start.pitchEventCount ?? 0), 0);
  assert(
    dateArchive.games.every((game) => isArchivedCompletedGame(game) || (game.starts ?? []).length === 0),
    `${file} non-completed games must not contain archived starts`
  );
  assert(dateArchive.counts?.games === fileGameCount, `${file} game count ${dateArchive.counts?.games ?? "missing"} does not match ${fileGameCount}`);
  assert(dateArchive.counts?.completedGames === fileCompletedGames, `${file} completed game count ${dateArchive.counts?.completedGames ?? "missing"} does not match ${fileCompletedGames}`);
  assert(dateArchive.counts?.starts === fileStarts.length, `${file} start count ${dateArchive.counts?.starts ?? "missing"} does not match ${fileStarts.length}`);
  assert(dateArchive.counts?.pitchEvents === filePitchEvents, `${file} pitch event count ${dateArchive.counts?.pitchEvents ?? "missing"} does not match ${filePitchEvents}`);
  assertArchivedPitchDetailCoverage(fileStarts, filePitchEvents, file);

  const manifestDateSummary = manifestDateSummaries.get(dateArchive.date);
  assert(manifestDateSummary, `manifest missing date summary for ${dateArchive.date}`);
  assert(manifestDateSummary.games === fileGameCount, `${file} manifest game count ${manifestDateSummary.games ?? "missing"} does not match ${fileGameCount}`);
  assert(manifestDateSummary.completedGames === fileCompletedGames, `${file} manifest completed game count ${manifestDateSummary.completedGames ?? "missing"} does not match ${fileCompletedGames}`);
  assert(manifestDateSummary.starts === fileStarts.length, `${file} manifest start count ${manifestDateSummary.starts ?? "missing"} does not match ${fileStarts.length}`);
  assert(manifestDateSummary.pitchEvents === filePitchEvents, `${file} manifest pitch event count ${manifestDateSummary.pitchEvents ?? "missing"} does not match ${filePitchEvents}`);

  starts += fileStarts.length;
  pitchEvents += filePitchEvents;
  games += fileGameCount;
  completedGames += fileCompletedGames;
  if (fileStarts.length > 0) dateFilesWithStarts += 1;

  for (const start of fileStarts) {
    const startLabel = `${file} start ${start.gamePk ?? "missing"}:${start.pitcherMlbId ?? "missing"}`;
    assertExactKeys(start, ["id", "gamePk", "pitcherMlbId", "pitcherName", "team", "opponent", "side", "result", "line", "pitchEventCount", "arsenal", "pitchEvents", "source"], startLabel);
    assert(Number.isInteger(start.gamePk) && start.gamePk > 0, `${startLabel} gamePk must be a positive integer`);
    assert(Number.isInteger(start.pitcherMlbId) && start.pitcherMlbId > 0, `${startLabel} pitcherMlbId must be a positive integer`);
    assert(start.id === `${start.gamePk}-${start.pitcherMlbId}`, `${startLabel} id must match gamePk-pitcherMlbId`);
    assert(typeof start.pitcherName === "string" && start.pitcherName.length > 0, `${startLabel} pitcherName must be present`);
    assertRouteSafeTeamAbbreviation(start.team, `${startLabel} team`);
    assertRouteSafeTeamAbbreviation(start.opponent, `${startLabel} opponent`);
    assert(start.team !== start.opponent, `${startLabel} team and opponent must be different`);
    assert(start.side === "home" || start.side === "away", `${startLabel} side must be home or away`);
    assert(["W", "L", "ND"].includes(start.result), `${startLabel} result must be W, L, or ND`);
    const startGame = dateArchive.games.find((game) => game.gamePk === start.gamePk);
    assert(startGame, `${startLabel} must belong to a stored game`);
    assertArchivedStartMatchesGameTeams(start, startGame, startLabel);
    assertArchivedStartLine(start, startLabel);
    assertArchivedArsenal(start, startLabel);

    const routeId = archivedStartRouteId(dateArchive.date, start);
    const previousRouteIdStart = archivedStartRouteIds.get(routeId);
    assert(!previousRouteIdStart, `${file} duplicate archived start route id ${routeId}; first seen at ${previousRouteIdStart ?? "unknown"}`);
    archivedStartRouteIds.set(routeId, `${dateArchive.date}:${start.gamePk}:${start.pitcherMlbId}`);
    assert(/^\d{4}-\d{2}-\d{2}-[a-z0-9]+-[a-z0-9]+-\d+$/.test(routeId), `${file} start ${start.gamePk}:${start.pitcherMlbId} generated invalid route id ${routeId}`);
    assert(Array.isArray(start.pitchEvents), `${file} start ${start.gamePk}:${start.pitcherMlbId} missing pitchEvents[]`);
    assert(start.pitchEvents.length === (start.pitchEventCount ?? 0), `${file} start ${start.gamePk}:${start.pitcherMlbId} pitchEvents length does not match pitchEventCount`);
    assert(start.line.pitches >= start.pitchEvents.length, `${file} start ${start.gamePk}:${start.pitcherMlbId} line pitches must cover stored pitch events`);
    start.pitchEvents.forEach((pitchEvent, index) => assertArchivedPitchEvent(start, pitchEvent, index, startLabel));
    assertArchivedPitchEventOrder(start, startLabel);
    assertArchivedArsenalMatchesPitchEvents(start, startLabel);
    assertArchivedStartSource(start, startLabel);

    if ((start.pitchEventCount ?? 0) === 0) {
      assert(start.source?.pitchEvents === "missing-gamefeed-pitches", `${file} start ${start.gamePk}:${start.pitcherMlbId} missing pitch-event marker`);
      missingPitchEventStarts.push(`${dateArchive.date}:${start.gamePk}:${start.pitcherMlbId}`);
    } else {
      assert(start.source?.pitchEvents === "live-gamefeed", `${file} start ${start.gamePk}:${start.pitcherMlbId} pitch-event source must be live-gamefeed`);
    }
  }
}

assert(starts === manifest.counts.starts, `start count ${starts} does not match manifest ${manifest.counts.starts}`);
assert(pitchEvents === manifest.counts.pitchEvents, `pitch event count ${pitchEvents} does not match manifest ${manifest.counts.pitchEvents}`);
assert(games === manifest.counts.games, `game count ${games} does not match manifest ${manifest.counts.games}`);
assert(completedGames === manifest.counts.completedGames, `completed game count ${completedGames} does not match manifest ${manifest.counts.completedGames}`);

console.log(
  `mlb archive ok: ${season}, ${manifest.startDate}..${manifest.endDate}, ${starts} starts, ${pitchEvents} pitch events, ${dateFilesWithStarts}/${dateFiles.length} date file(s) with starts`
);

if (missingPitchEventStarts.length > 0) {
  console.log(`starts missing pitch events (${missingPitchEventStarts.length}, marked missing-gamefeed-pitches): ${missingPitchEventStarts.slice(0, 10).join(", ")}${missingPitchEventStarts.length > 10 ? " ..." : ""}`);
}
