import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getFormLeaderboard } from "@/lib/data/form-service";
import { getLiveScoreboard, type LiveScoreboardRow } from "@/lib/data/live-scoreboard-service";
import { readRuntimeState, writeRuntimeState } from "@/lib/data/runtime-state-store";
import { getHomeSlateDate, getTodayProbables } from "@/lib/data/start-service";
import { readWatchlistHeadlineEvents } from "@/lib/data/watchlist-headlines-service";
import type { FormNextStart, FormSummary, ProbableStart, StartLine } from "@/lib/types";

export const WATCHLIST_COOKIE = "the_bump_watchlist_id";
export const WATCHLIST_SOON_DAYS = 3;
const WATCHLIST_IDS_PREFIX = "wlids_";
const WATCHLIST_FOLLOWED_STATE_KEY = "watchlist:followed-pitchers";

type WatchlistStore = {
  users: Record<string, { pitcherIds: string[]; updatedAt: string }>;
};

export type WatchlistSort = "default" | "form" | "soonest" | "mover";

export type WatchlistNextStart = FormNextStart & {
  daysAway: number;
  gamePk: number;
  gameLabel: string | null;
  venue: string | null;
  status: string;
  projectedGsPlus: number;
  projectionSource: "baseline" | "measured";
  parkAdjustment: number | null;
  daysRest: number | null;
  probableStatus: "confirmed" | "projected";
};

export type WatchlistEntry = FormSummary & {
  nextStart: WatchlistNextStart | null;
  wireEvents: WatchlistWireEvent[];
};

export type WatchlistLiveStart = {
  score: number | null;
  scoreLabel: "PROV" | "FINAL";
  inningLabel: string | null;
  pitchCount: number | null;
  opponent: string;
  line: StartLine;
  liveHref: string;
};

export type WatchlistLiveEntry = WatchlistEntry & {
  liveStart: WatchlistLiveStart;
};

export type WatchlistWireEvent = {
  key: "rest-anomaly" | "two-start-week" | "streak" | "gem" | "blowup" | "headlines";
  label: string;
  sentence: string | null;
  detectedAt: string;
  priority: number;
  payloadValues: string[];
  headline?: {
    text: string;
    source: string;
    url: string;
    publishedAt: string;
  };
};

export type WatchlistView = {
  accountId: string | null;
  pitcherIds: string[];
  sort: WatchlistSort;
  entries: WatchlistEntry[];
  livePitchingNow: WatchlistLiveEntry[];
  pitchingSoon: WatchlistEntry[];
  bench: WatchlistEntry[];
  wireEvents: Array<WatchlistWireEvent & { pitcherId: string; pitcherName: string }>;
  digestEvents: Array<WatchlistWireEvent & { pitcherId: string; pitcherName: string }>;
};

const STORE_PATH = path.join(process.cwd(), ".data", "watchlists.json");

export function createWatchlistAccountId() {
  return `wl_${randomUUID()}`;
}

export function serializeWatchlistPitcherIds(pitcherIds: string[]) {
  const uniqueIds = Array.from(new Set(pitcherIds.map(normalizePitcherId)));
  return `${WATCHLIST_IDS_PREFIX}${uniqueIds.join(".")}`;
}

export async function addPitcherToWatchlistValue(watchlistValue: string | null | undefined, pitcherId: string) {
  const pitcherIds = await getWatchlistPitcherIds(watchlistValue);
  const safePitcherId = normalizePitcherId(pitcherId);
  return pitcherIds.includes(safePitcherId) ? pitcherIds : [...pitcherIds, safePitcherId];
}

export async function removePitcherFromWatchlistValue(watchlistValue: string | null | undefined, pitcherId: string) {
  const pitcherIds = await getWatchlistPitcherIds(watchlistValue);
  const safePitcherId = normalizePitcherId(pitcherId);
  return pitcherIds.filter((id) => id !== safePitcherId);
}

export async function getWatchlistPitcherIds(watchlistValue: string | null | undefined) {
  if (!watchlistValue) return [];
  const cookieIds = parseWatchlistPitcherIds(watchlistValue);
  if (cookieIds) return cookieIds;
  const store = await readStore();
  return store.users[watchlistValue]?.pitcherIds ?? [];
}

export async function followPitcher(accountId: string, pitcherId: string) {
  const safePitcherId = normalizePitcherId(pitcherId);
  const store = await readStore();
  const user = store.users[accountId] ?? { pitcherIds: [], updatedAt: new Date().toISOString() };
  if (!user.pitcherIds.includes(safePitcherId)) user.pitcherIds.push(safePitcherId);
  user.updatedAt = new Date().toISOString();
  store.users[accountId] = user;
  await writeStore(store);
  await rememberWatchlistPitcherIds(user.pitcherIds);
  return user.pitcherIds;
}

export async function unfollowPitcher(accountId: string, pitcherId: string) {
  const safePitcherId = normalizePitcherId(pitcherId);
  const store = await readStore();
  const user = store.users[accountId] ?? { pitcherIds: [], updatedAt: new Date().toISOString() };
  user.pitcherIds = user.pitcherIds.filter((id) => id !== safePitcherId);
  user.updatedAt = new Date().toISOString();
  store.users[accountId] = user;
  await writeStore(store);
  await rememberWatchlistPitcherIds(user.pitcherIds);
  return user.pitcherIds;
}

export async function rememberWatchlistPitcherIds(pitcherIds: string[]) {
  const safePitcherIds = Array.from(new Set(pitcherIds.map(normalizePitcherId)));
  const previous = await readRuntimeState<{ pitcherIds: string[]; updatedAt: string }>(WATCHLIST_FOLLOWED_STATE_KEY);
  const merged = Array.from(new Set([...(previous?.pitcherIds ?? []), ...safePitcherIds])).sort((a, b) => Number(a) - Number(b));
  await writeRuntimeState(WATCHLIST_FOLLOWED_STATE_KEY, { pitcherIds: merged, updatedAt: new Date().toISOString() });
}

export async function getKnownWatchlistPitcherIds() {
  const store = await readStore();
  const storedIds = Object.values(store.users).flatMap((user) => user.pitcherIds);
  const runtimeIds = await readRuntimeState<{ pitcherIds: string[] }>(WATCHLIST_FOLLOWED_STATE_KEY);
  return Array.from(new Set([...storedIds, ...(runtimeIds?.pitcherIds ?? [])].map(normalizePitcherId))).sort((a, b) => Number(a) - Number(b));
}

export async function getWatchlistView(accountId: string | null | undefined, options: { sort?: string | null } = {}): Promise<WatchlistView> {
  const pitcherIds = await getWatchlistPitcherIds(accountId);
  const sort = parseWatchlistSort(options.sort);
  if (pitcherIds.length === 0) {
    return { accountId: accountId ?? null, pitcherIds: [], sort, entries: [], livePitchingNow: [], pitchingSoon: [], bench: [], wireEvents: [], digestEvents: [] };
  }
  await rememberWatchlistPitcherIds(pitcherIds);

  const today = getHomeSlateDate();
  const [leaderboard, nextStarts, upcomingStarts, headlineEventsByPitcher, liveBoard] = await Promise.all([
    getFormLeaderboard({ qualifiedOnly: false }),
    getNextStartMap(pitcherIds),
    getUpcomingStartMap(pitcherIds),
    readWatchlistHeadlineEvents(pitcherIds),
    getLiveScoreboard({ date: today }).catch(() => null),
  ]);
  const lastStartPercentiles = buildLastStartPercentiles(leaderboard.pitchers);
  const liveRowsByPitcherId = new Map((liveBoard?.rows ?? []).filter(isWatchlistLiveRow).map((row) => [row.pitcherId, row]));
  const byId = new Map(leaderboard.pitchers.map((pitcher) => [pitcher.pitcherId, pitcher]));
  const hydratedEntries = pitcherIds
    .map((pitcherId) => byId.get(pitcherId))
    .filter((pitcher): pitcher is FormSummary => Boolean(pitcher))
    .map((pitcher) => {
      const rawNextStart = nextStarts.get(pitcher.pitcherId) ?? null;
      const nextStart = rawNextStart ? { ...rawNextStart, daysRest: daysBetween(pitcher.lastStart?.gameDate ?? today, rawNextStart.date) } : null;
      return {
        ...pitcher,
        nextStart,
        wireEvents: [
          ...wireEventsForPitcher(pitcher, nextStart, upcomingStarts.get(pitcher.pitcherId) ?? [], lastStartPercentiles),
          ...(headlineEventsByPitcher.get(pitcher.pitcherId) ?? []),
        ],
      };
    });
  const entries = sortWatchlistEntries(hydratedEntries, sort);
  const livePitchingNow = entries.flatMap((entry) => {
    const row = liveRowsByPitcherId.get(entry.pitcherId);
    if (!row) return [];
    return [{
      ...entry,
      liveStart: {
        score: row.gsPlus,
        scoreLabel: row.scoreLabel,
        inningLabel: row.inningLabel,
        pitchCount: row.pitchCount,
        opponent: row.opponent,
        line: row.line,
        liveHref: row.liveHref,
      },
    }];
  });
  const pitchingSoon = entries.filter(isPitchingSoon);
  const bench = entries.filter((entry) => !isPitchingSoon(entry));
  const wireEvents = entries
    .flatMap((entry) => entry.wireEvents.map((event) => ({ ...event, pitcherId: entry.pitcherId, pitcherName: entry.name })))
    .sort((a, b) => b.priority - a.priority || Date.parse(b.detectedAt) - Date.parse(a.detectedAt) || a.pitcherName.localeCompare(b.pitcherName));

  return {
    accountId: accountId ?? null,
    pitcherIds,
    sort,
    entries,
    livePitchingNow,
    pitchingSoon,
    bench,
    wireEvents,
    digestEvents: wireEvents,
  };
}

function isWatchlistLiveRow(row: LiveScoreboardRow): row is LiveScoreboardRow & { scoreLabel: "PROV" | "FINAL" } {
  return row.status === "live" && row.scoreLabel !== "PROJ";
}

function wireEventsForPitcher(
  pitcher: FormSummary,
  nextStart: WatchlistNextStart | null,
  upcomingStarts: WatchlistNextStart[],
  lastStartPercentiles: Map<string, number>,
): WatchlistWireEvent[] {
  const events: WatchlistWireEvent[] = [];
  const detectedAt = new Date().toISOString();

  if (nextStart && nextStart.daysRest !== null && (nextStart.daysRest <= 4 || nextStart.daysRest >= 7)) {
    events.push({
      key: "rest-anomaly",
      label: "REST ANOMALY",
      sentence: `${pitcher.name} lines up on ${nextStart.daysRest} days of rest ${nextStart.side === "away" ? "at" : "vs"} ${nextStart.opponent}.`,
      detectedAt,
      priority: 70,
      payloadValues: [String(nextStart.daysRest), nextStart.opponent],
    });
  }

  const twoStartWeek = startsInSameFantasyWeek(upcomingStarts);
  if (twoStartWeek) {
    events.push({
      key: "two-start-week",
      label: "TWO-START WEEK",
      sentence: `${pitcher.name} has two probable starts this week: ${formatShortDate(twoStartWeek[0].date)} ${twoStartWeek[0].side === "away" ? "at" : "vs"} ${twoStartWeek[0].opponent} and ${formatShortDate(twoStartWeek[1].date)} ${twoStartWeek[1].side === "away" ? "at" : "vs"} ${twoStartWeek[1].opponent}.`,
      detectedAt,
      priority: 60,
      payloadValues: [formatShortDate(twoStartWeek[0].date), twoStartWeek[0].opponent, formatShortDate(twoStartWeek[1].date), twoStartWeek[1].opponent],
    });
  }

  const streak = currentGsPlusStreak(pitcher);
  if (streak) {
    events.push({
      key: "streak",
      label: "STREAK",
      sentence: `${pitcher.name} extended a ${streak.count}-start ${streak.kind === "hot" ? "55 plus" : "sub-40"} GS+ streak.`,
      detectedAt,
      priority: 30,
      payloadValues: [String(streak.count), streak.kind === "hot" ? "55 plus" : "sub-40"],
    });
  }

  if ((pitcher.lastStart?.gsPlus ?? 0) >= 70) {
    const percentile = lastStartPercentiles.get(pitcher.pitcherId) ?? null;
    events.push({
      key: "gem",
      label: "GEM",
      sentence: `${pitcher.name}'s ${pitcher.lastStart?.gsPlus ?? "--"} GS+ ranked in the top ${percentile ?? 10} percent of recent followed-board starts.`,
      detectedAt,
      priority: 20,
      payloadValues: [String(pitcher.lastStart?.gsPlus ?? ""), `top ${percentile ?? 10} percent`],
    });
  }

  if ((pitcher.lastStart?.gsPlus ?? 100) <= 25) {
    const percentile = lastStartPercentiles.get(pitcher.pitcherId) ?? null;
    events.push({
      key: "blowup",
      label: "BLOWUP",
      sentence: `${pitcher.name}'s ${pitcher.lastStart?.gsPlus ?? "--"} GS+ landed in the bottom ${100 - (percentile ?? 90)} percent of recent followed-board starts.`,
      detectedAt,
      priority: 10,
      payloadValues: [String(pitcher.lastStart?.gsPlus ?? ""), `bottom ${100 - (percentile ?? 90)} percent`],
    });
  }

  return events.sort((a, b) => b.priority - a.priority).slice(0, 2);
}

async function getNextStartMap(pitcherIds: string[]): Promise<Map<string, WatchlistNextStart>> {
  const wanted = new Set(pitcherIds);
  const today = getHomeSlateDate();
  const dates = Array.from({ length: 10 }, (_, index) => addDays(today, index));
  const slates = await Promise.all(dates.map((date) => getTodayProbables(date)));
  const nextStarts = new Map<string, WatchlistNextStart>();

  for (const probables of slates) {
    for (const probable of probables) {
      if (!wanted.has(probable.pitcherId) || nextStarts.has(probable.pitcherId)) continue;
      nextStarts.set(probable.pitcherId, probableToWatchlistNextStart(probable, today));
    }
  }

  return nextStarts;
}

async function getUpcomingStartMap(pitcherIds: string[]): Promise<Map<string, WatchlistNextStart[]>> {
  const wanted = new Set(pitcherIds);
  const today = getHomeSlateDate();
  const dates = Array.from({ length: 10 }, (_, index) => addDays(today, index));
  const slates = await Promise.all(dates.map((date) => getTodayProbables(date)));
  const starts = new Map<string, WatchlistNextStart[]>();

  for (const probables of slates) {
    for (const probable of probables) {
      if (!wanted.has(probable.pitcherId)) continue;
      const next = probableToWatchlistNextStart(probable, today);
      const list = starts.get(probable.pitcherId) ?? [];
      list.push(next);
      starts.set(probable.pitcherId, list);
    }
  }

  return starts;
}

function probableToWatchlistNextStart(probable: ProbableStart, today: string): WatchlistNextStart {
  return {
    date: probable.date,
    opponent: probable.opponent,
    side: probable.side ?? "home",
    daysAway: Math.max(0, daysBetween(today, probable.date)),
    gamePk: probable.gamePk,
    gameLabel: probable.gameLabel ?? null,
    venue: probable.venue ?? null,
    status: probable.status,
    projectedGsPlus: Math.round(probable.matchupScore),
    projectionSource: Math.round(probable.matchupScore) === 50 ? "baseline" : "measured",
    parkAdjustment: Number.isFinite(probable.parkAdjustment) ? probable.parkAdjustment : null,
    daysRest: null,
    probableStatus: probable.status.toLowerCase().includes("probable") || probable.status.toLowerCase().includes("scheduled") ? "confirmed" : "projected",
  };
}

function parseWatchlistSort(value: string | null | undefined): WatchlistSort {
  if (value === "form" || value === "soonest" || value === "mover") return value;
  return "default";
}

function sortWatchlistEntries(entries: WatchlistEntry[], sort: WatchlistSort) {
  return [...entries].sort((a, b) => {
    if (sort === "soonest") return compareSoonest(a, b) || compareForm(a, b);
    if (sort === "mover") return Math.abs(b.deltaForm) - Math.abs(a.deltaForm) || compareDefault(a, b);
    if (sort === "form") return compareForm(a, b) || compareSoonest(a, b);
    return compareDefault(a, b);
  });
}

function compareDefault(a: WatchlistEntry, b: WatchlistEntry) {
  return Number(isPitchingSoon(b)) - Number(isPitchingSoon(a)) || compareSoonest(a, b) || compareForm(a, b);
}

function compareSoonest(a: WatchlistEntry, b: WatchlistEntry) {
  const aDays = a.nextStart?.daysAway ?? Number.POSITIVE_INFINITY;
  const bDays = b.nextStart?.daysAway ?? Number.POSITIVE_INFINITY;
  return aDays - bDays || a.name.localeCompare(b.name);
}

function compareForm(a: WatchlistEntry, b: WatchlistEntry) {
  return b.rgs - a.rgs || b.deltaForm - a.deltaForm || a.name.localeCompare(b.name);
}

function isPitchingSoon(entry: WatchlistEntry) {
  return typeof entry.nextStart?.daysAway === "number" && entry.nextStart.daysAway <= WATCHLIST_SOON_DAYS;
}

function startsInSameFantasyWeek(starts: WatchlistNextStart[]) {
  for (let index = 0; index < starts.length; index += 1) {
    for (let compareIndex = index + 1; compareIndex < starts.length; compareIndex += 1) {
      if (fantasyWeekKey(starts[index].date) === fantasyWeekKey(starts[compareIndex].date)) return [starts[index], starts[compareIndex]] as const;
    }
  }
  return null;
}

function fantasyWeekKey(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  const day = value.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  value.setUTCDate(value.getUTCDate() + mondayOffset);
  return value.toISOString().slice(0, 10);
}

function currentGsPlusStreak(pitcher: FormSummary) {
  const starts = [...(pitcher.spark ?? [])].reverse();
  const hotCount = countWhile(starts, (score) => score >= 55);
  if (hotCount >= 3) return { kind: "hot" as const, count: hotCount };
  const coldCount = countWhile(starts, (score) => score < 40);
  if (coldCount >= 3) return { kind: "cold" as const, count: coldCount };
  return null;
}

function countWhile(values: number[], predicate: (value: number) => boolean) {
  let count = 0;
  for (const value of values) {
    if (!predicate(value)) break;
    count += 1;
  }
  return count;
}

function buildLastStartPercentiles(pitchers: FormSummary[]) {
  const scores = pitchers.flatMap((pitcher) => typeof pitcher.lastStart?.gsPlus === "number" ? [pitcher.lastStart.gsPlus] : []).sort((a, b) => a - b);
  const percentiles = new Map<string, number>();
  if (scores.length === 0) return percentiles;
  for (const pitcher of pitchers) {
    const score = pitcher.lastStart?.gsPlus;
    if (typeof score !== "number") continue;
    const belowOrEqual = scores.filter((value) => value <= score).length;
    percentiles.set(pitcher.pitcherId, Math.max(1, Math.min(99, Math.round((belowOrEqual / scores.length) * 100))));
  }
  return percentiles;
}

function daysBetween(olderDate: string, newerDate: string) {
  return Math.round((new Date(`${newerDate}T00:00:00.000Z`).getTime() - new Date(`${olderDate}T00:00:00.000Z`).getTime()) / (24 * 60 * 60 * 1000));
}

async function readStore(): Promise<WatchlistStore> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as WatchlistStore;
    return { users: parsed.users ?? {} };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return { users: {} };
  }
}

async function writeStore(store: WatchlistStore) {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

function normalizePitcherId(pitcherId: string) {
  if (!/^\d+$/.test(pitcherId)) throw new Error("invalid pitcher id");
  return pitcherId;
}

function parseWatchlistPitcherIds(watchlistValue: string) {
  if (!watchlistValue.startsWith(WATCHLIST_IDS_PREFIX)) return null;
  const encodedIds = watchlistValue.slice(WATCHLIST_IDS_PREFIX.length);
  if (!encodedIds) return [];
  return encodedIds.split(".").map(normalizePitcherId);
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatShortDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(parsed);
}
