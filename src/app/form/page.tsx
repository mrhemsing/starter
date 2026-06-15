import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { FollowPitcherButton } from "@/components/follow-pitcher-button";
import { FormDriverChips } from "@/components/form-driver-chips";
import { FormSparkline, TrendChip, tierLabel } from "@/components/form-visuals";
import { SiteNav } from "@/components/site-nav";
import { getFormLeaderboard, parseFormWindow } from "@/lib/data/form-service";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { getTonightMustWatch } from "@/lib/data/tonight-service";
import { WATCHLIST_COOKIE, getWatchlistPitcherIds } from "@/lib/data/watchlist-service";
import { formPageDescription, formPageTitle, jsonLdForFormPage } from "@/lib/form-metadata";
import { HEAT_BANDS } from "@/lib/form-tokens";
import { formatStartLine } from "@/lib/format";
import { jsonLdScript, noIndexFollow } from "@/lib/seo";
import type { FormSummary, FormTier, HeatBand, TonightGame } from "@/lib/types";
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
  const hasNonCanonicalFilters = Boolean(params && Object.keys(params).some((key) => !(key === "window" && hasIndexableWindow)));
  const url = hasIndexableWindow ? `/heat-check?window=${window}` : "/heat-check";
  const image = `/form/opengraph-image?window=${window}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    robots: hasNonCanonicalFilters ? noIndexFollow() : undefined,
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
  const today = getHomeSlateDate();
  const [leaderboard, followedIds, tonight] = await Promise.all([
    getFormLeaderboard({ window, qualifiedOnly }),
    getWatchlistPitcherIds(accountId),
    getTonightMustWatch({ date: today, window }),
  ]);
  const jsonLd = jsonLdForFormPage(leaderboard);
  const rankedDate = addDays(today, -1);
  const startContext = buildTodayStartContext(tonight.games);
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
    count: pitchers.filter((pitcher) => pitcher.status === "ok" && pitcher.tier === candidate.key).length,
  }));
  const qualifiedPitchers = leaderboard.pitchers.filter((pitcher) => pitcher.status === "ok");
  const heroCandidates = qualifiedPitchers.filter((pitcher) => pitcher.windowCount >= window);
  const riserCandidates = [...heroCandidates].sort((a, b) => compareRisers(a, b, startContext));
  const fallerCandidates = [...heroCandidates].sort((a, b) => compareFallers(a, b, startContext));
  const biggestRiser = riserCandidates[0] ?? null;
  const biggestFaller = fallerCandidates[0] ?? null;
  const heroIds = new Set([biggestRiser?.pitcherId, biggestFaller?.pitcherId].filter((id): id is string => Boolean(id)));
  const boardPitchers = pitchers;
  const groupedBoard = groupPitchersByBand(boardPitchers);
  const showBandHeaders = sort === "form";
  const risers = riserCandidates.filter((pitcher) => !heroIds.has(pitcher.pitcherId)).slice(0, 3);
  const fallers = fallerCandidates.filter((pitcher) => !heroIds.has(pitcher.pitcherId)).slice(0, 3);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#08080a] px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-white/10 pb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">Front Five</Link>
            <SiteNav active="heat" today={today} rankedDate={rankedDate} />
          </div>
          <h1 className="mt-4 font-serif text-5xl font-black text-zinc-50 sm:text-6xl">Heat Check</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Furnace to freezer across the last {window} qualified starts. The trace shows where every arm is moving; the glow is reserved for the poles.
          </p>
          <p className={`mt-3 font-mono text-xs uppercase tracking-[0.16em] ${leaderboard.stale ? "text-amber-300" : "text-zinc-500"}`}>
            Form through {leaderboard.formThroughDate ?? "pending"}{leaderboard.stale && leaderboard.latestScoredStartDate ? ` / updating from ${leaderboard.latestScoredStartDate}` : ""}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-4">
            <SummaryStat label="Qualified" value={String(leaderboard.qualifiedCount)} />
            <SummaryStat label="Rising" value={String(leaderboard.heatingCount)} />
            <SummaryStat label="Falling" value={String(leaderboard.coolingCount)} />
            <SummaryStat label="League mean GS+" value={leaderboard.leagueMeanGS.toFixed(1)} />
          </div>
          <BandDistribution bands={bandCounts} total={pitchers.length} params={params ?? {}} />
        </header>

        {biggestRiser && biggestFaller ? (
          <MomentumHero
            riser={biggestRiser}
            faller={biggestFaller}
            window={window}
            leagueMeanGS={leaderboard.leagueMeanGS}
            followedIds={followedIds}
            startContext={startContext}
            qualifiedCount={leaderboard.qualifiedCount}
            heatingCount={leaderboard.heatingCount}
            coolingCount={leaderboard.coolingCount}
          />
        ) : null}

        <MoversStrip risers={risers} fallers={fallers} window={window} />

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

        {pitchers.length === 0 ? (
          <section className="rounded border border-white/10 bg-[#101014] p-6">
            <p className="font-mono text-sm text-zinc-300">No qualified pitchers match these filters.</p>
          </section>
        ) : (
          <div id="full-board" className="grid gap-4 scroll-mt-8 lg:grid-cols-[80px_minmax(0,1fr)]" data-responsive-check="form-leaderboard">
            <TemperatureRail bands={bandCounts} total={pitchers.length} params={params ?? {}} />
            <section className="grid gap-2">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Full board</p>
                  <h2 className="font-serif text-3xl font-bold text-zinc-50">League heat map</h2>
                </div>
                <nav className="flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.14em]" aria-label="Jump to heat band">
                  <a href="#heat-fire" className="rounded border border-amber-300/30 px-2 py-1 text-amber-200 hover:text-amber-100">Jump to fire</a>
                  <a href="#heat-ice" className="rounded border border-sky-300/30 px-2 py-1 text-sky-200 hover:text-sky-100">Jump to ice</a>
                </nav>
              </div>
              {showBandHeaders ? (
                groupedBoard.map((group) => (
                  <section key={group.band.key} id={`band-${group.band.key}`} className="grid scroll-mt-24 gap-2">
                    <BandHeader band={group.band} count={group.pitchers.length} />
                    {group.pitchers.map((pitcher, index) => (
                      <FormLeaderboardRow key={pitcher.pitcherId} pitcher={pitcher} rank={pitchers.indexOf(pitcher) + 1} window={window} leagueMeanGS={leaderboard.leagueMeanGS} followed={followedIds.includes(pitcher.pitcherId)} poleId={group.band.key === "onfire" && index === 0 ? "heat-fire" : group.band.key === "ice" && index === 0 ? "heat-ice" : undefined} />
                    ))}
                  </section>
                ))
              ) : (
                boardPitchers.map((pitcher, index) => (
                  <FormLeaderboardRow key={pitcher.pitcherId} pitcher={pitcher} rank={index + 1} window={window} leagueMeanGS={leaderboard.leagueMeanGS} followed={followedIds.includes(pitcher.pitcherId)} poleId={index === 0 ? "heat-fire" : index === boardPitchers.length - 1 ? "heat-ice" : undefined} />
                ))
              )}
            </section>
          </div>
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

function MoversStrip({ risers, fallers, window }: { risers: FormSummary[]; fallers: FormSummary[]; window: number }) {
  const movers = [
    ...risers.map((pitcher) => ({ pitcher, direction: "up" as const })),
    ...fallers.map((pitcher) => ({ pitcher, direction: "down" as const })),
  ];

  return (
    <section className="my-5 max-w-full overflow-hidden rounded border border-white/10 bg-[#101014] p-3" data-responsive-check="heat-movers-strip">
      <div className="flex max-w-full min-w-0 items-center gap-3 overflow-x-auto pb-1">
        <p className="shrink-0 font-mono text-xs uppercase tracking-[0.2em] text-amber-300">Movers</p>
        {movers.map(({ pitcher, direction }) => {
          const color = direction === "up" ? "#FF7A3D" : "#8FCBFF";
          const marker = direction === "up" ? "↑" : "↓";
          return (
            <a key={`${direction}-${pitcher.pitcherId}`} href={`/pitchers/${pitcher.pitcherId}/form?window=${window}`} className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs uppercase tracking-[0.12em] hover:border-amber-300/30">
              <span className="font-serif text-lg normal-case tracking-normal text-zinc-50">{lastName(pitcher.name)}</span>
              <span style={{ color }}>{marker} {formatSignedDelta(pitcher.deltaForm)}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}

type TodayStartContext = {
  opponent: string;
  side: "home" | "away";
  firstPitch: string;
  status: TonightGame["status"];
};

function MomentumHero({
  riser,
  faller,
  window,
  leagueMeanGS,
  followedIds,
  startContext,
  qualifiedCount,
  heatingCount,
  coolingCount,
}: {
  riser: FormSummary;
  faller: FormSummary;
  window: number;
  leagueMeanGS: number;
  followedIds: string[];
  startContext: Map<string, TodayStartContext>;
  qualifiedCount: number;
  heatingCount: number;
  coolingCount: number;
}) {
  return (
    <section className="my-5 overflow-hidden rounded border border-white/10 bg-[#101014]" data-responsive-check="heat-momentum-hero">
      <div className="grid gap-px bg-white/10 lg:grid-cols-2">
        <MomentumPanel role="riser" pitcher={riser} window={window} leagueMeanGS={leagueMeanGS} followed={followedIds.includes(riser.pitcherId)} start={startContext.get(riser.pitcherId) ?? null} />
        <MomentumPanel role="faller" pitcher={faller} window={window} leagueMeanGS={leagueMeanGS} followed={followedIds.includes(faller.pitcherId)} start={startContext.get(faller.pitcherId) ?? null} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 bg-black/20 px-4 py-3 font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">
        <span>{qualifiedCount} qualified</span>
        <span>{heatingCount} rising</span>
        <span>{coolingCount} falling</span>
        <span>league mean {leagueMeanGS.toFixed(1)}</span>
      </div>
    </section>
  );
}

function MomentumPanel({ role, pitcher, window, leagueMeanGS, followed, start }: { role: "riser" | "faller"; pitcher: FormSummary; window: number; leagueMeanGS: number; followed: boolean; start: TodayStartContext | null }) {
  const bandColor = HEAT_BANDS.find((band) => band.key === pitcher.tier)?.color ?? "#D85A30";
  const isRiser = role === "riser";
  const accent = isRiser ? "#FF7A3D" : "#8FCBFF";
  const marker = isRiser ? "↑" : "↓";
  const thermalBand = pitcher.windowCount >= window ? pitcher.tier : null;

  return (
    <article className="relative overflow-hidden bg-[#101014] p-4 sm:p-5" data-form-hero-card data-momentum-role={role}>
      <div className={`pointer-events-none absolute inset-0 ${isRiser ? "bg-[radial-gradient(circle_at_8%_0%,rgba(255,122,61,0.16),transparent_45%)]" : "bg-[radial-gradient(circle_at_92%_0%,rgba(143,203,255,0.16),transparent_45%)]"}`} />
      <div className="relative grid gap-4 sm:grid-cols-[92px_minmax(0,1fr)] sm:items-center">
        <Link
          href={`/pitchers/${pitcher.pitcherId}/form?window=${window}`}
          className={`thermal-headshot ${thermalHeadshotClass(thermalBand)} relative mx-auto grid h-[116px] w-[92px] place-items-center overflow-hidden rounded-xl border bg-[#15181C] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:mx-0`}
          style={{ borderColor: thermalBorderColor(thermalBand, bandColor) }}
          data-form-band={thermalBand ?? "neutral"}
        >
          <ThermalHeadshotEffects band={thermalBand} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={rankedHeadshotUrl(pitcher.pitcherId, 220)} alt={`${pitcher.name}, ${pitcher.team}`} loading="eager" className="relative h-full w-full object-contain object-bottom" />
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-xs uppercase tracking-[0.2em]" style={{ color: accent }}>{isRiser ? "Biggest riser" : "Biggest faller"}</p>
            <span className="rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ borderColor: `${bandColor}66`, color: bandColor }}>{tierLabel(pitcher.tier)}</span>
          </div>
          <Link href={`/pitchers/${pitcher.pitcherId}/form?window=${window}`} className="mt-3 block min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
            <h2 className="truncate font-serif text-3xl font-bold leading-none text-zinc-50">{pitcher.name}</h2>
            <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">{pitcher.team}</p>
          </Link>
          <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1">
            <p className="font-mono text-5xl font-black leading-none tabular-nums" style={{ color: accent }}>{marker} {formatSignedDelta(pitcher.deltaForm)}</p>
            <p className="pb-1 font-mono text-xs uppercase tracking-[0.14em] text-zinc-400">
              now Form {Math.round(pitcher.rgs)} · {tierLabel(pitcher.tier)}
            </p>
          </div>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <FormSparkline values={pitcher.spark} tier={pitcher.tier} leagueMeanGS={leagueMeanGS} label={`${pitcher.name} last ${pitcher.windowCount} starts GS+: ${pitcher.spark.join(", ")}`} trend={pitcher.trend} variant="hero" intensity="pole" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
            <MomentumContextLine pitcher={pitcher} start={start} />
            <FollowPitcherButton pitcherId={pitcher.pitcherId} pitcherName={pitcher.name} initialFollowing={followed} compact />
          </div>
        </div>
      </div>
    </article>
  );
}

function MomentumContextLine({ pitcher, start }: { pitcher: FormSummary; start: TodayStartContext | null }) {
  if (start) {
    const matchup = start.side === "away" ? `@ ${start.opponent}` : `vs ${start.opponent}`;
    return (
      <p className="font-mono text-xs uppercase tracking-[0.12em] text-teal-300">
        Starts today {matchup} · {formatPacificTime(start.firstPitch)}
      </p>
    );
  }

  return (
    <p className="font-mono text-xs uppercase tracking-[0.12em] text-zinc-500">
      Last: {pitcher.lastStart?.gsPlus ?? "--"} vs {pitcher.lastStart?.opp ?? "TBD"}{pitcher.lastStart ? ` (${formatMonthDay(pitcher.lastStart.gameDate)})` : ""}
    </p>
  );
}

function buildTodayStartContext(games: TonightGame[]) {
  const context = new Map<string, TodayStartContext>();

  for (const game of games) {
    for (const starter of game.starters) {
      if (!starter.pitcherId) continue;
      context.set(starter.pitcherId, {
        opponent: starter.side === "away" ? game.home : game.away,
        side: starter.side,
        firstPitch: game.firstPitch,
        status: game.status,
      });
    }
  }

  return context;
}

function compareRisers(a: FormSummary, b: FormSummary, startContext: Map<string, TodayStartContext>) {
  return b.deltaForm - a.deltaForm || Number(startContext.has(b.pitcherId)) - Number(startContext.has(a.pitcherId)) || b.rgs - a.rgs || a.name.localeCompare(b.name);
}

function compareFallers(a: FormSummary, b: FormSummary, startContext: Map<string, TodayStartContext>) {
  return a.deltaForm - b.deltaForm || Number(startContext.has(b.pitcherId)) - Number(startContext.has(a.pitcherId)) || b.rgs - a.rgs || a.name.localeCompare(b.name);
}

function FormLeaderboardRow({ pitcher, rank, window, leagueMeanGS, followed, poleId }: { pitcher: FormSummary; rank: number; window: number; leagueMeanGS: number; followed: boolean; poleId?: string }) {
  const bandColor = HEAT_BANDS.find((band) => band.key === pitcher.tier)?.color ?? "#888780";
  const treatment = rowTreatment(pitcher);
  const lastLine = pitcher.lastStart
    ? `Last GS+ ${pitcher.lastStart.gsPlus} vs ${pitcher.lastStart.opp} / ${formatStartLine({ inningsPitched: pitcher.lastStart.ip, hits: pitcher.lastStart.h, earnedRuns: pitcher.lastStart.er, walks: pitcher.lastStart.bb, strikeouts: pitcher.lastStart.k, pitches: 0 })}`
    : "Last start unavailable";
  const fullWindow = pitcher.windowCount >= window;
  const thermalBand = fullWindow ? pitcher.tier : null;

  return (
    <article
      id={poleId}
      className={`heat-check-row scroll-mt-24 grid items-center gap-x-4 gap-y-2 rounded border border-l-4 bg-[#101014] px-4 transition hover:bg-white/[0.04] sm:px-5 ${treatment.gridClass} ${treatment.padding} ${treatment.borderClass} ${treatment.opacity} ${isPoleTier(pitcher) && fullWindow ? "heat-glow-card" : ""}`}
      style={{ ...(isPoleTier(pitcher) && fullWindow ? heatGlowStyle(pitcher) : {}), borderLeftColor: bandColor }}
      data-form-row
      data-heat-band={pitcher.tier}
    >
      <div className="min-w-0">
        <p className={`${treatment.rankClass} font-serif leading-none text-zinc-500`}>#{rank}</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: bandColor }}>{tierLabel(pitcher.tier)}</p>
      </div>
      <Link href={`/pitchers/${pitcher.pitcherId}/form?window=${window}`} className={`${treatment.plateClass} thermal-headshot ${thermalHeadshotClass(thermalBand)} relative grid place-items-center overflow-hidden rounded-xl border bg-[#15181C] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300`} style={{ borderColor: thermalBorderColor(thermalBand, bandColor) }} data-form-band={thermalBand ?? "neutral"}>
        <ThermalHeadshotEffects band={thermalBand} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={rankedHeadshotUrl(pitcher.pitcherId, treatment.imageWidth)} alt={`${pitcher.name}, ${pitcher.team}`} loading="lazy" className={`relative h-full w-full object-contain object-bottom ${treatment.imageClass}`} />
      </Link>
      <Link href={`/pitchers/${pitcher.pitcherId}/form?window=${window}`} className="grid min-w-0 overflow-hidden gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
        <h2 className={`${treatment.nameClass} font-serif font-bold leading-tight text-zinc-50`}>{pitcher.name}</h2>
        <p className={`truncate font-mono text-[10px] uppercase tracking-[0.14em] ${treatment.metaClass}`}>
          {pitcher.team} / {pitcher.windowCount} of {window} / {lastLine}
          {isStartingToday(pitcher) ? <span className="ml-2 text-teal-300">Starting today</span> : null}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <FormDriverChips chips={pitcher.driverChips} compact />
        </div>
      </Link>
      <div className="col-span-full row-start-2 grid min-w-0 grid-cols-[auto_minmax(120px,1fr)] items-center gap-2 sm:col-span-1 sm:row-auto sm:grid-cols-1">
        <div className="min-w-0 sm:justify-self-end">{fullWindow ? <TrendChip summary={pitcher} compact /> : <InsufficientTrend windowCount={pitcher.windowCount} window={window} />}</div>
        <FormSparkline
          values={pitcher.spark}
          tier={pitcher.tier}
          leagueMeanGS={leagueMeanGS}
          label={`Last ${pitcher.windowCount} starts GS+: ${pitcher.spark.join(", ")}`}
          trend={pitcher.trend}
          intensity={isPoleTier(pitcher) && fullWindow ? "pole" : "field"}
        />
      </div>
      <div className="col-start-4 row-start-1 flex items-center justify-end gap-2 text-right sm:col-auto sm:row-auto">
        <div className="hidden sm:block">
          <FollowPitcherButton pitcherId={pitcher.pitcherId} pitcherName={pitcher.name} initialFollowing={followed} compact />
        </div>
        <Link href={`/pitchers/${pitcher.pitcherId}/form?window=${window}`} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
          <p className={`${treatment.scoreClass} font-mono font-black leading-none tabular-nums`} style={{ color: bandColor }}>{Math.round(pitcher.rgs)}</p>
          <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">Form</span>
        </Link>
      </div>
    </article>
  );
}

function ThermalHeadshotEffects({ band }: { band: FormTier | null }) {
  if (band === "onfire") {
    return (
      <>
        <span className="thermal-headshot__flames" aria-hidden="true" />
        <span className="thermal-headshot__tint" aria-hidden="true" />
      </>
    );
  }
  if (band === "ice") {
    return (
      <>
        <span className="thermal-headshot__frost" aria-hidden="true" />
        <span className="thermal-headshot__tint" aria-hidden="true" />
      </>
    );
  }
  return null;
}

function thermalHeadshotClass(band: FormTier | null) {
  return band ? `thermal-headshot--${band}` : "thermal-headshot--neutral";
}

function thermalBorderColor(band: FormTier | null, fallback: string) {
  if (band === "onfire") return "#FF3B1F";
  if (band === "hot") return "#FF8A3D";
  if (band === "cooling") return "#5BA8FF";
  if (band === "ice") return "#8FCBFF";
  return fallback;
}

function TemperatureRail({ bands, total, params }: { bands: Array<HeatBand & { count: number }>; total: number; params: Record<string, string | undefined> }) {
  return (
    <aside className="hidden lg:block">
      <nav className="sticky top-4 grid gap-1 rounded border border-white/10 bg-[#101014]/90 p-2 font-mono text-[10px] uppercase tracking-[0.12em]" aria-label="Heat zones">
        {bands.filter((band) => band.count > 0).map((band) => {
          const height = Math.max(34, total > 0 ? (band.count / total) * 280 : 34);
          return (
            <Link key={band.key} href={heatCheckHref({ ...params, band: band.key })} className="flex items-end justify-center rounded border border-white/10 px-1 py-2 text-center text-zinc-950" style={{ minHeight: height, backgroundColor: band.color }} aria-label={`${band.label}: ${band.count} pitchers`}>
              <span className="[writing-mode:vertical-rl]">{band.label} {band.count}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function BandHeader({ band, count }: { band: HeatBand; count: number }) {
  return (
    <div className="sticky top-0 z-10 mt-6 mb-3 flex items-center gap-3 bg-[#08080a]/92 py-2 backdrop-blur" data-heat-band-header={band.key}>
      <p className="font-mono text-xs uppercase tracking-[0.18em]" style={{ color: band.color }}>{band.label} · {count}</p>
      <span className="h-px flex-1" style={{ backgroundColor: band.color }} />
    </div>
  );
}

function groupPitchersByBand(pitchers: FormSummary[]) {
  return HEAT_BANDS.map((band) => ({
    band,
    pitchers: pitchers.filter((pitcher) => pitcher.tier === band.key),
  })).filter((group) => group.pitchers.length > 0);
}

function rowTreatment(pitcher: FormSummary): {
  padding: string;
  opacity: string;
  rankClass: string;
  gridClass: string;
  plateClass: string;
  borderClass: string;
  imageWidth: number;
  imageClass: string;
  nameClass: string;
  scoreClass: string;
  metaClass: string;
} {
  if (pitcher.tier === "onfire") {
    return { padding: "py-4 sm:py-[18px]", opacity: "", rankClass: "text-3xl", gridClass: "grid-cols-[44px_64px_minmax(0,1fr)_auto] sm:grid-cols-[44px_64px_minmax(0,1fr)_150px_auto]", plateClass: "h-20 w-16", borderClass: "border-white/10", imageWidth: 160, imageClass: "", nameClass: "text-xl sm:text-2xl", scoreClass: "text-4xl sm:text-[44px]", metaClass: "text-zinc-400" };
  }
  if (pitcher.tier === "hot") {
    return { padding: "py-4 sm:py-[18px]", opacity: "", rankClass: "text-3xl", gridClass: "grid-cols-[44px_64px_minmax(0,1fr)_auto] sm:grid-cols-[44px_64px_minmax(0,1fr)_150px_auto]", plateClass: "h-20 w-16", borderClass: "border-white/10", imageWidth: 140, imageClass: "", nameClass: "text-xl sm:text-2xl", scoreClass: "text-4xl sm:text-[44px]", metaClass: "text-zinc-400" };
  }
  if (pitcher.tier === "cooling") {
    return { padding: "py-3", opacity: "opacity-90", rankClass: "text-xl", gridClass: "grid-cols-[44px_44px_minmax(0,1fr)_auto] sm:grid-cols-[44px_44px_minmax(0,1fr)_132px_auto]", plateClass: "h-[55px] w-11", borderClass: "border-white/10 sm:border-x-0 sm:border-t-0 sm:rounded-none", imageWidth: 90, imageClass: "", nameClass: "text-lg", scoreClass: "text-[30px]", metaClass: "text-zinc-500" };
  }
  if (pitcher.tier === "ice") {
    return { padding: "py-2.5", opacity: "opacity-85", rankClass: "text-lg", gridClass: "grid-cols-[44px_40px_minmax(0,1fr)_auto] sm:grid-cols-[44px_40px_minmax(0,1fr)_120px_auto]", plateClass: "h-[50px] w-10", borderClass: "border-white/5 sm:border-x-0 sm:border-t-0 sm:rounded-none", imageWidth: 80, imageClass: "", nameClass: "text-base sm:text-lg", scoreClass: "text-[28px]", metaClass: "text-zinc-500" };
  }
  return { padding: "py-3 sm:py-3.5", opacity: "", rankClass: "text-2xl", gridClass: "grid-cols-[44px_52px_minmax(0,1fr)_auto] sm:grid-cols-[44px_52px_minmax(0,1fr)_140px_auto]", plateClass: "h-[65px] w-[52px]", borderClass: "border-white/10 sm:border-x-0 sm:border-t-0 sm:rounded-none", imageWidth: 120, imageClass: "", nameClass: "text-xl", scoreClass: "text-[36px]", metaClass: "text-zinc-500" };
}

function isPoleTier(pitcher: FormSummary) {
  return pitcher.tier === "onfire" || pitcher.tier === "hot" || pitcher.tier === "ice";
}

function rankedHeadshotUrl(pitcherId: string, width: number) {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_${width},q_auto:best/v1/people/${pitcherId}/headshot/67/current`;
}

function lastName(name: string) {
  return name.trim().split(/\s+/).at(-1) ?? name;
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

function formatSignedDelta(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function formatPacificTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "time TBD";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
    timeZoneName: "short",
  }).format(date).replace("PDT", "PT").replace("PST", "PT");
}

function formatMonthDay(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);
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
