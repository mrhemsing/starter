import stored from "@/data/pitcher-official-coverage-2026.json";

/** Display-only reconciliation. Relief appearances never enter starter scoring or form. */
export function pitcherOfficialCoverage(pitcherId: string, season: string) {
  if (season !== String(stored.year)) return null;
  return (stored.pitchers as Record<string, { starts: number; starterOuts: number; reliefOuts: number }>)[pitcherId] ?? null;
}
