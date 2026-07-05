import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const files = {
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
  types: "src/lib/types.ts",
};

function read(path) {
  return readFileSync(path, "utf8");
}

const helper = read(files.helper);
assert.match(helper, /start\.side === "away"[\s\S]*\$\{start\.pitcher\.team\} @ \$\{start\.opponent\}/, "Away starts must render TEAM @ OPP.");
assert.match(helper, /\$\{start\.pitcher\.team\} vs \$\{start\.opponent\}/, "Home or unknown starts must render TEAM vs OPP.");
assert.match(helper, /export function startVenueLine/, "Venue lines must share the matchup formatter.");

for (const [name, path] of Object.entries(files)) {
  if (name === "helper" || name === "types" || name === "formService") continue;
  const source = read(path);
  assert.match(source, /startMatchupLabel/, `${path} must use the shared matchup formatter.`);
}

const rankedStarts = read(files.rankedStarts);
assert.match(rankedStarts, /function rankedStartVenueLine\(start: StartSummary\)[\s\S]*startVenueLine\(start, start\.context\.parkLabel\)/, "Ranked Starts venue line must use startVenueLine.");
assert.doesNotMatch(rankedStarts, /\{start\.pitcher\.team\} vs \{start\.opponent\}/, "Ranked Starts cards must not hardcode TEAM vs OPP.");

const formService = read(files.formService);
assert.match(formService, /team: start\.pitcher\.team/, "Form points must carry team for pitcher game-log direction labels.");
assert.match(formService, /side: start\.side/, "Form points must carry side for pitcher game-log direction labels.");

const types = read(files.types);
assert.match(types, /team: string;[\s\S]*opp: string;[\s\S]*side\?: "home" \| "away";/, "FormStartPoint must expose team and side.");

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
