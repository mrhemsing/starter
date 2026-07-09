import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

const [types, statsClient, canonicalRecord, canonicalStore, liveService, liveComponent, startRecapPage, upcomingWriteups, formService, packageJson] = await Promise.all([
  readFile("src/lib/types.ts", "utf8"),
  readFile("src/lib/data/mlb-stats-client.ts", "utf8"),
  readFile("src/lib/canonical-start-record.ts", "utf8"),
  readFile("src/lib/data/canonical-start-store.ts", "utf8"),
  readFile("src/lib/data/live-scoreboard-service.ts", "utf8"),
  readFile("src/components/live-scoreboard.tsx", "utf8"),
  readFile("src/app/starts/[id]/[slug]/page.tsx", "utf8"),
  readFile("src/lib/data/upcoming-writeups-service.ts", "utf8"),
  readFile("src/lib/data/form-service.ts", "utf8"),
  readFile("package.json", "utf8"),
]);

assert(
  packageJson.includes('"check:slate-story": "node scripts/check-slate-story-contract.mjs"'),
  "package scripts must expose the slate story contract",
);

assert(
  types.includes("export type StartNarrativeNotables = {") &&
    types.includes("noHitDepth?:") &&
    types.includes("firstHitInning: number | null;") &&
    types.includes("perfectDepth?:") &&
    types.includes("narrativeNotables?: StartNarrativeNotables;"),
  "start types must carry structured narrative notables through completed lines, start summaries, APIs, and form points",
);

assert(
  statsClient.includes("export function computeStartNarrativeNotables(") &&
    statsClient.includes("firstPlayInning(plays, isHitEvent)") &&
    statsClient.includes("isHitEvent(eventType: string)") &&
    statsClient.includes("/^(single|double|triple|home_run)$/i") &&
    statsClient.includes("isBaserunnerEvent(eventType: string)") &&
    statsClient.includes("field_error") &&
    statsClient.includes("completeInningsFromLine(line.inningsPitched)") &&
    statsClient.includes("noHitDepth >= 5") &&
    statsClient.includes("perfectDepth >= 5"),
  "MLB gamefeed parser must compute no-hit/perfect depth from inning-level play data instead of box-line inference",
);

assert(
  canonicalRecord.includes("narrativeNotables?: StartNarrativeNotables;") &&
    canonicalRecord.includes("narrativeNotables: normalizeNarrativeNotables(start.narrativeNotables)") &&
    canonicalRecord.includes("official.narrativeNotables") &&
    canonicalStore.includes("narrativeNotables: next.narrativeNotables") &&
    formService.includes("narrativeNotables: record.narrativeNotables"),
  "canonical records and form points must preserve narrative notables for all downstream surfaces",
);

assert(
    liveService.includes("export type SlateStory =") &&
    liveService.includes("export async function writeSlateStoryForFinalBoard") &&
    liveService.includes("function buildDeterministicSlateStory") &&
    liveService.includes("function slateNarrativeNotables") &&
    liveService.includes("secondaryNotable?.sentence") &&
    liveService.includes("noHit?.firstHitInning && noHit.innings >= 8") &&
    liveService.includes("carried a no-hitter into the ${ordinal(noHit.firstHitInning)}") &&
    liveService.includes("function isSupportedSlateStory") &&
    liveService.includes("no-hitter into the (\\w+)") &&
    liveComponent.includes("const verdictLine = board.slateStory?.story ?? formatSlateCompleteVerdict(board, rows);"),
  "Live final state must render a stored/fallback slate story that leads with supported no-hit timing notables",
);

assert(
  startRecapPage.includes("function startNarrativeNotableSentence") &&
    startRecapPage.includes("carried a no-hitter into the ${ordinal(noHit.firstHitInning)}") &&
    upcomingWriteups.includes('"narrative_notable"') &&
    upcomingWriteups.includes("starterNarrativeNotableFact") &&
    upcomingWriteups.includes("last start carried a no-hitter into the ${inning}") &&
    upcomingWriteups.includes("if (/\\b(no-hitter|hitless innings)\\b/i.test(lower) && !hasFact(\"narrative_notable\")) return false;"),
  "the same stored notable must feed start recaps and upcoming fact packets with trace validation",
);

assert(
  !liveComponent.includes("Fallback:") &&
    liveComponent.includes('fallbackGem ? lineText(fallbackGem) : "No final line available"') &&
    liveComponent.includes('fallbackRough ? lineText(fallbackRough) : "No final line available"'),
  "Live final signal cards must not leak internal fallback jargon",
);

console.log("slate story contract ok: structured notables, final story, recap/fact-packet reuse, and copy cleanup are pinned");
