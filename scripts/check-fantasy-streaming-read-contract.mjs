import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const page = await readFile("src/app/upcoming/streamers/page.tsx", "utf8");
const service = await readFile("src/lib/data/streamers-read-service.ts", "utf8");
const cronRoute = await readFile("src/app/api/cron/fantasy-streaming-read/route.ts", "utf8");
const vercelConfig = await readFile("vercel.json", "utf8");

assert.equal(packageJson.scripts["check:fantasy-streaming-read"], "node scripts/check-fantasy-streaming-read-contract.mjs", "package scripts must expose the fantasy streaming read contract.");
assert(page.includes('import { readFantasyStreamingRead } from "@/lib/data/streamers-read-service";') && page.includes("const streamingRead = await readFantasyStreamingRead(streamers)") && page.includes("data-fantasy-streaming-read") && page.includes("This week&apos;s streaming read"), "Fantasy page must server-render a stored/fallback streaming read above the candidate columns.");
assert(!page.includes("OPENAI_API_KEY"), "Fantasy page must never use the OpenAI key on the request path.");
assert(service.includes("readRuntimeState") && service.includes("writeRuntimeState") && service.includes("OPENAI_API_KEY") && service.includes("OPENAI_RESPONSES_URL"), "Fantasy read service must store generated copy and isolate OpenAI usage in the write-time service.");
assert(service.includes("generateFantasyStreamingRead") && service.includes("getUpcomingStreamers(anchorDate)") && service.includes("fallbackFantasyStreamingRead(input)") && service.includes("validateFantasyRead"), "Fantasy read service must generate from streamers data, validate output, and fall back deterministically.");
assert(service.includes("wordCount(read) > 60") && service.includes('read.includes("—")') && service.includes("Every number must appear in the input.") && service.includes("allowedNumbers"), "Fantasy read validation must enforce length, voice, and number fidelity.");
assert(service.includes("previous?.version === FANTASY_STREAMING_READ_VERSION") && service.includes("previous.inputHash === inputHash") && service.includes('previous.source === "llm"'), "Fantasy read generation must reuse stable stored LLM copy for the same fantasy week inputs.");
assert(cronRoute.includes("generateFantasyStreamingRead(date)") && cronRoute.includes("CRON_SECRET") && cronRoute.includes('export const dynamic = "force-dynamic"'), "Fantasy read generation must run behind an authorized cron route.");
assert(vercelConfig.includes('"/api/cron/fantasy-streaming-read"') && vercelConfig.includes('"35 */6 * * *"'), "Vercel must schedule fantasy streaming read generation at low cadence.");

console.log("fantasy streaming read contract ok");
