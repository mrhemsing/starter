import { DATA_CHANGE_CACHE_TAGS } from "@/lib/data/cache-tags";
import { warmFormLeaderboards } from "@/lib/data/form-service";
import { getRankedHome } from "@/lib/data/home-ranked-service";
import { getDailySlate, getHomeSlateDate, getRankedSlateCompletionState } from "@/lib/data/start-service";
import { getTonightMustWatch } from "@/lib/data/tonight-service";

export const WARM_LIVE_STARTS_BATCH_SIZE = 8;
const WARM_TEAM_FORM_ON_CRON_FLAG = "THE_BUMP_WARM_TEAM_FORM_ON_CRON";
type WarmLiveStartsRevalidators = {
  revalidatePath?: (path: string) => void;
  revalidateTag?: (tag: string, profile: "max") => void;
};

type WarmLiveStartsJobOptions = WarmLiveStartsRevalidators & {
  date?: string;
};

export type WarmLiveStartsJobResult = {
  warmed: boolean;
  date: string;
  reason?: "no-live-or-final-games";
  liveGames: number;
  finalGames: number;
  totalGames: number;
  completedStarts?: number;
  affectedPitchers?: number;
  warmedTeams?: number;
  deferredTeams?: number;
  teamBatches?: number;
  pitcherBatches?: number;
  topPerformer?: {
    startId: string;
    pitcherName: string;
    imageSource: string | null;
  } | null;
  revalidated?: boolean;
  durationMs?: number;
  generatedAt?: string;
};

export async function runWarmLiveStartsJob(options: WarmLiveStartsJobOptions = {}): Promise<WarmLiveStartsJobResult> {
  const date = warmLiveStartsDate(options.date);
  const startedAt = new Date();
  console.log("warm-live-starts start", { date, batchSize: WARM_LIVE_STARTS_BATCH_SIZE, startedAt: startedAt.toISOString() });
  const [tonight, completion] = await Promise.all([
    getTonightMustWatch({ date, window: 5 }),
    getRankedSlateCompletionState(date, getHomeSlateDate()),
  ]);
  const liveGames = tonight.games.filter((game) => game.status === "live").length;
  const activeGames = liveGames + completion.finalGames;

  if (activeGames === 0) {
    console.log("warm-live-starts end", { date, warmed: false, reason: "no-live-or-final-games" });
    return {
      warmed: false,
      date,
      reason: "no-live-or-final-games",
      liveGames,
      finalGames: completion.finalGames,
      totalGames: completion.totalGames,
    };
  }

  const starts = await getDailySlate({ window: "today", date });
  const completedStarts = starts.filter((start) => start.source?.line !== "fixture");
  const slateTeams = uniqueValues([
    ...tonight.games.flatMap((game) => [game.away, game.home]),
    ...completedStarts.map((start) => start.pitcher.team),
  ]);
  const pitcherIds = uniqueValues(completedStarts.map((start) => start.pitcher.id));
  let pitcherBatches = 0;

  if (completedStarts.length > 0) {
    for (const tag of DATA_CHANGE_CACHE_TAGS) {
      options.revalidateTag?.(tag, "max");
    }
    options.revalidatePath?.("/");
    options.revalidatePath?.("/heat-check");
    options.revalidatePath?.(`/starts/${date}`);
    for (const batch of batchItems(pitcherIds, WARM_LIVE_STARTS_BATCH_SIZE)) {
      for (const pitcherId of batch) {
        options.revalidatePath?.(`/pitchers/${pitcherId}/form`);
      }
      pitcherBatches += 1;
      console.log("warm-live-starts batch revalidated pitcher forms", { date, count: batch.length, batch: pitcherBatches });
    }
  }

  await warmFormLeaderboards();
  console.log("warm-live-starts batch warmed global form leaderboards", { date });
  let teamBatches = 0;
  if (shouldWarmTeamFormOnCron()) {
    for (const batch of batchItems(slateTeams, WARM_LIVE_STARTS_BATCH_SIZE)) {
      await warmFormLeaderboards({ teams: batch, includeGlobal: false });
      teamBatches += 1;
      console.log("warm-live-starts batch warmed form leaderboards", { date, teams: batch.length, batch: teamBatches });
    }
  } else {
    console.log("warm-live-starts team form warming deferred", { date, teams: slateTeams.length, flag: WARM_TEAM_FORM_ON_CRON_FLAG });
  }

  const rankedHome = await getRankedHome();
  const topPerformer = rankedHome.topPerformer;
  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  console.log("warm-live-starts end", {
    date,
    warmed: true,
    completedStarts: completedStarts.length,
    teams: slateTeams.length,
    durationMs,
    pitcherBatches,
    teamBatches,
  });

  return {
    warmed: true,
    date,
    liveGames,
    finalGames: completion.finalGames,
    totalGames: completion.totalGames,
    completedStarts: completedStarts.length,
    affectedPitchers: pitcherIds.length,
    warmedTeams: shouldWarmTeamFormOnCron() ? slateTeams.length : 0,
    deferredTeams: shouldWarmTeamFormOnCron() ? 0 : slateTeams.length,
    pitcherBatches,
    teamBatches,
    topPerformer: topPerformer
      ? {
          startId: topPerformer.start.id,
          pitcherName: topPerformer.start.pitcher.name,
          imageSource: topPerformer.image?.source ?? null,
        }
      : null,
    revalidated: completedStarts.length > 0,
    durationMs,
    generatedAt: finishedAt.toISOString(),
  };
}

function warmLiveStartsDate(dateOverride: string | undefined) {
  if (!process.env.VERCEL_ENV && dateOverride && /^\d{4}-\d{2}-\d{2}$/.test(dateOverride)) return dateOverride;
  return getHomeSlateDate();
}

function shouldWarmTeamFormOnCron() {
  return process.env[WARM_TEAM_FORM_ON_CRON_FLAG] === "1";
}

function uniqueValues<T>(values: T[]) {
  return [...new Set(values)];
}

function batchItems<T>(items: T[], batchSize: number) {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }
  return batches;
}
