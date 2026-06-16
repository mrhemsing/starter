import { NextResponse } from "next/server";
import { getArchivedSlateStarts, getDailySlate, getHomeSlateDate, getRankedSlateCompletionState } from "@/lib/data/start-service";
import { resolveTopPerformerImage } from "@/lib/data/top-performer-image-service";
import type { StartSummary } from "@/lib/types";

const LIVE_TOP_PERFORMER_FLOOR = 58;

export async function GET() {
  const today = getHomeSlateDate();
  const yesterday = addDays(today, -1);
  const todayCompletion = await getRankedSlateCompletionState(today, today);
  const todaySlateStarts = todayCompletion.finalGames > 0 ? await getDailySlate({ window: "today", date: today }) : [];
  const yesterdayArchivedSlateStarts = await getArchivedSlateStarts(yesterday);
  const yesterdaySlateStarts = yesterdayArchivedSlateStarts.length > 0 ? yesterdayArchivedSlateStarts : await getDailySlate({ window: "yesterday", date: yesterday });
  const todayCompletedSlateStarts = todaySlateStarts.filter((start) => start.source?.line !== "fixture");
  const useTodaySlate = todayCompletedSlateStarts.length > 0;
  const slateStarts = useTodaySlate ? todaySlateStarts : yesterdaySlateStarts;
  const rankedDate = useTodaySlate ? today : yesterday;
  const rankedLabel = useTodaySlate ? "Today" : "Yesterday";
  const topPerformerState = resolveTopPerformerState({
    today,
    yesterday,
    todayCompletion,
    isTodaySlateStarted: todayCompletion.finalGames > 0,
    todayCompletedSlateStarts,
    yesterdaySlateStarts,
  });
  const topPerformerImage = await resolveTopPerformerImage(topPerformerState?.start ?? null, null);

  return NextResponse.json({
    date: rankedDate,
    label: rankedLabel,
    starts: slateStarts,
    topPerformer: topPerformerState ? { ...topPerformerState, image: topPerformerImage } : null,
  });
}

function resolveTopPerformerState({
  today,
  yesterday,
  todayCompletion,
  isTodaySlateStarted,
  todayCompletedSlateStarts,
  yesterdaySlateStarts,
}: {
  today: string;
  yesterday: string;
  todayCompletion: Awaited<ReturnType<typeof getRankedSlateCompletionState>>;
  isTodaySlateStarted: boolean;
  todayCompletedSlateStarts: StartSummary[];
  yesterdaySlateStarts: StartSummary[];
}) {
  const todayLeader = todayCompletedSlateStarts[0] ?? null;

  if (todayCompletion.isFinal) {
    if (!todayLeader) return null;
    return {
      status: "final" as const,
      start: todayLeader,
      slateCount: todayCompletedSlateStarts.length,
      dateLabel: `Final · ${formatLongDate(today)}`,
    };
  }

  if (isTodaySlateStarted) {
    if (!todayLeader || todayLeader.gameScorePlus < LIVE_TOP_PERFORMER_FLOOR) return null;
    return {
      status: "live" as const,
      start: todayLeader,
      slateCount: todayCompletedSlateStarts.length,
      dateLabel: `Live leader · ${todayCompletion.finalGames} of ${todayCompletion.totalGames} final`,
    };
  }

  const yesterdayLeader = yesterdaySlateStarts.filter((start) => start.source?.line !== "fixture")[0] ?? null;
  if (!yesterdayLeader) return null;
  return {
    status: "previous" as const,
    start: yesterdayLeader,
    slateCount: yesterdaySlateStarts.filter((start) => start.source?.line !== "fixture").length,
    dateLabel: `Last night · ${formatLongDate(yesterday)}`,
  };
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

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
