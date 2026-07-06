import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function walk(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const fullPath = path.join(directory, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) walk(fullPath, files);
    else files.push(fullPath);
  }
  return files;
}

const liveLoading = read("src/app/live/[date]/loading.tsx");
const liveScoreboard = read("src/components/live-scoreboard.tsx");
const startsLoading = read("src/app/starts/[id]/loading.tsx");
const watchlistLoading = read("src/app/watchlist/loading.tsx");
const inventory = read("docs/skeleton-parity-inventory.md");

assert(
  liveLoading.includes("getLiveScoreboard") &&
    liveLoading.includes("LiveScoreboardLoading") &&
    !liveLoading.includes("LiveScoreboardRowSkeleton") &&
    !liveLoading.includes("Array.from({ length: 8 })"),
  "Live loading must choose the real Live scoreboard loading mode from server-side slate state, not a generic eight-row list.",
);

assert(
  liveScoreboard.includes('data-live-loading-mode="final"') &&
    liveScoreboard.includes('data-live-loading-mode="pregame"') &&
    liveScoreboard.includes('data-live-loading-mode="scoreboard"') &&
    liveScoreboard.includes("SlateCompleteHandoffLoading") &&
    liveScoreboard.includes("PregameHandoffLoading") &&
    liveScoreboard.includes("LiveScoreboardRowLoading"),
  "Live scoreboard must expose pregame, scoreboard, and final loading modes from the real module.",
);

assert(
  startsLoading.includes("getDailySlate") &&
    startsLoading.includes("RANKED_STARTS_LOADING_FALLBACK_COUNT") &&
    startsLoading.includes("data-loading-row-count={rowCount}") &&
    startsLoading.includes("Array.from({ length: rowCount })"),
  "Ranked Starts loading must render a slate-count-aware number of row placeholders.",
);

assert(
  watchlistLoading.includes("cookies") &&
    watchlistLoading.includes("getWatchlistPitcherIds") &&
    watchlistLoading.includes("WATCHLIST_LOADING_FALLBACK_COUNT") &&
    watchlistLoading.includes("Array.from({ length: rowCount })"),
  "Watchlist loading must render followed-count-aware row placeholders.",
);

assert(
  inventory.includes("src/app/live/[date]/loading.tsx") &&
    inventory.includes("src/app/starts/[id]/loading.tsx") &&
    inventory.includes("src/app/watchlist/loading.tsx") &&
    inventory.includes("route-shell-shimmer"),
  "Skeleton parity inventory must list migrated surfaces and the allowed shimmer primitive.",
);

const skeletonNamedFiles = walk(path.join(root, "src"))
  .map((filePath) => path.relative(root, filePath).replaceAll("\\", "/"))
  .filter((filePath) => /skeleton/i.test(path.basename(filePath)))
  .filter((filePath) => filePath !== "src/lib/navigation-skeleton-log.ts");

assert(
  skeletonNamedFiles.length === 0,
  `No standalone skeleton-named layout files are allowed. Found: ${skeletonNamedFiles.join(", ")}`,
);

const loadingFiles = [
  "src/app/live/[date]/loading.tsx",
  "src/app/starts/[id]/loading.tsx",
  "src/app/watchlist/loading.tsx",
];

for (const file of loadingFiles) {
  const source = read(file);
  assert(!source.includes("setInterval("), `${file} must not implement its own loading timer.`);
}

if (failures.length > 0) {
  console.error(`Skeleton parity contract failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Skeleton parity contract passed.");
