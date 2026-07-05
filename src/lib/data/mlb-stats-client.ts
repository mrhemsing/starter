import { demoProbableStarts } from "@/lib/data/demo";
import { readRuntimeState, writeRuntimeState } from "@/lib/data/runtime-state-store";
import { inningsFromIP } from "@/lib/innings";
import type { ArsenalPitchSummary, MlbCompletedPitchingLine, MlbLivePitchingLine, MlbPitcherSeasonProfile, MlbPitcherSplitGroup, MlbProbablePitcher, MlbProbablePitcherGame, MlbSchedule, MlbScheduleGame, MlbStartPitchDetails, MlbTeamHandednessSplitContext, MlbTeamQualityContext, PitchEvent, PitchResultKey, PitchTypeKey, PitcherAvailability, StartLine } from "@/lib/types";

const MLB_STATS_API_BASE = "https://statsapi.mlb.com/api/v1";
const MLB_GAME_FEED_BASE = "https://statsapi.mlb.com/api/v1.1/game";
const ESPN_MLB_SCOREBOARD_API = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard";
const LIVE_SCHEDULE_CACHE_TTL_MS = 60 * 1000;
const LIVE_GAMEFEED_CACHE_TTL_MS = 60 * 1000;
const LIVE_CONTEXT_CACHE_TTL_MS = 5 * 60 * 1000;
const MLB_SCHEDULE_REVALIDATE_SECONDS = 60;
const MLB_GAMEFEED_REVALIDATE_SECONDS = 15 * 60;
const MLB_CONTEXT_REVALIDATE_SECONDS = 60 * 60;
const MLB_PLAYER_PROFILE_REVALIDATE_SECONDS = 15 * 60;
export const PROBABLES_REPOLL_FAR_SECONDS = 60 * 60;
export const PROBABLES_REPOLL_NEAR_SECONDS = 15 * 60;
export const PROBABLES_REPOLL_URGENT_SECONDS = 5 * 60;
const PROBABLES_NEAR_FIRST_PITCH_MS = 4 * 60 * 60 * 1000;
const PROBABLES_URGENT_FIRST_PITCH_MS = 60 * 60 * 1000;
const PROBABLE_CONFIDENCE_TRANSITION_HORIZON_DAYS = 7;
const NEXT_PRODUCTION_BUILD_PHASE = "phase-production-build";

type MlbScheduleClientOptions = {
  fetchLive?: boolean;
  gamefeedRevalidateSeconds?: number;
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
const livePitchingLineCache = new Map<string, CachedValue<MlbLivePitchingLine[]>>();
const teamQualityContextCache = new Map<string, CachedValue<Map<string, MlbTeamQualityContext>>>();
const teamOffenseContextCache = new Map<string, CachedValue<Map<number, MlbTeamOffenseContext>>>();
const teamHandednessSplitCache = new Map<string, CachedValue<Map<string, MlbTeamHandednessSplitContext>>>();
const resolvedReportedPitcherCache = new Map<string, CachedValue<number | null>>();
const probableConfidenceBySlot = new Map<string, MlbProbablePitcher["confidence"] | "TBD">();

type ProbableConfidenceState = {
  confidence: MlbProbablePitcher["confidence"] | "TBD";
  updatedAt: string;
};

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
  gameType?: string;
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

type EspnScoreboardApiResponse = {
  events?: EspnScoreboardEvent[];
};

type EspnScoreboardEvent = {
  competitions?: EspnScoreboardCompetition[];
};

type EspnScoreboardCompetition = {
  competitors?: EspnScoreboardCompetitor[];
};

type EspnScoreboardCompetitor = {
  homeAway?: "home" | "away";
  team?: {
    abbreviation?: string;
  };
  probables?: EspnProbablePitcher[];
};

type EspnProbablePitcher = {
  name?: string;
  athlete?: {
    fullName?: string;
  };
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
    mlbDebutDate?: string;
    currentTeam?: {
      id?: number;
      name?: string;
    };
    primaryPosition?: {
      type?: string;
      abbreviation?: string;
    };
    pitchHand?: {
      code?: string;
    };
    rosterEntries?: MlbPersonRosterEntry[];
    transactions?: MlbPersonTransaction[];
  }>;
};

type MlbPersonRosterEntry = {
  status?: {
    code?: string;
    description?: string;
  };
  team?: {
    id?: number;
    abbreviation?: string;
  };
  isActive?: boolean;
  startDate?: string;
  endDate?: string;
  statusDate?: string;
};

type MlbPersonTransaction = {
  date?: string;
  effectiveDate?: string;
  typeCode?: string;
  typeDesc?: string;
  description?: string;
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
    gameType?: string;
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
    name?: string;
  };
  split?: {
    code?: string;
    description?: string;
  };
  stat?: {
    gamesPlayed?: number;
    runs?: number;
    strikeOuts?: number;
    baseOnBalls?: number;
    hits?: number;
    atBats?: number;
    plateAppearances?: number;
    totalBases?: number;
    ops?: string;
    obp?: string;
    slg?: string;
    avg?: string;
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
  gamesPlayed?: number;
  gamesStarted?: number;
  inningsPitched?: string;
  hits?: number;
  earnedRuns?: number;
  runs?: number;
  homeRuns?: number;
  baseOnBalls?: number;
  strikeOuts?: number;
  numberOfPitches?: number;
  pitchesThrown?: number;
  wins?: number;
  losses?: number;
  avg?: string;
};

export type MlbPitcherStartCompleteness = {
  pitcherMlbId: number;
  seasonAppearances: number | null;
  seasonStarts: number | null;
  careerStarts: number | null;
  recentAppearances: number;
  recentStarts: number;
  recentReliefAppearances: number;
  lastTwoAppearancesStarted: boolean;
  mlbDebutDate: string | null;
  providerMlbDebut: boolean;
  source: "live-people-stats";
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
    status?: {
      abstractGameState?: string;
      detailedState?: string;
    };
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
    linescore?: {
      currentInningOrdinal?: string;
      inningState?: string;
      outs?: number;
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
    promise.then((schedule) => {
      const cachedSchedule = scheduleCache.get(cacheKey);
      if (cachedSchedule?.promise !== promise) return;
      cachedSchedule.expiresAt = Date.now() + probableStarterRepollSeconds(schedule) * 1000;
    }).catch(() => {
      const cachedSchedule = scheduleCache.get(cacheKey);
      if (cachedSchedule?.promise === promise) cachedSchedule.expiresAt = Date.now() + LIVE_SCHEDULE_CACHE_TTL_MS;
    });
  }

  return promise;
}

export async function fetchMlbCompletedScheduleDates(startDate: string, endDate: string, options: MlbScheduleClientOptions = {}): Promise<string[]> {
  if (!options.fetchLive) return [];

  const params = new URLSearchParams({
    sportId: "1",
    gameTypes: "R",
    startDate,
    endDate,
  });

  try {
    const response = await fetch(`${MLB_STATS_API_BASE}/schedule?${params.toString()}`, cachedRequestInit(options, MLB_SCHEDULE_REVALIDATE_SECONDS));
    if (!response.ok) return [];

    const payload = (await response.json()) as MlbScheduleApiResponse;
    return (payload.dates ?? [])
      .filter((entry) => entry.date && (entry.games ?? []).some((game) => game.gameType === "R" && isFinalMlbApiGame(game)))
      .map((entry) => entry.date as string)
      .sort();
  } catch {
    return [];
  }
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
    const schedule = parseSchedulePayload(date, payload, "live");
    const reportedProbables = await fetchReportedProbablePitchers(date, schedule, options);
    const hydratedSchedule = mergeReportedProbablePitchers(schedule, reportedProbables);
    await logProbableConfidenceTransitions(hydratedSchedule);
    return hydratedSchedule;
  } catch {
    return getFixtureSchedule(date);
  }
}

function isFinalMlbApiGame(game: MlbApiGame) {
  return game.status?.abstractGameState === "Final" || game.status?.detailedState === "Final" || game.status?.detailedState === "Completed Early";
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
  const gamefeedRevalidateSeconds = options.gamefeedRevalidateSeconds ?? MLB_GAMEFEED_REVALIDATE_SECONDS;
  const cacheKey = `${gamePk}:completed-lines:${gamefeedRevalidateSeconds}`;
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

export async function fetchMlbLivePitchingLines(gamePk: number, options: MlbScheduleClientOptions = {}): Promise<MlbLivePitchingLine[]> {
  if (!options.fetchLive) return [];
  const gamefeedRevalidateSeconds = options.gamefeedRevalidateSeconds ?? MLB_GAMEFEED_REVALIDATE_SECONDS;
  const cacheKey = `${gamePk}:live-lines:${gamefeedRevalidateSeconds}`;
  const cached = livePitchingLineCache.get(cacheKey);
  if (!options.signal && cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = fetchLiveMlbPitchingLines(gamePk, options);
  if (!options.signal) {
    livePitchingLineCache.set(cacheKey, {
      expiresAt: Date.now() + LIVE_GAMEFEED_CACHE_TTL_MS,
      promise,
    });
  }

  return promise;
}

async function fetchLiveMlbCompletedPitchingLines(gamePk: number, options: MlbScheduleClientOptions = {}): Promise<MlbCompletedPitchingLine[]> {
  try {
    const response = await fetch(`${MLB_GAME_FEED_BASE}/${gamePk}/feed/live`, cachedRequestInit(options, options.gamefeedRevalidateSeconds ?? MLB_GAMEFEED_REVALIDATE_SECONDS));

    if (!response.ok) return [];

    const payload = (await response.json()) as MlbGameFeedResponse;
    return parseCompletedPitchingLines(gamePk, payload);
  } catch {
    return [];
  }
}

async function fetchLiveMlbPitchingLines(gamePk: number, options: MlbScheduleClientOptions = {}): Promise<MlbLivePitchingLine[]> {
  try {
    const response = await fetch(`${MLB_GAME_FEED_BASE}/${gamePk}/feed/live`, cachedRequestInit(options, options.gamefeedRevalidateSeconds ?? MLB_GAMEFEED_REVALIDATE_SECONDS));

    if (!response.ok) return [];

    const payload = (await response.json()) as MlbGameFeedResponse;
    return parseLivePitchingLines(gamePk, payload);
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

export async function fetchMlbTeamHandednessSplitContexts(season: string, options: MlbScheduleClientOptions = {}): Promise<Map<string, MlbTeamHandednessSplitContext>> {
  if (!options.fetchLive) return new Map();
  const cacheKey = `${season}:team-handedness-splits`;
  const cached = teamHandednessSplitCache.get(cacheKey);
  if (!options.signal && cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = fetchLiveMlbTeamHandednessSplitContexts(season, options);
  if (!options.signal) {
    teamHandednessSplitCache.set(cacheKey, {
      expiresAt: Date.now() + LIVE_CONTEXT_CACHE_TTL_MS,
      promise,
    });
  }

  return promise;
}

async function fetchLiveMlbTeamHandednessSplitContexts(season: string, options: MlbScheduleClientOptions = {}) {
  const splitParams = new URLSearchParams({
    season,
    group: "hitting",
    stats: "statSplits",
    sportIds: "1",
    sitCodes: "vr,vl",
  });
  const teamsParams = new URLSearchParams({ sportId: "1", season });

  try {
    const [splitResponse, teamsResponse] = await Promise.all([
      fetch(`${MLB_STATS_API_BASE}/teams/stats?${splitParams.toString()}`, cachedRequestInit(options, MLB_CONTEXT_REVALIDATE_SECONDS)),
      fetch(`${MLB_STATS_API_BASE}/teams?${teamsParams.toString()}`, cachedRequestInit(options, MLB_CONTEXT_REVALIDATE_SECONDS)),
    ]);
    if (!splitResponse.ok || !teamsResponse.ok) return new Map<string, MlbTeamHandednessSplitContext>();

    const [splitPayload, teamsPayload] = (await Promise.all([
      splitResponse.json(),
      teamsResponse.json(),
    ])) as [MlbTeamStatsApiResponse, MlbTeamsApiResponse];
    return parseTeamHandednessSplitContexts(splitPayload, parseTeamAbbreviationLookup(teamsPayload));
  } catch {
    return new Map<string, MlbTeamHandednessSplitContext>();
  }
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
      fetch(`${MLB_STATS_API_BASE}/people/${pitcherMlbId}`, cachedRequestInit(options, MLB_PLAYER_PROFILE_REVALIDATE_SECONDS)),
      fetch(`${MLB_STATS_API_BASE}/people/${pitcherMlbId}/stats?${seasonParams.toString()}`, cachedRequestInit(options, MLB_PLAYER_PROFILE_REVALIDATE_SECONDS)),
      fetch(`${MLB_STATS_API_BASE}/people/${pitcherMlbId}/stats?${gameLogParams.toString()}`, cachedRequestInit(options, MLB_PLAYER_PROFILE_REVALIDATE_SECONDS)),
      fetch(`${MLB_STATS_API_BASE}/teams?${teamsParams.toString()}`, cachedRequestInit(options, MLB_CONTEXT_REVALIDATE_SECONDS)),
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

export async function fetchMlbPitcherStartCompleteness(pitcherMlbIds: number[], season: string, asOfDate: string, options: MlbScheduleClientOptions = {}): Promise<Map<string, MlbPitcherStartCompleteness>> {
  if (!options.fetchLive) return new Map();
  const uniqueIds = Array.from(new Set(pitcherMlbIds.filter((id) => Number.isInteger(id) && id > 0)));
  if (uniqueIds.length === 0) return new Map();

  const entries = await Promise.all(uniqueIds.map((pitcherMlbId) => fetchSinglePitcherStartCompleteness(pitcherMlbId, season, asOfDate, options)));
  return new Map(entries.filter((entry): entry is MlbPitcherStartCompleteness => Boolean(entry)).map((entry) => [String(entry.pitcherMlbId), entry]));
}

async function fetchSinglePitcherStartCompleteness(pitcherMlbId: number, season: string, asOfDate: string, options: MlbScheduleClientOptions): Promise<MlbPitcherStartCompleteness | null> {
  const seasonParams = new URLSearchParams({ stats: "season", group: "pitching", season });
  const careerParams = new URLSearchParams({ stats: "career", group: "pitching" });
  const gameLogParams = new URLSearchParams({ stats: "gameLog", group: "pitching", season });

  try {
    const [personResponse, seasonResponse, careerResponse, gameLogResponse] = await Promise.all([
      fetch(`${MLB_STATS_API_BASE}/people/${pitcherMlbId}`, cachedRequestInit(options, MLB_PLAYER_PROFILE_REVALIDATE_SECONDS)),
      fetch(`${MLB_STATS_API_BASE}/people/${pitcherMlbId}/stats?${seasonParams.toString()}`, cachedRequestInit(options, MLB_PLAYER_PROFILE_REVALIDATE_SECONDS)),
      fetch(`${MLB_STATS_API_BASE}/people/${pitcherMlbId}/stats?${careerParams.toString()}`, cachedRequestInit(options, MLB_PLAYER_PROFILE_REVALIDATE_SECONDS)),
      fetch(`${MLB_STATS_API_BASE}/people/${pitcherMlbId}/stats?${gameLogParams.toString()}`, cachedRequestInit(options, MLB_PLAYER_PROFILE_REVALIDATE_SECONDS)),
    ]);

    if (!personResponse.ok || !seasonResponse.ok || !careerResponse.ok || !gameLogResponse.ok) return null;

    const [personPayload, seasonPayload, careerPayload, gameLogPayload] = (await Promise.all([
      personResponse.json(),
      seasonResponse.json(),
      careerResponse.json(),
      gameLogResponse.json(),
    ])) as [MlbPeopleApiResponse, MlbPersonStatsApiResponse, MlbPersonStatsApiResponse, MlbPersonStatsApiResponse];
    const person = personPayload.people?.[0];
    const seasonAppearances = readPitchingGamesPlayed(seasonPayload);
    const seasonStarts = readPitchingGamesStarted(seasonPayload);
    const careerStarts = readPitchingGamesStarted(careerPayload);
    const recentUsage = readRecentPitchingUsage(gameLogPayload, asOfDate);
    const mlbDebutDate = person?.mlbDebutDate ?? null;
    const providerMlbDebut = Boolean(mlbDebutDate && mlbDebutDate === asOfDate);

    return {
      pitcherMlbId,
      seasonAppearances,
      seasonStarts,
      careerStarts,
      recentAppearances: recentUsage.appearances,
      recentStarts: recentUsage.starts,
      recentReliefAppearances: recentUsage.reliefAppearances,
      lastTwoAppearancesStarted: recentUsage.lastTwoAppearancesStarted,
      mlbDebutDate,
      providerMlbDebut,
      source: "live-people-stats",
    };
  } catch {
    return null;
  }
}

function readPitchingGamesPlayed(payload: MlbPersonStatsApiResponse) {
  const value = payload.stats?.[0]?.splits?.[0]?.stat?.gamesPlayed;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readPitchingGamesStarted(payload: MlbPersonStatsApiResponse) {
  const value = payload.stats?.[0]?.splits?.[0]?.stat?.gamesStarted;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readRecentPitchingUsage(payload: MlbPersonStatsApiResponse, asOfDate: string) {
  const endMs = new Date(`${asOfDate}T00:00:00.000Z`).getTime();
  const startMs = endMs - 30 * 24 * 60 * 60 * 1000;
  const splits = payload.stats?.[0]?.splits ?? [];
  const recentSplits = splits.filter((split) => {
    if (!split.date) return false;
    const dateMs = new Date(`${split.date}T00:00:00.000Z`).getTime();
    return Number.isFinite(dateMs) && dateMs >= startMs && dateMs < endMs;
  });
  const starts = recentSplits.filter((split) => split.stat?.gamesStarted === 1).length;
  const latestAppearances = [...recentSplits]
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .slice(0, 2);

  return {
    appearances: recentSplits.length,
    starts,
    reliefAppearances: Math.max(0, recentSplits.length - starts),
    lastTwoAppearancesStarted: latestAppearances.length === 2 && latestAppearances.every((split) => split.stat?.gamesStarted === 1),
  };
}

export async function fetchMlbPitcherAvailabilityStatuses(pitcherMlbIds: number[], options: MlbScheduleClientOptions = {}): Promise<Map<string, PitcherAvailability>> {
  if (!options.fetchLive) return new Map();
  const uniqueIds = Array.from(new Set(pitcherMlbIds.filter((id) => Number.isInteger(id) && id > 0)));
  if (uniqueIds.length === 0) return new Map();

  const params = new URLSearchParams({
    personIds: uniqueIds.join(","),
    hydrate: "currentTeam,rosterEntries,transactions",
  });

  try {
    const response = await fetch(`${MLB_STATS_API_BASE}/people?${params.toString()}`, cachedRequestInit(options, MLB_PLAYER_PROFILE_REVALIDATE_SECONDS));
    if (!response.ok) return new Map();

    const payload = (await response.json()) as MlbPeopleApiResponse;
    return parsePitcherAvailabilityStatuses(payload);
  } catch {
    return new Map();
  }
}

export async function fetchMlbPitcherSplits(pitcherMlbId: number, season: string, options: MlbScheduleClientOptions = {}): Promise<MlbPitcherSplitGroup[] | null> {
  if (!options.fetchLive) return null;

  const batterHandParams = new URLSearchParams({ stats: "statSplits", group: "pitching", season, sitCodes: "vl,vr" });
  const venueParams = new URLSearchParams({ stats: "statSplits", group: "pitching", season, sitCodes: "h,a" });

  try {
    const [batterHandResponse, venueResponse] = await Promise.all([
      fetch(`${MLB_STATS_API_BASE}/people/${pitcherMlbId}/stats?${batterHandParams.toString()}`, cachedRequestInit(options, MLB_PLAYER_PROFILE_REVALIDATE_SECONDS)),
      fetch(`${MLB_STATS_API_BASE}/people/${pitcherMlbId}/stats?${venueParams.toString()}`, cachedRequestInit(options, MLB_PLAYER_PROFILE_REVALIDATE_SECONDS)),
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

function parsePitcherAvailabilityStatuses(payload: MlbPeopleApiResponse) {
  const statuses = new Map<string, PitcherAvailability>();

  for (const person of payload.people ?? []) {
    const id = person.id;
    if (!id) continue;

    const currentTeamId = person.currentTeam?.id;
    const rosterEntry = readCurrentRosterEntry(person.rosterEntries ?? [], currentTeamId);
    const statusCode = rosterEntry?.status?.code;
    const statusDescription = rosterEntry?.status?.description;
    if (!statusCode || !statusDescription || !isInjuredListStatus(statusCode, statusDescription)) continue;

    const transaction = readLatestInjuredListTransaction(person.transactions ?? [], rosterEntry?.statusDate);
    const statusDate = rosterEntry?.statusDate ?? transaction?.effectiveDate ?? transaction?.date ?? null;
    const label = availabilityLabel(statusCode, statusDescription);
    const reason = transaction?.description ? injuryReasonFromTransaction(transaction.description) : null;
    const dateLabel = statusDate ? ` since ${formatMonthDay(statusDate)}` : "";
    const blurb = `${label}${dateLabel}${reason ? `: ${reason}` : ""}.`;

    statuses.set(String(id), {
      status: "injured-list",
      code: statusCode,
      label,
      statusDate,
      blurb,
      transactionDescription: transaction?.description ?? null,
      source: "mlb-roster-entries",
    });
  }

  return statuses;
}

function readCurrentRosterEntry(entries: MlbPersonRosterEntry[], currentTeamId: number | undefined) {
  return entries.find((entry) => entry.isActive && (!currentTeamId || entry.team?.id === currentTeamId))
    ?? entries.find((entry) => entry.isActive)
    ?? entries.find((entry) => !entry.endDate)
    ?? entries[0];
}

function isInjuredListStatus(code: string, description: string) {
  const normalizedCode = code.trim().toUpperCase();
  const normalizedDescription = description.trim().toLowerCase();
  return /^D\d+$/.test(normalizedCode) || normalizedDescription.includes("injured");
}

function readLatestInjuredListTransaction(transactions: MlbPersonTransaction[], statusDate: string | undefined) {
  const injuredTransactions = transactions
    .filter((transaction) => transaction.description && /\bplaced\b/i.test(transaction.description) && /\binjured list\b/i.test(transaction.description))
    .sort((a, b) => (b.effectiveDate ?? b.date ?? "").localeCompare(a.effectiveDate ?? a.date ?? ""));

  if (!statusDate) return injuredTransactions[0] ?? null;
  return injuredTransactions.find((transaction) => (transaction.effectiveDate ?? transaction.date) === statusDate)
    ?? injuredTransactions.find((transaction) => transaction.date === statusDate)
    ?? injuredTransactions[0]
    ?? null;
}

function availabilityLabel(code: string, description: string) {
  const normalized = `${code} ${description}`.toLowerCase();
  if (normalized.includes("60")) return "60-day IL";
  if (normalized.includes("15")) return "15-day IL";
  if (normalized.includes("10")) return "10-day IL";
  if (normalized.includes("7")) return "7-day IL";
  return "IL";
}

function injuryReasonFromTransaction(description: string) {
  const parts = description.split(".").map((part) => part.trim()).filter(Boolean);
  const reason = parts.at(-1);
  if (!reason || /\binjured list\b/i.test(reason) || /\bdisabled list\b/i.test(reason)) return null;
  return reason.charAt(0).toUpperCase() + reason.slice(1);
}

function formatMonthDay(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(parsed);
}

function parseSchedulePayload(date: string, payload: MlbScheduleApiResponse, source: MlbSchedule["source"]): MlbSchedule {
  const scheduleDate = payload.dates?.find((entry) => entry.date === date) ?? payload.dates?.[0];

  return {
    date: scheduleDate?.date ?? date,
    source,
    games: scheduleDate?.games?.flatMap(parseGame).filter((game): game is MlbScheduleGame => Boolean(game)) ?? [],
  };
}

async function fetchReportedProbablePitchers(date: string, schedule: MlbSchedule, options: MlbScheduleClientOptions = {}): Promise<Map<string, MlbProbablePitcher>> {
  if (schedule.games.length === 0) return new Map();

  const params = new URLSearchParams({
    dates: date.replaceAll("-", ""),
  });

  try {
    const response = await fetch(`${ESPN_MLB_SCOREBOARD_API}?${params.toString()}`, cachedRequestInit(options, probableStarterRepollSeconds(schedule)));
    if (!response.ok) return new Map();

    const payload = (await response.json()) as EspnScoreboardApiResponse;
    const reported = new Map<string, MlbProbablePitcher>();
    const missingKeys = new Set(schedule.games.flatMap((game) => [
      game.probableAwayPitcher ? null : reportedProbableKey(game.awayTeam.abbreviation, game.homeTeam.abbreviation, "away"),
      game.probableHomePitcher ? null : reportedProbableKey(game.awayTeam.abbreviation, game.homeTeam.abbreviation, "home"),
    ]).filter((key): key is string => Boolean(key)));
    if (missingKeys.size === 0) return reported;

    for (const event of payload.events ?? []) {
      for (const competition of event.competitions ?? []) {
        const competitors = competition.competitors ?? [];
        const home = competitors.find((competitor) => competitor.homeAway === "home");
        const away = competitors.find((competitor) => competitor.homeAway === "away");
        const homeAbbreviation = home?.team?.abbreviation;
        const awayAbbreviation = away?.team?.abbreviation;
        if (!homeAbbreviation || !awayAbbreviation) continue;

        for (const competitor of competitors) {
          const side = competitor.homeAway;
          const teamAbbreviation = competitor.team?.abbreviation;
          const probable = competitor.probables?.find((candidate) => candidate.name === "probableStartingPitcher");
          const fullName = probable?.athlete?.fullName;
          if ((side !== "home" && side !== "away") || !teamAbbreviation || !fullName) continue;

          const key = reportedProbableKey(awayAbbreviation, homeAbbreviation, side);
          if (!missingKeys.has(key)) continue;

          const id = await resolveReportedPitcherMlbId(fullName, options);
          if (!id) continue;

          const opponentAbbreviation = side === "home" ? awayAbbreviation : homeAbbreviation;
          reported.set(key, {
            id,
            fullName,
            teamAbbreviation,
            opponentAbbreviation,
            side,
            source: "secondary-feed",
            confidence: "REPORTED",
          });
        }
      }
    }

    return reported;
  } catch {
    return new Map();
  }
}

export function probableStarterRepollSeconds(schedule: Pick<MlbSchedule, "games">, now = new Date()) {
  const upcomingFirstPitchMs = schedule.games
    .map((game) => new Date(game.gameDate).getTime())
    .filter((time) => Number.isFinite(time) && time >= now.getTime())
    .sort((a, b) => a - b)[0];

  if (!upcomingFirstPitchMs) return PROBABLES_REPOLL_URGENT_SECONDS;

  const remainingMs = upcomingFirstPitchMs - now.getTime();
  if (remainingMs <= PROBABLES_URGENT_FIRST_PITCH_MS) return PROBABLES_REPOLL_URGENT_SECONDS;
  if (remainingMs <= PROBABLES_NEAR_FIRST_PITCH_MS) return PROBABLES_REPOLL_NEAR_SECONDS;
  return PROBABLES_REPOLL_FAR_SECONDS;
}

async function resolveReportedPitcherMlbId(fullName: string, options: MlbScheduleClientOptions = {}): Promise<number | null> {
  const cacheKey = normalizePlayerName(fullName);
  const cached = resolvedReportedPitcherCache.get(cacheKey);
  if (!options.signal && cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = fetchReportedPitcherMlbId(fullName, options);
  if (!options.signal) {
    resolvedReportedPitcherCache.set(cacheKey, {
      expiresAt: Date.now() + MLB_PLAYER_PROFILE_REVALIDATE_SECONDS * 1000,
      promise,
    });
  }

  return promise;
}

async function fetchReportedPitcherMlbId(fullName: string, options: MlbScheduleClientOptions = {}): Promise<number | null> {
  const params = new URLSearchParams({
    names: fullName,
  });

  try {
    const response = await fetch(`${MLB_STATS_API_BASE}/people/search?${params.toString()}`, cachedRequestInit(options, MLB_PLAYER_PROFILE_REVALIDATE_SECONDS));
    if (!response.ok) return null;

    const payload = (await response.json()) as MlbPeopleApiResponse;
    const normalized = normalizePlayerName(fullName);
    const match = (payload.people ?? []).find((person) => person.id && normalizePlayerName(person.fullName ?? "") === normalized && isPitcherPerson(person));
    return match?.id ?? null;
  } catch {
    return null;
  }
}

function mergeReportedProbablePitchers(schedule: MlbSchedule, reported: Map<string, MlbProbablePitcher>): MlbSchedule {
  if (reported.size === 0) return schedule;

  return {
    ...schedule,
    games: schedule.games.map((game) => ({
      ...game,
      probableAwayPitcher: game.probableAwayPitcher ?? reported.get(reportedProbableKey(game.awayTeam.abbreviation, game.homeTeam.abbreviation, "away")),
      probableHomePitcher: game.probableHomePitcher ?? reported.get(reportedProbableKey(game.awayTeam.abbreviation, game.homeTeam.abbreviation, "home")),
    })),
  };
}

async function logProbableConfidenceTransitions(schedule: MlbSchedule) {
  if (process.env.NEXT_PHASE === NEXT_PRODUCTION_BUILD_PHASE) return;

  for (const game of schedule.games) {
    if (isBeyondProbableConfidenceTransitionHorizon(game.gameDate)) continue;
    const slots = [
      { side: "away" as const, team: game.awayTeam.abbreviation, opponent: game.homeTeam.abbreviation, probable: game.probableAwayPitcher },
      { side: "home" as const, team: game.homeTeam.abbreviation, opponent: game.awayTeam.abbreviation, probable: game.probableHomePitcher },
    ];

    for (const slot of slots) {
      const key = reportedProbableKey(game.awayTeam.abbreviation, game.homeTeam.abbreviation, slot.side);
      const nextConfidence = slot.probable?.confidence ?? "TBD";
      const stateKey = probableConfidenceStateKey(game.gamePk, slot.side);
      const previousConfidence = probableConfidenceBySlot.get(key) ?? (await readProbableConfidenceState(stateKey))?.confidence;
      probableConfidenceBySlot.set(key, nextConfidence);
      await writeProbableConfidenceState(stateKey, nextConfidence);

      if (!previousConfidence || previousConfidence === nextConfidence) continue;

      console.info("probable starter confidence transition", {
        date: schedule.date,
        gamePk: game.gamePk,
        side: slot.side,
        team: slot.team,
        opponent: slot.opponent,
        from: previousConfidence,
        to: nextConfidence,
        pitcherId: slot.probable?.id ?? null,
        pitcherName: slot.probable?.fullName ?? null,
        source: slot.probable?.source ?? "none",
      });
    }
  }
}

function reportedProbableKey(awayAbbreviation: string, homeAbbreviation: string, side: "home" | "away") {
  return `${awayAbbreviation}:${homeAbbreviation}:${side}`;
}

function probableConfidenceStateKey(gamePk: number, side: "home" | "away") {
  return `probable-confidence:${gamePk}:${side}`;
}

async function readProbableConfidenceState(key: string) {
  return readRuntimeState<ProbableConfidenceState>(key);
}

async function writeProbableConfidenceState(key: string, confidence: ProbableConfidenceState["confidence"]) {
  await writeRuntimeState(key, {
    confidence,
    updatedAt: new Date().toISOString(),
  });
}

function isBeyondProbableConfidenceTransitionHorizon(gameDate: string) {
  const gameMs = new Date(gameDate).getTime();
  if (!Number.isFinite(gameMs)) return false;
  return gameMs - Date.now() > PROBABLE_CONFIDENCE_TRANSITION_HORIZON_DAYS * 86_400_000;
}

function normalizePlayerName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function isPitcherPerson(person: NonNullable<MlbPeopleApiResponse["people"]>[number]) {
  return person.primaryPosition?.type === "Pitcher" || person.primaryPosition?.abbreviation === "P";
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

function parseTeamHandednessSplitContexts(payload: MlbTeamStatsApiResponse, teamLookup: Map<number, string>) {
  const rawContexts: Array<Omit<MlbTeamHandednessSplitContext, "opsRank" | "strikeoutRateRank" | "matchupRunValue" | "label">> = [];

  for (const statGroup of payload.stats ?? []) {
    for (const split of statGroup.splits ?? []) {
      const teamId = split.team?.id;
      const team = teamId ? teamLookup.get(teamId) : undefined;
      const splitKey = split.split?.code === "vl" ? "vs-lhp" : split.split?.code === "vr" ? "vs-rhp" : undefined;
      const stat = split.stat;
      const plateAppearances = stat?.plateAppearances ?? 0;
      const ops = Number(stat?.ops);
      const obp = Number(stat?.obp);
      const slg = Number(stat?.slg);
      const avg = Number(stat?.avg);
      if (!teamId || !team || !splitKey || !stat || plateAppearances <= 0 || !Number.isFinite(ops) || !Number.isFinite(obp) || !Number.isFinite(slg) || !Number.isFinite(avg)) continue;

      rawContexts.push({
        team,
        teamId,
        split: splitKey,
        gamesPlayed: stat.gamesPlayed ?? 0,
        plateAppearances,
        ops,
        obp,
        slg,
        iso: Number((slg - avg).toFixed(3)),
        strikeoutRate: Number(((stat.strikeOuts ?? 0) / plateAppearances).toFixed(3)),
        walkRate: Number(((stat.baseOnBalls ?? 0) / plateAppearances).toFixed(3)),
      });
    }
  }

  const bySplit = new Map<MlbTeamHandednessSplitContext["split"], typeof rawContexts>();
  for (const context of rawContexts) {
    const values = bySplit.get(context.split) ?? [];
    values.push(context);
    bySplit.set(context.split, values);
  }

  const contexts = new Map<string, MlbTeamHandednessSplitContext>();
  for (const [split, splitContexts] of bySplit) {
    const opsRank = rankValues(splitContexts, (context) => context.ops, "desc");
    const strikeoutRank = rankValues(splitContexts, (context) => context.strikeoutRate, "desc");
    const averageOps = average(splitContexts.map((context) => context.ops));
    const averageStrikeoutRate = average(splitContexts.map((context) => context.strikeoutRate));
    const averageIso = average(splitContexts.map((context) => context.iso));

    for (const context of splitContexts) {
      const matchupRunValue = clamp((context.ops - averageOps) * 45 + (context.iso - averageIso) * 18 - (context.strikeoutRate - averageStrikeoutRate) * 24, -8, 8);
      const fullContext: MlbTeamHandednessSplitContext = {
        ...context,
        opsRank: opsRank.get(context.team) ?? 30,
        strikeoutRateRank: strikeoutRank.get(context.team) ?? 30,
        matchupRunValue: Number(matchupRunValue.toFixed(1)),
        label: `${context.team} ${split === "vs-lhp" ? "vs LHP" : "vs RHP"}: ${context.ops.toFixed(3)} OPS, ${(context.strikeoutRate * 100).toFixed(1)}% K, ${(context.walkRate * 100).toFixed(1)}% BB, ${context.iso.toFixed(3)} ISO.`,
      };
      contexts.set(teamSplitKey(fullContext.team, split), fullContext);
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
    .filter((split) => isRegularSeasonStatSplit(split, seasonSplit?.season ?? `${new Date().getUTCFullYear()}`))
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

function teamSplitKey(team: string, split: MlbTeamHandednessSplitContext["split"]) {
  return `${team}:${split}`;
}

function rankValues<T extends { team: string }>(values: T[], readValue: (value: T) => number, direction: "asc" | "desc") {
  return new Map(
    [...values]
      .sort((a, b) => direction === "desc" ? readValue(b) - readValue(a) : readValue(a) - readValue(b))
      .map((value, index) => [value.team, index + 1]),
  );
}

function average(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
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

function isRegularSeasonStatSplit(split: MlbPersonStatSplit, season: string) {
  if (split.game?.gameType) return split.game.gameType === "R";
  return Boolean(split.date && split.date >= `${season}-03-25`);
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
  const isFinal = isFinalGameFeedState(payload);

  return [
    ...parseTeamPitchingLines(gamePk, "away", awayTeam, awayAbbreviation, homeAbbreviation, payload, isFinal),
    ...parseTeamPitchingLines(gamePk, "home", homeTeam, homeAbbreviation, awayAbbreviation, payload, isFinal),
  ];
}

function parseLivePitchingLines(gamePk: number, payload: MlbGameFeedResponse): MlbLivePitchingLine[] {
  const awayTeam = payload.liveData?.boxscore?.teams?.away;
  const homeTeam = payload.liveData?.boxscore?.teams?.home;
  const awayAbbreviation = awayTeam?.team?.abbreviation ?? payload.gameData?.teams?.away?.abbreviation;
  const homeAbbreviation = homeTeam?.team?.abbreviation ?? payload.gameData?.teams?.home?.abbreviation;
  const isFinal = isFinalGameFeedState(payload);
  const inningLabel = readInningLabel(payload);

  return [
    ...parseTeamLivePitchingLines(gamePk, "away", awayTeam, awayAbbreviation, homeAbbreviation, payload, isFinal, inningLabel),
    ...parseTeamLivePitchingLines(gamePk, "home", homeTeam, homeAbbreviation, awayAbbreviation, payload, isFinal, inningLabel),
  ];
}

function parseTeamLivePitchingLines(
  gamePk: number,
  side: "home" | "away",
  team: MlbGameFeedTeam | undefined,
  teamAbbreviation: string | undefined,
  opponentAbbreviation: string | undefined,
  payload: MlbGameFeedResponse,
  isFinal: boolean,
  inningLabel: string | null,
): MlbLivePitchingLine[] {
  if (!team?.players || !teamAbbreviation || !opponentAbbreviation) return [];

  const starterMlbId = team.pitchers?.[0];
  const starterIsOut = isFinal || (team.pitchers?.length ?? 0) > 1;

  return Object.values(team.players)
    .map((player) => readLivePitchingLine(gamePk, side, teamAbbreviation, opponentAbbreviation, player, payload, starterMlbId, starterIsOut, inningLabel))
    .filter((line): line is MlbLivePitchingLine => Boolean(line));
}

function parseTeamPitchingLines(
  gamePk: number,
  side: "home" | "away",
  team: MlbGameFeedTeam | undefined,
  teamAbbreviation: string | undefined,
  opponentAbbreviation: string | undefined,
  payload: MlbGameFeedResponse,
  isFinal: boolean,
): MlbCompletedPitchingLine[] {
  if (!team?.players || !teamAbbreviation || !opponentAbbreviation) return [];

  const starterMlbId = team.pitchers?.[0];
  const starterIsOut = isFinal || (team.pitchers?.length ?? 0) > 1;

  return Object.values(team.players)
    .map((player) => readCompletedPitchingLine(gamePk, side, teamAbbreviation, opponentAbbreviation, player, payload, starterMlbId, starterIsOut))
    .filter((line): line is MlbCompletedPitchingLine => Boolean(line));
}

function readLivePitchingLine(
  gamePk: number,
  side: "home" | "away",
  teamAbbreviation: string,
  opponentAbbreviation: string,
  player: MlbGameFeedPlayer,
  payload: MlbGameFeedResponse,
  starterMlbId: number | undefined,
  starterIsOut: boolean,
  inningLabel: string | null,
): MlbLivePitchingLine | undefined {
  const pitcherMlbId = player.person?.id;
  const stats = player.stats?.pitching;
  if (!pitcherMlbId || !stats || stats.gamesStarted !== 1) return undefined;
  if (pitcherMlbId !== starterMlbId) return undefined;

  const line = readStartLine(stats);
  const status = readLiveLineStatus(payload, starterIsOut, line);
  return {
    gamePk,
    pitcherMlbId,
    pitcherName: player.person?.fullName,
    teamAbbreviation,
    opponentAbbreviation,
    side,
    result: readPitchingDecision(pitcherMlbId, payload),
    line: line ?? { inningsPitched: 0, hits: 0, earnedRuns: 0, walks: 0, strikeouts: 0, pitches: 0 },
    gameStatus: status,
    starterIsOut,
    inningLabel,
  };
}

function readCompletedPitchingLine(
  gamePk: number,
  side: "home" | "away",
  teamAbbreviation: string,
  opponentAbbreviation: string,
  player: MlbGameFeedPlayer,
  payload: MlbGameFeedResponse,
  starterMlbId: number | undefined,
  starterIsOut: boolean,
): MlbCompletedPitchingLine | undefined {
  const pitcherMlbId = player.person?.id;
  const stats = player.stats?.pitching;
  if (!pitcherMlbId || !stats || stats.gamesStarted !== 1) return undefined;
  if (pitcherMlbId !== starterMlbId || !starterIsOut) return undefined;

  const line = readStartLine(stats);
  if (!line) return undefined;

  return {
    gamePk,
    pitcherMlbId,
    pitcherName: player.person?.fullName,
    teamAbbreviation,
    opponentAbbreviation,
    side,
    gameStatus: "final",
    result: readPitchingDecision(pitcherMlbId, payload),
    line,
  };
}

function readLiveLineStatus(payload: MlbGameFeedResponse, starterIsOut: boolean, line: StartLine | undefined): MlbLivePitchingLine["gameStatus"] {
  const status = `${payload.gameData?.status?.abstractGameState ?? ""} ${payload.gameData?.status?.detailedState ?? ""}`.toLowerCase();
  if (/\b(delayed|suspended)\b/.test(status)) return "delay";
  if (starterIsOut || isFinalGameFeedState(payload)) return "final";
  if (line && (line.pitches > 0 || line.inningsPitched > 0)) return "live";
  return "warming";
}

function readInningLabel(payload: MlbGameFeedResponse) {
  const linescore = payload.liveData?.linescore;
  const inning = linescore?.currentInningOrdinal;
  const state = linescore?.inningState;
  if (!inning && !state) return null;
  const outs = typeof linescore?.outs === "number" ? `, ${linescore.outs} out${linescore.outs === 1 ? "" : "s"}` : "";
  return `${state ? `${state} ` : ""}${inning ?? ""}${outs}`.trim();
}

function isFinalGameFeedState(payload: MlbGameFeedResponse) {
  const status = `${payload.gameData?.status?.abstractGameState ?? ""} ${payload.gameData?.status?.detailedState ?? ""}`.toLowerCase();
  return /\b(final|game over|completed early)\b/.test(status);
}

function readStartLine(stats: MlbGameFeedPitchingStats): StartLine | undefined {
  const inningsPitched = Number(stats.inningsPitched);
  if (!Number.isFinite(inningsPitched)) return undefined;

  return {
    inningsPitched,
    hits: stats.hits ?? 0,
    earnedRuns: stats.earnedRuns ?? 0,
    ...(typeof stats.runs === "number" ? { runsAllowed: stats.runs } : {}),
    ...(typeof stats.homeRuns === "number" ? { homeRunsAllowed: stats.homeRuns } : {}),
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
  const gameType = game.gameType;
  const homeTeam = game.teams?.home?.team;
  const awayTeam = game.teams?.away?.team;

  if (gameType !== "R") return [];
  if (!gamePk || !gameDate || !homeTeam?.name || !awayTeam?.name) return [];

  const homeAbbreviation = homeTeam.abbreviation ?? homeTeam.name;
  const awayAbbreviation = awayTeam.abbreviation ?? awayTeam.name;
  const baseGame = {
    gamePk,
    gameDate,
    gameType,
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
    source: "mlb-stats-api",
    confidence: "CONFIRMED",
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
        source: "mlb-stats-api",
        confidence: "CONFIRMED",
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
