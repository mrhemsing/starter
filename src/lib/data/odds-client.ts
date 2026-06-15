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
};

const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
const ODDS_REGION = process.env.THE_BUMP_ODDS_REGION ?? "us";
const ODDS_BOOKMAKERS = process.env.THE_BUMP_ODDS_BOOKMAKERS;
const ODDS_CACHE_TTL_MS = 5 * 60 * 1000;

type CachedOddsContext = {
  expiresAt: number;
  promise: Promise<Map<string, MlbOddsGameMarketContext>>;
};

const oddsCache = new Map<string, CachedOddsContext>();

export async function fetchMlbOddsMarketContexts(games: MlbScheduleGame[]): Promise<Map<string, MlbOddsGameMarketContext>> {
  const apiKey = process.env.THE_BUMP_ODDS_API_KEY;
  if (!apiKey || games.length === 0) return new Map();

  const dateKey = games[0]?.gameDate.slice(0, 10) ?? "unknown";
  const cacheKey = `${dateKey}:${games.map((game) => game.gamePk).join(",")}:${ODDS_REGION}:${ODDS_BOOKMAKERS ?? "all"}`;
  const cached = oddsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = buildMlbOddsMarketContexts(games, apiKey).catch((error) => {
    console.warn("odds market fetch failed", error);
    return new Map<string, MlbOddsGameMarketContext>();
  });
  oddsCache.set(cacheKey, {
    expiresAt: Date.now() + ODDS_CACHE_TTL_MS,
    promise,
  });
  return promise;
}

async function buildMlbOddsMarketContexts(games: MlbScheduleGame[], apiKey: string) {
  const events = await fetchOddsEvents(apiKey);
  const eventByGamePk = new Map<string, OddsEvent>();
  for (const game of games) {
    const event = events.find((candidate) => isMatchingEvent(game, candidate));
    if (event) eventByGamePk.set(String(game.gamePk), event);
  }

  const entries = await Promise.all(
    [...eventByGamePk.entries()].map(async ([gamePk, event]) => {
      const detail = await fetchEventMarkets(apiKey, event.id);
      return [gamePk, summarizeEventMarkets(detail ?? event)] as const;
    }),
  );

  return new Map(entries);
}

async function fetchOddsEvents(apiKey: string): Promise<OddsEvent[]> {
  const params = oddsParams(apiKey, "h2h");
  const response = await fetch(`${ODDS_API_BASE}/sports/baseball_mlb/odds?${params.toString()}`, {
    next: { revalidate: 300 },
  });
  if (!response.ok) throw new Error(`The Odds API events returned ${response.status}`);
  return await response.json() as OddsEvent[];
}

async function fetchEventMarkets(apiKey: string, eventId: string): Promise<OddsEvent | null> {
  const params = oddsParams(apiKey, "pitcher_strikeouts,team_totals,totals");
  const response = await fetch(`${ODDS_API_BASE}/sports/baseball_mlb/events/${eventId}/odds?${params.toString()}`, {
    next: { revalidate: 300 },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`The Odds API event ${eventId} returned ${response.status}`);
  return await response.json() as OddsEvent;
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

export function normalizeOddsName(value: string) {
  return normalizeName(value);
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
