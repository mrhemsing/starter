import { addDays, getHomeSlateDate, getRankedSlateCompletionState } from "@/lib/data/start-service";

type CompletionState = Awaited<ReturnType<typeof getRankedSlateCompletionState>>;

export async function detectRecentSettledSlateGaps(
  today = getHomeSlateDate(),
  readState: (date: string, today: string) => Promise<CompletionState> = getRankedSlateCompletionState,
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
