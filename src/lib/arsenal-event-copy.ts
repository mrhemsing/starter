import { pitchTypes } from "@/lib/pitch-taxonomy";
import type { StartArsenalEventSummary } from "@/lib/types";

export function formatArsenalEventHeadline(summary?: StartArsenalEventSummary) {
  if (!summary) return null;
  if (summary.newPitchTypes.length > 0) {
    return `New ${formatPitchTypeList(summary.newPitchTypes)}`;
  }

  const shift = summary.usageShifts[0];
  if (!shift) return null;

  return `${pitchTypes[shift.type].name} ${formatSignedPct(shift.usageDeltaPct)} usage`;
}

export function formatArsenalEventSentence(summary?: StartArsenalEventSummary) {
  if (!summary) return null;
  if (summary.newPitchTypes.length > 0) {
    return `Arsenal note: ${formatPitchTypeList(summary.newPitchTypes)} appeared after prior archived starts.`;
  }

  const shift = summary.usageShifts[0];
  if (!shift) return null;

  return `Arsenal note: ${pitchTypes[shift.type].name} usage moved ${formatSignedPct(shift.usageDeltaPct)} points from the prior archived start.`;
}

function formatPitchTypeList(types: StartArsenalEventSummary["newPitchTypes"]) {
  return types.map((type) => pitchTypes[type].name).join(" / ");
}

function formatSignedPct(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}
