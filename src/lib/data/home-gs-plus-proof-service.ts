import { readRuntimeState, writeRuntimeState } from "@/lib/data/runtime-state-store";
import { getArchivedSeasonStartSummaries, getHomeSlateDate } from "@/lib/data/start-service";
import { startPath } from "@/lib/routes";
import type { StartApiGameScorePlusComponent, StartSummary } from "@/lib/types";

export type HomeGsPlusProofStart = {
  id: string;
  pitcherName: string;
  team: string;
  opponent: string;
  date: string;
  line: string;
  gsPlus: number;
  href: string;
  parkValue: number;
  opponentValue: number;
  contextValue: number;
};

export type HomeGsPlusStuffProof = {
  start: HomeGsPlusProofStart;
  whiffValue: number;
  velocityValue: number;
  totalStuffValue: number;
  whiffDescription: string;
  velocityDescription: string;
};

export type HomeGsPlusProofs = {
  version: 1;
  generatedAt: string;
  source: "cron" | "fallback";
  contextPair: [HomeGsPlusProofStart, HomeGsPlusProofStart];
  stuff: HomeGsPlusStuffProof;
  breakdown: HomeGsPlusProofStart;
  selectionNote: string;
};

type HomeGsPlusProofState = HomeGsPlusProofs & {
  anchorDate: string;
};

const HOME_GS_PLUS_PROOF_VERSION = 1;
const HOME_GS_PLUS_PROOF_KEY = `home-gs-plus-proof:v${HOME_GS_PLUS_PROOF_VERSION}`;
const HOME_GS_PLUS_PROOF_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export async function readHomeGsPlusProofs(): Promise<HomeGsPlusProofs> {
  const state = await readRuntimeState<HomeGsPlusProofState>(HOME_GS_PLUS_PROOF_KEY);
  if (state && validateHomeGsPlusProofs(state) && Date.now() - Date.parse(state.generatedAt) <= HOME_GS_PLUS_PROOF_MAX_AGE_MS) {
    return state;
  }
  return FALLBACK_HOME_GS_PLUS_PROOFS;
}

export async function generateHomeGsPlusProofs(anchorDate = getHomeSlateDate()) {
  const season = anchorDate.slice(0, 4);
  const starts = (await getArchivedSeasonStartSummaries(season))
    .filter((start) => start.date <= anchorDate && start.gameScorePlusBreakdown)
    .sort((a, b) => b.date.localeCompare(a.date));
  const recent = starts.filter((start) => daysBetween(start.date, anchorDate) <= 45);
  const selectionPool = recent.length >= 20 ? recent : starts;
  const proofs = buildHomeGsPlusProofs(selectionPool, anchorDate) ?? FALLBACK_HOME_GS_PLUS_PROOFS;
  const state: HomeGsPlusProofState = {
    ...proofs,
    version: HOME_GS_PLUS_PROOF_VERSION,
    source: proofs.source === "fallback" ? "fallback" : "cron",
    generatedAt: new Date().toISOString(),
    anchorDate,
  };
  const stored = await writeRuntimeState(HOME_GS_PLUS_PROOF_KEY, state);
  console.info("[home-gs-plus-proof]", { anchorDate, source: state.source, stored });
  return { anchorDate, stored, source: state.source };
}

function buildHomeGsPlusProofs(starts: StartSummary[], anchorDate: string): HomeGsPlusProofs | null {
  const contextPair = selectContextPair(starts);
  const stuffStart = selectStuffProofStart(starts);
  const breakdownStart = starts.find((start) => start.gameScorePlus >= 70 && start.gameScorePlusBreakdown) ?? starts.find((start) => start.gameScorePlusBreakdown);
  if (!contextPair || !stuffStart || !breakdownStart) return null;

  return {
    version: HOME_GS_PLUS_PROOF_VERSION,
    generatedAt: new Date().toISOString(),
    source: "cron",
    contextPair: [proofStart(contextPair[0]), proofStart(contextPair[1])],
    stuff: stuffProof(stuffStart),
    breakdown: proofStart(breakdownStart),
    selectionNote: `Selected from settled starts through ${anchorDate}: similar line distance, context delta, and available GS+ components.`,
  };
}

function selectContextPair(starts: StartSummary[]): [StartSummary, StartSummary] | null {
  let best: { pair: [StartSummary, StartSummary]; score: number } | null = null;
  for (let i = 0; i < starts.length; i += 1) {
    for (let j = i + 1; j < starts.length; j += 1) {
      const a = starts[i];
      const b = starts[j];
      if (!a.gameScorePlusBreakdown || !b.gameScorePlusBreakdown) continue;
      const lineDistance =
        Math.abs(a.line.inningsPitched - b.line.inningsPitched) * 4 +
        Math.abs(a.line.earnedRuns - b.line.earnedRuns) * 3 +
        Math.abs(a.line.hits - b.line.hits) +
        Math.abs(a.line.walks - b.line.walks) +
        Math.abs(a.line.strikeouts - b.line.strikeouts) * 0.7;
      const gsDiff = Math.abs(a.gameScorePlus - b.gameScorePlus);
      const contextDiff = Math.abs(contextComponentValue(a) - contextComponentValue(b));
      if (lineDistance > 4 || gsDiff < 8) continue;
      const score = gsDiff + contextDiff - lineDistance;
      if (!best || score > best.score) best = { pair: a.gameScorePlus >= b.gameScorePlus ? [a, b] : [b, a], score };
    }
  }
  return best?.pair ?? null;
}

function selectStuffProofStart(starts: StartSummary[]) {
  return [...starts]
    .filter((start) => start.gameScorePlusBreakdown)
    .sort((a, b) => stuffComponentValue(b) - stuffComponentValue(a) || b.gameScorePlus - a.gameScorePlus)[0] ?? null;
}

function proofStart(start: StartSummary): HomeGsPlusProofStart {
  const parkValue = componentValue(start, "parkContext");
  const opponentValue = componentValue(start, "opponentQuality") + componentValue(start, "opponentOffense");
  return {
    id: start.id,
    pitcherName: start.pitcher.name,
    team: start.pitcher.team,
    opponent: start.opponent,
    date: start.date,
    line: formatStartLineShort(start),
    gsPlus: start.gameScorePlus,
    href: startPath(start.id),
    parkValue,
    opponentValue,
    contextValue: parkValue + opponentValue,
  };
}

function stuffProof(start: StartSummary): HomeGsPlusStuffProof {
  const whiff = component(start, "whiffDelta");
  const velocity = component(start, "velocityDelta");
  return {
    start: proofStart(start),
    whiffValue: whiff?.value ?? 0,
    velocityValue: velocity?.value ?? 0,
    totalStuffValue: (whiff?.value ?? 0) + (velocity?.value ?? 0),
    whiffDescription: whiff?.description ?? "Whiff context from settled pitch data.",
    velocityDescription: velocity?.description ?? "Velocity context from settled pitch data.",
  };
}

function contextComponentValue(start: StartSummary) {
  return componentValue(start, "parkContext") + componentValue(start, "opponentQuality") + componentValue(start, "opponentOffense");
}

function stuffComponentValue(start: StartSummary) {
  return componentValue(start, "whiffDelta") + componentValue(start, "velocityDelta");
}

function componentValue(start: StartSummary, key: StartApiGameScorePlusComponent["key"]) {
  return component(start, key)?.value ?? 0;
}

function component(start: StartSummary, key: StartApiGameScorePlusComponent["key"]) {
  return start.gameScorePlusBreakdown?.components.find((item) => item.key === key) ?? null;
}

function formatStartLineShort(start: StartSummary) {
  return `${start.line.inningsPitched} IP, ${start.line.earnedRuns} ER, ${start.line.hits} H, ${start.line.walks} BB, ${start.line.strikeouts} K`;
}

function daysBetween(date: string, anchorDate: string) {
  return Math.round((new Date(`${anchorDate}T00:00:00.000Z`).getTime() - new Date(`${date}T00:00:00.000Z`).getTime()) / (24 * 60 * 60 * 1000));
}

function validateHomeGsPlusProofs(proofs: HomeGsPlusProofs) {
  return proofs.version === HOME_GS_PLUS_PROOF_VERSION &&
    proofs.contextPair.length === 2 &&
    proofs.contextPair.every((start) => start.id && start.href && start.line && Number.isFinite(start.gsPlus)) &&
    proofs.contextPair[0].gsPlus !== proofs.contextPair[1].gsPlus &&
    Boolean(proofs.stuff.start.id && Number.isFinite(proofs.stuff.totalStuffValue)) &&
    Boolean(proofs.breakdown.id && proofs.breakdown.href);
}

// Documented real fallback, sourced from frozen canonical start records in .data/canonical-starts.
const FALLBACK_HOME_GS_PLUS_PROOFS: HomeGsPlusProofs = {
  version: HOME_GS_PLUS_PROOF_VERSION,
  generatedAt: "2026-07-08T00:00:00.000Z",
  source: "fallback",
  contextPair: [
    {
      id: "2026-06-24-min-lad-657746",
      pitcherName: "Joe Ryan",
      team: "MIN",
      opponent: "LAD",
      date: "2026-06-24",
      line: "6 IP, 4 ER, 8 H, 1 BB, 9 K",
      gsPlus: 53,
      href: "/starts/2026-06-24-min-lad-657746",
      parkValue: 0.1,
      opponentValue: 6.5,
      contextValue: 6.6,
    },
    {
      id: "2026-06-14-hou-kc-681293",
      pitcherName: "Spencer Arrighetti",
      team: "HOU",
      opponent: "KC",
      date: "2026-06-14",
      line: "6 IP, 4 ER, 8 H, 1 BB, 7 K",
      gsPlus: 40,
      href: "/starts/2026-06-14-hou-kc-681293",
      parkValue: 0,
      opponentValue: -2.3,
      contextValue: -2.3,
    },
  ],
  stuff: {
    start: {
      id: "2026-06-02-stl-tex-669160",
      pitcherName: "Dustin May",
      team: "STL",
      opponent: "TEX",
      date: "2026-06-02",
      line: "5.2 IP, 3 ER, 5 H, 2 BB, 9 K",
      gsPlus: 53,
      href: "/starts/2026-06-02-stl-tex-669160",
      parkValue: 0,
      opponentValue: 0,
      contextValue: 0,
    },
    whiffValue: 2.9,
    velocityValue: 1.2,
    totalStuffValue: 4.1,
    whiffDescription: "+1.9 pct points above league baseline.",
    velocityDescription: "+1.4 mph above league baseline.",
  },
  breakdown: {
    id: "2026-06-30-wsh-bos-676917",
    pitcherName: "Cade Cavalli",
    team: "WSH",
    opponent: "BOS",
    date: "2026-06-30",
    line: "7 IP, 0 ER, 3 H, 0 BB, 13 K",
    gsPlus: 76,
    href: "/starts/2026-06-30-wsh-bos-676917",
    parkValue: 0,
    opponentValue: 0,
    contextValue: 0,
  },
  selectionNote: "Fallback examples are real frozen canonical starts used only when the cron-selected proof packet is unavailable or stale.",
};
