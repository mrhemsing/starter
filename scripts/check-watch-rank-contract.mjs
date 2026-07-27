import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { assignWatchRanks } from "../src/lib/watch-rank.ts";

const fixture = [
  { gamePk: "3", away: "TOR", firstPitch: "2026-07-27T23:45:00Z", gameWatchScore: 72.4 },
  { gamePk: "1", away: "PHI", firstPitch: "2026-07-27T22:08:00Z", gameWatchScore: 61.2 },
  { gamePk: "2", away: "BAL", firstPitch: "2026-07-27T22:08:00Z", gameWatchScore: 61.2 },
];

const builds = Array.from({ length: 5 }, () => assignWatchRanks(fixture));
const expectedRanks = new Map(builds[0].map((game) => [game.gamePk, game.watchRank]));
for (const build of builds) {
  assert.deepEqual(new Map(build.map((game) => [game.gamePk, game.watchRank])), expectedRanks);
  assert.equal(new Set(build.map((game) => game.watchRank)).size, fixture.length);
  assert(build.every((game) => Number.isInteger(game.watchRank) && game.watchRank >= 1 && game.watchRank <= fixture.length));
  assert(build.every((game) => game.watchRankOf === fixture.length));
}
assert.equal(expectedRanks.get("3"), 1);
assert.equal(expectedRanks.get("2"), 2);
assert.equal(expectedRanks.get("1"), 3);

let displayed = builds[0];
const originalRankMap = new Map(displayed.map((game) => [game.gamePk, game.watchRank]));
for (const sortMode of ["time", "watch", "time"]) {
  displayed = [...displayed].sort(sortMode === "time"
    ? (a, b) => a.firstPitch.localeCompare(b.firstPitch) || a.watchRank - b.watchRank
    : (a, b) => a.watchRank - b.watchRank);
}
assert.deepEqual(new Map(displayed.map((game) => [game.gamePk, game.watchRank])), originalRankMap);

const boardSources = await Promise.all([
  readFile("src/components/tonights-must-watch.tsx", "utf8"),
  readFile("src/components/upcoming-simple-board.tsx", "utf8"),
]);
for (const source of boardSources) {
  assert(!/(?:index|idx|i)\s*\+\s*1/.test(source), "rank rendering paths must not derive watch rank from list position");
}

console.log("watch rank ok: stable data rank, deterministic ties, and sort-independent display");
