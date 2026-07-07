export type MlbTeamMeta = {
  id: number;
  name: string;
};

export const MLB_TEAMS: Record<string, MlbTeamMeta> = {
  ATL: { id: 144, name: "Atlanta Braves" },
  AZ: { id: 109, name: "Arizona Diamondbacks" },
  ARI: { id: 109, name: "Arizona Diamondbacks" },
  BAL: { id: 110, name: "Baltimore Orioles" },
  BOS: { id: 111, name: "Boston Red Sox" },
  CHC: { id: 112, name: "Chicago Cubs" },
  CIN: { id: 113, name: "Cincinnati Reds" },
  CLE: { id: 114, name: "Cleveland Guardians" },
  COL: { id: 115, name: "Colorado Rockies" },
  CWS: { id: 145, name: "Chicago White Sox" },
  CHW: { id: 145, name: "Chicago White Sox" },
  DET: { id: 116, name: "Detroit Tigers" },
  HOU: { id: 117, name: "Houston Astros" },
  KC: { id: 118, name: "Kansas City Royals" },
  KCR: { id: 118, name: "Kansas City Royals" },
  LAA: { id: 108, name: "Los Angeles Angels" },
  LAD: { id: 119, name: "Los Angeles Dodgers" },
  MIA: { id: 146, name: "Miami Marlins" },
  MIL: { id: 158, name: "Milwaukee Brewers" },
  MIN: { id: 142, name: "Minnesota Twins" },
  NYM: { id: 121, name: "New York Mets" },
  NYY: { id: 147, name: "New York Yankees" },
  ATH: { id: 133, name: "Athletics" },
  OAK: { id: 133, name: "Athletics" },
  PHI: { id: 143, name: "Philadelphia Phillies" },
  PIT: { id: 134, name: "Pittsburgh Pirates" },
  SD: { id: 135, name: "San Diego Padres" },
  SDP: { id: 135, name: "San Diego Padres" },
  SEA: { id: 136, name: "Seattle Mariners" },
  SF: { id: 137, name: "San Francisco Giants" },
  SFG: { id: 137, name: "San Francisco Giants" },
  STL: { id: 138, name: "St. Louis Cardinals" },
  TB: { id: 139, name: "Tampa Bay Rays" },
  TBR: { id: 139, name: "Tampa Bay Rays" },
  TEX: { id: 140, name: "Texas Rangers" },
  TOR: { id: 141, name: "Toronto Blue Jays" },
  WSH: { id: 120, name: "Washington Nationals" },
  WSN: { id: 120, name: "Washington Nationals" },
};

export function teamMeta(team: string): MlbTeamMeta | null {
  return MLB_TEAMS[team.trim().toUpperCase()] ?? null;
}

export function teamDisplayName(team: string) {
  return teamMeta(team)?.name ?? team.toUpperCase();
}

export function teamLogoUrl(team: string) {
  const meta = teamMeta(team);
  return meta ? `https://www.mlbstatic.com/team-logos/${meta.id}.svg` : null;
}
