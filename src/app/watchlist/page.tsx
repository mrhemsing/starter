import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { FollowPitcherButton } from "@/components/follow-pitcher-button";
import { FormSparkline, TrendChip, tierLabel, tierTextClass } from "@/components/form-visuals";
import { PitcherChip } from "@/components/pitcher-chip";
import { SiteNav } from "@/components/site-nav";
import { WATCHLIST_COOKIE, getWatchlistView, type WatchlistEntry } from "@/lib/data/watchlist-service";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { formatStartLine } from "@/lib/format";
import { heatCheckPath, pitcherPath, upcomingDateHref } from "@/lib/routes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Watchlist",
  description: "Follow MLB starting pitchers and see their current form, next starts, and daily digest events.",
  alternates: { canonical: "/watchlist" },
  robots: {
    index: false,
    follow: true,
    googleBot: {
      index: false,
      follow: true,
    },
  },
};

export default async function WatchlistPage() {
  const today = getHomeSlateDate();
  const rankedDate = addDays(today, -1);
  const accountId = (await cookies()).get(WATCHLIST_COOKIE)?.value ?? null;
  const watchlist = await getWatchlistView(accountId);

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-white/10 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">Toe the Slab</Link>
            <SiteNav active="watchlist" today={today} rankedDate={rankedDate} />
          </div>
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.22em] text-zinc-500">Daily ritual</p>
          <h1 className="mt-2 font-serif text-5xl font-black text-zinc-50">Watchlist</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Follow starters from Heat Check or pitcher pages. This view joins your followed arms to current Form, next scheduled start, and digest-worthy events.
          </p>
          <div className="mt-5 grid gap-3 font-mono text-xs sm:grid-cols-3">
            <SummaryStat label="Followed" value={String(watchlist.entries.length)} />
            <SummaryStat label="Digest events" value={String(watchlist.digestEvents.length)} />
            <SummaryStat label="Delivery" value="Preview only" />
          </div>
        </header>

        <section className="grid gap-5 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            {watchlist.entries.length === 0 ? (
              <div className="rounded border border-white/10 bg-[#101014] p-6">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-300">No followed pitchers yet</p>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  Start from Heat Check or any pitcher page and tap Follow. The account is a low-friction browser-based watchlist for now.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 font-mono text-xs uppercase tracking-[0.14em]">
                  <Link href={heatCheckPath()} className="inline-flex min-h-11 items-center rounded border border-amber-300/40 px-3 text-amber-300">Browse Heat Check</Link>
                  <Link href={upcomingDateHref(today)} className="inline-flex min-h-11 items-center rounded border border-white/10 px-3 text-zinc-300">Tonight&apos;s starters</Link>
                </div>
              </div>
            ) : (
              <div className="grid gap-3" data-responsive-check="watchlist-rows">
                {watchlist.entries.map((entry) => <WatchlistRow key={entry.pitcherId} entry={entry} />)}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <section className="rounded border border-white/10 bg-[#101014] p-4" data-responsive-check="digest-preview">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Digest preview</p>
              <h2 className="mt-2 font-serif text-3xl font-bold text-zinc-50">Today&apos;s hooks</h2>
              {watchlist.digestEvents.length === 0 ? (
                <p className="mt-3 text-sm leading-6 text-zinc-400">No starting-soon, rising, or rough-last-start events for your followed pitchers yet.</p>
              ) : (
                <div className="mt-4 grid gap-2">
                  {watchlist.digestEvents.slice(0, 8).map((event) => (
                    <Link key={`${event.pitcherId}-${event.key}`} href={pitcherPath(event.pitcherId)} className="rounded border border-white/10 bg-black/20 p-3 transition hover:border-amber-300/40">
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber-300">{event.label}</p>
                      <p className="mt-1 text-sm font-semibold text-zinc-100">{event.pitcherName}</p>
                      <p className="mt-1 text-xs text-zinc-500">{event.detail}</p>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded border border-white/10 bg-[#101014] p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Delivery status</p>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Email and push are not configured yet. The event engine is live here first so the provider decision can stay separate from the follow-list data model.
              </p>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function WatchlistRow({ entry }: { entry: WatchlistEntry }) {
  const lastLine = entry.lastStart
    ? `Last GS+ ${entry.lastStart.gsPlus} vs ${entry.lastStart.opp} / ${formatStartLine({ inningsPitched: entry.lastStart.ip, hits: entry.lastStart.h, earnedRuns: entry.lastStart.er, walks: entry.lastStart.bb, strikeouts: entry.lastStart.k, pitches: 0 })}`
    : "Last start unavailable";

  return (
    <article className="grid gap-3 rounded border border-white/10 bg-[#101014] p-4 sm:grid-cols-[minmax(0,1fr)_130px] lg:grid-cols-[minmax(0,1fr)_150px_170px]">
      <PitcherChip
        pitcherId={entry.pitcherId}
        name={entry.name}
        team={`${entry.team} / ${tierLabel(entry.tier)} / ${entry.windowCount} starts`}
        href={pitcherPath(entry.pitcherId)}
        size="md"
      >
        <p className="truncate text-xs text-zinc-500">{lastLine}</p>
        <p className="mt-2 font-mono text-xs text-zinc-300">{entry.nextStart ? `Next ${entry.nextStart.side === "away" ? "@" : "vs"} ${entry.nextStart.opponent} / ${formatShortDate(entry.nextStart.date)}` : "Next start TBD"}</p>
      </PitcherChip>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">Form</p>
        <p className={`font-serif text-5xl font-bold leading-none ${tierTextClass(entry.tier)}`}>{Math.round(entry.rgs)}</p>
        <div className="mt-2"><TrendChip summary={entry} compact /></div>
      </div>
      <div className="space-y-3">
        <FormSparkline values={entry.spark} tier={entry.tier} leagueMeanGS={entry.bgs} label={`${entry.name} recent form GS+: ${entry.spark.join(", ")}`} />
        <FollowPitcherButton pitcherId={entry.pitcherId} pitcherName={entry.name} initialFollowing compact />
      </div>
    </article>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-[#101014] p-3">
      <p className="text-zinc-50">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
    </div>
  );
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatShortDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(parsed);
}
