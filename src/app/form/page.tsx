import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { FollowPitcherButton } from "@/components/follow-pitcher-button";
import { FormSparkline, TrendChip, tierLabel } from "@/components/form-visuals";
import { PitcherChip } from "@/components/pitcher-chip";
import { SiteNav } from "@/components/site-nav";
import { getFormLeaderboard, parseFormWindow } from "@/lib/data/form-service";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { WATCHLIST_COOKIE, getWatchlistPitcherIds } from "@/lib/data/watchlist-service";
import { formPageDescription, formPageTitle, jsonLdForFormPage } from "@/lib/form-metadata";
import { HEAT_BANDS } from "@/lib/form-tokens";
import { formatStartLine } from "@/lib/format";
import type { FormSummary, HeatBand } from "@/lib/types";
import type React from "react";

type FormPageProps = {
  searchParams?: Promise<{
    window?: string;
    sort?: string;
    team?: string;
    q?: string;
    hot?: string;
    qualified?: string;
    band?: string;
  }>;
};

const sortOptions = [
  { key: "form", label: "Form" },
  { key: "risers", label: "Risers" },
  { key: "fallers", label: "Fallers" },
] as const;

export async function generateMetadata({ searchParams }: FormPageProps): Promise<Metadata> {
  return generateHeatCheckMetadata({ searchParams });
}

export async function generateHeatCheckMetadata({ searchParams }: FormPageProps): Promise<Metadata> {
  const params = await searchParams;
  const window = parseFormWindow(params?.window);
  const leaderboard = await getFormLeaderboard({ window, qualifiedOnly: true });
  const title = formPageTitle(window);
  const description = formPageDescription(leaderboard);
  const hasIndexableWindow = params?.window && window !== 5 && Object.keys(params).every((key) => key === "window");
  const url = hasIndexableWindow ? `/heat-check?window=${window}` : "/heat-check";
  const image = `/form/opengraph-image?window=${window}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      type: "website",
      url,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function FormRedirect({ searchParams }: FormPageProps) {
  const params = await searchParams;
  redirect(heatCheckHref(params ?? {}));
}

export async function HeatCheckPage({ searchParams }: FormPageProps) {
  const params = await searchParams;
  const window = parseFormWindow(params?.window);
  const sort = sortOptions.some((option) => option.key === params?.sort) ? params?.sort ?? "form" : "form";
  const team = params?.team ?? "";
  const query = (params?.q ?? "").trim().toLowerCase();
  const qualifiedOnly = params?.qualified !== "false";
  const band = HEAT_BANDS.some((candidate) => candidate.key === params?.band) ? params?.band ?? "" : "";
  const accountId = (await cookies()).get(WATCHLIST_COOKIE)?.value ?? null;
  const [leaderboard, followedIds] = await Promise.all([
    getFormLeaderboard({ window, qualifiedOnly }),
    getWatchlistPitcherIds(accountId),
  ]);
  const jsonLd = jsonLdForFormPage(leaderboard);
  const today = getHomeSlateDate();
  const rankedDate = addDays(today, -1);
  const teams = [...new Set(leaderboard.pitchers.map((pitcher) => pitcher.team).filter(Boolean))].sort();
  const pitchers = leaderboard.pitchers
    .filter((pitcher) => !team || pitcher.team === team)
    .filter((pitcher) => !query || pitcher.name.toLowerCase().includes(query))
    .filter((pitcher) => !band || pitcher.tier === band)
    .sort((a, b) => {
      const aLimited = a.windowCount < window;
      const bLimited = b.windowCount < window;
      if (sort === "risers") return Number(aLimited) - Number(bLimited) || b.deltaForm - a.deltaForm || b.rgs - a.rgs;
      if (sort === "fallers") return Number(aLimited) - Number(bLimited) || a.deltaForm - b.deltaForm || b.rgs - a.rgs;
      return b.rgs - a.rgs || b.deltaForm - a.deltaForm;
    });
  const bandCounts = HEAT_BANDS.map((candidate) => ({
    ...candidate,
    count: leaderboard.pitchers.filter((pitcher) => pitcher.status === "ok" && pitcher.tier === candidate.key).length,
  }));
  const qualifiedPitchers = leaderboard.pitchers.filter((pitcher) => pitcher.status === "ok");
  const hottestPitchers = pitchers.filter((pitcher) => pitcher.tier === "onfire").slice(0, 8);
  const heroIds = new Set(hottestPitchers.map((pitcher) => pitcher.pitcherId));
  const boardPitchers = pitchers.filter((pitcher) => !heroIds.has(pitcher.pitcherId));
  const risers = [...qualifiedPitchers].filter((pitcher) => pitcher.windowCount >= window).sort((a, b) => b.deltaForm - a.deltaForm).slice(0, 3);
  const fallers = [...qualifiedPitchers].filter((pitcher) => pitcher.windowCount >= window).sort((a, b) => a.deltaForm - b.deltaForm).slice(0, 3);

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-white/10 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">The Bump</Link>
            <SiteNav active="heat" today={today} rankedDate={rankedDate} />
          </div>
          <h1 className="mt-4 font-serif text-5xl font-black text-zinc-50">Heat Check</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Who is pitching like an ace right now. Form is average GS+ over the last {window} qualified starts, with starts under 2.0 IP excluded.
          </p>
          <div className="mt-5 grid gap-3 font-mono text-xs sm:grid-cols-4">
            <SummaryStat label="Qualified" value={String(leaderboard.qualifiedCount)} />
            <SummaryStat label="Rising" value={String(leaderboard.heatingCount)} />
            <SummaryStat label="Falling" value={String(leaderboard.coolingCount)} />
            <SummaryStat label="League mean GS+" value={leaderboard.leagueMeanGS.toFixed(1)} />
          </div>
          <BandDistribution bands={bandCounts} total={leaderboard.qualifiedCount} params={params ?? {}} />
        </header>

        <MoversStrip risers={risers} fallers={fallers} window={window} leagueMeanGS={leaderboard.leagueMeanGS} />

        <section className="my-5 rounded border border-white/10 bg-[#101014] p-4" data-responsive-check="form-controls">
          <details>
            <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.16em] text-amber-300 marker:text-amber-300">
              Filters / Last {window} / {sortOptions.find((option) => option.key === sort)?.label ?? "Form"} / {band ? HEAT_BANDS.find((candidate) => candidate.key === band)?.label : "All bands"}
            </summary>
            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <ControlGroup label="Window">
              {[3, 5, 10].map((value) => <ControlLink key={value} active={window === value} href={heatCheckHref({ ...params, window: String(value) })}>Last {value}</ControlLink>)}
            </ControlGroup>
            <ControlGroup label="Sort">
              {sortOptions.map((option) => <ControlLink key={option.key} active={sort === option.key} href={heatCheckHref({ ...params, sort: option.key })}>{option.label}</ControlLink>)}
            </ControlGroup>
            <ControlGroup label="Band">
              <ControlLink active={!band} href={heatCheckHref({ ...params, band: "" })}>All bands</ControlLink>
              {HEAT_BANDS.map((candidate) => (
                <ControlLink key={candidate.key} active={band === candidate.key} href={heatCheckHref({ ...params, band: candidate.key })}>{candidate.label}</ControlLink>
              ))}
            </ControlGroup>
            <ControlGroup label="Team">
              <ControlLink active={!team} href={heatCheckHref({ ...params, team: "" })}>All teams</ControlLink>
              {teams.map((candidate) => (
                <ControlLink key={candidate} active={team === candidate} href={heatCheckHref({ ...params, team: candidate })}>{candidate}</ControlLink>
              ))}
            </ControlGroup>
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <ControlLink active={qualifiedOnly} href={heatCheckHref({ ...params, qualified: qualifiedOnly ? "false" : "true" })}>Qualified</ControlLink>
            </div>
            </div>
            <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]" action="/heat-check">
            <input type="hidden" name="window" value={String(window)} />
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="qualified" value={String(qualifiedOnly)} />
            {band ? <input type="hidden" name="band" value={band} /> : null}
            {team ? <input type="hidden" name="team" value={team} /> : null}
            <input name="q" defaultValue={params?.q ?? ""} placeholder="Search pitcher" className="min-h-11 rounded border border-white/10 bg-black/20 px-3 font-mono text-sm text-zinc-100 outline-none focus:border-amber-300" />
            <button className="min-h-11 rounded border border-amber-300/40 px-4 font-mono text-xs uppercase tracking-[0.16em] text-amber-300">Search</button>
            </form>
          </details>
        </section>

        {hottestPitchers.length > 0 ? (
          <section className="my-5" data-responsive-check="heat-hero-tier">
            <div className="mb-3 flex flex-col justify-between gap-2 border-b border-white/10 pb-3 sm:flex-row sm:items-end">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">On fire tier</p>
                <h2 className="font-serif text-4xl font-bold text-zinc-50">The hottest arms in baseball</h2>
              </div>
              <a href="#full-board" className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-400 underline-offset-4 hover:text-amber-300 hover:underline">Jump to full board</a>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {hottestPitchers.map((pitcher, index) => (
                <HeatHeroCard key={pitcher.pitcherId} pitcher={pitcher} rank={index + 1} window={window} leagueMeanGS={leaderboard.leagueMeanGS} followed={followedIds.includes(pitcher.pitcherId)} />
              ))}
            </div>
          </section>
        ) : null}

        {pitchers.length === 0 ? (
          <section className="rounded border border-white/10 bg-[#101014] p-6">
            <p className="font-mono text-sm text-zinc-300">No qualified pitchers match these filters.</p>
          </section>
        ) : (
          <section id="full-board" className="grid gap-3 scroll-mt-8" data-responsive-check="form-leaderboard">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Full board</p>
                <h2 className="font-serif text-3xl font-bold text-zinc-50">League heat map</h2>
              </div>
              <nav className="flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.14em]" aria-label="Jump to heat band">
                {HEAT_BANDS.map((candidate) => (
                  <a key={candidate.key} href={`#band-${candidate.key}`} className="rounded border border-white/10 px-2 py-1 text-zinc-400 hover:text-zinc-100">
                    {candidate.label}
                  </a>
                ))}
              </nav>
            </div>
            {boardPitchers.map((pitcher, index) => (
              <FormLeaderboardRow key={pitcher.pitcherId} pitcher={pitcher} rank={heroIds.size + index + 1} window={window} leagueMeanGS={leaderboard.leagueMeanGS} followed={followedIds.includes(pitcher.pitcherId)} showBandAnchor={firstBandIndex(boardPitchers, index)} />
            ))}
          </section>
        )}
      </div>
    </main>
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

function BandDistribution({ bands, total, params }: { bands: Array<HeatBand & { count: number }>; total: number; params: Record<string, string | undefined> }) {
  const onFire = bands.find((band) => band.key === "onfire")?.count ?? 0;
  const ice = bands.find((band) => band.key === "ice")?.count ?? 0;
  return (
    <div className="mt-6 rounded border border-white/10 bg-[#101014] p-4" data-responsive-check="heat-band-distribution">
      <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">League temperature</p>
          <p className="font-serif text-3xl font-bold text-zinc-50">{onFire} on fire · {ice} ice cold · {total} qualified</p>
        </div>
        <p className="font-mono text-xs text-zinc-500">Counts match row badges</p>
      </div>
      <div className="flex h-12 overflow-hidden rounded border border-white/10">
        {bands.map((band) => {
          const width = total > 0 ? (band.count / total) * 100 : 0;
          return (
            <Link
              key={band.key}
              href={heatCheckHref({ ...params, band: band.key })}
              className="heat-band-fill flex min-w-[2px] items-center justify-center font-mono text-xs font-semibold text-[#08080a]"
              style={{ width: `${width}%`, backgroundColor: band.color }}
              aria-label={`${band.label}: ${band.count} pitchers`}
            >
              {width >= 7 ? band.count : null}
            </Link>
          );
        })}
      </div>
      <div className="mt-2 hidden gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500 sm:grid sm:grid-cols-5">
        {bands.map((band) => (
          <Link key={band.key} href={heatCheckHref({ ...params, band: band.key })} className="flex items-center justify-between gap-2 rounded border border-white/10 px-2 py-1">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: band.color }} />
              {band.label}
            </span>
            <span className="text-zinc-300">{band.count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function MoversStrip({ risers, fallers, window, leagueMeanGS }: { risers: FormSummary[]; fallers: FormSummary[]; window: number; leagueMeanGS: number }) {
  return (
    <section className="my-5 grid gap-3 lg:grid-cols-2" data-responsive-check="heat-movers-strip">
      <MoverPanel title="Biggest risers" pitchers={risers} window={window} leagueMeanGS={leagueMeanGS} />
      <MoverPanel title="Biggest fallers" pitchers={fallers} window={window} leagueMeanGS={leagueMeanGS} />
    </section>
  );
}

function MoverPanel({ title, pitchers, window, leagueMeanGS }: { title: string; pitchers: FormSummary[]; window: number; leagueMeanGS: number }) {
  return (
    <div className="rounded border border-white/10 bg-[#101014] p-4">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-amber-300">{title}</p>
      <div className="mt-3 grid gap-3">
        {pitchers.map((pitcher) => {
          const bandColor = HEAT_BANDS.find((band) => band.key === pitcher.tier)?.color ?? "#888780";
          return (
            <a key={pitcher.pitcherId} href={`/pitchers/${pitcher.pitcherId}/form?window=${window}`} className="grid grid-cols-[minmax(0,1fr)_96px_auto] items-center gap-2 rounded border border-white/10 bg-black/20 p-2 hover:border-amber-300/30">
              <PitcherChip pitcherId={pitcher.pitcherId} name={pitcher.name} team={pitcher.team} imageWidth={80} size="sm" />
              <FormSparkline values={pitcher.spark} tier={pitcher.tier} leagueMeanGS={leagueMeanGS} label={`${pitcher.name} last ${pitcher.windowCount} starts GS+: ${pitcher.spark.join(", ")}`} trend={pitcher.trend} variant="mini" />
              <p className="font-mono text-sm font-semibold" style={{ color: bandColor }}>{formatSignedDelta(pitcher.deltaForm)}</p>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function HeatHeroCard({ pitcher, rank, window, leagueMeanGS, followed }: { pitcher: FormSummary; rank: number; window: number; leagueMeanGS: number; followed: boolean }) {
  const bandColor = HEAT_BANDS.find((band) => band.key === pitcher.tier)?.color ?? "#D85A30";
  const nextToday = isStartingToday(pitcher);

  return (
    <article className="heat-glow-card rounded border border-amber-300/20 bg-[#101014] p-5" style={heatGlowStyle(pitcher, true)} data-form-hero-card>
      <div className="grid gap-4 sm:grid-cols-[110px_minmax(0,1fr)_auto] sm:items-start">
        <PitcherChip
          pitcherId={pitcher.pitcherId}
          name={pitcher.name}
          team={`${pitcher.team} / ${pitcher.windowCount} of ${window}`}
          href={`/pitchers/${pitcher.pitcherId}/form?window=${window}`}
          metric={Math.round(pitcher.rgs)}
          metricLabel="Form"
          metricColor={bandColor}
          imageWidth={220}
          size="lg"
          loading={rank === 1 ? "eager" : "lazy"}
        />
        <div className="sm:col-span-2">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="heat-badge inline-flex rounded border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 font-mono text-xs uppercase tracking-[0.14em] text-amber-200">
              #{rank} · {tierLabel(pitcher.tier)}
            </span>
            <TrendChip summary={pitcher} compact />
            {nextToday ? <span className="rounded border border-teal-300/30 px-2.5 py-1 font-mono text-xs uppercase tracking-[0.12em] text-teal-300">Starting today</span> : null}
          </div>
          <FormSparkline values={pitcher.spark} tier={pitcher.tier} leagueMeanGS={leagueMeanGS} label={`${pitcher.name} last ${pitcher.windowCount} starts GS+: ${pitcher.spark.join(", ")}`} trend={pitcher.trend} variant="hero" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-xs text-zinc-400">
              Last GS+ {pitcher.lastStart?.gsPlus ?? "--"} / Delta {formatSignedDelta(pitcher.deltaForm)}
              {pitcher.nextStart ? ` / Next ${pitcher.nextStart.date} vs ${pitcher.nextStart.opponent}` : ""}
            </p>
            <FollowPitcherButton pitcherId={pitcher.pitcherId} pitcherName={pitcher.name} initialFollowing={followed} compact />
          </div>
        </div>
      </div>
    </article>
  );
}

function FormLeaderboardRow({ pitcher, rank, window, leagueMeanGS, followed, showBandAnchor }: { pitcher: FormSummary; rank: number; window: number; leagueMeanGS: number; followed: boolean; showBandAnchor?: boolean }) {
  const bandColor = HEAT_BANDS.find((band) => band.key === pitcher.tier)?.color ?? "#888780";
  const lastLine = pitcher.lastStart
    ? `Last GS+ ${pitcher.lastStart.gsPlus} vs ${pitcher.lastStart.opp} / ${formatStartLine({ inningsPitched: pitcher.lastStart.ip, hits: pitcher.lastStart.h, earnedRuns: pitcher.lastStart.er, walks: pitcher.lastStart.bb, strikeouts: pitcher.lastStart.k, pitches: 0 })}`
    : "Last start unavailable";
  const fullWindow = pitcher.windowCount >= window;

  return (
    <article
      id={showBandAnchor ? `band-${pitcher.tier}` : undefined}
      className="heat-glow-card scroll-mt-6 grid grid-cols-[34px_minmax(0,1fr)] items-center gap-3 rounded border border-white/10 bg-[#101014] p-3 transition hover:bg-white/[0.04] lg:grid-cols-[48px_minmax(0,1fr)_420px]"
      style={{ ...heatGlowStyle(pitcher), borderLeftColor: bandColor, borderLeftWidth: 4 }}
      data-form-row
    >
      <p className="font-serif text-2xl text-zinc-500">#{rank}</p>
      <PitcherChip
        pitcherId={pitcher.pitcherId}
        name={pitcher.name}
        team={`${pitcher.team} / ${pitcher.windowCount} of ${window} / ${tierLabel(pitcher.tier)}`}
        href={`/pitchers/${pitcher.pitcherId}/form?window=${window}`}
        metric={Math.round(pitcher.rgs)}
        metricLabel="Form"
        metricColor={bandColor}
        imageWidth={120}
        size="md"
        className="grid-cols-[48px_minmax(0,1fr)_auto] gap-2 sm:grid-cols-[52px_minmax(0,1fr)_auto] sm:gap-3"
        nameClassName="whitespace-normal overflow-visible text-clip text-[1.32rem] leading-[0.95] sm:text-xl"
      >
        <p className="truncate text-xs text-zinc-500">
          {lastLine}
          {isStartingToday(pitcher) ? <span className="ml-2 text-teal-300">Starting today</span> : null}
        </p>
      </PitcherChip>
      <div className="col-span-full grid grid-cols-[auto_minmax(96px,1fr)_auto] items-center gap-2 lg:col-span-1">
        <div className="min-w-0">{fullWindow ? <TrendChip summary={pitcher} compact /> : <InsufficientTrend windowCount={pitcher.windowCount} window={window} />}</div>
        <FormSparkline
          values={pitcher.spark}
          tier={pitcher.tier}
          leagueMeanGS={leagueMeanGS}
          label={`Last ${pitcher.windowCount} starts GS+: ${pitcher.spark.join(", ")}`}
          trend={pitcher.trend}
        />
        <FollowPitcherButton pitcherId={pitcher.pitcherId} pitcherName={pitcher.name} initialFollowing={followed} compact />
      </div>
    </article>
  );
}

function InsufficientTrend({ windowCount, window }: { windowCount: number; window: number }) {
  return (
    <span className="inline-flex min-h-8 items-center gap-2 rounded border border-zinc-500/25 px-2.5 py-1 font-mono text-xs uppercase tracking-[0.12em] text-zinc-500" aria-label={`Insufficient trend data, ${windowCount} of ${window} starts`}>
      <span>--</span>
      <span>Insufficient</span>
    </span>
  );
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ControlLink({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link className={`inline-flex min-h-11 items-center rounded border px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] ${active ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 text-zinc-300"}`} href={href}>
      {children}
    </Link>
  );
}

function heatCheckHref(values: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value && !(key === "window" && value === "5")) params.set(key, value);
  }
  const query = params.toString();
  return `/heat-check${query ? `?${query}` : ""}`;
}

function firstBandIndex(pitchers: FormSummary[], index: number) {
  return index === 0 || pitchers[index - 1]?.tier !== pitchers[index]?.tier;
}

function formatSignedDelta(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function isStartingToday(pitcher: FormSummary) {
  return pitcher.nextStart?.date === getHomeSlateDate();
}

function heatGlowStyle(pitcher: FormSummary, hero = false): React.CSSProperties {
  const band = HEAT_BANDS.find((candidate) => candidate.key === pitcher.tier);
  const color = band?.color ?? "#888780";
  const heatValue = pitcher.heatIndex ?? pitcher.rgs;
  const intensity = Math.max(0.08, Math.min(0.42, (Math.round(heatValue) - (band?.min ?? 0)) / 90 + (hero ? 0.22 : 0.08)));
  const cool = pitcher.tier === "cooling" || pitcher.tier === "ice";
  const glowColor = cool ? "55 138 221" : pitcher.tier === "even" ? "136 135 128" : "239 159 39";

  return {
    "--heat-glow-color": glowColor,
    "--heat-glow-opacity": intensity.toFixed(2),
    "--heat-glow-edge": color,
  } as React.CSSProperties;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
