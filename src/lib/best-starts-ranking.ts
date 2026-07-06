import { rawGameScorePlus } from "@/lib/gs-plus-raw";
import { isRankedRegularStart } from "@/lib/start-classification";
import type { StartSummary } from "@/lib/types";

export function isEligibleBestStart(start: StartSummary) {
  return start.source?.line !== "fixture" && isRankedRegularStart(start);
}

export function bestStartRawScore(start: StartSummary) {
  return rawGameScorePlus(start.gameScorePlusBreakdown) ?? start.gameScorePlus;
}

export function compareBestStarts(a: StartSummary, b: StartSummary) {
  return (
    bestStartRawScore(b) - bestStartRawScore(a) ||
    b.line.strikeouts - a.line.strikeouts ||
    a.date.localeCompare(b.date) ||
    (a.gamePk ?? 0) - (b.gamePk ?? 0) ||
    a.pitcher.name.localeCompare(b.pitcher.name)
  );
}

export function rankBestStarts<T extends StartSummary>(starts: T[]) {
  return [...starts].filter(isEligibleBestStart).sort(compareBestStarts);
}

export function bestStartWindow(starts: StartSummary[], latestDate: string, days: number) {
  const minDate = addDays(latestDate, -(days - 1));
  return rankBestStarts(starts.filter((start) => start.date >= minDate && start.date <= latestDate));
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
