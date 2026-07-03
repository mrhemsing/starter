import { RouteLoadingShell } from "@/components/route-loading-shell";
import { RankedStartCardSkeleton } from "./page";

export default function Loading() {
  return (
    <RouteLoadingShell route="ranked-starts" active="starts" title="Ranked Starts" description="Completed starts ranked by GS+." controls="ranked" layout="ranked">
      {["Elite", "Plus", "Solid", "Solid", "Below", "Below", "Poor", "Poor"].map((band, index) => (
        <RankedStartCardSkeleton key={index} index={index} band={band as "Elite" | "Plus" | "Solid" | "Below" | "Poor"} grouped />
      ))}
    </RouteLoadingShell>
  );
}
