import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { FollowPitcherButton } from "@/components/follow-pitcher-button";
import { FormTrendChart, TrendChip, tierLabel, tierTextClass } from "@/components/form-visuals";
import { Headshot } from "@/components/headshot";
import { HeatHighlightModal } from "@/components/heat-highlight-modal";
import { SiteNav } from "@/components/site-nav";
import { resolveFeaturedStartHighlight } from "@/lib/data/featured-highlight-service";
import { getPitcherForm, parseFormWindow } from "@/lib/data/form-service";
import { getHomeSlateDate, getPitcherApiResponse, getStartDetail } from "@/lib/data/start-service";
import { WATCHLIST_COOKIE, getWatchlistPitcherIds } from "@/lib/data/watchlist-service";
import { FORM_CONFIG, qualityTierOf } from "@/lib/form-tokens";
import { jsonLdForPitcherForm, pitcherFormDescription, pitcherFormTitle } from "@/lib/form-metadata";
import { formatStartLine } from "@/lib/format";
import { pitchTypes } from "@/lib/pitch-taxonomy";
import { jsonLdScript, noIndexFollow } from "@/lib/seo";
import type { ArsenalPitchSummary, FeaturedStartHighlight, PitcherApiResponse, StartDetail } from "@/lib/types";

type PitcherFormPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    window?: string;
  }>;
};

export async function generateMetadata({ params, searchParams }: PitcherFormPageProps): Promise<Metadata> {
  const { id } = await params;
  const query = await searchParams;
  const window = parseFormWindow(query?.window);
  const form = await getPitcherForm(id, { window });
  if (!form) return {};

  const title = pitcherFormTitle(form);
  const description = pitcherFormDescription(form);
  const isDefaultWindow = window === FORM_CONFIG.windowDefault;
  const url = `/pitchers/${id}/form${isDefaultWindow ? "" : `?window=${window}`}`;
  const image = `/pitchers/${id}/form/opengraph-image${isDefaultWindow ? "" : `?window=${window}`}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    robots: isDefaultWindow ? undefined : noIndexFollow(),
    openGraph: {
      title,
      description,
      type: "profile",
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

export default async function PitcherFormPage({ params, searchParams }: PitcherFormPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const window = parseFormWindow(query?.window);
  const today = getHomeSlateDate();
  const accountId = (await cookies()).get(WATCHLIST_COOKIE)?.value ?? null;
  const [form, pitcher] = await Promise.all([
    getPitcherForm(id, { window }),
    getPitcherApiResponse(id),
  ]);
  if (!form) notFound();

  const { summary, series } = form;
  const recentDepth = await getRecentStartDepth(series.slice(-3).reverse().map((start) => start.id));
  const recentHighlights = await resolveHighlightsByStartId(recentDepth);
  const jsonLd = jsonLdForPitcherForm(form);
  const followedIds = await getWatchlistPitcherIds(accountId);
  const best = series.reduce((winner, point) => point.gsPlus > winner.gsPlus ? point : winner, series[0]);
  const worst = series.reduce((winner, point) => point.gsPlus < winner.gsPlus ? point : winner, series[0]);
  const streak = countCurrentPlusStreak(series);
  const thermalBand = summary.status === "ok" && summary.windowCount >= window ? summary.tier : null;

  return (
    <main className="min-h-screen bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8">
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5" data-responsive-check="pitcher-form-site-header">
          <Link href="/" className="font-mono text-2xl uppercase tracking-[0.18em] text-amber-300">
            Toe the Slab
          </Link>
          <SiteNav active="heat" today={today} />
        </header>
        <section className="mt-6 border-b border-white/10 pb-8" data-responsive-check="pitcher-form-hero">
          <div className="flex max-w-5xl items-start gap-4 sm:gap-6">
            <Headshot
              playerId={summary.pitcherId}
              name={summary.name}
              team={summary.team}
              size="hero"
              band={thermalBand}
              sampleSufficient={summary.windowCount >= window}
              loading="eager"
              decorative
              className="mt-1"
            />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">{summary.team} / Last {window} qualified starts</p>
              <h1 className="mt-3 break-words font-serif text-5xl font-black leading-none text-zinc-50 sm:text-6xl lg:text-7xl">{summary.name}</h1>
              <p className={`mt-3 font-mono text-xs uppercase tracking-[0.16em] ${form.stale ? "text-amber-300" : "text-zinc-500"}`}>
                Form through {form.formThroughDate ?? "pending"}{form.stale && form.latestScoredStartDate ? ` / updating from ${form.latestScoredStartDate}` : ""}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <div>
                  <p className={`font-serif text-6xl font-bold ${tierTextClass(summary.tier)}`}>{Math.round(summary.rgs)}</p>
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">{tierLabel(summary.tier)} form / {summary.windowCount} of {window}</p>
                  <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">
                    ERA {formatNullable(summary.seasonStats.era, 2)} · WHIP {formatNullable(summary.seasonStats.whip, 2)} · K/9 {formatNullable(summary.seasonStats.k9, 1)} · IP {summary.seasonStats.inningsPitched.toFixed(1)}
                  </p>
                </div>
                <TrendChip summary={summary} />
                <FollowPitcherButton pitcherId={summary.pitcherId} pitcherName={summary.name} initialFollowing={followedIds.includes(summary.pitcherId)} labeled />
              </div>
            </div>
          </div>
        </section>

        <section className="py-8">
          <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Season form trend</p>
              <h2 className="mt-2 font-serif text-4xl font-bold text-zinc-50">Rolling GS+</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {[3, 5, 10].map((value) => (
                <Link key={value} href={`/pitchers/${id}/form?window=${value}`} className={`inline-flex min-h-11 items-center rounded border px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] ${window === value ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 text-zinc-300"}`}>
                  Last {value}
                </Link>
              ))}
            </div>
          </div>
          {summary.status === "insufficient" ? (
            <div className="rounded border border-white/10 bg-[#101014] p-6">
              <p className="font-mono text-sm text-zinc-300">Insufficient data. This pitcher needs at least two qualified starts after the 2.0 IP floor.</p>
            </div>
          ) : (
            <FormTrendChart series={series} leagueMeanGS={form.leagueMeanGS} />
          )}
        </section>

        <section className="grid gap-5 pb-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">GS+ game log</p>
            <div className="overflow-hidden rounded border border-white/10">
              {[...series].reverse().map((start) => (
                <article key={start.id} className="grid gap-3 border-b border-white/10 bg-[#101014] p-4 font-mono text-sm transition hover:bg-white/[0.04] last:border-b-0 md:grid-cols-[120px_minmax(0,1fr)_90px_auto] md:items-center">
                  <Link href={start.startHref} className="text-zinc-500 hover:text-amber-300">{start.gameDate}</Link>
                  <Link href={start.startHref} className="min-w-0 text-zinc-200 hover:text-amber-300">
                    <span className="block text-zinc-50">vs {start.opp} / {start.park}</span>
                    <span className="mt-1 block text-zinc-400">{formatStartLine({ inningsPitched: start.ip, hits: start.h, earnedRuns: start.er, walks: start.bb, strikeouts: start.k, pitches: 0 })}</span>
                  </Link>
                  <Link href={start.startHref} className={`text-left hover:underline md:text-right ${tierTextClass(start.tier)}`}>GS+ {start.gsPlus}</Link>
                  {recentHighlights.get(start.id) ? <HeatHighlightModal highlight={recentHighlights.get(start.id)!} pitcherName={summary.name} /> : null}
                </article>
              ))}
            </div>
            {recentDepth.length > 0 ? <RecentStartDepth starts={recentDepth} highlights={recentHighlights} /> : null}
          </div>
          <aside className="space-y-3">
            {pitcher ? <ArsenalRolePanel pitcher={pitcher} /> : null}
            <Callout label="Best start" value={`GS+ ${best.gsPlus}`} detail={`${best.gameDate} vs ${best.opp}`} href={best.startHref} />
            <Callout label="Worst start" value={`GS+ ${worst.gsPlus}`} detail={`${worst.gameDate} vs ${worst.opp}`} href={worst.startHref} />
            <div className="rounded border border-white/10 bg-[#101014] p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Current streak</p>
              <p className="mt-2 font-serif text-3xl text-zinc-50">{streak}</p>
              <p className="mt-1 font-mono text-xs text-zinc-500">straight starts of GS+ 55+</p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

async function getRecentStartDepth(startIds: string[]) {
  const starts = await Promise.all(startIds.map((startId) => getStartDetail(startId)));
  return starts.filter((start): start is StartDetail => Boolean(start));
}

async function resolveHighlightsByStartId(starts: StartDetail[]) {
  const highlights = await Promise.all(starts.map((start) => resolveFeaturedStartHighlight(start)));
  const map = new Map<string, FeaturedStartHighlight | null>();
  starts.forEach((start, index) => map.set(start.id, highlights[index] ?? null));
  return map;
}

function ArsenalRolePanel({ pitcher }: { pitcher: PitcherApiResponse }) {
  const primary = pitcher.arsenal[0];
  return (
    <div className="rounded border border-white/10 bg-[#101014] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Arsenal & role</p>
      <p className="mt-2 font-serif text-3xl text-zinc-50">Starter</p>
      <p className="mt-1 font-mono text-xs text-zinc-500">
        {pitcher.seasonLine.starts} starts / primary {primary ? pitchTypes[primary.type].name : "mix pending"}
      </p>
      <div className="mt-4 grid gap-3">
        {pitcher.arsenal.slice(0, 5).map((pitch) => <ArsenalPitch key={pitch.type} pitch={pitch} />)}
      </div>
    </div>
  );
}

function ArsenalPitch({ pitch }: { pitch: ArsenalPitchSummary }) {
  const pitchType = pitchTypes[pitch.type];
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 font-mono">
        <p className="text-xs font-semibold" style={{ color: pitchType.color }}>{pitchType.name}</p>
        <p className="text-xs text-zinc-400">{pitch.usagePct}%</p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
        <span className="block h-full rounded-full" style={{ width: `${Math.max(4, Math.min(100, pitch.usagePct))}%`, background: pitchType.color }} />
      </div>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
        {pitch.avgVelocityMph.toFixed(1)} mph / {pitch.whiffPct}% whiff / {pitch.calledStrikePct}% called
      </p>
    </div>
  );
}

function RecentStartDepth({ starts, highlights }: { starts: StartDetail[]; highlights: Map<string, FeaturedStartHighlight | null> }) {
  return (
    <section className="mt-6">
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Recent start depth</p>
      <div className="grid gap-3">
        {starts.map((start) => <RecentStartCard key={start.id} start={start} highlight={highlights.get(start.id) ?? null} />)}
      </div>
    </section>
  );
}

function RecentStartCard({ start, highlight }: { start: StartDetail; highlight?: FeaturedStartHighlight | null }) {
  const tier = qualityTierOf(start.gameScorePlus);
  const whiffs = start.pitchEvents.filter((pitch) => pitch.result === "swinging_strike").length;
  const whiffRate = start.pitchEvents.length ? (whiffs / start.pitchEvents.length) * 100 : 0;
  const topVelo = start.pitchEvents.length ? Math.max(...start.pitchEvents.map((pitch) => pitch.velocityMph)) : 0;
  const spark = start.inningTimeline?.map((inning) => Number(inning.avgVelocityMph.toFixed(1))) ?? [];

  return (
    <article className="grid gap-4 rounded border border-white/10 bg-[#101014] p-4 transition hover:border-amber-300/40 md:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: tier.color }}>{start.date} / {tier.label}</p>
        <Link href={`/starts/${start.id}`} className="mt-1 block font-serif text-2xl font-bold text-zinc-50 hover:text-amber-300">vs {start.opponent}</Link>
        <p className="mt-2 font-mono text-xs text-zinc-400">{formatStartLine(start.line)}</p>
        {highlight ? (
          <div className="mt-3">
            <HeatHighlightModal highlight={highlight} pitcherName={start.pitcher.name} />
          </div>
        ) : null}
      </div>
      <div className="grid gap-3">
        <div className="grid grid-cols-3 rounded border border-white/10 bg-black/20 font-mono text-xs">
          <MiniStat label="GS+" value={String(start.gameScorePlus)} color={tier.color} />
          <MiniStat label="Whiff" value={`${whiffRate.toFixed(0)}%`} />
          <MiniStat label="Top velo" value={topVelo ? topVelo.toFixed(1) : "--"} />
        </div>
        <div className="rounded border border-white/10 bg-black/20 p-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Inning velo shape</p>
          <VeloSparkline values={spark} label={`${start.pitcher.name} ${start.date} inning average velocity: ${spark.join(", ")}`} color={tier.color} />
        </div>
      </div>
    </article>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border-r border-white/10 p-3 last:border-r-0">
      <p className="text-lg font-bold text-zinc-50" style={color ? { color } : undefined}>{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
    </div>
  );
}

function formatNullable(value: number | null | undefined, digits: number) {
  return typeof value === "number" ? value.toFixed(digits) : "--";
}

function VeloSparkline({ values, label, color }: { values: number[]; label: string; color: string }) {
  const width = 220;
  const height = 52;
  const pad = 5;
  const points = values.length > 0 ? values : [0];
  const min = points.length > 1 ? Math.min(...points) - 1 : points[0] - 1;
  const max = points.length > 1 ? Math.max(...points) + 1 : points[0] + 1;
  const xFor = (index: number) => pad + (points.length === 1 ? (width - pad * 2) / 2 : (index / (points.length - 1)) * (width - pad * 2));
  const yFor = (value: number) => pad + ((max - value) / Math.max(1, max - min)) * (height - pad * 2);
  const path = points.map((value, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(1)} ${yFor(value).toFixed(1)}`).join(" ");

  return (
    <svg className="mt-2 h-14 w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((value, index) => (
        <circle key={`${value}-${index}`} cx={xFor(index)} cy={yFor(value)} r="3" fill={color}>
          <title>{`${value.toFixed(1)} mph`}</title>
        </circle>
      ))}
    </svg>
  );
}

function Callout({ label, value, detail, href }: { label: string; value: string; detail: string; href: string }) {
  return (
    <Link href={href} className="block rounded border border-white/10 bg-[#101014] p-4 transition hover:bg-white/[0.04]">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-2 font-serif text-3xl text-amber-300">{value}</p>
      <p className="mt-1 font-mono text-xs text-zinc-500">{detail}</p>
    </Link>
  );
}

function countCurrentPlusStreak(series: Array<{ gsPlus: number }>) {
  let streak = 0;
  for (const start of [...series].reverse()) {
    if (start.gsPlus < 55) break;
    streak += 1;
  }
  return streak;
}
