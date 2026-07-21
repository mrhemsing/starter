import { getStartDetail } from "@/lib/data/start-service";
import type { StartSummary } from "@/lib/types";

export type StartVeloByInning = {
  innings: Array<{ inning: number; avgVelocityMph: number }>;
  seasonAverageVelocityMph: number | null;
};

export async function resolveStartVeloByInning(start: StartSummary | null): Promise<StartVeloByInning | null> {
  if (!start) return null;

  const detail = await getStartDetail(start.id);
  if (!detail || detail.pitchEvents.length === 0) return null;

  const innings = (detail.velocityTrend ?? [])
    .filter((entry) => Number.isFinite(entry.avgVelocityMph))
    .map((entry) => ({ inning: entry.inning, avgVelocityMph: entry.avgVelocityMph }));
  if (innings.length === 0) return null;

  const velocities = detail.pitchEvents.map((pitch) => pitch.velocityMph).filter(Number.isFinite);
  const startAverage = velocities.length > 0 ? velocities.reduce((total, velocity) => total + velocity, 0) / velocities.length : null;
  const seasonAverageVelocityMph = startAverage === null || !Number.isFinite(detail.context.velocityDeltaMph)
    ? null
    : startAverage - detail.context.velocityDeltaMph;

  return { innings, seasonAverageVelocityMph };
}
