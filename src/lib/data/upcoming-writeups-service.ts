import { createHash } from "node:crypto";
import { readRuntimeState, writeRuntimeState } from "@/lib/data/runtime-state-store";
import { getTonightMustWatch } from "@/lib/data/tonight-service";
import {
  upcomingSimpleContextArchetype,
  upcomingSimpleContextSentence,
  validateUpcomingSimpleContextSentence,
} from "@/lib/upcoming-simple-context";
import type { TonightGame, TonightStarter } from "@/lib/types";

type UpcomingWriteupsState = {
  version: 2;
  date: string;
  inputHash: string;
  promptVersion: number;
  generatedAt: string;
  model: string;
  writeups: Record<string, string>;
  sources: Record<string, "llm" | "fallback">;
  fallbackCount: number;
};

type UpcomingWriteupInput = {
  gamePk: string;
  matchup: string;
  firstPitch: string;
  watchScore: string;
  confidence: TonightGame["watchScoreConfidence"];
  archetype: string;
  starters: Array<{
    side: TonightStarter["side"];
    team: string;
    name: string | null;
    band: TonightStarter["tier"] | TonightStarter["formStatus"] | null;
    form: string | null;
    trend: TonightStarter["trend"] | null | undefined;
    projectedGsPlus: string | null;
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
};

type GenerateUpcomingWriteupsResult = {
  date: string;
  generated: number;
  reused: number;
  fallbackCount: number;
  model: string;
  stored: boolean;
};

const UPCOMING_WRITEUPS_VERSION = 2;
const UPCOMING_WRITEUPS_PROMPT_VERSION = 3;
const UPCOMING_WRITEUPS_MODEL = process.env.OPENAI_MODEL_UPCOMING_WRITEUPS ?? "gpt-4.1-mini";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_GENERATION_MS = 5500;
const MAX_GENERATION_ATTEMPTS = 3;

export async function readUpcomingWriteups(date: string) {
  const state = await readRuntimeState<UpcomingWriteupsState>(upcomingWriteupsKey(date));
  if (state?.version !== UPCOMING_WRITEUPS_VERSION) return {};
  return Object.fromEntries(Object.entries(state.writeups).filter(([gamePk, text]) => state.sources?.[gamePk] === "llm" && text.trim().length > 0));
}

export async function generateUpcomingWriteupsForDate(date: string): Promise<GenerateUpcomingWriteupsResult> {
  const slate = await getTonightMustWatch({ date, window: 5, forceOpponentSplits: true });
  const inputs = slate.games.map((game) => upcomingWriteupInput(game, slate.leagueMeanGS));
  const inputHash = hashStableJson({ promptVersion: UPCOMING_WRITEUPS_PROMPT_VERSION, inputs });
  const previous = await readRuntimeState<UpcomingWriteupsState>(upcomingWriteupsKey(slate.date));
  if (previous?.version === UPCOMING_WRITEUPS_VERSION && previous.inputHash === inputHash && hasLlmWriteupsForGames(previous, slate.games)) {
    return { date: slate.date, generated: 0, reused: slate.games.length, fallbackCount: previous.fallbackCount, model: previous.model, stored: true };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  let fallbackCount = 0;
  const writeups: Record<string, string> = {};
  const sources: UpcomingWriteupsState["sources"] = {};
  for (const [index, game] of slate.games.entries()) {
    const fallback = upcomingSimpleContextSentence(game, index + 1, slate.leagueMeanGS);
    const input = inputs[index];
    const generated = apiKey ? await generateOneUpcomingWriteupWithRetries(apiKey, input, game, slate.leagueMeanGS).catch(() => null) : null;
    const sentence = generated ?? fallback;
    if (!generated) fallbackCount += 1;
    sources[game.gamePk] = generated ? "llm" : "fallback";
    writeups[game.gamePk] = validateUpcomingSimpleContextSentence(sentence, game, slate.leagueMeanGS) ? sentence : fallback;
    if (writeups[game.gamePk] === fallback && generated) {
      sources[game.gamePk] = "fallback";
      fallbackCount += 1;
    }
  }

  const stored = await writeRuntimeState(upcomingWriteupsKey(slate.date), {
    version: UPCOMING_WRITEUPS_VERSION,
    date: slate.date,
    inputHash,
    promptVersion: UPCOMING_WRITEUPS_PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    model: UPCOMING_WRITEUPS_MODEL,
    writeups,
    sources,
    fallbackCount,
  });

  return { date: slate.date, generated: slate.games.length - fallbackCount, reused: 0, fallbackCount, model: UPCOMING_WRITEUPS_MODEL, stored };
}

function hasLlmWriteupsForGames(state: UpcomingWriteupsState, games: TonightGame[]) {
  return games.every((game) => state.sources?.[game.gamePk] === "llm" && typeof state.writeups[game.gamePk] === "string" && state.writeups[game.gamePk].trim().length > 0);
}

async function generateOneUpcomingWriteupWithRetries(apiKey: string, input: UpcomingWriteupInput, game: TonightGame, leagueMeanGS: number) {
  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const generated = await generateOneUpcomingWriteup(apiKey, input, game, leagueMeanGS, attempt);
    if (generated) return generated;
  }
  return null;
}

async function generateOneUpcomingWriteup(apiKey: string, input: UpcomingWriteupInput, game: TonightGame, leagueMeanGS: number, attempt: number) {
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
          content: "Write one polished matchup sentence from provided baseball data only. Under 22 words. No em dash. No phrase 'this one'. Do not use numeric digits. Do not invent history, health, streaks, results, ranks, or numbers. Respect the archetype frame. Avoid formulaic phrasing like towers, clear separation, or form points.",
        },
        {
          role: "user",
          content: JSON.stringify({ ...input, attempt }),
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
  if (!validateUpcomingSimpleContextSentence(clean, game, leagueMeanGS)) return false;
  if (/\b(unhittable|dominant stretch|has been|since|streak|revenge|owns him|owned)\b/i.test(clean)) return false;
  const allowedNumbers = new Set(JSON.stringify(input).match(/\d+(?:\.\d+)?/g) ?? []);
  return (clean.match(/\d+(?:\.\d+)?/g) ?? []).every((token) => allowedNumbers.has(token));
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

function upcomingWriteupInput(game: TonightGame, leagueMeanGS: number): UpcomingWriteupInput {
  return {
    gamePk: game.gamePk,
    matchup: game.label,
    firstPitch: game.firstPitch,
    watchScore: game.gameWatchScore.toFixed(1),
    confidence: game.watchScoreConfidence,
    archetype: upcomingSimpleContextArchetype(game, leagueMeanGS),
    starters: game.starters.map((starter) => ({
      side: starter.side,
      team: starter.team,
      name: starter.name,
      band: starter.tier ?? starter.formStatus,
      form: typeof starter.rgs === "number" ? starter.rgs.toFixed(1) : null,
      trend: starter.trend,
      projectedGsPlus: typeof starter.projection?.projectedGsPlus === "number" ? starter.projection.projectedGsPlus.toFixed(1) : null,
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
  };
}

function upcomingWriteupsKey(date: string) {
  return `upcoming-writeups:v${UPCOMING_WRITEUPS_VERSION}:${date}`;
}

function hashStableJson(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24);
}
