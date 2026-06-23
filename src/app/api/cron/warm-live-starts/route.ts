import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { warmFormLeaderboards } from "@/lib/data/form-service";
import { getDailySlate, getHomeSlateDate, getRankedSlateCompletionState } from "@/lib/data/start-service";
import { getTonightMustWatch } from "@/lib/data/tonight-service";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = getHomeSlateDate();
  const [tonight, completion] = await Promise.all([
    getTonightMustWatch({ date: today, window: 5 }),
    getRankedSlateCompletionState(today, today),
  ]);
  const liveGames = tonight.games.filter((game) => game.status === "live").length;
  const activeGames = liveGames + completion.finalGames;

  if (activeGames === 0) {
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
  const slateTeams = [
    ...new Set([
      ...tonight.games.flatMap((game) => [game.away, game.home]),
      ...completedStarts.map((start) => start.pitcher.team),
    ]),
  ];

  if (completedStarts.length > 0) {
    revalidatePath("/");
    revalidatePath("/heat-check");
    revalidatePath(`/starts/${today}`);
    for (const pitcherId of new Set(completedStarts.map((start) => start.pitcher.id))) {
      revalidatePath(`/pitchers/${pitcherId}/form`);
    }
  }

  await warmFormLeaderboards({ teams: slateTeams });

  return NextResponse.json({
    warmed: true,
    date: today,
    liveGames,
    finalGames: completion.finalGames,
    totalGames: completion.totalGames,
    completedStarts: completedStarts.length,
    affectedPitchers: new Set(completedStarts.map((start) => start.pitcher.id)).size,
    warmedTeams: slateTeams.length,
    revalidated: completedStarts.length > 0,
    generatedAt: new Date().toISOString(),
  });
}

function isAuthorizedCronRequest(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}
