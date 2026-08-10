import { readCanonicalSlateCounts } from "@/lib/data/canonical-start-store";
import { fetchMlbSchedule } from "@/lib/data/mlb-stats-client";
import { addDays, getHomeSlateDate } from "@/lib/data/start-service";

type CompletionState = { date: string; totalGames: number; completedStarts: number };

export async function detectRecentSettledSlateGaps(
  today = getHomeSlateDate(),
  readState: (date: string, today: string) => Promise<CompletionState> = readCountOnlySettledState,
) {
  const dates = Array.from({ length: 7 }, (_, index) => addDays(today, -(index + 1)));
  const states = await Promise.all(dates.map((date) => readState(date, today)));

  return states
    .filter((state) => state.totalGames > 0 && state.completedStarts === 0)
    .map((state) => ({
      date: state.date,
      scheduledGames: state.totalGames,
      storedStarts: state.completedStarts,
    }));
}

async function readCountOnlySettledState(date: string): Promise<CompletionState> {
  const [schedule, canonicalState] = await Promise.all([
    fetchMlbSchedule(date, { fetchLive: true }),
    readCanonicalSlateCounts(date),
  ]);
  return {
    date,
    totalGames: schedule.games.length,
    completedStarts: canonicalState?.finalStarts ?? 0,
  };
}

export async function logRecentSettledSlateGaps() {
  const gaps = await detectRecentSettledSlateGaps();
  if (gaps.length > 0) {
    console.error("[settled-slate-integrity] scheduled slate has zero stored starts", {
      lookbackDays: 7,
      gaps,
    });
  }

  return gaps;
}
