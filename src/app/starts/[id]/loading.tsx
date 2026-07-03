import { RouteLoadingShell } from "@/components/route-loading-shell";
import { RankedStartCardSkeleton } from "./page";

export default function Loading() {
  return (
    <RouteLoadingShell route="ranked-starts" active="starts" title="Ranked Starts" description="Completed starts ranked by GS+." descriptionClassName="mt-2 max-w-2xl truncate text-sm leading-6 text-zinc-400" controls="ranked" layout="ranked" childrenMode="content">
      <section className="space-y-4" data-responsive-check="ranked-starts-recap" data-navigation-skeleton-route="ranked-starts" data-navigation-skeleton-layout="ranked">
        {["Elite", "Plus", "Solid", "Solid", "Below", "Below", "Poor", "Poor"].map((band, index) => (
          <RankedStartCardSkeleton key={index} index={index} band={band as "Elite" | "Plus" | "Solid" | "Below" | "Poor"} grouped />
        ))}
      </section>
    </RouteLoadingShell>
  );
}
