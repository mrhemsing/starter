import { Headshot } from "@/components/headshot";
import type { ReactNode } from "react";

/** One responsive layout: desktop contents preserve the original podium flow. */
export function AwardPersonLayout({ playerId, name, children }: { playerId: number | string; name: string; children: ReactNode }) {
  return <div className="award-person-layout" data-award-person>
    <Headshot playerId={playerId} name={name} size="hero" />
    <div className="award-person-text">{children}</div>
  </div>;
}
