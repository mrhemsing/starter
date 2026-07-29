import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const imageService = await readFile("src/lib/data/top-performer-image-service.ts", "utf8");

assert(
  imageService.includes("const latestApprovedPitcherAction = await readLatestApprovedPitcherActionImage(start);") &&
    imageService.includes("return topPerformerImageFromCachedAction(start.id, latestApprovedPitcherAction);") &&
    imageService.includes("async function readLatestApprovedPitcherActionImage(start: StartSummary)") &&
    imageService.includes("if (candidate && candidate.expiresAt > Date.now()) return candidate;"),
  "top performer lookup must reuse the latest unexpired approved action image for a pitcher's new start",
);

const imageDirectory = "public/images/top-performer-action-shots";
const pitcherId = "668909";
const hypotheticalStartId = "2026-08-03-cle-det-668909";
const suffix = `-${pitcherId}-mlb-action-v4.json`;
const filenames = (await readdir(imageDirectory))
  .filter((filename) => filename.endsWith(suffix))
  .map((filename) => filename.slice(0, -"-mlb-action-v4.json".length))
  .filter((startId) => startId !== hypotheticalStartId)
  .sort((a, b) => b.localeCompare(a));

let approvedMetadata = null;
for (const startId of filenames) {
  const metadata = JSON.parse(await readFile(path.join(imageDirectory, `${startId}-mlb-action-v4.json`), "utf8"));
  const approved = metadata.clean === true && (metadata.autoPromoted !== true || metadata.textFreeReviewed === true);
  if (approved && metadata.expiresAt > Date.now()) {
    approvedMetadata = metadata;
    break;
  }
}

assert(approvedMetadata, "future Gavin Williams starts must find a reusable approved action image");
assert(
  approvedMetadata.startId === "2026-07-28-cle-cin-668909",
  "future Gavin Williams starts must prefer his latest approved action-image mapping",
);
assert(
  approvedMetadata.imageUrl.startsWith("/images/top-performer-action-shots/"),
  "reused Gavin Williams action image must remain a curated local asset",
);
await access(path.join("public", approvedMetadata.imageUrl));

console.log(`top performer image reuse ok: ${hypotheticalStartId} -> ${approvedMetadata.imageUrl}`);
