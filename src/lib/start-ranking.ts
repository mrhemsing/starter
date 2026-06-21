import { inningsFromIP } from "@/lib/innings";
import type { StartSummary } from "@/lib/types";

type RankableStart = Pick<StartSummary, "date" | "line" | "gameScorePlus"> & {
  gamePk?: number;
  pitcher?: Pick<StartSummary["pitcher"], "name">;
};

export function compareRankedStarts(a: RankableStart, b: RankableStart) {
  return (
    b.gameScorePlus - a.gameScorePlus ||
    inningsFromIP(b.line.inningsPitched) - inningsFromIP(a.line.inningsPitched) ||
    a.line.earnedRuns - b.line.earnedRuns ||
    b.line.strikeouts - a.line.strikeouts ||
    a.line.walks - b.line.walks ||
    a.line.hits - b.line.hits ||
    a.date.localeCompare(b.date) ||
    (a.gamePk ?? 0) - (b.gamePk ?? 0) ||
    (a.pitcher?.name ?? "").localeCompare(b.pitcher?.name ?? "")
  );
}

export function rankStarts<T extends StartSummary>(starts: T[]) {
  return [...starts].sort(compareRankedStarts).map((start, index) => ({ ...start, rank: index + 1 }));
}
