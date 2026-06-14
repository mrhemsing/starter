import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { getPitcherForm, parseFormWindow } from "@/lib/data/form-service";
import { bandOf, TREND_STYLES } from "@/lib/form-tokens";

type PitcherFormImageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    window?: string;
  }>;
};

export const alt = "Front Five pitcher form card";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";
export const dynamic = "force-dynamic";

export default async function Image({ params, searchParams }: PitcherFormImageProps) {
  const { id } = await params;
  const query = await searchParams;
  const window = parseFormWindow(query?.window);
  const form = await getPitcherForm(id, { window });
  if (!form) notFound();

  const { summary } = form;
  const band = bandOf(summary.heatIndex ?? 0);
  const trend = TREND_STYLES[summary.trend];

  return new ImageResponse(
    (
      <div
        style={{
          background: "#08080a",
          color: "#fafafa",
          display: "flex",
          height: "100%",
          padding: "64px",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
            <div style={{ color: "#EF9F27", display: "flex", fontSize: 28, fontWeight: 700, letterSpacing: 4, textTransform: "uppercase" }}>Front Five</div>
            <div style={{ color: "#a1a1aa", display: "flex", fontSize: 24 }}>Last {form.window} qualified starts</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ color: "#71717a", display: "flex", fontSize: 30, letterSpacing: 6, textTransform: "uppercase" }}>{summary.team} Heat Check</div>
            <div style={{ display: "flex", fontSize: 92, fontWeight: 800, lineHeight: 0.95 }}>{summary.name}</div>
            <div style={{ alignItems: "center", display: "flex", gap: 28 }}>
              <div style={{ color: band.color, display: "flex", fontSize: 112, fontWeight: 800 }}>{Math.round(summary.rgs)}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ color: "#fafafa", display: "flex", fontSize: 38, fontWeight: 700 }}>{band.label}</div>
                <div style={{ color: "#a1a1aa", display: "flex", fontSize: 26 }}>{trend.label} / Heat {summary.heatIndex ?? 0} / {summary.windowCount} starts</div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {summary.spark.map((value, index) => (
              <div key={`${index}-${value}`} style={{ background: value >= form.leagueMeanGS ? "#EF9F27" : "#378ADD", height: 22, width: 96 }} />
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
