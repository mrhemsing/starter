import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const appDir = path.join(repoRoot, "src", "app");
const config = await readFile(path.join(repoRoot, "next.config.ts"), "utf8");

assert(
  config.includes("staticGenerationMaxConcurrency: 2"),
  "next.config.ts must cap static generation concurrency at 2 so production builds stay under the default Node heap",
);
assert(
  config.includes("staticGenerationMinPagesPerWorker: 16"),
  "next.config.ts must keep static generation pages grouped so 33 generated pages do not fan out across a worker per route",
);

const files = await listFiles(appDir);
const appSources = await Promise.all(
  files
    .filter((file) => /\.(tsx|ts)$/.test(file))
    .map(async (file) => ({ file, source: await readFile(file, "utf8") })),
);

const staticParamsFiles = appSources.filter(({ source }) => source.includes("generateStaticParams"));
assert(
  staticParamsFiles.length === 0,
  `build must not prerender dynamic route long tails with generateStaticParams: ${staticParamsFiles.map(({ file }) => relative(file)).join(", ")}`,
);

const pageSources = appSources.filter(({ file }) => path.basename(file) === "page.tsx");
const staticCandidatePages = pageSources.filter(({ file, source }) => {
  const relativePath = relative(file);
  if (source.includes('export const dynamic = "force-dynamic"')) return false;
  if (relativePath.includes("[") && relativePath.includes("]")) return false;
  return true;
});

assert(
  staticCandidatePages.length <= 40,
  `static page candidate count ${staticCandidatePages.length} is near the build memory ceiling; move low-value routes to on-demand rendering or raise this guard with a new profile`,
);

console.log("build memory guard passed", {
  staticGenerationMaxConcurrency: 2,
  staticGenerationMinPagesPerWorker: 16,
  generateStaticParamsFiles: staticParamsFiles.length,
  staticCandidatePages: staticCandidatePages.length,
});

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return listFiles(fullPath);
      return [fullPath];
    }),
  );
  return nested.flat();
}

function relative(file) {
  return path.relative(repoRoot, file).replace(/\\/g, "/");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
