import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/app/form/page.tsx", import.meta.url), "utf8");

assert.match(source, /return compareRollingFormLevelRank\(a, b\);/);
assert.match(source, /const visibleTrendPitchers = trendExpanded \? trendQualifiedBoardPitchers : trendQualifiedBoardPitchers\.slice\(0, HEAT_TREND_INITIAL_LIMIT\)/);
assert.match(source, /<TrendBoardSections pitchers=\{limitedFilter \? boardPitchers : visibleTrendPitchers\}/);
assert.match(source, /rank=\{index \+ 1\} formRank=\{formRankByPitcherId\.get\(pitcher\.pitcherId\) \?\? index \+ 1\}/);
assert.match(source, /\.filter\(\(pitcher\) => !band \|\| pitcher\.tier === band\)/);
assert.match(source, /if \(sort === "risers"\) return compareMovementRise\(a, b\)/);
assert.match(source, /if \(sort === "fallers"\) return compareMovementFall\(a, b\)/);
assert.match(source, /if \(trendView && \(params\.fire \|\| params\.hot \|\| params\.cooling \|\| params\.ice \|\| params\.even\)\)/);
assert.match(source, /data-heat-trend-expand/);
assert.doesNotMatch(source, /groupedBoard\.map/);

const fixture = [
  { id: "steady-63", rgs: 63, delta: 0.3 },
  { id: "riser-56", rgs: 56, delta: 6 },
];
assert.deepEqual([...fixture].sort((a, b) => b.rgs - a.rgs).map((row) => row.id), ["steady-63", "riser-56"]);
assert.deepEqual([...fixture].sort((a, b) => b.delta - a.delta).map((row) => row.id), ["riser-56", "steady-63"]);

console.log("Heat Check flat FORM contract passed");
