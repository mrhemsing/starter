import type { CanonicalStartRecord } from "@/lib/canonical-start-record";
import { canonicalRecordToFormStart } from "@/lib/canonical-start-summary";
import { outsFromIP } from "@/lib/innings";

export function canonicalPitcherProfile(records: CanonicalStartRecord[]) {
  const rows = [...records].sort((a,b) => b.date.localeCompare(a.date) || b.gamePk-a.gamePk);
  if (!rows.length) return null;
  const latest = canonicalRecordToFormStart(rows[0], 1);
  const outs = rows.reduce((sum,row)=>sum+outsFromIP(row.line.inningsPitched),0);
  const earnedRuns = rows.reduce((sum,row)=>sum+row.line.earnedRuns,0);
  return {
    ...latest.pitcher, id: String(rows[0].pitcherMlbId),
    source: "canonical" as const,
    seasonLineSource: "canonical" as const, startHistorySource: "canonical" as const,
    seasonLine: { starts: rows.length, inningsPitched: Math.floor(outs/3)+(outs%3)/10,
      era: outs ? Number((earnedRuns*27/outs).toFixed(2)) : 0,
      strikeouts: rows.reduce((sum,row)=>sum+row.line.strikeouts,0), walks: rows.reduce((sum,row)=>sum+row.line.walks,0) },
    starts: rows.map(row=>({id:row.id,gamePk:row.gamePk,date:row.date,opponent:row.opponent,side:row.side ?? null,result:row.result,line:row.line,gameScorePlus:row.gameScorePlus,pitchEvents:[]})),
  };
}
