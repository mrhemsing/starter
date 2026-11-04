import { loadProjectTs } from './load-project-ts.mjs';
import assert from 'node:assert/strict';

export function assertBackfillCoverage(starts, outcomes, topStarts) {
  assert.equal(outcomes.length, starts.length, 'Unqueried featured start');
  assert.equal(new Set(outcomes.map(row=>row.startId)).size, starts.length, 'Duplicate outcome');
  for(const start of starts) {
    const row=outcomes.find(row=>row.startId===start.id);
    assert(row && row.gamePk===start.gamePk, 'Wrong game identity');
    assert(['resolved','no_match'].includes(row.outcome), 'Lookup error is not a miss');
    assert(row.lookups.some(l=>l.url===`https://statsapi.mlb.com/api/v1/game/${start.gamePk}/content` && l.status===200), 'Missing exact-game lookup');
    assert(row.lookups.every(l=>l.status===200), 'HTTP error is not a miss');
  }
  assert(topStarts.filter(start=>outcomes.find(row=>row.startId===start.id)?.outcome==='resolved').length>=20,
    'DISCOVERY BUG GATE: fewer than 20 Top 25 resolved');
}

export function featuredHighlightTargets(review, records) {
  const { canonicalRecordToFormStart } = loadProjectTs('src/lib/data/form-service.ts');
  const streak = review.hottestStreak.startIds.map(id => {
    const row = records.find(record => record.id === id);
    if (!row) throw new Error(`Missing frozen award start ${id}`);
    return canonicalRecordToFormStart(row, 1);
  });
  // Multi-start pitcher/team awards do not authorize scanning all their starts.
  // Only explicit featured start awards, the winning five-start streak, and bids.
  return [...new Map([...review.topStarts, review.startOfYear, review.biggestBlowup,
    ...streak, ...review.noHitBids].map(start => [start.id, start])).values()];
}
