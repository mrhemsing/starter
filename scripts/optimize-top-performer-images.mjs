import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const imageDir = path.join(process.cwd(), "public", "images", "top-performer-action-shots");
const maxWidth = 800;
const quality = 78;
const dryRun = process.argv.includes("--dry-run");
const metadataFiles = (await readdir(imageDir)).filter((file) => file.endsWith(".json")).sort();
const conversions = new Map();
let updatedMetadata = 0;

for (const metadataFile of metadataFiles) {
  const metadataPath = path.join(imageDir, metadataFile);
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  if (typeof metadata.imageUrl !== "string" || !metadata.imageUrl.startsWith("/images/top-performer-action-shots/")) continue;

  const sourceName = path.basename(metadata.imageUrl);
  if (!/\.(?:png|jpe?g)$/i.test(sourceName)) continue;
  const sourcePath = path.join(imageDir, sourceName);
  try {
    await stat(sourcePath);
  } catch {
    continue;
  }

  const outputName = sourceName.replace(/\.(?:png|jpe?g)$/i, ".webp");
  const outputPath = path.join(imageDir, outputName);
  const outputUrl = `/images/top-performer-action-shots/${outputName}`;

  if (!dryRun && !conversions.has(sourcePath)) {
    await sharp(sourcePath)
      .rotate()
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality, effort: 6, smartSubsample: true })
      .toFile(outputPath);
  }
  conversions.set(sourcePath, outputPath);

  if (!dryRun && metadata.imageUrl !== outputUrl) {
    await writeFile(metadataPath, `${JSON.stringify({
      ...metadata,
      sourceImageUrl: metadata.sourceImageUrl ?? metadata.imageUrl,
      imageUrl: outputUrl,
      storage: "local-static-optimized",
    }, null, 2)}\n`);
  }
  updatedMetadata += 1;
}

const oversized = [];
for (const outputPath of conversions.values()) {
  if (dryRun) continue;
  const outputStat = await stat(outputPath);
  if (outputStat.size > 150_000) oversized.push({ file: path.basename(outputPath), bytes: outputStat.size });
}

if (oversized.length > 0) {
  throw new Error(`optimized action images exceed 150KB: ${JSON.stringify(oversized, null, 2)}`);
}

console.log("top performer action images optimized", {
  uniqueImages: conversions.size,
  updatedMetadata,
  maxWidth,
  quality,
  dryRun,
});
