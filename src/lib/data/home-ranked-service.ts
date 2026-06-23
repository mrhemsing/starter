import { unstable_cache } from "next/cache";
import { getArchivedSlateStarts, getDailySlate, getHomeSlateDate, getRankedSlateCompletionState, getSlateStartProgress, getStartDetail } from "@/lib/data/start-service";
import { resolveTopPerformerImage, type TopPerformerImage } from "@/lib/data/top-performer-image-service";
import { isRankedRegularStart } from "@/lib/start-classification";
import type { PitchEvent, StartSummary } from "@/lib/types";

const LIVE_TOP_PERFORMER_FLOOR = 58;
export const HOME_RANKED_REVALIDATE_SECONDS = 60;

export type RankedHomeResponse = {
  date: string;
  label: string;
  starts: StartSummary[];
  topPerformer: {
    status: "final" | "live" | "previous";
    start: StartSummary;
    slateCount: number;
    dateLabel: string;
    image: TopPerformerImage | null;
    metrics: {
      topVelo: number | null;
      whiffRate: number | null;
      veloSparkline: number[];
    } | null;
  } | null;
};

const getCachedRankedHome = unstable_cache(
  async (today: string) => buildRankedHome(today),
  ["home-ranked", "v1"],
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
  const todaySlateStarts = todayCompletion.completedStarts > 0 ? await getDailySlate({ window: "today", date: today }) : [];
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
    isTodaySlateStarted: slateProgress.state !== "pre-first-pitch" && slateProgress.state !== "no-games",
    areTodayStartsComplete: slateProgress.state === "all-starts-complete",
    todayCompletedSlateStarts,
    yesterdaySlateStarts,
  });
  const [topPerformerImage, topPerformerMetrics] = await Promise.all([
    resolveTopPerformerImage(topPerformerState?.start ?? null, null),
    resolveTopPerformerMetrics(topPerformerState?.start ?? null),
  ]);

  return {
    date: rankedDate,
    label: rankedLabel,
    starts: slateStarts,
    topPerformer: topPerformerState ? { ...topPerformerState, image: topPerformerImage, metrics: topPerformerMetrics } : null,
  };
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
  todayCompletedSlateStarts,
  yesterdaySlateStarts,
}: {
  today: string;
  yesterday: string;
  isTodaySlateStarted: boolean;
  areTodayStartsComplete: boolean;
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
