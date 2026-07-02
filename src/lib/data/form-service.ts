import { unstable_cache } from "next/cache";
import { HEAT_CHECK_CACHE_TAG, SLATE_CACHE_TAG } from "@/lib/data/cache-tags";
import { readCanonicalStartRecords } from "@/lib/data/canonical-start-store";
import { readArchivedPitcherSeasonProfile } from "@/lib/data/mlb-archive";
import { getArchivedSeasonStartSummaries, getHomeSlateDate, getTodayProbables } from "@/lib/data/start-service";
import { fetchMlbPitcherAvailabilityStatuses, fetchMlbPitcherSeasonProfile } from "@/lib/data/mlb-stats-client";
import { formHeatBandOf, FORM_CONFIG, HEAT_BANDS, HOME_CONFIG, QUALITY_BANDS, qualityTierOf, seasonQualificationMinStarts, tierOf } from "@/lib/form-tokens";
import { startPath } from "@/lib/routes";
import { isScoredStarterSample } from "@/lib/start-classification";
import type { FormDriverChip, FormHomeResponse, FormLeaderboardResponse, FormNextStart, FormPitcherResponse, FormSeasonDepthStats, FormSeasonStats, FormStartPoint, FormSummary, FormTrend, FormVenueSplitLabel, FormWorkload, HeatBandKey, MlbPitcherSeasonProfile, StartSummary } from "@/lib/types";

type FormWindow = typeof FORM_CONFIG.windows[number];

type FormBuildOptions = {
  window?: number | string;
  season?: string;
  qualifiedOnly?: boolean;
  team?: string;
};

type PitcherBucket = {
  pitcherId: string;
  starts: StartSummary[];
};

type FormStartSet = {
  starts: StartSummary[];
  formThroughDate: string | null;
  latestScoredStartDate: string | null;
  stale: boolean;
  stalePitcherIds: Set<string>;
};

type RecentLiveFormStartsResult = {
  starts: StartSummary[];
  truncated: boolean;
  gapDates: string[];
};

type FormMetricKey = "k9" | "bb9" | "ipPerStart" | "er9";

type FormMetricSnapshot = Record<FormMetricKey, number>;

type FormLeagueContext = {
  average: FormMetricSnapshot;
  stddev: FormMetricSnapshot;
};

type SeasonFallbackProfile = Pick<MlbPitcherSeasonProfile, "mlbId" | "name" | "team" | "starts"> & {
  id?: string;
  throws?: "R" | "L";
  headshotUrl?: string;
};

const RECENT_FORM_LIVE_LOOKBACK_DAYS = 35;
const RECENT_FORM_RENDER_GAP_LIMIT_DAYS = 2;
const FORM_CACHE_TTL_MS = 60 * 1000;
const FORM_DATA_REVALIDATE_SECONDS = 15 * 60;
const FORM_CACHE_VERSION = "form-level-bands-v4";
const PITCHER_SEASON_FALLBACK_REVALIDATE_SECONDS = 6 * 60 * 60;
const VENUE_SPLIT_MIN_STARTS_PER_SIDE = 7;
const VENUE_SPLIT_MIN_GAP = 11;
const REQUEST_TIME_ENRICHMENT_FLAG = "THE_BUMP_REQUEST_TIME_ENRICHMENT";

type CachedValue<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

const formLeaderboardCache = new Map<string, CachedValue<FormLeaderboardResponse>>();
const formHomeCache = new Map<string, CachedValue<FormHomeResponse>>();
const pitcherFormCache = new Map<string, CachedValue<FormPitcherResponse | null>>();
const recentLiveFormStartsCache = new Map<string, CachedValue<RecentLiveFormStartsResult>>();

const getCachedFormLeaderboard = unstable_cache(
  async (season: string, window: FormWindow, qualifiedOnly: boolean, team?: string) => buildFormLeaderboard({ season, window, qualifiedOnly, team }),
  ["form-leaderboard", FORM_CACHE_VERSION],
  { revalidate: FORM_DATA_REVALIDATE_SECONDS, tags: [HEAT_CHECK_CACHE_TAG, SLATE_CACHE_TAG] },
);

const getCachedFormHome = unstable_cache(
  async (season: string, window: FormWindow) => buildFormHome({ season, window }),
  ["form-home", FORM_CACHE_VERSION],
  { revalidate: FORM_DATA_REVALIDATE_SECONDS, tags: [HEAT_CHECK_CACHE_TAG] },
);

const getCachedPitcherForm = unstable_cache(
  async (pitcherId: string, season: string, window: FormWindow) => buildPitcherForm(pitcherId, { season, window }),
  ["pitcher-form", FORM_CACHE_VERSION],
  { revalidate: FORM_DATA_REVALIDATE_SECONDS, tags: [HEAT_CHECK_CACHE_TAG] },
);

const getCachedPitcherSeasonFallbackStarts = unstable_cache(
  async (pitcherId: string, season: string) => buildPitcherSeasonFallbackStarts(pitcherId, season),
  ["pitcher-season-form-fallback", FORM_CACHE_VERSION],
  { revalidate: PITCHER_SEASON_FALLBACK_REVALIDATE_SECONDS },
);

export async function warmFormLeaderboards(options: { teams?: string[]; windows?: FormWindow[]; includeGlobal?: boolean } = {}) {
  const teams = [...new Set((options.teams ?? []).map((team) => team.trim().toUpperCase()).filter(Boolean))];
  const windows = options.windows ?? FORM_CONFIG.windows;
  const includeGlobal = options.includeGlobal ?? true;

  if (includeGlobal) {
    await Promise.all(windows.map((window) => getFormLeaderboard({ window, qualifiedOnly: true })));
    await Promise.all(windows.map((window) => getFormLeaderboard({ window, qualifiedOnly: false })));
  }

  await Promise.all(teams.map((team) => Promise.all(windows.map((window) => getFormLeaderboard({ window, qualifiedOnly: false, team })))));
}

export function parseFormWindow(value: number | string | undefined): FormWindow {
  const parsed = Number(value ?? FORM_CONFIG.windowDefault);
  return FORM_CONFIG.windows.includes(parsed as FormWindow) ? parsed as FormWindow : FORM_CONFIG.windowDefault;
}

export async function getFormLeaderboard(options: FormBuildOptions = {}): Promise<FormLeaderboardResponse> {
  const season = options.season ?? getHomeSlateDate().slice(0, 4);
  const window = parseFormWindow(options.window);
  const qualifiedOnly = options.qualifiedOnly !== false;
  const cacheKey = JSON.stringify({
    season,
    window,
    qualifiedOnly,
    team: options.team ?? "",
  });
  const cached = formLeaderboardCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = getCachedFormLeaderboard(season, window, qualifiedOnly, options.team);
  formLeaderboardCache.set(cacheKey, {
    expiresAt: Date.now() + FORM_CACHE_TTL_MS,
    promise,
  });

  return promise;
}

async function buildFormLeaderboard(options: FormBuildOptions = {}): Promise<FormLeaderboardResponse> {
  const season = options.season ?? getHomeSlateDate().slice(0, 4);
  const window = parseFormWindow(options.window);
  const startSet = await getQualifiedFormStarts(season);
  const starts = options.team ? await getTeamAugmentedFormStarts(season, window, startSet.starts, options.team) : startSet.starts;
  const leagueMeanGS = mean(starts.map((start) => start.gameScorePlus));
  const leagueContext = buildLeagueContext(starts);
  const teamGamesPlayed = buildTeamGamesPlayedMap(starts, startSet.formThroughDate);
  const summaries = buildPitcherBuckets(starts)
    .map((bucket) => summarizePitcherBucket(bucket, window, leagueMeanGS, leagueContext))
    .map((summary) => attachSeasonQualification(summary, teamGamesPlayed))
    .map((summary) => attachTodayStartFreshnessFlag(summary, startSet.stalePitcherIds))
    .sort(compareRollingFormLevelDesc);
  const [availabilityStatuses, nextStarts] = await Promise.all([
    isRequestTimeEnrichmentEnabled()
      ? fetchMlbPitcherAvailabilityStatuses(summaries.map((summary) => Number(summary.pitcherId)), { fetchLive: true })
      : Promise.resolve(new Map()),
    getNextStartMap(summaries.map((summary) => summary.pitcherId)),
  ]);
  const summariesWithAvailability = attachAvailability(summaries, availabilityStatuses);
  const qualifiedPitchers = summariesWithAvailability.filter((summary) => summary.status === "ok" && summary.windowCount >= FORM_CONFIG.minStartsToQualify);
  const pitchers = options.qualifiedOnly === false ? summariesWithAvailability : qualifiedPitchers;
  const pitchersWithNextStarts = attachNextStarts(pitchers, nextStarts);
  const seasonQualificationThreshold = Math.max(...summariesWithAvailability.map((summary) => summary.seasonQualification.minStarts), seasonQualificationMinStarts(0));

  return {
    generatedAt: new Date().toISOString(),
    formThroughDate: startSet.formThroughDate,
    latestScoredStartDate: startSet.latestScoredStartDate,
    stale: startSet.stale,
    window,
    leagueMeanGS: round1(leagueMeanGS),
    count: pitchersWithNextStarts.length,
    qualifiedCount: qualifiedPitchers.length,
    seasonQualificationThreshold,
    seasonUnrankedCount: summariesWithAvailability.filter((summary) => !summary.seasonQualification.qualified).length,
    heatingCount: qualifiedPitchers.filter((summary) => summary.trend === "heating").length,
    coolingCount: qualifiedPitchers.filter((summary) => summary.trend === "cooling").length,
    pitchers: pitchersWithNextStarts,
  };
}

function buildTeamGamesPlayedMap(starts: StartSummary[], formThroughDate: string | null) {
  const teamGames = new Map<string, Set<number>>();

  for (const start of starts) {
    if (formThroughDate && start.date > formThroughDate) continue;
    for (const team of [start.pitcher.team, start.opponent]) {
      const normalizedTeam = team.trim().toUpperCase();
      if (!normalizedTeam) continue;
      const games = teamGames.get(normalizedTeam) ?? new Set<number>();
      games.add(start.gamePk);
      teamGames.set(normalizedTeam, games);
    }
  }

  return new Map([...teamGames.entries()].map(([team, games]) => [team, games.size]));
}

function attachSeasonQualification(summary: FormSummary, teamGamesPlayed: Map<string, number>): FormSummary {
  const teamGames = teamGamesPlayed.get(summary.team.trim().toUpperCase()) ?? summary.seasonStartCount;
  const minStarts = seasonQualificationMinStarts(teamGames);
  return {
    ...summary,
    seasonQualification: {
      teamGamesPlayed: teamGames,
      minStarts,
      divisor: FORM_CONFIG.seasonQualificationDivisor,
      qualified: summary.seasonStartCount >= minStarts,
    },
  };
}

async function getTeamAugmentedFormStarts(season: string, window: FormWindow, starts: StartSummary[], team: string) {
  const normalizedTeam = team.trim().toUpperCase();
  if (!normalizedTeam) return starts;

  const teamBuckets = buildPitcherBuckets(starts).filter((bucket) => bucket.starts.at(-1)?.pitcher.team === normalizedTeam);
  const thinBuckets = teamBuckets.filter((bucket) => bucket.starts.length < window);
  if (thinBuckets.length === 0) return starts;

  const fallbackGroups = await Promise.all(thinBuckets.map((bucket) => getCachedPitcherSeasonFallbackStarts(bucket.pitcherId, season)));
  const teamFallbackStarts = fallbackGroups.flat().filter((start) => start.pitcher.team === normalizedTeam);
  if (teamFallbackStarts.length === 0) return starts;

  return mergeScoredStarts(starts, teamFallbackStarts);
}

export async function getPitcherForm(pitcherId: string, options: FormBuildOptions = {}): Promise<FormPitcherResponse | null> {
  const season = options.season ?? getHomeSlateDate().slice(0, 4);
  const window = parseFormWindow(options.window);
  const cacheKey = JSON.stringify({
    pitcherId,
    season,
    window,
  });
  const cached = pitcherFormCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = getCachedPitcherForm(pitcherId, season, window);
  pitcherFormCache.set(cacheKey, {
    expiresAt: Date.now() + FORM_CACHE_TTL_MS,
    promise,
  });

  return promise;
}

async function buildPitcherForm(pitcherId: string, options: FormBuildOptions = {}): Promise<FormPitcherResponse | null> {
  const season = options.season ?? getHomeSlateDate().slice(0, 4);
  const window = parseFormWindow(options.window);
  const [startSet, venueSplitStartSet] = await Promise.all([
    getQualifiedFormStarts(season),
    getStableVenueSplitStarts(season),
  ]);
  const starts = await getPitcherFormStartsWithFallback(pitcherId, season, window, startSet.starts);
  const leagueMeanGS = mean(starts.map((start) => start.gameScorePlus));
  const leagueContext = buildLeagueContext(starts);
  const bucket = buildPitcherBuckets(starts).find((candidate) => candidate.pitcherId === pitcherId);
  if (!bucket) return null;

  const venueSplitStarts = venueSplitStartSet.starts.filter((start) => String(start.pitcher.mlbId) === pitcherId);
  const summary = {
    ...summarizePitcherBucket(bucket, window, leagueMeanGS, leagueContext),
    venueSplit: buildVenueSplitLabel(venueSplitStarts),
  };
  const summaryWithFreshness = attachTodayStartFreshnessFlag(summary, startSet.stalePitcherIds);
  const availabilityStatuses = isRequestTimeEnrichmentEnabled()
    ? await fetchMlbPitcherAvailabilityStatuses([Number(summary.pitcherId)], { fetchLive: true })
    : new Map();
  const summaryWithAvailability = {
    ...summaryWithFreshness,
    availability: availabilityStatuses.get(summaryWithFreshness.pitcherId) ?? null,
  };
  const series = buildStartPoints(bucket.starts, window);

  return {
    pitcher: {
      pitcherId: summaryWithAvailability.pitcherId,
      name: summaryWithAvailability.name,
      team: summaryWithAvailability.team,
      throws: summaryWithAvailability.throws,
      status: summaryWithAvailability.status,
    },
    formThroughDate: startSet.formThroughDate,
    latestScoredStartDate: startSet.latestScoredStartDate,
    stale: startSet.stale,
    window,
    leagueMeanGS: round1(leagueMeanGS),
    series,
    summary: summaryWithAvailability,
    };
}

async function getPitcherFormStartsWithFallback(pitcherId: string, season: string, window: FormWindow, starts: StartSummary[]) {
  const bucket = buildPitcherBuckets(starts).find((candidate) => candidate.pitcherId === pitcherId);
  if (bucket && bucket.starts.length >= window) return starts;

  const fallbackStarts = await getCachedPitcherSeasonFallbackStarts(pitcherId, season);
  if (fallbackStarts.length === 0) return starts;

  return mergeScoredStarts(starts, fallbackStarts);
}

async function buildPitcherSeasonFallbackStarts(pitcherId: string, season: string): Promise<StartSummary[]> {
  const pitcherMlbId = Number(pitcherId);
  if (!Number.isInteger(pitcherMlbId)) return [];

  const profile = await readArchivedPitcherSeasonProfile(pitcherMlbId, season)
    ?? await fetchMlbPitcherSeasonProfile(pitcherMlbId, season, { fetchLive: true });
  if (!profile) return [];

  return profile.starts
    .map((start, index) => pitcherProfileStartToSummary(profile, start, index))
    .sort((a, b) => a.date.localeCompare(b.date) || a.gamePk - b.gamePk);
}

function pitcherProfileStartToSummary(profile: SeasonFallbackProfile, start: SeasonFallbackProfile["starts"][number], index: number): StartSummary {
  const context = {
    label: `${profile.team} vs ${start.opponent}`,
    whiffDeltaPct: 0,
    velocityDeltaMph: 0,
    parkRunFactor: 1,
    parkLabel: "MLB game log",
    opponentQualityRunValue: 0,
    opponentQualityLabel: `${start.opponent} opponent context pending for MLB game-log fallback.`,
    opponentOffenseRunValue: 0,
    opponentOffenseLabel: `${start.opponent} offense context pending for MLB game-log fallback.`,
  };

  return {
    id: start.id,
    gamePk: start.gamePk ?? index,
    date: start.date,
    rank: 1,
    pitcher: {
      id: profile.id ?? String(profile.mlbId),
      mlbId: profile.mlbId,
      name: profile.name,
      team: profile.team,
      throws: profile.throws ?? "R",
      headshotUrl: profile.headshotUrl ?? `https://img.mlbstatic.com/mlb-photos/image/upload/w_360,q_auto:best/v1/people/${profile.mlbId}/headshot/67/current`,
    },
    opponent: start.opponent,
    result: start.result,
    line: start.line,
    gameScorePlus: start.gameScorePlus,
    gameScorePlusBreakdown: undefined,
    teamColor: "#27272a",
    accentColor: "#fbbf24",
    context,
    source: {
      schedule: "live",
      line: "live-gamefeed",
      ranking: "schedule-derived-gamefeed-line",
    },
  };
}

export async function getPitcherFormMap(pitcherIds: string[], options: FormBuildOptions = {}) {
  const leaderboard = await getFormLeaderboard({ ...options, qualifiedOnly: false });
  const wanted = new Set(pitcherIds);
  return new Map(leaderboard.pitchers.filter((pitcher) => wanted.has(pitcher.pitcherId)).map((pitcher) => [pitcher.pitcherId, pitcher]));
}

export async function getFormHome(options: FormBuildOptions = {}): Promise<FormHomeResponse> {
  const season = options.season ?? getHomeSlateDate().slice(0, 4);
  const window = parseFormWindow(options.window);
  const cacheKey = JSON.stringify({
    season,
    window,
  });
  const cached = formHomeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = getCachedFormHome(season, window);
  formHomeCache.set(cacheKey, {
    expiresAt: Date.now() + FORM_CACHE_TTL_MS,
    promise,
  });

  return promise;
}

async function buildFormHome(options: FormBuildOptions = {}): Promise<FormHomeResponse> {
  const leaderboard = await getFormLeaderboard({ ...options, qualifiedOnly: true });
  const bands = HEAT_BANDS.reduce((counts, band) => ({ ...counts, [band.key]: 0 }), {} as Record<HeatBandKey, number>);
  const qualified = leaderboard.pitchers.filter((pitcher) => pitcher.status === "ok");

  for (const pitcher of qualified) {
    bands[pitcher.tier] += 1;
  }

  const hot = [...qualified].sort(compareRollingFormLevelDesc).slice(0, HOME_CONFIG.railSize);
  const hotIds = new Set(hot.map((pitcher) => pitcher.pitcherId));
  const cold = [...qualified].filter((pitcher) => !hotIds.has(pitcher.pitcherId)).sort(compareRollingFormLevelAsc).slice(0, HOME_CONFIG.railSize);
  const nextStarts = await getNextStartMap([...hot, ...cold].map((pitcher) => pitcher.pitcherId));

  return {
    generatedAt: leaderboard.generatedAt,
    formThroughDate: leaderboard.formThroughDate,
    latestScoredStartDate: leaderboard.latestScoredStartDate,
    stale: leaderboard.stale,
    window: leaderboard.window,
    leagueMeanGS: leaderboard.leagueMeanGS,
    totalQualified: qualified.length,
    bands,
    hot: attachNextStarts(hot, nextStarts),
    cold: attachNextStarts(cold, nextStarts),
  };
}

async function getNextStartMap(pitcherIds: string[]): Promise<Map<string, FormNextStart>> {
  const wanted = new Set(pitcherIds);
  if (wanted.size === 0) return new Map();

  const today = getHomeSlateDate();
  const dates = Array.from({ length: 10 }, (_, index) => addDays(today, index));
  const slates = await Promise.all(dates.map((date) => getTodayProbables(date)));
  const nextStarts = new Map<string, FormNextStart>();

  for (const probables of slates) {
    for (const probable of probables) {
      if (!wanted.has(probable.pitcherId) || nextStarts.has(probable.pitcherId)) continue;
      nextStarts.set(probable.pitcherId, {
        date: probable.date,
        opponent: probable.opponent,
        side: probable.side,
      });
    }
  }

  return nextStarts;
}

function attachNextStarts(pitchers: FormSummary[], nextStarts: Map<string, FormNextStart>) {
  return pitchers.map((pitcher) => ({
    ...pitcher,
    nextStart: nextStarts.get(pitcher.pitcherId) ?? null,
  }));
}

function attachAvailability(pitchers: FormSummary[], availabilityStatuses: Awaited<ReturnType<typeof fetchMlbPitcherAvailabilityStatuses>>) {
  return pitchers.map((pitcher) => ({
    ...pitcher,
    availability: availabilityStatuses.get(pitcher.pitcherId) ?? null,
  }));
}

function isRequestTimeEnrichmentEnabled() {
  return process.env[REQUEST_TIME_ENRICHMENT_FLAG] === "1";
}

function attachTodayStartFreshnessFlag(summary: FormSummary, stalePitcherIds: Set<string>): FormSummary {
  if (!stalePitcherIds.has(summary.pitcherId)) return summary;

  return {
    ...summary,
    flags: {
      ...summary.flags,
      todaysStartNotReflected: true,
    },
  };
}

export async function getFormCalibration(options: FormBuildOptions = {}) {
  const leaderboard = await getFormLeaderboard({ ...options, qualifiedOnly: false });
  const qualified = leaderboard.pitchers.filter((pitcher) => pitcher.status === "ok" && pitcher.windowCount >= FORM_CONFIG.minStartsToQualify);
  const bands = HEAT_BANDS.reduce((counts, band) => ({ ...counts, [band.key]: 0 }), {} as Record<HeatBandKey, number>);

  for (const pitcher of qualified) {
    bands[pitcher.tier] += 1;
  }

  return {
    generatedAt: leaderboard.generatedAt,
    window: leaderboard.window,
    config: FORM_CONFIG,
    heatBands: HEAT_BANDS,
    counts: {
      totalPitchers: leaderboard.pitchers.length,
      qualified: qualified.length,
      insufficient: leaderboard.pitchers.filter((pitcher) => pitcher.status === "insufficient").length,
      limitedSample: leaderboard.pitchers.filter((pitcher) => pitcher.flags?.limitedSample).length,
      heating: qualified.filter((pitcher) => pitcher.trend === "heating").length,
      cooling: qualified.filter((pitcher) => pitcher.trend === "cooling").length,
      bands,
    },
    bandShare: describeBandShare(bands, qualified.length),
    rgs: describeDistribution(qualified.map((pitcher) => pitcher.rgs)),
    trendDelta: describeDistribution(qualified.map((pitcher) => pitcher.trendDelta)),
    heatIndex: describeDistribution(qualified.map((pitcher) => pitcher.heatIndex ?? 0)),
    misiorowski: describePitcherCalibration(qualified, "misiorowski"),
    topForm: [...qualified].sort(compareRollingFormLevelDesc).slice(0, 5).map(calibrationPitcherRow),
    bottomForm: [...qualified].sort(compareRollingFormLevelAsc).slice(0, 5).map(calibrationPitcherRow),
  };
}

async function getQualifiedFormStarts(season: string): Promise<FormStartSet> {
  const archivedStarts = await getArchivedSeasonStartSummaries(season);
  const recent = await getRecentLiveFormStarts(season, archivedStarts);
  const recentStarts = recent.starts;
  const scoredStarts = mergeScoredStarts(archivedStarts, recentStarts);
  const qualifiedStarts = filterQualifiedStarts(scoredStarts);
  const formThroughDate = latestStartDate(qualifiedStarts);
  const latestScoredStartDate = latestStartDate(scoredStarts.filter((start) => start.source?.line !== "fixture"));
  const stale = recent.truncated || Boolean(formThroughDate && latestScoredStartDate && formThroughDate < latestScoredStartDate);

  if (stale) {
    const affectedPitchers = new Set(scoredStarts.filter((start) => start.date === latestScoredStartDate).map((start) => String(start.pitcher.mlbId)));
    console.warn(
      `[form-pipeline] rolling form is stale: formThroughDate=${formThroughDate}, latestScoredStartDate=${latestScoredStartDate}, affectedPitchers=${affectedPitchers.size}`,
    );
  }

  const stalePitcherIds = new Set(
    (formThroughDate ? scoredStarts.filter((start) => start.source?.line !== "fixture" && start.date > formThroughDate) : [])
      .map((start) => String(start.pitcher.mlbId)),
  );

  return {
    starts: qualifiedStarts,
    formThroughDate,
    latestScoredStartDate,
    stale,
    stalePitcherIds,
  };
}

async function getStableVenueSplitStarts(season: string): Promise<FormStartSet> {
  const previousSeason = String(Number(season) - 1);
  const [previous, current] = await Promise.all([
    getQualifiedFormStarts(previousSeason),
    getQualifiedFormStarts(season),
  ]);
  const starts = mergeScoredStarts(previous.starts, current.starts).filter((start) => start.side === "home" || start.side === "away");

  return {
    starts,
    formThroughDate: current.formThroughDate,
    latestScoredStartDate: current.latestScoredStartDate,
    stale: current.stale,
    stalePitcherIds: current.stalePitcherIds,
  };
}

async function getRecentLiveFormStarts(season: string, archivedStarts: StartSummary[]) {
  const today = getHomeSlateDate();
  const latestArchivedDate = latestStartDate(archivedStarts.filter((start) => start.source?.line !== "fixture"));
  const cacheKey = `${season}:${today}:${latestArchivedDate ?? "none"}`;
  const cached = recentLiveFormStartsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = buildRecentLiveFormStarts(season, today, latestArchivedDate);
  recentLiveFormStartsCache.set(cacheKey, {
    expiresAt: Date.now() + FORM_CACHE_TTL_MS,
    promise,
  });

  return promise;
}

async function buildRecentLiveFormStarts(season: string, today: string, latestArchivedDate: string | null) {
  const dates = Array.from({ length: RECENT_FORM_LIVE_LOOKBACK_DAYS }, (_, index) => addDays(today, -index))
    .filter((date) => date.startsWith(season))
    .filter((date) => !latestArchivedDate || date > latestArchivedDate)
    .reverse();
  if (dates.length === 0) return { starts: [], truncated: false, gapDates: [] };

  const selectedDates = dates.slice(-RECENT_FORM_RENDER_GAP_LIMIT_DAYS);
  const truncated = dates.length > selectedDates.length;
  if (truncated) {
    console.error("[form-pipeline] archive gap exceeds render fan-out cap; serving stale archive/canonical data", {
      today,
      latestArchivedDate,
      gapDays: dates.length,
      renderedGapDays: selectedDates.length,
      skippedDates: dates.slice(0, -selectedDates.length),
    });
  } else {
    console.info("[form-pipeline] recent canonical form gap", {
      today,
      latestArchivedDate,
      gapDays: selectedDates.length,
    });
  }

  const slates = await Promise.all(selectedDates.map(readRecentCanonicalFormSlate));

  const starts = slates
    .flat()
    .filter((start) => start.source?.line !== "fixture")
    .sort((a, b) => a.date.localeCompare(b.date) || a.gamePk - b.gamePk);
  return { starts, truncated, gapDates: selectedDates };
}

async function readRecentCanonicalFormSlate(date: string): Promise<StartSummary[]> {
  const records = await readCanonicalStartRecords(date);
  return records
    .filter((record) => record.status === "final" || record.status === "live")
    .map((record, index) => canonicalRecordToFormStart(record, index + 1));
}

function canonicalRecordToFormStart(record: Awaited<ReturnType<typeof readCanonicalStartRecords>>[number], rank: number): StartSummary {
  const teamColor = "#27272a";
  const accentColor = "#fbbf24";
  return {
    id: record.id,
    gamePk: record.gamePk,
    date: record.date,
    rank,
    pitcher: {
      id: String(record.pitcherMlbId),
      mlbId: record.pitcherMlbId,
      name: record.pitcherName,
      team: record.team,
      throws: "R",
      headshotUrl: `https://img.mlbstatic.com/mlb-photos/image/upload/w_360,q_auto:best/v1/people/${record.pitcherMlbId}/headshot/67/current`,
    },
    opponent: record.opponent,
    side: record.side,
    result: record.result,
    line: record.line,
    gameScorePlus: record.gameScorePlus,
    gameScoreV2: record.gameScoreV2,
    eventFlags: record.eventFlags,
    gameScorePlusBreakdown: record.gameScorePlusBreakdown,
    plannedStarter: true,
    teamColor,
    accentColor,
    context: {
      label: `${record.team} vs ${record.opponent}`,
      whiffDeltaPct: 0,
      velocityDeltaMph: 0,
      parkRunFactor: 1,
      parkLabel: "Stored canonical slate",
      opponentQualityRunValue: 0,
      opponentQualityLabel: `${record.opponent} opponent quality pending archive refresh.`,
      opponentOffenseRunValue: 0,
      opponentOffenseLabel: `${record.opponent} offense quality pending archive refresh.`,
    },
    source: record.source,
  };
}

function filterQualifiedStarts(starts: StartSummary[]) {
  return starts.filter((start) => start.source?.line !== "fixture" && isScoredStarterSample(start, FORM_CONFIG.ipFloor));
}

function mergeScoredStarts(...groups: StartSummary[][]) {
  const byStartId = new Map<string, StartSummary>();

  for (const starts of groups) {
    for (const start of starts) {
      if (start.source?.line === "fixture") continue;
      byStartId.set(`${start.gamePk}:${start.pitcher.mlbId}`, start);
    }
  }

  return [...byStartId.values()].sort((a, b) => a.date.localeCompare(b.date) || a.gamePk - b.gamePk || a.pitcher.name.localeCompare(b.pitcher.name));
}

function latestStartDate(starts: StartSummary[]) {
  return starts.reduce<string | null>((latest, start) => (latest && latest > start.date ? latest : start.date), null);
}

function buildPitcherBuckets(starts: StartSummary[]): PitcherBucket[] {
  const buckets = new Map<string, StartSummary[]>();

  for (const start of starts) {
    const key = String(start.pitcher.mlbId);
    const pitcherStarts = buckets.get(key) ?? [];
    pitcherStarts.push(start);
    buckets.set(key, pitcherStarts);
  }

  return [...buckets.entries()].map(([pitcherId, pitcherStarts]) => ({
    pitcherId,
    starts: pitcherStarts.sort((a, b) => a.date.localeCompare(b.date) || a.gamePk - b.gamePk),
  }));
}

function summarizePitcherBucket(bucket: PitcherBucket, window: FormWindow, leagueMeanGS: number, leagueContext: FormLeagueContext): FormSummary {
  const starts = bucket.starts;
  const latest = starts.at(-1);
  const windowStarts = starts.slice(-Math.min(window, starts.length));
  const windowCount = windowStarts.length;
  const rgs = mean(windowStarts.map((start) => start.gameScorePlus));
  const bgs = mean(starts.map((start) => start.gameScorePlus));
  const formSpark = buildRollingFormSpark(starts, window);
  const deltaForm = rgs - (formSpark[0] ?? rgs);
  const trendDelta = calculateTrendDelta(windowStarts);
  const trend = classifyTrend(deltaForm, window);
  const status = windowCount >= FORM_CONFIG.minStartsInWindow ? "ok" : "insufficient";
  const lastStart = latest ? buildStartPoint(starts, starts.length - 1, window) : null;
  const rust = starts.length >= 2 ? daysBetween(starts.at(-2)?.date ?? "", starts.at(-1)?.date ?? "") > 20 : false;
  const seasonStats = buildSeasonStats(starts);
  const seasonDepthStats = buildSeasonDepthStats(starts);
  const seasonDecisionRecord = buildSeasonDecisionRecord(starts);
  const tier = formHeatBandOf(rgs, window).key;
  const driverChips = buildDriverChips(starts, window, tier, leagueContext);
  const workload = buildWorkload(starts, window);
  const fallbackSeasonMinStarts = seasonQualificationMinStarts(starts.length);

  return {
    pitcherId: bucket.pitcherId,
    name: latest?.pitcher.name ?? "Unknown pitcher",
    team: latest?.pitcher.team ?? "",
    throws: latest?.pitcher.throws,
    status,
    rgs: round1(rgs),
    windowCount,
    seasonStartCount: starts.length,
    bgs: round1(bgs),
    deltaForm: round1(deltaForm),
    trend,
    trendDelta: round1(trendDelta),
    tier,
    heatIndex: calculateHeatIndex(rgs, leagueMeanGS, trendDelta),
    spark: windowStarts.map((start) => start.gameScorePlus),
    formSpark,
    lastStart,
    seasonStats,
    seasonDepthStats,
    seasonQualification: {
      teamGamesPlayed: starts.length,
      minStarts: fallbackSeasonMinStarts,
      divisor: FORM_CONFIG.seasonQualificationDivisor,
      qualified: starts.length >= fallbackSeasonMinStarts,
    },
    seasonDecisionRecord,
    driverChips,
    workload,
    flags: {
      limitedSample: windowCount < window,
      rust,
    },
  };
}

function buildSeasonDepthStats(starts: StartSummary[]): FormSeasonDepthStats {
  const scores = starts.map((start) => start.gameScorePlus);
  const sortedScores = [...scores].sort((a, b) => a - b);
  const total = Math.max(1, scores.length);
  const bandDistribution = QUALITY_BANDS.map((band) => {
    const count = scores.filter((score) => qualityTierOf(score).key === band.key).length;
    return {
      key: band.key,
      label: band.label,
      count,
      share: round1((count / total) * 100),
      color: band.color,
    };
  });

  return {
    gemRate: round1((scores.filter((score) => score >= 65).length / total) * 100),
    dudRate: round1((scores.filter((score) => score <= 30).length / total) * 100),
    consistency: round1(sampleStddev(scores)),
    bestStart: round1(sortedScores.at(-1) ?? 0),
    worstStart: round1(sortedScores[0] ?? 0),
    medianGsPlus: round1(percentile(sortedScores, 50)),
    bandDistribution,
  };
}

function buildSeasonDecisionRecord(starts: StartSummary[]) {
  return starts.reduce(
    (record, start) => {
      if (start.result === "W") record.wins += 1;
      else if (start.result === "L") record.losses += 1;
      else record.noDecisions += 1;
      return record;
    },
    { wins: 0, losses: 0, noDecisions: 0 },
  );
}

function buildWorkload(starts: StartSummary[], window: FormWindow): FormWorkload {
  const recentStarts = starts.slice(-Math.min(window, starts.length));
  const lastStart = starts.at(-1);
  if (recentStarts.length === 0 || !lastStart) {
    return {
      lastStartDate: null,
      lastStartPitches: null,
      avgPitchesLast5: null,
      avgIpLast5: null,
    };
  }

  return {
    lastStartDate: lastStart.date,
    lastStartPitches: lastStart.line.pitches,
    avgPitchesLast5: round1(mean(recentStarts.map((start) => start.line.pitches))),
    avgIpLast5: round1(outsToInnings(Math.round(mean(recentStarts.map((start) => inningsToOuts(start.line.inningsPitched)))))),
  };
}

function buildVenueSplitLabel(starts: StartSummary[]): FormVenueSplitLabel | null {
  const homeStarts = starts.filter((start) => start.side === "home");
  const awayStarts = starts.filter((start) => start.side === "away");
  if (homeStarts.length < VENUE_SPLIT_MIN_STARTS_PER_SIDE || awayStarts.length < VENUE_SPLIT_MIN_STARTS_PER_SIDE) return null;

  const homeGsPlus = round1(mean(homeStarts.map((start) => start.gameScorePlus)));
  const awayGsPlus = round1(mean(awayStarts.map((start) => start.gameScorePlus)));
  const rawGap = homeGsPlus - awayGsPlus;
  const gap = round1(Math.abs(rawGap));
  if (gap < VENUE_SPLIT_MIN_GAP) return null;

  const homeTier = tierOf(homeGsPlus).key;
  const awayTier = tierOf(awayGsPlus).key;
  const strongSide = rawGap > 0 ? "home" : "away";
  const weakSide = strongSide === "home" ? "away" : "home";
  const strongGsPlus = strongSide === "home" ? homeGsPlus : awayGsPlus;
  const weakGsPlus = strongSide === "home" ? awayGsPlus : homeGsPlus;
  const strongTier = strongSide === "home" ? homeTier : awayTier;
  const weakTier = strongSide === "home" ? awayTier : homeTier;
  const hasDirection = strongGsPlus >= 50 && (weakGsPlus <= 50 || tierRank(strongTier) - tierRank(weakTier) >= 1);
  if (!hasDirection) return null;

  return {
    label: strongSide === "home" ? "HOME FORTRESS" : "ROAD WARRIOR",
    strongSide,
    weakSide,
    gap,
    home: {
      starts: homeStarts.length,
      gsPlus: homeGsPlus,
      tier: homeTier,
    },
    away: {
      starts: awayStarts.length,
      gsPlus: awayGsPlus,
      tier: awayTier,
    },
    window: "current-plus-prior",
  };
}

function tierRank(tier: HeatBandKey) {
  const rank: Record<HeatBandKey, number> = {
    ice: 0,
    cooling: 1,
    even: 2,
    hot: 3,
    onfire: 4,
  };
  return rank[tier];
}

function buildSeasonStats(starts: StartSummary[]): FormSeasonStats {
  const totals = summarizeStartLines(starts);
  if (totals.outs === 0) {
    return {
      inningsPitched: 0,
      era: null,
      whip: null,
      k9: null,
      qualityStarts: 0,
    };
  }

  return {
    inningsPitched: outsToInnings(totals.outs),
    era: round2((totals.earnedRuns * 27) / totals.outs),
    whip: round2(((totals.hits + totals.walks) * 3) / totals.outs),
    k9: round1((totals.strikeouts * 27) / totals.outs),
    qualityStarts: starts.filter((start) => inningsToOuts(start.line.inningsPitched) >= 18 && start.line.earnedRuns <= 3).length,
  };
}

function buildLeagueContext(starts: StartSummary[]): FormLeagueContext {
  const perStart = starts.map((start) => metricSnapshot([start]));

  return {
    average: {
      k9: mean(perStart.map((item) => item.k9)),
      bb9: mean(perStart.map((item) => item.bb9)),
      ipPerStart: mean(perStart.map((item) => item.ipPerStart)),
      er9: mean(perStart.map((item) => item.er9)),
    },
    stddev: {
      k9: nonZeroStddev(perStart.map((item) => item.k9)),
      bb9: nonZeroStddev(perStart.map((item) => item.bb9)),
      ipPerStart: nonZeroStddev(perStart.map((item) => item.ipPerStart)),
      er9: nonZeroStddev(perStart.map((item) => item.er9)),
    },
  };
}

function buildDriverChips(starts: StartSummary[], window: FormWindow, tier: FormSummary["tier"], leagueContext: FormLeagueContext): FormDriverChip[] {
  const recentStarts = starts.slice(-Math.min(window, starts.length));
  if (recentStarts.length < 3) return [];
  if (tier === "even") return [];

  const baselineStarts = starts.slice(0, Math.max(0, starts.length - recentStarts.length));
  const useLeagueBaseline = baselineStarts.length < 3;
  const recent = metricSnapshot(recentStarts);
  const baseline = useLeagueBaseline ? leagueContext.average : metricSnapshot(baselineStarts);
  const thresholdMultiplier = useLeagueBaseline ? 1.5 : 1;
  const wantedDirection = tier === "onfire" || tier === "hot" ? "good" : "bad";

  return [
    driverChip("k-rate", "K-rate", recent.k9 - baseline.k9, 1.5 * thresholdMultiplier, "higher-good", leagueContext.stddev.k9),
    driverChip("walks", "Walks", recent.bb9 - baseline.bb9, 1 * thresholdMultiplier, "lower-good", leagueContext.stddev.bb9),
    driverChip("depth", "Depth", recent.ipPerStart - baseline.ipPerStart, 0.5 * thresholdMultiplier, "higher-good", leagueContext.stddev.ipPerStart),
    driverChip("run-prevention", "Runs", recent.er9 - baseline.er9, 1.5 * thresholdMultiplier, "lower-good", leagueContext.stddev.er9),
  ]
    .filter((chip): chip is FormDriverChip => chip !== null)
    .filter((chip) => chip.direction === wantedDirection)
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .slice(0, 3);
}

function driverChip(
  key: FormDriverChip["key"],
  baseLabel: string,
  delta: number,
  threshold: number,
  polarity: "higher-good" | "lower-good",
  stddev: number,
): FormDriverChip | null {
  if (Math.abs(delta) < threshold) return null;
  const good = polarity === "higher-good" ? delta > 0 : delta < 0;
  const direction = good ? "good" : "bad";
  const label = driverChipLabel(key, baseLabel, delta, direction);

  return {
    key,
    label,
    direction,
    delta: round1(delta),
    score: round2(delta / stddev),
  };
}

function driverChipLabel(key: FormDriverChip["key"], baseLabel: string, delta: number, direction: FormDriverChip["direction"]) {
  if (key === "depth") return direction === "good" ? "Going deeper" : "Short outings";
  if (key === "run-prevention") return direction === "good" ? "Run prevention" : "Getting hit";
  const arrow = delta > 0 ? "↑" : "↓";
  return `${baseLabel} ${arrow}`;
}

function metricSnapshot(starts: StartSummary[]): FormMetricSnapshot {
  const totals = summarizeStartLines(starts);
  const startCount = Math.max(1, starts.length);
  const outs = Math.max(1, totals.outs);

  return {
    k9: (totals.strikeouts * 27) / outs,
    bb9: (totals.walks * 27) / outs,
    ipPerStart: (totals.outs / 3) / startCount,
    er9: (totals.earnedRuns * 27) / outs,
  };
}

function summarizeStartLines(starts: StartSummary[]) {
  return starts.reduce(
    (totals, start) => ({
      outs: totals.outs + inningsToOuts(start.line.inningsPitched),
      hits: totals.hits + start.line.hits,
      earnedRuns: totals.earnedRuns + start.line.earnedRuns,
      walks: totals.walks + start.line.walks,
      strikeouts: totals.strikeouts + start.line.strikeouts,
    }),
    { outs: 0, hits: 0, earnedRuns: 0, walks: 0, strikeouts: 0 },
  );
}

function buildStartPoints(starts: StartSummary[], window: FormWindow) {
  return starts.map((_, index) => buildStartPoint(starts, index, window));
}

function buildStartPoint(starts: StartSummary[], index: number, window: FormWindow): FormStartPoint {
  const start = starts[index];
  const rollingStarts = starts.slice(Math.max(0, index - window + 1), index + 1);
  const rollingValues = rollingStarts.map((candidate) => candidate.gameScorePlus);
  const rollingMean = mean(rollingValues);
  const sd = sampleStddev(rollingValues);

  return {
    id: start.id,
    gameDate: start.date,
    gamePk: String(start.gamePk),
    opp: start.opponent,
    park: start.context.parkLabel,
    ip: start.line.inningsPitched,
    h: start.line.hits,
    er: start.line.earnedRuns,
    bb: start.line.walks,
    k: start.line.strikeouts,
    gsPlus: start.gameScorePlus,
    result: start.result,
    tier: tierOf(start.gameScorePlus).key,
    rollingMean: round1(rollingMean),
    bandLow: round1(rollingMean - sd),
    bandHigh: round1(rollingMean + sd),
    startHref: startPath(start.id),
  };
}

function compareRollingFormLevelDesc(a: FormSummary, b: FormSummary) {
  if (b.rgs !== a.rgs) return b.rgs - a.rgs;
  if ((b.heatIndex ?? 0) !== (a.heatIndex ?? 0)) return (b.heatIndex ?? 0) - (a.heatIndex ?? 0);
  if (b.deltaForm !== a.deltaForm) return b.deltaForm - a.deltaForm;
  return a.name.localeCompare(b.name);
}

function buildRollingFormSpark(starts: StartSummary[], window: FormWindow) {
  const windowStarts = starts.slice(-Math.min(window, starts.length));
  const firstWindowIndex = starts.length - windowStarts.length;

  return windowStarts.map((_, index) => {
    const endIndex = firstWindowIndex + index + 1;
    const sample = starts.slice(Math.max(0, endIndex - window), endIndex);
    return round1(mean(sample.map((start) => start.gameScorePlus)));
  });
}

function compareRollingFormLevelAsc(a: FormSummary, b: FormSummary) {
  if (a.rgs !== b.rgs) return a.rgs - b.rgs;
  if ((a.heatIndex ?? 0) !== (b.heatIndex ?? 0)) return (a.heatIndex ?? 0) - (b.heatIndex ?? 0);
  if (a.deltaForm !== b.deltaForm) return a.deltaForm - b.deltaForm;
  return a.name.localeCompare(b.name);
}

function calculateTrendDelta(starts: StartSummary[]) {
  if (starts.length < 2) return 0;
  const prior = starts.slice(0, Math.floor(starts.length / 2));
  const recent = starts.slice(-Math.ceil(starts.length / 2));
  return mean(recent.map((start) => start.gameScorePlus)) - mean(prior.map((start) => start.gameScorePlus));
}

function classifyTrend(deltaForm: number, window: FormWindow): FormTrend {
  const thresholds = FORM_CONFIG.directionBandThresholds[window];
  if (deltaForm >= thresholds.heatingDelta) return "heating";
  if (deltaForm <= thresholds.coolingDelta) return "cooling";
  return "steady";
}

function calculateHeatIndex(rgs: number, leagueMeanGS: number, trendDelta: number) {
  return clamp(
    0,
    100,
    Math.round(
      FORM_CONFIG.heatIndexBase +
        FORM_CONFIG.heatIndexRgsWeight * (rgs - leagueMeanGS) +
        FORM_CONFIG.heatIndexTrendWeight * trendDelta,
    ),
  );
}

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function describeDistribution(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);

  return {
    min: round1(sorted[0] ?? 0),
    p10: round1(percentile(sorted, 10)),
    p20: round1(percentile(sorted, 20)),
    p25: round1(percentile(sorted, 25)),
    p30: round1(percentile(sorted, 30)),
    p40: round1(percentile(sorted, 40)),
    p50: round1(percentile(sorted, 50)),
    p60: round1(percentile(sorted, 60)),
    p70: round1(percentile(sorted, 70)),
    p75: round1(percentile(sorted, 75)),
    p80: round1(percentile(sorted, 80)),
    p90: round1(percentile(sorted, 90)),
    p95: round1(percentile(sorted, 95)),
    max: round1(sorted.at(-1) ?? 0),
    mean: round1(mean(sorted)),
    stddev: round1(sampleStddev(sorted)),
  };
}

function calibrationPitcherRow(pitcher: FormSummary) {
  return {
    pitcherId: pitcher.pitcherId,
    name: pitcher.name,
    team: pitcher.team,
    form: pitcher.rgs,
    deltaForm: pitcher.deltaForm,
    trendDelta: pitcher.trendDelta,
    heatIndex: pitcher.heatIndex,
    band: pitcher.tier,
    gsPlusInputs: pitcher.spark,
  };
}

function describePitcherCalibration(pitchers: FormSummary[], nameNeedle: string) {
  const normalized = nameNeedle.toLowerCase();
  const pitcher = pitchers.find((candidate) => candidate.name.toLowerCase().includes(normalized));
  return pitcher
    ? { present: true, ...calibrationPitcherRow(pitcher) }
    : { present: false, name: nameNeedle, gsPlusInputs: [] };
}

function describeBandShare(bands: Record<HeatBandKey, number>, total: number) {
  return HEAT_BANDS.reduce(
    (shares, band) => ({
      ...shares,
      [band.key]: total > 0 ? round1((bands[band.key] / total) * 100) : 0,
    }),
    {} as Record<HeatBandKey, number>,
  );
}

function percentile(sortedValues: number[], percentileValue: number) {
  if (sortedValues.length === 0) return 0;
  const index = (percentileValue / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * (index - lower);
}

function sampleStddev(values: number[]) {
  if (values.length < 2) return 0;
  const average = mean(values);
  const variance = values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function nonZeroStddev(values: number[]) {
  return Math.max(0.1, sampleStddev(values));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(min: number, max: number, value: number) {
  return Math.min(max, Math.max(min, value));
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function inningsToOuts(innings: number) {
  const whole = Math.trunc(innings);
  const partial = Math.round((innings - whole) * 10);
  return whole * 3 + partial;
}

function outsToInnings(outs: number) {
  return Math.trunc(outs / 3) + (outs % 3) / 10;
}

function daysBetween(a: string, b: string) {
  if (!a || !b) return 0;
  return Math.round((new Date(`${b}T00:00:00.000Z`).valueOf() - new Date(`${a}T00:00:00.000Z`).valueOf()) / (24 * 60 * 60 * 1000));
}
