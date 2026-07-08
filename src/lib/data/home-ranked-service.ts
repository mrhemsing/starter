import { unstable_cache } from "next/cache";
import { HOME_RANKED_CACHE_TAG, RANKED_STARTS_CACHE_TAG, SLATE_CACHE_TAG } from "@/lib/data/cache-tags";
import { resolveFeaturedStartHighlight } from "@/lib/data/featured-highlight-service";
import { getLiveScoreboard, type LiveScoreboard, type LiveScoreboardRow } from "@/lib/data/live-scoreboard-service";
import { getDailySlate, getHomeSlateDate, getRankedSlateCompletionState, getSlateStartProgress } from "@/lib/data/start-service";
import { resolveTopPerformerImage, type TopPerformerImage } from "@/lib/data/top-performer-image-service";
import { resolveTopPerformerMetrics, type TopPerformerMetrics } from "@/lib/data/top-performer-metrics";
import { HOME_LIVE_LEADER_FLOOR, HOME_LIVE_LEADER_MIN_INNINGS, resolveHomeLiveLeaderRow } from "@/lib/home-live-leader";
import { inningsFromIP } from "@/lib/innings";
import { liveDateHref } from "@/lib/routes";
import { isRankedRegularStart } from "@/lib/start-classification";
import type { FeaturedStartHighlight, StartSummary } from "@/lib/types";

export const HOME_RANKED_REVALIDATE_SECONDS = 60;

export type RankedHomeResponse = {
  date: string;
  label: string;
  starts: StartSummary[];
  areTodayStartsComplete: boolean;
  topPerformer: TopPerformerPayload | null;
  liveLeaderboard: LiveLeaderboardEntry[] | null;
};

export type LiveLeaderboardEntry = {
  id: string;
  pitcherLastName: string;
  team: string;
  score: number;
  href: string;
};

type TopPerformerState = {
  status: "final" | "live" | "previous";
  start: StartSummary;
  slateCount: number;
  dateLabel: string;
  scoreStatusLabel: "PROV" | null;
  href?: string;
};

type TopPerformerPayload = TopPerformerState & {
  image: TopPerformerImage | null;
  highlight: FeaturedStartHighlight | null;
  metrics: TopPerformerMetrics | null;
};

const getCachedRankedHome = unstable_cache(
  async (today: string) => buildRankedHome(today),
  ["home-ranked", "v18"],
  { revalidate: HOME_RANKED_REVALIDATE_SECONDS, tags: [HOME_RANKED_CACHE_TAG, RANKED_STARTS_CACHE_TAG, SLATE_CACHE_TAG] },
);

export async function getRankedHome(): Promise<RankedHomeResponse> {
  return getCachedRankedHome(getHomeSlateDate());
}

async function buildRankedHome(today: string): Promise<RankedHomeResponse> {
  const [todayCompletion, slateProgress] = await Promise.all([
    getRankedSlateCompletionState(today, today),
    getSlateStartProgress({ window: "today", date: today }),
  ]);
  const isTodaySlateStarted = slateProgress.state !== "pre-first-pitch" && slateProgress.state !== "no-games";
  const todaySlateStarts = todayCompletion.completedStarts > 0 || isTodaySlateStarted ? await getDailySlate({ window: "today", date: today }) : [];
  const liveBoard = slateProgress.state === "starts-in-progress" ? await getLiveScoreboard({ date: today }) : null;
  const areTodayStartsComplete = slateProgress.state === "all-starts-complete";
  const todayCompletedSlateStarts = todaySlateStarts.filter(isCompletedRankedStart);
  const topPerformerState = resolveTopPerformerState({
    today,
    isTodaySlateStarted,
    areTodayStartsComplete,
    liveBoard,
    todaySlateStarts,
    todayCompletedSlateStarts,
  });
  const topPerformer = await resolveTopPerformerPayload(topPerformerState);
  const liveLeaderboard = topPerformer?.status === "live" ? null : resolveLiveLeaderboard(liveBoard);

  return {
    date: today,
    label: "Today",
    starts: todaySlateStarts,
    areTodayStartsComplete,
    topPerformer,
    liveLeaderboard,
  };
}

async function resolveTopPerformerPayload(state: TopPerformerState | null): Promise<TopPerformerPayload | null> {
  if (!state) return null;

  const [highlight, image, metrics] = await Promise.all([
    resolveFeaturedStartHighlight(state.start),
    resolveTopPerformerImage(state.start, null),
    resolveTopPerformerMetrics(state.start),
  ]);

  return { ...state, highlight, image, metrics };
}

function resolveTopPerformerState({
  today,
  isTodaySlateStarted,
  areTodayStartsComplete,
  liveBoard,
  todaySlateStarts,
  todayCompletedSlateStarts,
}: {
  today: string;
  isTodaySlateStarted: boolean;
  areTodayStartsComplete: boolean;
  liveBoard: LiveScoreboard | null;
  todaySlateStarts: StartSummary[];
  todayCompletedSlateStarts: StartSummary[];
}) {
  const todayLeader = todayCompletedSlateStarts[0] ?? null;

  if (areTodayStartsComplete) {
    if (!todayLeader) return null;
    return {
      status: "final" as const,
      start: todayLeader,
      slateCount: todayCompletedSlateStarts.length,
      dateLabel: formatLongDate(today),
      scoreStatusLabel: null,
    };
  }

  const liveLeader = resolveLiveLeaderStart(liveBoard, todaySlateStarts);
  if (liveLeader) {
    return {
      status: "live" as const,
      start: liveLeader,
      slateCount: liveBoard?.totalStarts ?? todaySlateStarts.length,
      dateLabel: formatLongDate(today),
      scoreStatusLabel: liveLeader.scoreStatusLabel,
      href: liveDateHref(today),
    };
  }

  if (isTodaySlateStarted) {
    if (!todayLeader || !isLiveTopPerformerEligibleStart(todayLeader)) return null;
    return {
      status: "live" as const,
      start: todayLeader,
      slateCount: todayCompletedSlateStarts.length,
      dateLabel: formatLongDate(today),
      scoreStatusLabel: null,
    };
  }
  return null;
}

function resolveLiveLeaderStart(liveBoard: LiveScoreboard | null, todaySlateStarts: StartSummary[]) {
  const leader = resolveHomeLiveLeaderRow(liveBoard);
  if (!leader || leader.gsPlus === null) return null;

  const baseline = todaySlateStarts.find((start) => start.id === leader.startId);
  if (!baseline) return null;

  return {
    ...baseline,
    line: leader.line,
    gameScorePlus: leader.gsPlus,
    scoreStatusLabel: leader.scoreLabel === "PROV" ? "PROV" as const : null,
    source: {
      schedule: baseline.source?.schedule ?? "live",
      line: "live-gamefeed" as const,
      ranking: "schedule-derived-gamefeed-line" as const,
    },
  };
}

function resolveLiveLeaderboard(liveBoard: LiveScoreboard | null): LiveLeaderboardEntry[] | null {
  if (!liveBoard?.hasActiveStarts) return null;

  const leaders = liveBoard.rows.filter(isLiveLeaderboardRow).slice(0, 5).map((row) => ({
    id: row.id,
    pitcherLastName: lastName(row.pitcherName),
    team: row.team,
    score: row.gsPlus ?? 0,
    href: row.liveHref,
  }));

  return leaders.length > 0 ? leaders : null;
}

function isLiveLeaderboardRow(row: LiveScoreboardRow) {
  return row.scoreLabel !== "PROJ" && row.gsPlus !== null && row.outingStatus !== "short";
}

function isCompletedRankedStart(start: StartSummary) {
  return start.source?.line !== "fixture" && isRankedRegularStart(start);
}

function isLiveTopPerformerEligibleStart(start: StartSummary) {
  return start.gameScorePlus >= HOME_LIVE_LEADER_FLOOR && inningsFromIP(start.line.inningsPitched) >= HOME_LIVE_LEADER_MIN_INNINGS;
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

function lastName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.at(-1) ?? name;
}
