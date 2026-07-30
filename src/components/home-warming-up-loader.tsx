"use client";

import { WarmingUp, type WarmingUpSlateState } from "@/components/warming-up";

export type { WarmingUpSlateState } from "@/components/warming-up";

export function HomeWarmingUpLoader({ slateState }: { slateState: WarmingUpSlateState }) {
  return <WarmingUp variant="full" slateState={slateState} />;
}
