import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { loadProjectTs } from './lib/load-project-ts.mjs';
const records = JSON.parse(readFileSync('data/season-reviews/2026-canonical.json', 'utf8'));
const review = JSON.parse(readFileSync('src/data/season-review-2026.json', 'utf8'));
const { computeSeasonReview, REVIEW_ARM_MIN_STARTS } = loadProjectTs('src/lib/season-review-metrics.ts');
assert.equal(REVIEW_ARM_MIN_STARTS, 25);
const groups = Map.groupBy(records, row => row.pitcherMlbId);
const eligible = [...groups.values()].filter(rows => rows.length >= 25).map(rows => ({ name: rows.at(-1).pitcherName, starts: rows.length, mean: rows.reduce((sum, row) => sum + row.gameScorePlus, 0) / rows.length })).sort((a,b) => b.mean-a.mean || b.starts-a.starts || a.name.localeCompare(b.name));
assert.deepEqual(review.arms.map(({name,starts,mean}) => ({name,starts,mean})), eligible.slice(0,3));
assert.equal(review.arms[0].name, 'Jacob Misiorowski');
assert(review.arms.every(arm => arm.minStarts === 25 && arm.starts >= 25));
assert(!review.arms.some(arm => arm.name === 'Shohei Ohtani'));
// A very high average must not bypass eligibility; exact boundary must qualify.
for (const count of [12,24,25]) {
  const fixture = records.slice(0,count).map((row,index) => ({...row, id:`boundary-${index}`, pitcherMlbId:999999, pitcherName:'Boundary Pitcher', gameScorePlus:80}));
  const result = computeSeasonReview([...records,...fixture],review.publishedAt);
  assert.equal(result.arms.some(arm=>arm.pitcherId==='999999'),count===25,`${count}-start boundary`);
}
const previous = JSON.parse(execFileSync('git',['show','4b88cf0:src/data/season-review-2026.json'],{encoding:'utf8',maxBuffer:10_000_000}));
for (const value of [previous,review]) { delete value.arms; delete value.copy.arm; }
assert.deepEqual(review,previous,'all unrelated frozen content unchanged');
assert.equal(readFileSync('data/season-reviews/2026-canonical.json','utf8'),execFileSync('git',['show','4b88cf0:data/season-reviews/2026-canonical.json'],{encoding:'utf8',maxBuffer:30_000_000}));
console.log('PASS: independent full-season ranking; 12/24 excluded, 25 eligible; canonical scores and unrelated frozen review unchanged.');
