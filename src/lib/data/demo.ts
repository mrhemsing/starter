import type { PitchEvent, PitcherDetail, PitchResultKey, PitchTypeKey, ProbableStart, StartDetail, StartSummary } from "@/lib/types";

const skenesHeadshot = "https://img.mlbstatic.com/mlb-photos/image/upload/w_360,q_auto:best/v1/people/694973/headshot/67/current";

export const demoSlateStarts: StartSummary[] = [
  {
    id: "2026-05-23-pit-chc-694973",
    gamePk: 776001,
    date: "2026-05-23",
    rank: 1,
    pitcher: {
      id: "694973",
      mlbId: 694973,
      name: "Paul Skenes",
      team: "PIT",
      throws: "R",
      headshotUrl: skenesHeadshot,
    },
    opponent: "CHC",
    result: "W",
    line: { inningsPitched: 7, hits: 3, earnedRuns: 1, walks: 1, strikeouts: 11, pitches: 95 },
    gameScorePlus: 78,
    teamColor: "#27251f",
    accentColor: "#fdb827",
    context: { label: "11 K, 0 extra-base hits allowed", whiffDeltaPct: 8.4, velocityDeltaMph: 0.7, parkRunFactor: 1.04, parkLabel: "Wrigley Field run environment", opponentQualityRunValue: 1.1, opponentQualityLabel: "CHC schedule opponent quality", opponentOffenseRunValue: 0.8, opponentOffenseLabel: "CHC fixture offense context: above-average run environment." },
  },
  {
    id: "2026-05-23-det-cle-669373",
    gamePk: 776002,
    date: "2026-05-23",
    rank: 2,
    pitcher: {
      id: "669373",
      mlbId: 669373,
      name: "Tarik Skubal",
      team: "DET",
      throws: "L",
      headshotUrl: "https://img.mlbstatic.com/mlb-photos/image/upload/w_360,q_auto:best/v1/people/669373/headshot/67/current",
    },
    opponent: "CLE",
    result: "W",
    line: { inningsPitched: 6.2, hits: 4, earnedRuns: 0, walks: 1, strikeouts: 9, pitches: 91 },
    gameScorePlus: 74,
    teamColor: "#0c2340",
    accentColor: "#fa4616",
    context: { label: "Fastball played up all night", whiffDeltaPct: 5.1, velocityDeltaMph: 0.3, parkRunFactor: 0.98, parkLabel: "Comerica Park run environment", opponentQualityRunValue: -0.4, opponentQualityLabel: "CLE schedule opponent quality", opponentOffenseRunValue: -0.3, opponentOffenseLabel: "CLE fixture offense context: slightly lighter run profile." },
  },
  {
    id: "2026-05-23-phi-atl-554430",
    gamePk: 776003,
    date: "2026-05-23",
    rank: 3,
    pitcher: {
      id: "554430",
      mlbId: 554430,
      name: "Zack Wheeler",
      team: "PHI",
      throws: "R",
      headshotUrl: "https://img.mlbstatic.com/mlb-photos/image/upload/w_360,q_auto:best/v1/people/554430/headshot/67/current",
    },
    opponent: "ATL",
    result: "ND",
    line: { inningsPitched: 7, hits: 5, earnedRuns: 2, walks: 0, strikeouts: 8, pitches: 98 },
    gameScorePlus: 69,
    teamColor: "#e81828",
    accentColor: "#002d72",
    context: { label: "No walks against a top-order test", whiffDeltaPct: 2.7, velocityDeltaMph: -0.1, parkRunFactor: 1.01, parkLabel: "Citizens Bank Park run environment", opponentQualityRunValue: 2.2, opponentQualityLabel: "ATL schedule opponent quality", opponentOffenseRunValue: 1.9, opponentOffenseLabel: "ATL fixture offense context: strong lineup pressure." },
  },
];

export const demoProbableStarts: ProbableStart[] = [
  { id: "2026-05-24-lad-sf-yamamoto", gamePk: 776101, date: "2026-05-24", pitcherId: "808967", pitcherMlbId: 808967, pitcherName: "Yamamoto", team: "LAD", opponent: "SF", status: "Warming", matchupScore: 82, parkAdjustment: 3 },
  { id: "2026-05-24-ari-nyy-burnes", gamePk: 776102, date: "2026-05-24", pitcherId: "669203", pitcherMlbId: 669203, pitcherName: "Burnes", team: "ARI", opponent: "NYY", status: "7:05 PM ET", matchupScore: 76, parkAdjustment: -1 },
  { id: "2026-05-24-sea-tex-gilbert", gamePk: 776103, date: "2026-05-24", pitcherId: "669302", pitcherMlbId: 669302, pitcherName: "Gilbert", team: "SEA", opponent: "TEX", status: "9:40 PM ET", matchupScore: 71, parkAdjustment: 1 },
];

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateDemoPitches(): PitchEvent[] {
  const rand = mulberry32(42);
  const pitches: PitchEvent[] = [];
  const mix = [
    { type: "FF" as const, count: 38, vMin: 98, vMax: 101, xMu: 0, zMu: 2.8, spread: 0.6 },
    { type: "SL" as const, count: 28, vMin: 89, vMax: 93, xMu: 0.6, zMu: 2.1, spread: 0.5 },
    { type: "CH" as const, count: 14, vMin: 87, vMax: 90, xMu: -0.4, zMu: 1.6, spread: 0.7 },
    { type: "SI" as const, count: 9, vMin: 96, vMax: 99, xMu: -0.7, zMu: 2.4, spread: 0.5 },
    { type: "CU" as const, count: 6, vMin: 82, vMax: 85, xMu: 0, zMu: 1.4, spread: 0.8 },
  ];
  const pitchesPerInning = [14, 12, 11, 15, 13, 16, 14];
  const resultDist: Record<PitchTypeKey, Record<PitchResultKey, number>> = {
    FF: { swinging_strike: 0.18, called_strike: 0.22, foul: 0.2, ball: 0.3, hit_into_play: 0.1 },
    SL: { swinging_strike: 0.32, called_strike: 0.14, foul: 0.16, ball: 0.3, hit_into_play: 0.08 },
    CH: { swinging_strike: 0.28, called_strike: 0.1, foul: 0.18, ball: 0.34, hit_into_play: 0.1 },
    SI: { swinging_strike: 0.1, called_strike: 0.2, foul: 0.18, ball: 0.32, hit_into_play: 0.2 },
    CU: { swinging_strike: 0.2, called_strike: 0.18, foul: 0.14, ball: 0.38, hit_into_play: 0.1 },
    FC: { swinging_strike: 0.18, called_strike: 0.18, foul: 0.18, ball: 0.34, hit_into_play: 0.12 },
  };

  let pitchNumber = 1;
  let inning = 1;
  let pitchInInning = 0;
  let balls = 0;
  let strikes = 0;

  function pickResult(type: PitchTypeKey): PitchResultKey {
    const r = rand();
    let acc = 0;
    for (const [result, probability] of Object.entries(resultDist[type])) {
      acc += probability;
      if (r < acc) return result as PitchResultKey;
    }
    return "ball";
  }

  for (const m of mix) {
    for (let i = 0; i < m.count; i += 1) {
      if (pitchInInning >= (pitchesPerInning[inning - 1] || 14) && inning < 7) {
        inning += 1;
        pitchInInning = 0;
      }
      pitchInInning += 1;
      const plateX = m.xMu + (rand() - 0.5) * 2 * m.spread + (rand() - 0.5) * 0.4;
      const plateZ = m.zMu + (rand() - 0.5) * 2 * m.spread + (rand() - 0.5) * 0.4;
      const velocityMph = m.vMin + rand() * (m.vMax - m.vMin);
      const result = pickResult(m.type);
      pitches.push({
        id: `pitch-${pitchNumber}`,
        gamePk: 776001,
        pitchNumber,
        count: { balls, strikes },
        type: m.type,
        velocityMph: Number(velocityMph.toFixed(1)),
        plateX: Number(plateX.toFixed(2)),
        plateZ: Number(plateZ.toFixed(2)),
        result,
        inning,
      });
      if (result === "ball") balls += 1;
      if (["called_strike", "swinging_strike", "foul"].includes(result) && strikes < 2) strikes += 1;
      if (result === "hit_into_play" || balls >= 4 || strikes >= 3) {
        balls = 0;
        strikes = 0;
      }
      pitchNumber += 1;
    }
  }

  return pitches.sort((a, b) => a.pitchNumber - b.pitchNumber).map((pitch, index) => ({ ...pitch, id: `pitch-${index + 1}`, pitchNumber: index + 1 }));
}

export const demoStartDetail: StartDetail = {
  ...demoSlateStarts[0],
  game: {
    gamePk: 776001,
    date: "2026-05-23",
    awayTeam: { abbreviation: "PIT", name: "Pittsburgh Pirates", color: "#27251f", accentColor: "#fdb827" },
    homeTeam: { abbreviation: "CHC", name: "Chicago Cubs", color: "#0e3386", accentColor: "#cc3433" },
    venue: "Wrigley Field",
    status: "final",
  },
  arsenal: [
    { type: "FF", usagePct: 40, avgVelocityMph: 99.4, whiffPct: 18, calledStrikePct: 22 },
    { type: "SL", usagePct: 29, avgVelocityMph: 91.1, whiffPct: 32, calledStrikePct: 14 },
    { type: "CH", usagePct: 15, avgVelocityMph: 88.3, whiffPct: 28, calledStrikePct: 10 },
    { type: "SI", usagePct: 10, avgVelocityMph: 97.2, whiffPct: 10, calledStrikePct: 20 },
    { type: "CU", usagePct: 6, avgVelocityMph: 83.4, whiffPct: 20, calledStrikePct: 18 },
  ],
  pitchEvents: generateDemoPitches(),
};

export const demoPitcherDetail: PitcherDetail = {
  ...demoStartDetail.pitcher,
  seasonLine: {
    starts: 10,
    inningsPitched: 64.2,
    era: 2.18,
    strikeouts: 82,
    walks: 15,
  },
  arsenal: demoStartDetail.arsenal,
  starts: demoSlateStarts.map((start) => ({
    id: start.id,
    date: start.date,
    opponent: start.opponent,
    result: start.result,
    line: start.line,
    gameScorePlus: start.gameScorePlus,
  })),
};
