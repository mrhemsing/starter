import { unstable_cache } from "next/cache";
import { getLiveScoreboard, type LiveScoreboard } from "@/lib/data/live-scoreboard-service";
import { getArchivedSlateStarts, getDailySlate, getHomeSlateDate, getRankedSlateCompletionState, getSlateStartProgress, getStartDetail } from "@/lib/data/start-service";
import { resolveTopPerformerImage, type TopPerformerImage } from "@/lib/data/top-performer-image-service";
import { liveDateHref } from "@/lib/routes";
import { isRankedRegularStart } from "@/lib/start-classification";
import type { PitchEvent, StartSummary } from "@/lib/types";

const LIVE_TOP_PERFORMER_FLOOR = 50;
export const HOME_RANKED_REVALIDATE_SECONDS = 60;

export type RankedHomeResponse = {
  date: string;
  label: string;
  starts: StartSummary[];
  topPerformer: TopPerformerPayload | null;
};

type TopPerformerState = {
  status: "final" | "live" | "previous";
  start: StartSummary;
  slateCount: number;
  dateLabel: string;
  href?: string;
};

type TopPerformerPayload = TopPerformerState & {
  image: TopPerformerImage | null;
  metrics: {
    topVelo: number | null;
    whiffRate: number | null;
    veloSparkline: number[];
  } | null;
};

const getCachedRankedHome = unstable_cache(
  async (today: string) => buildRankedHome(today),
  ["home-ranked", "v4"],
  { revalidate: HOME_RANKED_REVALIDATE_SECONDS },
);

export async function getRankedHome(): Promise<RankedHomeResponse> {
  return getCachedRankedHome(getHomeSlateDate());
}

async function buildRankedHome(today: string): Promise<RankedHomeResponse> {
  const yesterday = addDays(today, -1);
  const [todayCompletion, slateProgress] = await Promise.all([
    getRankedSlateCompletionState(today, today),
    getSlateStartProgress({ window: "today", date: today }),
  ]);
  const isTodaySlateStarted = slateProgress.state !== "pre-first-pitch" && slateProgress.state !== "no-games";
  const todaySlateStarts = todayCompletion.completedStarts > 0 || isTodaySlateStarted ? await getDailySlate({ window: "today", date: today }) : [];
  const liveBoard = slateProgress.state === "starts-in-progress" ? await getLiveScoreboard({ date: today }) : null;
  const yesterdayArchivedSlateStarts = await getArchivedSlateStarts(yesterday);
  const yesterdaySlateStarts = yesterdayArchivedSlateStarts.length > 0 ? yesterdayArchivedSlateStarts : await getDailySlate({ window: "yesterday", date: yesterday });
  const todayCompletedSlateStarts = todaySlateStarts.filter(isCompletedRankedStart);
  const useTodaySlate = todayCompletedSlateStarts.length > 0;
  const slateStarts = useTodaySlate ? todaySlateStarts : yesterdaySlateStarts;
  const rankedDate = useTodaySlate ? today : yesterday;
  const rankedLabel = useTodaySlate ? "Today" : formatWeekday(yesterday);
  const topPerformerState = resolveTopPerformerState({
    today,
    yesterday,
    isTodaySlateStarted,
    areTodayStartsComplete: slateProgress.state === "all-starts-complete",
    liveBoard,
    todaySlateStarts,
    todayCompletedSlateStarts,
    yesterdaySlateStarts,
  });
  const topPerformer = await resolveTopPerformerPayload(topPerformerState);

  return {
    date: rankedDate,
    label: rankedLabel,
    starts: slateStarts,
    topPerformer,
  };
}

async function resolveTopPerformerPayload(state: TopPerformerState | null): Promise<TopPerformerPayload | null> {
  if (!state) return null;

  const [image, metrics] = await Promise.all([
    resolveTopPerformerImage(state.start, null),
    resolveTopPerformerMetrics(state.start),
  ]);

  return { ...state, image, metrics };
}

async function resolveTopPerformerMetrics(start: StartSummary | null) {
  if (!start) return null;

  const detail = await getStartDetail(start.id);
  if (!detail || detail.pitchEvents.length === 0) return null;

  const velocityTrend = detail.velocityTrend ?? [];
  const velocities = detail.pitchEvents.map((pitch) => pitch.velocityMph).filter((velocity) => Number.isFinite(velocity));
  const swings = detail.pitchEvents.filter(isSwing).length;
  const whiffs = detail.pitchEvents.filter((pitch) => pitch.result === "swinging_strike").length;

  return {
    topVelo: velocities.length > 0 ? Math.max(...velocities) : null,
    whiffRate: swings > 0 ? (whiffs / swings) * 100 : null,
    veloSparkline: velocityTrend.map((inning) => inning.avgVelocityMph),
  };
}

function isSwing(pitch: PitchEvent) {
  return pitch.result === "swinging_strike" || pitch.result === "foul" || pitch.result === "hit_into_play";
}

function resolveTopPerformerState({
  today,
  yesterday,
  isTodaySlateStarted,
  areTodayStartsComplete,
  liveBoard,
  todaySlateStarts,
  todayCompletedSlateStarts,
  yesterdaySlateStarts,
}: {
  today: string;
  yesterday: string;
  isTodaySlateStarted: boolean;
  areTodayStartsComplete: boolean;
  liveBoard: LiveScoreboard | null;
  todaySlateStarts: StartSummary[];
  todayCompletedSlateStarts: StartSummary[];
  yesterdaySlateStarts: StartSummary[];
}) {
  const todayLeader = todayCompletedSlateStarts[0] ?? null;

  if (areTodayStartsComplete) {
    if (!todayLeader) return null;
    return {
      status: "final" as const,
      start: todayLeader,
      slateCount: todayCompletedSlateStarts.length,
      dateLabel: formatLongDate(today),
    };
  }

  const liveLeader = resolveLiveLeaderStart(liveBoard, todaySlateStarts);
  if (liveLeader) {
    return {
      status: "live" as const,
      start: liveLeader,
      slateCount: liveBoard?.totalStarts ?? todaySlateStarts.length,
      dateLabel: formatLongDate(today),
      href: liveDateHref(today),
    };
  }

  if (isTodaySlateStarted) {
    if (!todayLeader || todayLeader.gameScorePlus < LIVE_TOP_PERFORMER_FLOOR) return null;
    return {
      status: "live" as const,
      start: todayLeader,
      slateCount: todayCompletedSlateStarts.length,
      dateLabel: formatLongDate(today),
    };
  }

  const yesterdayRankedStarts = yesterdaySlateStarts.filter(isCompletedRankedStart);
  const yesterdayLeader = yesterdayRankedStarts[0] ?? null;
  if (!yesterdayLeader) return null;
  return {
    status: "previous" as const,
    start: yesterdayLeader,
    slateCount: yesterdayRankedStarts.length,
    dateLabel: `Yesterday · ${formatLongDate(yesterday)}`,
  };
}

function resolveLiveLeaderStart(liveBoard: LiveScoreboard | null, todaySlateStarts: StartSummary[]) {
  const leader = liveBoard?.leader;
  if (!leader || !liveBoard?.hasActiveStarts || leader.gsPlus === null) return null;

  const baseline = todaySlateStarts.find((start) => start.id === leader.startId);
  if (!baseline) return null;

  return {
    ...baseline,
    line: leader.line,
    gameScorePlus: leader.gsPlus,
    source: {
      schedule: baseline.source?.schedule ?? "live",
      line: "live-gamefeed" as const,
      ranking: "schedule-derived-gamefeed-line" as const,
    },
  };
}

function isCompletedRankedStart(start: StartSummary) {
  return start.source?.line !== "fixture" && isRankedRegularStart(start);
}

function formatLongDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function formatWeekday(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "UTC",
  }).format(parsed);
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
