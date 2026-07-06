import { RouteLoadingShell } from "@/components/route-loading-shell";
import { GS_PLUS_SCALE_SENTENCE } from "@/lib/gs-plus-copy";

export default function Loading() {
  return <RouteLoadingShell route="home" active="home" title="Every MLB start, ranked." description={GS_PLUS_SCALE_SENTENCE} layout="home" rows={6} />;
}
