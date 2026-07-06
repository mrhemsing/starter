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
const rootLoading = read("src/app/loading.tsx");
const bestStartsLoading = read("src/app/best-starts/loading.tsx");
const bestStartsMonthLoading = read("src/app/best-starts/[month]/loading.tsx");
const startsLoading = read("src/app/starts/[id]/loading.tsx");
const watchlistLoading = read("src/app/watchlist/loading.tsx");
const inventory = read("docs/skeleton-parity-inventory.md");

const crossRouteBannedStrings = [
  "Every MLB start, ranked.",
  "The best starts of the 2026 season, with rolling 7 and 30-day leaders up top.",
  "Best Starts of 2026",
  "Upcoming Matchups",
  "Heat Check",
  "Watchlist",
];

assert(
  rootLoading.includes('route="shared"') &&
    rootLoading.includes("active={null}") &&
    rootLoading.includes('title="Loading"') &&
    !rootLoading.includes('route="home"') &&
    !rootLoading.includes('active="home"') &&
    !rootLoading.includes("Every MLB start, ranked.") &&
    !rootLoading.includes("GS_PLUS_SCALE_SENTENCE"),
  "Shared root loading boundary must be neutral and must not render homepage copy or a hardcoded HOME active state.",
);

for (const banned of crossRouteBannedStrings) {
  assert(!rootLoading.includes(banned), `Shared root loading boundary must not contain registered page copy: ${banned}`);
}

assert(
  bestStartsLoading.includes('route="best-starts"') &&
    bestStartsLoading.includes('active="starts"') &&
    bestStartsLoading.includes("BestStartsHeroPlaceholder") &&
    bestStartsLoading.includes("BestStartsRowPlaceholder") &&
    bestStartsLoading.includes('data-navigation-skeleton-layout="season-hub"') &&
    bestStartsLoading.includes('data-navigation-skeleton-layout="season-leaderboard"') &&
    !bestStartsLoading.includes("Every MLB start, ranked.") &&
    !bestStartsLoading.includes('active="home"'),
  "Best Starts season hub must have a route-specific loading boundary that cannot render homepage copy.",
);

assert(
  bestStartsMonthLoading.includes('route="best-starts-month"') &&
    bestStartsMonthLoading.includes('active="starts"') &&
    bestStartsMonthLoading.includes('eyebrow="Best starts archive"') &&
    bestStartsMonthLoading.includes('data-navigation-skeleton-layout="month-stat-strip"') &&
    bestStartsMonthLoading.includes('data-navigation-skeleton-layout="month-hero"') &&
    bestStartsMonthLoading.includes('data-navigation-skeleton-layout="month-leaderboard"') &&
    !bestStartsMonthLoading.includes("Every MLB start, ranked.") &&
    !bestStartsMonthLoading.includes('active="home"'),
  "Best Starts monthly archives must have a route-specific loading boundary that cannot render homepage copy or HOME active nav.",
);

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
  inventory.includes("Route-to-boundary map") &&
    inventory.includes("src/app/loading.tsx`, shared neutral fallback") &&
    inventory.includes("src/app/best-starts/loading.tsx") &&
    inventory.includes("src/app/best-starts/[month]/loading.tsx") &&
    inventory.includes("prevents monthly archives from inheriting the shared fallback or homepage copy") &&
    inventory.includes("Static pages without async data use the shared neutral fallback as an explicit exemption") &&
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
