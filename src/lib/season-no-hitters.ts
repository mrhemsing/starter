import data from "@/data/season-no-hitters-2026.json";
import type { FrozenSeasonReview } from "@/lib/season-review-data";
import type { StartSummary, StartNarrativeNotables } from "@/lib/types";

type Combined = { gamePk: number; date: string; team: string; opponent: string; startId: string; pitcher: string; starterIP: number; outs: number; source: string };
type Audit = { year: number; expectedGames: number; checkedGames: number; individual: unknown[]; combined: Combined[]; starts: StartSummary[] };
const audit = data as unknown as Audit;
function verified(year: number) { return year === audit.year && audit.expectedGames > 0 && audit.checkedGames === audit.expectedGames; }
export function combinedNoHitterForStart(id: string, year: number) { return verified(year) ? audit.combined.find(row => row.startId === id) : undefined; }
export function withSeasonNoHitterNotable<T extends { id: string; date: string; narrativeNotables?: StartNarrativeNotables }>(start: T): T {
  const event = combinedNoHitterForStart(start.id, Number(start.date.slice(0,4)));
  if (!event) return start;
  return { ...start, narrativeNotables: { ...start.narrativeNotables, noHitDepth: { innings: event.starterIP, firstHitInning: null, hitlessStintComplete: true }, combinedNoHitter: { gamePk: event.gamePk, team: event.team, opponent: event.opponent, teamInnings: event.outs / 3, starterInnings: event.starterIP, source: event.source } } };
}
export function seasonNoHitterBids(review: FrozenSeasonReview): StartSummary[] {
  const rows = [...review.noHitBids];
  if (verified(review.year)) for (const start of audit.starts) if (!rows.some(row => row.id === start.id)) rows.push(start);
  return rows.map(withSeasonNoHitterNotable).sort((a,b) => (b.narrativeNotables?.noHitDepth?.innings ?? 0) - (a.narrativeNotables?.noHitDepth?.innings ?? 0));
}
export function seasonNoHitterLine(review: FrozenSeasonReview) {
  if (!verified(review.year)) return `Individual bids are shown below; a complete individual and combined no-hitter audit is not yet available for ${review.year}.`;
  const deepest = seasonNoHitterBids(review)[0];
  const individual = audit.individual.length === 0 ? `No individual no-hitter was completed in ${review.year}` : `${audit.individual.length} individual no-hitter${audit.individual.length === 1 ? " was" : "s were"} completed in ${review.year}`;
  const bid = deepest ? `; the deepest individual bid was ${deepest.pitcher.name}'s ${deepest.narrativeNotables!.noHitDepth!.innings} hitless innings on ${deepest.date}` : "";
  const combined = audit.combined.length ? ` ${audit.combined.length} combined no-hitter${audit.combined.length === 1 ? " was" : "s were"} completed: ${audit.combined.map(row => `${row.team} against ${row.opponent} on ${row.date}, started by ${row.pitcher} (${row.starterIP.toFixed(1)} IP, 0 H)`).join("; ")}.` : " No combined no-hitter was completed.";
  return `${individual}${bid}.${combined}`;
}
