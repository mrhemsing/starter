import { DATA_CHANGE_CACHE_TAGS, HOME_RANKED_CACHE_TAG, LIVE_CACHE_TAG } from "@/lib/data/cache-tags";
import { warmFormLeaderboards } from "@/lib/data/form-service";
import { getRankedHome } from "@/lib/data/home-ranked-service";
import { getLiveScoreboard, writeSlateStoryForFinalBoard } from "@/lib/data/live-scoreboard-service";
import { updateNoHitterBidStateFromLiveBoard } from "@/lib/data/no-hitter-alert-service";
import { getRankedStartsPageData, rankedStartsDateCacheTag } from "@/lib/data/ranked-starts-page-service";
import { revalidateRankedStartsDate } from "@/lib/data/ranked-starts-revalidation";
import { readRuntimeState, writeRuntimeState } from "@/lib/data/runtime-state-store";
import { getDailySlate, getHomeSlateDate, getRankedSlateCompletionState } from "@/lib/data/start-service";
import { getSupabaseArchiveStatus } from "@/lib/data/supabase-archive";
import { getTonightMustWatch } from "@/lib/data/tonight-service";
import { resolveTopPerformerImage } from "@/lib/data/top-performer-image-service";
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
  openingRevalidated?: boolean;
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

type WarmSlateLifecycleState = {
  signature: string;
  updatedAt: string;
};

export async function runWarmLiveStartsJob(options: WarmLiveStartsJobOptions = {}): Promise<WarmLiveStartsJobResult> {
  const date = warmLiveStartsDate(options.date);
  const startedAt = new Date();
  console.log("warm-live-starts start", { date, batchSize: WARM_LIVE_STARTS_BATCH_SIZE, startedAt: startedAt.toISOString() });
  const archiveStatus = await getSupabaseArchiveStatus(date.slice(0, 4), { expectedLastCompletedDate: addDays(getHomeSlateDate(), -1) });
  if (archiveStatus.freshness?.stale) {
    console.error("warm-live-starts archive gap detected; continuing canonical settle/revalidation path", {
      date,
      lastDate: archiveStatus.lastDate,
      expectedLastCompletedDate: archiveStatus.freshness.expectedLastCompletedDate,
      lagDays: archiveStatus.freshness.lagDays,
    });
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
  const [tonight, completion, liveBoard] = await Promise.all([
    getTonightMustWatch({ date, window: 5 }),
    getRankedSlateCompletionState(date, getHomeSlateDate()),
    getLiveScoreboard({ date }).catch(() => null),
  ]);
  const liveGames = liveBoard ? Math.ceil(liveBoard.liveStarts / 2) : 0;
  const warmingGames = liveBoard ? Math.ceil(liveBoard.warmingStarts / 2) : 0;
  const activeGames = liveGames + warmingGames + completion.finalGames;
  const openingRevalidated = await revalidateSlateLifecycleTransition({
    date,
    options,
    reason: slateLifecycleRevalidationReason({
      liveStarts: liveBoard?.liveStarts ?? 0,
      warmingStarts: liveBoard?.warmingStarts ?? 0,
      completedStarts: liveBoard?.finalStarts ?? 0,
      totalStarts: liveBoard?.totalStarts ?? completion.totalGames * 2,
    }),
    signature: slateLifecycleSignature({
      date,
      totalGames: liveBoard?.slateProgress.totalGames ?? completion.totalGames,
      totalStarts: liveBoard?.totalStarts ?? completion.totalGames * 2,
      scheduledStarts: liveBoard?.scheduledStarts ?? Math.max(0, completion.totalGames * 2 - completion.finalGames * 2),
      warmingStarts: liveBoard?.warmingStarts ?? 0,
      liveStarts: liveBoard?.liveStarts ?? 0,
      completedStarts: liveBoard?.finalStarts ?? completion.finalGames * 2,
      progressState: liveBoard?.slateProgress.state ?? (completion.isFinal ? "all-starts-complete" : activeGames > 0 ? "starts-in-progress" : "pre-first-pitch"),
    }),
  });
  const noHitterAlerts = liveBoard
    ? await updateNoHitterBidStateFromLiveBoard(date, liveBoard.rows, startedAt)
    : { changed: false, activeAlerts: 0, events: 0 };
  if (noHitterAlerts.changed) {
    options.revalidateTag?.(LIVE_CACHE_TAG, "max");
    options.revalidatePath?.("/");
    options.revalidatePath?.(`/live/${date}`);
    console.log("warm-live-starts revalidated no-hitter alert surfaces", { date, activeAlerts: noHitterAlerts.activeAlerts, events: noHitterAlerts.events });
  }

  if (activeGames === 0) {
    console.log("warm-live-starts end", { date, warmed: openingRevalidated || noHitterAlerts.changed, reason: "no-live-or-final-games", openingRevalidated, noHitterAlerts });
    return {
      warmed: openingRevalidated || noHitterAlerts.changed,
      date,
      reason: "no-live-or-final-games",
      liveGames,
      finalGames: completion.finalGames,
      totalGames: completion.totalGames,
      openingRevalidated,
      revalidated: openingRevalidated || noHitterAlerts.changed,
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
  const slateStoryStored = liveBoard && liveBoard.totalStarts > 0 && liveBoard.finalStarts >= liveBoard.totalStarts
    ? await writeSlateStoryForFinalBoard(date, liveBoard.rows, liveBoard.totalStarts, startedAt)
    : false;
  if (slateStoryStored) {
    options.revalidateTag?.(LIVE_CACHE_TAG, "max");
    options.revalidatePath?.(`/live/${date}`);
    console.log("warm-live-starts stored slate story", { date, totalStarts: liveBoard?.totalStarts ?? 0 });
  }
  const topPerformer = await warmRankedHome(progressKey, progress, options);
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
    openingRevalidated,
    homeLeaderRevalidated,
    rankedStartsPageWarmed,
    revalidated: completedStarts.length > 0 || openingRevalidated || homeLeaderRevalidated || noHitterAlerts.changed,
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

async function warmRankedHome(key: string, progress: WarmLiveStartsProgress, options: WarmLiveStartsRevalidators) {
  const rankedHome = await getRankedHome();
  const refreshedLiveImage = rankedHome.topPerformer?.status === "live" && rankedHome.topPerformer.image?.source === "placeholder"
    ? await resolveTopPerformerImage(rankedHome.topPerformer.start, null).catch(() => null)
    : null;
  if (refreshedLiveImage?.source === "action") {
    options.revalidateTag?.(HOME_RANKED_CACHE_TAG, "max");
    options.revalidatePath?.("/");
    console.log("warm-live-starts promoted live top performer action photo", {
      step: "ranked-home-live-photo-refresh",
      topPerformerStartId: rankedHome.topPerformer?.start.id ?? null,
      pitcherName: rankedHome.topPerformer?.start.pitcher.name ?? null,
      imageSource: refreshedLiveImage.source,
    });
  }
  await markWarmStepComplete(key, progress, "ranked-home");
  console.log("warm-live-starts batch warmed ranked home", {
    step: "ranked-home",
    topPerformerStartId: rankedHome.topPerformer?.start.id ?? null,
    topPerformerStatus: rankedHome.topPerformer?.status ?? null,
    imageSource: refreshedLiveImage?.source ?? rankedHome.topPerformer?.image?.source ?? null,
    photoRefreshNeeded: rankedHome.topPerformer?.status === "live" && (refreshedLiveImage?.source ?? rankedHome.topPerformer.image?.source) === "placeholder",
  });
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
  revalidateRankedStartsDate(date, options, "leader-change");
  await writeRuntimeState(stateKey, { signature, updatedAt: new Date().toISOString() });
  console.log("warm-live-starts revalidated home live leader snapshot", {
    date,
    previous: previous?.signature ?? null,
    next: signature,
    tag: HOME_RANKED_CACHE_TAG,
  });
  return true;
}

async function revalidateSlateLifecycleTransition({
  date,
  options,
  reason,
  signature,
}: {
  date: string;
  options: WarmLiveStartsRevalidators;
  reason: "slate-open" | "warming" | "first-pitch" | "settle-progress" | "slate-complete";
  signature: string;
}) {
  const stateKey = slateLifecycleStateKey(date);
  const previous = await readRuntimeState<WarmSlateLifecycleState>(stateKey);
  if (previous?.signature === signature) return false;

  revalidateRankedStartsDate(date, options, reason);
  await writeRuntimeState(stateKey, { signature, updatedAt: new Date().toISOString() });
  console.log("warm-live-starts revalidated slate lifecycle transition", {
    date,
    reason,
    previous: previous?.signature ?? null,
    next: signature,
  });
  return true;
}

function slateLifecycleRevalidationReason({
  liveStarts,
  warmingStarts,
  completedStarts,
  totalStarts,
}: {
  liveStarts: number;
  warmingStarts: number;
  completedStarts: number;
  totalStarts: number;
}): "slate-open" | "warming" | "first-pitch" | "settle-progress" | "slate-complete" {
  if (totalStarts > 0 && completedStarts >= totalStarts) return "slate-complete";
  if (completedStarts > 0) return "settle-progress";
  if (liveStarts > 0) return "first-pitch";
  if (warmingStarts > 0) return "warming";
  return "slate-open";
}

function slateLifecycleSignature({
  date,
  totalGames,
  totalStarts,
  scheduledStarts,
  warmingStarts,
  liveStarts,
  completedStarts,
  progressState,
}: {
  date: string;
  totalGames: number;
  totalStarts: number;
  scheduledStarts: number;
  warmingStarts: number;
  liveStarts: number;
  completedStarts: number;
  progressState: string;
}) {
  return [
    date,
    `state:${progressState}`,
    `games:${totalGames}`,
    `starts:${totalStarts}`,
    `scheduled:${scheduledStarts}`,
    `warming:${warmingStarts}`,
    `live:${liveStarts}`,
    `complete:${completedStarts}`,
  ].join("|");
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

function slateLifecycleStateKey(date: string) {
  return `slate-lifecycle:${date}`;
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
