import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { getStartDetail } from "@/lib/data/start-service";
import { qualityTierOf } from "@/lib/form-tokens";
import { formatStartLine } from "@/lib/format";

type StartImageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const alt = "The Bump start card";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function Image({ params }: StartImageProps) {
  const { id } = await params;
  const start = await getStartDetail(id);
  if (!start) notFound();

  const tier = qualityTierOf(start.gameScorePlus);
  const whiffs = start.pitchEvents.filter((pitch) => pitch.result === "swinging_strike").length;
  const whiffRate = start.pitchEvents.length ? Math.round((whiffs / start.pitchEvents.length) * 100) : 0;
  const topVelo = start.pitchEvents.length ? Math.max(...start.pitchEvents.map((pitch) => pitch.velocityMph)).toFixed(1) : "--";
  const veloShape = start.inningTimeline?.map((inning) => Number(inning.avgVelocityMph.toFixed(1))) ?? [];
  const sparkPath = sparklinePath(veloShape);
  const latestVelo = veloShape.at(-1);

  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg,#08080a 0%,#111014 52%,#201307 100%)",
          color: "#fafafa",
          display: "flex",
          height: "100%",
          padding: "54px",
          width: "100%",
        }}
      >
        <div style={{ border: "1px solid rgba(255,255,255,0.12)", display: "flex", flex: 1, flexDirection: "column", padding: "34px" }}>
          <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", width: "100%" }}>
            <div style={{ color: "#EF9F27", display: "flex", fontSize: 28, fontWeight: 800, letterSpacing: 5, textTransform: "uppercase" }}>The Bump</div>
            <div style={{ color: tier.color, display: "flex", fontSize: 24, fontWeight: 800, letterSpacing: 4, textTransform: "uppercase" }}>{tier.label} start</div>
          </div>

          <div style={{ alignItems: "center", display: "flex", flex: 1, gap: 34, width: "100%" }}>
            <div style={{ alignItems: "center", border: `4px solid ${tier.color}`, display: "flex", height: 350, justifyContent: "center", overflow: "hidden", width: 250 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={start.pitcher.headshotUrl} alt="" style={{ height: 330, objectFit: "contain", objectPosition: "bottom", width: 220 }} />
            </div>

            <div style={{ display: "flex", flex: 1, flexDirection: "column", gap: 18, minWidth: 0 }}>
              <div style={{ color: "#a1a1aa", display: "flex", fontSize: 28, letterSpacing: 5, textTransform: "uppercase" }}>
                Start card / {start.pitcher.team} vs {start.opponent}
              </div>
              <div style={{ display: "flex", fontSize: 82, fontWeight: 900, lineHeight: 0.92 }}>{start.pitcher.name}</div>
              <div style={{ color: "#d4d4d8", display: "flex", fontSize: 32, fontWeight: 700 }}>{formatStartLine(start.line)}</div>

              <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                <Metric label="GS+" value={String(start.gameScorePlus)} color={tier.color} />
                <Metric label="Top velo" value={topVelo} />
                <Metric label="Whiff" value={`${whiffRate}%`} />
              </div>
            </div>
          </div>

          <div style={{ alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.12)", display: "flex", gap: 28, paddingTop: 20, width: "100%" }}>
            <div style={{ color: "#71717a", display: "flex", fontSize: 22, letterSpacing: 4, textTransform: "uppercase" }}>Inning velo shape</div>
            <svg width="520" height="82" viewBox="0 0 520 82" style={{ display: "flex" }}>
              <path d={sparkPath} fill="none" stroke={tier.color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
              {veloShape.map((value, index) => {
                const point = sparkPoint(veloShape, index);
                return <circle key={`${index}-${value}`} cx={point.x} cy={point.y} fill={index === veloShape.length - 1 ? "#fafafa" : tier.color} r={index === veloShape.length - 1 ? "7" : "5"} />;
              })}
            </svg>
            <div style={{ color: "#a1a1aa", display: "flex", fontSize: 24 }}>{latestVelo ? `${latestVelo.toFixed(1)} mph latest` : "Pitch data updating"}</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}

function Metric({ label, value, color = "#fafafa" }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: "rgba(0,0,0,0.28)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", flexDirection: "column", gap: 7, padding: "16px 20px", width: 160 }}>
      <div style={{ color, display: "flex", fontSize: 46, fontWeight: 900, lineHeight: 0.95 }}>{value}</div>
      <div style={{ color: "#71717a", display: "flex", fontSize: 18, letterSpacing: 3, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

function sparklinePath(values: number[]) {
  const points = values.length > 0 ? values : [0];
  return points.map((_, index) => {
    const { x, y } = sparkPoint(points, index);
    return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

function sparkPoint(values: number[], index: number) {
  const width = 520;
  const height = 82;
  const pad = 10;
  const points = values.length > 0 ? values : [0];
  const min = points.length > 1 ? Math.min(...points) - 1 : points[0] - 1;
  const max = points.length > 1 ? Math.max(...points) + 1 : points[0] + 1;
  const x = pad + (points.length === 1 ? (width - pad * 2) / 2 : (index / (points.length - 1)) * (width - pad * 2));
  const y = pad + ((max - points[index]) / Math.max(1, max - min)) * (height - pad * 2);
  return { x, y };
}
