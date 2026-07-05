export type StartMatchupLabelInput = {
  pitcher: {
    team: string;
  };
  opponent: string;
  side?: "home" | "away";
};

export function startMatchupLabel(start: StartMatchupLabelInput) {
  return start.side === "away"
    ? `${start.pitcher.team} @ ${start.opponent}`
    : `${start.pitcher.team} vs ${start.opponent}`;
}

export function startVenueLine(start: StartMatchupLabelInput, venue: string | null | undefined) {
  const matchup = startMatchupLabel(start);
  return venue ? `${matchup}, ${venue}` : matchup;
}
