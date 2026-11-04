import { Fragment } from "react";

// Preserve copy bytes while assigning display names and numbers their house roles.
export function ArchiveType({ text, names = [] }: { text: string; names?: string[] }) {
  const escaped = [...new Set(names)].filter(Boolean).sort((a,b) => b.length-a.length).map(name => name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"));
  const pattern = new RegExp(`(${escaped.length ? escaped.join("|")+"|" : ""}\\d+(?:[.,:]\\d+)*)`, "gu");
  return <>{text.split(pattern).map((part,index) => names.includes(part) ? <span key={index} className="font-serif" data-archive-name>{part}</span> : /\d/u.test(part) ? <span key={index} className="font-mono tabular-nums" data-archive-number>{part}</span> : <Fragment key={index}>{part}</Fragment>)}</>;
}
