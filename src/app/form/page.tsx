import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { FastFilterLink } from "@/components/fast-filter-link";
import { FollowPitcherButton } from "@/components/follow-pitcher-button";
import { FormDriverChips } from "@/components/form-driver-chips";
import { FormSparkline, tierLabel } from "@/components/form-visuals";
import { Headshot } from "@/components/headshot";
import { HeatCheckBandNav } from "@/components/heat-check-band-nav";
import { HeatCheckEscapeClear } from "@/components/heat-check-escape-clear";
import { HeatCheckFilterLink } from "@/components/heat-check-filter-link";
import { HeatCheckFilterWarmup } from "@/components/heat-check-filter-warmup";
import { HeatCheckScrollReset } from "@/components/heat-check-scroll-reset";
import { HeatPitcherProfileLink } from "@/components/heat-pitcher-profile-link";
import { HeatTeamClearLink } from "@/components/heat-team-clear-link";
import { HeatTeamDrawer } from "@/components/heat-team-drawer";
import { HeatTeamJumpMenu } from "@/components/heat-team-jump-menu";
import { PageContextStrip } from "@/components/page-context-strip";
import { PitcherAvailabilityNote } from "@/components/pitcher-availability";
import { SiteHeader } from "@/components/site-header";
import { getFormLeaderboard, parseFormWindow } from "@/lib/data/form-service";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { getTonightMustWatch } from "@/lib/data/tonight-service";
import { WATCHLIST_COOKIE, getWatchlistPitcherIds } from "@/lib/data/watchlist-service";
import { formPageDescription, formPageTitle, jsonLdForFormPage } from "@/lib/form-metadata";
import { FORM_CONFIG, HEAT_BANDS, formDeltaBand, qualityTierOf } from "@/lib/form-tokens";
import { formatStartLine } from "@/lib/format";
import { pitcherHref, sourceParams } from "@/lib/routes";
import { jsonLdScript, noIndexFollow } from "@/lib/seo";
import { gameTimeWord } from "@/lib/time-words";
import type { FormSummary, HeatBand, TonightGame } from "@/lib/types";
import type React from "react";

type FormPageProps = {
  searchParams?: Promise<{
    window?: string;
    sort?: string;
    team?: string;
    q?: string;
    qualified?: string;
    band?: string;
    motion?: string;
    even?: string;
    hot?: string;
    cooling?: string;
    view?: string;
    show?: string;
  }>;
};

type HeatCheckView = "trend" | "season";

const sortOptions = [
  { key: "form", label: "Direction" },
  { key: "risers", label: "Risers" },
  { key: "fallers", label: "Fallers" },
] as const;

function parseHeatCheckView(value: string | undefined): HeatCheckView {
  return value === "season" ? "season" : "trend";
}

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
  const view = parseHeatCheckView(params?.view);
  const trendView = view === "trend";
  const seasonView = view === "season";
  const sort = sortOptions.some((option) => option.key === params?.sort) ? params?.sort ?? "form" : "form";
  const team = params?.team ?? "";
  const query = (params?.q ?? "").trim().toLowerCase();
  const qualifiedOnly = params?.qualified !== "false";
  const band = HEAT_BANDS.some((candidate) => candidate.key === params?.band) ? params?.band ?? "" : "";
  const motion = params?.motion === "rising" || params?.motion === "falling" ? params.motion : "";
  const evenExpanded = Boolean(team) || params?.even === "show" || band === "even" || sort !== "form";
  const heatingExpanded = Boolean(team) || params?.hot === "show" || band === "hot" || sort !== "form";
  const coolingExpanded = Boolean(team) || params?.cooling === "show" || band === "cooling" || sort !== "form";
  const accountId = (await cookies()).get(WATCHLIST_COOKIE)?.value ?? null;
  const today = getHomeSlateDate();
  const [leaderboard, followedIds, tonight] = await Promise.all([
    getFormLeaderboard({ window, qualifiedOnly: team ? false : qualifiedOnly, team }),
    getWatchlistPitcherIds(accountId),
    getTonightMustWatch({ date: today, window }),
  ]);
  const jsonLd = jsonLdForFormPage(leaderboard);
  const rankedDate = addDays(today, -1);
  const startContext = buildTodayStartContext(tonight.games);
  const teams = [...new Set(leaderboard.pitchers.map((pitcher) => pitcher.team).filter(Boolean))].sort();
  const trendPitchers = leaderboard.pitchers
    .filter((pitcher) => !team || pitcher.team === team)
    .filter((pitcher) => !query || pitcher.name.toLowerCase().includes(query))
    .filter((pitcher) => !band || pitcher.tier === band)
    .filter((pitcher) => !motion || (motion === "rising" ? pitcher.trend === "heating" : pitcher.trend === "cooling"))
    .sort((a, b) => {
      const aLimited = a.windowCount < window;
      const bLimited = b.windowCount < window;
      if (sort === "risers") return Number(aLimited) - Number(bLimited) || compareMovementRise(a, b);
      if (sort === "fallers") return Number(aLimited) - Number(bLimited) || compareMovementFall(a, b);
      return Number(aLimited) - Number(bLimited) || compareRollingFormLevelRank(a, b);
    });
  const seasonPitchers = leaderboard.pitchers
    .filter((pitcher) => !team || pitcher.team === team)
    .filter((pitcher) => !query || pitcher.name.toLowerCase().includes(query))
    .sort(compareSeasonGsRank);
  const pitchers = trendView ? trendPitchers : seasonPitchers;
  const qualifiedPitchers = leaderboard.pitchers.filter((pitcher) => pitcher.status === "ok");
  const formRankByPitcherId = buildGlobalFormRankMap(qualifiedPitchers);
  const seasonRankByPitcherId = buildGlobalSeasonRankMap(qualifiedPitchers);
  const leagueBandCounts = HEAT_BANDS.map((candidate) => ({
    ...candidate,
    count: qualifiedPitchers.filter((pitcher) => pitcher.tier === candidate.key).length,
  }));
  const heroCandidates = qualifiedPitchers;
  const riserCandidates = [...heroCandidates].sort((a, b) => compareMovementRisers(a, b, startContext));
  const fallerCandidates = [...heroCandidates].sort((a, b) => compareMovementFallers(a, b, startContext));
  const biggestRiser = riserCandidates[0] ?? null;
  const biggestFaller = fallerCandidates[0] ?? null;
  const heroIds = new Set([biggestRiser?.pitcherId, biggestFaller?.pitcherId].filter((id): id is string => Boolean(id)));
  const allTeamsView = !team;
  const leagueView = allTeamsView && trendView;
  const boardPitchers = pitchers;
  const seasonVisiblePitchers = visibleSeasonPitchers(seasonPitchers, team, params?.show);
  const groupedBoard = groupPitchersByBand(boardPitchers);
  const showBandHeaders = leagueView && sort === "form";
  const risers = riserCandidates.filter((pitcher) => !heroIds.has(pitcher.pitcherId)).slice(0, 3);
  const fallers = fallerCandidates.filter((pitcher) => !heroIds.has(pitcher.pitcherId)).slice(0, 3);
  const activeFilterLabel = buildActiveFilterLabel({ band, motion, team, query });
  const clearFilterHref = heatCheckHref({ ...params, band: "", motion: "", team: "", q: "", even: "", hot: "", cooling: "" });
  const filteredTotal = team ? leaderboard.pitchers.filter((pitcher) => pitcher.team === team).length : qualifiedPitchers.length;
  const filteredCountLabel = team && pitchers.length === filteredTotal ? `${pitchers.length} starters` : `${pitchers.length} of ${filteredTotal}`;
  const throughPrefix = seasonView ? "Season through" : "Form through";
  const formThroughLabel = `${throughPrefix} ${leaderboard.formThroughDate ?? "pending"}${leaderboard.stale && leaderboard.latestScoredStartDate ? ` / updating from ${leaderboard.latestScoredStartDate}` : ""}`;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8">
      <script type="application/ld+json" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <HeatCheckScrollReset />
      <HeatCheckFilterWarmup activeTeam={team} />
      {activeFilterLabel !== "All arms" ? <HeatCheckEscapeClear href={clearFilterHref} /> : null}
      <div className="mx-auto max-w-7xl">
        <header>
          <SiteHeader active="heat" today={today} rankedDate={rankedDate} />
          <h1 className="mt-4 font-serif text-5xl font-black text-zinc-50">Heat Check</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            {trendView ? <>How starting pitchers are trending over their last {window} starts.</> : <>Starting pitchers ranked by season GS+.</>}
          </p>
        </header>

        <section className="relative z-40 mb-5 mt-4 rounded border border-white/10 bg-[#101014]/95 p-4 backdrop-blur" data-responsive-check="heat-primary-controls">
          <TeamFilterControl teams={teams} activeTeam={team} params={params ?? {}} window={window} view={view} formThroughLabel={formThroughLabel} stale={leaderboard.stale} />
        </section>

        {trendView && leagueView && biggestRiser && biggestFaller ? (
          <section className="relative z-0 grid gap-4" data-responsive-check="heat-league-pulse">
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
            <div className="mt-5 grid grid-cols-2 gap-3 font-mono text-xs sm:grid-cols-4" data-responsive-check="heat-league-stat-strip">
              <SummaryStat label="Rising" value={String(leaderboard.heatingCount)} />
              <SummaryStat label="Falling" value={String(leaderboard.coolingCount)} />
              <SummaryStat label="Even" value={String(leagueBandCounts.find((candidate) => candidate.key === "even")?.count ?? 0)} />
              <SummaryStat label="League mean GS+" value={leaderboard.leagueMeanGS.toFixed(1)} />
            </div>
            <MoversStrip risers={risers} fallers={fallers} params={params ?? {}} />
          </section>
        ) : null}

        {trendView && leagueView ? (
          <section className="z-20 my-5 rounded border border-white/10 bg-[#101014]/95 p-4 backdrop-blur sm:sticky sm:top-0" data-responsive-check="form-controls">
            {!team && activeFilterLabel !== "All arms" ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em]" data-responsive-check="heat-filter-status">
                <Link href={clearFilterHref} className="text-amber-300 hover:text-amber-200">
                  <span>Showing {activeFilterLabel} · {filteredCountLabel}</span>
                  <span className="mt-1 block sm:mt-0 sm:inline">
                    <span className="hidden sm:inline"> · </span>
                    {"✕"} Show all
                  </span>
                </Link>
              </div>
            ) : null}
            <BandDistribution bands={leagueBandCounts} total={qualifiedPitchers.length} activeBand={band} params={params ?? {}} />
            <details>
              <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.16em] text-amber-300 marker:text-amber-300">
                Filters / {sortOptions.find((option) => option.key === sort)?.label ?? "Form"} / {band ? HEAT_BANDS.find((candidate) => candidate.key === band)?.label : "All bands"}
              </summary>
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
                <div className="grid gap-3" data-control-role="filter">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Filter</p>
                  <ControlGroup label="Band">
                    <ControlLink active={!band} href={heatCheckHref({ ...params, band: "" })}>All</ControlLink>
                    {HEAT_BANDS.map((candidate) => (
                      <ControlLink key={candidate.key} active={band === candidate.key} href={heatCheckHref({ ...params, band: band === candidate.key ? "" : candidate.key })}>{candidate.label}</ControlLink>
                    ))}
                  </ControlGroup>
                  <ControlGroup label="Momentum">
                    <ControlLink active={!motion} href={heatCheckHref({ ...params, motion: "" })}>All motion</ControlLink>
                    <ControlLink active={motion === "rising"} href={heatCheckHref({ ...params, motion: "rising" })}>Rising ({leaderboard.heatingCount})</ControlLink>
                    <ControlLink active={motion === "falling"} href={heatCheckHref({ ...params, motion: "falling" })}>Falling ({leaderboard.coolingCount})</ControlLink>
                  </ControlGroup>
                </div>
                <div className="grid gap-3" data-control-role="sort-window">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Sort</p>
                  <ControlGroup label="Sort">
                    {sortOptions.map((option) => <ControlLink key={option.key} active={sort === option.key} href={heatCheckHref({ ...params, sort: option.key })}>{option.label}</ControlLink>)}
                  </ControlGroup>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <ControlLink active={qualifiedOnly} href={heatCheckHref({ ...params, qualified: qualifiedOnly ? "false" : "true" })}>Qualified</ControlLink>
                  </div>
                </div>
              </div>
              <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]" action="/heat-check">
                <input type="hidden" name="window" value={String(window)} />
                <input type="hidden" name="sort" value={sort} />
                <input type="hidden" name="qualified" value={String(qualifiedOnly)} />
                {band ? <input type="hidden" name="band" value={band} /> : null}
                {motion ? <input type="hidden" name="motion" value={motion} /> : null}
                {team ? <input type="hidden" name="team" value={team} /> : null}
                <input name="q" defaultValue={params?.q ?? ""} placeholder="Search pitcher" className="min-h-11 rounded border border-white/10 bg-black/20 px-3 font-mono text-sm text-zinc-100 outline-none focus:border-amber-300" />
                <button className="min-h-11 rounded border border-amber-300/40 px-4 font-mono text-xs uppercase tracking-[0.16em] text-amber-300">Search</button>
              </form>
            </details>
          </section>
        ) : null}

        {seasonView && allTeamsView ? (
          <SeasonBoardControls params={params ?? {}} qualifiedOnly={qualifiedOnly} />
        ) : null}

        {pitchers.length === 0 ? (
          <section className="rounded border border-white/10 bg-[#101014] p-6" data-responsive-check="heat-empty-filter">
            <p className="font-mono text-sm uppercase tracking-[0.14em] text-zinc-300">
              {band ? `No arms in ${HEAT_BANDS.find((candidate) => candidate.key === band)?.label ?? "this band"}` : "No arms match these filters"}
              <Link href={clearFilterHref} className="ml-2 text-amber-300 hover:text-amber-200">· Clear</Link>
            </p>
          </section>
        ) : (
          <div id="full-board" className="grid gap-4 scroll-mt-8" data-responsive-check="form-leaderboard">
            {trendView && leagueView ? <HeatCheckBandNav bands={leagueBandCounts} /> : null}
            <section className="grid gap-2">
              {seasonView ? (
                <>
                  {seasonVisiblePitchers.map((pitcher) => (
                    <FormLeaderboardRow key={pitcher.pitcherId} pitcher={pitcher} rank={seasonRankByPitcherId.get(pitcher.pitcherId) ?? 0} window={window} leagueMeanGS={leaderboard.leagueMeanGS} followed={followedIds.includes(pitcher.pitcherId)} view="season" />
                  ))}
                  <SeasonExpandControls visible={seasonVisiblePitchers.length} total={seasonPitchers.length} params={params ?? {}} team={team} />
                </>
              ) : showBandHeaders ? (
                groupedBoard.map((group) => (
                  <section key={group.band.key} id={`band-${group.band.key}`} className="grid scroll-mt-24 gap-2">
                    <BandHeader band={group.band} count={group.pitchers.length} />
                    {group.band.key === "even" && !evenExpanded ? (
                      <EvenBandCollapsed count={group.pitchers.length} href={heatCheckHref({ ...params, even: "show" })} />
                    ) : (
                      <>
                        {group.band.key === "even" ? <EvenBandExpanded count={group.pitchers.length} href={heatCheckHref({ ...params, even: "" })} /> : null}
                        {bandEmptyMessage(group.band, group.pitchers.length) ? <BandEmptyState message={bandEmptyMessage(group.band, group.pitchers.length) ?? ""} /> : null}
                        {bandExpandableControl(group.band.key, group.pitchers.length, params ?? {}, { heatingExpanded, coolingExpanded })}
                        {visibleBandPitchers(group.band.key, group.pitchers, { heatingExpanded, coolingExpanded }).map((pitcher, index) => (
                          <FormLeaderboardRow key={pitcher.pitcherId} pitcher={pitcher} rank={formRankByPitcherId.get(pitcher.pitcherId) ?? 0} window={window} leagueMeanGS={leaderboard.leagueMeanGS} followed={followedIds.includes(pitcher.pitcherId)} poleId={group.band.key === "onfire" && index === 0 ? "heat-fire" : group.band.key === "ice" && index === 0 ? "heat-ice" : undefined} view="trend" />
                        ))}
                      </>
                    )}
                  </section>
                ))
              ) : (
                boardPitchers.map((pitcher, index) => (
                  <FormLeaderboardRow key={pitcher.pitcherId} pitcher={pitcher} rank={formRankByPitcherId.get(pitcher.pitcherId) ?? index + 1} window={window} leagueMeanGS={leaderboard.leagueMeanGS} followed={followedIds.includes(pitcher.pitcherId)} poleId={index === 0 ? "heat-fire" : index === boardPitchers.length - 1 ? "heat-ice" : undefined} view="trend" />
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

function BandDistribution({ bands, total, activeBand, params }: { bands: Array<HeatBand & { count: number }>; total: number; activeBand: string; params: Record<string, string | undefined> }) {
  const onFire = bands.find((band) => band.key === "onfire")?.count ?? 0;
  const ice = bands.find((band) => band.key === "ice")?.count ?? 0;
  return (
    <div className="mt-6 rounded border border-white/10 bg-[#101014] p-4" data-responsive-check="heat-band-distribution" data-temperature-job="filter">
      <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="mb-[5px] font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">League temperature</p>
          <p className="font-serif text-3xl font-bold text-zinc-50">{onFire} on fire · {ice} ice cold</p>
        </div>
        <p className="font-mono text-xs text-zinc-500">{activeBand ? "Click the active segment again to show all" : "Click a segment to filter · league totals stay visible"}</p>
      </div>
      <div className="flex h-12 overflow-hidden rounded border border-white/10">
        {bands.map((band) => {
          const width = total > 0 ? (band.count / total) * 100 : 0;
          const active = activeBand === band.key;
          const dimmed = activeBand && !active;
          return (
            <FastFilterLink
              key={band.key}
              href={heatCheckHref({ ...params, band: active ? "" : band.key })}
              className={`heat-band-fill flex min-w-[2px] items-center justify-center font-mono text-xs font-semibold text-[#08080a] transition ${active ? "ring-2 ring-white/80 ring-inset" : ""} ${dimmed ? "opacity-35" : ""}`}
              style={{ width: `${width}%`, backgroundColor: band.color }}
              ariaLabel={active ? `Show all pitchers, clearing ${band.label} filter` : `Filter to ${band.label}: ${band.count} of ${total} qualified pitchers`}
              scroll={false}
            >
              {width >= 7 ? band.count : null}
            </FastFilterLink>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500 sm:grid-cols-6">
        <FastFilterLink href={heatCheckHref({ ...params, band: "" })} className={`flex items-center justify-between gap-2 rounded border px-2 py-1 ${!activeBand ? "border-white/60 bg-white/10 text-zinc-100" : "border-white/10 text-zinc-400"}`} ariaCurrent={!activeBand ? "page" : undefined} scroll={false}>
          <span>All</span>
          <span className="text-zinc-300">{total}</span>
        </FastFilterLink>
        {bands.map((band) => (
          <FastFilterLink key={band.key} href={heatCheckHref({ ...params, band: activeBand === band.key ? "" : band.key })} className={`flex items-center justify-between gap-2 rounded border px-2 py-1 ${activeBand === band.key ? "border-white/60 text-zinc-100" : "border-white/10"}`} ariaCurrent={activeBand === band.key ? "page" : undefined} scroll={false}>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: band.color }} />
              {band.label}
            </span>
            <span className="text-zinc-300">{band.count}</span>
          </FastFilterLink>
        ))}
      </div>
    </div>
  );
}

function MoversStrip({ risers, fallers, params }: { risers: FormSummary[]; fallers: FormSummary[]; params: Record<string, string | undefined> }) {
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
            <FastFilterLink key={`${direction}-${pitcher.pitcherId}`} href={heatCheckHref({ ...params, motion: direction === "up" ? "rising" : "falling" })} className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs uppercase tracking-[0.12em] hover:border-amber-300/30" scroll={false}>
              <span className="font-serif text-lg normal-case tracking-normal text-zinc-50">{lastName(pitcher.name)}</span>
              <span style={{ color }}>{marker} {formatSignedDelta(pitcher.deltaForm)}</span>
            </FastFilterLink>
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
  const profileHref = pitcherHref(pitcher, sourceParams("heat", { window }));

  return (
    <article className="relative overflow-hidden bg-[#101014] p-4 sm:p-5" data-form-hero-card data-momentum-role={role}>
      <div className={`pointer-events-none absolute inset-0 ${isRiser ? "bg-[radial-gradient(circle_at_8%_0%,rgba(255,122,61,0.16),transparent_45%)]" : "bg-[radial-gradient(circle_at_92%_0%,rgba(143,203,255,0.16),transparent_45%)]"}`} />
      <div className="relative grid grid-cols-[64px_minmax(0,1fr)] items-start gap-x-2 gap-y-3 sm:grid-cols-[92px_minmax(0,1fr)] sm:gap-4 sm:items-center">
        <HeatPitcherProfileLink
          href={profileHref}
          className="relative col-start-1 row-start-1 block focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:hidden"
          ariaLabel={`Open ${pitcher.name} form page`}
        >
          <Headshot playerId={pitcher.pitcherId} name={pitcher.name} team={pitcher.team} size="xl" band={thermalBand} sampleSufficient={pitcher.windowCount >= window} loading="eager" decorative />
        </HeatPitcherProfileLink>
        <HeatPitcherProfileLink
          href={profileHref}
          className="relative hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:block"
          ariaLabel={`Open ${pitcher.name} form page`}
        >
          <Headshot playerId={pitcher.pitcherId} name={pitcher.name} team={pitcher.team} size="xl" band={thermalBand} sampleSufficient={pitcher.windowCount >= window} loading="eager" decorative className="ml-1" />
        </HeatPitcherProfileLink>
        <div className="col-start-2 row-start-1 min-w-0 sm:col-start-auto sm:row-start-auto">
          <div className="flex flex-wrap items-start justify-between gap-2 sm:items-center sm:gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] sm:text-xs sm:tracking-[0.2em]" style={{ color: accent }}>{isRiser ? "Biggest riser" : "Biggest faller"}</p>
            <span className="rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ borderColor: `${bandColor}66`, color: bandColor }}>{tierLabel(pitcher.tier)}</span>
          </div>
          <HeatPitcherProfileLink href={profileHref} className="mt-2 block min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:mt-3">
            <h2 className="truncate font-serif text-xl font-bold leading-none text-zinc-50 sm:text-3xl">{pitcher.name}</h2>
            <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">{pitcher.team}</p>
            <PitcherAvailabilityNote availability={pitcher.availability} compact className="mt-2" />
          </HeatPitcherProfileLink>
          <div className="mt-2 grid gap-1 sm:mt-4 sm:flex sm:flex-wrap sm:items-end sm:gap-x-3 sm:gap-y-1">
            <p className="font-mono text-[34px] font-black leading-none tabular-nums sm:text-5xl" style={{ color: accent }}>{marker} {formatSignedDelta(pitcher.deltaForm)}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 sm:pb-1 sm:text-xs sm:tracking-[0.14em]">
              now Form {Math.round(pitcher.rgs)} · {tierLabel(pitcher.tier)}
            </p>
          </div>
        </div>
        <div className="col-span-full row-start-2 min-w-0 sm:row-start-auto sm:col-span-2">
          <FormSparkline values={formSparkValues(pitcher)} tier={pitcher.tier} leagueMeanGS={leagueMeanGS} baselineValue={formSparkBaseline(pitcher)} deltaForm={pitcher.deltaForm} window={window} label={formSparklineLabel(pitcher, window)} trend={pitcher.trend} variant="hero" intensity="pole" />
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
        Starts {gameTimeWord(start)} {matchup} · {formatPacificTime(start.firstPitch)}
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

function compareMovementRisers(a: FormSummary, b: FormSummary, startContext: Map<string, TodayStartContext>) {
  return compareMovementRise(a, b) || Number(startContext.has(b.pitcherId)) - Number(startContext.has(a.pitcherId));
}

function compareMovementFallers(a: FormSummary, b: FormSummary, startContext: Map<string, TodayStartContext>) {
  return compareMovementFall(a, b) || Number(startContext.has(b.pitcherId)) - Number(startContext.has(a.pitcherId));
}

function compareMovementRise(a: FormSummary, b: FormSummary) {
  return b.deltaForm - a.deltaForm || compareRollingFormLevelRank(a, b);
}

function compareMovementFall(a: FormSummary, b: FormSummary) {
  return a.deltaForm - b.deltaForm || compareRollingFormLevelRank(a, b);
}

function CrossoverPill({ pitcher }: { pitcher: FormSummary }) {
  const rising = pitcher.tier === "onfire" || pitcher.tier === "hot";
  const falling = pitcher.tier === "cooling" || pitcher.tier === "ice";
  const buyLow = rising && pitcher.rgs < FORM_CONFIG.buyLowGsPlusMax;
  const sellHigh = falling && pitcher.rgs >= FORM_CONFIG.sellHighGsPlusMin;
  if (!buyLow && !sellHigh) return null;

  return (
    <span className={`inline-flex items-center rounded border px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] ${buyLow ? "border-teal-300/35 text-teal-300" : "border-amber-300/35 text-amber-300"}`}>
      {buyLow ? "BUY-LOW" : "SELL-HIGH"}
    </span>
  );
}

function FormLeaderboardRow({ pitcher, rank, window, leagueMeanGS, followed, poleId, view }: { pitcher: FormSummary; rank: number; window: number; leagueMeanGS: number; followed: boolean; poleId?: string; view: HeatCheckView }) {
  const seasonView = view === "season";
  const qualityTier = qualityTierOf(pitcher.bgs);
  const bandColor = seasonView ? qualityTier.color : HEAT_BANDS.find((band) => band.key === pitcher.tier)?.color ?? "#888780";
  const treatment = seasonView ? seasonRowTreatment() : rowTreatment(pitcher);
  const lastLine = pitcher.lastStart
    ? `Last GS+ ${pitcher.lastStart.gsPlus} vs ${pitcher.lastStart.opp} / ${formatStartLine({ inningsPitched: pitcher.lastStart.ip, hits: pitcher.lastStart.h, earnedRuns: pitcher.lastStart.er, walks: pitcher.lastStart.bb, strikeouts: pitcher.lastStart.k, pitches: 0 })}`
    : "Last start unavailable";
  const seasonMetaLine = `Season: ${seasonLine(pitcher)}`;
  const fullWindow = pitcher.windowCount >= window;
  const thermalBand = seasonView ? qualityTier.key : fullWindow ? pitcher.tier : null;
  const profileHref = pitcherHref(pitcher, sourceParams("heat", { window, view }));
  const score = seasonView ? Math.round(pitcher.bgs) : Math.round(pitcher.rgs);

  return (
    <article
      id={poleId}
      className={`heat-check-row scroll-mt-24 grid items-start gap-x-3 gap-y-2 rounded border border-l-4 bg-[#101014] px-4 transition hover:bg-white/[0.04] sm:px-5 ${treatment.gridClass} ${treatment.padding} ${treatment.borderClass} ${treatment.opacity} ${isPoleTier(pitcher) && fullWindow ? "heat-glow-card" : ""}`}
      style={{ ...(isPoleTier(pitcher) && fullWindow ? heatGlowStyle(pitcher) : {}), borderLeftColor: bandColor }}
      data-form-row
      data-heat-band={pitcher.tier}
    >
      <div className="min-w-0">
        <p className={`${treatment.rankClass} font-serif leading-none text-zinc-500`}>#{rank}</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: bandColor }}>{seasonView ? qualityTier.label : tierLabel(pitcher.tier)}</p>
      </div>
      <HeatPitcherProfileLink href={profileHref} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" ariaLabel={`Open ${pitcher.name} form page`}>
      <Headshot playerId={pitcher.pitcherId} name={pitcher.name} team={pitcher.team} size={treatment.headshotSize} band={thermalBand} sampleSufficient={fullWindow} decorative className="ml-1" />
      </HeatPitcherProfileLink>
      <HeatPitcherProfileLink href={profileHref} className="grid min-w-0 gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
        <h2 className={`${treatment.nameClass} pitcher-name break-words font-serif font-bold leading-tight text-zinc-50`}>
          <MobileStackedPitcherName name={pitcher.name} />
        </h2>
        <p className={`truncate font-mono text-[10px] uppercase tracking-[0.14em] ${treatment.metaClass}`}>
          {seasonView ? `${pitcher.team} / ${pitcher.seasonStartCount} GS / ${seasonMetaLine}` : `${pitcher.team} / ${pitcher.windowCount} of ${window} / ${lastLine}`}
          {isStartingToday(pitcher) ? <span className="ml-2 text-teal-300">Scheduled starter</span> : null}
        </p>
        <p className={`font-mono text-[10px] uppercase tracking-[0.14em] ${pitcher.nextStart ? "text-zinc-400" : "text-zinc-600"}`}>
          <span>Next start:</span>
          <span className="block sm:inline">{nextStartDetails(pitcher)}</span>
        </p>
        <PitcherAvailabilityNote availability={pitcher.availability} compact className="mt-1" />
        {seasonView ? null : (
          <div className="flex min-w-0 flex-wrap gap-1.5">
            <CrossoverPill pitcher={pitcher} />
            <FormDriverChips chips={pitcher.driverChips} compact />
          </div>
        )}
      </HeatPitcherProfileLink>
      <div className={`col-start-4 row-start-1 flex items-start justify-end gap-2 text-right sm:col-span-2 sm:col-start-auto sm:row-auto sm:gap-3 ${seasonView ? "sm:flex" : "sm:grid sm:grid-cols-[minmax(120px,1fr)_auto]"}`}>
        {seasonView ? null : (
        <div className="hidden min-w-0 sm:block">
          <FormSparkline
            values={formSparkValues(pitcher)}
            tier={pitcher.tier}
            leagueMeanGS={leagueMeanGS}
            baselineValue={formSparkBaseline(pitcher)}
            deltaForm={pitcher.deltaForm}
            window={window}
            label={formSparklineLabel(pitcher, window)}
            trend={pitcher.trend}
            intensity={isPoleTier(pitcher) && fullWindow ? "pole" : "field"}
          />
        </div>
        )}
        <div className="flex items-start justify-end gap-2">
          <FollowPitcherButton pitcherId={pitcher.pitcherId} pitcherName={pitcher.name} initialFollowing={followed} compact />
          <HeatPitcherProfileLink href={profileHref} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" ariaLabel={seasonView ? `${pitcher.name} season GS+ ${score}, ${pitcher.seasonStartCount} starts` : `${pitcher.name} Form ${score}${fullWindow ? `, ${deltaAriaLabel(pitcher)}` : ""}`}>
            <p className={`${treatment.scoreClass} font-mono font-black leading-none tabular-nums`} style={{ color: bandColor }}>{score}</p>
            <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">{seasonView ? "Season GS+" : "Form"}</span>
            {seasonView ? <span className="mt-1 block whitespace-nowrap font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-500">{pitcher.seasonStartCount} GS</span> : fullWindow ? <FormDeltaLabel summary={pitcher} /> : null}
          </HeatPitcherProfileLink>
        </div>
      </div>
      {seasonView ? null : (
      <div className="col-span-full row-start-2 min-w-0 sm:hidden">
        <FormSparkline
          values={formSparkValues(pitcher)}
          tier={pitcher.tier}
          leagueMeanGS={leagueMeanGS}
          baselineValue={formSparkBaseline(pitcher)}
          deltaForm={pitcher.deltaForm}
          window={window}
          label={formSparklineLabel(pitcher, window)}
          trend={pitcher.trend}
          intensity={isPoleTier(pitcher) && fullWindow ? "pole" : "field"}
        />
      </div>
      )}
    </article>
  );
}

function MobileStackedPitcherName({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const lastName = parts.pop();
  const firstNames = parts.join(" ");

  if (!firstNames || !lastName) return <>{name}</>;

  return (
    <>
      <span className="block lg:inline">{firstNames}</span>
      <span className="hidden lg:inline"> </span>
      <span className="block lg:inline">{lastName}</span>
    </>
  );
}

function BandHeader({ band, count }: { band: HeatBand; count: number }) {
  return (
    <div className="z-10 mt-6 mb-3 flex items-center gap-3 bg-[#08080a]/92 py-2 backdrop-blur sm:sticky sm:top-0" data-heat-band-header={band.key}>
      <p className="font-mono text-xs uppercase tracking-[0.18em]" style={{ color: band.color }}>{band.label} · {count}</p>
      <span className="h-px flex-1" style={{ backgroundColor: band.color }} />
    </div>
  );
}

function EvenBandCollapsed({ count, href }: { count: number; href: string }) {
  return (
    <div className="rounded border border-white/10 bg-black/20 p-4" data-responsive-check="heat-even-collapsed">
      <Link href={href} className="inline-flex min-h-11 items-center rounded border border-white/10 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-zinc-300 hover:border-amber-300/40 hover:text-amber-300">
        Show {count} even arms
      </Link>
    </div>
  );
}

function EvenBandExpanded({ count, href }: { count: number; href: string }) {
  return (
    <div className="flex justify-end" data-responsive-check="heat-even-expanded">
      <Link href={href} className="inline-flex min-h-11 items-center rounded border border-white/10 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-zinc-400 hover:border-amber-300/40 hover:text-amber-300">
        Hide {count} even arms
      </Link>
    </div>
  );
}

function BandEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded border border-white/10 bg-black/20 px-4 py-3 font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">
      {message}
    </div>
  );
}

function bandEmptyMessage(band: HeatBand, count: number) {
  if (count > 0) return null;
  if (band.key === "onfire") return "FORM band unavailable - check FORM data.";
  if (band.key === "ice") return "FORM cold band unavailable - check FORM data.";
  return null;
}

function bandExpandableControl(bandKey: HeatBand["key"], count: number, params: Record<string, string | undefined>, state: { heatingExpanded: boolean; coolingExpanded: boolean }) {
  const cap = 12;
  if (bandKey !== "hot" && bandKey !== "cooling") return null;
  if (count <= cap) return null;

  const expanded = bandKey === "hot" ? state.heatingExpanded : state.coolingExpanded;
  const key = bandKey === "hot" ? "hot" : "cooling";
  const label = bandKey === "hot" ? "heating up" : "cooling down";
  const hidden = count - cap;

  return (
    <div className="flex justify-end">
      <Link href={heatCheckHref({ ...params, [key]: expanded ? "" : "show" })} className="inline-flex min-h-11 items-center rounded border border-white/10 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-zinc-400 hover:border-amber-300/40 hover:text-amber-300">
        {expanded ? `Show fewer ${label}` : `Show ${hidden} more ${label}`}
      </Link>
    </div>
  );
}

function visibleBandPitchers(bandKey: HeatBand["key"], pitchers: FormSummary[], state: { heatingExpanded: boolean; coolingExpanded: boolean }) {
  if (bandKey === "hot" && !state.heatingExpanded) return pitchers.slice(0, 12);
  if (bandKey === "cooling" && !state.coolingExpanded) return pitchers.slice(0, 12);
  return pitchers;
}

function visibleSeasonPitchers(pitchers: FormSummary[], team: string, show: string | undefined) {
  if (team || show === "all") return pitchers;
  if (show === "50") return pitchers.slice(0, 50);
  return pitchers.slice(0, 25);
}

function SeasonBoardControls({ params, qualifiedOnly }: { params: Record<string, string | undefined>; qualifiedOnly: boolean }) {
  return (
    <section className="z-20 my-5 rounded border border-white/10 bg-[#101014]/95 p-4 backdrop-blur" data-responsive-check="heat-season-controls">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">Season list</p>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-zinc-400">Ranked by season-average GS+</p>
        </div>
        <ControlLink active={qualifiedOnly} href={heatCheckHref({ ...params, qualified: qualifiedOnly ? "false" : "true" })}>Qualified</ControlLink>
      </div>
    </section>
  );
}

function SeasonExpandControls({ visible, total, params, team }: { visible: number; total: number; params: Record<string, string | undefined>; team: string }) {
  if (team || visible >= total) return null;
  const canShowMore = visible < 50 && total > 25;

  return (
    <div className="mt-3 flex flex-wrap justify-end gap-2" data-responsive-check="heat-season-expand">
      {canShowMore ? (
        <ControlLink active={false} href={heatCheckHref({ ...params, view: "season", show: "50" })}>Show 25 more</ControlLink>
      ) : null}
      <ControlLink active={false} href={heatCheckHref({ ...params, view: "season", show: "all" })}>Show all</ControlLink>
    </div>
  );
}

function groupPitchersByBand(pitchers: FormSummary[]) {
  return HEAT_BANDS.map((band) => ({
    band,
    pitchers: sortBandPitchers(band.key, pitchers.filter((pitcher) => pitcher.tier === band.key)),
  }));
}

function sortBandPitchers(_bandKey: HeatBand["key"], pitchers: FormSummary[]) {
  return sortPitchersByGlobalFormRank(pitchers);
}

function buildGlobalFormRankMap(pitchers: FormSummary[]) {
  return new Map(sortPitchersByGlobalFormRank(pitchers).map((pitcher, index) => [pitcher.pitcherId, index + 1]));
}

function buildGlobalSeasonRankMap(pitchers: FormSummary[]) {
  return new Map([...pitchers].sort(compareSeasonGsRank).map((pitcher, index) => [pitcher.pitcherId, index + 1]));
}

function sortPitchersByGlobalFormRank(pitchers: FormSummary[]) {
  return [...pitchers].sort(compareRollingFormLevelRank);
}

function compareSeasonGsRank(a: FormSummary, b: FormSummary) {
  if (b.bgs !== a.bgs) return b.bgs - a.bgs;
  if (b.seasonStartCount !== a.seasonStartCount) return b.seasonStartCount - a.seasonStartCount;
  if ((b.lastStart?.gsPlus ?? 0) !== (a.lastStart?.gsPlus ?? 0)) return (b.lastStart?.gsPlus ?? 0) - (a.lastStart?.gsPlus ?? 0);
  return a.pitcherId.localeCompare(b.pitcherId);
}

function compareRollingFormLevelRank(a: FormSummary, b: FormSummary) {
  if (b.rgs !== a.rgs) return b.rgs - a.rgs;
  if ((b.lastStart?.gsPlus ?? 0) !== (a.lastStart?.gsPlus ?? 0)) return (b.lastStart?.gsPlus ?? 0) - (a.lastStart?.gsPlus ?? 0);
  if ((b.heatIndex ?? 0) !== (a.heatIndex ?? 0)) return (b.heatIndex ?? 0) - (a.heatIndex ?? 0);
  if (b.deltaForm !== a.deltaForm) return b.deltaForm - a.deltaForm;
  return a.pitcherId.localeCompare(b.pitcherId);
}

function buildActiveFilterLabel({ band, motion, team, query }: { band: string; motion: string; team: string; query: string }) {
  const labels = [
    band ? HEAT_BANDS.find((candidate) => candidate.key === band)?.label.toUpperCase() : "",
    motion ? motion.toUpperCase() : "",
    team ? team.toUpperCase() : "",
    query ? `"${query}"` : "",
  ].filter(Boolean);

  return labels.length > 0 ? labels.join(" / ") : "All arms";
}

function rowTreatment(pitcher: FormSummary): {
  padding: string;
  opacity: string;
  rankClass: string;
  gridClass: string;
  headshotSize: "xl" | "lg" | "md" | "sm" | "xs";
  borderClass: string;
  nameClass: string;
  scoreClass: string;
  metaClass: string;
} {
  if (pitcher.tier === "onfire") {
    return { padding: "py-4 sm:py-[18px]", opacity: "", rankClass: "text-3xl", gridClass: "grid-cols-[44px_50px_minmax(0,1fr)_auto] sm:grid-cols-[44px_50px_minmax(0,1fr)_150px_auto]", headshotSize: "lg", borderClass: "border-white/10", nameClass: "text-xl sm:text-2xl", scoreClass: "text-4xl sm:text-[44px]", metaClass: "text-zinc-400" };
  }
  if (pitcher.tier === "hot") {
    return { padding: "py-3 sm:py-3.5", opacity: "", rankClass: "text-2xl", gridClass: "grid-cols-[44px_42px_minmax(0,1fr)_auto] sm:grid-cols-[44px_42px_minmax(0,1fr)_140px_auto]", headshotSize: "md", borderClass: "border-white/10 sm:border-x-0 sm:border-t-0 sm:rounded-none", nameClass: "text-xl", scoreClass: "text-[36px]", metaClass: "text-zinc-500" };
  }
  if (pitcher.tier === "cooling") {
    return { padding: "py-3 sm:py-3.5", opacity: "", rankClass: "text-2xl", gridClass: "grid-cols-[44px_42px_minmax(0,1fr)_auto] sm:grid-cols-[44px_42px_minmax(0,1fr)_140px_auto]", headshotSize: "md", borderClass: "border-white/10 sm:border-x-0 sm:border-t-0 sm:rounded-none", nameClass: "text-xl", scoreClass: "text-[36px]", metaClass: "text-zinc-500" };
  }
  if (pitcher.tier === "ice") {
    return { padding: "py-4 sm:py-[18px]", opacity: "opacity-95", rankClass: "text-3xl", gridClass: "grid-cols-[44px_50px_minmax(0,1fr)_auto] sm:grid-cols-[44px_50px_minmax(0,1fr)_150px_auto]", headshotSize: "lg", borderClass: "border-white/10", nameClass: "text-xl sm:text-2xl", scoreClass: "text-4xl sm:text-[44px]", metaClass: "text-zinc-400" };
  }
  return { padding: "py-3 sm:py-3.5", opacity: "", rankClass: "text-2xl", gridClass: "grid-cols-[44px_42px_minmax(0,1fr)_auto] sm:grid-cols-[44px_42px_minmax(0,1fr)_140px_auto]", headshotSize: "md", borderClass: "border-white/10 sm:border-x-0 sm:border-t-0 sm:rounded-none", nameClass: "text-xl", scoreClass: "text-[36px]", metaClass: "text-zinc-500" };
}

function seasonRowTreatment() {
  return { padding: "py-3 sm:py-3.5", opacity: "", rankClass: "text-2xl", gridClass: "grid-cols-[44px_42px_minmax(0,1fr)_auto] sm:grid-cols-[44px_42px_minmax(0,1fr)_140px_auto]", headshotSize: "md" as const, borderClass: "border-white/10 sm:border-x-0 sm:border-t-0 sm:rounded-none", nameClass: "text-xl", scoreClass: "text-[36px]", metaClass: "text-zinc-500" };
}

function seasonLine(pitcher: FormSummary) {
  const stats = pitcher.seasonStats;
  return [
    `ERA ${formatNullable(stats.era, 2)}`,
    `WHIP ${formatNullable(stats.whip, 2)}`,
    `K/9 ${formatNullable(stats.k9, 1)}`,
    `IP ${stats.inningsPitched.toFixed(1)}`,
  ].join(" / ");
}

function formatNullable(value: number | null | undefined, precision: number) {
  return value === null || value === undefined ? "--" : value.toFixed(precision);
}

function isPoleTier(pitcher: FormSummary) {
  return pitcher.tier === "onfire" || pitcher.tier === "ice";
}

function FormDeltaLabel({ summary }: { summary: Pick<FormSummary, "deltaForm"> }) {
  const band = formDeltaBand(summary.deltaForm);
  const label = band.key === "steady" ? "steady" : `${band.marker} ${formatSignedDelta(summary.deltaForm)}`;

  return (
    <span className="mt-1 block whitespace-nowrap font-mono text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: band.color }}>
      {label}
    </span>
  );
}

function deltaAriaLabel(summary: Pick<FormSummary, "deltaForm">) {
  const band = formDeltaBand(summary.deltaForm);
  if (band.key === "steady") return "steady";
  return `${band.directionLabel} ${formatSignedDelta(summary.deltaForm)}`;
}

function formSparkValues(pitcher: FormSummary) {
  return pitcher.formSpark.length > 0 ? pitcher.formSpark : [pitcher.rgs];
}

function formSparkBaseline(pitcher: FormSummary) {
  return formSparkValues(pitcher)[0] ?? pitcher.rgs;
}

function formSparklineLabel(pitcher: FormSummary, window: number) {
  return `Form trend, last ${Math.min(window, pitcher.windowCount)} starts, ${deltaAriaLabel(pitcher)}`;
}

function lastName(name: string) {
  return name.trim().split(/\s+/).at(-1) ?? name;
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ControlLink({ active, href, children, heatWindowLink = false, heatViewLink = false }: { active: boolean; href: string; children: React.ReactNode; heatWindowLink?: boolean; heatViewLink?: boolean }) {
  return (
    <HeatCheckFilterLink className={`inline-flex min-h-11 items-center rounded border px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] ${active ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 text-zinc-300"}`} href={href} ariaCurrent={active ? "page" : undefined} data-heat-window-link={heatWindowLink ? "true" : undefined} data-heat-view-link={heatViewLink ? "true" : undefined}>
      {children}
    </HeatCheckFilterLink>
  );
}

function ViewControlLinks({ view, params }: { view: HeatCheckView; params: Record<string, string | undefined> }) {
  return (
    <div className="flex flex-wrap gap-2" data-responsive-check="heat-view-controls">
      <ControlLink active={view === "trend"} href={heatCheckHref({ ...params, view: "trend", show: "" })} heatViewLink>
        Trend
      </ControlLink>
      <ControlLink active={view === "season"} href={heatCheckHref({ ...params, view: "season", band: "", motion: "", sort: "", even: "", hot: "", cooling: "", show: "" })} heatViewLink>
        Season
      </ControlLink>
    </div>
  );
}

function WindowControlLinks({ window, params }: { window: number; params: Record<string, string | undefined> }) {
  return (
    <div className="flex flex-wrap gap-2" data-responsive-check="heat-window-controls">
      {[3, 5, 10].map((value) => (
        <ControlLink key={value} active={window === value} href={heatCheckHref({ ...params, window: String(value) })} heatWindowLink>
          Last {value}
        </ControlLink>
      ))}
    </div>
  );
}

function TeamFilterControl({
  teams,
  activeTeam,
  params,
  window,
  view,
  formThroughLabel,
  stale,
}: {
  teams: string[];
  activeTeam: string;
  params: Record<string, string | undefined>;
  window: number;
  view: HeatCheckView;
  formThroughLabel: string;
  stale: boolean;
}) {
  const clearTeamHref = heatCheckHref({ ...params, team: "" });

  return (
    <div className="grid gap-4" data-responsive-check="heat-team-filter">
      <PageContextStrip
        meta={formThroughLabel}
        className="border-b border-white/10 pb-3"
        metaClassName={`font-mono text-xs uppercase leading-4 tracking-[0.16em] ${stale ? "text-amber-300" : "text-zinc-400"}`}
        data-responsive-check="heat-controls-context"
      />
      <div className="hidden sm:flex sm:flex-wrap sm:items-end sm:gap-3">
        <ControlGroup label="View">
          <ViewControlLinks view={view} params={params} />
        </ControlGroup>
        <HeatTeamJumpMenu teams={teams} activeTeam={activeTeam} params={params} />
        {activeTeam ? (
          <HeatTeamClearLink
            href={clearTeamHref}
            className="mb-0 inline-flex min-h-11 items-center justify-center rounded border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-amber-300 transition hover:border-amber-300/60 hover:text-amber-200"
          />
        ) : null}
        {view === "trend" ? (
        <div className="pb-0" data-responsive-check="heat-desktop-window-controls">
          <ControlGroup label="Window">
            <WindowControlLinks window={window} params={params} />
          </ControlGroup>
        </div>
        ) : null}
      </div>
      <HeatTeamDrawer key={activeTeam || "all"} teams={teams} activeTeam={activeTeam} params={params} />
      <div className="grid gap-3 sm:hidden" data-responsive-check="heat-team-mobile-window-controls">
        <ControlGroup label="View">
          <ViewControlLinks view={view} params={params} />
        </ControlGroup>
        {view === "trend" ? <WindowControlLinks window={window} params={params} /> : null}
      </div>
    </div>
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

function nextStartDetails(pitcher: FormSummary) {
  if (!pitcher.nextStart?.opponent || !pitcher.nextStart.date) return " TBD";
  const matchup = pitcher.nextStart.side === "away" ? `@ ${pitcher.nextStart.opponent}` : `vs ${pitcher.nextStart.opponent}`;
  return ` ${matchup} ${formatMonthDay(pitcher.nextStart.date)}`;
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
