import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getFormLeaderboard } from "@/lib/data/form-service";
import { getLiveScoreboard, type LiveScoreboardRow } from "@/lib/data/live-scoreboard-service";
import { getHomeSlateDate, getTodayProbables } from "@/lib/data/start-service";
import type { FormNextStart, FormSummary, ProbableStart, StartLine } from "@/lib/types";

export const WATCHLIST_COOKIE = "the_bump_watchlist_id";
const WATCHLIST_IDS_PREFIX = "wlids_";

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
};

export type WatchlistEntry = FormSummary & {
  nextStart: WatchlistNextStart | null;
  digestEvents: WatchlistDigestEvent[];
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

export type WatchlistDigestEvent = {
  key: "starting" | "rising" | "cooling" | "gem" | "rough" | "band";
  label: string;
  detail: string;
};

export type WatchlistView = {
  accountId: string | null;
  pitcherIds: string[];
  sort: WatchlistSort;
  entries: WatchlistEntry[];
  livePitchingNow: WatchlistLiveEntry[];
  pitchingSoon: WatchlistEntry[];
  bench: WatchlistEntry[];
  digestEvents: Array<WatchlistDigestEvent & { pitcherId: string; pitcherName: string }>;
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
  return user.pitcherIds;
}

export async function getWatchlistView(accountId: string | null | undefined, options: { sort?: string | null } = {}): Promise<WatchlistView> {
  const pitcherIds = await getWatchlistPitcherIds(accountId);
  const sort = parseWatchlistSort(options.sort);
  if (pitcherIds.length === 0) {
    return { accountId: accountId ?? null, pitcherIds: [], sort, entries: [], livePitchingNow: [], pitchingSoon: [], bench: [], digestEvents: [] };
  }

  const today = getHomeSlateDate();
  const [leaderboard, nextStarts, liveBoard] = await Promise.all([
    getFormLeaderboard({ qualifiedOnly: false }),
    getNextStartMap(pitcherIds),
    getLiveScoreboard({ date: today }).catch(() => null),
  ]);
  const liveRowsByPitcherId = new Map((liveBoard?.rows ?? []).filter(isWatchlistLiveRow).map((row) => [row.pitcherId, row]));
  const byId = new Map(leaderboard.pitchers.map((pitcher) => [pitcher.pitcherId, pitcher]));
  const hydratedEntries = pitcherIds
    .map((pitcherId) => byId.get(pitcherId))
    .filter((pitcher): pitcher is FormSummary => Boolean(pitcher))
    .map((pitcher) => {
      const nextStart = nextStarts.get(pitcher.pitcherId) ?? null;
      return {
        ...pitcher,
        nextStart,
        digestEvents: digestEventsForPitcher(pitcher, nextStart),
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

  return {
    accountId: accountId ?? null,
    pitcherIds,
    sort,
    entries,
    livePitchingNow,
    pitchingSoon,
    bench,
    digestEvents: entries.flatMap((entry) => entry.digestEvents.map((event) => ({ ...event, pitcherId: entry.pitcherId, pitcherName: entry.name }))),
  };
}

function isWatchlistLiveRow(row: LiveScoreboardRow): row is LiveScoreboardRow & { scoreLabel: "PROV" | "FINAL" } {
  return row.status === "live" && row.scoreLabel !== "PROJ";
}

function digestEventsForPitcher(pitcher: FormSummary, nextStart: WatchlistNextStart | null): WatchlistDigestEvent[] {
  const events: WatchlistDigestEvent[] = [];

  if (nextStart) {
    events.push({
      key: "starting",
      label: nextStart.daysAway === 0 ? "Starting today" : "Starting soon",
      detail: `${nextStart.side === "away" ? "@" : "vs"} ${nextStart.opponent} on ${formatShortDate(nextStart.date)} · Proj GS+ ${nextStart.projectedGsPlus}`,
    });
  }

  if (pitcher.status === "ok" && pitcher.trend === "heating" && pitcher.deltaForm >= 4) {
    events.push({
      key: "rising",
      label: "Rising",
      detail: `Form up ${formatSigned(pitcher.deltaForm)} over baseline`,
    });
  }

  if (pitcher.status === "ok" && pitcher.trend === "cooling" && pitcher.deltaForm <= -4) {
    events.push({
      key: "cooling",
      label: "Cooling",
      detail: `Form down ${formatSigned(pitcher.deltaForm)} over baseline`,
    });
  }

  if ((pitcher.lastStart?.gsPlus ?? 0) >= 65) {
    events.push({
      key: "gem",
      label: "Gem last start",
      detail: `Last GS+ ${pitcher.lastStart?.gsPlus ?? "--"} vs ${pitcher.lastStart?.opp ?? "opponent"}`,
    });
  }

  if ((pitcher.lastStart?.gsPlus ?? 100) <= 35) {
    events.push({
      key: "rough",
      label: "Rough last start",
      detail: `Last GS+ ${pitcher.lastStart?.gsPlus ?? "--"} vs ${pitcher.lastStart?.opp ?? "opponent"}`,
    });
  }

  if (pitcher.status === "ok" && (pitcher.tier === "onfire" || pitcher.tier === "ice")) {
    events.push({
      key: "band",
      label: pitcher.tier === "onfire" ? "On Fire band" : "Ice Cold band",
      detail: `Current Form ${Math.round(pitcher.rgs)} across ${pitcher.windowCount} starts`,
    });
  }

  return events;
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
  return typeof entry.nextStart?.daysAway === "number" && entry.nextStart.daysAway <= 2;
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

function formatSigned(value: number) {
  const rounded = value.toFixed(1);
  return value > 0 ? `+${rounded}` : rounded;
}
