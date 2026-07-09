import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const PUBLIC_SOURCE_ROOTS = ["src/app", "src/components"];
const INTERNAL_COPY_BLOCKLIST = [
  { label: "Fallback:", pattern: /Fallback:/ },
  { label: "PROOF PACKET", pattern: /PROOF PACKET/i },
  { label: "DOCUMENTED FALLBACK", pattern: /DOCUMENTED FALLBACK/i },
];

const publicSources = await Promise.all(PUBLIC_SOURCE_ROOTS.map((root) => readTextFiles(root)));
const publicHtmlSource = publicSources.flat().map((file) => file.text).join("\n");

assertPublicCopyClean(publicHtmlSource, "public app/component source");
assert.throws(
  () => assertPublicCopyClean("<main><p>Fallback: second-best gem</p></main>", "seeded leak"),
  /internal vocabulary/,
  "public copy check must fail on a seeded internal-copy leak",
);

const homePage = await readFile("src/app/page.tsx", "utf8");
assert(
  homePage.includes("Real comparison, updated daily") &&
    homePage.includes("Real comparison, frozen examples") &&
    !homePage.includes("Proof packet:") &&
    !homePage.includes("documented fallback"),
  "homepage WHY GS+ proof source copy must be user-meaningful, not internal proof-packet jargon",
);

console.log("public copy contract ok: user-facing source blocks internal fallback/proof vocabulary");

function assertPublicCopyClean(html, label) {
  const found = INTERNAL_COPY_BLOCKLIST.filter((item) => item.pattern.test(html)).map((item) => item.label);
  assert(found.length === 0, `${label} contains internal vocabulary: ${found.join(", ")}`);
}

async function readTextFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) return readTextFiles(filePath);
    if (!/\.(?:tsx?|jsx?)$/.test(entry.name)) return [];
    return [{ path: filePath, text: await readFile(filePath, "utf8") }];
  }));
  return files.flat();
}
