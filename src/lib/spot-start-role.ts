export type StarterRoleContextLabel = "SPOT START" | "RECENT CALL-UP" | "STRETCHING OUT" | "FIRST STARTS";

export type StarterRoleContextInput = {
  gamesStarted: number;
  totalAppearances: number;
  lastTwoAppearancesStarted: boolean;
};

export function classifyStarterRoleContext(input: StarterRoleContextInput): StarterRoleContextLabel {
  const reliefAppearances = Math.max(0, input.totalAppearances - input.gamesStarted);
  if (reliefAppearances > input.gamesStarted && input.gamesStarted <= 2) return "SPOT START";
  if (input.totalAppearances < 3) return "RECENT CALL-UP";
  if (input.gamesStarted <= 3 && input.lastTwoAppearancesStarted) return "STRETCHING OUT";
  return "FIRST STARTS";
}
