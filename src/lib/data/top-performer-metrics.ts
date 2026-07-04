import { getStartDetail } from "@/lib/data/start-service";
import type { PitchEvent, StartSummary } from "@/lib/types";

export type TopPerformerMetrics = {
  topVelo: number | null;
  whiffRate: number | null;
  veloSparkline: number[];
};

export async function resolveTopPerformerMetrics(start: StartSummary | null): Promise<TopPerformerMetrics | null> {
  if (!start) return null;

  const detail = await getStartDetail(start.id);
  if (!detail || detail.pitchEvents.length === 0) return null;

  const velocityTrend = detail.velocityTrend ?? [];
  const velocities = detail.pitchEvents.map((pitch) => pitch.velocityMph).filter((velocity) => Number.isFinite(velocity));
  const swings = detail.pitchEvents.filter(isSwing).length;
  const whiffs = detail.pitchEvents.filter((pitch) => pitch.result === "swinging_strike").length;

  return {
    topVelo: velocities.length > 0 ? Math.max(...velocities) : null,
    whiffRate: swings > 0 ? (whiffs / swings) * 100 : null,
    veloSparkline: velocityTrend.map((inning) => inning.avgVelocityMph),
  };
}

function isSwing(pitch: PitchEvent) {
  return pitch.result === "swinging_strike" || pitch.result === "foul" || pitch.result === "hit_into_play";
}
