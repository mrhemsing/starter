import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { loadProjectTs } from "./lib/load-project-ts.mjs";

const bytes = await readFile("src/data/season-review-2026.json", "utf8");
const sourceBytes = await readFile("data/season-reviews/2026-canonical.json", "utf8");
const receipt = JSON.parse(await readFile("data/season-reviews/2026-receipt.json", "utf8"));
const review = JSON.parse(bytes);
const records = JSON.parse(sourceBytes);
const sha = (value) => createHash("sha256").update(value).digest("hex");
assert.equal(sha(bytes), receipt.reviewSha256, "published review bytes frozen");
assert.equal(sha(sourceBytes), receipt.sourceSha256, "canonical snapshot bytes frozen");
const byId = new Map(records.map((row) => [row.id, row]));
assert.equal(records.length, review.count);
assert(records.every((row) => row.status === "final" && row.frozen && row.source.line !== "fixture"));
assert.equal(review.distribution.reduce((sum, bin) => sum + bin.count, 0), review.count);
assert.equal(review.leagueMean, records.reduce((sum, row) => sum + row.gameScorePlus, 0) / records.length);
for (const row of [...review.topStarts, ...review.noHitBids, review.biggestBlowup]) {
  assert.equal(row.gameScorePlus, byId.get(row.id).gameScorePlus);
  assert.deepEqual(row.line, byId.get(row.id).line);
  assert.deepEqual(row.narrativeNotables, byId.get(row.id).narrativeNotables);
}
assert.deepEqual(new Set(review.noHitBids.map((row) => row.id)), new Set(records.filter((row) => (row.narrativeNotables?.noHitDepth?.innings ?? 0) >= 6).map((row) => row.id)));
for (const arm of review.arms) {
  assert.equal(arm.mean, arm.startIds.reduce((sum, id) => sum + byId.get(id).gameScorePlus, 0) / arm.starts);
  assert(arm.starts >= arm.minStarts);
}
for (const arm of review.gemLeaders) {
  assert.equal(arm.count, records.filter((row) => String(row.pitcherMlbId) === arm.pitcherId && row.gameScorePlus >= 70).length);
}
assert.equal(review.hottestStreak.startIds.length, 5);
assert.equal(review.hottestStreak.mean, review.hottestStreak.startIds.reduce((sum, id) => sum + byId.get(id).gameScorePlus, 0) / 5);
assert.equal(review.rotation.length, 30);
assert.equal(new Set(review.rotation.map((row) => row.team)).size, 30);
const { computeSeasonReview } = loadProjectTs("src/lib/season-review-metrics.ts");
const recomputed = computeSeasonReview(records, review.publishedAt);
for (const key of ["arms", "gemLeaders", "hottestStreak", "rotation", "distribution", "home"]) assert.deepEqual(JSON.parse(JSON.stringify(recomputed[key])), review[key], key);
assert.deepEqual(recomputed.topStarts.map((row) => row.id), review.topStarts.map((row) => row.id));
assert.throws(() => computeSeasonReview([{ ...records[0], frozen: false }], review.publishedAt), /frozen/);
assert.throws(() => computeSeasonReview([records[0], records[0]], review.publishedAt), /Duplicate/);
const { reviewCopyPackets, validateReviewCopy, selectReviewCopy } = loadProjectTs("src/lib/season-review-copy.ts");
const names = [...new Set(records.map((row) => row.pitcherName))];
const accepted = [];
for (const packet of reviewCopyPackets(review)) {
  const text = review.copy[packet.key].text;
  assert(validateReviewCopy(text, packet, names, accepted), `${packet.key} full copy validation`);
  assert.deepEqual(review.copy[packet.key].trace, packet.trace);
  assert.equal(selectReviewCopy(null, packet, names, accepted).text, packet.fallback, "forced provider failure preserves section");
  assert(!validateReviewCopy(text + " Tomorrow he will win.", packet, names, []), "timing rejected");
  assert(!validateReviewCopy(text + " 999 strikeouts.", packet, names, []), "untraced number rejected");
  assert(!validateReviewCopy(text + " — wow.", packet, names, []), "em dash rejected");
  assert(!validateReviewCopy(text, packet, names, [text]), "page n-gram repetition rejected");
  accepted.push(text);
}
const startPacket = reviewCopyPackets(review).find((packet) => packet.key === "start");
assert(!validateReviewCopy(review.copy.start.text.replace(review.startOfYear.pitcher.name, "Shohei Ohtani"), startPacket, names, []), "seeded misattribution rejected");
const page = await readFile("src/app/2026/page.tsx", "utf8");
assert(page.includes('export const dynamic = "force-static"') && page.includes("export const revalidate = false"));
assert(!page.includes("@/lib/data/"), "archive page must not import request data services");
const home = await readFile("src/components/offseason-home.tsx", "utf8");
assert(home.includes('from "@/components/season-review"'), "homepage imports shared archive components");
const React = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const components = loadProjectTs("src/components/season-review.tsx");
const fallbackReview = JSON.parse(bytes);
for (const packet of reviewCopyPackets(review)) fallbackReview.copy[packet.key] = { text: packet.fallback, source: "template", trace: packet.trace };
const html = renderToStaticMarkup(React.createElement(React.Fragment, null,
  ...[components.SeasonReviewHero, components.SeasonReviewTopStarts, components.SeasonReviewAwards].map((component) => React.createElement(component, { review: fallbackReview })),
));
for (const packet of reviewCopyPackets(review)) assert(html.includes(packet.fallback.replaceAll("&", "&amp;").replaceAll("'", "&#x27;")), `forced failure renders ${packet.key}`);
console.log(`Season review PASS: ${records.length} source records, 25 start traces, 14 exact bids, 30 rotations, award recomputation, frozen hashes, 10 forced fallbacks and negative copy controls.`);
