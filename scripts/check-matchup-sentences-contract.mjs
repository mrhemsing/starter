import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const context = await readFile("src/lib/upcoming-simple-context.ts", "utf8");
const writeups = await readFile("src/lib/data/upcoming-writeups-service.ts", "utf8");
const simpleContract = await readFile("scripts/check-upcoming-simple-view-contract.mjs", "utf8");

const bannedPhrases = [
  "better number",
  "making the context do the work",
  "adding shape to the grade",
  "contextual lean",
  "the board leans on",
  "matchup details",
  "run stress",
  "sit close",
  "the starter read",
  "the trust edge",
  "sets the tone",
  "leads the read",
  "anchors the read",
  "keeps the trust edge",
];

for (const phrase of bannedPhrases) {
  assert(
    context.includes("PROHIBITED_CLICHES") && context.includes(phrase),
    `Simple fallback validator must ban ${phrase}`,
  );
  assert(
    writeups.includes("PROHIBITED_MATCHUP_PHRASES") && writeups.includes(phrase),
    `Upcoming writeup validator must ban ${phrase}`,
  );
  assert(
    !context.includes(`"${phrase}`) && !context.includes(`${phrase}."`),
    `Simple fallback phrase bank must not render ${phrase}`,
  );
}

assert(context.includes("MODEL_JARGON") && writeups.includes("MODEL_JARGON"), "Both fallback and LLM validators must ban model-about-model jargon.");
const phraseBankSource = context.slice(context.indexOf("const ARCHETYPE_BANK"), context.indexOf("export function upcomingSimpleContextSentence"));
assert(!phraseBankSource.includes("has the better number") && !phraseBankSource.includes("adding shape to the grade"), "Removed live-board cliches must not remain in fallback banks.");

assert(
  context.includes("function hasConcreteSpecific") &&
    context.includes("numberTokens(sentence).length > 0") &&
    context.includes("K line") &&
    context.includes("opponent total") &&
    context.includes("toward bats") &&
    context.includes("toward arms"),
  "Simple fallback validator must reject contentless context gestures unless a concrete specific is present.",
);

assert(
  context.includes("function hasCommaChain") &&
    context.includes("function hasDuplicateComparativeConclusion") &&
    context.includes("edges?") &&
    writeups.includes("function hasCommaChain") &&
    writeups.includes("function hasDuplicateConclusion") &&
    writeups.includes("edges?"),
  "Both validators must reject comma-splice chains and duplicate comparative conclusions.",
);

assert(
  writeups.includes("acceptedSlateSentences") &&
    writeups.includes("hasSlateNgramCollision") &&
    writeups.includes("slateNgrams") &&
    writeups.includes("normalizeForSlateNgrams") &&
    writeups.includes("avoidFourWordPhrases") &&
    writeups.includes("slate n-gram collision fell back"),
  "Upcoming writeup generation must enforce slate-wide 4-plus-word n-gram uniqueness and log collisions.",
);

assert(
  context.includes("upcomingSimpleContextSentencesForSlate") &&
    context.includes("slateUniqueContextSentence") &&
    context.includes("hasSlateNgramCollision") &&
    context.includes("matchupSpecificFallback") &&
    writeups.includes("upcomingSimpleContextSentencesForSlate(slate.games, slate.leagueMeanGS)"),
  "Deterministic fallback sentences must also be generated slate-wide so rendered boards stay clean before stored LLM output exists.",
);

assert(
  writeups.includes("replace(/\\d+(?:\\.\\d+)?/g, \"{num}\")") &&
    writeups.includes(" {pitcher}") &&
    writeups.includes("for (let size = 4; size <= Math.min(7, words.length); size += 1)"),
  "N-gram collision checks must normalize numbers and pitcher names before comparing 4-plus-word phrases.",
);

assert(
  writeups.includes("Make a fan want to watch or feel fine skipping this game") &&
    writeups.includes("Lead with the most electric true thing") &&
    writeups.includes("Use one supplied factPacket fact when genuinely interesting"),
  "Prompt must push energetic baseball language and fact-packet hooks instead of model jargon.",
);

assert(
  writeups.includes("edge < 0.5") &&
    writeups.includes("prior.k < 6 && prior.gsPlus < 55") &&
    writeups.includes("best.gsPlus < 62") &&
    writeups.includes("hotCount < 2"),
  "Fact-packet gates must be calibrated so genuine K-line, venue, season-best, and streak hooks can surface.",
);

assert(
  writeups.includes("const UPCOMING_WRITEUPS_VERSION = 6;") &&
    writeups.includes("const UPCOMING_WRITEUPS_PROMPT_VERSION = 13;") &&
    simpleContract.includes("const UPCOMING_WRITEUPS_VERSION = 6;") &&
    simpleContract.includes("const UPCOMING_WRITEUPS_PROMPT_VERSION = 13;"),
  "Writeup version and prompt version must force current-slate regeneration under the tightened rules.",
);

assert(
  context.includes("hasSlateStructureCrowding") &&
    context.includes("sentenceStructureKey") &&
    writeups.includes("hasSlateStructureCrowding") &&
    writeups.includes("possessive-number-single-clause") &&
    writeups.includes("wordCount(clean) < 12"),
  "Energy pass must reject structural sameness and undersized captions unless the matchup is quiet or provisional.",
);

assert(
  writeups.includes("factHookFallback") &&
    writeups.includes("state.writeups") &&
    writeups.includes('fact.key === "narrative_notable"') &&
    writeups.includes("Object.entries(state.writeups).filter(([, text]) => text.trim().length > 0)"),
  "Fact packets must be allowed to drive stored fallback sentences instead of disappearing when LLM output is unavailable.",
);

console.log("matchup sentence tightening contract ok");
