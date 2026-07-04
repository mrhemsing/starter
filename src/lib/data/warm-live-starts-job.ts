import { DATA_CHANGE_CACHE_TAGS, HOME_RANKED_CACHE_TAG } from "@/lib/data/cache-tags";
import { warmFormLeaderboards } from "@/lib/data/form-service";
import { getRankedHome } from "@/lib/data/home-ranked-service";
import { getLiveScoreboard } from "@/lib/data/live-scoreboard-service";
import { getRankedStartsPageData, rankedStartsDateCacheTag } from "@/lib/data/ranked-starts-page-service";
import { revalidateRankedStartsDate } from "@/lib/data/ranked-starts-revalidation";
import { readRuntimeState, writeRuntimeState } from "@/lib/data/runtime-state-store";
import { getDailySlate, getHomeSlateDate, getRankedSlateCompletionState } from "@/lib/data/start-service";
import { getSupabaseArchiveStatus } from "@/lib/data/supabase-archive";
import { getTonightMustWatch } from "@/lib/data/tonight-service";
import { homeLiveLeaderSignature, resolveHomeLiveLeaderRow, type HomeLiveLeaderSignature } from "@/lib/home-live-leader";

export const WARM_LIVE_STARTS_BATCH_SIZE = 8;
const WARM_TEAM_FORM_ON_CRON_FLAG = "THE_BUMP_WARM_TEAM_FORM_ON_CRON";
const WARM_LIVE_STARTS_LOCK_MS = 55_000;
type WarmLiveStartsRevalidators = {
  revalidatePath?: (path: string) => void;
  revalidateTag?: (tag: string, profile: "max") => void;
};

type WarmLiveStartsJobOptions = WarmLiveStartsRevalidators & {
  date?: string;
};

export type WarmLiveStartsJobResult = {
  warmed: boolean;
  date: string;
  reason?: "no-live-or-final-games" | "archive-gap" | "already-running";
  liveGames: number;
  finalGames: number;
  totalGames: number;
  completedStarts?: number;
  affectedPitchers?: number;
  warmedTeams?: number;
  deferredTeams?: number;
  teamBatches?: number;
  pitcherBatches?: number;
  topPerformer?: {
    startId: string;
    pitcherName: string;
    imageSource: string | null;
  } | null;
  homeLeaderRevalidated?: boolean;
  rankedStartsPageWarmed?: boolean;
  revalidated?: boolean;
  durationMs?: number;
  generatedAt?: string;
};

type WarmLiveStartsProgress = {
  completedSteps: string[];
  updatedAt: string;
};

type WarmLiveStartsLock = {
  startedAt: string;
  expiresAt: string;
};

type WarmHomeLiveLeaderState = {
  signature: HomeLiveLeaderSignature | null;
  updatedAt: string;
};

export async function runWarmLiveStartsJob(options: WarmLiveStartsJobOptions = {}): Promise<WarmLiveStartsJobResult> {
  const date = warmLiveStartsDate(options.date);
  const startedAt = new Date();
  console.log("warm-live-starts start", { date, batchSize: WARM_LIVE_STARTS_BATCH_SIZE, startedAt: startedAt.toISOString() });
  const archiveStatus = await getSupabaseArchiveStatus(date.slice(0, 4), { expectedLastCompletedDate: addDays(getHomeSlateDate(), -1) });
  if (archiveStatus.freshness?.stale) {
    console.error("warm-live-starts archive gap detected; deferring to archive job", {
      date,
      lastDate: archiveStatus.lastDate,
      expectedLastCompletedDate: archiveStatus.freshness.expectedLastCompletedDate,
      lagDays: archiveStatus.freshness.lagDays,
    });
    return {
      warmed: false,
      date,
      reason: "archive-gap",
      liveGames: 0,
      finalGames: 0,
      totalGames: 0,
    };
  }

  const lockKey = warmLiveStartsLockKey(date);
  const lock = await acquireWarmLiveStartsLock(lockKey);
  if (!lock.acquired) {
    console.warn("warm-live-starts overlap lock active; exiting", { date, expiresAt: lock.expiresAt });
    return {
      warmed: false,
      date,
      reason: "already-running",
      liveGames: 0,
      finalGames: 0,
      totalGames: 0,
    };
  }

  try {
    return await runWarmLiveStartsJobUnlocked(options, date, startedAt);
  } finally {
    await releaseWarmLiveStartsLock(lockKey);
  }
}

async function runWarmLiveStartsJobUnlocked(options: WarmLiveStartsJobOptions, date: string, startedAt: Date): Promise<WarmLiveStartsJobResult> {
  const [tonight, completion] = await Promise.all([
    getTonightMustWatch({ date, window: 5 }),
    getRankedSlateCompletionState(date, getHomeSlateDate()),
  ]);
  const liveGames = tonight.games.filter((game) => game.status === "live").length;
  const activeGames = liveGames + completion.finalGames;

  if (activeGames === 0) {
    console.log("warm-live-starts end", { date, warmed: false, reason: "no-live-or-final-games" });
    return {
      warmed: false,
      date,
      reason: "no-live-or-final-games",
      liveGames,
      finalGames: completion.finalGames,
      totalGames: completion.totalGames,
    };
  }

  const starts = await getDailySlate({ window: "today", date, persistCanonical: true });
  const completedStarts = starts.filter((start) => start.source?.line !== "fixture");
  const progressKey = warmLiveStartsProgressKey(date, completion.finalGames, completedStarts.length);
  const progress = await readWarmLiveStartsProgress(progressKey);
  const slateTeams = uniqueValues([
    ...tonight.games.flatMap((game) => [game.away, game.home]),
    ...completedStarts.map((start) => start.pitcher.team),
  ]);
  const pitcherIds = uniqueValues(completedStarts.map((start) => start.pitcher.id));
  let pitcherBatches = 0;

  if (completedStarts.length > 0) {
    if (!hasCompletedWarmStep(progress, "revalidate-tags")) {
      for (const tag of DATA_CHANGE_CACHE_TAGS) {
        options.revalidateTag?.(tag, "max");
      }
      revalidateRankedStartsDate(date, options, completion.isFinal ? "slate-complete" : "settle-progress");
      await markWarmStepComplete(progressKey, progress, "revalidate-tags");
      console.log("warm-live-starts batch revalidated tags", { date, tags: DATA_CHANGE_CACHE_TAGS.length, rankedStartsDateTag: rankedStartsDateCacheTag(date) });
    }
    for (const path of ["/", "/heat-check", `/starts/${date}`]) {
      const step = `revalidate-path:${path}`;
      if (hasCompletedWarmStep(progress, step)) continue;
      options.revalidatePath?.(path);
      await markWarmStepComplete(progressKey, progress, step);
      console.log("warm-live-starts batch revalidated path", { date, path });
    }
    for (const batch of batchItems(pitcherIds, WARM_LIVE_STARTS_BATCH_SIZE)) {
      const batchKey = `pitcher-forms:${batch.join(",")}`;
      if (hasCompletedWarmStep(progress, batchKey)) {
        pitcherBatches += 1;
        continue;
      }
      for (const pitcherId of batch) {
        options.revalidatePath?.(`/pitchers/${pitcherId}/form`);
      }
      pitcherBatches += 1;
      await markWarmStepComplete(progressKey, progress, batchKey);
      console.log("warm-live-starts batch revalidated pitcher forms", { date, count: batch.length, batch: pitcherBatches });
    }
  }

  const rankedStartsPageWarmed = completedStarts.length > 0
    ? await warmRankedStartsPage(date, progressKey, progress)
    : false;

  if (!hasCompletedWarmStep(progress, "form-global")) {
    await warmFormLeaderboards();
    await markWarmStepComplete(progressKey, progress, "form-global");
    console.log("warm-live-starts batch warmed global form leaderboards", { date });
  }
  let teamBatches = 0;
  if (shouldWarmTeamFormOnCron()) {
    for (const batch of batchItems(slateTeams, WARM_LIVE_STARTS_BATCH_SIZE)) {
      const batchKey = `team-form:${batch.join(",")}`;
      if (hasCompletedWarmStep(progress, batchKey)) {
        teamBatches += 1;
        continue;
      }
      await warmFormLeaderboards({ teams: batch, includeGlobal: false });
      teamBatches += 1;
      await markWarmStepComplete(progressKey, progress, batchKey);
      console.log("warm-live-starts batch warmed form leaderboards", { date, teams: batch.length, batch: teamBatches });
    }
  } else {
    console.log("warm-live-starts team form warming deferred", { date, teams: slateTeams.length, flag: WARM_TEAM_FORM_ON_CRON_FLAG });
  }

  const homeLeaderRevalidated = await revalidateHomeLeaderSnapshotOnChange(date, options);
  const topPerformer = hasCompletedWarmStep(progress, "ranked-home") && !homeLeaderRevalidated
    ? null
    : await warmRankedHome(progressKey, progress);
  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - startedAt.getTime();
  console.log("warm-live-starts end", {
    date,
    warmed: true,
    completedStarts: completedStarts.length,
    teams: slateTeams.length,
    durationMs,
    pitcherBatches,
    teamBatches,
  });

  return {
    warmed: true,
    date,
    liveGames,
    finalGames: completion.finalGames,
    totalGames: completion.totalGames,
    completedStarts: completedStarts.length,
    affectedPitchers: pitcherIds.length,
    warmedTeams: shouldWarmTeamFormOnCron() ? slateTeams.length : 0,
    deferredTeams: shouldWarmTeamFormOnCron() ? 0 : slateTeams.length,
    pitcherBatches,
    teamBatches,
    topPerformer: topPerformer
      ? {
          startId: topPerformer.start.id,
          pitcherName: topPerformer.start.pitcher.name,
          imageSource: topPerformer.image?.source ?? null,
        }
      : null,
    homeLeaderRevalidated,
    rankedStartsPageWarmed,
    revalidated: completedStarts.length > 0,
    durationMs,
    generatedAt: finishedAt.toISOString(),
  };
}

function warmLiveStartsDate(dateOverride: string | undefined) {
  if (dateOverride && /^\d{4}-\d{2}-\d{2}$/.test(dateOverride)) return dateOverride;
  return getHomeSlateDate();
}

function shouldWarmTeamFormOnCron() {
  return process.env[WARM_TEAM_FORM_ON_CRON_FLAG] === "1";
}

async function readWarmLiveStartsProgress(key: string): Promise<WarmLiveStartsProgress> {
  return await readRuntimeState<WarmLiveStartsProgress>(key) ?? { completedSteps: [], updatedAt: new Date(0).toISOString() };
}

function hasCompletedWarmStep(progress: WarmLiveStartsProgress, step: string) {
  return progress.completedSteps.includes(step);
}

async function warmRankedHome(key: string, progress: WarmLiveStartsProgress) {
  const rankedHome = await getRankedHome();
  await markWarmStepComplete(key, progress, "ranked-home");
  console.log("warm-live-starts batch warmed ranked home", { step: "ranked-home" });
  return rankedHome.topPerformer;
}

async function warmRankedStartsPage(date: string, key: string, progress: WarmLiveStartsProgress) {
  const step = `ranked-starts-page:${date}`;
  if (hasCompletedWarmStep(progress, step)) return false;
  await getRankedStartsPageData(date, getHomeSlateDate());
  await markWarmStepComplete(key, progress, step);
  console.log("warm-live-starts batch warmed ranked starts page", { date, path: `/starts/${date}` });
  return true;
}

async function revalidateHomeLeaderSnapshotOnChange(date: string, options: WarmLiveStartsRevalidators) {
  const board = await getLiveScoreboard({ date }).catch(() => null);
  const signature = homeLiveLeaderSignature(resolveHomeLiveLeaderRow(board));
  const stateKey = homeLiveLeaderStateKey(date);
  const previous = await readRuntimeState<WarmHomeLiveLeaderState>(stateKey);

  if (sameHomeLiveLeaderSignature(previous?.signature ?? null, signature)) return false;

  options.revalidateTag?.(HOME_RANKED_CACHE_TAG, "max");
  options.revalidatePath?.("/");
  await writeRuntimeState(stateKey, { signature, updatedAt: new Date().toISOString() });
  console.log("warm-live-starts revalidated home live leader snapshot", {
    date,
    previous: previous?.signature ?? null,
    next: signature,
    tag: HOME_RANKED_CACHE_TAG,
  });
  return true;
}

async function markWarmStepComplete(key: string, progress: WarmLiveStartsProgress, step: string) {
  if (!progress.completedSteps.includes(step)) {
    progress.completedSteps.push(step);
  }
  progress.updatedAt = new Date().toISOString();
  await writeRuntimeState(key, progress);
}

function warmLiveStartsProgressKey(date: string, finalGames: number, completedStarts: number) {
  return `warm-live-starts:${date}:g${finalGames}:s${completedStarts}`;
}

function homeLiveLeaderStateKey(date: string) {
  return `home-live-leader:${date}`;
}

function sameHomeLiveLeaderSignature(left: HomeLiveLeaderSignature | null, right: HomeLiveLeaderSignature | null) {
  if (!left || !right) return left === right;
  return left.startId === right.startId && left.gsPlus === right.gsPlus && left.scoreLabel === right.scoreLabel;
}

async function acquireWarmLiveStartsLock(key: string): Promise<{ acquired: boolean; expiresAt?: string }> {
  const existing = await readRuntimeState<WarmLiveStartsLock>(key);
  const now = Date.now();
  if (existing && new Date(existing.expiresAt).getTime() > now) {
    return { acquired: false, expiresAt: existing.expiresAt };
  }
  const next = {
    startedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + WARM_LIVE_STARTS_LOCK_MS).toISOString(),
  };
  await writeRuntimeState(key, next);
  return { acquired: true, expiresAt: next.expiresAt };
}

async function releaseWarmLiveStartsLock(key: string) {
  await writeRuntimeState(key, {
    startedAt: new Date(0).toISOString(),
    expiresAt: new Date(0).toISOString(),
  });
}

function warmLiveStartsLockKey(date: string) {
  return `warm-live-starts-lock:${date}`;
}

function uniqueValues<T>(values: T[]) {
  return [...new Set(values)];
}

function batchItems<T>(items: T[], batchSize: number) {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }
  return batches;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
