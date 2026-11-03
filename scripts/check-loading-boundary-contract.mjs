import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function loadingFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return loadingFiles(fullPath);
    return entry.name === "loading.tsx" ? [fullPath] : [];
  }));
  return nested.flat();
}

const files = await loadingFiles("src/app");
for (const file of files) {
  const source = await readFile(file, "utf8");
  assert(!/\basync\s+function\s+\w*Loading\b/.test(source), `${file} must render synchronously`);
  assert(!/\bawait\b/.test(source), `${file} must not await data`);
  assert(!/from\s+["']@\/lib\/data\//.test(source), `${file} must not import the data layer`);
  assert(!/from\s+["']next\/headers["']/.test(source), `${file} must not read request headers or cookies`);
}

// OFF-1.1: frozen routes must not be wrapped in a streaming skeleton.
assert(!existsSync("src/app/loading.tsx") && !existsSync("src/app/(home)/loading.tsx"), "no ancestor skeleton on frozen routes");
const home = await readFile("src/app/(home)/page.tsx", "utf8");
assert(home.indexOf('state.status === "season_complete"') < home.indexOf('fallback={<HomeLoading />}'), "only in-season home streams its loader");
const homeLoading = await readFile("src/components/home-loading.tsx", "utf8");
assert(homeLoading.includes("HomeWarmingUpLoader"), "in-season loading treatment preserved");

console.log("loading boundary contract passed", { loadingRoutes: files.length });
