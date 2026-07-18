import { formatMatchup } from "@/lib/format-matchup";

export type StartMatchupLabelInput = {
  pitcher: {
    team: string;
  };
  opponent: string;
  side?: "home" | "away" | null;
};

export function startMatchupLabel(start: StartMatchupLabelInput) {
  const homeTeam = start.side === "home" ? start.pitcher.team : start.side === "away" ? start.opponent : null;
  const awayTeam = start.side === "away" ? start.pitcher.team : start.side === "home" ? start.opponent : null;
  return formatMatchup(start.pitcher.team, homeTeam, awayTeam, "perspective");
}

export function startVenueLine(start: StartMatchupLabelInput, venue: string | null | undefined) {
  const matchup = startMatchupLabel(start);
  return venue ? `${matchup}, ${venue}` : matchup;
}
