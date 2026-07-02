import { pitchTypes } from "@/lib/pitch-taxonomy";
import type { PitchEvent, PitchTypeKey } from "@/lib/types";

const SWING_RESULTS = new Set(["swinging_strike", "foul", "hit_into_play"]);
const strikeZone = { xMin: -0.83, xMax: 0.83, zMin: 1.5, zMax: 3.5 };

export type PitchTypeQualitySummary = {
  type: PitchTypeKey;
  count: number;
  pct: number;
  avgVelo: number;
  maxVelo: number;
  cswPct: number;
  swingPct: number;
  zonePct: number;
  whiffPct: number;
};

export type PitchEventQualitySummary = {
  pitchCount: number;
  cswPct: number;
  zonePct: number;
  swingPct: number;
  whiffPct: number;
  topType: PitchTypeQualitySummary | null;
  byType: PitchTypeQualitySummary[];
};

export function summarizePitchEventQuality(pitches: PitchEvent[]): PitchEventQualitySummary {
  const byType = (Object.keys(pitchTypes) as PitchTypeKey[]).map((type) => summarizePitchTypeQuality(type, pitches));
  const calledStrikes = pitches.filter((pitch) => pitch.result === "called_strike").length;
  const whiffs = pitches.filter((pitch) => pitch.result === "swinging_strike").length;
  const swings = pitches.filter((pitch) => SWING_RESULTS.has(pitch.result)).length;
  const inZone = pitches.filter(isPitchInStrikeZone).length;
  const topType = byType
    .filter((stat) => stat.count > 0)
    .sort((a, b) => b.cswPct - a.cswPct || b.count - a.count)[0] ?? null;

  return {
    pitchCount: pitches.length,
    cswPct: pitches.length > 0 ? (calledStrikes + whiffs) / pitches.length : 0,
    zonePct: pitches.length > 0 ? inZone / pitches.length : 0,
    swingPct: pitches.length > 0 ? swings / pitches.length : 0,
    whiffPct: swings > 0 ? whiffs / swings : 0,
    topType,
    byType,
  };
}

export function formatPitchEventQualitySentence(summary: PitchEventQualitySummary | null | undefined) {
  if (!summary || summary.pitchCount === 0) return null;
  const topPitch = summary.topType ? ` Best CSW pitch: ${pitchTypes[summary.topType.type].name} at ${formatPct(summary.topType.cswPct)}.` : "";
  return `Pitch-event quality: ${formatPct(summary.cswPct)} CSW, ${formatPct(summary.whiffPct)} whiff, ${formatPct(summary.zonePct)} zone.${topPitch}`;
}

export function formatPitchEventQualityHeadline(summary: PitchEventQualitySummary | null | undefined) {
  if (!summary || summary.pitchCount === 0) return null;
  return `${formatPct(summary.cswPct)} CSW · ${formatPct(summary.whiffPct)} whiff`;
}

export function isPitchInStrikeZone(pitch: Pick<PitchEvent, "plateX" | "plateZ">) {
  return pitch.plateX >= strikeZone.xMin && pitch.plateX <= strikeZone.xMax && pitch.plateZ >= strikeZone.zMin && pitch.plateZ <= strikeZone.zMax;
}

function summarizePitchTypeQuality(type: PitchTypeKey, pitches: PitchEvent[]): PitchTypeQualitySummary {
  const ofType = pitches.filter((pitch) => pitch.type === type);
  const calledStrikes = ofType.filter((pitch) => pitch.result === "called_strike").length;
  const whiffs = ofType.filter((pitch) => pitch.result === "swinging_strike").length;
  const swings = ofType.filter((pitch) => SWING_RESULTS.has(pitch.result)).length;
  const inZone = ofType.filter(isPitchInStrikeZone).length;
  const velos = ofType.map((pitch) => pitch.velocityMph);

  return {
    type,
    count: ofType.length,
    pct: pitches.length > 0 ? ofType.length / pitches.length : 0,
    avgVelo: velos.length ? velos.reduce((total, velo) => total + velo, 0) / velos.length : 0,
    maxVelo: velos.length ? Math.max(...velos) : 0,
    cswPct: ofType.length > 0 ? (calledStrikes + whiffs) / ofType.length : 0,
    swingPct: ofType.length > 0 ? swings / ofType.length : 0,
    zonePct: ofType.length > 0 ? inZone / ofType.length : 0,
    whiffPct: swings > 0 ? whiffs / swings : 0,
  };
}

function formatPct(value: number) {
  return `${Math.round(value * 100)}%`;
}
