import Link from "next/link";
import { teamDisplayName, teamLogoUrl } from "@/lib/team-metadata";
import type { FrozenSeasonReview } from "@/lib/season-review-data";

// P3-18 rank, team, qualified arms and staff mean Form, shared with the frozen board.
export function SeasonRotationRow({ row, winner = false, dense = false }: { row: FrozenSeasonReview["rotation"][number]; winner?: boolean; dense?: boolean }) {
  const elevated = winner && !dense;
  const logo = teamLogoUrl(row.team);
  return <li data-season-rotation-row data-rank={row.rank} data-winner={winner || undefined} data-rotation-treatment={dense ? "dense" : elevated ? "winner" : "standard"} className="archive-rotation-row">
    {elevated && logo ? <div className="archive-rotation-ghost" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} alt="" width={240} height={240} data-rotation-logo="ghost" />
    </div> : null}
    <Link prefetch={false} href={`/heat-check?team=${row.team}`} className="archive-rotation-link" aria-label={`Rank ${row.rank}: ${teamDisplayName(row.team)}, ${row.staffMeanForm?.toFixed(1) ?? "no sample"} staff mean Form`}>
      <span className={elevated ? "archive-rotation-rank font-mono" : "archive-rotation-rank archive-rotation-rank-ghost font-serif"} aria-hidden={!elevated || undefined}>{elevated ? `#${row.rank}` : row.rank}</span>
      <span className="archive-rotation-logo-ring">{logo ?
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt="" width={dense ? 38 : elevated ? 84 : 56} height={dense ? 38 : elevated ? 84 : 56} data-rotation-logo="solid" /> : null}</span>
      <span className="archive-rotation-name"><span className="font-serif" data-archive-name>{teamDisplayName(row.team)}</span><span className="archive-rotation-micro font-mono">{row.qualifiedCount} qualified arms{winner ? " · WINNER" : ""}</span></span>
      <span className="archive-rotation-score font-mono"><strong>{row.staffMeanForm?.toFixed(1) ?? "No sample"}</strong><span className="archive-rotation-micro">Staff mean Form</span></span>
    </Link>
  </li>;
}
