export type MatchupMode = "perspective" | "slate";

type TeamValue = string | null | undefined;

function cleanTeam(team: TeamValue) {
  const value = team?.trim();
  return value || null;
}

function warnInvalidMatchup(perspectiveTeam: TeamValue, homeTeam: TeamValue, awayTeam: TeamValue, mode: MatchupMode) {
  console.warn("[matchup-integrity] Missing or ambiguous canonical home/away data", {
    perspectiveTeam: cleanTeam(perspectiveTeam),
    homeTeam: cleanTeam(homeTeam),
    awayTeam: cleanTeam(awayTeam),
    mode,
  });
}

/** Formats a matchup only when canonical home/away direction is unambiguous. */
export function formatMatchup(
  perspectiveTeam: TeamValue,
  homeTeam: TeamValue,
  awayTeam: TeamValue,
  mode: MatchupMode,
) {
  const perspective = cleanTeam(perspectiveTeam);
  const home = cleanTeam(homeTeam);
  const away = cleanTeam(awayTeam);
  const canonicalTeamsAreValid = Boolean(home && away && home !== away);

  if (mode === "slate") {
    if (canonicalTeamsAreValid) return `${away} @ ${home}`;
    warnInvalidMatchup(perspective, home, away, mode);
    return away ?? home ?? perspective ?? "Opponent TBD";
  }

  if (canonicalTeamsAreValid && perspective === home) return `${perspective} vs ${away}`;
  if (canonicalTeamsAreValid && perspective === away) return `${perspective} @ ${home}`;

  warnInvalidMatchup(perspective, home, away, mode);
  if (perspective === home) return away ?? "Opponent TBD";
  if (perspective === away) return home ?? "Opponent TBD";
  return [home, away].find((team) => team && team !== perspective) ?? "Opponent TBD";
}
