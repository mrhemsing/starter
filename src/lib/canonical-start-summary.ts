import type { CanonicalStartRecord } from "@/lib/canonical-start-record";
import type { StartSummary } from "@/lib/types";
import { startMatchupLabel } from "@/lib/start-matchup-label";

export function canonicalRecordToFormStart(record: CanonicalStartRecord, rank: number): StartSummary {
  const teamColor = "#27272a";
  const accentColor = "#fbbf24";
  return {
    id: record.id,
    gamePk: record.gamePk,
    date: record.date,
    rank,
    pitcher: {
      id: String(record.pitcherMlbId),
      mlbId: record.pitcherMlbId,
      name: record.pitcherName,
      team: record.team,
      throws: "R",
      headshotUrl: `https://img.mlbstatic.com/mlb-photos/image/upload/w_360,q_auto:best/v1/people/${record.pitcherMlbId}/headshot/67/current`,
    },
    opponent: record.opponent,
    side: record.side ?? null,
    result: record.result,
    line: record.line,
    gameScorePlus: record.gameScorePlus,
    gameScoreV2: record.gameScoreV2,
    eventFlags: record.eventFlags,
    narrativeNotables: record.narrativeNotables,
    gameScorePlusBreakdown: record.gameScorePlusBreakdown,
    plannedStarter: true,
    teamColor,
    accentColor,
    context: {
      label: startMatchupLabel({ pitcher: { team: record.team }, opponent: record.opponent, side: record.side }),
      whiffDeltaPct: 0,
      velocityDeltaMph: 0,
      parkRunFactor: 1,
      parkLabel: record.venue ?? "MLB venue",
      opponentQualityRunValue: 0,
      opponentQualityLabel: `${record.opponent} opponent quality pending archive refresh.`,
      opponentOffenseRunValue: 0,
      opponentOffenseLabel: `${record.opponent} offense quality pending archive refresh.`,
    },
    source: record.source,
  };
}

