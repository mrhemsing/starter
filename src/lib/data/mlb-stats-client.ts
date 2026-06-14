import { demoProbableStarts } from "@/lib/data/demo";
import { inningsFromIP } from "@/lib/innings";
import type { ArsenalPitchSummary, MlbCompletedPitchingLine, MlbPitcherSeasonProfile, MlbPitcherSplitGroup, MlbProbablePitcher, MlbProbablePitcherGame, MlbSchedule, MlbScheduleGame, MlbStartPitchDetails, MlbTeamQualityContext, PitchEvent, PitchResultKey, PitchTypeKey, StartLine } from "@/lib/types";

const MLB_STATS_API_BASE = "https://statsapi.mlb.com/api/v1";
const MLB_GAME_FEED_BASE = "https://statsapi.mlb.com/api/v1.1/game";
const LIVE_SCHEDULE_CACHE_TTL_MS = 60 * 1000;
const LIVE_GAMEFEED_CACHE_TTL_MS = 60 * 1000;
const LIVE_CONTEXT_CACHE_TTL_MS = 5 * 60 * 1000;
const MLB_SCHEDULE_REVALIDATE_SECONDS = 5 * 60;
const MLB_GAMEFEED_REVALIDATE_SECONDS = 15 * 60;
const MLB_CONTEXT_REVALIDATE_SECONDS = 60 * 60;

type MlbScheduleClientOptions = {
  fetchLive?: boolean;
  signal?: AbortSignal;
};

type CachedSchedule = {
  expiresAt: number;
  promise: Promise<MlbSchedule>;
};

type CachedValue<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

const scheduleCache = new Map<string, CachedSchedule>();
const completedPitchingLineCache = new Map<string, CachedValue<MlbCompletedPitchingLine[]>>();
const teamQualityContextCache = new Map<string, CachedValue<Map<string, MlbTeamQualityContext>>>();
const teamOffenseContextCache = new Map<string, CachedValue<Map<number, MlbTeamOffenseContext>>>();

function cachedRequestInit(options: MlbScheduleClientOptions, revalidate: number): RequestInit & { next?: { revalidate: number } } {
  if (options.signal) {
    return {
      cache: "no-store",
      signal: options.signal,
    };
  }

  return {
    next: { revalidate },
  };
}

type MlbApiTeamNode = {
  team?: {
    name?: string;
    abbreviation?: string;
  };
  probablePitcher?: {
    id?: number;
    fullName?: string;
  };
};

type MlbApiGame = {
  gamePk?: number;
  gameDate?: string;
  status?: {
    abstractGameState?: string;
    detailedState?: string;
  };
  venue?: {
    name?: string;
  };
  teams?: {
    home?: MlbApiTeamNode;
    away?: MlbApiTeamNode;
  };
};

type MlbScheduleApiResponse = {
  dates?: Array<{
    date?: string;
    games?: MlbApiGame[];
  }>;
};

type MlbStandingsApiResponse = {
  records?: Array<{
    teamRecords?: MlbStandingsTeamRecord[];
  }>;
};

type MlbStandingsTeamRecord = {
  team?: {
    id?: number;
    abbreviation?: string;
  };
  wins?: number;
  losses?: number;
  gamesPlayed?: number;
  runDifferential?: number;
  winningPercentage?: string;
};

type MlbTeamStatsApiResponse = {
  stats?: Array<{
    splits?: MlbTeamHittingSplit[];
  }>;
};

type MlbPeopleApiResponse = {
  people?: Array<{
    id?: number;
    fullName?: string;
    pitchHand?: {
      code?: string;
    };
  }>;
};

type MlbPersonStatsApiResponse = {
  stats?: Array<{
    splits?: MlbPersonStatSplit[];
  }>;
};

type MlbPersonStatSplit = {
  season?: string;
  date?: string;
  isWin?: boolean;
  split?: {
    code?: string;
    description?: string;
  };
  team?: {
    id?: number;
    name?: string;
  };
  opponent?: {
    id?: number;
    name?: string;
  };
  player?: {
    id?: number;
    fullName?: string;
  };
  game?: {
    gamePk?: number;
  };
  stat?: MlbGameFeedPitchingStats & {
    era?: string;
  };
};

type MlbTeamsApiResponse = {
  teams?: Array<{
    id?: number;
    name?: string;
    abbreviation?: string;
  }>;
};

type MlbTeamHittingSplit = {
  team?: {
    id?: number;
  };
  stat?: {
    gamesPlayed?: number;
    runs?: number;
    ops?: string;
  };
};

type MlbTeamOffenseContext = {
  teamId: number;
  runsPerGame: number;
  ops: number;
  opponentOffenseRunValue: number;
  opponentOffenseLabel: string;
};

type MlbGameFeedPitchingStats = {
  gamesStarted?: number;
  inningsPitched?: string;
  hits?: number;
  earnedRuns?: number;
  baseOnBalls?: number;
  strikeOuts?: number;
  numberOfPitches?: number;
  pitchesThrown?: number;
  wins?: number;
  losses?: number;
  avg?: string;
};

type MlbGameFeedPlayer = {
  person?: {
    id?: number;
    fullName?: string;
  };
  stats?: {
    pitching?: MlbGameFeedPitchingStats;
  };
};

type MlbGameFeedTeam = {
  pitchers?: number[];
  team?: {
    abbreviation?: string;
  };
  players?: Record<string, MlbGameFeedPlayer>;
};

type MlbGameFeedResponse = {
  gameData?: {
    teams?: {
      away?: { abbreviation?: string };
      home?: { abbreviation?: string };
    };
  };
  liveData?: {
    boxscore?: {
      teams?: {
        away?: MlbGameFeedTeam;
        home?: MlbGameFeedTeam;
      };
    };
    decisions?: {
      winner?: { id?: number };
      loser?: { id?: number };
    };
    plays?: {
      allPlays?: MlbGameFeedPlay[];
    };
  };
};

type MlbGameFeedPlay = {
  matchup?: {
    pitcher?: {
      id?: number;
    };
  };
  about?: {
    inning?: number;
  };
  playEvents?: MlbGameFeedPlayEvent[];
};

type MlbGameFeedPlayEvent = {
  isPitch?: boolean;
  pitchNumber?: number;
  count?: {
    balls?: number;
    strikes?: number;
  };
  details?: {
    call?: {
      code?: string;
    };
    type?: {
      code?: string;
    };
  };
  pitchData?: {
    startSpeed?: number;
    coordinates?: {
      pX?: number;
      pZ?: number;
    };
  };
};

export async function fetchMlbSchedule(date: string, options: MlbScheduleClientOptions = {}): Promise<MlbSchedule> {
  if (!options.fetchLive) return getFixtureSchedule(date);

  const cacheKey = `${date}:live`;
  const cached = scheduleCache.get(cacheKey);
  if (!options.signal && cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = fetchLiveMlbSchedule(date, options);
  if (!options.signal) {
    scheduleCache.set(cacheKey, {
      expiresAt: Date.now() + LIVE_SCHEDULE_CACHE_TTL_MS,
      promise,
    });
  }

  return promise;
}

async function fetchLiveMlbSchedule(date: string, options: MlbScheduleClientOptions = {}): Promise<MlbSchedule> {
  const params = new URLSearchParams({
    sportId: "1",
    date,
    hydrate: "probablePitcher,team",
  });

  try {
    const response = await fetch(`${MLB_STATS_API_BASE}/schedule?${params.toString()}`, cachedRequestInit(options, MLB_SCHEDULE_REVALIDATE_SECONDS));

    if (!response.ok) return getFixtureSchedule(date);

    const payload = (await response.json()) as MlbScheduleApiResponse;
    return parseSchedulePayload(date, payload, "live");
  } catch {
    return getFixtureSchedule(date);
  }
}

export async function getMlbProbablePitchers(date: string, options: MlbScheduleClientOptions = {}): Promise<MlbProbablePitcherGame[]> {
  const schedule = await fetchMlbSchedule(date, options);

  return schedule.games.flatMap((game) =>
    [game.probableAwayPitcher, game.probableHomePitcher]
      .filter((pitcher): pitcher is MlbProbablePitcher => Boolean(pitcher))
      .map((pitcher) => ({
        ...pitcher,
        gamePk: game.gamePk,
        gameDate: game.gameDate,
        gameStatus: game.detailedState,
        venue: game.venue,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
      })),
  );
}

export async function fetchMlbCompletedPitchingLines(gamePk: number, options: MlbScheduleClientOptions = {}): Promise<MlbCompletedPitchingLine[]> {
  if (!options.fetchLive) return [];
  const cacheKey = `${gamePk}:completed-lines`;
  const cached = completedPitchingLineCache.get(cacheKey);
  if (!options.signal && cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = fetchLiveMlbCompletedPitchingLines(gamePk, options);
  if (!options.signal) {
    completedPitchingLineCache.set(cacheKey, {
      expiresAt: Date.now() + LIVE_GAMEFEED_CACHE_TTL_MS,
      promise,
    });
  }

  return promise;
}

async function fetchLiveMlbCompletedPitchingLines(gamePk: number, options: MlbScheduleClientOptions = {}): Promise<MlbCompletedPitchingLine[]> {
  try {
    const response = await fetch(`${MLB_GAME_FEED_BASE}/${gamePk}/feed/live`, cachedRequestInit(options, MLB_GAMEFEED_REVALIDATE_SECONDS));

    if (!response.ok) return [];

    const payload = (await response.json()) as MlbGameFeedResponse;
    return parseCompletedPitchingLines(gamePk, payload);
  } catch {
    return [];
  }
}

export async function fetchMlbTeamQualityContexts(date: string, options: MlbScheduleClientOptions = {}): Promise<Map<string, MlbTeamQualityContext>> {
  if (!options.fetchLive) return new Map();
  const cacheKey = `${date}:team-quality`;
  const cached = teamQualityContextCache.get(cacheKey);
  if (!options.signal && cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = fetchLiveMlbTeamQualityContexts(date, options);
  if (!options.signal) {
    teamQualityContextCache.set(cacheKey, {
      expiresAt: Date.now() + LIVE_CONTEXT_CACHE_TTL_MS,
      promise,
    });
  }

  return promise;
}

async function fetchLiveMlbTeamQualityContexts(date: string, options: MlbScheduleClientOptions = {}): Promise<Map<string, MlbTeamQualityContext>> {
  const season = date.slice(0, 4);
  const params = new URLSearchParams({
    leagueId: "103,104",
    season,
    date,
    hydrate: "team",
  });

  try {
    const [response, offenseContexts] = await Promise.all([
      fetch(`${MLB_STATS_API_BASE}/standings?${params.toString()}`, cachedRequestInit(options, MLB_CONTEXT_REVALIDATE_SECONDS)),
      fetchMlbTeamOffenseContexts(season, options),
    ]);

    if (!response.ok) return new Map();

    const payload = (await response.json()) as MlbStandingsApiResponse;
    return parseTeamQualityContexts(payload, offenseContexts);
  } catch {
    return new Map();
  }
}

async function fetchMlbTeamOffenseContexts(season: string, options: MlbScheduleClientOptions = {}) {
  const cacheKey = `${season}:team-offense`;
  const cached = teamOffenseContextCache.get(cacheKey);
  if (!options.signal && cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = fetchLiveMlbTeamOffenseContexts(season, options);
  if (!options.signal) {
    teamOffenseContextCache.set(cacheKey, {
      expiresAt: Date.now() + LIVE_CONTEXT_CACHE_TTL_MS,
      promise,
    });
  }

  return promise;
}

async function fetchLiveMlbTeamOffenseContexts(season: string, options: MlbScheduleClientOptions = {}) {
  const params = new URLSearchParams({
    season,
    group: "hitting",
    stats: "season",
    sportIds: "1",
  });

  try {
    const response = await fetch(`${MLB_STATS_API_BASE}/teams/stats?${params.toString()}`, cachedRequestInit(options, MLB_CONTEXT_REVALIDATE_SECONDS));

    if (!response.ok) return new Map<number, MlbTeamOffenseContext>();

    const payload = (await response.json()) as MlbTeamStatsApiResponse;
    return parseTeamOffenseContexts(payload);
  } catch {
    return new Map<number, MlbTeamOffenseContext>();
  }
}

export async function fetchMlbStartPitchDetails(gamePk: number, pitcherMlbId: number, options: MlbScheduleClientOptions = {}): Promise<MlbStartPitchDetails | null> {
  if (!options.fetchLive) return null;

  try {
    const response = await fetch(`${MLB_GAME_FEED_BASE}/${gamePk}/feed/live`, cachedRequestInit(options, MLB_GAMEFEED_REVALIDATE_SECONDS));

    if (!response.ok) return null;

    const payload = (await response.json()) as MlbGameFeedResponse;
    const pitchEvents = parseStartPitchEvents(gamePk, pitcherMlbId, payload);
    if (pitchEvents.length === 0) return null;

    return {
      source: "live-gamefeed",
      arsenal: summarizePitchEvents(pitchEvents),
      pitchEvents,
    };
  } catch {
    return null;
  }
}

export async function fetchMlbPitcherRecentArsenal(pitcherMlbId: number, gamePks: number[], options: MlbScheduleClientOptions = {}): Promise<MlbStartPitchDetails | null> {
  if (!options.fetchLive || gamePks.length === 0) return null;

  const details = await Promise.all(gamePks.map((gamePk) => fetchMlbStartPitchDetails(gamePk, pitcherMlbId, options)));
  const pitchEvents = details.flatMap((detail) => detail?.pitchEvents ?? []);
  if (pitchEvents.length === 0) return null;

  return {
    source: "live-gamefeed",
    arsenal: summarizePitchEvents(pitchEvents),
    pitchEvents,
  };
}

export async function fetchMlbPitcherSeasonProfile(pitcherMlbId: number, season: string, options: MlbScheduleClientOptions = {}): Promise<MlbPitcherSeasonProfile | null> {
  if (!options.fetchLive) return null;

  const seasonParams = new URLSearchParams({ stats: "season", group: "pitching", season });
  const gameLogParams = new URLSearchParams({ stats: "gameLog", group: "pitching", season });
  const teamsParams = new URLSearchParams({ sportId: "1", season });

  try {
    const [personResponse, seasonResponse, gameLogResponse, teamsResponse] = await Promise.all([
      fetch(`${MLB_STATS_API_BASE}/people/${pitcherMlbId}`, { cache: "no-store", signal: options.signal }),
      fetch(`${MLB_STATS_API_BASE}/people/${pitcherMlbId}/stats?${seasonParams.toString()}`, { cache: "no-store", signal: options.signal }),
      fetch(`${MLB_STATS_API_BASE}/people/${pitcherMlbId}/stats?${gameLogParams.toString()}`, { cache: "no-store", signal: options.signal }),
      fetch(`${MLB_STATS_API_BASE}/teams?${teamsParams.toString()}`, { cache: "no-store", signal: options.signal }),
    ]);

    if (!personResponse.ok || !seasonResponse.ok || !gameLogResponse.ok || !teamsResponse.ok) return null;

    const [personPayload, seasonPayload, gameLogPayload, teamsPayload] = (await Promise.all([
      personResponse.json(),
      seasonResponse.json(),
      gameLogResponse.json(),
      teamsResponse.json(),
    ])) as [MlbPeopleApiResponse, MlbPersonStatsApiResponse, MlbPersonStatsApiResponse, MlbTeamsApiResponse];

    return parsePitcherSeasonProfile(pitcherMlbId, personPayload, seasonPayload, gameLogPayload, teamsPayload);
  } catch {
    return null;
  }
}

export async function fetchMlbPitcherSplits(pitcherMlbId: number, season: string, options: MlbScheduleClientOptions = {}): Promise<MlbPitcherSplitGroup[] | null> {
  if (!options.fetchLive) return null;

  const batterHandParams = new URLSearchParams({ stats: "statSplits", group: "pitching", season, sitCodes: "vl,vr" });
  const venueParams = new URLSearchParams({ stats: "statSplits", group: "pitching", season, sitCodes: "h,a" });

  try {
    const [batterHandResponse, venueResponse] = await Promise.all([
      fetch(`${MLB_STATS_API_BASE}/people/${pitcherMlbId}/stats?${batterHandParams.toString()}`, { cache: "no-store", signal: options.signal }),
      fetch(`${MLB_STATS_API_BASE}/people/${pitcherMlbId}/stats?${venueParams.toString()}`, { cache: "no-store", signal: options.signal }),
    ]);

    if (!batterHandResponse.ok || !venueResponse.ok) return null;

    const [batterHandPayload, venuePayload] = (await Promise.all([
      batterHandResponse.json(),
      venueResponse.json(),
    ])) as [MlbPersonStatsApiResponse, MlbPersonStatsApiResponse];
    const splits = parsePitcherSplits([...readStatsSplits(batterHandPayload), ...readStatsSplits(venuePayload)]);

    return splits.length === 4 ? splits : null;
  } catch {
    return null;
  }
}

function parseSchedulePayload(date: string, payload: MlbScheduleApiResponse, source: MlbSchedule["source"]): MlbSchedule {
  const scheduleDate = payload.dates?.find((entry) => entry.date === date) ?? payload.dates?.[0];

  return {
    date: scheduleDate?.date ?? date,
    source,
    games: scheduleDate?.games?.flatMap(parseGame).filter((game): game is MlbScheduleGame => Boolean(game)) ?? [],
  };
}

function parseTeamQualityContexts(payload: MlbStandingsApiResponse, offenseContexts = new Map<number, MlbTeamOffenseContext>()) {
  const contexts = new Map<string, MlbTeamQualityContext>();

  for (const record of payload.records ?? []) {
    for (const teamRecord of record.teamRecords ?? []) {
      const teamId = teamRecord.team?.id;
      const abbreviation = teamRecord.team?.abbreviation;
      const wins = teamRecord.wins ?? 0;
      const losses = teamRecord.losses ?? 0;
      const gamesPlayed = teamRecord.gamesPlayed ?? wins + losses;
      const runDifferential = teamRecord.runDifferential ?? 0;
      const winningPercentage = Number(teamRecord.winningPercentage);

      if (!teamId || !abbreviation || gamesPlayed <= 0 || !Number.isFinite(winningPercentage)) continue;

      const runDifferentialPerGame = runDifferential / gamesPlayed;
      const opponentQualityRunValue = clamp((winningPercentage - 0.5) * 10 + runDifferentialPerGame * 1.5, -4, 4);
      const offenseContext = offenseContexts.get(teamId);

      contexts.set(abbreviation, {
        abbreviation,
        teamId,
        wins,
        losses,
        runDifferential,
        winningPercentage,
        runsPerGame: offenseContext?.runsPerGame,
        ops: offenseContext?.ops,
        opponentQualityRunValue: Number(opponentQualityRunValue.toFixed(1)),
        opponentQualityLabel: `${abbreviation} live standings context: ${wins}-${losses}, ${formatSignedInteger(runDifferential)} run differential.`,
        opponentOffenseRunValue: offenseContext?.opponentOffenseRunValue ?? 0,
        opponentOffenseLabel: offenseContext?.opponentOffenseLabel ?? `${abbreviation} live offense context unavailable; using neutral lineup adjustment.`,
      });
    }
  }

  return contexts;
}

function parseTeamOffenseContexts(payload: MlbTeamStatsApiResponse) {
  const contexts = new Map<number, MlbTeamOffenseContext>();

  for (const statGroup of payload.stats ?? []) {
    for (const split of statGroup.splits ?? []) {
      const teamId = split.team?.id;
      const gamesPlayed = split.stat?.gamesPlayed ?? 0;
      const runs = split.stat?.runs ?? 0;
      const ops = Number(split.stat?.ops);

      if (!teamId || gamesPlayed <= 0 || !Number.isFinite(ops)) continue;

      const runsPerGame = runs / gamesPlayed;
      const opponentOffenseRunValue = clamp((ops - 0.71) * 18 + (runsPerGame - 4.35) * 1.1, -4, 4);

      contexts.set(teamId, {
        teamId,
        runsPerGame: Number(runsPerGame.toFixed(2)),
        ops: Number(ops.toFixed(3)),
        opponentOffenseRunValue: Number(opponentOffenseRunValue.toFixed(1)),
        opponentOffenseLabel: `Live offense context: ${runsPerGame.toFixed(2)} R/G, ${ops.toFixed(3)} OPS.`,
      });
    }
  }

  return contexts;
}

function parsePitcherSeasonProfile(
  pitcherMlbId: number,
  personPayload: MlbPeopleApiResponse,
  seasonPayload: MlbPersonStatsApiResponse,
  gameLogPayload: MlbPersonStatsApiResponse,
  teamsPayload: MlbTeamsApiResponse,
): MlbPitcherSeasonProfile | null {
  const person = personPayload.people?.[0];
  const seasonSplit = seasonPayload.stats?.[0]?.splits?.[0];
  const seasonStats = seasonSplit?.stat;
  const teamLookup = parseTeamAbbreviationLookup(teamsPayload);
  const teamId = seasonSplit?.team?.id;
  const team = teamId ? teamLookup.get(teamId) : undefined;
  const throws = person?.pitchHand?.code;

  if (!person?.id || !person.fullName || !seasonStats || !team || (throws !== "R" && throws !== "L")) return null;

  const starts = (gameLogPayload.stats?.[0]?.splits ?? [])
    .filter((split) => split.stat?.gamesStarted === 1 && split.date && split.game?.gamePk)
    .map((split) => readPitcherGameLogStart(split, pitcherMlbId, teamLookup))
    .filter((start): start is MlbPitcherSeasonProfile["starts"][number] => Boolean(start))
    .sort((a, b) => b.date.localeCompare(a.date));

  if (starts.length === 0) return null;

  return {
    source: "live-people-stats",
    id: String(pitcherMlbId),
    mlbId: pitcherMlbId,
    name: person.fullName,
    team,
    throws,
    headshotUrl: `https://img.mlbstatic.com/mlb-photos/image/upload/w_360,q_auto:best/v1/people/${pitcherMlbId}/headshot/67/current`,
    seasonLine: {
      starts: seasonStats.gamesStarted ?? starts.length,
      inningsPitched: Number(seasonStats.inningsPitched) || starts.reduce((sum, start) => sum + start.line.inningsPitched, 0),
      era: Number(seasonStats.era) || 0,
      strikeouts: seasonStats.strikeOuts ?? starts.reduce((sum, start) => sum + start.line.strikeouts, 0),
      walks: seasonStats.baseOnBalls ?? starts.reduce((sum, start) => sum + start.line.walks, 0),
    },
    starts,
  };
}

function readStatsSplits(payload: MlbPersonStatsApiResponse) {
  return payload.stats?.flatMap((statGroup) => statGroup.splits ?? []) ?? [];
}

function parsePitcherSplits(splits: MlbPersonStatSplit[]): MlbPitcherSplitGroup[] {
  return [
    readPitcherSplit(splits, "vr", "vs-rhb", "Vs RHB", "batter-hand"),
    readPitcherSplit(splits, "vl", "vs-lhb", "Vs LHB", "batter-hand"),
    readPitcherSplit(splits, "h", "home", "Home", "venue"),
    readPitcherSplit(splits, "a", "away", "Away", "venue"),
  ].filter((split): split is MlbPitcherSplitGroup => Boolean(split));
}

function readPitcherSplit(
  splits: MlbPersonStatSplit[],
  code: string,
  key: MlbPitcherSplitGroup["key"],
  label: MlbPitcherSplitGroup["label"],
  scope: MlbPitcherSplitGroup["scope"],
): MlbPitcherSplitGroup | undefined {
  const split = splits.find((candidate) => candidate.split?.code === code);
  const stat = split?.stat;
  if (!stat) return undefined;

  const inningsPitched = Number(stat.inningsPitched);
  const era = stat.era === undefined ? null : Number(stat.era);
  const opponentAverage = Number(stat.avg);

  if (!Number.isFinite(inningsPitched) || (era !== null && !Number.isFinite(era)) || !Number.isFinite(opponentAverage)) return undefined;

  return {
    key,
    label,
    scope,
    inningsPitched,
    era,
    strikeouts: stat.strikeOuts ?? 0,
    walks: stat.baseOnBalls ?? 0,
    opponentAverage,
    note: `Live MLB statSplits: ${split?.split?.description ?? label}.`,
  };
}

function parseTeamAbbreviationLookup(payload: MlbTeamsApiResponse) {
  const lookup = new Map<number, string>();

  for (const team of payload.teams ?? []) {
    if (team.id && team.abbreviation) lookup.set(team.id, team.abbreviation);
  }

  return lookup;
}

function readPitcherGameLogStart(split: MlbPersonStatSplit, pitcherMlbId: number, teamLookup: Map<number, string>): MlbPitcherSeasonProfile["starts"][number] | undefined {
  const date = split.date;
  const gamePk = split.game?.gamePk;
  const stats = split.stat;
  const teamAbbreviation = split.team?.id ? teamLookup.get(split.team.id) : undefined;
  const opponentAbbreviation = split.opponent?.id ? teamLookup.get(split.opponent.id) : undefined;

  if (!date || !gamePk || !stats || !teamAbbreviation || !opponentAbbreviation) return undefined;

  const line = readStartLine(stats);
  if (!line) return undefined;

  return {
    gamePk,
    id: `${date}-${teamAbbreviation.toLowerCase()}-${opponentAbbreviation.toLowerCase()}-${pitcherMlbId}`,
    date,
    opponent: opponentAbbreviation,
    result: split.isWin ? "W" : stats.losses && stats.losses > 0 ? "L" : "ND",
    line,
    gameScorePlus: scorePitcherGameLogStart(line),
  };
}

function scorePitcherGameLogStart(line: StartLine) {
  const rawScore = 50 + inningsFromIP(line.inningsPitched) * 2.2 + line.strikeouts * 1.5 - line.earnedRuns * 4 - line.hits * 0.9 - line.walks * 1.2;
  return Math.max(20, Math.min(80, Math.round(rawScore)));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatSignedInteger(value: number) {
  return `${value >= 0 ? "+" : ""}${value}`;
}

function parseCompletedPitchingLines(gamePk: number, payload: MlbGameFeedResponse): MlbCompletedPitchingLine[] {
  const awayTeam = payload.liveData?.boxscore?.teams?.away;
  const homeTeam = payload.liveData?.boxscore?.teams?.home;
  const awayAbbreviation = awayTeam?.team?.abbreviation ?? payload.gameData?.teams?.away?.abbreviation;
  const homeAbbreviation = homeTeam?.team?.abbreviation ?? payload.gameData?.teams?.home?.abbreviation;

  return [
    ...parseTeamPitchingLines(gamePk, "away", awayTeam, awayAbbreviation, homeAbbreviation, payload),
    ...parseTeamPitchingLines(gamePk, "home", homeTeam, homeAbbreviation, awayAbbreviation, payload),
  ];
}

function parseTeamPitchingLines(
  gamePk: number,
  side: "home" | "away",
  team: MlbGameFeedTeam | undefined,
  teamAbbreviation: string | undefined,
  opponentAbbreviation: string | undefined,
  payload: MlbGameFeedResponse,
): MlbCompletedPitchingLine[] {
  if (!team?.players || !teamAbbreviation || !opponentAbbreviation) return [];

  return Object.values(team.players)
    .map((player) => readCompletedPitchingLine(gamePk, side, teamAbbreviation, opponentAbbreviation, player, payload))
    .filter((line): line is MlbCompletedPitchingLine => Boolean(line));
}

function readCompletedPitchingLine(
  gamePk: number,
  side: "home" | "away",
  teamAbbreviation: string,
  opponentAbbreviation: string,
  player: MlbGameFeedPlayer,
  payload: MlbGameFeedResponse,
): MlbCompletedPitchingLine | undefined {
  const pitcherMlbId = player.person?.id;
  const stats = player.stats?.pitching;
  if (!pitcherMlbId || !stats || stats.gamesStarted !== 1) return undefined;

  const line = readStartLine(stats);
  if (!line) return undefined;

  return {
    gamePk,
    pitcherMlbId,
    pitcherName: player.person?.fullName,
    teamAbbreviation,
    opponentAbbreviation,
    side,
    result: readPitchingDecision(pitcherMlbId, payload),
    line,
  };
}

function readStartLine(stats: MlbGameFeedPitchingStats): StartLine | undefined {
  const inningsPitched = Number(stats.inningsPitched);
  if (!Number.isFinite(inningsPitched)) return undefined;

  return {
    inningsPitched,
    hits: stats.hits ?? 0,
    earnedRuns: stats.earnedRuns ?? 0,
    walks: stats.baseOnBalls ?? 0,
    strikeouts: stats.strikeOuts ?? 0,
    pitches: stats.numberOfPitches ?? stats.pitchesThrown ?? 0,
  };
}

function readPitchingDecision(pitcherMlbId: number, payload: MlbGameFeedResponse): MlbCompletedPitchingLine["result"] {
  if (payload.liveData?.decisions?.winner?.id === pitcherMlbId) return "W";
  if (payload.liveData?.decisions?.loser?.id === pitcherMlbId) return "L";
  return "ND";
}

function parseStartPitchEvents(gamePk: number, pitcherMlbId: number, payload: MlbGameFeedResponse): PitchEvent[] {
  const events = payload.liveData?.plays?.allPlays ?? [];
  let pitchNumber = 1;

  return events.flatMap((play) => {
    if (play.matchup?.pitcher?.id !== pitcherMlbId) return [];
    const parsedEvents: PitchEvent[] = [];
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

function readPitchType(code: string | undefined): PitchTypeKey | undefined {
  if (!code) return undefined;
  if (["FF", "FA"].includes(code)) return "FF";
  if (["SI", "FT"].includes(code)) return "SI";
  if (["SL", "ST", "SV"].includes(code)) return "SL";
  if (["CH", "FS", "FO", "SC"].includes(code)) return "CH";
  if (["CU", "KC", "CS", "EP"].includes(code)) return "CU";
  if (code === "FC") return "FC";
  return undefined;
}

function readPitchResult(code: string | undefined): PitchResultKey | undefined {
  if (!code) return undefined;
  if (["C", "W", "M", "Q"].includes(code)) return "called_strike";
  if (["S", "T"].includes(code)) return "swinging_strike";
  if (["F", "L", "O", "R"].includes(code)) return "foul";
  if (["B", "I", "P", "V"].includes(code)) return "ball";
  if (["X", "D", "E"].includes(code)) return "hit_into_play";
  return undefined;
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

function parseGame(game: MlbApiGame): MlbScheduleGame[] {
  const gamePk = game.gamePk;
  const gameDate = game.gameDate;
  const homeTeam = game.teams?.home?.team;
  const awayTeam = game.teams?.away?.team;

  if (!gamePk || !gameDate || !homeTeam?.name || !awayTeam?.name) return [];

  const homeAbbreviation = homeTeam.abbreviation ?? homeTeam.name;
  const awayAbbreviation = awayTeam.abbreviation ?? awayTeam.name;
  const baseGame = {
    gamePk,
    gameDate,
    status: game.status?.abstractGameState ?? "scheduled",
    detailedState: game.status?.detailedState ?? "Scheduled",
    venue: game.venue?.name ?? "TBD",
    homeTeam: { abbreviation: homeAbbreviation, name: homeTeam.name },
    awayTeam: { abbreviation: awayAbbreviation, name: awayTeam.name },
  };

  return [
    {
      ...baseGame,
      probableHomePitcher: readProbablePitcher(game.teams?.home, homeAbbreviation, awayAbbreviation, "home"),
      probableAwayPitcher: readProbablePitcher(game.teams?.away, awayAbbreviation, homeAbbreviation, "away"),
    },
  ];
}

function readProbablePitcher(teamNode: MlbApiTeamNode | undefined, teamAbbreviation: string, opponentAbbreviation: string, side: "home" | "away"): MlbProbablePitcher | undefined {
  const pitcher = teamNode?.probablePitcher;
  if (!pitcher?.id || !pitcher.fullName) return undefined;

  return {
    id: pitcher.id,
    fullName: pitcher.fullName,
    teamAbbreviation,
    opponentAbbreviation,
    side,
  };
}

function getFixtureSchedule(date: string): MlbSchedule {
  return {
    date,
    source: "fixture",
    games: demoProbableStarts.map((probable) => {
      const probablePitcher: MlbProbablePitcher = {
        id: probable.pitcherMlbId,
        fullName: probable.pitcherName,
        teamAbbreviation: probable.team,
        opponentAbbreviation: probable.opponent,
        side: "away",
      };

      return {
        gamePk: probable.gamePk,
        gameDate: `${date}T00:00:00Z`,
        status: "scheduled",
        detailedState: probable.status,
        venue: "Fixture Park",
        awayTeam: { abbreviation: probable.team, name: probable.team },
        homeTeam: { abbreviation: probable.opponent, name: probable.opponent },
        probableAwayPitcher: probablePitcher,
      };
    }),
  };
}
