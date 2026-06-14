import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getFormLeaderboard } from "@/lib/data/form-service";
import { getHomeSlateDate, getTodayProbables } from "@/lib/data/start-service";
import type { FormNextStart, FormSummary } from "@/lib/types";

export const WATCHLIST_COOKIE = "the_bump_watchlist_id";

type WatchlistStore = {
  users: Record<string, { pitcherIds: string[]; updatedAt: string }>;
};

export type WatchlistEntry = FormSummary & {
  nextStart: FormNextStart | null;
  digestEvents: WatchlistDigestEvent[];
};

export type WatchlistDigestEvent = {
  key: "starting" | "rising" | "rough";
  label: string;
  detail: string;
};

export type WatchlistView = {
  accountId: string | null;
  pitcherIds: string[];
  entries: WatchlistEntry[];
  digestEvents: Array<WatchlistDigestEvent & { pitcherId: string; pitcherName: string }>;
};

const STORE_PATH = path.join(process.cwd(), ".data", "watchlists.json");

export function createWatchlistAccountId() {
  return `wl_${randomUUID()}`;
}

export async function getWatchlistPitcherIds(accountId: string | null | undefined) {
  if (!accountId) return [];
  const store = await readStore();
  return store.users[accountId]?.pitcherIds ?? [];
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

export async function getWatchlistView(accountId: string | null | undefined): Promise<WatchlistView> {
  const pitcherIds = await getWatchlistPitcherIds(accountId);
  if (pitcherIds.length === 0) {
    return { accountId: accountId ?? null, pitcherIds: [], entries: [], digestEvents: [] };
  }

  const [leaderboard, nextStarts] = await Promise.all([
    getFormLeaderboard({ qualifiedOnly: false }),
    getNextStartMap(pitcherIds),
  ]);
  const byId = new Map(leaderboard.pitchers.map((pitcher) => [pitcher.pitcherId, pitcher]));
  const entries = pitcherIds
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

  return {
    accountId: accountId ?? null,
    pitcherIds,
    entries,
    digestEvents: entries.flatMap((entry) => entry.digestEvents.map((event) => ({ ...event, pitcherId: entry.pitcherId, pitcherName: entry.name }))),
  };
}

function digestEventsForPitcher(pitcher: FormSummary, nextStart: FormNextStart | null): WatchlistDigestEvent[] {
  const events: WatchlistDigestEvent[] = [];

  if (nextStart) {
    events.push({
      key: "starting",
      label: "Starting soon",
      detail: `${nextStart.side === "away" ? "@" : "vs"} ${nextStart.opponent} on ${formatShortDate(nextStart.date)}`,
    });
  }

  if (pitcher.status === "ok" && pitcher.trend === "heating" && pitcher.deltaForm >= 4) {
    events.push({
      key: "rising",
      label: "Rising",
      detail: `Form up ${formatSigned(pitcher.deltaForm)} over baseline`,
    });
  }

  if ((pitcher.lastStart?.gsPlus ?? 100) <= 35) {
    events.push({
      key: "rough",
      label: "Rough last start",
      detail: `Last GS+ ${pitcher.lastStart?.gsPlus ?? "--"} vs ${pitcher.lastStart?.opp ?? "opponent"}`,
    });
  }

  return events;
}

async function getNextStartMap(pitcherIds: string[]): Promise<Map<string, FormNextStart>> {
  const wanted = new Set(pitcherIds);
  const today = getHomeSlateDate();
  const dates = Array.from({ length: 10 }, (_, index) => addDays(today, index));
  const slates = await Promise.all(dates.map((date) => getTodayProbables(date)));
  const nextStarts = new Map<string, FormNextStart>();

  for (const probables of slates) {
    for (const probable of probables) {
      if (!wanted.has(probable.pitcherId) || nextStarts.has(probable.pitcherId)) continue;
      nextStarts.set(probable.pitcherId, {
        date: probable.date,
        opponent: probable.opponent,
        side: probable.side,
      });
    }
  }

  return nextStarts;
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
