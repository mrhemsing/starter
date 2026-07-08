import { createHash } from "node:crypto";
import { readRuntimeState, writeRuntimeState } from "@/lib/data/runtime-state-store";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { getUpcomingStreamers, type StreamerCandidate, type UpcomingStreamersResponse } from "@/lib/data/streamers-service";
import { formatUpcomingDate } from "@/lib/routes";

export type FantasyCoachTierKey = "must-start" | "solid-streamer" | "matchup-dependent" | "fade-despite-rank";

export type FantasyCoachArm = {
  pitcherId: string;
  name: string;
  team: string;
  href: string;
  reason: string;
};

export type FantasyCoachTier = {
  key: FantasyCoachTierKey;
  label: "MUST START" | "SOLID STREAMER" | "MATCHUP DEPENDENT / RISKY" | "FADE DESPITE THE RANK";
  arms: FantasyCoachArm[];
};

export type FantasyCoachCallout = FantasyCoachArm & {
  sentence: string;
};

export type FantasyCoachContent = {
  version: 2;
  weekStart: string;
  weekEnd: string;
  tiers: FantasyCoachTier[];
  trap: FantasyCoachCallout | null;
  sleeper: FantasyCoachCallout | null;
  weeklyPlan: string[];
  midweekNote: string | null;
  source: "llm" | "fallback";
};

type FantasyCoachState = {
  version: 2;
  weekStart: string;
  inputHash: string;
  promptVersion: number;
  generatedAt: string;
  model: string;
  coach: FantasyCoachContent;
  source: "llm" | "fallback";
};

type FantasyCoachInput = {
  weekStart: string;
  weekEnd: string;
  twoStartPitchers: FantasyCoachCandidate[];
  formRisers: FantasyCoachCandidate[];
};

type FantasyCoachCandidate = {
  pitcherId: string;
  name: string;
  team: string;
  href: string;
  streamScore: string;
  heatLabel: string;
  heatBand: "onfire" | "hot" | null;
  trendDelta: string;
  formScore: string;
  matchupScore: string;
  parkScore: string;
  matchupDataAvailable: boolean;
  softMatchups: number;
  toughMatchups: number;
  hitterParks: number;
  pitcherParks: number;
  matchups: Array<{
    date: string;
    opponent: string;
    lineupTier: "Soft" | "Neutral" | "Tough" | "Pending";
    parkLabel: string;
    parkFactor: string;
  }>;
};

type GenerateFantasyStreamingReadResult = {
  weekStart: string;
  generated: boolean;
  source: "llm" | "fallback";
  model: string;
  stored: boolean;
};

const FANTASY_STREAMING_READ_VERSION = 2;
const FANTASY_STREAMING_READ_PROMPT_VERSION = 3;
const FANTASY_STREAMING_READ_MODEL = process.env.OPENAI_MODEL_FANTASY_READ ?? "gpt-4.1-mini";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_GENERATION_MS = 5500;

export async function readFantasyCoach(streamers: UpcomingStreamersResponse) {
  const input = fantasyCoachInput(streamers);
  const state = await readRuntimeState<FantasyCoachState>(fantasyStreamingReadKey(input.weekStart));
  if (state?.version === FANTASY_STREAMING_READ_VERSION && state.inputHash === fantasyCoachInputHash(input) && validateFantasyCoach(state.coach, input)) {
    return state.coach;
  }
  return fallbackFantasyCoach(input);
}

export async function readFantasyStreamingRead(streamers: UpcomingStreamersResponse) {
  const coach = await readFantasyCoach(streamers);
  const firstTierArm = coach.tiers.flatMap((tier) => tier.arms)[0];
  if (firstTierArm) return `${firstTierArm.name}: ${firstTierArm.reason}. ${coach.midweekNote ?? coach.weeklyPlan[0] ?? ""}`.trim();
  return coach.midweekNote ?? "Two-start pitchers confirm midweek. Check back as probables are announced.";
}

export async function generateFantasyStreamingRead(anchorDate = getHomeSlateDate()): Promise<GenerateFantasyStreamingReadResult> {
  const streamers = await getUpcomingStreamers(anchorDate);
  const input = fantasyCoachInput(streamers);
  const inputHash = fantasyCoachInputHash(input);
  const previous = await readRuntimeState<FantasyCoachState>(fantasyStreamingReadKey(input.weekStart));
  if (previous?.version === FANTASY_STREAMING_READ_VERSION && previous.inputHash === inputHash && previous.source === "llm" && validateFantasyCoach(previous.coach, input)) {
    return { weekStart: input.weekStart, generated: false, source: "llm", model: previous.model, stored: true };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const fallback = fallbackFantasyCoach(input);
  const generated = apiKey ? await generateFantasyCoach(apiKey, input).catch(() => null) : null;
  const coach = generated ?? fallback;
  const source = generated ? "llm" : "fallback";
  const stored = await writeRuntimeState(fantasyStreamingReadKey(input.weekStart), {
    version: FANTASY_STREAMING_READ_VERSION,
    weekStart: input.weekStart,
    inputHash,
    promptVersion: FANTASY_STREAMING_READ_PROMPT_VERSION,
    generatedAt: new Date().toISOString(),
    model: FANTASY_STREAMING_READ_MODEL,
    coach: { ...coach, source },
    source,
  });

  console.info("[fantasy-coach]", { weekStart: input.weekStart, source, fallback: !generated });
  return { weekStart: input.weekStart, generated: Boolean(generated), source, model: FANTASY_STREAMING_READ_MODEL, stored };
}

async function generateFantasyCoach(apiKey: string, input: FantasyCoachInput) {
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: FANTASY_STREAMING_READ_MODEL,
      temperature: 0.2,
      max_output_tokens: 700,
      input: [
        {
          role: "system",
          content: "Return strict JSON for fantasy baseball coach content from provided data only. Include tiered verdicts, optional trap, optional sleeper, and weeklyPlan when two-start pitchers exist. Reasons are one short clause. No em dash. Every number must appear in the input. Every name must appear in the input. Do not invent injuries, weather, history, roles, or projections.",
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
  const parsed = parseGeneratedCoach(extractResponseText(payload), input);
  return parsed && validateFantasyCoach(parsed, input) ? parsed : null;
}

function fallbackFantasyCoach(input: FantasyCoachInput): FantasyCoachContent {
  const candidates = allCoachCandidates(input);
  const used = new Set<string>();
  const mustStart = candidates.filter((candidate) => candidate.streamScoreValue >= 60 && candidate.softMatchups > 0 && candidate.matchupDataAvailable).slice(0, 4);
  mustStart.forEach((candidate) => used.add(candidate.pitcherId));
  const solid = candidates.filter((candidate) => !used.has(candidate.pitcherId) && candidate.streamScoreValue >= 52 && candidate.toughMatchups === 0).slice(0, 4);
  solid.forEach((candidate) => used.add(candidate.pitcherId));
  const risky = candidates.filter((candidate) => !used.has(candidate.pitcherId) && hasRiskSignal(candidate)).slice(0, 4);
  risky.forEach((candidate) => used.add(candidate.pitcherId));
  const fade = candidates.filter((candidate) => hasRiskSignal(candidate) && candidate.streamScoreValue >= 50).slice(0, 4);
  const trapCandidate = candidates.find((candidate) => hasRiskSignal(candidate) && candidate.streamScoreValue >= 50) ?? null;
  const sleeperCandidate = candidates.find((candidate, index) => index >= 3 && candidate.softMatchups > 0 && candidate.heatBand) ?? null;

  return {
    version: FANTASY_STREAMING_READ_VERSION,
    weekStart: input.weekStart,
    weekEnd: input.weekEnd,
    tiers: [
      tier("must-start", "MUST START", mustStart.length ? mustStart.map((candidate) => arm(candidate, targetReason(candidate))) : candidates.slice(0, 1).map((candidate) => arm(candidate, targetReason(candidate)))),
      tier("solid-streamer", "SOLID STREAMER", solid.map((candidate) => arm(candidate, solidReason(candidate)))),
      tier("matchup-dependent", "MATCHUP DEPENDENT / RISKY", risky.map((candidate) => arm(candidate, riskReason(candidate)))),
      tier("fade-despite-rank", "FADE DESPITE THE RANK", fade.map((candidate) => arm(candidate, riskReason(candidate)))),
    ].filter((candidateTier) => candidateTier.arms.length > 0),
    trap: trapCandidate ? callout(trapCandidate, "THE TRAP", riskReason(trapCandidate)) : null,
    sleeper: sleeperCandidate ? callout(sleeperCandidate, "THE SLEEPER", targetReason(sleeperCandidate)) : null,
    weeklyPlan: input.twoStartPitchers.length ? fallbackWeeklyPlan(input) : [],
    midweekNote: input.twoStartPitchers.length ? null : "Two-start pitchers confirm midweek. Check back as probables are announced.",
    source: "fallback",
  };
}

function fantasyCoachInput(streamers: UpcomingStreamersResponse): FantasyCoachInput {
  return {
    weekStart: streamers.range.start,
    weekEnd: streamers.range.end,
    twoStartPitchers: streamers.twoStartPitchers.slice(0, 8).map(readCandidate),
    formRisers: streamers.formRisers.slice(0, 10).map(readCandidate),
  };
}

function readCandidate(candidate: StreamerCandidate): FantasyCoachCandidate {
  return {
    pitcherId: candidate.pitcherId,
    name: candidate.pitcherName,
    team: candidate.team,
    href: candidate.pitcherHref,
    streamScore: candidate.streamScore.toFixed(1),
    heatLabel: candidate.heatLabel,
    heatBand: candidate.heatBand,
    trendDelta: candidate.trendDelta.toFixed(1),
    formScore: candidate.components.form.toFixed(1),
    matchupScore: candidate.components.matchup.toFixed(1),
    parkScore: candidate.components.park.toFixed(1),
    matchupDataAvailable: candidate.matchupDataAvailable,
    softMatchups: candidate.matchups.filter((matchup) => matchup.opponentLineupTier === "Soft").length,
    toughMatchups: candidate.matchups.filter((matchup) => matchup.opponentLineupTier === "Tough").length,
    hitterParks: candidate.matchups.filter((matchup) => matchup.parkLabel.toLowerCase().includes("hitter")).length,
    pitcherParks: candidate.matchups.filter((matchup) => matchup.parkLabel.toLowerCase().includes("pitcher")).length,
    matchups: candidate.matchups.map((matchup) => ({
      date: matchup.date,
      opponent: matchup.opponent,
      lineupTier: matchup.opponentLineupTier,
      parkLabel: matchup.parkLabel,
      parkFactor: matchup.parkFactor.toFixed(2),
    })),
  };
}

function tier(key: FantasyCoachTierKey, label: FantasyCoachTier["label"], arms: FantasyCoachArm[]): FantasyCoachTier {
  return { key, label, arms };
}

function arm(candidate: FantasyCoachCandidate & { streamScoreValue?: number }, reason: string): FantasyCoachArm {
  return {
    pitcherId: candidate.pitcherId,
    name: candidate.name,
    team: candidate.team,
    href: candidate.href,
    reason,
  };
}

function callout(candidate: FantasyCoachCandidate & { streamScoreValue?: number }, label: "THE TRAP" | "THE SLEEPER", reason: string): FantasyCoachCallout {
  const prefix = label === "THE TRAP" ? "Fade" : "Grab";
  return {
    ...arm(candidate, reason),
    sentence: `${label}: ${prefix} ${candidate.name} because ${reason.toLowerCase()}.`,
  };
}

function fallbackWeeklyPlan(input: FantasyCoachInput) {
  const anchors = input.twoStartPitchers.slice(0, 2);
  const first = anchors[0];
  if (!first) return [];
  const starts = first.matchups.map((matchup) => formatUpcomingDate(matchup.date)).slice(0, 2).join(" and ");
  const sentences = [`Anchor with ${first.name}${starts ? ` on ${starts}` : ""}.`];
  const second = anchors[1];
  if (second) sentences.push(`Use ${second.name} as the second two-start play.`);
  const risky = allCoachCandidates(input).find(hasRiskSignal);
  if (risky) sentences.push(`Avoid ${risky.name} where ${riskReason(risky).toLowerCase()}.`);
  return sentences.slice(0, 5);
}

function targetReason(candidate: FantasyCoachCandidate) {
  if (candidate.softMatchups > 0 && candidate.heatBand) return "soft lineup plus hot form";
  if (candidate.softMatchups > 0) return "soft lineup draw";
  if (candidate.matchups.length >= 2) return "two confirmed starts";
  if (candidate.pitcherParks > 0) return "pitcher park support";
  return `${candidate.heatLabel.toLowerCase()} form`;
}

function solidReason(candidate: FantasyCoachCandidate) {
  if (candidate.matchups.length >= 2) return "extra volume with playable context";
  if (candidate.pitcherParks > 0) return "park context helps the stream";
  return "score and form are playable";
}

function riskReason(candidate: FantasyCoachCandidate) {
  if (!candidate.matchupDataAvailable) return "matchup data is still thin";
  if (candidate.toughMatchups > 0) return "a tough lineup is attached";
  if (candidate.hitterParks > 0) return "hitter park context raises risk";
  return "the edge is matchup dependent";
}

function hasRiskSignal(candidate: FantasyCoachCandidate) {
  return !candidate.matchupDataAvailable || candidate.toughMatchups > 0 || candidate.hitterParks > 0;
}

function validateFantasyCoach(coach: FantasyCoachContent, input: FantasyCoachInput) {
  if (!coach || coach.version !== FANTASY_STREAMING_READ_VERSION || coach.weekStart !== input.weekStart || coach.weekEnd !== input.weekEnd) return false;
  const candidates = allCoachCandidates(input);
  const candidateIds = new Set(candidates.map((candidate) => candidate.pitcherId));
  const candidateNames = new Set(candidates.map((candidate) => candidate.name));
  const allowedNumbers = new Set(JSON.stringify(input).match(/\d+(?:\.\d+)?/g) ?? []);
  const strings = [
    ...coach.tiers.flatMap((candidateTier) => candidateTier.arms.map((candidate) => `${candidate.name} ${candidate.reason}`)),
    coach.trap?.sentence ?? "",
    coach.sleeper?.sentence ?? "",
    ...coach.weeklyPlan,
    coach.midweekNote ?? "",
  ];
  if (strings.some((value) => value.includes("—") || /\b(injury|injured|revenge|lock)\b/i.test(value))) return false;
  if (!strings.every((value) => (value.match(/\d+(?:\.\d+)?/g) ?? []).every((token) => allowedNumbers.has(token)))) return false;
  if (!coach.tiers.every((candidateTier) => candidateTier.arms.length >= 1 && candidateTier.arms.length <= 4 && candidateTier.arms.every((candidate) => candidateIds.has(candidate.pitcherId) && candidateNames.has(candidate.name)))) return false;
  const fadeTier = coach.tiers.find((candidateTier) => candidateTier.key === "fade-despite-rank");
  if (fadeTier && !fadeTier.arms.every((candidate) => hasRiskSignalById(candidate.pitcherId, candidates))) return false;
  if (coach.trap && !hasRiskSignalById(coach.trap.pitcherId, candidates)) return false;
  if (coach.sleeper && !candidateIds.has(coach.sleeper.pitcherId)) return false;
  if (input.twoStartPitchers.length > 0 && (coach.weeklyPlan.length < 1 || coach.weeklyPlan.length > 5 || wordCount(coach.weeklyPlan.join(" ")) > 90)) return false;
  if (input.twoStartPitchers.length === 0 && !coach.midweekNote?.includes("Two-start pitchers confirm midweek")) return false;
  return true;
}

function hasRiskSignalById(pitcherId: string, candidates: FantasyCoachCandidate[]) {
  const candidate = candidates.find((item) => item.pitcherId === pitcherId);
  return candidate ? hasRiskSignal(candidate) : false;
}

function allCoachCandidates(input: FantasyCoachInput) {
  const byPitcher = new Map<string, FantasyCoachCandidate & { streamScoreValue: number }>();
  for (const candidate of [...input.twoStartPitchers, ...input.formRisers]) {
    byPitcher.set(candidate.pitcherId, { ...candidate, streamScoreValue: Number(candidate.streamScore) });
  }
  return [...byPitcher.values()].sort((a, b) => b.streamScoreValue - a.streamScoreValue || b.matchups.length - a.matchups.length || a.name.localeCompare(b.name));
}

function parseGeneratedCoach(text: string, input: FantasyCoachInput): FantasyCoachContent | null {
  try {
    const parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim()) as Partial<FantasyCoachContent>;
    return {
      version: FANTASY_STREAMING_READ_VERSION,
      weekStart: input.weekStart,
      weekEnd: input.weekEnd,
      tiers: Array.isArray(parsed.tiers) ? parsed.tiers : [],
      trap: parsed.trap ?? null,
      sleeper: parsed.sleeper ?? null,
      weeklyPlan: Array.isArray(parsed.weeklyPlan) ? parsed.weeklyPlan : [],
      midweekNote: parsed.midweekNote ?? (input.twoStartPitchers.length ? null : "Two-start pitchers confirm midweek. Check back as probables are announced."),
      source: "llm",
    };
  } catch {
    return null;
  }
}

function extractResponseText(payload: { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> }) {
  if (typeof payload.output_text === "string") return payload.output_text.trim();
  return payload.output?.flatMap((item) => item.content ?? []).map((content) => content.text ?? "").join(" ").trim() ?? "";
}

function fantasyCoachInputHash(input: FantasyCoachInput) {
  return createHash("sha256").update(JSON.stringify({ promptVersion: FANTASY_STREAMING_READ_PROMPT_VERSION, input })).digest("hex").slice(0, 24);
}

function fantasyStreamingReadKey(weekStart: string) {
  return `fantasy-streaming-read:v${FANTASY_STREAMING_READ_VERSION}:${weekStart}`;
}

function wordCount(value: string) {
  return value.split(/\s+/).filter(Boolean).length;
}
