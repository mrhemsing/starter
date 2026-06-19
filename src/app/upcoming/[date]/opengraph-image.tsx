import { ImageResponse } from "next/og";
import { getTonightMustWatch } from "@/lib/data/tonight-service";
import { watchTierOf } from "@/lib/form-tokens";
import { formatUpcomingDate } from "@/lib/routes";

type UpcomingImageProps = {
  params: Promise<{
    date: string;
  }>;
};

export const alt = "Toe the Slab upcoming starter watch card";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function Image({ params }: UpcomingImageProps) {
  const { date } = await params;
  const upcoming = await getTonightMustWatch({ date, window: 5 });
  const topGame = upcoming.games[0];
  const topTier = topGame ? watchTierOf(topGame.gameWatchScore) : null;
  const starters = topGame?.starters.filter((starter) => starter.name) ?? [];

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
          <div style={{ color: "#a1a1aa", display: "flex", fontSize: 24 }}>{formatUpcomingDate(upcoming.date)}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ color: "#71717a", display: "flex", fontSize: 34, letterSpacing: 6, textTransform: "uppercase" }}>Upcoming Matchups</div>
          <div style={{ display: "flex", fontSize: 88, fontWeight: 800, lineHeight: 0.95 }}>Must-watch games</div>
          {topGame ? (
            <div style={{ alignItems: "center", display: "flex", gap: 28, marginTop: 18 }}>
              <div style={{ color: topTier?.color ?? "#EF9F27", display: "flex", fontSize: 96, fontWeight: 800 }}>{Math.round(topGame.gameWatchScore)}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", fontSize: 42, fontWeight: 700 }}>{topGame.label}</div>
                <div style={{ color: "#a1a1aa", display: "flex", fontSize: 26 }}>
                  {topTier?.label} / {starters.map((starter) => starter.name).join(" vs ") || "Probables updating"} / matchup rank {topGame.matchupRankTonight}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: "#a1a1aa", display: "flex", fontSize: 34 }}>Probable starter watch list updates as starters are named.</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 12, width: "100%" }}>
          {upcoming.games.slice(0, 8).map((game) => (
            <div key={game.gamePk} style={{ background: game.gamePk === topGame?.gamePk ? "#EF9F27" : "#27272a", display: "flex", flex: Math.max(8, game.gameWatchScore), height: 28 }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
