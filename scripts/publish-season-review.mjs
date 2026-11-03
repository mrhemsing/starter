import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { loadProjectTs } from "./lib/load-project-ts.mjs";

const input = process.argv[2];
const recapInput = process.argv[3];
if (!input || !recapInput) throw new Error("Usage: publish-season-review.mjs CANONICAL_JSON CAPTURED_RECAP_JSON");
const target = "src/data/season-review-2026.json";
try { await access(target); throw new Error("Published review already exists; never regenerate frozen prose"); } catch (error) { if (error.code !== "ENOENT") throw error; }
const records = JSON.parse(await readFile(input, "utf8"));
const capturedRecap = JSON.parse(await readFile(recapInput, "utf8"));
const { computeSeasonReview } = loadProjectTs("src/lib/season-review-metrics.ts");
const { reviewCopyPackets, selectReviewCopy, validateReviewCopy } = loadProjectTs("src/lib/season-review-copy.ts");
const { generateSeasonReviewSentence } = loadProjectTs("src/lib/data/upcoming-writeups-service.ts");
const { resolveFeaturedStartHighlight } = loadProjectTs("src/lib/data/featured-highlight-service.ts");
const review = computeSeasonReview(records, new Date().toISOString());
const { startRecapPath } = loadProjectTs("src/lib/routes.ts");
if (!capturedRecap.url.endsWith(startRecapPath(review.startOfYear))) throw new Error("Captured recap does not belong to Start of the Year");
const names = [...new Set(records.map((row) => row.pitcherName))];
const copy = {};
const accepted = [];
for (const packet of reviewCopyPackets(review)) {
  if (!validateReviewCopy(packet.fallback, packet, names, [])) throw new Error(`Invalid template: ${packet.key}`);
  const candidate = await generateSeasonReviewSentence(packet, accepted);
  const chosen = selectReviewCopy(candidate, packet, names, accepted);
  copy[packet.key] = chosen;
  accepted.push(chosen.text);
  console.log(`${packet.key}: ${chosen.source}`);
}
const hash = (text) => createHash("sha256").update(text).digest("hex");
const source = records.map(({ audit, contextSnapshot, gameScorePlusBreakdown, ...row }) => ({ ...row, canonicalSha256: hash(JSON.stringify({ ...row, audit, contextSnapshot, gameScorePlusBreakdown })) }));
const sourceBytes = JSON.stringify(source);
const payload = {
  ...review, copy, frozenRecap: capturedRecap,
  highlight: await resolveFeaturedStartHighlight(review.startOfYear),
  sourceSha256: hash(sourceBytes),
  model: process.env.OPENAI_MODEL_UPCOMING_WRITEUPS ?? "gpt-4.1-mini",
  metricsVersion: "OFF-1-v1",
};
await mkdir("src/data", { recursive: true });
await mkdir("data/season-reviews", { recursive: true });
await writeFile("data/season-reviews/2026-canonical.json", sourceBytes);
const bytes = JSON.stringify(payload, null, 2) + "\n";
await writeFile(target, bytes);
await writeFile("data/season-reviews/2026-receipt.json", JSON.stringify({ publishedAt: payload.publishedAt, reviewSha256: hash(bytes), sourceSha256: payload.sourceSha256, starts: records.length, source: "toetheslab_canonical_start_records:2026:final:frozen", model: payload.model }, null, 2) + "\n");
console.log(`Frozen review published: ${records.length} canonical starts, ${review.noHitBids.length} no-hitter bids, ${hash(bytes)}`);
