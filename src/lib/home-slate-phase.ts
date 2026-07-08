import type { RankedHomeResponse } from "@/lib/data/home-ranked-service";
import type { SlateProgressState } from "@/lib/slate-state";

export type HomeSlatePhase = "PREGAME" | "EARLY" | "PRIME" | "WRAP";
export type HomeSlatePhaseVariant = "control" | "phase-aware";
export type HomeModuleKey = "spotlight" | "watch" | "heat" | "ranked" | "best";

export const HOME_SLATE_PHASE_EXPERIMENT_ENV = "NEXT_PUBLIC_HOME_SLATE_PHASE_EXPERIMENT";
export const HOME_PRIME_LIVE_GS_PLUS_THRESHOLD = 50;

const CONTROL_MODULE_ORDER: HomeModuleKey[] = ["spotlight", "watch", "heat", "ranked", "best"];

const PHASE_MODULE_ORDER: Record<HomeSlatePhase, HomeModuleKey[]> = {
  PREGAME: ["watch", "heat", "ranked", "spotlight", "best"],
  EARLY: ["watch", "spotlight", "heat", "ranked", "best"],
  PRIME: CONTROL_MODULE_ORDER,
  WRAP: ["ranked", "watch", "spotlight", "heat", "best"],
};

export function isHomeSlatePhaseExperimentEnabled() {
  return process.env[HOME_SLATE_PHASE_EXPERIMENT_ENV] === "1";
}

export function getHomeSlatePhase({
  slateProgress,
  ranked,
}: {
  slateProgress: SlateProgressState;
  ranked: RankedHomeResponse | null;
}): HomeSlatePhase {
  if (slateProgress.state === "all-starts-complete") return "WRAP";
  if (slateProgress.state === "pre-first-pitch" || slateProgress.state === "no-games") return "PREGAME";

  const liveLeaderScore = ranked?.topPerformer?.status === "live" ? ranked.topPerformer.start.gameScorePlus : null;
  if (slateProgress.completedStarts >= 4 || slateProgress.liveStarts >= 4 || (liveLeaderScore !== null && liveLeaderScore >= HOME_PRIME_LIVE_GS_PLUS_THRESHOLD)) return "PRIME";

  return "EARLY";
}

export function getHomeModuleOrder(phase: HomeSlatePhase, variant: HomeSlatePhaseVariant): HomeModuleKey[] {
  if (variant === "control") return CONTROL_MODULE_ORDER;
  return PHASE_MODULE_ORDER[phase];
}
