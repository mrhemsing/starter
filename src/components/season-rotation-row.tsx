import Link from "next/link";
import { teamDisplayName } from "@/lib/team-metadata";
import type { FrozenSeasonReview } from "@/lib/season-review-data";

// P3-18 rank, team, qualified arms and staff mean Form, shared with the frozen board.
export function SeasonRotationRow({ row, winner = false }: { row: FrozenSeasonReview["rotation"][number]; winner?: boolean }) {
  return <li data-season-rotation-row data-rank={row.rank} data-winner={winner || undefined} className={`grid grid-cols-[36px_minmax(0,1fr)_88px] items-center gap-3 border-b border-white/10 p-3 ${winner ? "border-amber-300/40 bg-amber-300/10" : ""}`}>
    <span className="font-mono text-amber-300">#{row.rank}</span>
    <div className="min-w-0"><Link prefetch={false} href={`/heat-check?team=${row.team}`} className="font-serif text-lg font-bold">{teamDisplayName(row.team)}</Link><p className="text-xs text-zinc-400">{row.qualifiedCount} qualified arms{winner ? " · WINNER" : ""}</p></div>
    <div className="text-right"><strong className="font-mono text-xl text-amber-300">{row.staffMeanForm?.toFixed(1) ?? "No sample"}</strong><p className="text-[10px] text-zinc-400">Staff mean Form</p></div>
  </li>;
}
