import { formatStartLine } from "@/lib/format";
import { formatArsenalEventSentence } from "@/lib/arsenal-event-copy";
import { formatPitchEventQualitySentence, summarizePitchEventQuality } from "@/lib/pitch-event-quality";
import type { StartDetail, StartSummary } from "@/lib/types";
import corrections from "@/data/season-recap-corrections-2026.json";
export function recapSummary(start: StartDetail) {
  const corrected = (corrections as Record<string, { summary: string }>)[start.id];
  return corrected?.summary ?? generateStartRecap(start);
}

export function generateStartRecap(start: StartDetail) {
  const band = start.gameScorePlusBreakdown?.gradeBand.label.toLowerCase() ?? "graded";
  const decision = formatDecision(start.result).toLowerCase();
  const flags = start.eventFlags ?? [];
  const arsenalSentence = formatArsenalEventSentence(start.arsenalEventSummary);
  const qualitySentence = formatPitchEventQualitySentence(summarizePitchEventQuality(start.pitchEvents));
  const notableSentence = startNarrativeNotableSentence(start);
  const flagSentence = flags.includes("HARD_LUCK")
    ? "The hard-luck tag fits the score and decision."
    : flags.includes("VULTURE")
      ? "The vulture tag marks the decision as context, not ranking credit."
      : "The ranking stays driven by the canonical GS+ line.";

  return `${start.pitcher.name} posted a ${band} start against ${start.opponent}, working ${formatStartLine(start.line)} for GS+ ${start.gameScorePlus}. ${notableSentence ? `${notableSentence} ` : ""}The official decision was ${decision}. ${flagSentence}${arsenalSentence ? ` ${arsenalSentence}` : ""}${qualitySentence ? ` ${qualitySentence}` : ""}`;
}

function startNarrativeNotableSentence(start: StartDetail) {
  const combined = start.narrativeNotables?.combinedNoHitter;
  if (combined) return `${start.pitcher.name} supplied ${combined.starterInnings.toFixed(1)} hitless innings to ${combined.team}'s combined no-hitter against ${combined.opponent}.`;
  const noHit = start.narrativeNotables?.noHitDepth;
  if (noHit?.firstHitInning && noHit.innings >= 8) return `${start.pitcher.name} carried a no-hitter into the ${ordinal(noHit.firstHitInning)}.`;
  if (noHit?.hitlessStintComplete && noHit.innings >= 5) return `${start.pitcher.name} worked ${noHit.innings}.0 hitless innings.`;
  if (start.narrativeNotables?.strikeouts?.doubleDigit) return `${start.pitcher.name} reached double digits with ${start.line.strikeouts} strikeouts.`;
  return null;
}

function ordinal(value: number) {
  if (value === 8) return "eighth";
  if (value === 9) return "ninth";
  return `${value}th`;
}

export function formatDecision(result: StartSummary["result"]) {
  if (result === "W") return "Win";
  if (result === "L") return "Loss";
  if (result === "ND") return "No decision";
  return "Pending";
}
