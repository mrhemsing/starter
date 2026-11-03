import { readCachedRuntimeState } from "@/lib/data/runtime-state-store";

export type SeasonState = {
  status: "in_season" | "season_complete";
  year: number;
  finalSlateDate: string;
  recapPath: string;
};

// OFF-1: final slate verified against the complete canonical slate states.
// One runtime key re-arms every consumer; no calendar-based inference.
export const DEFAULT_SEASON_STATE: SeasonState = {
  status: "season_complete",
  year: 2026,
  finalSlateDate: "2026-10-28",
  recapPath: "/best-starts",
};

export async function getSeasonState(): Promise<SeasonState> {
  const stored = await readCachedRuntimeState<Record<string, unknown>>("season-state", 300);
  if (!stored) return DEFAULT_SEASON_STATE;
  if ((stored.status !== "in_season" && stored.status !== "season_complete") ||
      !Number.isInteger(stored.year) || typeof stored.finalSlateDate !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(stored.finalSlateDate)) {
    console.error("[season-integrity] invalid season-state; using safe default");
    return DEFAULT_SEASON_STATE;
  }
  return {
    status: stored.status,
    year: stored.year as number,
    finalSlateDate: stored.finalSlateDate,
    recapPath: typeof stored.recapPath === "string" && /^\/(?!\/)/.test(stored.recapPath)
      ? stored.recapPath : DEFAULT_SEASON_STATE.recapPath,
  };
}

export async function skipSeasonJob(job: string): Promise<boolean> {
  if ((await getSeasonState()).status !== "season_complete") return false;
  console.log(`[${job}] skipped: season complete`);
  return true;
}

export function assertSeasonWriteAllowed(state: SeasonState, operation: string): void {
  if (state.status !== "season_complete") return;
  const message = `[season-integrity] unexpected ${operation}: season complete`;
  console.error(message);
  throw new Error(message);
}

export async function guardSeasonWrite(operation: string): Promise<void> {
  assertSeasonWriteAllowed(await getSeasonState(), operation);
}
