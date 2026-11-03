import { readFile, writeFile } from "node:fs/promises";
import { loadProjectTs } from "./lib/load-project-ts.mjs";

// Explicit publish-time operation, never a page request or build-time network scan.
process.env.YOUTUBE_SEARCH_ENABLED = "0";
const review = JSON.parse(await readFile("src/data/season-review-2026.json", "utf8"));
const { resolveTopPerformerImage } = loadProjectTs("src/lib/data/top-performer-image-service.ts");
const { resolveFeaturedStartHighlight } = loadProjectTs("src/lib/data/featured-highlight-service.ts");
const image = await resolveTopPerformerImage(review.startOfYear, review.highlight, { exactGameOnly: true });
const highlights = {};
for (const start of review.topStarts.slice(0, 3)) {
  highlights[start.id] = start.id === review.startOfYear.id ? review.highlight : await resolveFeaturedStartHighlight(start);
}
const media = { capturedAt: new Date().toISOString(), startId: review.startOfYear.id, gamePk: review.startOfYear.gamePk, pipeline: "resolveTopPerformerImage exactGameOnly; resolveFeaturedStartHighlight with search disabled", image, highlights };
await writeFile("src/data/season-review-media-2026.json", JSON.stringify(media, null, 2) + "\n");
console.log(JSON.stringify(media, null, 2));
