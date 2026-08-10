import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const tokens = await readFile(new URL("../src/lib/form-tokens.ts", import.meta.url), "utf8");
const streamers = await readFile(new URL("../src/lib/data/streamers-service.ts", import.meta.url), "utf8");
const hero = await readFile(new URL("../src/components/heat-check-hero.tsx", import.meta.url), "utf8");

for (const label of ["Surging", "Climbing", "Steady", "Slipping", "Freefall"]) {
  assert.match(tokens, new RegExp(`label: "${label}"`));
}
for (const retired of ["On Fire", "Heating Up", "Cooling Off", "Ice Cold", "Cooling Down"]) {
  assert.doesNotMatch(tokens, new RegExp(retired, "i"));
  assert.doesNotMatch(streamers, new RegExp(retired, "i"));
  assert.doesNotMatch(hero, new RegExp(retired, "i"));
}
assert.match(streamers, /heatLabel: heatBand === "onfire" \? "Surging" : heatBand === "hot" \? "Climbing" : "Streamer"/);
assert.match(hero, /🔥 SURGING/);

const labels = new Map([
  ["onfire", "Surging"],
  ["hot", "Climbing"],
  ["even", "Steady"],
  ["cooling", "Slipping"],
  ["ice", "Freefall"],
]);
assert.equal(labels.get("onfire"), "Surging");
assert.equal(labels.get("ice"), "Freefall");
assert.equal(labels.get("hot"), "Climbing");
assert.equal(labels.get("even"), "Steady");

function bandForLastFive(delta) {
  if (delta >= 5.5) return "onfire";
  if (delta >= 0.75) return "hot";
  if (delta <= -8) return "ice";
  if (delta <= -0.75) return "cooling";
  return "even";
}

assert.equal(labels.get(bandForLastFive(9)), "Surging");
assert.equal(labels.get(bandForLastFive(-9.6)), "Freefall");
assert.equal(labels.get(bandForLastFive(4.4)), "Climbing");
assert.equal(labels.get(bandForLastFive(-0.3)), "Steady");
assert.match(tokens, /sellHighGsPlusMin: 58/);

console.log("Form trajectory vocabulary contract passed");
