import { inningsFromIP } from "@/lib/innings";
import type { StartSummary } from "@/lib/types";

const RANKED_START_IP_FLOOR = 2;

export function isPlannedStarter(start: Pick<StartSummary, "plannedStarter">) {
  return start.plannedStarter === true;
}

export function isRankedRegularStart(start: Pick<StartSummary, "line" | "plannedStarter">) {
  return inningsFromIP(start.line.inningsPitched) >= RANKED_START_IP_FLOOR;
}

export function isScoredStarterSample(start: Pick<StartSummary, "line" | "plannedStarter">, ipFloor: number) {
  return isPlannedStarter(start) || inningsFromIP(start.line.inningsPitched) >= ipFloor;
}
