import type { MlbSchedule } from "@/lib/types";

export type NormalizedScheduleStatus = "pregame" | "delayed" | "live" | "final" | "ppd" | "suspended";

export type SlateProgressStateKey = "pre-first-pitch" | "in-progress" | "partial-final" | "all-final" | "no-games";

export type SlateProgressState = {
  date: string;
  state: SlateProgressStateKey;
  totalGames: number;
  liveGames: number;
  finalGames: number;
  firstPitchAt: string | null;
  countdownLabel: string | null;
};

export function getSlateProgressState(schedule: MlbSchedule, now = new Date()): SlateProgressState {
  const countableGames = schedule.games.filter((game) => normalizeScheduleStatus(game) !== "ppd");
  const liveGames = countableGames.filter((game) => normalizeScheduleStatus(game) === "live").length;
  const finalGames = countableGames.filter((game) => normalizeScheduleStatus(game) === "final").length;
  const totalGames = countableGames.length;
  const firstPitchAt = resolveFirstPitchAt(countableGames);

  if (totalGames === 0) {
    return {
      date: schedule.date,
      state: "no-games",
      totalGames,
      liveGames,
      finalGames,
      firstPitchAt,
      countdownLabel: null,
    };
  }

  if (finalGames >= totalGames) {
    return {
      date: schedule.date,
      state: "all-final",
      totalGames,
      liveGames,
      finalGames,
      firstPitchAt,
      countdownLabel: null,
    };
  }

  if (finalGames > 0) {
    return {
      date: schedule.date,
      state: "partial-final",
      totalGames,
      liveGames,
      finalGames,
      firstPitchAt,
      countdownLabel: null,
    };
  }

  if (liveGames > 0) {
    return {
      date: schedule.date,
      state: "in-progress",
      totalGames,
      liveGames,
      finalGames,
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
    firstPitchAt,
    countdownLabel: firstPitchAt ? formatFirstPitchCountdown(new Date(firstPitchAt).getTime() - now.getTime()) : "SOON",
  };
}

export function formatSlateStatusLine(state: SlateProgressState) {
  const dateLabel = formatShortDate(state.date);

  if (state.state === "no-games") return `${dateLabel} · NO GAMES TODAY`;
  if (state.state === "all-final") return `TODAY · ${dateLabel} · ALL ${state.totalGames} FINAL`;
  if (state.state === "partial-final") return `TODAY · ${dateLabel} · ${state.finalGames} OF ${state.totalGames} GAMES FINAL`;
  if (state.state === "in-progress") return `TODAY · ${dateLabel} · ${state.liveGames} OF ${state.totalGames} IN PROGRESS`;

  const countdown = state.countdownLabel === "SOON" ? "SOON" : `IN ${state.countdownLabel}`;
  return `TODAY · ${dateLabel} · ${state.totalGames} GAMES · FIRST PITCH ${countdown}`;
}

export function formatFirstPitchCountdown(durationMs: number) {
  if (durationMs <= 5 * 60 * 1000) return "SOON";

  const totalMinutes = Math.max(0, Math.ceil(durationMs / 60000));
  if (totalMinutes < 60) return `${totalMinutes}M`;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}H ${minutes}M`;
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

function formatShortDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed).toUpperCase();
}
