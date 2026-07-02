import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { DATA_CHANGE_CACHE_TAGS } from "@/lib/data/cache-tags";
import { warmFormLeaderboards } from "@/lib/data/form-service";
import { getRankedHome } from "@/lib/data/home-ranked-service";
import { getDailySlate, getHomeSlateDate, getRankedSlateCompletionState } from "@/lib/data/start-service";
import { getTonightMustWatch } from "@/lib/data/tonight-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WARM_BATCH_SIZE = 8;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = getHomeSlateDate();
  const startedAt = new Date();
  console.log("warm-live-starts start", { date: today, batchSize: WARM_BATCH_SIZE, startedAt: startedAt.toISOString() });
  const [tonight, completion] = await Promise.all([
    getTonightMustWatch({ date: today, window: 5 }),
    getRankedSlateCompletionState(today, today),
  ]);
  const liveGames = tonight.games.filter((game) => game.status === "live").length;
  const activeGames = liveGames + completion.finalGames;

  if (activeGames === 0) {
    console.log("warm-live-starts end", { date: today, warmed: false, reason: "no-live-or-final-games" });
    return NextResponse.json({
      warmed: false,
      date: today,
      reason: "no-live-or-final-games",
      liveGames,
      finalGames: completion.finalGames,
      totalGames: completion.totalGames,
    });
  }

  const starts = await getDailySlate({ window: "today", date: today });
  const completedStarts = starts.filter((start) => start.source?.line !== "fixture");
  const slateTeams = uniqueValues([
    ...tonight.games.flatMap((game) => [game.away, game.home]),
    ...completedStarts.map((start) => start.pitcher.team),
  ]);

  if (completedStarts.length > 0) {
    for (const tag of DATA_CHANGE_CACHE_TAGS) {
      revalidateTag(tag, "max");
    }
    revalidatePath("/");
    revalidatePath("/heat-check");
    revalidatePath(`/starts/${today}`);
    const pitcherIds = uniqueValues(completedStarts.map((start) => start.pitcher.id));
    for (const batch of batchItems(pitcherIds, WARM_BATCH_SIZE)) {
      for (const pitcherId of batch) {
        revalidatePath(`/pitchers/${pitcherId}/form`);
      }
      console.log("warm-live-starts batch revalidated pitcher forms", { date: today, count: batch.length });
    }
  }

  await warmFormLeaderboards();
  console.log("warm-live-starts batch warmed global form leaderboards", { date: today });
  for (const batch of batchItems(slateTeams, WARM_BATCH_SIZE)) {
    await warmFormLeaderboards({ teams: batch, includeGlobal: false });
    console.log("warm-live-starts batch warmed form leaderboards", { date: today, teams: batch.length });
  }

  const rankedHome = await getRankedHome();
  const topPerformer = rankedHome.topPerformer;
  const finishedAt = new Date();
  console.log("warm-live-starts end", {
    date: today,
    warmed: true,
    completedStarts: completedStarts.length,
    teams: slateTeams.length,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
  });

  return NextResponse.json({
    warmed: true,
    date: today,
    liveGames,
    finalGames: completion.finalGames,
    totalGames: completion.totalGames,
    completedStarts: completedStarts.length,
    affectedPitchers: new Set(completedStarts.map((start) => start.pitcher.id)).size,
    warmedTeams: slateTeams.length,
    topPerformer: topPerformer
      ? {
          startId: topPerformer.start.id,
          pitcherName: topPerformer.start.pitcher.name,
          imageSource: topPerformer.image?.source ?? null,
        }
      : null,
    revalidated: completedStarts.length > 0,
    generatedAt: new Date().toISOString(),
  });
}

function isAuthorizedCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
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
