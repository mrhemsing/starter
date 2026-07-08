import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { FollowPitcherButton } from "@/components/follow-pitcher-button";
import { FormSparkline, TrendChip, tierLabel, tierTextClass } from "@/components/form-visuals";
import { Headshot } from "@/components/headshot";
import { hasQualifiedFormSummarySample, LimitedSampleFormChip, LIMITED_SAMPLE_FORM_COLOR, LIMITED_SAMPLE_FORM_LABEL } from "@/components/limited-sample-form-chip";
import { PitcherAvailabilityNote } from "@/components/pitcher-availability";
import { SiteHeader } from "@/components/site-header";
import { WatchlistNextStartBlock } from "@/components/watchlist-next-start-block";
import { WatchlistSearchForm } from "@/components/watchlist-search-form";
import { WatchlistSuggestedFollows } from "@/components/watchlist-suggested-follows";
import { getFormLeaderboard } from "@/lib/data/form-service";
import { WATCHLIST_COOKIE, WATCHLIST_SOON_DAYS, getWatchlistView, type WatchlistEntry, type WatchlistLiveEntry, type WatchlistSort } from "@/lib/data/watchlist-service";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { HEAT_BANDS } from "@/lib/form-tokens";
import { formatStartLine } from "@/lib/format";
import { heatCheckPath, pitcherHref, sourceParams, upcomingDateHref } from "@/lib/routes";
import { slateTimeWordTitle } from "@/lib/time-words";
import type { FormSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Watchlist",
  description: "Follow MLB starting pitchers and see their current form, next starts, and Watchlist Wire events.",
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

type WatchlistPageProps = {
  searchParams?: Promise<{
    sort?: string;
    q?: string;
  }>;
};

const sortOptions: Array<{ key: WatchlistSort; label: string }> = [
  { key: "default", label: "Action" },
  { key: "form", label: "Form" },
  { key: "soonest", label: "Soonest start" },
  { key: "mover", label: "Biggest mover" },
];

export default async function WatchlistPage({ searchParams }: WatchlistPageProps) {
  const params = await searchParams;
  const query = (params?.q ?? "").trim();
  const today = getHomeSlateDate();
  const rankedDate = addDays(today, -1);
  const accountId = (await cookies()).get(WATCHLIST_COOKIE)?.value ?? null;
  const [watchlist, leaderboard] = await Promise.all([
    getWatchlistView(accountId, { sort: params?.sort }),
    getFormLeaderboard({ qualifiedOnly: false }),
  ]);
  const followedIds = new Set(watchlist.pitcherIds);
  const searchResults = buildSearchResults(leaderboard.pitchers, followedIds, query);

  return (
    <main className="min-h-screen bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="pb-6">
          <SiteHeader active="watchlist" today={today} rankedDate={rankedDate} />
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.22em] text-zinc-500">Daily ritual</p>
          <h1 className="mt-2 font-serif text-5xl font-black text-zinc-50">Watchlist</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            <span className="block">Follow starters from Heat Check or pitcher pages.</span>
            <span className="block lg:whitespace-nowrap">This view joins your followed arms to current Form, next scheduled start, and event-driven Wire notes.</span>
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2 font-mono text-xs sm:gap-3" data-responsive-check="watchlist-summary-stats">
            <SummaryStat label="Followed" value={String(watchlist.entries.length)} />
            <SummaryStat label="Digest events" value={String(watchlist.wireEvents.length)} />
            <SummaryStat label="Pitching now" value={String(watchlist.livePitchingNow.length)} />
          </div>
        </header>

        <section className="grid gap-5 py-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <PitchingNowStrip entries={watchlist.livePitchingNow} />
            <NextOnTheSlabModule entries={watchlist.pitchingSoon} />
            <section className="mb-4 rounded border border-white/10 bg-[#101014] p-4" data-responsive-check="watchlist-controls">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Sort</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {sortOptions.map((option) => (
                      <Link
                        key={option.key}
                        href={watchlistHref({ sort: option.key, q: query })}
                        className={`inline-flex min-h-10 items-center rounded border px-3 font-mono text-xs uppercase tracking-[0.14em] ${watchlist.sort === option.key ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 text-zinc-300 hover:border-amber-300/40"}`}
                      >
                        {option.label}
                      </Link>
                    ))}
                  </div>
                </div>
                <WatchlistSearchForm query={query} sort={watchlist.sort} />
              </div>
              <WatchlistSuggestedFollows results={searchResults} followedIds={[...followedIds]} query={query} />
            </section>

            {watchlist.entries.length === 0 ? (
              <div className="rounded border border-white/10 bg-[#101014] p-6">
                <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-300">No followed pitchers yet</p>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  Follow your first starter here. The watchlist tracks form, next starts, and daily hooks without sending you away from the page.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 font-mono text-xs uppercase tracking-[0.14em]">
                  <Link href={heatCheckPath()} className="inline-flex min-h-11 items-center rounded border border-amber-300/40 px-3 text-amber-300">Full Heat Check</Link>
                  <Link href={upcomingDateHref(today)} className="inline-flex min-h-11 items-center rounded border border-white/10 px-3 text-zinc-300">{slateTimeWordTitle({ date: today }, { today })}&apos;s starters</Link>
                </div>
              </div>
            ) : (
              <div className="grid gap-5" data-responsive-check="watchlist-rows" data-watchlist-sort={watchlist.sort}>
                {watchlist.sort === "default" ? (
                  <>
                    <WatchlistGroup title={watchlist.pitchingSoon.length === 0 ? "Followed arms" : "Everyone else"} detail="Sorted by Form descending" entries={watchlist.bench} />
                  </>
                ) : (
                  <WatchlistGroup title={sortOptions.find((option) => option.key === watchlist.sort)?.label ?? "Watchlist"} detail={`${watchlist.entries.length} followed pitchers`} entries={watchlist.entries} />
                )}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <section className="rounded border border-white/10 bg-[#101014] p-4" data-responsive-check="watchlist-wire">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Watchlist Wire</p>
              <h2 className="mt-2 font-serif text-3xl font-bold text-zinc-50">The Wire</h2>
              <p className="mt-1 text-sm text-zinc-500">News for your arms</p>
              {watchlist.wireEvents.length === 0 ? (
                <div className="mt-3 text-sm leading-6 text-zinc-400">
                  <p>Quiet stretch for your arms.</p>
                  <p className="mt-2 text-xs text-zinc-500">The Wire only shows event changes, not card fields repeated in another format.</p>
                </div>
              ) : (
                <div className="mt-4 grid gap-2">
                  {watchlist.wireEvents.slice(0, 10).map((event) => (
                    <WireEventCard key={`${event.pitcherId}-${event.key}-${event.sentence ?? event.headline?.url}`} event={event} />
                  ))}
                </div>
              )}
            </section>

          </aside>
        </section>
      </div>
    </main>
  );
}

function PitchingNowStrip({ entries }: { entries: WatchlistLiveEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <section className="mb-4 rounded border border-[#FF7A3D]/35 bg-[#FF7A3D]/[0.08] p-4" data-responsive-check="watchlist-pitching-now">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#FF7A3D]">Pitching now</p>
          <h2 className="mt-1 font-serif text-3xl font-bold text-zinc-50">Followed arms live</h2>
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">{entries.length} live</p>
      </div>
      <div className="mt-4 grid gap-2">
        {entries.map((entry) => (
          <Link key={`${entry.pitcherId}-${entry.liveStart.liveHref}`} href={entry.liveStart.liveHref} className="grid gap-3 rounded border border-white/10 bg-black/25 p-3 transition hover:border-[#FF7A3D]/50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <p className="truncate font-serif text-xl font-bold text-zinc-50">{entry.name}</p>
              <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-zinc-400">
                {entry.team} vs {entry.liveStart.opponent} · {entry.liveStart.inningLabel ?? "Live"} · {entry.liveStart.pitchCount ?? "--"} pitches
              </p>
              <p className="mt-1 text-xs text-zinc-500">{formatStartLine(entry.liveStart.line)}</p>
            </div>
            <div className="score-bug min-w-24 rounded border border-[#FF7A3D]/40 bg-[#FF7A3D] px-3 py-2 text-center text-zinc-950">
              <p className="font-serif text-4xl font-bold leading-none">{entry.liveStart.score === null ? "--" : Math.round(entry.liveStart.score)}</p>
              <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em]">{entry.liveStart.scoreLabel === "FINAL" ? "FINAL" : "PROV"} GS+</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function WireEventCard({ event }: { event: WatchlistEntry["wireEvents"][number] & { pitcherId: string; pitcherName: string } }) {
  const sharedClassName = "rounded border border-white/10 bg-black/20 p-3 transition hover:border-amber-300/40";
  return (
    <a href={event.headline?.url ?? "#"} target="_blank" rel="noopener" className={sharedClassName} data-wire-event={event.key} data-wire-payload={event.payloadValues.join("|")}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-amber-300">NEWS</p>
        <span className="h-2 w-2 rounded-full bg-amber-300" aria-label="Unread Wire item" />
      </div>
      <p className="mt-2 text-sm font-semibold leading-5 text-zinc-100">{event.headline?.text ?? event.pitcherName}</p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{event.headline?.source ?? "News"} · {relativeEventTime(event.headline?.publishedAt ?? event.detectedAt)}</p>
    </a>
  );
}

function NextOnTheSlabModule({ entries }: { entries: WatchlistEntry[] }) {
  const title = entries.some((entry) => entry.nextStart?.daysAway === 0) ? "Today on the slab" : entries.length > 0 ? "Next on the slab" : "No followed arms scheduled";
  const subtitle = entries.length > 0
    ? entries[0]?.nextStart?.daysAway === 0
      ? "Followed starters scheduled today."
      : `Nearest followed start: ${formatShortDate(entries[0]?.nextStart?.date ?? "")}.`
    : `No followed arms scheduled in the next ${WATCHLIST_SOON_DAYS} days.`;
  return (
    <section className="mb-4 rounded border border-amber-300/25 bg-amber-300/[0.06] p-4" data-responsive-check="watchlist-pitching-soon">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">{entries.length > 0 ? "Lined up" : "Watchlist status"}</p>
          <h2 className="mt-1 font-serif text-3xl font-bold text-zinc-50">{title}</h2>
          <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
        </div>
        {entries.length > 0 ? <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">{entries.length} followed arms</p> : null}
      </div>
      {entries.length === 0 ? null : (
      <div className="mt-4 grid gap-2">
        {entries.map((entry) => (
          <Link key={entry.pitcherId} href={pitcherHref(entry, sourceParams("watchlist"))} className="grid gap-3 rounded border border-white/10 bg-black/20 p-3 transition hover:border-amber-300/40 sm:grid-cols-[minmax(0,170px)_minmax(0,1fr)] sm:items-center">
            <div className="min-w-0">
              <p className="truncate font-serif text-xl font-bold text-zinc-50">{entry.name}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">{entry.team} · {hasQualifiedFormSummarySample(entry) ? `${tierLabel(entry.tier)} ${Math.round(entry.rgs)}` : `${LIMITED_SAMPLE_FORM_LABEL} ${Math.round(entry.rgs)}`}</p>
            </div>
            <WatchlistNextStartBlock nextStart={entry.nextStart} compact />
          </Link>
        ))}
      </div>
      )}
    </section>
  );
}

function WatchlistGroup({ title, detail, entries, empty, collapsibleWhenEmpty = false }: { title: string; detail: string; entries: WatchlistEntry[]; empty?: string; collapsibleWhenEmpty?: boolean }) {
  if (entries.length === 0 && collapsibleWhenEmpty) {
    return (
      <section className="rounded border border-white/10 bg-[#101014] p-3">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">{title}</p>
        <p className="mt-1 text-sm text-zinc-500">{empty ?? "No followed pitchers in this group."}</p>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-white/10 pb-2">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">{title}</p>
          <p className="mt-1 text-xs text-zinc-500">{detail}</p>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{entries.length} arms</p>
      </div>
      {entries.length === 0 ? (
        <div className="rounded border border-white/10 bg-[#101014] p-4 text-sm text-zinc-500">{empty ?? "No followed pitchers in this group."}</div>
      ) : (
        <div className="grid gap-3">
          {entries.map((entry) => <WatchlistRow key={entry.pitcherId} entry={entry} />)}
        </div>
      )}
    </section>
  );
}

export function WatchlistRowSkeleton({ index = 0 }: { index?: number }) {
  const bandColor = index % 3 === 0 ? "#FF7A3D" : index % 3 === 1 ? "#888780" : "#8FCBFF";

  return (
    <article className="grid gap-3 rounded border border-l-4 border-white/10 bg-[#101014] p-4 sm:grid-cols-[minmax(0,1fr)_140px] lg:grid-cols-[minmax(0,1fr)_150px_170px]" style={{ borderLeftColor: bandColor }} data-skeleton-row="watchlist">
      <div className="grid min-w-0 grid-cols-[52px_minmax(0,1fr)] gap-3">
        <span className="route-shell-shimmer ml-1 block h-[65px] w-[52px] rounded" />
        <div className="min-w-0">
          <span className="route-shell-shimmer block h-7 w-2/3 rounded" />
          <span className="route-shell-shimmer mt-2 block h-3 w-4/5 rounded" />
          <span className="route-shell-shimmer mt-3 block h-3 w-full rounded" />
          <span className="route-shell-shimmer mt-3 block h-4 w-3/4 rounded" />
        </div>
      </div>
      <div className="min-w-0">
        <span className="route-shell-shimmer block h-3 w-12 rounded" />
        <div className="mt-2 flex items-end gap-2">
          <span className="route-shell-shimmer h-12 w-16 rounded" />
          <span className="route-shell-shimmer h-7 w-14 rounded" />
        </div>
        <span className="route-shell-shimmer mt-5 block h-8 w-24 rounded" />
      </div>
      <div className="space-y-3">
        <span className="route-shell-shimmer block h-[54px] rounded" />
        <span className="route-shell-shimmer block h-9 w-24 rounded" />
      </div>
    </article>
  );
}

function WatchlistRow({ entry }: { entry: WatchlistEntry }) {
  const lastLine = entry.lastStart
    ? `Last GS+ ${entry.lastStart.gsPlus} vs ${entry.lastStart.opp} / ${formatStartLine({ inningsPitched: entry.lastStart.ip, hits: entry.lastStart.h, earnedRuns: entry.lastStart.er, walks: entry.lastStart.bb, strikeouts: entry.lastStart.k, pitches: 0 })}`
    : "Last start unavailable";
  const band = HEAT_BANDS.find((candidate) => candidate.key === entry.tier);
  const qualifiedSample = hasQualifiedFormSummarySample(entry);
  const bandColor = qualifiedSample ? band?.color ?? "#fbbf24" : LIMITED_SAMPLE_FORM_COLOR;

  return (
    <article className="grid gap-3 rounded border border-l-4 border-white/10 bg-[#101014] p-4 sm:grid-cols-[minmax(0,1fr)_140px] lg:grid-cols-[minmax(0,1fr)_150px_170px]" style={{ borderLeftColor: bandColor }}>
      <div className="grid min-w-0 grid-cols-[52px_minmax(0,1fr)] gap-3">
        <Headshot playerId={entry.pitcherId} name={entry.name} team={entry.team} size="lg" band={entry.tier} sampleSufficient={entry.status === "ok" && qualifiedSample} decorative className="ml-1" />
        <div className="min-w-0">
          <Link href={pitcherHref(entry, sourceParams("watchlist"))} className="block min-w-0">
            <h2 className="truncate font-serif text-2xl font-bold leading-tight text-zinc-50">{entry.name}</h2>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: bandColor }}>{entry.team} · {qualifiedSample ? tierLabel(entry.tier) : LIMITED_SAMPLE_FORM_LABEL} · {entry.windowCount} starts</p>
          </Link>
          <p className="mt-2 truncate text-xs text-zinc-500">{lastLine}</p>
          <PitcherAvailabilityNote availability={entry.availability} compact className="mt-2" />
          <div className="mt-3">
            <WatchlistNextStartBlock nextStart={entry.nextStart} compact />
          </div>
          <SignalsRow events={entry.signalEvents} />
        </div>
      </div>
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">Form</p>
        <div className="flex items-end gap-2">
          <p className={`font-serif text-5xl font-bold leading-none ${qualifiedSample ? tierTextClass(entry.tier) : "text-zinc-300"}`}>{Math.round(entry.rgs)}</p>
          {qualifiedSample ? (
            <span className="mb-1 rounded border border-white/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">{tierLabel(entry.tier)}</span>
          ) : (
            <LimitedSampleFormChip value={entry.rgs} compact className="mb-1" />
          )}
        </div>
        <div className="mt-5"><TrendChip summary={entry} compact /></div>
      </div>
      <div className="space-y-3">
        <FormSparkline values={entry.spark} tier={entry.tier} leagueMeanGS={entry.bgs} label={`${entry.name} recent form GS+: ${entry.spark.join(", ")}`} />
        <FollowPitcherButton pitcherId={entry.pitcherId} pitcherName={entry.name} initialFollowing compact refreshOnChange />
      </div>
    </article>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded border border-white/10 bg-[#101014] p-2 sm:p-3">
      <p className="text-zinc-50">{value}</p>
      <p className="mt-1 text-[8px] uppercase leading-4 tracking-[0.12em] text-zinc-500 sm:text-[10px] sm:tracking-[0.16em]">{label}</p>
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

function relativeEventTime(detectedAt: string) {
  const elapsedMs = Date.now() - Date.parse(detectedAt);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 60_000) return "Just now";
  const minutes = Math.round(elapsedMs / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hr ago`;
  return formatArticleDate(detectedAt);
}

function formatArticleDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" }).format(date);
}

function watchlistHref(values: { sort?: WatchlistSort; q?: string }) {
  const params = new URLSearchParams();
  if (values.sort && values.sort !== "default") params.set("sort", values.sort);
  if (values.q) params.set("q", values.q);
  const query = params.toString();
  return `/watchlist${query ? `?${query}` : ""}`;
}

function SignalsRow({ events }: { events: WatchlistEntry["signalEvents"] }) {
  if (events.length === 0) return null;
  return (
    <div className="mt-3 grid gap-1.5" data-responsive-check="watchlist-card-signals">
      {events.slice(0, 2).map((event) => (
        <div key={`${event.key}-${event.detectedAt}`} className="rounded border border-amber-300/15 bg-amber-300/[0.04] px-2 py-1.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-amber-200">{event.label}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-label="Unread signal" />
          </div>
          {event.sentence ? <p className="mt-1 text-[11px] leading-4 text-zinc-500">{event.sentence}</p> : null}
        </div>
      ))}
    </div>
  );
}

function buildSearchResults(pitchers: FormSummary[], followedIds: Set<string>, query: string) {
  const normalized = query.trim().toLowerCase();
  const candidates = pitchers.filter((pitcher) => !followedIds.has(pitcher.pitcherId));
  if (normalized.length > 0) {
    return candidates.filter((pitcher) => pitcher.name.toLowerCase().includes(normalized) || pitcher.team.toLowerCase() === normalized).slice(0, 8);
  }
  return candidates
    .filter((pitcher) => pitcher.status === "ok")
    .sort((a, b) => b.rgs - a.rgs || b.deltaForm - a.deltaForm)
    .slice(0, 4);
}
