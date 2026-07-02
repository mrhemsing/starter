import { inningsFromIP } from "@/lib/innings";
import type { StartLine } from "@/lib/types";

const GAME_SCORE_V2_BASELINE = 40;
const GAME_SCORE_V2_OUT_VALUE = 2;
const GAME_SCORE_V2_STRIKEOUT_VALUE = 1;
const GAME_SCORE_V2_WALK_PENALTY = 2;
const GAME_SCORE_V2_HIT_PENALTY = 2;
const GAME_SCORE_V2_RUN_PENALTY = 3;
const GAME_SCORE_V2_HOME_RUN_PENALTY = 6;

export type GameScoreV2Inputs = StartLine & {
  runsAllowed?: number;
  homeRunsAllowed?: number;
};

export function calculateGameScoreV2(line: GameScoreV2Inputs) {
  const outs = Math.round(inningsFromIP(line.inningsPitched) * 3);
  const runsAllowed = line.runsAllowed ?? line.earnedRuns;
  const homeRunsAllowed = line.homeRunsAllowed ?? 0;

  return Math.round(
    GAME_SCORE_V2_BASELINE
    + outs * GAME_SCORE_V2_OUT_VALUE
    + line.strikeouts * GAME_SCORE_V2_STRIKEOUT_VALUE
    - line.walks * GAME_SCORE_V2_WALK_PENALTY
    - line.hits * GAME_SCORE_V2_HIT_PENALTY
    - runsAllowed * GAME_SCORE_V2_RUN_PENALTY
    - homeRunsAllowed * GAME_SCORE_V2_HOME_RUN_PENALTY,
  );
}
