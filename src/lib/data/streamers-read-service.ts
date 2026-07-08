import { createHash } from "node:crypto";
import { readRuntimeState, writeRuntimeState } from "@/lib/data/runtime-state-store";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { getUpcomingStreamers, type StreamerCandidate, type UpcomingStreamersResponse } from "@/lib/data/streamers-service";

type FantasyStreamingReadState = {
  version: 1;
  weekStart: string;
  inputHash: string;
  promptVersion: number;
  generatedAt: string;
  model: string;
  read: string;
  source: "llm" | "fallback";
};

type FantasyStreamingReadInput = {
  weekStart: string;
  weekEnd: string;
  twoStartPitchers: FantasyStreamingReadCandidate[];
  formRisers: FantasyStreamingReadCandidate[];
  standout: FantasyStreamingReadCandidate | null;
  caution: FantasyStreamingReadCandidate | null;
};

type FantasyStreamingReadCandidate = {
  name: string;
  team: string;
  streamScore: string;
  heatLabel: string;
  matchups: string[];
  softMatchups: number;
  parkLabels: string[];
};

type GenerateFantasyStreamingReadResult = {
  weekStart: string;
  generated: boolean;
  source: "llm" | "fallback";
  model: string;
  stored: boolean;
};

const FANTASY_STREAMING_READ_VERSION = 1;
const FANTASY_STREAMING_READ_PROMPT_VERSION = 2;
const FANTASY_STREAMING_READ_MODEL = process.env.OPENAI_MODEL_FANTASY_READ ?? "gpt-4.1-mini";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_GENERATION_MS = 5500;

export async function readFantasyStreamingRead(streamers: UpcomingStreamersResponse) {
  const input = fantasyStreamingReadInput(streamers);
  const state = await readRuntimeState<FantasyStreamingReadState>(fantasyStreamingReadKey(input.weekStart));
  if (state?.version === FANTASY_STREAMING_READ_VERSION && state.inputHash === fantasyStreamingReadInputHash(input) && state.read.trim()) {
    return state.read;
  }
  return fallbackFantasyStreamingRead(input);
}

export async function generateFantasyStreamingRead(anchorDate = getHomeSlateDate()): Promise<GenerateFantasyStreamingReadResult> {
  const streamers = await getUpcomingStreamers(anchorDate);
  const input = fantasyStreamingReadInput(streamers);
  const inputHash = fantasyStreamingReadInputHash(input);
  const previous = await readRuntimeState<FantasyStreamingReadState>(fantasyStreamingReadKey(input.weekStart));
  if (previous?.version === FANTASY_STREAMING_READ_VERSION && previous.inputHash === inputHash && previous.source === "llm" && previous.read.trim()) {
    return { weekStart: input.weekStart, generated: false, source: "llm", model: previous.model, stored: true };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const fallback = fallbackFantasyStreamingRead(input);
  const generated = apiKey ? await generateFantasyRead(apiKey, input).catch(() => null) : null;
  const read = generated ?? fallback;
  const source = generated ? "llm" : "fallback";
  const stored = await writeRuntimeState(fantasyStreamingReadKey(input.weekStart), {
    version: FANTASY_STREAMING_READ_VERSION,
    weekStart: input.weekStart,
    inputHash,
    promptVersion: FANTASY_STREAMING_READ_PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    model: FANTASY_STREAMING_READ_MODEL,
    read,
    source,
  });

  return { weekStart: input.weekStart, generated: Boolean(generated), source, model: FANTASY_STREAMING_READ_MODEL, stored };
}

async function generateFantasyRead(apiKey: string, input: FantasyStreamingReadInput) {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: FANTASY_STREAMING_READ_MODEL,
      temperature: 0.25,
      max_output_tokens: 120,
      input: [
        {
          role: "system",
          content: "Write 2 to 3 fantasy baseball streaming sentences under 60 words total from provided data only. Use sell-voice. Use the words Target and Fade or Caution. Name at least two listed pitchers when two are available. No em dash. Every number must appear in the input. Do not invent facts, rankings, injuries, history, or projections.",
        },
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
    }),
    signal: AbortSignal.timeout(MAX_GENERATION_MS),
  });
  if (!response.ok) return null;
  const payload = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  const text = normalizeGeneratedRead(extractResponseText(payload));
  return validateFantasyRead(text, input) ? text : null;
}

function fantasyStreamingReadInput(streamers: UpcomingStreamersResponse): FantasyStreamingReadInput {
  const candidates = uniqueCandidates([...streamers.twoStartPitchers, ...streamers.formRisers]);
  const standout = candidates[0] ?? null;
  const caution = [...candidates].reverse().find((candidate) => !candidate.matchupDataAvailable || candidate.matchups.some((matchup) => matchup.opponentLineupTier === "Tough")) ?? streamers.formRisers[0] ?? null;
  return {
    weekStart: streamers.range.start,
    weekEnd: streamers.range.end,
    twoStartPitchers: streamers.twoStartPitchers.slice(0, 4).map(readCandidate),
    formRisers: streamers.formRisers.slice(0, 4).map(readCandidate),
    standout: standout ? readCandidate(standout) : null,
    caution: caution ? readCandidate(caution) : null,
  };
}

function readCandidate(candidate: StreamerCandidate): FantasyStreamingReadCandidate {
  const parkLabels = Array.from(new Set(candidate.matchups.map((matchup) => matchup.parkLabel).filter(Boolean))).slice(0, 2);
  return {
    name: candidate.pitcherName,
    team: candidate.team,
    streamScore: candidate.streamScore.toFixed(1),
    heatLabel: candidate.heatLabel,
    matchups: candidate.matchups.map((matchup) => `${matchup.opponent} ${matchup.opponentLineupTier}`).slice(0, 3),
    softMatchups: candidate.matchups.filter((matchup) => matchup.opponentLineupTier === "Soft").length,
    parkLabels,
  };
}

function fallbackFantasyStreamingRead(input: FantasyStreamingReadInput) {
  const target = input.standout ?? input.twoStartPitchers[0] ?? input.formRisers[0];
  const alternate = allReadCandidates(input).find((candidate) => candidate.name !== target?.name);
  const caution = input.caution?.name !== target?.name ? input.caution : alternate;
  if (!target) return "Streaming board is still forming as probable starters lock in. Target the first confirmed soft matchup. Fade thin-data arms until the next refresh.";

  const targetCopy = `Target ${target.name}${formatReadTargetReason(target)}.`;
  if (caution) return `${targetCopy} Fade ${caution.name}${formatReadCautionReason(caution)}.`;
  return `${targetCopy} Keep the last roster spot flexible. Fade thin-data arms until another streamer separates.`;
}

function validateFantasyRead(read: string, input: FantasyStreamingReadInput) {
  if (!read || wordCount(read) > 60 || read.includes("—")) return false;
  const sentenceCount = (read.match(/[.!?]/g) ?? []).length;
  if (sentenceCount < 2 || sentenceCount > 3) return false;
  if (!/\btarget\b/i.test(read) || !/\b(fade|caution)\b/i.test(read)) return false;
  if (/\b(has been|since|streak|injury|injured|revenge|lock|must-start)\b/i.test(read)) return false;
  const allowedNumbers = new Set(JSON.stringify(input).match(/\d+(?:\.\d+)?/g) ?? []);
  if (!(read.match(/\d+(?:\.\d+)?/g) ?? []).every((token) => allowedNumbers.has(token))) return false;
  const names = new Set([...input.twoStartPitchers, ...input.formRisers].map((candidate) => candidate.name));
  const namedPitchers = [...names].filter((name) => read.includes(name.split(" ")[0]) || read.includes(name.split(" ").slice(-1)[0]));
  return namedPitchers.length >= Math.min(2, names.size);
}

function formatReadTargetReason(candidate: FantasyStreamingReadCandidate) {
  if (candidate.softMatchups > 0) return " behind a soft lineup draw";
  if (candidate.matchups.length >= 2) return " for two listed starts";
  const parkReason = formatParkReason(candidate.parkLabels, "pitcher");
  if (parkReason) return ` with ${parkReason}`;
  return ` with ${candidate.heatLabel.toLowerCase()} form`;
}

function formatReadCautionReason(candidate: FantasyStreamingReadCandidate) {
  if (candidate.matchups.some((matchup) => /\bTough\b/.test(matchup))) return " around a tough lineup draw";
  const parkReason = formatParkReason(candidate.parkLabels, "hitter");
  if (parkReason) return ` around ${parkReason}`;
  if (candidate.matchups.length === 0) return " until matchup data firms up";
  return " until the matchup edge gets clearer";
}

function formatParkReason(labels: string[], kind: "pitcher" | "hitter") {
  return labels.find((label) => label.toLowerCase().includes(kind))?.toLowerCase() ?? null;
}

function allReadCandidates(input: FantasyStreamingReadInput) {
  const byName = new Map<string, FantasyStreamingReadCandidate>();
  for (const candidate of [...input.twoStartPitchers, ...input.formRisers]) {
    byName.set(candidate.name, candidate);
  }
  return [...byName.values()];
}

function uniqueCandidates(candidates: StreamerCandidate[]) {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.pitcherId)) return false;
    seen.add(candidate.pitcherId);
    return true;
  });
}

function normalizeGeneratedRead(value: string) {
  return value.replace(/[“”"]/g, "").replace(/\s+/g, " ").trim();
}

function extractResponseText(payload: { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }) {
  if (typeof payload.output_text === "string") return payload.output_text.trim();
  return payload.output?.flatMap((item) => item.content ?? []).map((content) => content.text ?? "").join(" ").trim() ?? "";
}

function fantasyStreamingReadInputHash(input: FantasyStreamingReadInput) {
  return createHash("sha256").update(JSON.stringify({ promptVersion: FANTASY_STREAMING_READ_PROMPT_VERSION, input })).digest("hex").slice(0, 24);
}

function fantasyStreamingReadKey(weekStart: string) {
  return `fantasy-streaming-read:v${FANTASY_STREAMING_READ_VERSION}:${weekStart}`;
}

function wordCount(value: string) {
  return value.split(/\s+/).filter(Boolean).length;
}
