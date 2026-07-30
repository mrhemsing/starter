import { readdir, readFile } from "node:fs/promises";
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

const rootLoading = await readFile("src/app/loading.tsx", "utf8");
assert(rootLoading.includes('title="Warming up"'), "the root loading boundary must say Warming up");
assert(!rootLoading.includes("preparing the requested page"), "the root loading boundary must not render the old description");

console.log("loading boundary contract passed", { loadingRoutes: files.length });
