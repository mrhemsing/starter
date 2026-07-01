import type { Metadata } from "next";
import { LiveScoreboard } from "@/components/live-scoreboard";
import { SiteHeader } from "@/components/site-header";
import { getLiveScoreboard } from "@/lib/data/live-scoreboard-service";
import { getHomeSlateDate, getSlateStartProgress } from "@/lib/data/start-service";

type LivePageProps = {
  params: Promise<{
    date: string;
  }>;
};

export async function generateMetadata({ params }: LivePageProps): Promise<Metadata> {
  const { date } = await params;
  return {
    title: `Live GS+ Scoreboard · ${formatPageDate(date)} · Toe the Slab`,
    description: "Live provisional GS+ scores for today's starting pitchers while games are in progress.",
  };
}

export default async function LivePage({ params }: LivePageProps) {
  const { date } = await params;
  const today = getHomeSlateDate();
  const [board, slateProgress] = await Promise.all([
    getLiveScoreboard({ date }),
    getSlateStartProgress({ window: "today", date }),
  ]);
  const slateComplete = board.hasGames && board.totalStarts > 0 && board.finalStarts === board.totalStarts;
  const pregame = board.hasGames && board.finalStarts === 0 && board.liveStarts === 0 && board.delayStarts === 0;
  const boardTitle = board.hasActiveStarts ? "Live GS+ Scoreboard" : "Daily GS+ Scoreboard";
  const boardDescription = slateComplete
    ? "This slate is final. Full tiers, filters, and breakdowns live on Ranked Starts."
    : pregame
      ? "The scoreboard wakes up at first pitch. Preview tonight's matchups on Upcoming."
      : "Once a starter throws, the number goes live and provisional. Final lines settle when he exits.";
  const livePageClassName = board.hasActiveStarts
    ? "min-h-screen overflow-x-hidden bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8"
    : "live-non-live-page min-h-screen overflow-x-hidden bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8";

  return (
    <main className={livePageClassName}>
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <SiteHeader active="live" today={today} />
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#FF9A62]">
                {board.hasActiveStarts ? "Live board" : "Daily board"}
              </p>
              <h1 className="mt-2 font-serif text-4xl font-black tracking-normal text-zinc-50 sm:text-6xl">{boardTitle}</h1>
            </div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">{formatPageDate(date)}</p>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-zinc-400">
            {boardDescription}
          </p>
        </section>
        <LiveScoreboard initialBoard={board} initialSlateProgress={slateProgress} />
      </div>
    </main>
  );
}

function formatPageDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(parsed);
}
