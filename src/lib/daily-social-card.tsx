import { formatDailySocialLine, type DailySocialRenderVariant, type StartOfDay } from "@/lib/data/daily-social-post-service";
import { formatLongDate } from "@/lib/seo";

const COLORS = {
  ink: "#08080A",
  panel: "#0D0E11",
  gold: "#F6C445",
  white: "#F5F2EA",
  muted: "#9CA3AF",
  border: "#4A3E1C",
  ember: "#D85A30",
  frost: "#85B7EB",
};

export const dailySocialSizes: Record<DailySocialRenderVariant, { width: number; height: number }> = {
  instagram: { width: 1080, height: 1350 },
  x: { width: 1600, height: 900 },
};

export function DailySocialCard({ start, variant }: { start: StartOfDay; variant: DailySocialRenderVariant }) {
  const isPortrait = variant === "instagram";
  const imageUrl = start.image?.imageUrl ?? start.headshotUrl;
  const line = formatDailySocialLine(start.line);

  return (
    <div
      style={{
        background: COLORS.ink,
        color: COLORS.white,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        padding: isPortrait ? "58px 58px 64px" : "48px 62px",
        position: "relative",
        width: "100%",
      }}
    >
      <div style={{ background: `radial-gradient(circle at 84% 20%, ${COLORS.ember}55 0, transparent 27%), radial-gradient(circle at 18% 84%, ${COLORS.frost}33 0, transparent 32%)`, display: "flex", inset: 0, opacity: 0.75, position: "absolute" }} />
      <Masthead compact={!isPortrait} />

      <div
        style={{
          border: `2px solid ${COLORS.border}`,
          display: "flex",
          flex: 1,
          flexDirection: isPortrait ? "column" : "row",
          marginTop: isPortrait ? 34 : 26,
          minHeight: 0,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            background: COLORS.panel,
            display: "flex",
            flex: isPortrait ? "1 1 auto" : "1 1 58%",
            minHeight: 0,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            style={{
              height: "100%",
              objectFit: "cover",
              objectPosition: isPortrait ? "50% 18%" : "50% 42%",
              position: "absolute",
              width: "100%",
            }}
          />
          <div style={{ background: isPortrait ? "linear-gradient(180deg,rgba(8,8,10,0.08) 0%,rgba(8,8,10,0.08) 42%,rgba(8,8,10,0.9) 100%)" : "linear-gradient(90deg,rgba(8,8,10,0.05) 0%,rgba(8,8,10,0.32) 46%,rgba(8,8,10,0.95) 100%)", display: "flex", inset: 0, position: "absolute" }} />

          <div style={{ bottom: isPortrait ? 44 : 52, display: "flex", flexDirection: "column", gap: isPortrait ? 14 : 12, left: isPortrait ? 42 : 48, position: "absolute", right: isPortrait ? 42 : 420 }}>
            <div style={{ color: COLORS.gold, display: "flex", fontSize: isPortrait ? 22 : 20, fontWeight: 800, letterSpacing: 6, textTransform: "uppercase" }}>Today&apos;s best start</div>
            <div style={{ display: "flex", fontFamily: "Georgia, serif", fontSize: isPortrait ? 102 : 84, fontWeight: 900, lineHeight: 0.9 }}>{start.name}</div>
            <div style={{ color: COLORS.white, display: "flex", fontSize: isPortrait ? 31 : 26, fontWeight: 800, letterSpacing: 5, textTransform: "uppercase" }}>
              {start.team} vs {start.opponent}
            </div>
            <div style={{ background: COLORS.gold, display: "flex", height: 2, marginTop: isPortrait ? 8 : 4, width: isPortrait ? 420 : 360 }} />
            <div style={{ display: "flex", fontFamily: "monospace", fontSize: isPortrait ? 28 : 23, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase" }}>{line}</div>
          </div>
        </div>

        <div
          style={{
            background: "rgba(8,8,10,0.92)",
            borderLeft: isPortrait ? "none" : `2px solid ${COLORS.border}`,
            borderTop: isPortrait ? `2px solid ${COLORS.border}` : "none",
            display: "flex",
            flex: isPortrait ? "0 0 245px" : "0 0 360px",
            flexDirection: isPortrait ? "row" : "column",
            justifyContent: "space-between",
            padding: isPortrait ? "34px 42px" : "38px 34px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ color: COLORS.muted, display: "flex", fontFamily: "monospace", fontSize: isPortrait ? 21 : 18, letterSpacing: 4, textTransform: "uppercase" }}>{formatLongDate(start.date)}</div>
            <div style={{ color: COLORS.white, display: "flex", fontFamily: "monospace", fontSize: isPortrait ? 22 : 19, letterSpacing: 3, textTransform: "uppercase" }}>
              Result {start.result}
            </div>
          </div>

          <div style={{ alignItems: isPortrait ? "flex-end" : "flex-start", display: "flex", flexDirection: "column" }}>
            <div style={{ color: COLORS.gold, display: "flex", fontFamily: "monospace", fontSize: isPortrait ? 150 : 166, fontWeight: 900, lineHeight: 0.82 }}>{start.gsPlus}</div>
            <div style={{ alignItems: "center", display: "flex", gap: 16, marginTop: 18 }}>
              <div style={{ background: COLORS.gold, display: "flex", height: 3, width: 84 }} />
              <div style={{ color: COLORS.white, display: "flex", fontFamily: "monospace", fontSize: 22, fontWeight: 800, letterSpacing: 5, textTransform: "uppercase" }}>GS+</div>
            </div>
          </div>
        </div>
      </div>

      {start.image?.attribution ? (
        <div style={{ bottom: 12, color: "rgba(245,242,234,0.7)", display: "flex", fontFamily: "monospace", fontSize: 11, letterSpacing: 1, position: "absolute", right: 22, textTransform: "uppercase" }}>
          {start.image.attribution}
        </div>
      ) : null}
    </div>
  );
}

function Masthead({ compact }: { compact: boolean }) {
  return (
    <div style={{ alignItems: "center", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
      <div style={{ color: COLORS.gold, display: "flex", fontFamily: "Georgia, serif", fontSize: compact ? 68 : 86, fontWeight: 900, letterSpacing: compact ? 8 : 10, lineHeight: 0.95, textTransform: "uppercase", WebkitTextStroke: `1px ${COLORS.gold}` }}>
        Toe the Slab
      </div>
      <div style={{ background: COLORS.gold, display: "flex", height: 2, marginTop: 16, width: compact ? 590 : 700 }} />
      <div style={{ color: COLORS.gold, display: "flex", fontFamily: "monospace", fontSize: compact ? 22 : 25, fontWeight: 800, letterSpacing: 8, marginTop: 17, textTransform: "uppercase" }}>Start of the Day</div>
    </div>
  );
}
