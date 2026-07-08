import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const page = await readFile("src/app/upcoming/streamers/page.tsx", "utf8");
const service = await readFile("src/lib/data/streamers-read-service.ts", "utf8");
const cronRoute = await readFile("src/app/api/cron/fantasy-streaming-read/route.ts", "utf8");
const vercelConfig = await readFile("vercel.json", "utf8");

assert.equal(packageJson.scripts["check:fantasy-streaming-read"], "node scripts/check-fantasy-streaming-read-contract.mjs", "package scripts must expose the fantasy streaming read contract.");
assert(page.includes('import { readFantasyCoach, type FantasyCoachContent } from "@/lib/data/streamers-read-service";') && page.includes("const fantasyCoach = await readFantasyCoach(streamers)") && page.includes("data-fantasy-coach") && page.includes("Fantasy coach"), "Fantasy page must server-render the stored/fallback Fantasy Coach instead of a single streaming-read banner.");
assert(
  page.includes("const hasTwoStartPitchers = streamers.twoStartPitchers.length > 0") &&
    page.includes('data-fantasy-streamers-layout="fantasy-coach-balanced"') &&
    page.includes('data-fantasy-coach-layout="coach-left-board-right"') &&
    page.includes("function FantasyCoachPanel") &&
    page.includes("data-fantasy-coach-column") &&
    page.includes('data-two-start-state={hasTwoStartPitchers ? "populated" : "early-week-empty"}') &&
    page.includes('data-two-start-empty-state={coach.midweekNote ? "early-week" : "coach-populated"}') &&
    page.includes('data-two-start-empty-state-height="compact-under-200"') &&
    service.includes("Two-start pitchers confirm midweek. Check back as probables are announced.") &&
    !page.includes("function TwoStartEmptyState()") &&
    !page.includes("No two-start pitchers are visible yet."),
  "Fantasy page must fill the left column with Fantasy Coach content and keep the early-week two-start note compact.",
);
assert(!page.includes("OPENAI_API_KEY"), "Fantasy page must never use the OpenAI key on the request path.");
assert(service.includes("readRuntimeState") && service.includes("writeRuntimeState") && service.includes("OPENAI_API_KEY") && service.includes("OPENAI_RESPONSES_URL"), "Fantasy read service must store generated copy and isolate OpenAI usage in the write-time service.");
assert(service.includes("export async function readFantasyCoach") && service.includes("generateFantasyStreamingRead") && service.includes("getUpcomingStreamers(anchorDate)") && service.includes("fallbackFantasyCoach(input)") && service.includes("validateFantasyCoach"), "Fantasy coach service must generate from streamers data, validate output, and fall back deterministically.");
assert(
  service.includes("const FANTASY_STREAMING_READ_PROMPT_VERSION = 3") &&
    service.includes("MUST START") &&
    service.includes("SOLID STREAMER") &&
    service.includes("MATCHUP DEPENDENT / RISKY") &&
    service.includes("FADE DESPITE THE RANK") &&
    service.includes("THE TRAP") &&
    service.includes("THE SLEEPER") &&
    service.includes("wordCount(coach.weeklyPlan.join(\" \")) > 90") &&
    service.includes("hasRiskSignalById") &&
    service.includes("Every number must appear in the input.") &&
    service.includes("allowedNumbers"),
  "Fantasy coach validation must enforce tier/callout structure, weekly-plan length, risk consistency, and number fidelity.",
);
assert(
  service.includes("fallbackFantasyCoach(input)") &&
    service.includes("targetReason") &&
    service.includes("riskReason") &&
    service.includes("midweekNote") &&
    !service.includes("This week's streaming read is still forming as probable starters lock in. Check back after the next refresh."),
  "Fantasy coach fallback must render deterministic tiers and the midweek note, not one generic sentence.",
);
assert(service.includes("previous?.version === FANTASY_STREAMING_READ_VERSION") && service.includes("previous.inputHash === inputHash") && service.includes('previous.source === "llm"'), "Fantasy coach generation must reuse stable stored LLM copy for the same fantasy week inputs.");
assert(cronRoute.includes("generateFantasyStreamingRead(date)") && cronRoute.includes("CRON_SECRET") && cronRoute.includes('export const dynamic = "force-dynamic"'), "Fantasy read generation must run behind an authorized cron route.");
assert(vercelConfig.includes('"/api/cron/fantasy-streaming-read"') && vercelConfig.includes('"35 */6 * * *"'), "Vercel must schedule fantasy streaming read generation at low cadence.");

console.log("fantasy streaming read contract ok");
