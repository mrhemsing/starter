import { ImageResponse } from "next/og";
import { getUpcomingMustWatch } from "@/lib/data/tonight-service";
import { watchTierOf } from "@/lib/form-tokens";
import { formatUpcomingDate } from "@/lib/routes";

type UpcomingWeekImageProps = {
  params: Promise<{
    startDate: string;
  }>;
};

export const alt = "Toe the Slab weekly upcoming starter watch card";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function Image({ params }: UpcomingWeekImageProps) {
  const { startDate } = await params;
  const upcoming = await getUpcomingMustWatch({ start: startDate, days: 7, window: 5 });
  const games = upcoming.days
    .flatMap((day) => day.games.map((game) => ({ date: day.date, game })))
    .sort((a, b) => b.game.gameWatchScore - a.game.gameWatchScore);
  const topGame = games[0];
  const topTier = topGame ? watchTierOf(topGame.game.gameWatchScore) : null;

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
          <div style={{ color: "#a1a1aa", display: "flex", fontSize: 24 }}>
            {formatUpcomingDate(upcoming.range.start)} - {formatUpcomingDate(upcoming.range.end)}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ color: "#71717a", display: "flex", fontSize: 34, letterSpacing: 6, textTransform: "uppercase" }}>Weekly Starter Watch</div>
          <div style={{ display: "flex", fontSize: 88, fontWeight: 800, lineHeight: 0.95 }}>The week&apos;s best probable slates</div>
          {topGame ? (
            <div style={{ alignItems: "center", display: "flex", gap: 28, marginTop: 18 }}>
              <div style={{ color: topTier?.color ?? "#EF9F27", display: "flex", fontSize: 96, fontWeight: 800 }}>{Math.round(topGame.game.gameWatchScore)}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", fontSize: 42, fontWeight: 700 }}>{topGame.game.label}</div>
                <div style={{ color: "#a1a1aa", display: "flex", fontSize: 26 }}>
                  {topTier?.label} / {formatUpcomingDate(topGame.date)} / matchup rank {topGame.game.matchupRankTonight} / {games.length} games
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: "#a1a1aa", display: "flex", fontSize: 34 }}>Probable starter watch list updates as starters are named.</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, width: "100%" }}>
          {games.slice(0, 12).map(({ game }) => (
            <div key={game.gamePk} style={{ background: game.gamePk === topGame?.game.gamePk ? "#EF9F27" : "#27272a", display: "flex", flex: Math.max(8, game.gameWatchScore), height: 28 }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
