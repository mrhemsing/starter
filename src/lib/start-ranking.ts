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
  return [...starts].sort(compareRankedStarts).map((start, index) => {
    const { rank: _staleRank, ...rest } = start;
    void _staleRank;
    return { ...rest, rank: index + 1 } as T & { rank: number };
  });
}

export function validateRankedStartOrder(starts: StartSummary[]) {
  const expected = rankStarts(starts);
  const issues = starts.flatMap((start, index) => {
    const expectedStart = expected[index];
    if (!expectedStart) return [`unexpected start ${start.id} at index ${index}`];
    const messages: string[] = [];
    if (start.id !== expectedStart.id) {
      messages.push(`order ${index + 1} expected ${expectedStart.id} (${expectedStart.gameScorePlus}) but found ${start.id} (${start.gameScorePlus})`);
    }
    if (start.rank !== index + 1) {
      messages.push(`${start.id} rank ${start.rank} must equal display position ${index + 1}`);
    }
    return messages;
  });
  if (issues.length > 0) {
    throw new Error(`ranked start order invariant failed: ${issues.join("; ")}`);
  }
}
