import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const imageDir = path.join(process.cwd(), "public", "images", "top-performer-action-shots");
const dryRun = process.argv.includes("--dry-run");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await mkdir(imageDir, { recursive: true });

const files = (await readdir(imageDir))
  .filter((file) => file.endsWith("-mlb-action-v4.json"))
  .sort();

let checked = 0;
let mirrored = 0;
let alreadyLocal = 0;
const failures = [];

for (const file of files) {
  const metadataPath = path.join(imageDir, file);
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  if (metadata.clean !== true) continue;

  checked += 1;
  const startId = metadata.startId;
  assert(typeof startId === "string" && startId.length > 0, `${file} missing startId`);
  assert(typeof metadata.imageUrl === "string" && metadata.imageUrl.length > 0, `${file} missing imageUrl`);

  if (metadata.imageUrl.startsWith("/images/top-performer-action-shots/")) {
    alreadyLocal += 1;
    continue;
  }

  if (!metadata.imageUrl.startsWith("https://")) {
    failures.push({ file, reason: "unsupported-image-url", imageUrl: metadata.imageUrl });
    continue;
  }

  const localFilename = `${safeFilePart(startId)}-action.jpg`;
  const localPath = path.join(imageDir, localFilename);
  const localUrl = `/images/top-performer-action-shots/${localFilename}`;

  if (!existsSync(localPath)) {
    if (dryRun) {
      mirrored += 1;
      continue;
    }

    const response = await fetch(metadata.imageUrl);
    if (!response.ok) {
      failures.push({ file, reason: `fetch-${response.status}`, imageUrl: metadata.imageUrl });
      continue;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("image/")) {
      failures.push({ file, reason: `bad-content-type-${contentType}`, imageUrl: metadata.imageUrl });
      continue;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength < 25_000) {
      failures.push({ file, reason: `image-too-small-${buffer.byteLength}`, imageUrl: metadata.imageUrl });
      continue;
    }
    await writeFile(localPath, buffer);
  }

  if (!dryRun) {
    const nextMetadata = {
      ...metadata,
      sourceImageUrl: metadata.sourceImageUrl ?? metadata.imageUrl,
      imageUrl: localUrl,
      storage: "local-static",
    };
    await writeFile(metadataPath, `${JSON.stringify(nextMetadata, null, 2)}\n`);
  }
  mirrored += 1;
}

assert(failures.length === 0, `failed to mirror ${failures.length} top performer action image(s): ${JSON.stringify(failures, null, 2)}`);

console.log("top performer action images mirrored", {
  checked,
  mirrored,
  alreadyLocal,
  dryRun,
});

function safeFilePart(value) {
  return value.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
}
