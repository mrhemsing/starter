import { RouteLoadingShell } from "@/components/route-loading-shell";
import { LiveScoreboardLoading } from "@/components/live-scoreboard";
import { getLiveScoreboard } from "@/lib/data/live-scoreboard-service";

export default async function Loading() {
  const board = await getLiveScoreboard();
  const slateComplete = board.hasGames && board.totalStarts > 0 && board.finalStarts === board.totalStarts;
  const pregame = board.hasGames && board.finalStarts === 0 && board.liveStarts === 0 && board.warmingStarts === 0 && board.delayStarts === 0;
  const title = slateComplete ? "Slate final" : "Live GS+ Scoreboard";
  const description = slateComplete
    ? "The slate recap is loading."
    : pregame
      ? "Pregame countdown and matchup preview are loading."
      : "Provisional GS+ rows stream in as the live board resolves.";

  return (
    <RouteLoadingShell route="live" active="live" eyebrow="Live board" title={title} description={description} layout="live" childrenMode="content">
      <LiveScoreboardLoading board={board} />
    </RouteLoadingShell>
  );
}
