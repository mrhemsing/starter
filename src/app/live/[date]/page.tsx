import type { Metadata } from "next";
import { LiveScoreboard } from "@/components/live-scoreboard";
import { SiteHeader } from "@/components/site-header";
import { getLiveScoreboard } from "@/lib/data/live-scoreboard-service";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { assertValidDateRouteParam } from "@/lib/route-date-response";

type LivePageProps = {
  params: Promise<{
    date: string;
  }>;
};

export async function generateMetadata({ params }: LivePageProps): Promise<Metadata> {
  const { date } = await params;
  assertValidDateRouteParam(date);
  return {
    title: `Live GS+ Scoreboard · ${formatPageDate(date)} · Toe the Slab`,
    description: "Live provisional GS+ scores for today's starting pitchers while games are in progress.",
  };
}

export default async function LivePage({ params }: LivePageProps) {
  const { date } = await params;
  assertValidDateRouteParam(date);
  const today = getHomeSlateDate();
  const board = await getLiveScoreboard({ date });
  const slateComplete = board.hasGames && board.totalStarts > 0 && board.finalStarts === board.totalStarts;
  const pregame = board.hasGames && board.finalStarts === 0 && board.liveStarts === 0 && board.warmingStarts === 0 && board.delayStarts === 0;
  const boardTitle = "Live GS+ Scoreboard";
  const boardDescription = slateComplete
    ? "This slate is final."
    : pregame
      ? ""
      : "Once a starter throws, the number goes live and provisional. Final lines settle when he exits.";
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <SiteHeader active="live" today={today} />
        <div className={pregame ? "space-y-2" : "space-y-6"}>
          <section className={pregame ? "space-y-3" : "space-y-4"}>
            <div>
              <div className="flex items-center justify-between gap-4">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#FF9A62]">Live board</p>
                <p className="shrink-0 font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">{formatPageDate(date)}</p>
              </div>
              <h1 className="mt-2 font-serif text-4xl font-black tracking-normal text-zinc-50 sm:text-6xl">{boardTitle}</h1>
            </div>
            {boardDescription ? <p className="max-w-3xl text-sm leading-6 text-zinc-400">{boardDescription}</p> : null}
          </section>
          <LiveScoreboard initialBoard={board} initialSlateProgress={board.slateProgress} />
        </div>
      </div>
    </main>
  );
}

function formatPageDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(parsed);
}
