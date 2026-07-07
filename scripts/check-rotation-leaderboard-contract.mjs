import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const rotationsPagePath = "src/app/rotations/page.tsx";
assert(existsSync(rotationsPagePath), "/rotations page must exist");

const rotationsPage = await readFile(rotationsPagePath, "utf8");
const formPage = await readFile("src/app/form/page.tsx", "utf8");
const formService = await readFile("src/lib/data/form-service.ts", "utf8");
const packageJson = await readFile("package.json", "utf8");

assert(
  formService.includes("export async function getRotationLeaderboard") &&
    formService.includes("const getCachedRotationLeaderboard = unstable_cache") &&
    formService.includes('["rotation-leaderboard", FORM_CACHE_VERSION]') &&
    formService.includes("qualifiedOnly: false") &&
    formService.includes("FORM_CONFIG.minStartsToQualify") &&
    formService.includes("HEAT_BANDS.map((band) => [band.key") &&
    formService.includes("rows: rows.map((row, index) => ({ ...row, rank: index + 1 }))"),
  "Rotation leaderboard must use one cached helper built from the Heat Check form data and shared bands",
);

assert(
  formPage.includes("getRotationLeaderboard({ window })") &&
    formPage.includes("const teamRotationRow = team ? teamRotationLeaderboard?.rows.find((row) => row.team === team) ?? null : null;") &&
    formPage.includes('data-responsive-check="heat-team-rotation-rank"') &&
    formPage.includes("Rotation rank") &&
    formPage.includes("See full rotation board") &&
    formPage.includes('data-rotation-rank-link') &&
    formPage.includes("`/rotations#team-${team.toLowerCase()}`") &&
    formPage.includes("{rotationRow ? `#${rotationRow.rank}` : \"--\"}") &&
    !formPage.includes(" of 30 rotations</span>") &&
    !formPage.includes("function buildTeamRotationRankMap"),
  "Team Heat Check view must promote rotation rank into its own linked block instead of the old summary caption",
);

assert(
  rotationsPage.includes('const TITLE = "2026 MLB Rotation Rankings";') &&
    rotationsPage.includes('const DESCRIPTION = "Every team') &&
    rotationsPage.includes("getRotationLeaderboard({ window: FORM_CONFIG.windowDefault })") &&
    rotationsPage.includes("formWindowLabel(leaderboard.window)") &&
    rotationsPage.includes("websiteOpenGraph(TITLE, DESCRIPTION, absoluteUrl(CANONICAL))") &&
    rotationsPage.includes("largeImageTwitter(TITLE, DESCRIPTION)") &&
    rotationsPage.includes('"@type": "ItemList"') &&
    rotationsPage.includes("position: row.rank") &&
    rotationsPage.includes("numberOfItems: leaderboard.rows.length") &&
    rotationsPage.includes('data-rotation-leaderboard') &&
    rotationsPage.includes('data-rotation-row') &&
    rotationsPage.includes("id={`team-${row.team.toLowerCase()}`}") &&
    rotationsPage.includes("href={`/heat-check?team=${row.team}`}") &&
    rotationsPage.includes("teamDisplayName(row.team)") &&
    rotationsPage.includes("teamLogoUrl(team)") &&
    rotationsPage.includes("BandSummary") &&
    rotationsPage.includes("Small staff sample"),
  "/rotations must render the SEO rotation leaderboard with team rows, shared window labeling, metadata, and ItemList JSON-LD",
);

assert(
  formPage.includes('data-rotation-board-nav') &&
    formPage.includes('<Link href="/rotations"') &&
    packageJson.includes('"check:rotation-leaderboard": "node scripts/check-rotation-leaderboard-contract.mjs"'),
  "Heat Check must link to the rotation leaderboard and package scripts must expose the contract",
);

console.log("Rotation leaderboard contract passed.");
