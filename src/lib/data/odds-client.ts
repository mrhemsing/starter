import type { MlbScheduleGame } from "@/lib/types";

export type OddsProviderSource = "the-odds-api" | "prop-line";

type OddsOutcome = {
  name?: string;
  description?: string;
  point?: number;
};

type OddsMarket = {
  key?: string;
  outcomes?: OddsOutcome[];
};

type OddsBookmaker = {
  markets?: OddsMarket[];
};

type OddsEvent = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: OddsBookmaker[];
};

export type MlbOddsGameMarketContext = {
  source: OddsProviderSource;
  eventId: string;
  gameTotal: number | null;
  teamTotals: Map<string, number>;
  pitcherStrikeouts: Map<string, number>;
  capturedAt?: string;
};

export type MlbOddsFetchDiagnostics = {
  contexts: Map<string, MlbOddsGameMarketContext>;
  capturedAt: string;
  requestedGames: number;
  eventsSeen: number;
  matchedGames: number;
  marketFetches: number;
  error: string | null;
  credits: {
    used: string | null;
    remaining: string | null;
  };
  provider: OddsProviderSource | "none";
};

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const PROPLINE_API_BASE = "https://api.prop-line.com/v1";
const ODDS_REGION = process.env.THE_BUMP_ODDS_REGION ?? "us";
const ODDS_BOOKMAKERS = process.env.THE_BUMP_ODDS_BOOKMAKERS;
const ODDS_CACHE_TTL_MS = envPositiveInt("THE_BUMP_ODDS_CACHE_MINUTES", 30) * 60 * 1000;
const ODDS_REVALIDATE_SECONDS = Math.max(60, Math.floor(ODDS_CACHE_TTL_MS / 1000));
const ODDS_MAX_DAYS_AHEAD = envPositiveInt("THE_BUMP_ODDS_MAX_DAYS_AHEAD", 1);
const ODDS_MARKETS = process.env.THE_BUMP_ODDS_INCLUDE_TOTALS === "1" ? "pitcher_strikeouts,team_totals,totals" : "pitcher_strikeouts";

type CachedOddsContext = {
  expiresAt: number;
  promise: Promise<MlbOddsFetchDiagnostics>;
};

const oddsCache = new Map<string, CachedOddsContext>();

export async function fetchMlbOddsMarketContexts(games: MlbScheduleGame[]): Promise<Map<string, MlbOddsGameMarketContext>> {
  return (await fetchMlbOddsMarketContextsWithDiagnostics(games)).contexts;
}

export async function fetchMlbOddsMarketContextsWithDiagnostics(games: MlbScheduleGame[]): Promise<MlbOddsFetchDiagnostics> {
  const capturedAt = new Date().toISOString();
  const provider = oddsProviderConfig();
  if (!provider || games.length === 0) return emptyDiagnostics(capturedAt);

  const dateKey = games[0]?.gameDate.slice(0, 10) ?? "unknown";
  if (!isOddsEligibleDate(dateKey)) return emptyDiagnostics(capturedAt);

  const cacheKey = `${provider.source}:${dateKey}:${games.map((game) => game.gamePk).join(",")}:${ODDS_REGION}:${ODDS_BOOKMAKERS ?? "all"}`;
  const cached = oddsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    const cachedDiagnostics = await cached.promise;
    return { ...cachedDiagnostics, capturedAt, credits: { used: null, remaining: null } };
  }

  const diagnosticPromise = buildMlbOddsMarketContexts(games, provider, capturedAt).catch((error) => {
    console.warn("odds market fetch failed", error);
    return emptyDiagnostics(capturedAt, games.length, error instanceof Error ? error.message : String(error));
  });
  void diagnosticPromise.then((result) => {
    if (result.error || result.contexts.size === 0) oddsCache.delete(cacheKey);
  });
  oddsCache.set(cacheKey, {
    expiresAt: Date.now() + ODDS_CACHE_TTL_MS,
    promise: diagnosticPromise,
  });
  return diagnosticPromise;
}

async function buildMlbOddsMarketContexts(games: MlbScheduleGame[], provider: OddsProviderConfig, capturedAt: string): Promise<MlbOddsFetchDiagnostics> {
  const credits = { used: null as string | null, remaining: null as string | null };
  const eventsResult = await fetchOddsEvents(provider);
  mergeCredits(credits, eventsResult.credits);
  const events = eventsResult.events;
  const eventByGamePk = new Map<string, OddsEvent>();
  for (const game of games) {
    const event = events.find((candidate) => isMatchingEvent(game, candidate));
    if (event) eventByGamePk.set(String(game.gamePk), event);
  }

  const entries = await Promise.all(
    [...eventByGamePk.entries()].map(async ([gamePk, event]) => {
      const detail = await fetchEventMarkets(provider, event.id);
      if (detail) mergeCredits(credits, detail.credits);
      return [gamePk, { ...summarizeEventMarkets(detail?.event ?? event, provider.source), capturedAt }] as const;
    }),
  );

  return {
    contexts: new Map(entries),
    capturedAt,
    requestedGames: games.length,
    eventsSeen: events.length,
    matchedGames: eventByGamePk.size,
    marketFetches: entries.length,
    error: null,
    credits,
    provider: provider.source,
  };
}

type OddsProviderConfig = {
  source: OddsProviderSource;
  apiKey: string;
};

function oddsProviderConfig(): OddsProviderConfig | null {
  const requested = (process.env.THE_BUMP_ODDS_PROVIDER ?? "auto").trim().toLowerCase();
  const propLineKey = process.env.THE_BUMP_PROPLINE_API_KEY;
  const oddsApiKey = process.env.THE_BUMP_ODDS_API_KEY;

  if ((requested === "prop-line" || requested === "propline") && propLineKey) return { source: "prop-line", apiKey: propLineKey };
  if (requested === "the-odds-api" && oddsApiKey) return { source: "the-odds-api", apiKey: oddsApiKey };
  if (requested === "auto" && propLineKey) return { source: "prop-line", apiKey: propLineKey };
  if ((requested === "auto" || requested === "the-odds-api") && oddsApiKey) return { source: "the-odds-api", apiKey: oddsApiKey };
  return null;
}

export function isOddsProviderConfigured() {
  return oddsProviderConfig() !== null;
}

export function configuredOddsProviderSource(): OddsProviderSource | null {
  return oddsProviderConfig()?.source ?? null;
}

async function fetchOddsEvents(provider: OddsProviderConfig): Promise<{ events: OddsEvent[]; credits: MlbOddsFetchDiagnostics["credits"] }> {
  const response = await fetch(oddsEventsUrl(provider), {
    next: { revalidate: ODDS_REVALIDATE_SECONDS },
  });
  if (!response.ok) throw new Error(`${oddsProviderLabel(provider.source)} events returned ${response.status}`);
  return {
    events: await response.json() as OddsEvent[],
    credits: oddsCredits(response),
  };
}

async function fetchEventMarkets(provider: OddsProviderConfig, eventId: string): Promise<{ event: OddsEvent; credits: MlbOddsFetchDiagnostics["credits"] } | null> {
  const response = await fetch(eventMarketsUrl(provider, eventId), {
    next: { revalidate: ODDS_REVALIDATE_SECONDS },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${oddsProviderLabel(provider.source)} event ${eventId} returned ${response.status}`);
  return {
    event: await response.json() as OddsEvent,
    credits: oddsCredits(response),
  };
}

function oddsEventsUrl(provider: OddsProviderConfig) {
  if (provider.source === "prop-line") {
    const params = propLineParams(provider.apiKey);
    return `${PROPLINE_API_BASE}/sports/baseball_mlb/events?${params.toString()}`;
  }
  const params = oddsParams(provider.apiKey, "h2h");
  return `${ODDS_API_BASE}/sports/baseball_mlb/odds?${params.toString()}`;
}

function eventMarketsUrl(provider: OddsProviderConfig, eventId: string) {
  if (provider.source === "prop-line") {
    const params = propLineParams(provider.apiKey);
    params.set("markets", ODDS_MARKETS);
    return `${PROPLINE_API_BASE}/sports/baseball_mlb/events/${eventId}/odds?${params.toString()}`;
  }
  const params = oddsParams(provider.apiKey, ODDS_MARKETS);
  return `${ODDS_API_BASE}/sports/baseball_mlb/events/${eventId}/odds?${params.toString()}`;
}

function oddsParams(apiKey: string, markets: string) {
  const params = new URLSearchParams({
    apiKey,
    regions: ODDS_REGION,
    markets,
    oddsFormat: "american",
  });
  if (ODDS_BOOKMAKERS) params.set("bookmakers", ODDS_BOOKMAKERS);
  return params;
}

function propLineParams(apiKey: string) {
  return new URLSearchParams({ apiKey });
}

function summarizeEventMarkets(event: OddsEvent, source: OddsProviderSource): MlbOddsGameMarketContext {
  const teamTotals = new Map<string, number[]>();
  const pitcherStrikeouts = new Map<string, number[]>();
  const gameTotals: number[] = [];

  for (const bookmaker of event.bookmakers ?? []) {
    for (const market of bookmaker.markets ?? []) {
      if (market.key === "totals") {
        gameTotals.push(...overPoints(market.outcomes ?? []));
      }
      if (market.key === "team_totals") {
        for (const outcome of market.outcomes ?? []) {
          if (outcome.name !== "Over" || typeof outcome.point !== "number" || !outcome.description) continue;
          pushMapped(teamTotals, normalizeName(outcome.description), outcome.point);
        }
      }
      if (market.key === "pitcher_strikeouts") {
        for (const outcome of market.outcomes ?? []) {
          if (outcome.name !== "Over" || typeof outcome.point !== "number" || !outcome.description) continue;
          pushMapped(pitcherStrikeouts, normalizeName(outcome.description), outcome.point);
        }
      }
    }
  }

  return {
    source,
    eventId: event.id,
    gameTotal: median(gameTotals),
    teamTotals: collapseLineMap(teamTotals),
    pitcherStrikeouts: collapseLineMap(pitcherStrikeouts),
  };
}

function oddsCredits(response: Response): MlbOddsFetchDiagnostics["credits"] {
  return {
    used: response.headers.get("x-requests-used") ?? response.headers.get("x-ratelimit-used"),
    remaining: response.headers.get("x-requests-remaining") ?? response.headers.get("x-ratelimit-remaining"),
  };
}

function mergeCredits(target: MlbOddsFetchDiagnostics["credits"], next: MlbOddsFetchDiagnostics["credits"]) {
  target.used = next.used ?? target.used;
  target.remaining = next.remaining ?? target.remaining;
}

function emptyDiagnostics(capturedAt: string, requestedGames = 0, error: string | null = null): MlbOddsFetchDiagnostics {
  return {
    contexts: new Map(),
    capturedAt,
    requestedGames,
    eventsSeen: 0,
    matchedGames: 0,
    marketFetches: 0,
    error,
    credits: { used: null, remaining: null },
    provider: "none",
  };
}

function overPoints(outcomes: OddsOutcome[]) {
  return outcomes
    .filter((outcome) => outcome.name === "Over" && typeof outcome.point === "number")
    .map((outcome) => outcome.point!);
}

function collapseLineMap(values: Map<string, number[]>) {
  const collapsed = new Map<string, number>();
  for (const [key, lines] of values.entries()) {
    const line = median(lines);
    if (line !== null) collapsed.set(key, line);
  }
  return collapsed;
}

function pushMapped(map: Map<string, number[]>, key: string, value: number) {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function isMatchingEvent(game: MlbScheduleGame, event: OddsEvent) {
  const homeMatches = normalizedTeamKeys(game.homeTeam.name, game.homeTeam.abbreviation).has(normalizeTeamName(event.home_team));
  const awayMatches = normalizedTeamKeys(game.awayTeam.name, game.awayTeam.abbreviation).has(normalizeTeamName(event.away_team));
  if (!homeMatches || !awayMatches) return false;

  const eventTime = new Date(event.commence_time).valueOf();
  const gameTime = new Date(game.gameDate).valueOf();
  if (Number.isNaN(eventTime) || Number.isNaN(gameTime)) return true;
  return Math.abs(eventTime - gameTime) <= 6 * 60 * 60 * 1000;
}

export function isOddsEligibleDate(dateKey: string) {
  const today = currentPacificDateKey();
  const daysAway = daysBetweenDateKeys(today, dateKey);
  return daysAway >= 0 && daysAway <= ODDS_MAX_DAYS_AHEAD;
}

export function normalizeOddsName(value: string) {
  return normalizeName(value);
}

function currentPacificDateKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function daysBetweenDateKeys(start: string, end: string) {
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return Number.POSITIVE_INFINITY;
  return Math.round((endMs - startMs) / (24 * 60 * 60 * 1000));
}

function envPositiveInt(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeTeamName(value: string) {
  const normalized = normalizeName(value);
  return TEAM_NAME_ALIASES[normalized] ?? normalized;
}

function normalizedTeamKeys(name: string, abbreviation: string) {
  return new Set([normalizeTeamName(name), normalizeTeamName(abbreviation), normalizeTeamName(`${abbreviation} ${name}`)]);
}

function oddsProviderLabel(provider: OddsProviderSource) {
  return provider === "prop-line" ? "PropLine" : "The Odds API";
}

const TEAM_NAME_ALIASES: Record<string, string> = {
  ari: "arizona diamondbacks",
  "ari diamondbacks": "arizona diamondbacks",
  az: "arizona diamondbacks",
  bal: "baltimore orioles",
  bos: "boston red sox",
  chc: "chicago cubs",
  "chi cubs": "chicago cubs",
  cws: "chicago white sox",
  "chi white sox": "chicago white sox",
  cin: "cincinnati reds",
  cle: "cleveland guardians",
  col: "colorado rockies",
  "col rockies": "colorado rockies",
  det: "detroit tigers",
  hou: "houston astros",
  kc: "kansas city royals",
  "kc royals": "kansas city royals",
  laa: "los angeles angels",
  lad: "los angeles dodgers",
  mia: "miami marlins",
  mil: "milwaukee brewers",
  "mil brewers": "milwaukee brewers",
  min: "minnesota twins",
  nym: "new york mets",
  "ny mets": "new york mets",
  nyy: "new york yankees",
  "ny yankees": "new york yankees",
  oak: "athletics",
  ath: "athletics",
  phi: "philadelphia phillies",
  pit: "pittsburgh pirates",
  sd: "san diego padres",
  sf: "san francisco giants",
  "sf giants": "san francisco giants",
  sea: "seattle mariners",
  stl: "st louis cardinals",
  "stl cardinals": "st louis cardinals",
  tb: "tampa bay rays",
  tex: "texas rangers",
  tor: "toronto blue jays",
  wsh: "washington nationals",
};
