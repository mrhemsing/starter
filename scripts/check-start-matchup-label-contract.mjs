import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const files = {
  formatter: "src/lib/format-matchup.ts",
  helper: "src/lib/start-matchup-label.ts",
  rankedStarts: "src/app/starts/[id]/page.tsx",
  startRecap: "src/app/starts/[id]/[slug]/page.tsx",
  startOg: "src/app/starts/[id]/opengraph-image.tsx",
  topPerformer: "src/components/top-performer-card.tsx",
  homeSections: "src/components/home-deferred-sections.tsx",
  pitchChart: "src/components/pitch-chart.tsx",
  pitcherProfile: "src/app/pitchers/[id]/form/page.tsx",
  bestStarts: "src/app/best-starts/[month]/page.tsx",
  socialCard: "src/lib/daily-social-card.tsx",
  socialPost: "src/lib/data/daily-social-post-service.ts",
  formService: "src/lib/data/form-service.ts",
  mlbArchive: "src/lib/data/mlb-archive.ts",
  startService: "src/lib/data/start-service.ts",
  types: "src/lib/types.ts",
};

function read(path) {
  return readFileSync(path, "utf8");
}

const helper = read(files.helper);
const formatter = read(files.formatter);
assert.match(formatter, /mode === "slate"[\s\S]*`\$\{away\} @ \$\{home\}`/, "Slate mode must render AWAY @ HOME.");
assert.match(formatter, /perspective === home[\s\S]*`\$\{perspective\} vs \$\{away\}`/, "Perspective home games must render TEAM vs OPP.");
assert.match(formatter, /perspective === away[\s\S]*`\$\{perspective\} @ \$\{home\}`/, "Perspective road games must render TEAM @ OPP.");
assert.match(formatter, /\[matchup-integrity\]/, "Invalid canonical matchup data must log an integrity warning.");
assert.match(formatter, /warnInvalidMatchup\(perspective, home, away, mode\);[\s\S]*return \[home, away\]/, "Invalid perspective data must warn and return opponent-only context.");
assert.match(helper, /formatMatchup\(start\.pitcher\.team, homeTeam, awayTeam, "perspective"\)/, "Start labels must route through the canonical formatter.");
assert.match(helper, /export function startVenueLine/, "Venue lines must share the matchup formatter.");

for (const [name, path] of Object.entries(files)) {
  if (name === "formatter" || name === "helper" || name === "types" || name === "formService" || name === "mlbArchive" || name === "startService") continue;
  const source = read(path);
  assert.match(source, /startMatchupLabel/, `${path} must use the shared matchup formatter.`);
}

const rankedStarts = read(files.rankedStarts);
assert.match(rankedStarts, /function rankedStartVenueLine\(start: StartSummary\)[\s\S]*startVenueLine\(start, start\.context\.parkLabel\)/, "Ranked Starts venue line must use startVenueLine.");
assert.doesNotMatch(rankedStarts, /\{start\.pitcher\.team\} vs \{start\.opponent\}/, "Ranked Starts cards must not hardcode TEAM vs OPP.");

const formService = read(files.formService);
assert.match(formService, /team: start\.pitcher\.team/, "Form points must carry team for pitcher game-log direction labels.");
assert.match(formService, /side: start\.side/, "Form points must carry side for pitcher game-log direction labels.");
assert.match(formService, /import \{ startMatchupLabel \} from "@\/lib\/start-matchup-label";/, "Pitcher form fallback starts must use the shared matchup formatter.");
assert.match(formService, /const matchupLabel = startMatchupLabel\(\{ pitcher: \{ team: profile\.team \}, opponent: start\.opponent, side: start\.side \}\);/, "Pitcher profile fallback context labels must preserve home/away orientation.");
assert.match(formService, /opponent: start\.opponent,\s+side: start\.side,\s+result: start\.result,/m, "Pitcher profile fallback summaries must carry side through to form points.");

const mlbArchive = read(files.mlbArchive);
assert.match(mlbArchive, /opponent: start\.opponent,\s+side: start\.side,\s+result: start\.result,/m, "Archived pitcher season profiles must preserve side for pitcher page game-log orientation.");

const types = read(files.types);
assert.match(types, /team: string;[\s\S]*opp: string;[\s\S]*side\?: "home" \| "away" \| null;/, "FormStartPoint must expose team and nullable side.");
assert.match(types, /export type StartSummary[\s\S]*side: "home" \| "away" \| null;/, "StartSummary must require an explicit side value.");
assert.match(types, /Pick<StartSummary, "id" \| "date" \| "opponent" \| "side" \| "result"/, "PitcherStartLogEntry must carry side from the schedule source.");
assert.match(read(files.startService), /function archivedCompletedStartToSummary[\s\S]*const side = start\.side \?\?[\s\S]*opponent: start\.opponent,\s+side,/m, "Archived completed starts must preserve or canonically derive side.");
assert.doesNotMatch(formatter, /Opponent TBD/, "The shared formatter must not fabricate an Opponent TBD label.");

const forbidden = [
  "src/app/starts/[id]/page.tsx",
  "src/app/starts/[id]/[slug]/page.tsx",
  "src/app/starts/[id]/opengraph-image.tsx",
  "src/app/best-starts/[month]/page.tsx",
  "src/components/top-performer-card.tsx",
  "src/components/home-deferred-sections.tsx",
  "src/components/pitch-chart.tsx",
  "src/lib/daily-social-card.tsx",
  "src/lib/data/daily-social-post-service.ts",
];

for (const path of forbidden) {
  assert.doesNotMatch(read(path), /\$\{[^}\n]*(?:pitcher\.team|start\.team|team)[^}\n]*\} vs \$\{[^}\n]*opponent[^}\n]*\}/, `${path} must not hardcode TEAM vs OPP.`);
}

console.log("Start matchup label contract passed.");
