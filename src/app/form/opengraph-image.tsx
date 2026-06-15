import { ImageResponse } from "next/og";
import { getFormLeaderboard, parseFormWindow } from "@/lib/data/form-service";
import { bandOf, HEAT_BANDS } from "@/lib/form-tokens";

type FormImageProps = {
  searchParams?: Promise<{
    window?: string;
  }>;
};

export const alt = "Toe the Slab Heat Check";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function Image({ searchParams }: FormImageProps) {
  const params = await searchParams;
  const window = parseFormWindow(params?.window);
  const leaderboard = await getFormLeaderboard({ window });
  const topPitcher = leaderboard.pitchers[0];
  const bandCounts = HEAT_BANDS.map((band) => ({ ...band, count: leaderboard.pitchers.filter((pitcher) => bandOf(pitcher.heatIndex ?? 0).key === band.key).length }));

  return new ImageResponse(
    (
      <div
        style={{
          background: "#08080a",
          color: "#fafafa",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: "64px",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
          <div style={{ color: "#EF9F27", display: "flex", fontSize: 28, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase" }}>Toe the Slab</div>
          <div style={{ color: "#a1a1aa", display: "flex", fontSize: 24 }}>Last {leaderboard.window} qualified starts</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ color: "#71717a", display: "flex", fontSize: 34, letterSpacing: 6, textTransform: "uppercase" }}>Heat Check</div>
          <div style={{ display: "flex", fontSize: 92, fontWeight: 800, lineHeight: 0.95 }}>MLB starter form</div>
          {topPitcher ? (
            <div style={{ alignItems: "center", display: "flex", gap: 28, marginTop: 18 }}>
              <div style={{ color: "#EF9F27", display: "flex", fontSize: 92, fontWeight: 800 }}>{Math.round(topPitcher.rgs)}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", fontSize: 42, fontWeight: 700 }}>{topPitcher.name}</div>
                <div style={{ color: "#a1a1aa", display: "flex", fontSize: 26 }}>{topPitcher.team} / Heat {topPitcher.heatIndex ?? 0} / {topPitcher.trend}</div>
              </div>
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 10, width: "100%" }}>
          {bandCounts.map((band) => (
            <div key={band.key} style={{ background: band.color, display: "flex", flex: Math.max(1, band.count), height: 28 }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
