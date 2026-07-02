import { ImageResponse } from "next/og";
import { getHomeSlateDate } from "@/lib/data/start-service";
import { getUpcomingStreamers, type StreamerCandidate } from "@/lib/data/streamers-service";
import { formatUpcomingDate } from "@/lib/routes";

export const alt = "Toe the Slab upcoming fantasy pitcher streamers card";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function Image() {
  const streamers = await getUpcomingStreamers(getHomeSlateDate());
  const topTwoStart = streamers.twoStartPitchers[0];
  const topRiser = streamers.formRisers[0];
  const topCandidate = topTwoStart ?? topRiser;
  const visualCandidates = uniqueStreamerCandidates([...streamers.twoStartPitchers, ...streamers.formRisers]).slice(0, 10);

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
            {formatUpcomingDate(streamers.range.start)} - {formatUpcomingDate(streamers.range.end)}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ color: "#71717a", display: "flex", fontSize: 34, letterSpacing: 6, textTransform: "uppercase" }}>Upcoming Streamers</div>
          <div style={{ display: "flex", fontSize: 88, fontWeight: 800, lineHeight: 0.95 }}>Fantasy arms to watch this week</div>
          {topCandidate ? (
            <div style={{ alignItems: "center", display: "flex", gap: 28, marginTop: 18 }}>
              <div style={{ color: "#EF9F27", display: "flex", fontSize: 96, fontWeight: 800 }}>{Math.round(topCandidate.streamScore)}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", fontSize: 42, fontWeight: 700 }}>{topCandidate.pitcherName}</div>
                <div style={{ color: "#a1a1aa", display: "flex", fontSize: 26 }}>
                  {topCandidate.team} / {topCandidate.heatLabel} / {topCandidate.matchups.length} upcoming matchup{topCandidate.matchups.length === 1 ? "" : "s"}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: "#a1a1aa", display: "flex", fontSize: 34 }}>Streamer candidates update as probable starters are named.</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 12, width: "100%" }}>
          {visualCandidates.map((candidate) => (
            <div key={candidate.pitcherId} style={{ background: candidate.pitcherId === topCandidate?.pitcherId ? "#EF9F27" : "#27272a", display: "flex", flex: Math.max(8, candidate.streamScore), height: 28 }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}

function uniqueStreamerCandidates(candidates: StreamerCandidate[]) {
  const byPitcher = new Map<string, StreamerCandidate>();
  for (const candidate of candidates) {
    byPitcher.set(candidate.pitcherId, candidate);
  }
  return [...byPitcher.values()];
}
