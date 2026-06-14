import { getArchivedSeasonStartSummaries, getDailySlate, getHomeSlateDate, getTodayProbables } from "@/lib/data/start-service";
import { FORM_CONFIG, HEAT_BANDS, HOME_CONFIG, tierOf } from "@/lib/form-tokens";
import { startPath } from "@/lib/routes";
import type { FormHomeResponse, FormLeaderboardResponse, FormNextStart, FormPitcherResponse, FormStartPoint, FormSummary, FormTrend, HeatBandKey, StartSummary } from "@/lib/types";

type FormWindow = typeof FORM_CONFIG.windows[number];

type FormBuildOptions = {
  window?: number | string;
  season?: string;
  qualifiedOnly?: boolean;
};

type PitcherBucket = {
  pitcherId: string;
  starts: StartSummary[];
};

const RECENT_FORM_LIVE_LOOKBACK_DAYS = 35;
const FORM_CACHE_TTL_MS = 60 * 1000;

type CachedValue<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

const formLeaderboardCache = new Map<string, CachedValue<FormLeaderboardResponse>>();
const formHomeCache = new Map<string, CachedValue<FormHomeResponse>>();

export function parseFormWindow(value: number | string | undefined): FormWindow {
  const parsed = Number(value ?? FORM_CONFIG.windowDefault);
  return FORM_CONFIG.windows.includes(parsed as FormWindow) ? parsed as FormWindow : FORM_CONFIG.windowDefault;
}

export async function getFormLeaderboard(options: FormBuildOptions = {}): Promise<FormLeaderboardResponse> {
  const cacheKey = JSON.stringify({
    season: options.season ?? getHomeSlateDate().slice(0, 4),
    window: parseFormWindow(options.window),
    qualifiedOnly: options.qualifiedOnly !== false,
  });
  const cached = formLeaderboardCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = buildFormLeaderboard(options);
  formLeaderboardCache.set(cacheKey, {
    expiresAt: Date.now() + FORM_CACHE_TTL_MS,
    promise,
  });

  return promise;
}

async function buildFormLeaderboard(options: FormBuildOptions = {}): Promise<FormLeaderboardResponse> {
  const season = options.season ?? getHomeSlateDate().slice(0, 4);
  const window = parseFormWindow(options.window);
  const starts = await getQualifiedFormStarts(season);
  const leagueMeanGS = mean(starts.map((start) => start.gameScorePlus));
  const summaries = buildPitcherBuckets(starts)
    .map((bucket) => summarizePitcherBucket(bucket, window, leagueMeanGS))
    .sort(compareFormSummaries);
  const qualifiedPitchers = summaries.filter((summary) => summary.status === "ok" && summary.windowCount >= FORM_CONFIG.minStartsToQualify);
  const pitchers = options.qualifiedOnly === false ? summaries : qualifiedPitchers;

  return {
    generatedAt: new Date().toISOString(),
    window,
    leagueMeanGS: round1(leagueMeanGS),
    count: pitchers.length,
    qualifiedCount: qualifiedPitchers.length,
    heatingCount: qualifiedPitchers.filter((summary) => summary.trend === "heating").length,
    coolingCount: qualifiedPitchers.filter((summary) => summary.trend === "cooling").length,
    pitchers,
  };
}

export async function getPitcherForm(pitcherId: string, options: FormBuildOptions = {}): Promise<FormPitcherResponse | null> {
  const season = options.season ?? getHomeSlateDate().slice(0, 4);
  const window = parseFormWindow(options.window);
  const starts = await getQualifiedFormStarts(season);
  const leagueMeanGS = mean(starts.map((start) => start.gameScorePlus));
  const bucket = buildPitcherBuckets(starts).find((candidate) => candidate.pitcherId === pitcherId);
  if (!bucket) return null;

  const summary = summarizePitcherBucket(bucket, window, leagueMeanGS);
  const series = buildStartPoints(bucket.starts, window);

  return {
    pitcher: {
      pitcherId: summary.pitcherId,
      name: summary.name,
      team: summary.team,
      throws: summary.throws,
      status: summary.status,
    },
    window,
    leagueMeanGS: round1(leagueMeanGS),
    series,
    summary,
  };
}

export async function getPitcherFormMap(pitcherIds: string[], options: FormBuildOptions = {}) {
  const leaderboard = await getFormLeaderboard({ ...options, qualifiedOnly: false });
  const wanted = new Set(pitcherIds);
  return new Map(leaderboard.pitchers.filter((pitcher) => wanted.has(pitcher.pitcherId)).map((pitcher) => [pitcher.pitcherId, pitcher]));
}

export async function getFormHome(options: FormBuildOptions = {}): Promise<FormHomeResponse> {
  const cacheKey = JSON.stringify({
    season: options.season ?? getHomeSlateDate().slice(0, 4),
    window: parseFormWindow(options.window),
  });
  const cached = formHomeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;

  const promise = buildFormHome(options);
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

  const hot = [...qualified].sort(compareHeatDesc).slice(0, HOME_CONFIG.railSize);
  const hotIds = new Set(hot.map((pitcher) => pitcher.pitcherId));
  const cold = [...qualified].filter((pitcher) => !hotIds.has(pitcher.pitcherId)).sort(compareHeatAsc).slice(0, HOME_CONFIG.railSize);
  const nextStarts = await getNextStartMap([...hot, ...cold].map((pitcher) => pitcher.pitcherId));

  return {
    generatedAt: leaderboard.generatedAt,
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
  };
}

async function getQualifiedFormStarts(season: string) {
  const starts = await getArchivedSeasonStartSummaries(season);
  const qualifiedArchivedStarts = filterQualifiedStarts(starts);
  if (qualifiedArchivedStarts.length > 0) return qualifiedArchivedStarts;

  const recentStarts = await getRecentLiveFormStarts(season);
  return filterQualifiedStarts(recentStarts);
}

async function getRecentLiveFormStarts(season: string) {
  const today = getHomeSlateDate();
  const dates = Array.from({ length: RECENT_FORM_LIVE_LOOKBACK_DAYS }, (_, index) => addDays(today, -index))
    .filter((date) => date.startsWith(season))
    .reverse();
  const slates = await Promise.all(dates.map((date) => getDailySlate({ window: "yesterday", date })));

  return slates
    .flat()
    .filter((start) => start.source?.line !== "fixture")
    .sort((a, b) => a.date.localeCompare(b.date) || a.gamePk - b.gamePk);
}

function filterQualifiedStarts(starts: StartSummary[]) {
  return starts.filter((start) => start.source?.line !== "fixture" && inningsToOuts(start.line.inningsPitched) >= inningsToOuts(FORM_CONFIG.ipFloor));
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

function summarizePitcherBucket(bucket: PitcherBucket, window: FormWindow, leagueMeanGS: number): FormSummary {
  const starts = bucket.starts;
  const latest = starts.at(-1);
  const windowStarts = starts.slice(-Math.min(window, starts.length));
  const windowCount = windowStarts.length;
  const rgs = mean(windowStarts.map((start) => start.gameScorePlus));
  const bgs = mean(starts.map((start) => start.gameScorePlus));
  const deltaForm = rgs - bgs;
  const trendDelta = calculateTrendDelta(windowStarts);
  const trend = classifyTrend(deltaForm);
  const status = windowCount >= FORM_CONFIG.minStartsInWindow ? "ok" : "insufficient";
  const lastStart = latest ? buildStartPoint(starts, starts.length - 1, window) : null;
  const rust = starts.length >= 2 ? daysBetween(starts.at(-2)?.date ?? "", starts.at(-1)?.date ?? "") > 20 : false;

  return {
    pitcherId: bucket.pitcherId,
    name: latest?.pitcher.name ?? "Unknown pitcher",
    team: latest?.pitcher.team ?? "",
    throws: latest?.pitcher.throws,
    status,
    rgs: round1(rgs),
    windowCount,
    bgs: round1(bgs),
    deltaForm: round1(deltaForm),
    trend,
    trendDelta: round1(trendDelta),
    tier: tierOf(Math.round(rgs)).key,
    heatIndex: calculateHeatIndex(rgs, leagueMeanGS, trendDelta),
    spark: windowStarts.map((start) => start.gameScorePlus),
    lastStart,
    flags: {
      limitedSample: windowCount < window,
      rust,
    },
  };
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
    tier: tierOf(start.gameScorePlus).key,
    rollingMean: round1(rollingMean),
    bandLow: round1(rollingMean - sd),
    bandHigh: round1(rollingMean + sd),
    startHref: startPath(start.id),
  };
}

function compareFormSummaries(a: FormSummary, b: FormSummary) {
  if (b.rgs !== a.rgs) return b.rgs - a.rgs;
  const aLast = a.lastStart;
  const bLast = b.lastStart;
  if ((bLast?.gsPlus ?? 0) !== (aLast?.gsPlus ?? 0)) return (bLast?.gsPlus ?? 0) - (aLast?.gsPlus ?? 0);
  if ((bLast?.ip ?? 0) !== (aLast?.ip ?? 0)) return (bLast?.ip ?? 0) - (aLast?.ip ?? 0);
  return a.name.localeCompare(b.name);
}

function compareFormAsc(a: FormSummary, b: FormSummary) {
  if (a.rgs !== b.rgs) return a.rgs - b.rgs;
  const aLast = a.lastStart;
  const bLast = b.lastStart;
  if ((aLast?.gsPlus ?? 0) !== (bLast?.gsPlus ?? 0)) return (aLast?.gsPlus ?? 0) - (bLast?.gsPlus ?? 0);
  if ((aLast?.ip ?? 0) !== (bLast?.ip ?? 0)) return (aLast?.ip ?? 0) - (bLast?.ip ?? 0);
  return a.name.localeCompare(b.name);
}

function compareHeatDesc(a: FormSummary, b: FormSummary) {
  const heatDelta = (b.heatIndex ?? 0) - (a.heatIndex ?? 0);
  if (heatDelta !== 0) return heatDelta;
  return compareFormSummaries(a, b);
}

function compareHeatAsc(a: FormSummary, b: FormSummary) {
  const heatDelta = (a.heatIndex ?? 0) - (b.heatIndex ?? 0);
  if (heatDelta !== 0) return heatDelta;
  return compareFormAsc(a, b);
}

function calculateTrendDelta(starts: StartSummary[]) {
  if (starts.length < 2) return 0;
  const prior = starts.slice(0, Math.floor(starts.length / 2));
  const recent = starts.slice(-Math.ceil(starts.length / 2));
  return mean(recent.map((start) => start.gameScorePlus)) - mean(prior.map((start) => start.gameScorePlus));
}

function classifyTrend(deltaForm: number): FormTrend {
  if (deltaForm >= FORM_CONFIG.heatingDelta) return "heating";
  if (deltaForm <= FORM_CONFIG.coolingDelta) return "cooling";
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
    p25: round1(percentile(sorted, 25)),
    p50: round1(percentile(sorted, 50)),
    p75: round1(percentile(sorted, 75)),
    p90: round1(percentile(sorted, 90)),
    max: round1(sorted.at(-1) ?? 0),
    mean: round1(mean(sorted)),
  };
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

function round1(value: number) {
  return Math.round(value * 10) / 10;
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

function daysBetween(a: string, b: string) {
  if (!a || !b) return 0;
  return Math.round((new Date(`${b}T00:00:00.000Z`).valueOf() - new Date(`${a}T00:00:00.000Z`).valueOf()) / (24 * 60 * 60 * 1000));
}
