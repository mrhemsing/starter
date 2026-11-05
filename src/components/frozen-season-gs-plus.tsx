import { WhyGsPlusBand } from "@/components/why-gs-plus-band";
import proof from "@/data/gs-plus-examples-2026.json";
import type { HomeGsPlusProofs } from "@/lib/data/home-gs-plus-proof-service";

export function FrozenSeasonGsPlus() {
  return <WhyGsPlusBand proof={proof as unknown as HomeGsPlusProofs} season={2026} />;
}
