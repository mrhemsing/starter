import { readRuntimeState, writeRuntimeState } from "@/lib/data/runtime-state-store";
import { inningsFromIP } from "@/lib/innings";
import type { LiveScoreboardRow } from "@/lib/data/live-scoreboard-service";
import type { WatchlistWireEvent } from "@/lib/data/watchlist-service";

export type NoHitterBidStatus = "active" | "broken" | "removed" | "completed";
export type NoHitterBidKind = "no-hitter" | "perfect-game";

export type NoHitterBidAlert = {
  id: string;
  date: string;
  gamePk: number;
  pitcherId: string;
  pitcherMlbId: number;
  pitcherName: string;
  team: string;
  kind: NoHitterBidKind;
  status: NoHitterBidStatus;
  inningsPitched: number;
  outsRecorded: number;
  inningLabel: string | null;
  pitchCount: number | null;
  liveHref: string;
  updatedAt: string;
  expiresAt: string;
};

type StoredNoHitterBid = NoHitterBidAlert & {
  events: NoHitterBidWireEvent[];
};

type NoHitterBidWireEvent = {
  transition: "reached" | "broken" | "removed" | "completed" | "perfect-completed";
  detectedAt: string;
  sentence: string;
  priority: number;
  payloadValues: string[];
};

type NoHitterBidState = {
  version: 1;
  date: string;
  updatedAt: string;
  bids: StoredNoHitterBid[];
};

const NO_HITTER_BID_STATE_VERSION = 1;
const NO_HITTER_ACTIVE_TTL_MS = 2 * 60 * 60 * 1000;
const NO_HITTER_END_STATE_TTL_MS = 30 * 60 * 1000;

export async function readNoHitterBidAlerts(date: string, now = new Date()): Promise<NoHitterBidAlert[]> {
  const state = await readNoHitterBidState(date);
  return currentAlerts(state, now).sort(compareAlertUrgency);
}

export async function updateNoHitterBidStateFromLiveBoard(date: string, rows: LiveScoreboardRow[], now = new Date()) {
  const previous = await readNoHitterBidState(date);
  const next = resolveNoHitterBidState(date, rows, previous, now);
  if (sameBidState(previous, next)) return { changed: false, activeAlerts: currentAlerts(next, now).length, events: 0 };
  await writeRuntimeState(noHitterBidStateKey(date), next);
  const previousEventCount = previous.bids.reduce((total, bid) => total + bid.events.length, 0);
  const nextEventCount = next.bids.reduce((total, bid) => total + bid.events.length, 0);
  console.log("[no-hitter-alerts] state updated", {
    date,
    activeAlerts: currentAlerts(next, now).length,
    events: nextEventCount - previousEventCount,
  });
  return { changed: true, activeAlerts: currentAlerts(next, now).length, events: nextEventCount - previousEventCount };
}

export async function readWatchlistNoHitterWireEvents(pitcherIds: string[], date: string, now = new Date()): Promise<Map<string, WatchlistWireEvent[]>> {
  const wanted = new Set(pitcherIds);
  const state = await readNoHitterBidState(date);
  const events = new Map<string, WatchlistWireEvent[]>();
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;

  for (const bid of state.bids) {
    if (!wanted.has(bid.pitcherId)) continue;
    const mapped = bid.events
      .filter((event) => Date.parse(event.detectedAt) >= cutoff)
      .map((event): WatchlistWireEvent => ({
        key: "no-hitter-bid",
        label: eventLabel(event.transition),
        sentence: event.sentence,
        detectedAt: event.detectedAt,
        priority: event.priority,
        payloadValues: event.payloadValues,
      }));
    if (mapped.length > 0) events.set(bid.pitcherId, mapped);
  }

  return events;
}

export function resolveNoHitterBidState(date: string, rows: LiveScoreboardRow[], previous: NoHitterBidState | null, now = new Date()): NoHitterBidState {
  const previousById = new Map((previous?.bids ?? []).map((bid) => [bid.id, bid]));
  const nextById = new Map<string, StoredNoHitterBid>();

  for (const row of rows) {
    const previousBid = previousById.get(noHitterBidId(row));
    const resolved = resolveBidFromRow(date, row, previousBid, now);
    if (resolved) nextById.set(resolved.id, resolved);
  }

  for (const bid of previous?.bids ?? []) {
    if (!nextById.has(bid.id)) nextById.set(bid.id, bid);
  }

  return {
    version: NO_HITTER_BID_STATE_VERSION,
    date,
    updatedAt: now.toISOString(),
    bids: [...nextById.values()].sort(compareStoredBids),
  };
}

function resolveBidFromRow(date: string, row: LiveScoreboardRow, previous: StoredNoHitterBid | undefined, now: Date): StoredNoHitterBid | null {
  const outsRecorded = inningsFromIP(row.line.inningsPitched);
  const triggerReached = row.line.hits === 0 && outsRecorded >= 18;
  const bidKind: NoHitterBidKind = isPerfectGameBid(row) ? "perfect-game" : "no-hitter";

  if (!previous && !triggerReached) return null;

  if (previous && row.line.hits > 0) {
    return transitionBid(previous, "broken", row, now);
  }

  if (triggerReached && row.gameFinal && outsRecorded >= 27) {
    return transitionBid(previous ?? createBid(date, row, bidKind, now), "completed", row, now);
  }

  if (triggerReached && row.starterIsOut && !row.gameFinal) {
    return transitionBid(previous ?? createBid(date, row, bidKind, now), "removed", row, now);
  }

  if (triggerReached && row.status === "live" && !row.starterIsOut) {
    const active = previous ?? createBid(date, row, bidKind, now);
    if (previous && previous.status !== "active") return previous;
    if (previous && sameActiveSnapshot(previous, row, bidKind)) return previous;
    return {
      ...active,
      kind: previous?.kind === "perfect-game" && bidKind === "no-hitter" ? "no-hitter" : bidKind,
      status: "active",
      inningsPitched: row.line.inningsPitched,
      outsRecorded,
      inningLabel: row.inningLabel,
      pitchCount: row.pitchCount,
      liveHref: row.liveHref,
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + NO_HITTER_ACTIVE_TTL_MS).toISOString(),
    };
  }

  return previous ?? null;
}

function createBid(date: string, row: LiveScoreboardRow, kind: NoHitterBidKind, now: Date): StoredNoHitterBid {
  const alert = baseAlert(date, row, kind, "active", now, new Date(now.getTime() + NO_HITTER_ACTIVE_TTL_MS));
  return {
    ...alert,
    events: [bidEvent("reached", alert, now)],
  };
}

function transitionBid(previous: StoredNoHitterBid, status: Exclude<NoHitterBidStatus, "active">, row: LiveScoreboardRow, now: Date): StoredNoHitterBid {
  if (previous.status === status) return previous;
  const transition: NoHitterBidWireEvent["transition"] = status === "completed" && previous.kind === "perfect-game" ? "perfect-completed" : status;
  const expiresAt = status === "completed" ? endOfSiteDay(now) : new Date(now.getTime() + NO_HITTER_END_STATE_TTL_MS);
  const next = {
    ...baseAlert(previous.date, row, previous.kind, status, now, expiresAt),
    events: previous.events,
  };
  if (previous.status !== status && !next.events.some((event) => event.transition === transition)) {
    next.events = [...next.events, bidEvent(transition, next, now)];
  }
  return next;
}

function baseAlert(date: string, row: LiveScoreboardRow, kind: NoHitterBidKind, status: NoHitterBidStatus, now: Date, expiresAt: Date): NoHitterBidAlert {
  return {
    id: noHitterBidId(row),
    date,
    gamePk: row.gamePk,
    pitcherId: row.pitcherId,
    pitcherMlbId: row.pitcherMlbId,
    pitcherName: row.pitcherName,
    team: row.team,
    kind,
    status,
    inningsPitched: row.line.inningsPitched,
    outsRecorded: inningsFromIP(row.line.inningsPitched),
    inningLabel: row.inningLabel,
    pitchCount: row.pitchCount,
    liveHref: row.liveHref,
    updatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

function bidEvent(transition: NoHitterBidWireEvent["transition"], alert: NoHitterBidAlert, now: Date): NoHitterBidWireEvent {
  return {
    transition,
    detectedAt: now.toISOString(),
    sentence: eventSentence(transition, alert),
    priority: transition === "completed" || transition === "perfect-completed" ? 100 : transition === "reached" ? 90 : 80,
    payloadValues: [String(alert.gamePk), alert.pitcherId, alert.pitcherName, formatBidInnings(alert.inningsPitched)],
  };
}

function eventSentence(transition: NoHitterBidWireEvent["transition"], alert: NoHitterBidAlert) {
  if (transition === "perfect-completed") return `Perfect game: ${alert.pitcherName}, ${alert.team}.`;
  if (transition === "completed") return `No-hitter: ${alert.pitcherName}, ${alert.team}.`;
  if (transition === "broken") return `No-hit bid broken: ${alert.pitcherName}, ${formatBidInnings(alert.inningsPitched)} IP.`;
  if (transition === "removed") return `${alert.pitcherName} removed after ${formatBidInnings(alert.inningsPitched)} no-hit IP.`;
  return `${alert.kind === "perfect-game" ? "Perfect game bid" : "No-hit bid"}: ${alert.pitcherName}, ${formatBidInnings(alert.inningsPitched)} IP.`;
}

function eventLabel(transition: NoHitterBidWireEvent["transition"]) {
  if (transition === "perfect-completed") return "PERFECT GAME";
  if (transition === "completed") return "NO-HITTER";
  if (transition === "broken") return "BID BROKEN";
  if (transition === "removed") return "BID ENDED";
  return "NO-HIT BID";
}

function isPerfectGameBid(row: LiveScoreboardRow) {
  return row.line.hits === 0 && row.line.walks === 0 && (row.line.hitBatters ?? 0) === 0 && (row.line.reachedOnError ?? 0) === 0;
}

function sameActiveSnapshot(previous: StoredNoHitterBid, row: LiveScoreboardRow, kind: NoHitterBidKind) {
  return previous.kind === kind &&
    previous.inningsPitched === row.line.inningsPitched &&
    previous.outsRecorded === inningsFromIP(row.line.inningsPitched) &&
    previous.inningLabel === row.inningLabel &&
    previous.pitchCount === row.pitchCount &&
    previous.liveHref === row.liveHref;
}

function currentAlerts(state: NoHitterBidState, now: Date) {
  return state.bids.filter((bid) => Date.parse(bid.expiresAt) > now.getTime()).map((bid) => ({
    id: bid.id,
    date: bid.date,
    gamePk: bid.gamePk,
    pitcherId: bid.pitcherId,
    pitcherMlbId: bid.pitcherMlbId,
    pitcherName: bid.pitcherName,
    team: bid.team,
    kind: bid.kind,
    status: bid.status,
    inningsPitched: bid.inningsPitched,
    outsRecorded: bid.outsRecorded,
    inningLabel: bid.inningLabel,
    pitchCount: bid.pitchCount,
    liveHref: bid.liveHref,
    updatedAt: bid.updatedAt,
    expiresAt: bid.expiresAt,
  }));
}

function compareAlertUrgency(a: NoHitterBidAlert, b: NoHitterBidAlert) {
  return b.outsRecorded - a.outsRecorded || Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

function compareStoredBids(a: StoredNoHitterBid, b: StoredNoHitterBid) {
  return compareAlertUrgency(a, b);
}

function noHitterBidId(row: Pick<LiveScoreboardRow, "gamePk" | "pitcherId">) {
  return `${row.gamePk}:${row.pitcherId}`;
}

function noHitterBidStateKey(date: string) {
  return `no-hitter-alerts:${date}`;
}

async function readNoHitterBidState(date: string): Promise<NoHitterBidState> {
  const state = await readRuntimeState<NoHitterBidState>(noHitterBidStateKey(date));
  return state?.version === NO_HITTER_BID_STATE_VERSION && Array.isArray(state.bids)
    ? state
    : { version: NO_HITTER_BID_STATE_VERSION, date, updatedAt: new Date(0).toISOString(), bids: [] };
}

function sameBidState(left: NoHitterBidState, right: NoHitterBidState) {
  return JSON.stringify(left.bids) === JSON.stringify(right.bids);
}

function formatBidInnings(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function endOfSiteDay(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const next = new Date(`${parts}T08:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}
