import type { Metadata } from "next";
import { LiveScoreboard } from "@/components/live-scoreboard";
import { SiteHeader } from "@/components/site-header";
import { getLiveScoreboard } from "@/lib/data/live-scoreboard-service";
import { getHomeSlateDate } from "@/lib/data/start-service";

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
  const board = await getLiveScoreboard({ date });

  return (
    <main className="min-h-screen bg-[#08080a] text-zinc-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <SiteHeader active="live" today={today} />
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#FF9A62]">
                {board.hasActiveStarts ? "Live board" : "Daily board"}
              </p>
              <h1 className="mt-2 font-serif text-4xl font-black tracking-normal text-zinc-50 sm:text-6xl">Live GS+ Scoreboard</h1>
            </div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">{formatPageDate(date)}</p>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-zinc-400">
            Provisional GS+ for starters as games are being played. Live rows move with the official gamefeed; Ranked Starts remains settled-only.
          </p>
        </section>
        <LiveScoreboard initialBoard={board} />
      </div>
    </main>
  );
}

function formatPageDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "UTC" }).format(parsed);
}
