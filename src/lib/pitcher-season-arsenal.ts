import stored from "@/data/pitcher-arsenals-2026.json";
import type { ArsenalPitchSummary, PitcherApiResponse } from "@/lib/types";

export type SeasonArsenalCoverage = {
  arsenal: ArsenalPitchSummary[]; expected: number; covered: number; pitches: number;
  firstDate: string; lastDate: string; missing: string[]; startIds: string[];
  velocityByStart?: PitcherApiResponse["velocityByStart"];
  pitchMixByStart?: PitcherApiResponse["pitchMixByStart"];
  skillProfile?: PitcherApiResponse["skillProfile"];
};
export function pitcherSeasonArsenal(pitcherId: string, season: string): SeasonArsenalCoverage | null {
  if (season !== String(stored.year)) return null;
  return (stored.pitchers as unknown as Record<string, SeasonArsenalCoverage>)[pitcherId] ?? null;
}
