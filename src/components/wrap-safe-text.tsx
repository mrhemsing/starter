import type { ReactNode } from "react";
import type { StartLine } from "@/lib/types";

export function MetaLine({ segments, className = "" }: { segments: ReactNode[]; className?: string }) {
  return (
    <span className={`meta-line ${className}`.trim()}>
      {segments.map((segment, index) => (
        <span key={index}>
          {index > 0 ? <span className="meta-sep" aria-hidden="true"> / </span> : null}
          <span className="meta-seg">{segment}</span>
        </span>
      ))}
    </span>
  );
}

export function StartLineText({ line }: { line: StartLine }) {
  const stats = [
    { value: line.inningsPitched.toFixed(1), unit: "IP" },
    { value: String(line.hits), unit: "H" },
    { value: String(line.earnedRuns), unit: "ER" },
    { value: String(line.walks), unit: "BB" },
    { value: String(line.strikeouts), unit: "K" },
  ];

  return (
    <>
      {stats.map((stat, index) => (
        <span key={stat.unit}>
          {index > 0 ? ", " : null}
          <span className="stat-token">{stat.value} {stat.unit}</span>
        </span>
      ))}
    </>
  );
}
