import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

const packageJson = await readJson("package.json");
const readme = await readFile("README.md", "utf8");
const commitPrep = await readFile("docs/commit-prep.md", "utf8");
const responsiveReview = await readFile("docs/responsive-review.md", "utf8");
const gitignore = await readFile(".gitignore", "utf8");

assert(packageJson.private === true, "package.json must stay private to prevent accidental npm publishing");

const requiredScripts = [
  "lint",
  "build",
  "archive:mlb-season",
  "check:mlb-archive",
  "test:contracts",
  "test:slate-contract",
  "test:start-contract",
  "test:pitcher-contract",
  "check:home-ranked",
  "test:responsive",
  "test:fixture-gates",
  "check:publish-prep",
];

for (const script of requiredScripts) {
  assert(packageJson.scripts?.[script], `package.json missing ${script} script`);
}

const requiredReadmeSections = [
  "## Current Surface",
  "## Data Modes",
  "## Verification",
  "## Publish Prep Checklist",
];

for (const section of requiredReadmeSections) {
  assert(readme.includes(section), `README.md missing ${section}`);
}

for (const expected of [
  "mrhemsing/starter",
  "docs/commit-prep.md",
  "docs/responsive-review.md",
  "THE_BUMP_LIVE_MLB",
  "THE_BUMP_RESPONSIVE_LIVE",
  "THE_BUMP_RESPONSIVE_LIVE_DATE",
  "THE_BUMP_EXPECT_SCHEDULE_SOURCE",
  "THE_BUMP_EXPECT_COMPLETED_STATS_SOURCE",
  "THE_BUMP_EXPECT_PITCH_DETAIL_SOURCE",
  "live-people-stats",
  "live-gamefeed",
  "live-people-stat-splits",
  "npm run archive:mlb-season",
  "npm run archive:mlb-season -- --season=2026 --date=2026-06-02",
  "npm run check:mlb-archive",
  "npm run test:contracts",
  "npm run test:slate-contract",
  "npm run test:start-contract",
  "npm run test:pitcher-contract",
  "npm run test:responsive",
  "npm run test:fixture-gates",
  "git status --short",
  "git diff --check",
  "npm run check:publish-prep",
  "npm run lint",
  "npm run build",
  ".responsive-screenshots/",
  '"private": true',
  "npm publishing stays blocked",
  "Push only when Matt asks for external publishing.",
  ".next-heartbeat-*.log",
  ".next-local-*.log",
  ".next-responsive-*.log",
  ".next-live-splits-*.log",
  "Optionally run live contract and responsive checks with `THE_BUMP_LIVE_MLB=1` and `THE_BUMP_RESPONSIVE_LIVE=1`.",
]) {
  assert(readme.includes(expected), `README.md missing ${expected}`);
}

for (const expected of [
  "npm run check:publish-prep",
  "npm run lint",
  "npm run build",
  "npm run test:contracts",
  "npm run test:slate-contract",
  "npm run test:start-contract",
  "npm run test:pitcher-contract",
  "npm run test:responsive",
  "npm run test:fixture-gates",
  "git diff --check",
  "do not push unless Matt asks",
  "Review or update `docs/responsive-review.md` after refreshing `.responsive-screenshots/`.",
  "THE_BUMP_LIVE_MLB",
  "THE_BUMP_RESPONSIVE_LIVE",
  "THE_BUMP_RESPONSIVE_LIVE_DATE",
  "THE_BUMP_EXPECT_SCHEDULE_SOURCE",
  "THE_BUMP_EXPECT_COMPLETED_STATS_SOURCE",
  "THE_BUMP_EXPECT_PITCH_DETAIL_SOURCE",
  "live-people-stats",
  "live-gamefeed",
  "live-people-stat-splits",
  "npm run archive:mlb-season",
  "npm run archive:mlb-season -- --season=2026 --date=2026-06-02",
  "npm run check:mlb-archive",
  '"private": true',
  "npm publishing stays blocked",
  ".next-heartbeat-*.log",
  ".next-local-*.log",
  ".next-responsive-*.log",
  ".next-live-splits-*.log",
  "External publishing stays blocked until Matt explicitly asks.",
]) {
  assert(commitPrep.includes(expected), `docs/commit-prep.md missing ${expected}`);
}

for (const expected of [
  "home-mobile.png",
  "home-desktop.png",
  "slate-mobile.png",
  "slate-desktop.png",
  "live-slate-mobile.png",
  "live-slate-desktop.png",
  "start-mobile.png",
  "start-desktop.png",
  "live-start-mobile.png",
  "live-start-desktop.png",
  "pitcher-mobile.png",
  "pitcher-desktop.png",
  "pitcher-empty-filter-mobile.png",
  "pitcher-empty-filter-desktop.png",
  "today-slate-mobile.png",
  "today-slate-desktop.png",
  "tomorrow-slate-mobile.png",
  "tomorrow-slate-desktop.png",
  "week-slate-mobile.png",
  "week-slate-desktop.png",
  "No obvious visual regression found",
  "slate-card density",
  "mobile start-page controls",
  "pitcher hero sizing",
  "responsive screenshot target list",
]) {
  assert(responsiveReview.includes(expected), `docs/responsive-review.md missing ${expected}`);
}

for (const ignored of [
  "/.next/",
  "/.responsive-screenshots",
  ".next-heartbeat-*.log",
  ".next-local-*.log",
  ".next-responsive-*.log",
  ".next-responsive-*.err",
  ".next-live-splits-*.log",
  ".next-live-splits-*.err",
  "/data/mlb-archive",
  ".env*",
]) {
  assert(gitignore.includes(ignored), `.gitignore missing ${ignored}`);
}

const remote = git(["remote", "get-url", "origin"]);
assert(remote.includes("github.com/mrhemsing/starter"), `origin remote points at ${remote}`);

const statusLines = git(["status", "--short"])
  .split(/\r?\n/)
  .filter(Boolean);

const unexpectedGeneratedFiles = statusLines.filter((line) =>
  /\.(log|err|png)$/.test(line.trim()) || line.includes(".next/") || line.includes(".responsive-screenshots/")
);

assert(
  unexpectedGeneratedFiles.length === 0,
  `generated files appear in git status:\n${unexpectedGeneratedFiles.join("\n")}`
);

console.log(
  `publish prep ok: private package, ${requiredScripts.length} scripts, ${requiredReadmeSections.length} README sections, commit-prep notes, responsive review, origin ${remote}, ${statusLines.length} pending path(s)`
);
