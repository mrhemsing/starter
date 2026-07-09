import { createHash } from "node:crypto";
import { readCachedRuntimeState, readRuntimeState, writeRuntimeState } from "@/lib/data/runtime-state-store";
import { getTonightMustWatch } from "@/lib/data/tonight-service";
import { getPitcherForm } from "@/lib/data/form-service";
import {
  upcomingSimpleContextArchetype,
  upcomingSimpleContextSentence,
  upcomingSimpleContextSentencesForSlate,
  validateUpcomingSimpleContextSentence,
} from "@/lib/upcoming-simple-context";
import type { FormStartPoint, TonightGame, TonightStarter } from "@/lib/types";

type UpcomingWriteupsState = {
  version: 6;
  date: string;
  inputHash: string;
  inputHashes?: Record<string, string>;
  promptVersion: number;
  generatedAt: string;
  model: string;
  writeups: Record<string, string>;
  sources: Record<string, "llm" | "fallback">;
  fallbackCount: number;
};

type MatchupFactPacket = {
  facts: MatchupFact[];
};

type MatchupFact = {
  key: "venue_history" | "season_best" | "streak" | "k_line" | "narrative_notable";
  owner: string;
  text: string;
  source: "form-service" | "odds-feed";
  score: number;
  trace: string[];
};

type UpcomingWriteupInput = {
  gamePk: string;
  matchup: string;
  firstPitch: string;
  watchScore: string;
  confidence: TonightGame["watchScoreConfidence"];
  archetype: string;
  deterministicFallback: string;
  starters: Array<{
    side: TonightStarter["side"];
    team: string;
    name: string | null;
    band: TonightStarter["tier"] | TonightStarter["formStatus"] | null;
    form: string | null;
    trend: TonightStarter["trend"] | null | undefined;
    projectedGsPlus: string | null;
    limitedSample: boolean;
    restDays: number | null;
    projectedStrikeouts: string | null;
    opponentTotal: string | null;
  }>;
  park: {
    name: string;
    label: string;
    runValue: string;
  };
  weather: {
    label: string;
    runValue: string;
  };
  factPacket: MatchupFactPacket;
};

type GenerateUpcomingWriteupsResult = {
  date: string;
  generated: number;
  reused: number;
  fallbackCount: number;
  model: string;
  stored: boolean;
};

const UPCOMING_WRITEUPS_VERSION = 6;
const UPCOMING_WRITEUPS_PROMPT_VERSION = 13;
const UPCOMING_WRITEUPS_MODEL = process.env.OPENAI_MODEL_UPCOMING_WRITEUPS ?? "gpt-4.1-mini";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_GENERATION_MS = 5500;
const MAX_GENERATION_ATTEMPTS = 7;
const MAX_FACTS_PER_MATCHUP = 2;
const UPCOMING_WRITEUPS_REVALIDATE_SECONDS = 60;
const PROHIBITED_MATCHUP_PHRASES = /\b(better number|making the context do the work|adding shape to the grade|contextual lean|the board leans on|matchup details|run stress|sit close|the starter read|the trust edge|sets the tone|leads the read|anchors the read|keeps the trust edge)\b/i;
const MODEL_JARGON = /\b(contextual|grade|grading system|starter read|trust edge|the board leans|model|algorithm)\b/i;

export async function readUpcomingWriteups(date: string) {
  const state = await readCachedRuntimeState<UpcomingWriteupsState>(upcomingWriteupsKey(date), UPCOMING_WRITEUPS_REVALIDATE_SECONDS);
  if (state?.version !== UPCOMING_WRITEUPS_VERSION) return {};
  return Object.fromEntries(Object.entries(state.writeups).filter(([, text]) => text.trim().length > 0));
}

export async function generateUpcomingWriteupsForDate(date: string): Promise<GenerateUpcomingWriteupsResult> {
  const slate = await getTonightMustWatch({ date, window: 5, forceOpponentSplits: true });
  const factPackets = await buildUpcomingFactPackets(slate.games);
  const deterministicFallbacks = upcomingSimpleContextSentencesForSlate(slate.games, slate.leagueMeanGS);
  const inputs = slate.games.map((game, index) => upcomingWriteupInput(game, slate.leagueMeanGS, factPackets.get(game.gamePk) ?? { facts: [] }, deterministicFallbacks[game.gamePk] ?? upcomingSimpleContextSentence(game, index + 1, slate.leagueMeanGS)));
  const inputHashes = Object.fromEntries(inputs.map((input) => [input.gamePk, hashStableJson({ promptVersion: UPCOMING_WRITEUPS_PROMPT_VERSION, input })]));
  const inputHash = hashStableJson({ promptVersion: UPCOMING_WRITEUPS_PROMPT_VERSION, inputs });
  const previous = await readRuntimeState<UpcomingWriteupsState>(upcomingWriteupsKey(slate.date));
  if (previous?.version === UPCOMING_WRITEUPS_VERSION && previous.inputHash === inputHash && hasUsableWriteupsForGames(previous, slate.games)) {
    return { date: slate.date, generated: 0, reused: slate.games.length, fallbackCount: previous.fallbackCount, model: previous.model, stored: true };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  let fallbackCount = 0;
  let reusedCount = 0;
  let generatedCount = 0;
  const writeups: Record<string, string> = {};
  const sources: UpcomingWriteupsState["sources"] = {};
  const acceptedSlateSentences: string[] = [];
  for (const [index, game] of slate.games.entries()) {
    const input = inputs[index];
    const fallback = input.deterministicFallback;
    const inputUnchanged = previous?.inputHashes ? previous.inputHashes[game.gamePk] === inputHashes[game.gamePk] : previous?.inputHash === inputHash;
    if (
      previous?.version === UPCOMING_WRITEUPS_VERSION &&
      inputUnchanged &&
      previous.sources?.[game.gamePk] === "llm" &&
      previous.writeups[game.gamePk]?.trim() &&
      validateGeneratedUpcomingText(previous.writeups[game.gamePk], input, game, slate.leagueMeanGS) &&
      !hasSlateNgramCollision(previous.writeups[game.gamePk], input, acceptedSlateSentences) &&
      !hasSlateStructureCrowding(previous.writeups[game.gamePk], input, acceptedSlateSentences)
    ) {
      const reused = normalizeGeneratedSentence(previous.writeups[game.gamePk]);
      writeups[game.gamePk] = reused;
      sources[game.gamePk] = "llm";
      acceptedSlateSentences.push(reused);
      reusedCount += 1;
      continue;
    }
    const generated = apiKey ? await generateOneUpcomingWriteupWithRetries(apiKey, input, game, slate.leagueMeanGS, acceptedSlateSentences).catch(() => null) : null;
    const sentence = generated ?? slateUniqueFallback(fallback, input, acceptedSlateSentences, game, slate.leagueMeanGS);
    const acceptedGenerated = Boolean(generated);
    if (!acceptedGenerated) fallbackCount += 1;
    sources[game.gamePk] = acceptedGenerated ? "llm" : "fallback";
    if (acceptedGenerated) generatedCount += 1;
    writeups[game.gamePk] = validateGeneratedUpcomingText(sentence, input, game, slate.leagueMeanGS) ? sentence : slateUniqueFallback(fallback, input, acceptedSlateSentences, game, slate.leagueMeanGS);
    if (writeups[game.gamePk] !== sentence && acceptedGenerated) {
      sources[game.gamePk] = "fallback";
      fallbackCount += 1;
      generatedCount -= 1;
    }
    if (hasSlateNgramCollision(writeups[game.gamePk], input, acceptedSlateSentences) || hasSlateStructureCrowding(writeups[game.gamePk], input, acceptedSlateSentences)) {
      console.warn("[upcoming-writeups] slate n-gram collision fell back", {
        date: slate.date,
        gamePk: game.gamePk,
        matchup: input.matchup,
      });
      writeups[game.gamePk] = slateUniqueFallback(fallback, input, acceptedSlateSentences, game, slate.leagueMeanGS);
      sources[game.gamePk] = "fallback";
    }
    acceptedSlateSentences.push(writeups[game.gamePk]);
  }

  const stored = await writeRuntimeState(upcomingWriteupsKey(slate.date), {
    version: UPCOMING_WRITEUPS_VERSION,
    date: slate.date,
    inputHash,
    inputHashes,
    promptVersion: UPCOMING_WRITEUPS_PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    model: UPCOMING_WRITEUPS_MODEL,
    writeups,
    sources,
    fallbackCount,
  });

  return { date: slate.date, generated: generatedCount, reused: reusedCount, fallbackCount, model: UPCOMING_WRITEUPS_MODEL, stored };
}

function hasUsableWriteupsForGames(state: UpcomingWriteupsState, games: TonightGame[]) {
  return games.every((game) => typeof state.writeups[game.gamePk] === "string" && state.writeups[game.gamePk].trim().length > 0);
}

async function generateOneUpcomingWriteupWithRetries(apiKey: string, input: UpcomingWriteupInput, game: TonightGame, leagueMeanGS: number, acceptedSlateSentences: string[]) {
  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const generated = await generateOneUpcomingWriteup(apiKey, input, game, leagueMeanGS, attempt, acceptedSlateSentences);
    if (generated && !hasSlateNgramCollision(generated, input, acceptedSlateSentences) && !hasSlateStructureCrowding(generated, input, acceptedSlateSentences)) return generated;
  }
  const rewrite = await generateFallbackRewrite(apiKey, input, game, leagueMeanGS, acceptedSlateSentences);
  return rewrite && !hasSlateNgramCollision(rewrite, input, acceptedSlateSentences) && !hasSlateStructureCrowding(rewrite, input, acceptedSlateSentences) ? rewrite : null;
}

async function generateOneUpcomingWriteup(apiKey: string, input: UpcomingWriteupInput, game: TonightGame, leagueMeanGS: number, attempt: number, acceptedSlateSentences: string[]) {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: UPCOMING_WRITEUPS_MODEL,
      temperature: 0.3,
      max_output_tokens: 80,
      input: [
        {
          role: "system",
          content: "Write one high-energy matchup sentence from provided baseball data only. Under 24 words. No em dash. No phrase 'this one'. Make a fan want to watch or feel fine skipping this game. Lead with the most electric true thing: a supplied factPacket hook, hot arm, no-hit notable, K line, streak, park/weather chaos, or real tiebreaker. Use one supplied factPacket fact when genuinely interesting. Prefer one sharp claim plus one vivid supporting specific; do not write a short caption unless the archetype is QUIET SHARP/TBD. Every number must appear exactly in the input. Do not invent history, health, results, ranks, or numbers. Mention streaks, venue history, no-hit bids, or hitless innings only when supplied as factPacket facts. Respect the archetype frame. For ACE_DUEL, start with Both or Two and acknowledge both starters are hot. For COIN_FLIP, name the actual tiebreaker factor, never vague context. For PROVISIONAL, lead with limited sample or thin data only for the starter whose limitedSample is true or whose band is not ok. For TBD, do not compare form with the unnamed side. Avoid towers, clear separation, form points, has been, since, owned, better number, making the context do the work, adding shape to the grade, contextual lean, the board leans on, matchup details, run stress, sit close, the starter read, the trust edge, sets the tone, leads the read, anchors the read, and keeps the trust edge.",
        },
        {
          role: "user",
          content: JSON.stringify({ ...input, attempt, avoidFourWordPhrases: slateNgramsForPrompt(acceptedSlateSentences, input).slice(0, 40) }),
        },
      ],
    }),
    signal: AbortSignal.timeout(MAX_GENERATION_MS),
  });
  if (!response.ok) return null;
  const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const text = normalizeGeneratedSentence(extractResponseText(payload));
  if (!text || !validateGeneratedUpcomingText(text, input, game, leagueMeanGS)) return null;
  return text;
}

async function generateFallbackRewrite(apiKey: string, input: UpcomingWriteupInput, game: TonightGame, leagueMeanGS: number, acceptedSlateSentences: string[]) {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: UPCOMING_WRITEUPS_MODEL,
      temperature: 0.15,
      max_output_tokens: 70,
      input: [
        {
          role: "system",
          content: "Rewrite deterministicFallback as one energetic baseball sentence. Under 24 words. No em dash. No new facts or numbers. Keep the same supported claim and avoid any listed four-word phrase. If needed, return deterministicFallback exactly.",
        },
        {
          role: "user",
          content: JSON.stringify({
            gamePk: input.gamePk,
            matchup: input.matchup,
            archetype: input.archetype,
            deterministicFallback: input.deterministicFallback,
            avoidFourWordPhrases: slateNgramsForPrompt(acceptedSlateSentences, input).slice(0, 40),
            starters: input.starters.map((starter) => ({ name: starter.name, team: starter.team, band: starter.band, form: starter.form })),
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(MAX_GENERATION_MS),
  });
  if (!response.ok) return null;
  const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const text = normalizeGeneratedSentence(extractResponseText(payload));
  if (!text || !validateGeneratedUpcomingText(text, input, game, leagueMeanGS)) return null;
  return text;
}

function validateGeneratedUpcomingText(sentence: string, input: UpcomingWriteupInput, game: TonightGame, leagueMeanGS: number) {
  const clean = normalizeGeneratedSentence(sentence);
  if (!clean) return false;
  if (wordCount(clean) > 24) return false;
  if (wordCount(clean) < 12 && !["BOTH_COLD", "PROVISIONAL", "TBD"].includes(input.archetype)) return false;
  if (!validateUpcomingSimpleContextSentence(clean, game, leagueMeanGS, factAllowedNumberTokens(input))) return false;
  if (/\b(unhittable|dominant stretch|has been|since|revenge|owns him|owned)\b/i.test(clean)) return false;
  if (PROHIBITED_MATCHUP_PHRASES.test(clean) || MODEL_JARGON.test(clean)) return false;
  if (hasCommaChain(clean) || hasDuplicateConclusion(clean, input)) return false;
  if (!hasConcreteSpecific(clean, input)) return false;
  if (!validateFactTrace(clean, input)) return false;
  const allowedNumbers = new Set(JSON.stringify(input).match(/\d+(?:\.\d+)?/g) ?? []);
  return (clean.match(/\d+(?:\.\d+)?/g) ?? []).every((token) => allowedNumbers.has(token));
}

function wordCount(sentence: string) {
  return sentence.trim().split(/\s+/).filter(Boolean).length;
}

function hasSlateNgramCollision(sentence: string, input: UpcomingWriteupInput, acceptedSlateSentences: string[]) {
  const candidate = slateNgrams(sentence, input);
  if (candidate.size === 0) return false;
  return acceptedSlateSentences.some((accepted) => {
    const prior = slateNgrams(accepted, input);
    for (const phrase of candidate) {
      if (prior.has(phrase)) return true;
    }
    return false;
  });
}

function hasSlateStructureCrowding(sentence: string, input: UpcomingWriteupInput, acceptedSlateSentences: string[]) {
  const key = sentenceStructureKey(sentence, input);
  if (key !== "possessive-number-single-clause") return false;
  const matching = acceptedSlateSentences.filter((accepted) => sentenceStructureKey(accepted, input) === key).length;
  return matching + 1 > Math.max(1, Math.floor((acceptedSlateSentences.length + 1) / 3));
}

function sentenceStructureKey(sentence: string, input: UpcomingWriteupInput) {
  const lower = sentence.toLowerCase();
  const startsWithPossessiveNumber = input.starters.some((starter) => {
    if (!starter.name) return false;
    const last = shortName(starter.name).toLowerCase();
    return new RegExp(`^${escapeRegExp(last)}['’]s\\s+\\d+(?:\\.\\d+)?\\b`).test(lower);
  });
  if (startsWithPossessiveNumber && !/[;,]/.test(sentence)) return "possessive-number-single-clause";
  if (/^(both|two)\b/i.test(sentence)) return "both-open";
  if (/^only\b/i.test(sentence)) return "only-open";
  if (/^(not the marquee|dead even|a pending|limited|thin|small-sample)\b/i.test(sentence)) return "context-open";
  if (input.factPacket.facts.some((fact) => lower.startsWith(shortName(fact.owner).toLowerCase()))) return "fact-owner-open";
  return "other";
}

function slateNgramsForPrompt(sentences: string[], input: UpcomingWriteupInput) {
  return [...new Set(sentences.flatMap((sentence) => [...slateNgrams(sentence, input)]))];
}

function slateNgrams(sentence: string, input: UpcomingWriteupInput) {
  const normalized = normalizeForSlateNgrams(sentence, input);
  const words = normalized.split(/\s+/).filter(Boolean);
  const phrases = new Set<string>();
  for (let size = 4; size <= Math.min(7, words.length); size += 1) {
    for (let index = 0; index <= words.length - size; index += 1) {
      phrases.add(words.slice(index, index + size).join(" "));
    }
  }
  return phrases;
}

function normalizeForSlateNgrams(sentence: string, input: UpcomingWriteupInput) {
  let value = sentence
    .toLowerCase()
    .replace(/\d+(?:\.\d+)?/g, "{num}")
    .replace(/[^a-z0-9{}+.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (const starter of input.starters) {
    if (!starter.name) continue;
    for (const token of [starter.name, shortName(starter.name)]) {
      value = value.replace(new RegExp(`(^|\\s)${escapeRegExp(token.toLowerCase())}(?=\\s|$)`, "g"), " {pitcher}");
    }
  }
  return value.replace(/\s+/g, " ").trim();
}

function slateUniqueFallback(fallback: string, input: UpcomingWriteupInput, acceptedSlateSentences: string[], game: TonightGame, leagueMeanGS: number) {
  const candidates = [factHookFallback(input), normalizeGeneratedSentence(fallback)].filter((candidate): candidate is string => Boolean(candidate));
  for (const candidate of candidates) {
    if (
      validateGeneratedUpcomingText(candidate, input, game, leagueMeanGS) &&
      !hasSlateNgramCollision(candidate, input, acceptedSlateSentences) &&
      !hasSlateStructureCrowding(candidate, input, acceptedSlateSentences)
    ) {
      return candidate;
    }
  }
  const clean = normalizeGeneratedSentence(fallback);
  if (!hasSlateNgramCollision(clean, input, acceptedSlateSentences) && !hasSlateStructureCrowding(clean, input, acceptedSlateSentences)) return clean;
  const matchupSuffix = ` ${input.matchup}.`;
  const withoutPeriod = clean.replace(/[.!?]$/, "");
  const candidate = `${withoutPeriod}${matchupSuffix}`;
  if (candidate.split(/\s+/).filter(Boolean).length <= 24 && !hasSlateNgramCollision(candidate, input, acceptedSlateSentences) && !hasSlateStructureCrowding(candidate, input, acceptedSlateSentences)) {
    return candidate;
  }
  return clean;
}

function factHookFallback(input: UpcomingWriteupInput) {
  const fact = input.factPacket.facts[0];
  if (!fact) return null;
  const owner = shortName(fact.owner);
  if (fact.key === "narrative_notable") return normalizeGeneratedSentence(`${fact.text}; ${owner} brings the night's loudest hook.`);
  if (fact.key === "k_line") return normalizeGeneratedSentence(`${fact.text}, putting strikeout chase at the center of ${input.matchup}.`);
  if (fact.key === "venue_history") return normalizeGeneratedSentence(`${fact.text}, giving ${owner} real ballpark history for ${input.matchup}.`);
  if (fact.key === "season_best") return normalizeGeneratedSentence(`${fact.text}, so ${input.matchup} has ceiling baked in.`);
  if (fact.key === "streak") return normalizeGeneratedSentence(`${fact.text}, making the form arrow worth watching in ${input.matchup}.`);
  return null;
}

function hasCommaChain(sentence: string) {
  return (sentence.match(/,/g) ?? []).length >= 2;
}

function hasDuplicateConclusion(sentence: string, input: UpcomingWriteupInput) {
  const lower = sentence.toLowerCase();
  const starterNames = input.starters.flatMap((starter) => starter.name ? [starter.name.toLowerCase(), shortName(starter.name).toLowerCase()] : []);
  const mentioned = starterNames.filter((name) => name.length >= 3 && new RegExp(`(^|[^a-z])${escapeRegExp(name)}([^a-z]|$)`, "i").test(lower));
  if (new Set(mentioned).size < 2) return false;
  const comparativeClaims = lower.match(/\b(ahead|leads?|edges?|lean|higher|stronger|trusted side|puts .* ahead|clears)\b/g) ?? [];
  return comparativeClaims.length > 1;
}

function hasConcreteSpecific(sentence: string, input: UpcomingWriteupInput) {
  if ((sentence.match(/\d+(?:\.\d+)?/g) ?? []).length > 0) return true;
  if (input.factPacket.facts.some((fact) => fact.trace.some((trace) => trace.length > 3 && sentence.toLowerCase().includes(trace.toLowerCase())))) return true;
  return /\b(wind|weather|hitter-friendly|suppresses|toward bats|toward arms|rest edge|days|K line|strikeout|opponent total|implied total|vs LHP|vs RHP|TBD|starter is still open|not named)\b/i.test(sentence);
}

function normalizeGeneratedSentence(value: string) {
  const clean = value.replace(/[“”"]/g, "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function extractResponseText(payload: { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }) {
  if (typeof payload.output_text === "string") return payload.output_text.trim();
  return payload.output?.flatMap((item) => item.content ?? []).map((content) => content.text ?? "").join(" ").trim() ?? "";
}

function upcomingWriteupInput(game: TonightGame, leagueMeanGS: number, factPacket: MatchupFactPacket, deterministicFallback: string): UpcomingWriteupInput {
  return {
    gamePk: game.gamePk,
    matchup: game.label,
    firstPitch: game.firstPitch,
    watchScore: game.gameWatchScore.toFixed(1),
    confidence: game.watchScoreConfidence,
    archetype: upcomingSimpleContextArchetype(game, leagueMeanGS),
    deterministicFallback,
    starters: game.starters.map((starter) => ({
      side: starter.side,
      team: starter.team,
      name: starter.name,
      band: starter.tier ?? starter.formStatus,
      form: typeof starter.rgs === "number" ? starter.rgs.toFixed(1) : null,
      trend: starter.trend,
      projectedGsPlus: typeof starter.projection?.projectedGsPlus === "number" ? starter.projection.projectedGsPlus.toFixed(1) : null,
      limitedSample: starter.flags?.limitedSample === true,
      restDays: starter.workload?.daysRest ?? null,
      projectedStrikeouts: typeof starter.marketContext?.projectedStrikeouts === "number" ? starter.marketContext.projectedStrikeouts.toFixed(1) : null,
      opponentTotal: typeof starter.marketContext?.opposingTeamTotal === "number" ? starter.marketContext.opposingTeamTotal.toFixed(1) : null,
    })),
    park: {
      name: game.park,
      label: game.parkContext.label,
      runValue: game.parkContext.runValue.toFixed(1),
    },
    weather: {
      label: game.weatherContext.label,
      runValue: game.weatherContext.runValue.toFixed(1),
    },
    factPacket,
  };
}

async function buildUpcomingFactPackets(games: TonightGame[]) {
  const slateHighKLine = highestStrikeoutLine(games);
  const entries = await Promise.all(games.map(async (game) => [game.gamePk, await buildUpcomingFactPacket(game, slateHighKLine)] as const));
  return new Map(entries);
}

async function buildUpcomingFactPacket(game: TonightGame, slateHighKLine: number | null): Promise<MatchupFactPacket> {
  const factGroups = await Promise.all(game.starters.map((starter) => buildStarterFacts(game, starter, slateHighKLine)));
  const facts = factGroups.flat().sort((a, b) => b.score - a.score).slice(0, MAX_FACTS_PER_MATCHUP);
  return { facts };
}

async function buildStarterFacts(game: TonightGame, starter: TonightStarter, slateHighKLine: number | null): Promise<MatchupFact[]> {
  if (!starter.pitcherId || !starter.name) return [];
  const facts: MatchupFact[] = [];
  const lineFact = starterStrikeoutLineFact(starter, slateHighKLine);
  if (lineFact) facts.push(lineFact);

  const form = await getPitcherForm(starter.pitcherId, { window: 5 }).catch(() => null);
  if (!form) return facts;

  const venueFact = starterVenueHistoryFact(game, starter, form.series);
  if (venueFact) facts.push(venueFact);
  const seasonBestFact = starterSeasonBestFact(starter, form.series);
  if (seasonBestFact) facts.push(seasonBestFact);
  const narrativeFact = starterNarrativeNotableFact(starter, form.series);
  if (narrativeFact) facts.push(narrativeFact);
  const streakFact = starterStreakFact(starter, form.series);
  if (streakFact) facts.push(streakFact);
  return facts;
}

function starterNarrativeNotableFact(starter: TonightStarter, series: FormStartPoint[]): MatchupFact | null {
  if (!starter.name || series.length === 0) return null;
  const last = [...series].reverse()[0];
  const noHit = last?.narrativeNotables?.noHitDepth;
  if (noHit?.firstHitInning && noHit.innings >= 8) {
    const inning = ordinal(noHit.firstHitInning);
    const text = `${starter.name}'s last start carried a no-hitter into the ${inning}`;
    return {
      key: "narrative_notable",
      owner: starter.name,
      text,
      source: "form-service",
      score: 98 + noHit.innings,
      trace: [starter.name, "last start", "no-hitter", inning],
    };
  }
  if (noHit?.hitlessStintComplete && noHit.innings >= 5) {
    const text = `${starter.name}'s last start included ${noHit.innings}.0 hitless innings`;
    return {
      key: "narrative_notable",
      owner: starter.name,
      text,
      source: "form-service",
      score: 90 + noHit.innings,
      trace: [starter.name, "last start", `${noHit.innings}.0`, "hitless innings"],
    };
  }
  return null;
}

function starterStrikeoutLineFact(starter: TonightStarter, slateHighKLine: number | null): MatchupFact | null {
  const line = starter.marketContext?.strikeoutPropLine;
  if (!starter.name || typeof line !== "number") return null;
  const projection = starter.marketContext?.projectedStrikeouts;
  const isSlateHigh = typeof slateHighKLine === "number" && line === slateHighKLine;
  const edge = typeof projection === "number" ? Math.abs(line - projection) : 0;
  if (!isSlateHigh && edge < 0.5) return null;

  const lineText = formatNumber(line);
  const projectionText = typeof projection === "number" ? formatNumber(projection) : null;
  const text = isSlateHigh
    ? `${starter.name}'s K line is ${lineText}, highest on the slate`
    : `${starter.name}'s K line is ${lineText}, ${formatNumber(edge)} away from his ${projectionText} projection`;
  return {
    key: "k_line",
    owner: starter.name,
    text,
    source: "odds-feed",
    score: isSlateHigh ? 95 : 58 + edge,
    trace: [starter.name, lineText, ...(projectionText ? [projectionText] : []), "K line", "highest on the slate"],
  };
}

function starterVenueHistoryFact(game: TonightGame, starter: TonightStarter, series: FormStartPoint[]): MatchupFact | null {
  if (!starter.name) return null;
  const prior = [...series].reverse().find((start) => start.park === game.park && start.gamePk !== game.gamePk);
  if (!prior || (prior.k < 6 && prior.gsPlus < 55)) return null;
  const text = `${starter.name}'s last ${game.park} start: ${prior.k} K, ${formatNumber(prior.ip)} IP`;
  return {
    key: "venue_history",
    owner: starter.name,
    text,
    source: "form-service",
    score: 80 + Math.max(0, prior.k - 8) * 2 + Math.max(0, prior.gsPlus - 60) / 4,
    trace: [starter.name, game.park, String(prior.k), formatNumber(prior.ip), "last", "start"],
  };
}

function starterSeasonBestFact(starter: TonightStarter, series: FormStartPoint[]): MatchupFact | null {
  if (!starter.name || series.length === 0) return null;
  const best = series.reduce((leader, start) => start.gsPlus > leader.gsPlus ? start : leader, series[0]);
  if (best.gsPlus < 62) return null;
  const gsPlus = formatNumber(best.gsPlus);
  const text = `${starter.name}'s season best is ${gsPlus} GS+ with ${best.k} K`;
  return {
    key: "season_best",
    owner: starter.name,
    text,
    source: "form-service",
    score: 70 + Math.max(0, best.gsPlus - 65) / 3 + Math.max(0, best.k - 7),
    trace: [starter.name, gsPlus, String(best.k), "season best", "GS+"],
  };
}

function starterStreakFact(starter: TonightStarter, series: FormStartPoint[]): MatchupFact | null {
  if (!starter.name) return null;
  const hotCount = countWhile([...series].reverse(), (start) => start.gsPlus >= 55);
  if (hotCount < 2) return null;
  const text = `${starter.name} has ${hotCount} straight starts at GS+ 55 plus`;
  return {
    key: "streak",
    owner: starter.name,
    text,
    source: "form-service",
    score: 66 + hotCount,
    trace: [starter.name, String(hotCount), "straight starts", "GS+", "55 plus"],
  };
}

function highestStrikeoutLine(games: TonightGame[]) {
  const lines = games.flatMap((game) => game.starters.flatMap((starter) => typeof starter.marketContext?.strikeoutPropLine === "number" ? [starter.marketContext.strikeoutPropLine] : []));
  return lines.length > 0 ? Math.max(...lines) : null;
}

function validateFactTrace(sentence: string, input: UpcomingWriteupInput) {
  const lower = sentence.toLowerCase();
  const facts = input.factPacket.facts;
  const factText = facts.map((fact) => fact.text.toLowerCase()).join(" ");
  const hasFact = (key: MatchupFact["key"]) => facts.some((fact) => fact.key === key);
  if (/\b(last at|last .* start|venue|park|ballpark)\b/i.test(lower) && !hasFact("venue_history")) return false;
  if (/\b(season best|best start)\b/i.test(lower) && !hasFact("season_best")) return false;
  if (/\b(straight starts|streak)\b/i.test(lower) && !hasFact("streak")) return false;
  if (/\b(k line|strikeout line|highest on the slate)\b/i.test(lower) && !hasFact("k_line")) return false;
  if (/\b(no-hitter|hitless innings)\b/i.test(lower) && !hasFact("narrative_notable")) return false;
  for (const fact of facts) {
    for (const trace of fact.trace) {
      if (trace.length > 3 && lower.includes(trace.toLowerCase()) && !factText.includes(trace.toLowerCase())) return false;
    }
  }
  return true;
}

function factAllowedNumberTokens(input: UpcomingWriteupInput) {
  return input.factPacket.facts.flatMap((fact) => fact.trace.flatMap((trace) => trace.match(/\d+(?:\.\d+)?/g) ?? []));
}

function countWhile<T>(values: T[], predicate: (value: T) => boolean) {
  let count = 0;
  for (const value of values) {
    if (!predicate(value)) break;
    count += 1;
  }
  return count;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function ordinal(value: number) {
  if (value === 8) return "eighth";
  if (value === 9) return "ninth";
  return `${value}th`;
}

function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function upcomingWriteupsKey(date: string) {
  return `upcoming-writeups:v${UPCOMING_WRITEUPS_VERSION}:${date}`;
}

function hashStableJson(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24);
}
