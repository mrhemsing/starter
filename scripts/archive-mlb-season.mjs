import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const MLB_STATS_API_BASE = "https://statsapi.mlb.com/api/v1";
const MLB_GAME_FEED_BASE = "https://statsapi.mlb.com/api/v1.1/game";
const DEFAULT_SEASON = "2026";
const CONCURRENCY = Number(process.env.THE_BUMP_ARCHIVE_CONCURRENCY ?? 4);
const ARCHIVED_PITCH_TYPES = new Set(["FF", "SI", "SL", "CH", "CU", "FC"]);
const ARCHIVED_PITCH_RESULTS = new Set(["called_strike", "swinging_strike", "foul", "ball", "hit_into_play"]);
const ARCHIVE_PLACEHOLDER_TEXT = new Set(["TBA", "TBD"]);
const ARCHIVED_PITCH_EVENT_KEYS = ["id", "gamePk", "pitchNumber", "count", "inning", "type", "velocityMph", "plateX", "plateZ", "result"];
const ARCHIVED_PITCH_EVENT_OPTIONAL_KEYS = ["statcast"];
const ARCHIVED_PITCH_EVENT_STATCAST_KEYS = [
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

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const season = readArg("season", process.env.THE_BUMP_ARCHIVE_SEASON ?? DEFAULT_SEASON);
const refreshDate = readArg("date", process.env.THE_BUMP_ARCHIVE_DATE);
const startDate = refreshDate ?? readArg("start", process.env.THE_BUMP_ARCHIVE_START ?? `${season}-03-01`);
const today = new Date().toISOString().slice(0, 10);
const defaultEndDate = today.startsWith(`${season}-`) ? today : `${season}-12-31`;
const endDate = refreshDate ?? readArg("end", process.env.THE_BUMP_ARCHIVE_END ?? defaultEndDate);
const archiveRoot = readArg("out", process.env.THE_BUMP_ARCHIVE_DIR ?? path.join("data", "mlb-archive", season));

function assertDate(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD, got ${value}`);
  }
}

function assertSeasonDate(value, label) {
  assertDate(value, label);
  if (!value.startsWith(`${season}-`)) {
    throw new Error(`${label} must belong to season ${season}, got ${value}`);
  }
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

function assertExactKeys(value, expectedKeys, label) {
  if (!value || typeof value !== "object") {
    throw new Error(`${label} must be an object`);
  }
  const keys = Object.keys(value);
  if (keys.length !== expectedKeys.length) {
    throw new Error(`${label} must contain only ${expectedKeys.join(", ")}`);
  }
  for (const key of expectedKeys) {
    if (!keys.includes(key)) {
      throw new Error(`${label} missing ${key}`);
    }
  }
}

function assertRequiredKeysWithOptional(value, requiredKeys, optionalKeys, label) {
  if (!value || typeof value !== "object") {
    throw new Error(`${label} must be an object`);
  }
  const keys = Object.keys(value);
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  for (const key of requiredKeys) {
    if (!keys.includes(key)) {
      throw new Error(`${label} missing ${key}`);
    }
  }
  for (const key of keys) {
    if (!allowed.has(key)) {
      throw new Error(`${label} contains unexpected ${key}`);
    }
  }
}

function assertInningsPitched(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
  if (Math.round(value * 10) % 10 > 2) {
    throw new Error(`${label} must use baseball outs notation`);
  }
}

function inningsToOuts(value) {
  return Math.trunc(value) * 3 + Math.round((value - Math.trunc(value)) * 10);
}

function assertRouteSafeTeamAbbreviation(value, label) {
  if (typeof value !== "string" || !/^[A-Z0-9]+$/.test(value)) {
    throw new Error(`${label} must be route-safe uppercase letters/digits`);
  }
}

function assertKnownArchiveText(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be present`);
  }
  if (ARCHIVE_PLACEHOLDER_TEXT.has(value.trim().toUpperCase())) {
    throw new Error(`${label} must not be a placeholder for completed games`);
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

function isIsoTimestampOnOrAfterDate(value, date) {
  return isIsoTimestamp(value) && typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && value.slice(0, 10) >= date;
}

function normalizedArchiveRootPath(value) {
  return typeof value === "string" ? value.replaceAll("\\", "/") : "";
}

function isIsoTimestampAtOrAfterParsableTimestamp(value, floor) {
  return isIsoTimestamp(value) && typeof floor === "string" && !Number.isNaN(new Date(floor).valueOf()) && new Date(value).valueOf() >= new Date(floor).valueOf();
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

assertSeasonDate(startDate, "start");
assertSeasonDate(endDate, "end");

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return response.json();
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function toDateEntries(payload) {
  return (payload.dates ?? []).map((entry) => ({
    date: entry.date,
    games: entry.games ?? [],
  })).filter((entry) => entry.date);
}

function readTeam(game, side) {
  const team = game.teams?.[side]?.team;
  return {
    id: team?.id ?? null,
    abbreviation: team?.abbreviation ?? team?.teamCode ?? team?.fileCode ?? team?.name ?? "TBD",
    name: team?.name ?? "TBD",
  };
}

function readGameStatus(game) {
  return {
    abstract: game.status?.abstractGameState ?? "Unknown",
    detailed: game.status?.detailedState ?? "Unknown",
  };
}

function isCompletedGame(game) {
  const status = readGameStatus(game);
  return status.abstract === "Final" || status.detailed === "Final" || status.detailed === "Completed Early";
}

function isArchivedCompletedGame(game) {
  return game.status?.abstract === "Final" || game.status?.detailed === "Final" || game.status?.detailed === "Completed Early";
}

function assertArchivedTeam(team, label) {
  assertExactKeys(team, ["id", "abbreviation", "name"], label);
  if (!Number.isInteger(team?.id) || team.id <= 0) {
    throw new Error(`${label} id must be a positive integer`);
  }
  assertRouteSafeTeamAbbreviation(team?.abbreviation, `${label} abbreviation`);
  if (typeof team?.name !== "string" || team.name.length === 0) {
    throw new Error(`${label} name must be present`);
  }
}

function assertArchivedGame(game, archiveDate, label) {
  assertExactKeys(
    game,
    game.error === undefined
      ? ["gamePk", "gameDate", "status", "venue", "awayTeam", "homeTeam", "starts"]
      : ["gamePk", "gameDate", "status", "venue", "awayTeam", "homeTeam", "starts", "error"],
    label
  );
  if (!Number.isInteger(game.gamePk) || game.gamePk <= 0) {
    throw new Error(`${label} gamePk must be a positive integer`);
  }
  if (!isMlbUtcTimestamp(game.gameDate)) {
    throw new Error(`${label} gameDate must be an MLB UTC timestamp`);
  }
  if (!archivedGameDateBelongsToShard(game.gameDate, archiveDate)) {
    throw new Error(`${label} gameDate must match the archive shard date or next UTC date`);
  }
  assertExactKeys(game.status, ["abstract", "detailed"], `${label} status`);
  if (typeof game.status?.abstract !== "string" || game.status.abstract.length === 0) {
    throw new Error(`${label} status.abstract must be present`);
  }
  if (typeof game.status?.detailed !== "string" || game.status.detailed.length === 0) {
    throw new Error(`${label} status.detailed must be present`);
  }
  if (typeof game.venue !== "string" || game.venue.length === 0) {
    throw new Error(`${label} venue must be present`);
  }
  if (game.error !== undefined && (typeof game.error !== "string" || game.error.length === 0)) {
    throw new Error(`${label} error must be a non-empty string when present`);
  }
  if (isArchivedCompletedGame(game) && typeof game.error === "string" && game.error.length > 0) {
    throw new Error(`${label} completed game must not carry an archive error`);
  }
  assertArchivedTeam(game.awayTeam, `${label} awayTeam`);
  assertArchivedTeam(game.homeTeam, `${label} homeTeam`);
  if (isArchivedCompletedGame(game)) {
    assertKnownArchiveText(game.venue, `${label} venue`);
    assertKnownArchiveText(game.awayTeam.abbreviation, `${label} awayTeam abbreviation`);
    assertKnownArchiveText(game.awayTeam.name, `${label} awayTeam name`);
    assertKnownArchiveText(game.homeTeam.abbreviation, `${label} homeTeam abbreviation`);
    assertKnownArchiveText(game.homeTeam.name, `${label} homeTeam name`);
  }
  if (game.awayTeam.abbreviation === game.homeTeam.abbreviation) {
    throw new Error(`${label} away/home teams must be different`);
  }
}

function assertArchivedCompletedGameFreshness(game, archivedAt, label) {
  if (isArchivedCompletedGame(game) && !isIsoTimestampAtOrAfterParsableTimestamp(archivedAt, game.gameDate)) {
    throw new Error(`${label} archivedAt must be at or after completed gameDate`);
  }
}

function assertArchivedStartMatchesGameTeams(start, game, label) {
  const expectedTeam = start.side === "away" ? game.awayTeam?.abbreviation : game.homeTeam?.abbreviation;
  const expectedOpponent = start.side === "away" ? game.homeTeam?.abbreviation : game.awayTeam?.abbreviation;
  if (start.team !== expectedTeam) {
    throw new Error(`${label} team ${start.team ?? "missing"} must match ${start.side} game team ${expectedTeam ?? "missing"}`);
  }
  if (start.opponent !== expectedOpponent) {
    throw new Error(`${label} opponent ${start.opponent ?? "missing"} must match ${start.side} game opponent ${expectedOpponent ?? "missing"}`);
  }
}

function assertArchivedGameStartLayout(game, label) {
  if (game.starts !== undefined && !Array.isArray(game.starts)) {
    throw new Error(`${label} starts must be an array when present`);
  }

  const starts = game.starts ?? [];
  const sides = new Set(starts.map((start) => start.side));
  const pitcherIds = new Set(starts.map((start) => start.pitcherMlbId));
  if (isArchivedCompletedGame(game) && starts.length === 1) {
    throw new Error(`${label} completed game must store zero or two starter rows`);
  }
  if (starts.length > 2) {
    throw new Error(`${label} must not store more than two starter rows`);
  }
  if (starts.length === 2 && (starts[0].side !== "away" || starts[1].side !== "home")) {
    throw new Error(`${label} full starter rows must be ordered away then home`);
  }
  if (sides.size !== starts.length) {
    throw new Error(`${label} must not store duplicate starter sides`);
  }
  if (pitcherIds.size !== starts.length) {
    throw new Error(`${label} must not store duplicate starter pitcher ids`);
  }
}

function assertArchivedStartLine(start, label) {
  assertRequiredKeysWithOptional(start.line, ["inningsPitched", "hits", "earnedRuns", "walks", "strikeouts", "pitches"], ["runsAllowed", "homeRunsAllowed"], `${label} line`);
  assertInningsPitched(start.line?.inningsPitched, `${label} line inningsPitched`);
  assertNonNegativeInteger(start.line?.hits, `${label} line hits`);
  assertNonNegativeInteger(start.line?.earnedRuns, `${label} line earnedRuns`);
  if (start.line.runsAllowed !== undefined) {
    assertNonNegativeInteger(start.line.runsAllowed, `${label} line runsAllowed`);
  }
  if (start.line.homeRunsAllowed !== undefined) {
    assertNonNegativeInteger(start.line.homeRunsAllowed, `${label} line homeRunsAllowed`);
  }
  assertNonNegativeInteger(start.line?.walks, `${label} line walks`);
  assertNonNegativeInteger(start.line?.strikeouts, `${label} line strikeouts`);
  if (start.line.strikeouts > inningsToOuts(start.line.inningsPitched)) {
    throw new Error(`${label} line strikeouts cannot exceed recorded outs`);
  }
  if (!Number.isInteger(start.line?.pitches) || start.line.pitches <= 0) {
    throw new Error(`${label} line pitches must be a positive integer`);
  }
  const minimumCompletedPlateAppearances = inningsToOuts(start.line.inningsPitched) + start.line.hits + start.line.walks;
  if (start.line.pitches < minimumCompletedPlateAppearances) {
    throw new Error(`${label} line pitches must cover recorded outs, hits, and walks`);
  }
}

function archivedStartRouteId(date, start) {
  return `${date}-${start.team.toLowerCase()}-${start.opponent.toLowerCase()}-${start.pitcherMlbId}`;
}

function assertArchivedPitchEvent(start, pitchEvent, index, label) {
  assertRequiredKeysWithOptional(pitchEvent, ARCHIVED_PITCH_EVENT_KEYS, ARCHIVED_PITCH_EVENT_OPTIONAL_KEYS, `${label} pitch ${index + 1}`);
  if (pitchEvent.id !== `${start.gamePk}-${start.pitcherMlbId}-${index + 1}`) {
    throw new Error(`${label} pitch ${index + 1} id must match game/pitcher/sequence`);
  }
  if (pitchEvent.gamePk !== start.gamePk) {
    throw new Error(`${label} pitch ${index + 1} gamePk must match start`);
  }
  if (pitchEvent.pitchNumber !== index + 1) {
    throw new Error(`${label} pitch ${index + 1} pitchNumber must be sequential`);
  }
  if (!Number.isInteger(pitchEvent.inning) || pitchEvent.inning <= 0) {
    throw new Error(`${label} pitch ${index + 1} inning must be a positive integer`);
  }
  assertExactKeys(pitchEvent.count, ["balls", "strikes"], `${label} pitch ${index + 1} count`);
  if (!Number.isInteger(pitchEvent.count?.balls) || pitchEvent.count.balls < 0 || pitchEvent.count.balls > 3) {
    throw new Error(`${label} pitch ${index + 1} balls must be 0-3`);
  }
  if (!Number.isInteger(pitchEvent.count?.strikes) || pitchEvent.count.strikes < 0 || pitchEvent.count.strikes > 2) {
    throw new Error(`${label} pitch ${index + 1} strikes must be 0-2`);
  }
  if (!ARCHIVED_PITCH_TYPES.has(pitchEvent.type)) {
    throw new Error(`${label} pitch ${index + 1} type ${pitchEvent.type ?? "missing"} is unsupported`);
  }
  if (!ARCHIVED_PITCH_RESULTS.has(pitchEvent.result)) {
    throw new Error(`${label} pitch ${index + 1} result ${pitchEvent.result ?? "missing"} is unsupported`);
  }
  if (!Number.isFinite(pitchEvent.velocityMph) || pitchEvent.velocityMph <= 0) {
    throw new Error(`${label} pitch ${index + 1} velocityMph must be positive`);
  }
  if (!Number.isFinite(pitchEvent.plateX)) {
    throw new Error(`${label} pitch ${index + 1} plateX must be finite`);
  }
  if (!Number.isFinite(pitchEvent.plateZ)) {
    throw new Error(`${label} pitch ${index + 1} plateZ must be finite`);
  }
  assertArchivedPitchEventStatcast(pitchEvent.statcast, `${label} pitch ${index + 1}`);
}

function assertArchivedPitchEventStatcast(statcast, label) {
  if (statcast === undefined) return;
  assertRequiredKeysWithOptional(statcast, [], ARCHIVED_PITCH_EVENT_STATCAST_KEYS, `${label} statcast`);

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
  if (value !== undefined && value !== null && !Number.isFinite(value)) {
    throw new Error(`${label} must be finite, null, or omitted`);
  }
}

function assertOptionalString(value, label) {
  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new Error(`${label} must be a string, null, or omitted`);
  }
}

function assertOptionalBoolean(value, label) {
  if (value !== undefined && value !== null && typeof value !== "boolean") {
    throw new Error(`${label} must be boolean, null, or omitted`);
  }
}

function assertArchivedPitchEventOrder(start, label) {
  for (const [index, pitchEvent] of start.pitchEvents.entries()) {
    const previousPitchEvent = start.pitchEvents[index - 1];
    if (previousPitchEvent && pitchEvent.inning < previousPitchEvent.inning) {
      throw new Error(`${label} pitch ${index + 1} inning must not move before the previous archived pitch`);
    }
  }
}

function assertArchivedArsenal(start, label) {
  if (!Array.isArray(start.arsenal)) {
    throw new Error(`${label} arsenal must be an array`);
  }
  if ((start.pitchEventCount ?? 0) === 0) {
    if (start.arsenal.length !== 0) {
      throw new Error(`${label} missing-pitch starts must not store arsenal rows`);
    }
    return;
  }

  if (start.arsenal.length === 0) {
    throw new Error(`${label} starts with pitches must store arsenal rows`);
  }
  for (const pitch of start.arsenal) {
    assertExactKeys(pitch, ["type", "usagePct", "avgVelocityMph", "whiffPct", "calledStrikePct"], `${label} arsenal ${pitch.type ?? "missing"}`);
    if (!ARCHIVED_PITCH_TYPES.has(pitch.type)) {
      throw new Error(`${label} arsenal type ${pitch.type ?? "missing"} is unsupported`);
    }
    if (!Number.isInteger(pitch.usagePct) || pitch.usagePct < 1 || pitch.usagePct > 100) {
      throw new Error(`${label} arsenal usagePct must be 1-100`);
    }
    if (!Number.isFinite(pitch.avgVelocityMph) || pitch.avgVelocityMph <= 0) {
      throw new Error(`${label} arsenal avgVelocityMph must be positive`);
    }
    if (!Number.isInteger(pitch.whiffPct) || pitch.whiffPct < 0 || pitch.whiffPct > 100) {
      throw new Error(`${label} arsenal whiffPct must be 0-100`);
    }
    if (!Number.isInteger(pitch.calledStrikePct) || pitch.calledStrikePct < 0 || pitch.calledStrikePct > 100) {
      throw new Error(`${label} arsenal calledStrikePct must be 0-100`);
    }
  }
}

function assertArchivedArsenalMatchesPitchEvents(start, label) {
  if ((start.pitchEventCount ?? 0) === 0) return;

  const expectedArsenal = summarizePitchEvents(start.pitchEvents);
  if (start.arsenal.length !== expectedArsenal.length) {
    throw new Error(`${label} arsenal count must match pitch-event types`);
  }
  if (!start.arsenal.every((pitch, index) => pitch.type === expectedArsenal[index]?.type)) {
    throw new Error(`${label} arsenal order must match archived pitch-event type order`);
  }

  for (const expectedPitch of expectedArsenal) {
    const actualPitch = start.arsenal.find((pitch) => pitch.type === expectedPitch.type);
    if (!actualPitch) {
      throw new Error(`${label} arsenal missing ${expectedPitch.type}`);
    }
    if (actualPitch.usagePct !== expectedPitch.usagePct) {
      throw new Error(`${label} ${expectedPitch.type} arsenal usagePct mismatch`);
    }
    if (actualPitch.avgVelocityMph !== expectedPitch.avgVelocityMph) {
      throw new Error(`${label} ${expectedPitch.type} arsenal avgVelocityMph mismatch`);
    }
    if (actualPitch.whiffPct !== expectedPitch.whiffPct) {
      throw new Error(`${label} ${expectedPitch.type} arsenal whiffPct mismatch`);
    }
    if (actualPitch.calledStrikePct !== expectedPitch.calledStrikePct) {
      throw new Error(`${label} ${expectedPitch.type} arsenal calledStrikePct mismatch`);
    }
  }
}

function assertArchivedStartSource(start, label) {
  if (!start.source || Object.keys(start.source).length !== 2) {
    throw new Error(`${label} source must contain only line and pitchEvents`);
  }
  if (start.source.line !== "live-gamefeed") {
    throw new Error(`${label} line source must be live-gamefeed`);
  }
  if (start.source.pitchEvents !== "live-gamefeed" && start.source.pitchEvents !== "missing-gamefeed-pitches") {
    throw new Error(`${label} pitch-event source must be live-gamefeed or missing-gamefeed-pitches`);
  }
}

function assertManifestShard(dateArchive, expectedDate, file) {
  assertExactKeys(dateArchive, ["season", "date", "archivedAt", "source", "counts", "games"], file);
  if (dateArchive.season !== season) {
    throw new Error(`${file} season expected ${season}, got ${dateArchive.season ?? "missing"}`);
  }
  if (dateArchive.date !== expectedDate) {
    throw new Error(`${file} date expected ${expectedDate}, got ${dateArchive.date ?? "missing"}`);
  }
  if (dateArchive.source !== "mlb-stats-api") {
    throw new Error(`${file} source must be mlb-stats-api`);
  }
  if (!isIsoTimestamp(dateArchive.archivedAt)) {
    throw new Error(`${file} archivedAt must be an ISO timestamp`);
  }
  if (!isIsoTimestampOnOrAfterDate(dateArchive.archivedAt, dateArchive.date)) {
    throw new Error(`${file} archivedAt must be on or after archive date ${dateArchive.date ?? "missing"}`);
  }
  if (!Array.isArray(dateArchive.games)) {
    throw new Error(`${file} games must be an array`);
  }

  assertExactKeys(dateArchive.counts, ["games", "completedGames", "starts", "pitchEvents"], `${file} counts`);
  assertNonNegativeInteger(dateArchive.counts?.games, `${file} counts.games`);
  assertNonNegativeInteger(dateArchive.counts?.completedGames, `${file} counts.completedGames`);
  assertNonNegativeInteger(dateArchive.counts?.starts, `${file} counts.starts`);
  assertNonNegativeInteger(dateArchive.counts?.pitchEvents, `${file} counts.pitchEvents`);

  const starts = dateArchive.games.flatMap((game) => game.starts ?? []);
  const pitchEvents = starts.reduce((sum, start) => sum + (start.pitchEventCount ?? 0), 0);
  const routeIds = new Set();
  if (dateArchive.counts.games !== dateArchive.games.length) {
    throw new Error(`${file} counts.games does not match games length`);
  }
  if (dateArchive.counts.completedGames !== dateArchive.games.filter(isArchivedCompletedGame).length) {
    throw new Error(`${file} counts.completedGames does not match completed games`);
  }
  if (dateArchive.counts.starts !== starts.length) {
    throw new Error(`${file} counts.starts does not match starts length`);
  }
  if (dateArchive.counts.pitchEvents !== pitchEvents) {
    throw new Error(`${file} counts.pitchEvents does not match stored pitch events`);
  }

  for (const game of dateArchive.games) {
    assertArchivedGame(game, dateArchive.date, `${file} game ${game.gamePk ?? "missing"}`);
    assertArchivedCompletedGameFreshness(game, dateArchive.archivedAt, `${file} game ${game.gamePk ?? "missing"}`);
    assertArchivedGameStartLayout(game, `${file} game ${game.gamePk ?? "missing"}`);

    if (!isArchivedCompletedGame(game) && (game.starts ?? []).length > 0) {
      throw new Error(`${file} non-completed game ${game.gamePk ?? "missing"} must not contain archived starts`);
    }

    for (const start of game.starts ?? []) {
      const startLabel = `${file} start ${start.gamePk ?? "missing"}:${start.pitcherMlbId ?? "missing"}`;
      assertExactKeys(start, ["id", "gamePk", "pitcherMlbId", "pitcherName", "team", "opponent", "side", "result", "line", "pitchEventCount", "arsenal", "pitchEvents", "source"], startLabel);
      if (start.gamePk !== game.gamePk) {
        throw new Error(`${startLabel} gamePk must match containing game`);
      }
      if (!Number.isInteger(start.pitcherMlbId) || start.pitcherMlbId <= 0) {
        throw new Error(`${startLabel} pitcherMlbId must be a positive integer`);
      }
      if (start.id !== `${start.gamePk}-${start.pitcherMlbId}`) {
        throw new Error(`${startLabel} id must match gamePk-pitcherMlbId`);
      }
      if (typeof start.pitcherName !== "string" || start.pitcherName.length === 0) {
        throw new Error(`${startLabel} pitcherName must be present`);
      }
      assertRouteSafeTeamAbbreviation(start.team, `${startLabel} team`);
      assertRouteSafeTeamAbbreviation(start.opponent, `${startLabel} opponent`);
      if (start.team === start.opponent) {
        throw new Error(`${startLabel} team and opponent must be different`);
      }
      if (start.side !== "home" && start.side !== "away") {
        throw new Error(`${startLabel} side must be home or away`);
      }
      if (!["W", "L", "ND"].includes(start.result)) {
        throw new Error(`${startLabel} result must be W, L, or ND`);
      }
      assertArchivedStartLine(start, startLabel);
      assertArchivedStartMatchesGameTeams(start, game, startLabel);
      if (!Array.isArray(start.pitchEvents)) {
        throw new Error(`${startLabel} pitchEvents must be an array`);
      }
      assertNonNegativeInteger(start.pitchEventCount, `${startLabel} pitchEventCount`);
      if (start.pitchEventCount !== start.pitchEvents.length) {
        throw new Error(`${startLabel} pitchEventCount does not match pitchEvents length`);
      }
      if (start.line.pitches < start.pitchEvents.length) {
        throw new Error(`${startLabel} line pitches must cover stored pitch events`);
      }
      start.pitchEvents.forEach((pitchEvent, index) => assertArchivedPitchEvent(start, pitchEvent, index, startLabel));
      assertArchivedPitchEventOrder(start, startLabel);
      assertArchivedArsenal(start, startLabel);
      assertArchivedArsenalMatchesPitchEvents(start, startLabel);
      assertArchivedStartSource(start, startLabel);
      const expectedPitchEventSource = start.pitchEvents.length > 0 ? "live-gamefeed" : "missing-gamefeed-pitches";
      if (start.source?.pitchEvents !== expectedPitchEventSource) {
        throw new Error(`${startLabel} pitch-event source must be ${expectedPitchEventSource}`);
      }

      const routeId = archivedStartRouteId(dateArchive.date, start);
      if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9]+-[a-z0-9]+-\d+$/.test(routeId)) {
        throw new Error(`${startLabel} generates invalid route id ${routeId}`);
      }
      if (routeIds.has(routeId)) {
        throw new Error(`${file} duplicate archived start route id ${routeId}`);
      }
      routeIds.add(routeId);
    }
  }
}

function assertManifest(manifest) {
  assertExactKeys(manifest, ["season", "startDate", "endDate", "archivedAt", "source", "archiveRoot", "counts", "dates"], "manifest");
  if (manifest.season !== season) {
    throw new Error(`manifest season expected ${season}, got ${manifest.season ?? "missing"}`);
  }
  if (manifest.source !== "mlb-stats-api") {
    throw new Error("manifest source must be mlb-stats-api");
  }
  if (normalizedArchiveRootPath(manifest.archiveRoot) !== normalizedArchiveRootPath(archiveRoot)) {
    throw new Error(`manifest archiveRoot ${manifest.archiveRoot ?? "missing"} must match ${archiveRoot}`);
  }
  if (!isIsoTimestamp(manifest.archivedAt)) {
    throw new Error("manifest archivedAt must be an ISO timestamp");
  }
  if (!Array.isArray(manifest.dates) || manifest.dates.length === 0) {
    throw new Error("manifest dates must be a non-empty array");
  }
  assertSeasonDate(manifest.startDate, "manifest startDate");
  assertSeasonDate(manifest.endDate, "manifest endDate");

  assertExactKeys(manifest.counts, ["dates", "games", "completedGames", "starts", "pitchEvents"], "manifest counts");
  assertNonNegativeInteger(manifest.counts?.dates, "manifest counts.dates");
  assertNonNegativeInteger(manifest.counts?.games, "manifest counts.games");
  assertNonNegativeInteger(manifest.counts?.completedGames, "manifest counts.completedGames");
  assertNonNegativeInteger(manifest.counts?.starts, "manifest counts.starts");
  assertNonNegativeInteger(manifest.counts?.pitchEvents, "manifest counts.pitchEvents");

  const seenDates = new Set();
  const sortedDates = [...manifest.dates].sort((a, b) => a.date.localeCompare(b.date));
  const totals = manifest.dates.reduce(
    (sum, dateSummary) => {
      assertExactKeys(dateSummary, ["date", "games", "completedGames", "starts", "pitchEvents"], `manifest ${dateSummary.date ?? "missing"} summary`);
      assertSeasonDate(dateSummary.date, "manifest date");
      if (seenDates.has(dateSummary.date)) {
        throw new Error(`manifest duplicate date ${dateSummary.date}`);
      }
      seenDates.add(dateSummary.date);
      assertNonNegativeInteger(dateSummary.games, `manifest ${dateSummary.date} games`);
      assertNonNegativeInteger(dateSummary.completedGames, `manifest ${dateSummary.date} completedGames`);
      assertNonNegativeInteger(dateSummary.starts, `manifest ${dateSummary.date} starts`);
      assertNonNegativeInteger(dateSummary.pitchEvents, `manifest ${dateSummary.date} pitchEvents`);
      if (dateSummary.completedGames > dateSummary.games) {
        throw new Error(`manifest ${dateSummary.date} completedGames cannot exceed games`);
      }
      if (dateSummary.starts > dateSummary.completedGames * 2) {
        throw new Error(`manifest ${dateSummary.date} starts cannot exceed two starts per completed game`);
      }
      if (dateSummary.starts % 2 !== 0) {
        throw new Error(`manifest ${dateSummary.date} starts must be even`);
      }

      return {
        games: sum.games + dateSummary.games,
        completedGames: sum.completedGames + dateSummary.completedGames,
        starts: sum.starts + dateSummary.starts,
        pitchEvents: sum.pitchEvents + dateSummary.pitchEvents,
      };
    },
    { games: 0, completedGames: 0, starts: 0, pitchEvents: 0 }
  );

  if (manifest.counts.dates !== manifest.dates.length) {
    throw new Error("manifest counts.dates must match date summaries");
  }
  if (manifest.counts.completedGames > manifest.counts.games) {
    throw new Error("manifest completedGames cannot exceed games");
  }
  if (manifest.counts.starts > manifest.counts.completedGames * 2) {
    throw new Error("manifest starts cannot exceed two starts per completed game");
  }
  if (manifest.counts.starts % 2 !== 0) {
    throw new Error("manifest starts must be even");
  }
  if (manifest.counts.games !== totals.games || manifest.counts.completedGames !== totals.completedGames || manifest.counts.starts !== totals.starts || manifest.counts.pitchEvents !== totals.pitchEvents) {
    throw new Error("manifest counts must match date summary totals");
  }
  if (manifest.startDate !== sortedDates[0]?.date || manifest.endDate !== sortedDates.at(-1)?.date) {
    throw new Error("manifest startDate/endDate must match sorted date summaries");
  }
  if (!isIsoTimestampOnOrAfterDate(manifest.archivedAt, manifest.endDate)) {
    throw new Error(`manifest archivedAt must be on or after endDate ${manifest.endDate ?? "missing"}`);
  }
  if (!manifest.dates.every((dateSummary, index) => dateSummary.date === sortedDates[index]?.date)) {
    throw new Error("manifest date summaries must be sorted");
  }
  if (!manifest.dates.every((dateSummary, index) => index === 0 || dateSummary.date === nextArchiveDate(manifest.dates[index - 1].date))) {
    throw new Error("manifest date summaries must be continuous");
  }
}

function readStartLine(stats) {
  const inningsPitched = Number(stats?.inningsPitched);
  if (!Number.isFinite(inningsPitched)) return null;
  assertInningsPitched(inningsPitched, "gamefeed line inningsPitched");

  return {
    inningsPitched,
    hits: stats.hits ?? 0,
    earnedRuns: stats.earnedRuns ?? 0,
    ...(Number.isInteger(stats.runs) ? { runsAllowed: stats.runs } : {}),
    ...(Number.isInteger(stats.homeRuns) ? { homeRunsAllowed: stats.homeRuns } : {}),
    walks: stats.baseOnBalls ?? 0,
    strikeouts: stats.strikeOuts ?? 0,
    pitches: stats.numberOfPitches ?? stats.pitchesThrown ?? 0,
  };
}

function readPitchingDecision(pitcherMlbId, payload) {
  if (payload.liveData?.decisions?.winner?.id === pitcherMlbId) return "W";
  if (payload.liveData?.decisions?.loser?.id === pitcherMlbId) return "L";
  return "ND";
}

function readPitchType(code) {
  if (!code) return null;
  if (["FF", "FA"].includes(code)) return "FF";
  if (["SI", "FT"].includes(code)) return "SI";
  if (["SL", "ST", "SV"].includes(code)) return "SL";
  if (["CH", "FS", "FO", "SC"].includes(code)) return "CH";
  if (["CU", "KC", "CS", "EP"].includes(code)) return "CU";
  if (code === "FC") return "FC";
  return null;
}

function readPitchResult(code) {
  if (!code) return null;
  if (["C", "W", "M", "Q"].includes(code)) return "called_strike";
  if (["S", "T"].includes(code)) return "swinging_strike";
  if (["F", "L", "O", "R"].includes(code)) return "foul";
  if (["B", "I", "P", "V"].includes(code)) return "ball";
  if (["X", "D", "E"].includes(code)) return "hit_into_play";
  return null;
}

function parseStartPitchEvents(gamePk, pitcherMlbId, payload) {
  const events = payload.liveData?.plays?.allPlays ?? [];
  let pitchNumber = 1;

  return events.flatMap((play) => {
    if (play.matchup?.pitcher?.id !== pitcherMlbId) return [];
    const parsedEvents = [];
    let balls = 0;
    let strikes = 0;

    for (const event of play.playEvents ?? []) {
      if (!event.isPitch) continue;

      const type = readPitchType(event.details?.type?.code);
      const result = readPitchResult(event.details?.call?.code);
      const velocity = event.pitchData?.startSpeed;
      const plateX = event.pitchData?.coordinates?.pX;
      const plateZ = event.pitchData?.coordinates?.pZ;

      if (!type || !result || typeof velocity !== "number" || typeof plateX !== "number" || typeof plateZ !== "number") continue;

      parsedEvents.push({
        id: `${gamePk}-${pitcherMlbId}-${pitchNumber}`,
        gamePk,
        pitchNumber,
        count: { balls, strikes },
        inning: play.about?.inning ?? 1,
        type,
        velocityMph: Number(velocity.toFixed(1)),
        plateX: Number(plateX.toFixed(2)),
        plateZ: Number(plateZ.toFixed(2)),
        result,
      });
      pitchNumber += 1;

      if (result === "ball") balls = Math.min(3, balls + 1);
      if (result === "called_strike" || result === "swinging_strike") strikes = Math.min(2, strikes + 1);
      if (result === "foul" && strikes < 2) strikes += 1;
    }

    return parsedEvents;
  });
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

function parseTeamStarts(gamePk, side, team, opponent, payload) {
  const boxTeam = payload.liveData?.boxscore?.teams?.[side];
  if (!boxTeam?.players) return [];

  return Object.values(boxTeam.players).flatMap((player) => {
    const pitcherMlbId = player.person?.id;
    const stats = player.stats?.pitching;
    if (!pitcherMlbId || stats?.gamesStarted !== 1) return [];

    const line = readStartLine(stats);
    if (!line) return [];

    const pitchEvents = parseStartPitchEvents(gamePk, pitcherMlbId, payload);

    return [{
      id: `${gamePk}-${pitcherMlbId}`,
      gamePk,
      pitcherMlbId,
      pitcherName: player.person?.fullName ?? `MLB ${pitcherMlbId}`,
      team,
      opponent,
      side,
      result: readPitchingDecision(pitcherMlbId, payload),
      line,
      pitchEventCount: pitchEvents.length,
      arsenal: pitchEvents.length > 0 ? summarizePitchEvents(pitchEvents) : [],
      pitchEvents,
      source: {
        line: "live-gamefeed",
        pitchEvents: pitchEvents.length > 0 ? "live-gamefeed" : "missing-gamefeed-pitches",
      },
    }];
  });
}

async function mapLimit(items, limit, mapper) {
  const results = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}

async function archiveGame(game) {
  const gamePk = game.gamePk;
  const awayTeam = readTeam(game, "away");
  const homeTeam = readTeam(game, "home");
  const status = readGameStatus(game);
  const archivedGame = {
    gamePk,
    gameDate: game.gameDate,
    status,
    venue: game.venue?.name ?? "TBD",
    awayTeam,
    homeTeam,
    starts: [],
  };

  if (!gamePk || !isCompletedGame(game)) return archivedGame;

  try {
    const feed = await fetchJson(`${MLB_GAME_FEED_BASE}/${gamePk}/feed/live`);
    archivedGame.starts = [
      ...parseTeamStarts(gamePk, "away", awayTeam.abbreviation, homeTeam.abbreviation, feed),
      ...parseTeamStarts(gamePk, "home", homeTeam.abbreviation, awayTeam.abbreviation, feed),
    ];
  } catch (error) {
    archivedGame.error = error instanceof Error ? error.message : String(error);
  }

  return archivedGame;
}

async function main() {
  const params = new URLSearchParams({
    sportId: "1",
    startDate,
    endDate,
    hydrate: "team",
  });
  const schedule = await fetchJson(`${MLB_STATS_API_BASE}/schedule?${params.toString()}`);
  const dateEntries = toDateEntries(schedule);
  const datesDir = path.join(archiveRoot, "dates");
  await mkdir(datesDir, { recursive: true });

  for (const dateEntry of dateEntries) {
    const games = await mapLimit(dateEntry.games, CONCURRENCY, archiveGame);
    const starts = games.flatMap((game) => game.starts);
    const pitchEventCount = starts.reduce((sum, start) => sum + start.pitchEventCount, 0);
    const completedGameCount = games.filter(isArchivedCompletedGame).length;
    const dateArchive = {
      season,
      date: dateEntry.date,
      archivedAt: new Date().toISOString(),
      source: "mlb-stats-api",
      counts: {
        games: games.length,
        completedGames: completedGameCount,
        starts: starts.length,
        pitchEvents: pitchEventCount,
      },
      games,
    };

    assertManifestShard(dateArchive, dateEntry.date, `${dateEntry.date}.json`);
    await writeFile(path.join(datesDir, `${dateEntry.date}.json`), `${JSON.stringify(dateArchive, null, 2)}\n`);
    console.log(`${dateEntry.date}: ${games.length} games, ${starts.length} starts, ${pitchEventCount} pitches`);
  }

  const dateFiles = (await readdir(datesDir)).filter((file) => file.endsWith(".json")).sort();
  const dateSummaries = [];
  let totalGames = 0;
  let completedGames = 0;
  let totalStarts = 0;
  let totalPitchEvents = 0;

  for (const file of dateFiles) {
    const expectedDate = file.replace(/\.json$/, "");
    assertSeasonDate(expectedDate, `date shard filename ${file}`);

    const dateArchive = await readJson(path.join(datesDir, file));
    assertManifestShard(dateArchive, expectedDate, file);

    const summary = {
      date: dateArchive.date,
      games: dateArchive.counts?.games ?? 0,
      completedGames: dateArchive.counts?.completedGames ?? 0,
      starts: dateArchive.counts?.starts ?? 0,
      pitchEvents: dateArchive.counts?.pitchEvents ?? 0,
    };

    dateSummaries.push(summary);
    totalGames += summary.games;
    completedGames += summary.completedGames;
    totalStarts += summary.starts;
    totalPitchEvents += summary.pitchEvents;
  }

  const manifest = {
    season,
    startDate: dateSummaries[0]?.date ?? startDate,
    endDate: dateSummaries.at(-1)?.date ?? endDate,
    archivedAt: new Date().toISOString(),
    source: "mlb-stats-api",
    archiveRoot,
    counts: {
      dates: dateSummaries.length,
      games: totalGames,
      completedGames,
      starts: totalStarts,
      pitchEvents: totalPitchEvents,
    },
    dates: dateSummaries,
  };

  assertManifest(manifest);
  await writeFile(path.join(archiveRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`archive complete: ${totalStarts} starts, ${totalPitchEvents} pitch events, ${dateSummaries.length} date file(s) -> ${archiveRoot}`);
}

await main();
