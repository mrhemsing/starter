import { readFile } from "node:fs/promises";
import path from "node:path";
import { inningsFromIP, outsFromIP } from "@/lib/innings";
import type { ArchivedPitcherRecentArsenal, ArchivedPitcherSeasonProfile, ArchivedStartLineSummary, ArchivedStartPitchDetailSummary, ArsenalPitchSummary, MlbCompletedPitchingLine, MlbSchedule, MlbStartPitchDetails, PitchEvent, PitchResultKey, PitchTypeKey, StartLine, StartSummary, TeamSummary } from "@/lib/types";

const ARCHIVED_PITCH_TYPES = new Set<PitchTypeKey>(["FF", "SI", "SL", "CH", "CU", "FC"]);
const ARCHIVED_PITCH_RESULTS = new Set<PitchResultKey>(["called_strike", "swinging_strike", "foul", "ball", "hit_into_play"]);
const ARCHIVE_PLACEHOLDER_TEXT = new Set(["TBA", "TBD"]);

type ArchivedStart = {
  id?: string;
  gamePk: number;
  pitcherMlbId: number;
  pitcherName: string;
  team: string;
  opponent: string;
  side: "home" | "away";
  result: StartSummary["result"];
  line: StartLine;
  pitchEventCount?: number;
  arsenal?: MlbStartPitchDetails["arsenal"];
  pitchEvents?: PitchEvent[];
  source?: {
    line?: string;
    pitchEvents?: "live-gamefeed" | "missing-gamefeed-pitches";
  };
};

export type ArchivedCompletedStartSummary = {
  date: string;
  gamePk: number;
  gameDate: string;
  venue: string;
  awayTeam: Pick<TeamSummary, "abbreviation" | "name">;
  homeTeam: Pick<TeamSummary, "abbreviation" | "name">;
  pitcherMlbId: number;
  pitcherName: string;
  team: string;
  opponent: string;
  side: "home" | "away";
  result: StartSummary["result"];
  line: StartLine;
};

type ArchivedTeam = Pick<TeamSummary, "abbreviation" | "name"> & {
  id: number;
};

type ArchivedGame = {
  gamePk: number;
  gameDate: string;
  status: {
    abstract?: string;
    detailed: string;
  };
  venue: string;
  awayTeam: ArchivedTeam;
  homeTeam: ArchivedTeam;
  error?: string;
  starts?: ArchivedStart[];
};

type DateArchive = {
  season: string;
  date: string;
  archivedAt?: string;
  source: "mlb-stats-api";
  counts?: {
    games?: number;
    completedGames?: number;
    starts?: number;
    pitchEvents?: number;
  };
  games?: ArchivedGame[];
};

type SeasonArchiveManifest = {
  season: string;
  startDate?: string;
  endDate?: string;
  archivedAt?: string;
  source: "mlb-stats-api";
  archiveRoot?: string;
  counts?: {
    dates?: number;
    games?: number;
    completedGames?: number;
    starts?: number;
    pitchEvents?: number;
  };
  dates?: Array<{
    date: string;
    games?: number;
    completedGames?: number;
    starts?: number;
    pitchEvents?: number;
  }>;
};

function archiveSeasonManifestPath(season: string) {
  return path.join(process.cwd(), "data", "mlb-archive", season, "manifest.json");
}

function archiveDatePath(date: string) {
  return path.join(process.cwd(), "data", "mlb-archive", date.slice(0, 4), "dates", `${date}.json`);
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function isMlbUtcTimestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && !Number.isNaN(new Date(value).valueOf());
}

function isIsoTimestampAtOrAfter(value: unknown, floor: unknown) {
  return isIsoTimestamp(value) && isIsoTimestamp(floor) && new Date(value).valueOf() >= new Date(floor).valueOf();
}

function isIsoTimestampAtOrAfterParsableTimestamp(value: unknown, floor: unknown) {
  return isIsoTimestamp(value) && typeof floor === "string" && !Number.isNaN(new Date(floor).valueOf()) && new Date(value).valueOf() >= new Date(floor).valueOf();
}

function isIsoTimestampOnOrAfterDate(value: unknown, date: unknown) {
  return isIsoTimestamp(value) && typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && value.slice(0, 10) >= date;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function hasExactKeys(value: unknown, expectedKeys: string[]) {
  if (!value || typeof value !== "object") return false;
  const keys = Object.keys(value);
  return keys.length === expectedKeys.length && expectedKeys.every((key) => keys.includes(key));
}

function isSeasonDate(value: unknown, season: string) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && value.startsWith(`${season}-`);
}

function isRouteSafeTeamAbbreviation(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z0-9]+$/.test(value);
}

function isKnownArchiveText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && !ARCHIVE_PLACEHOLDER_TEXT.has(value.trim().toUpperCase());
}

function isValidInningsPitched(value: unknown): value is number {
  if (!Number.isFinite(value) || Number(value) < 0) return false;
  const outs = Math.round(Number(value) * 10) % 10;
  return outs >= 0 && outs <= 2;
}

function isCompletedArchivedGame(game: ArchivedGame) {
  return game.status?.abstract === "Final" || game.status?.detailed === "Final" || game.status?.detailed === "Completed Early";
}

function archivedGameDateBelongsToShard(gameDate: unknown, archiveDate: string) {
  if (typeof gameDate !== "string" || Number.isNaN(new Date(gameDate).valueOf())) return false;
  const nextUtcDate = new Date(`${archiveDate}T00:00:00.000Z`);
  nextUtcDate.setUTCDate(nextUtcDate.getUTCDate() + 1);
  return gameDate.slice(0, 10) === archiveDate || gameDate.slice(0, 10) === nextUtcDate.toISOString().slice(0, 10);
}

function nextArchiveDate(date: string) {
  const nextUtcDate = new Date(`${date}T00:00:00.000Z`);
  nextUtcDate.setUTCDate(nextUtcDate.getUTCDate() + 1);
  return nextUtcDate.toISOString().slice(0, 10);
}

function normalizedArchiveRootPath(value: unknown) {
  return typeof value === "string" ? value.replaceAll("\\", "/") : "";
}

function hasValidArchivedTeamShape(team: ArchivedGame["awayTeam"]) {
  return (
    hasExactKeys(team, ["id", "abbreviation", "name"]) &&
    Number.isInteger(team?.id) &&
    team.id > 0 &&
    isRouteSafeTeamAbbreviation(team?.abbreviation) &&
    typeof team?.name === "string" &&
    team.name.length > 0
  );
}

function hasValidArchivedGameShape(game: ArchivedGame, archiveDate: string, archivedAt: unknown) {
  const expectedGameKeys = game.error === undefined
    ? ["gamePk", "gameDate", "status", "venue", "awayTeam", "homeTeam", "starts"]
    : ["gamePk", "gameDate", "status", "venue", "awayTeam", "homeTeam", "starts", "error"];

  return (
    hasExactKeys(game, expectedGameKeys) &&
    Number.isInteger(game.gamePk) &&
    game.gamePk > 0 &&
    isMlbUtcTimestamp(game.gameDate) &&
    archivedGameDateBelongsToShard(game.gameDate, archiveDate) &&
    (!isCompletedArchivedGame(game) || isIsoTimestampAtOrAfterParsableTimestamp(archivedAt, game.gameDate)) &&
    hasExactKeys(game.status, ["abstract", "detailed"]) &&
    typeof game.status?.abstract === "string" &&
    game.status.abstract.length > 0 &&
    typeof game.status?.detailed === "string" &&
    game.status.detailed.length > 0 &&
    typeof game.venue === "string" &&
    game.venue.length > 0 &&
    (game.error === undefined || (typeof game.error === "string" && game.error.length > 0)) &&
    (!isCompletedArchivedGame(game) || typeof game.error !== "string" || game.error.length === 0) &&
    hasValidArchivedTeamShape(game.awayTeam) &&
    hasValidArchivedTeamShape(game.homeTeam) &&
    (!isCompletedArchivedGame(game) ||
      (isKnownArchiveText(game.venue) &&
        isKnownArchiveText(game.awayTeam.abbreviation) &&
        isKnownArchiveText(game.awayTeam.name) &&
        isKnownArchiveText(game.homeTeam.abbreviation) &&
        isKnownArchiveText(game.homeTeam.name))) &&
    game.awayTeam.abbreviation !== game.homeTeam.abbreviation
  );
}

function hasUniqueArchivedGames(archive: DateArchive) {
  const gamePks = new Set<number>();

  for (const game of archive.games ?? []) {
    if (gamePks.has(game.gamePk)) return false;
    gamePks.add(game.gamePk);
  }

  return true;
}

function hasArchivedStartsMatchingGameTeams(game: ArchivedGame) {
  return (game.starts ?? []).every((start) => {
    const expectedTeam = start.side === "away" ? game.awayTeam?.abbreviation : game.homeTeam?.abbreviation;
    const expectedOpponent = start.side === "away" ? game.homeTeam?.abbreviation : game.awayTeam?.abbreviation;
    return start.gamePk === game.gamePk && start.team === expectedTeam && start.opponent === expectedOpponent;
  });
}

function hasValidArchivedGameStartLayout(game: ArchivedGame) {
  if (game.starts !== undefined && !Array.isArray(game.starts)) return false;

  const starts = game.starts ?? [];
  const sides = new Set(starts.map((start) => start.side));
  const pitcherIds = new Set(starts.map((start) => start.pitcherMlbId));
  return (
    (!isCompletedArchivedGame(game) || starts.length !== 1) &&
    starts.length <= 2 &&
    (starts.length !== 2 || (starts[0].side === "away" && starts[1].side === "home")) &&
    sides.size === starts.length &&
    pitcherIds.size === starts.length
  );
}

function hasConsistentArchivedStart(start: ArchivedStart) {
  if (!Array.isArray(start.pitchEvents)) return false;
  if (!hasConsistentArchivedArsenal(start)) return false;
  if (!isNonNegativeInteger(start.pitchEventCount)) return false;
  if (start.pitchEvents.length !== (start.pitchEventCount ?? 0)) return false;
  if (start.line.pitches < start.pitchEvents.length) return false;
  if (!hasValidArchivedStartSource(start)) return false;
  if (!start.pitchEvents.every((pitchEvent, index) => hasValidArchivedPitchEvent(start, pitchEvent, index))) return false;
  if (!hasArchivedPitchEventsInInningOrder(start.pitchEvents)) return false;

  return start.pitchEvents.length > 0
    ? start.source?.pitchEvents === "live-gamefeed"
    : start.source?.pitchEvents === "missing-gamefeed-pitches";
}

function hasValidArchivedStartSource(start: ArchivedStart) {
  return (
    !!start.source &&
    Object.keys(start.source).length === 2 &&
    start.source.line === "live-gamefeed" &&
    (start.source.pitchEvents === "live-gamefeed" || start.source.pitchEvents === "missing-gamefeed-pitches")
  );
}

function hasConsistentArchivedArsenal(start: ArchivedStart) {
  if (!Array.isArray(start.arsenal)) return false;
  if ((start.pitchEventCount ?? 0) === 0) return start.arsenal.length === 0;

  if (
    start.arsenal.length === 0 ||
    !start.arsenal.every(
      (pitch) =>
        hasExactKeys(pitch, ["type", "usagePct", "avgVelocityMph", "whiffPct", "calledStrikePct"]) &&
        ARCHIVED_PITCH_TYPES.has(pitch.type) &&
        Number.isInteger(pitch.usagePct) &&
        pitch.usagePct >= 1 &&
        pitch.usagePct <= 100 &&
        Number.isFinite(pitch.avgVelocityMph) &&
        pitch.avgVelocityMph > 0 &&
        Number.isInteger(pitch.whiffPct) &&
        pitch.whiffPct >= 0 &&
        pitch.whiffPct <= 100 &&
        Number.isInteger(pitch.calledStrikePct) &&
        pitch.calledStrikePct >= 0 &&
        pitch.calledStrikePct <= 100
    )
  ) return false;

  const expectedArsenal = summarizePitchEvents(start.pitchEvents ?? []);
  return (
    start.arsenal.length === expectedArsenal.length &&
    expectedArsenal.every((expectedPitch, index) => {
      const actualPitch = start.arsenal?.[index];
      return (
        actualPitch?.type === expectedPitch.type &&
        actualPitch?.usagePct === expectedPitch.usagePct &&
        actualPitch.avgVelocityMph === expectedPitch.avgVelocityMph &&
        actualPitch.whiffPct === expectedPitch.whiffPct &&
        actualPitch.calledStrikePct === expectedPitch.calledStrikePct
      );
    })
  );
}

function summarizePitchEvents(pitchEvents: PitchEvent[]): ArsenalPitchSummary[] {
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

function hasValidArchivedPitchEvent(start: ArchivedStart, pitchEvent: PitchEvent, index: number) {
  return (
    hasExactKeys(pitchEvent, ["id", "gamePk", "pitchNumber", "count", "inning", "type", "velocityMph", "plateX", "plateZ", "result"]) &&
    pitchEvent.id === `${start.gamePk}-${start.pitcherMlbId}-${index + 1}` &&
    pitchEvent.gamePk === start.gamePk &&
    pitchEvent.pitchNumber === index + 1 &&
    Number.isInteger(pitchEvent.inning) &&
    pitchEvent.inning > 0 &&
    hasExactKeys(pitchEvent.count, ["balls", "strikes"]) &&
    Number.isInteger(pitchEvent.count?.balls) &&
    pitchEvent.count.balls >= 0 &&
    pitchEvent.count.balls <= 3 &&
    Number.isInteger(pitchEvent.count?.strikes) &&
    pitchEvent.count.strikes >= 0 &&
    pitchEvent.count.strikes <= 2 &&
    ARCHIVED_PITCH_TYPES.has(pitchEvent.type) &&
    ARCHIVED_PITCH_RESULTS.has(pitchEvent.result) &&
    Number.isFinite(pitchEvent.velocityMph) &&
    pitchEvent.velocityMph > 0 &&
    Number.isFinite(pitchEvent.plateX) &&
    Number.isFinite(pitchEvent.plateZ)
  );
}

function hasArchivedPitchEventsInInningOrder(pitchEvents: PitchEvent[]) {
  return pitchEvents.every((pitchEvent, index) => index === 0 || pitchEvent.inning >= pitchEvents[index - 1].inning);
}

function hasValidArchivedStartLine(start: ArchivedStart) {
  return (
    hasExactKeys(start.line, ["inningsPitched", "hits", "earnedRuns", "walks", "strikeouts", "pitches"]) &&
    isValidInningsPitched(start.line?.inningsPitched) &&
    Number.isInteger(start.line?.hits) &&
    Number.isInteger(start.line?.earnedRuns) &&
    Number.isInteger(start.line?.walks) &&
    Number.isInteger(start.line?.strikeouts) &&
    Number.isInteger(start.line?.pitches) &&
    start.line.hits >= 0 &&
    start.line.earnedRuns >= 0 &&
    start.line.walks >= 0 &&
    start.line.strikeouts >= 0 &&
    start.line.strikeouts <= inningsToOuts(start.line.inningsPitched) &&
    hasArchivedStartLinePitchLowerBound(start.line) &&
    start.line.pitches > 0
  );
}

function hasArchivedStartLinePitchLowerBound(line: StartLine) {
  return line.pitches >= inningsToOuts(line.inningsPitched) + line.hits + line.walks;
}

function hasValidArchivedStartShape(start: ArchivedStart) {
  return (
    hasExactKeys(start, ["id", "gamePk", "pitcherMlbId", "pitcherName", "team", "opponent", "side", "result", "line", "pitchEventCount", "arsenal", "pitchEvents", "source"]) &&
    Number.isInteger(start.gamePk) &&
    start.gamePk > 0 &&
    Number.isInteger(start.pitcherMlbId) &&
    start.pitcherMlbId > 0 &&
    start.id === `${start.gamePk}-${start.pitcherMlbId}` &&
    typeof start.pitcherName === "string" &&
    start.pitcherName.length > 0 &&
    isRouteSafeTeamAbbreviation(start.team) &&
    isRouteSafeTeamAbbreviation(start.opponent) &&
    start.team !== start.opponent &&
    (start.side === "home" || start.side === "away") &&
    (start.result === "W" || start.result === "L" || start.result === "ND") &&
    hasValidArchivedStartLine(start)
  );
}

function hasUniqueArchivedStartRouteIds(archive: DateArchive, starts: ArchivedStart[]) {
  const routeIds = new Set<string>();

  for (const start of starts) {
    const routeId = archivedStartRouteId(archive.date, start);
    if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9]+-[a-z0-9]+-\d+$/.test(routeId) || routeIds.has(routeId)) return false;
    routeIds.add(routeId);
  }

  return true;
}

function hasStartsOnlyForCompletedGames(archive: DateArchive) {
  return archive.games?.every((game) => isCompletedArchivedGame(game) || (game.starts ?? []).length === 0) ?? false;
}

function hasConsistentArchiveCounts(archive: DateArchive) {
  if (!archive.counts || !Array.isArray(archive.games)) return false;
  if (!hasExactKeys(archive, ["season", "date", "archivedAt", "source", "counts", "games"])) return false;
  if (!hasExactKeys(archive.counts, ["games", "completedGames", "starts", "pitchEvents"])) return false;

  const starts = archivedStarts(archive);
  const pitchEvents = starts.reduce((total, start) => total + (start.pitchEventCount ?? start.pitchEvents?.length ?? 0), 0);

  return (
    archive.counts.games === archive.games.length &&
    archive.counts.completedGames === archive.games.filter(isCompletedArchivedGame).length &&
    archive.counts.starts === starts.length &&
    archive.counts.pitchEvents === pitchEvents &&
    archive.games.every((game) => hasValidArchivedGameShape(game, archive.date, archive.archivedAt)) &&
    archive.games.every(hasArchivedStartsMatchingGameTeams) &&
    archive.games.every(hasValidArchivedGameStartLayout) &&
    hasUniqueArchivedGames(archive) &&
    hasStartsOnlyForCompletedGames(archive) &&
    starts.every(hasValidArchivedStartShape) &&
    hasUniqueArchivedStartRouteIds(archive, starts) &&
    starts.every(hasConsistentArchivedStart)
  );
}

function hasConsistentManifestCounts(manifest: SeasonArchiveManifest) {
  if (!manifest.counts || !Array.isArray(manifest.dates) || manifest.dates.length === 0) return false;
  if (!hasExactKeys(manifest, ["season", "startDate", "endDate", "archivedAt", "source", "archiveRoot", "counts", "dates"])) return false;
  if (!hasExactKeys(manifest.counts, ["dates", "games", "completedGames", "starts", "pitchEvents"])) return false;
  if (
    !isNonNegativeInteger(manifest.counts.dates) ||
    !isNonNegativeInteger(manifest.counts.games) ||
    !isNonNegativeInteger(manifest.counts.completedGames) ||
    !isNonNegativeInteger(manifest.counts.starts) ||
    !isNonNegativeInteger(manifest.counts.pitchEvents)
  ) return false;

  const manifestDateKeys = new Set<string>();
  for (const dateSummary of manifest.dates) {
    if (!hasExactKeys(dateSummary, ["date", "games", "completedGames", "starts", "pitchEvents"])) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateSummary.date) || !dateSummary.date.startsWith(`${manifest.season}-`) || manifestDateKeys.has(dateSummary.date)) return false;
    if (
      !isNonNegativeInteger(dateSummary.games) ||
      !isNonNegativeInteger(dateSummary.completedGames) ||
      !isNonNegativeInteger(dateSummary.starts) ||
      !isNonNegativeInteger(dateSummary.pitchEvents)
    ) return false;
    if (dateSummary.completedGames > dateSummary.games || dateSummary.starts > dateSummary.completedGames * 2 || dateSummary.starts % 2 !== 0) return false;
    manifestDateKeys.add(dateSummary.date);
  }

  const sortedDates = [...manifest.dates].sort((a, b) => a.date.localeCompare(b.date));
  if (!isSeasonDate(manifest.startDate, manifest.season) || !isSeasonDate(manifest.endDate, manifest.season)) return false;
  if (!manifest.dates.every((dateSummary, index) => dateSummary.date === sortedDates[index]?.date)) return false;
  if (!manifest.dates.every((dateSummary, index) => index === 0 || dateSummary.date === nextArchiveDate(manifest.dates?.[index - 1]?.date ?? ""))) return false;

  const totals = manifest.dates.reduce(
    (sum, dateSummary) => ({
      games: sum.games + (dateSummary.games ?? 0),
      completedGames: sum.completedGames + (dateSummary.completedGames ?? 0),
      starts: sum.starts + (dateSummary.starts ?? 0),
      pitchEvents: sum.pitchEvents + (dateSummary.pitchEvents ?? 0),
    }),
    { games: 0, completedGames: 0, starts: 0, pitchEvents: 0 }
  );

  return (
    manifest.source === "mlb-stats-api" &&
    normalizedArchiveRootPath(manifest.archiveRoot) === `data/mlb-archive/${manifest.season}` &&
    manifest.counts.dates === manifest.dates.length &&
    manifest.counts.completedGames <= manifest.counts.games &&
    manifest.counts.starts <= manifest.counts.completedGames * 2 &&
    manifest.counts.starts % 2 === 0 &&
    manifest.counts.games === totals.games &&
    manifest.counts.completedGames === totals.completedGames &&
    manifest.counts.starts === totals.starts &&
    manifest.counts.pitchEvents === totals.pitchEvents &&
    manifest.startDate === sortedDates[0]?.date &&
    manifest.endDate === sortedDates.at(-1)?.date &&
    isIsoTimestampOnOrAfterDate(manifest.archivedAt, manifest.endDate)
  );
}

async function readDateArchive(date: string): Promise<DateArchive | null> {
  try {
    const archive = JSON.parse(await readFile(archiveDatePath(date), "utf8")) as DateArchive;
    const manifest = JSON.parse(await readFile(archiveSeasonManifestPath(date.slice(0, 4)), "utf8")) as SeasonArchiveManifest;
    const manifestDate = manifest.dates?.find((summary) => summary.date === date);
    if (
      archive.season !== date.slice(0, 4) ||
      archive.date !== date ||
      archive.source !== "mlb-stats-api" ||
      !isIsoTimestamp(archive.archivedAt) ||
      !isIsoTimestampOnOrAfterDate(archive.archivedAt, archive.date) ||
      !Array.isArray(archive.games) ||
      !hasConsistentArchiveCounts(archive) ||
      manifest.season !== archive.season ||
      manifest.source !== archive.source ||
      !isIsoTimestamp(manifest.archivedAt) ||
      !isIsoTimestampAtOrAfter(manifest.archivedAt, archive.archivedAt) ||
      !hasConsistentManifestCounts(manifest) ||
      manifestDate?.games !== archive.counts?.games ||
      manifestDate?.completedGames !== archive.counts?.completedGames ||
      manifestDate?.starts !== archive.counts?.starts ||
      manifestDate?.pitchEvents !== archive.counts?.pitchEvents
    ) return null;
    return archive;
  } catch {
    return null;
  }
}

function archivedStarts(archive: DateArchive) {
  return archive.games?.flatMap((game) => game.starts ?? []) ?? [];
}

function archivedStartRouteId(date: string, start: ArchivedStart) {
  return `${date}-${start.team.toLowerCase()}-${start.opponent.toLowerCase()}-${start.pitcherMlbId}`;
}

function inningsToOuts(inningsPitched: number) {
  return outsFromIP(inningsPitched);
}

function outsToInnings(outs: number) {
  return Math.trunc(outs / 3) + (outs % 3) / 10;
}

function scoreArchivedPitcherStartLine(line: StartLine) {
  const rawScore = 50 + inningsFromIP(line.inningsPitched) * 2.2 + line.strikeouts * 1.5 - line.earnedRuns * 4 - line.hits * 0.9 - line.walks * 1.2;
  return Math.max(20, Math.min(80, Math.round(rawScore)));
}

export async function readArchivedCompletedPitchingLines(date: string): Promise<MlbCompletedPitchingLine[]> {
  const archive = await readDateArchive(date);
  if (!archive) return [];

  return archivedStarts(archive).map((start) => ({
    gamePk: start.gamePk,
    pitcherMlbId: start.pitcherMlbId,
    teamAbbreviation: start.team,
    opponentAbbreviation: start.opponent,
    side: start.side,
    result: start.result,
    line: start.line,
  }));
}

export async function readArchivedCompletedStarts(date: string): Promise<ArchivedCompletedStartSummary[]> {
  const archive = await readDateArchive(date);
  if (!archive) return [];

  return (archive.games ?? [])
    .filter(isCompletedArchivedGame)
    .flatMap((game) =>
      (game.starts ?? []).map((start) => ({
        date,
        gamePk: start.gamePk,
        gameDate: game.gameDate,
        venue: game.venue,
        awayTeam: game.awayTeam,
        homeTeam: game.homeTeam,
        pitcherMlbId: start.pitcherMlbId,
        pitcherName: start.pitcherName,
        team: start.team,
        opponent: start.opponent,
        side: start.side,
        result: start.result,
        line: start.line,
      })),
    );
}

export async function readArchivedSeasonCompletedStarts(season: string): Promise<ArchivedCompletedStartSummary[]> {
  try {
    const manifest = JSON.parse(await readFile(archiveSeasonManifestPath(season), "utf8")) as SeasonArchiveManifest;
    if (manifest.season !== season || !hasConsistentManifestCounts(manifest)) return [];

    const dates = [...(manifest.dates ?? [])].map((summary) => summary.date).sort();
    const startsByDate = await Promise.all(dates.map((date) => readArchivedCompletedStarts(date)));
    return startsByDate.flat();
  } catch {
    return [];
  }
}

export async function readArchivedDateSummary(date: string) {
  const archive = await readDateArchive(date);
  if (!archive?.archivedAt) return null;
  const starts = archivedStarts(archive);
  const completedGames = (archive.games ?? []).filter(isCompletedArchivedGame);
  const completedGamesWithStarts = completedGames.filter((game) => (game.starts ?? []).length > 0).length;

  return {
    date: archive.date,
    archivedAt: archive.archivedAt,
    source: archive.source,
    games: archive.counts?.games ?? archive.games?.length ?? 0,
    completedGames: archive.counts?.completedGames ?? 0,
    completedGamesWithStarts,
    completedGamesMissingStarts: Math.max(0, (archive.counts?.completedGames ?? completedGames.length) - completedGamesWithStarts),
    starts: archive.counts?.starts ?? starts.length,
    pitchEvents: archive.counts?.pitchEvents ?? starts.reduce((total, start) => total + (start.pitchEvents?.length ?? 0), 0),
    startsWithPitchEvents: starts.filter((start) => (start.pitchEventCount ?? start.pitchEvents?.length ?? 0) > 0).length,
    startsMissingPitchEvents: starts.filter((start) => start.source?.pitchEvents === "missing-gamefeed-pitches").length,
  };
}

export async function readArchivedSchedule(date: string): Promise<MlbSchedule | null> {
  const archive = await readDateArchive(date);
  if (!archive?.games) return null;

  return {
    date: archive.date,
    source: "live",
    games: archive.games.map((game) => {
      const awayStart = (game.starts ?? []).find((start) => start.side === "away");
      const homeStart = (game.starts ?? []).find((start) => start.side === "home");

      return {
        gamePk: game.gamePk,
        gameDate: game.gameDate,
        status: game.status.abstract ?? game.status.detailed,
        detailedState: game.status.detailed,
        venue: game.venue,
        awayTeam: game.awayTeam,
        homeTeam: game.homeTeam,
        probableAwayPitcher: awayStart
          ? {
              id: awayStart.pitcherMlbId,
              fullName: awayStart.pitcherName,
              teamAbbreviation: awayStart.team,
              opponentAbbreviation: awayStart.opponent,
              side: "away" as const,
            }
          : undefined,
        probableHomePitcher: homeStart
          ? {
              id: homeStart.pitcherMlbId,
              fullName: homeStart.pitcherName,
              teamAbbreviation: homeStart.team,
              opponentAbbreviation: homeStart.opponent,
              side: "home" as const,
            }
          : undefined,
      };
    }),
  };
}

export async function readArchivedStartPitchDetails(date: string, gamePk: number, pitcherMlbId: number): Promise<MlbStartPitchDetails | null> {
  const archive = await readDateArchive(date);
  const start = archive ? archivedStarts(archive).find((candidate) => candidate.gamePk === gamePk && candidate.pitcherMlbId === pitcherMlbId) : undefined;
  const pitchEvents = start?.pitchEvents ?? [];

  if (!start || pitchEvents.length === 0) return null;

  return {
    source: "archive-gamefeed",
    arsenal: start.arsenal ?? [],
    pitchEvents,
  };
}

export async function readArchivedPitcherRecentArsenal(pitcherMlbId: number, season: string, maxStarts = 5): Promise<ArchivedPitcherRecentArsenal | null> {
  try {
    const manifest = JSON.parse(await readFile(archiveSeasonManifestPath(season), "utf8")) as SeasonArchiveManifest;
    if (manifest.season !== season || !hasConsistentManifestCounts(manifest)) return null;

    const pitchEvents: PitchEvent[] = [];
    const startDates: string[] = [];
    let starts = 0;
    const dates = [...(manifest.dates ?? [])].map((summary) => summary.date).sort((a, b) => b.localeCompare(a));

    for (const date of dates) {
      const archive = await readDateArchive(date);
      if (!archive) return null;

      const archivedStartsForDate = archivedStarts(archive);
      const matches = archivedStartsForDate
        .filter((start) => start.pitcherMlbId === pitcherMlbId && (start.pitchEvents?.length ?? 0) > 0)
        .sort((a, b) => b.gamePk - a.gamePk);

      for (const start of matches) {
        pitchEvents.push(...(start.pitchEvents ?? []));
        startDates.push(date);
        starts += 1;
        if (starts >= maxStarts) break;
      }

      if (starts >= maxStarts) break;
    }

    if (pitchEvents.length === 0) return null;

    return {
      source: "archive-gamefeed",
      arsenal: summarizePitchEvents(pitchEvents),
      pitchEvents,
      archiveArsenal: {
        season,
        startDate: manifest.startDate ?? "",
        endDate: manifest.endDate ?? "",
        archivedAt: manifest.archivedAt ?? "",
        source: manifest.source,
        starts,
        pitchEvents: pitchEvents.length,
        firstStartDate: startDates.at(-1) ?? "",
        lastStartDate: startDates[0] ?? "",
      },
    };
  } catch {
    return null;
  }
}

export async function readArchivedPitcherSeasonProfile(pitcherMlbId: number, season: string): Promise<ArchivedPitcherSeasonProfile | null> {
  try {
    const manifest = JSON.parse(await readFile(archiveSeasonManifestPath(season), "utf8")) as SeasonArchiveManifest;
    if (manifest.season !== season || !hasConsistentManifestCounts(manifest)) return null;

    const starts: ArchivedPitcherSeasonProfile["starts"] = [];
    let name = "";
    let team = "";
    let outs = 0;
    let earnedRuns = 0;
    let strikeouts = 0;
    let walks = 0;
    const dates = [...(manifest.dates ?? [])].map((summary) => summary.date).sort((a, b) => b.localeCompare(a));

    for (const date of dates) {
      const archive = await readDateArchive(date);
      if (!archive) return null;

      const matches = archivedStarts(archive).filter((start) => start.pitcherMlbId === pitcherMlbId);

      for (const start of matches.sort((a, b) => b.gamePk - a.gamePk)) {
        name ||= start.pitcherName;
        team ||= start.team;
        outs += inningsToOuts(start.line.inningsPitched);
        earnedRuns += start.line.earnedRuns;
        strikeouts += start.line.strikeouts;
        walks += start.line.walks;
        starts.push({
          id: archivedStartRouteId(date, start),
          gamePk: start.gamePk,
          date,
          opponent: start.opponent,
          result: start.result,
          line: start.line,
          gameScorePlus: scoreArchivedPitcherStartLine(start.line),
        });
      }
    }

    if (starts.length === 0 || outs === 0) return null;

    return {
      source: "archive-gamefeed",
      mlbId: pitcherMlbId,
      name,
      team,
      archiveProfile: {
        season,
        startDate: manifest.startDate ?? "",
        endDate: manifest.endDate ?? "",
        archivedAt: manifest.archivedAt ?? "",
        source: manifest.source,
        dates: manifest.counts?.dates ?? 0,
        games: manifest.counts?.games ?? 0,
        completedGames: manifest.counts?.completedGames ?? 0,
        completedGamesWithStarts: Math.floor((manifest.counts?.starts ?? 0) / 2),
        completedGamesMissingStarts: Math.max(0, (manifest.counts?.completedGames ?? 0) - Math.floor((manifest.counts?.starts ?? 0) / 2)),
        starts: manifest.counts?.starts ?? 0,
        pitchEvents: manifest.counts?.pitchEvents ?? 0,
        pitcherStarts: starts.length,
      },
      seasonLine: {
        starts: starts.length,
        inningsPitched: outsToInnings(outs),
        era: Number(((earnedRuns * 27) / outs).toFixed(2)),
        strikeouts,
        walks,
      },
      starts,
    };
  } catch {
    return null;
  }
}

export async function readArchivedStartByRouteId(date: string, startId: string) {
  const archive = await readDateArchive(date);
  if (!archive) return null;

  const games = archive.games ?? [];

  for (const game of games) {
    const start = (game.starts ?? []).find((candidate) => archivedStartRouteId(date, candidate) === startId);
    if (start) return { archive, game, start };
  }

  return null;
}

export async function readArchivedStartPitchDetailSummary(date: string, gamePk: number, pitcherMlbId: number): Promise<ArchivedStartPitchDetailSummary> {
  const archive = await readDateArchive(date);
  const start = archive ? archivedStarts(archive).find((candidate) => candidate.gamePk === gamePk && candidate.pitcherMlbId === pitcherMlbId) : undefined;
  const pitchEvents = start?.pitchEventCount ?? start?.pitchEvents?.length ?? 0;

  if (!start) {
    return { status: "not-archived", pitchEvents: 0 };
  }

  const status =
    pitchEvents > 0 || start.source?.pitchEvents === "live-gamefeed"
      ? "stored"
      : start.source?.pitchEvents === "missing-gamefeed-pitches"
        ? "missing-gamefeed-pitches"
        : "not-archived";

  return {
    status,
    pitchEvents,
    date: archive?.date,
    archivedAt: archive?.archivedAt,
    source: archive?.source,
  };
}

export async function readArchivedStartLineSummary(date: string, gamePk: number, pitcherMlbId: number): Promise<ArchivedStartLineSummary> {
  const archive = await readDateArchive(date);
  const start = archive ? archivedStarts(archive).find((candidate) => candidate.gamePk === gamePk && candidate.pitcherMlbId === pitcherMlbId) : undefined;

  return start
    ? { status: "stored", date: archive?.date, archivedAt: archive?.archivedAt, source: archive?.source }
    : { status: "not-archived" };
}
