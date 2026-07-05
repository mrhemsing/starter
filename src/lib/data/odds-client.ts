import type { MlbScheduleGame } from "@/lib/types";

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
  source: "the-odds-api";
  eventId: string;
  gameTotal: number | null;
  teamTotals: Map<string, number>;
  pitcherStrikeouts: Map<string, number>;
  capturedAt?: string;
};

export type MlbOddsFetchDiagnostics = {
  contexts: Map<string, MlbOddsGameMarketContext>;
  capturedAt: string;
  credits: {
    used: string | null;
    remaining: string | null;
  };
};

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const ODDS_REGION = process.env.THE_BUMP_ODDS_REGION ?? "us";
const ODDS_BOOKMAKERS = process.env.THE_BUMP_ODDS_BOOKMAKERS;
const ODDS_CACHE_TTL_MS = envPositiveInt("THE_BUMP_ODDS_CACHE_MINUTES", 30) * 60 * 1000;
const ODDS_REVALIDATE_SECONDS = Math.max(60, Math.floor(ODDS_CACHE_TTL_MS / 1000));
const ODDS_MAX_DAYS_AHEAD = envPositiveInt("THE_BUMP_ODDS_MAX_DAYS_AHEAD", 1);

type CachedOddsContext = {
  expiresAt: number;
  promise: Promise<Map<string, MlbOddsGameMarketContext>>;
};

const oddsCache = new Map<string, CachedOddsContext>();

export async function fetchMlbOddsMarketContexts(games: MlbScheduleGame[]): Promise<Map<string, MlbOddsGameMarketContext>> {
  return (await fetchMlbOddsMarketContextsWithDiagnostics(games)).contexts;
}

export async function fetchMlbOddsMarketContextsWithDiagnostics(games: MlbScheduleGame[]): Promise<MlbOddsFetchDiagnostics> {
  const apiKey = process.env.THE_BUMP_ODDS_API_KEY;
  const capturedAt = new Date().toISOString();
  if (!apiKey || games.length === 0) return emptyDiagnostics(capturedAt);

  const dateKey = games[0]?.gameDate.slice(0, 10) ?? "unknown";
  if (!isOddsEligibleDate(dateKey)) return emptyDiagnostics(capturedAt);

  const cacheKey = `${dateKey}:${games.map((game) => game.gamePk).join(",")}:${ODDS_REGION}:${ODDS_BOOKMAKERS ?? "all"}`;
  const cached = oddsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      contexts: await cached.promise,
      capturedAt,
      credits: { used: null, remaining: null },
    };
  }

  const diagnosticPromise = buildMlbOddsMarketContexts(games, apiKey, capturedAt).catch((error) => {
    console.warn("odds market fetch failed", error);
    return emptyDiagnostics(capturedAt);
  });
  const promise = diagnosticPromise.then((result) => result.contexts);
  oddsCache.set(cacheKey, {
    expiresAt: Date.now() + ODDS_CACHE_TTL_MS,
    promise,
  });
  return diagnosticPromise;
}

async function buildMlbOddsMarketContexts(games: MlbScheduleGame[], apiKey: string, capturedAt: string): Promise<MlbOddsFetchDiagnostics> {
  const credits = { used: null as string | null, remaining: null as string | null };
  const eventsResult = await fetchOddsEvents(apiKey);
  mergeCredits(credits, eventsResult.credits);
  const events = eventsResult.events;
  const eventByGamePk = new Map<string, OddsEvent>();
  for (const game of games) {
    const event = events.find((candidate) => isMatchingEvent(game, candidate));
    if (event) eventByGamePk.set(String(game.gamePk), event);
  }

  const entries = await Promise.all(
    [...eventByGamePk.entries()].map(async ([gamePk, event]) => {
      const detail = await fetchEventMarkets(apiKey, event.id);
      if (detail) mergeCredits(credits, detail.credits);
      return [gamePk, { ...summarizeEventMarkets(detail?.event ?? event), capturedAt }] as const;
    }),
  );

  return {
    contexts: new Map(entries),
    capturedAt,
    credits,
  };
}

async function fetchOddsEvents(apiKey: string): Promise<{ events: OddsEvent[]; credits: MlbOddsFetchDiagnostics["credits"] }> {
  const params = oddsParams(apiKey, "h2h");
  const response = await fetch(`${ODDS_API_BASE}/sports/baseball_mlb/odds?${params.toString()}`, {
    next: { revalidate: ODDS_REVALIDATE_SECONDS },
  });
  if (!response.ok) throw new Error(`The Odds API events returned ${response.status}`);
  return {
    events: await response.json() as OddsEvent[],
    credits: oddsCredits(response),
  };
}

async function fetchEventMarkets(apiKey: string, eventId: string): Promise<{ event: OddsEvent; credits: MlbOddsFetchDiagnostics["credits"] } | null> {
  const params = oddsParams(apiKey, "pitcher_strikeouts,team_totals,totals");
  const response = await fetch(`${ODDS_API_BASE}/sports/baseball_mlb/events/${eventId}/odds?${params.toString()}`, {
    next: { revalidate: ODDS_REVALIDATE_SECONDS },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`The Odds API event ${eventId} returned ${response.status}`);
  return {
    event: await response.json() as OddsEvent,
    credits: oddsCredits(response),
  };
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

function summarizeEventMarkets(event: OddsEvent): MlbOddsGameMarketContext {
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
    source: "the-odds-api",
    eventId: event.id,
    gameTotal: median(gameTotals),
    teamTotals: collapseLineMap(teamTotals),
    pitcherStrikeouts: collapseLineMap(pitcherStrikeouts),
  };
}

function oddsCredits(response: Response): MlbOddsFetchDiagnostics["credits"] {
  return {
    used: response.headers.get("x-requests-used"),
    remaining: response.headers.get("x-requests-remaining"),
  };
}

function mergeCredits(target: MlbOddsFetchDiagnostics["credits"], next: MlbOddsFetchDiagnostics["credits"]) {
  target.used = next.used ?? target.used;
  target.remaining = next.remaining ?? target.remaining;
}

function emptyDiagnostics(capturedAt: string): MlbOddsFetchDiagnostics {
  return {
    contexts: new Map(),
    capturedAt,
    credits: { used: null, remaining: null },
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
  const homeMatches = normalizeName(event.home_team) === normalizeName(game.homeTeam.name);
  const awayMatches = normalizeName(event.away_team) === normalizeName(game.awayTeam.name);
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
