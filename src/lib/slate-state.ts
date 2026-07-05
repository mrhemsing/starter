import type { MlbSchedule, StartSummary } from "@/lib/types";

export type NormalizedScheduleStatus = "pregame" | "delayed" | "live" | "final" | "ppd" | "suspended";
export type SlateStartBucketStatus = "live" | "final" | "warming" | "scheduled" | "delay";

export type SlateStartBucketCounts = {
  totalStarts: number;
  liveStarts: number;
  finalStarts: number;
  warmingStarts: number;
  scheduledStarts: number;
  delayStarts: number;
};

export type SlateProgressStateKey = "pre-first-pitch" | "starts-in-progress" | "reconciling" | "all-starts-complete" | "no-games";

export type SlateProgressState = {
  date: string;
  state: SlateProgressStateKey;
  totalGames: number;
  liveGames: number;
  finalGames: number;
  totalStarts: number;
  completedStarts: number;
  liveStarts: number;
  firstPitchAt: string | null;
  countdownLabel: string | null;
};

export function summarizeSlateStartBuckets<T extends { status: SlateStartBucketStatus }>(starts: T[]): SlateStartBucketCounts {
  return {
    totalStarts: starts.length,
    liveStarts: starts.filter((start) => start.status === "live").length,
    finalStarts: starts.filter((start) => start.status === "final").length,
    warmingStarts: starts.filter((start) => start.status === "warming").length,
    scheduledStarts: starts.filter((start) => start.status === "scheduled").length,
    delayStarts: starts.filter((start) => start.status === "delay").length,
  };
}

export function summarizeCanonicalStartBuckets(starts: StartSummary[]): SlateStartBucketCounts {
  return summarizeSlateStartBuckets(starts.map((start) => ({ status: canonicalSlateStartStatus(start) })));
}

function canonicalSlateStartStatus(start: StartSummary): SlateStartBucketStatus {
  if (start.source?.line === "archive-gamefeed") return "final";
  if (start.source?.line === "live-gamefeed" && start.source.lineStatus === "final") return "final";
  if (start.source?.line === "live-gamefeed" && start.source.lineStatus === "delay") return "delay";
  if (start.source?.line === "live-gamefeed" && start.source.lineStatus === "warming") return "warming";
  if (start.source?.line === "live-gamefeed") return "live";
  return "scheduled";
}

export function getSlateProgressState(schedule: MlbSchedule, completedStarts = 0, now = new Date()): SlateProgressState {
  const countableGames = schedule.games.filter((game) => normalizeScheduleStatus(game) !== "ppd");
  const liveGames = countableGames.filter((game) => normalizeScheduleStatus(game) === "live").length;
  const finalGames = countableGames.filter((game) => normalizeScheduleStatus(game) === "final").length;
  const delayedGames = countableGames.filter((game) => normalizeScheduleStatus(game) === "delayed").length;
  const totalGames = countableGames.length;
  const totalStarts = totalGames * 2;
  const completedStartCount = Math.min(totalStarts, Math.max(0, completedStarts));
  const completedStartsInFinalGames = Math.min(finalGames * 2, completedStartCount);
  const completedStartsInLiveGames = Math.min(liveGames * 2, Math.max(0, completedStartCount - completedStartsInFinalGames));
  const liveStartCount = Math.max(0, liveGames * 2 - completedStartsInLiveGames);
  const firstPitchAt = resolveFirstPitchAt(countableGames);

  if (totalGames === 0) {
    return {
      date: schedule.date,
      state: "no-games",
      totalGames,
      liveGames,
      finalGames,
      totalStarts,
      completedStarts: 0,
      liveStarts: 0,
      firstPitchAt,
      countdownLabel: null,
    };
  }

  if (completedStartCount >= totalStarts) {
    return {
      date: schedule.date,
      state: "all-starts-complete",
      totalGames,
      liveGames,
      finalGames,
      totalStarts,
      completedStarts: completedStartCount,
      liveStarts: 0,
      firstPitchAt,
      countdownLabel: null,
    };
  }

  if (finalGames >= totalGames && totalGames > 0) {
    return {
      date: schedule.date,
      state: "reconciling",
      totalGames,
      liveGames,
      finalGames,
      totalStarts,
      completedStarts: completedStartCount,
      liveStarts: 0,
      firstPitchAt,
      countdownLabel: null,
    };
  }

  if (completedStartCount > 0 || liveGames > 0 || finalGames > 0) {
    return {
      date: schedule.date,
      state: "starts-in-progress",
      totalGames,
      liveGames,
      finalGames,
      totalStarts,
      completedStarts: completedStartCount,
      liveStarts: liveStartCount,
      firstPitchAt,
      countdownLabel: null,
    };
  }

  return {
    date: schedule.date,
    state: "pre-first-pitch",
    totalGames,
    liveGames,
    finalGames,
    totalStarts,
    completedStarts: completedStartCount,
    liveStarts: liveStartCount,
    firstPitchAt,
    countdownLabel: firstPitchAt ? formatFirstPitchCountdown(new Date(firstPitchAt).getTime() - now.getTime(), delayedGames > 0) : "STARTING SOON",
  };
}

export function formatSlateStatusLine(state: SlateProgressState) {
  const dateLabel = formatStatusDate(state.date);
  const todayDateLabel = `Today · ${dateLabel}`;

  if (state.state === "no-games") return `${dateLabel} · no games today`;
  if (state.state === "all-starts-complete") return `${todayDateLabel} · all ${state.totalStarts} starts final`;
  if (state.state === "reconciling") return `${todayDateLabel} · ${state.completedStarts} of ${state.totalStarts} starts final`;
  if (state.state === "starts-in-progress" && state.liveStarts > 0) return `Today · ${state.liveStarts} live · ${state.completedStarts} of ${state.totalStarts} starts final`;
  if (state.state === "starts-in-progress") return `${todayDateLabel} · ${state.completedStarts} of ${state.totalStarts} starts final`;

  const countdown = state.countdownLabel === "STARTING SOON"
    ? "Starting soon"
    : state.countdownLabel === "DELAYED"
      ? "Delayed"
      : `in ${state.countdownLabel}`;
  return `${todayDateLabel} · First starter toes the slab ${countdown}`;
}

export function formatFirstPitchCountdown(durationMs: number, delayed = false) {
  if (durationMs < 0 && delayed) return "DELAYED";
  if (durationMs <= 60 * 1000) return "STARTING SOON";

  const totalMinutes = Math.max(0, Math.ceil(durationMs / 60000));
  if (totalMinutes < 60) return `${totalMinutes} ${pluralizeTimeUnit(totalMinutes, "minute", "minutes")}`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hourLabel = pluralizeTimeUnit(hours, "Hour", "Hours");
  if (minutes === 0) return `${hours} ${hourLabel}`;
  return `${hours} ${hourLabel} ${minutes} ${pluralizeTimeUnit(minutes, "minute", "minutes")}`;
}

export function normalizeScheduleStatus(game: MlbSchedule["games"][number]): NormalizedScheduleStatus {
  const status = `${game.status} ${game.detailedState}`.toLowerCase();
  if (/\b(postponed|cancelled|canceled|ppd)\b/.test(status)) return "ppd";
  if (/\b(final|game over|completed early)\b/.test(status)) return "final";
  if (/\b(suspended)\b/.test(status)) return "suspended";
  if (/\b(delayed)\b/.test(status)) return "delayed";
  if (/\b(live|in progress|manager challenge)\b/.test(status)) return "live";
  return "pregame";
}

function resolveFirstPitchAt(games: MlbSchedule["games"]) {
  const firstPitch = games
    .map((game) => ({ iso: game.gameDate, ms: new Date(game.gameDate).getTime() }))
    .filter((game) => Number.isFinite(game.ms))
    .sort((a, b) => a.ms - b.ms)[0];

  return firstPitch?.iso ?? null;
}

function formatStatusDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function pluralizeTimeUnit(value: number, singular: string, plural: string) {
  return value === 1 ? singular : plural;
}
