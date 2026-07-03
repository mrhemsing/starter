import { RouteLoadingShell } from "@/components/route-loading-shell";
import { LiveScoreboardRowSkeleton } from "@/components/live-scoreboard";

export default function Loading() {
  return (
    <RouteLoadingShell route="live" active="live" eyebrow="Live board" title="Live GS+ Scoreboard" description="Provisional GS+ rows stream in as the live board resolves." layout="live">
      <div className="rounded border border-[#FF7A3D]/30 bg-[#FF7A3D]/[0.06] p-4">
        <span className="route-shell-shimmer block h-8 w-44 rounded" />
        <span className="route-shell-shimmer mt-3 block h-3 w-full rounded" />
      </div>
      <div className="overflow-hidden rounded border border-white/10 bg-[#0B0C0F]">
        {Array.from({ length: 8 }).map((_, index) => <LiveScoreboardRowSkeleton key={index} scored={index < 5} muted={index >= 5} />)}
      </div>
    </RouteLoadingShell>
  );
}
