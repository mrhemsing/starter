// Owner-authorized, narrowly scoped correction. Never regenerate other frozen copy.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadProjectTs } from './lib/load-project-ts.mjs';
const path = 'src/data/season-review-2026.json';
const receiptPath = 'data/season-reviews/2026-receipt.json';
const oldBytes = readFileSync(path, 'utf8');
const review = JSON.parse(oldBytes);
const before = structuredClone(review);
const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
assert.equal(hash(oldBytes), receipt.reviewSha256);
const source = readFileSync('data/season-reviews/2026-canonical.json', 'utf8');
assert.equal(hash(source), receipt.sourceSha256);
const { computeSeasonReview } = loadProjectTs('src/lib/season-review-metrics.ts');
const { reviewCopyPackets } = loadProjectTs('src/lib/season-review-copy.ts');
review.arms = computeSeasonReview(JSON.parse(source), review.publishedAt).arms;
const packet = reviewCopyPackets(review).find(row => row.key === 'arm');
review.copy.arm = { text: packet.fallback, source: 'template', trace: packet.trace };
const unrelated = value => { const result = structuredClone(value); delete result.arms; delete result.copy.arm; return result; };
assert.deepEqual(unrelated(review), unrelated(before));
const bytes = JSON.stringify(review, null, 2) + '\n';
if (bytes !== oldBytes) {
  receipt.corrections = [...(receipt.corrections ?? []), { rule: 'Arm of the Year: minimum 25 starts, ranked by mean GS+', previousReviewSha256: receipt.reviewSha256, fields: ['arms', 'copy.arm'] }];
  receipt.reviewSha256 = hash(bytes);
  writeFileSync(path, bytes);
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
}
console.log(JSON.stringify(review.arms.map(({ name, mean, starts, minStarts }) => ({ name, mean, starts, minStarts })), null, 2));
