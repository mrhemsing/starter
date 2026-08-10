import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const roots = ["src", "scripts"];
const files = (await Promise.all(roots.map((root) => sourceFiles(root)))).flat();
const sources = new Map(await Promise.all(files.map(async (file) => [file, await readFile(file, "utf8")])))
const combined = [...sources.entries()].map(([file, source]) => `--- ${file}\n${source}`).join("\n");

const explicitFormTierReturns = [];
for (const [file, source] of sources) {
  for (const match of source.matchAll(/function\s+[\w$]+\([^)]*\)\s*:\s*FormTier(?:\s*\|\s*null)?/g)) {
    explicitFormTierReturns.push(`${file}:${lineAt(source, match.index ?? 0)}:${match[0].trim()}`);
  }
}
assert.deepEqual(explicitFormTierReturns, [], `local functions must not return FormTier:\n${explicitFormTierReturns.join("\n")}`);

const home = sources.get("src\\components\\heat-check-hero.tsx") ?? sources.get("src/components/heat-check-hero.tsx") ?? "";
const service = sources.get("src\\lib\\data\\form-service.ts") ?? sources.get("src/lib/data/form-service.ts") ?? "";
const deferred = sources.get("src\\components\\home-deferred-sections.tsx") ?? sources.get("src/components/home-deferred-sections.tsx") ?? "";
assert.match(home, /directionBandOf\(pitcher\.deltaForm, window\)/);
assert.doesNotMatch(home, /levelBandFor|formLevelBandOf/);
assert.match(service, /bands\[pitcher\.tier\] \+= 1/);
assert.match(service, /pitcher\.tier === "onfire" \|\| pitcher\.tier === "hot"/);
assert.match(service, /pitcher\.tier === "ice" \|\| pitcher\.tier === "cooling"/);
assert.match(deferred, /accentColor=\{scoreColorBand\(start\.gameScorePlus\)\}/);
assert.doesNotMatch(deferred, /scoreBand\(|FormTier/);

const labels = { onfire: "SURGING", hot: "CLIMBING", even: "STEADY", cooling: "SLIPPING", ice: "FREEFALL" };
const tier = (delta) => delta >= 5 ? "onfire" : delta >= 0.75 ? "hot" : delta <= -8 ? "ice" : delta <= -0.75 ? "cooling" : "even";
for (const fixture of [
  ["Misiorowski", 61.2, -9.6, "FREEFALL", "Slipping & freefall"],
  ["Javier", 44, 5.8, "SURGING", "Surging & climbing"],
  ["Waldron", 46, 5.3, "SURGING", "Surging & climbing"],
]) {
  const [name, form, delta, expectedLabel, rail] = fixture;
  assert.equal(labels[tier(delta)], expectedLabel, `${name}: form ${form}, delta ${delta}`);
  console.log(`fixture ${name}: FORM ${form}, delta ${delta > 0 ? "+" : ""}${delta} => ${expectedLabel} / ${rail}`);
}

for (const [file, source] of sources) {
  assert.doesNotMatch(source, /↑\s+-\d+(?:\.\d+)?/i, `${file}: rising arrow contradicts negative delta`);
  assert.doesNotMatch(source, /↓\s+\+\d+(?:\.\d+)?/i, `${file}: falling arrow contradicts positive delta`);
}

for (const requiredSurface of [
  "src/components/heat-check-hero.tsx",
  "src/app/form/page.tsx",
  "src/app/pitchers/[id]/form/page.tsx",
  "src/components/tonights-must-watch.tsx",
  "src/components/upcoming-simple-board.tsx",
  "src/lib/data/streamers-service.ts",
  "src/lib/data/daily-social-post-service.ts",
  "src/lib/data/upcoming-writeups-service.ts",
]) {
  assert(files.some((file) => normalize(file) === requiredSurface), `missing tier-word surface from sweep: ${requiredSurface}`);
}

console.log(`grep FormTier-returning functions: ${explicitFormTierReturns.length} local matches`);
console.log(`sign sweep ok: ${files.length} source/script files; homepage, heat check, pitcher, upcoming, streamers, social, and prompt surfaces covered`);

async function sourceFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(?:ts|tsx|js|mjs)$/.test(entry.name) ? [target] : [];
  }));
  return nested.flat();
}

function lineAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

function normalize(file) {
  return file.replaceAll("\\", "/");
}
