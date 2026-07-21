import type { StartVeloByInning } from "@/lib/data/start-velo-by-inning";

export function RecentGemVeloChart({ pitcherName, data }: { pitcherName: string; data: StartVeloByInning | null }) {
  const width = 640;
  const height = 360;
  const padX = 28;
  const padY = 34;
  const values = data?.innings.map((entry) => entry.avgVelocityMph) ?? [];
  const reference = data?.seasonAverageVelocityMph ?? null;
  const domainValues = reference === null ? values : [...values, reference];
  const min = domainValues.length > 0 ? Math.min(...domainValues) - 1 : 88;
  const max = domainValues.length > 0 ? Math.max(...domainValues) + 1 : 98;
  const xFor = (index: number) => padX + (values.length <= 1 ? (width - padX * 2) / 2 : (index / (values.length - 1)) * (width - padX * 2));
  const yFor = (value: number) => padY + ((max - value) / Math.max(1, max - min)) * (height - padY * 2);
  const linePath = values.map((value, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(1)} ${yFor(value).toFixed(1)}`).join(" ");
  const fillPath = linePath ? `${linePath} L ${xFor(values.length - 1).toFixed(1)} ${height - padY} L ${xFor(0).toFixed(1)} ${height - padY} Z` : "";
  const referenceY = reference === null ? null : yFor(reference);

  return (
    <div className="rounded border border-white/10 bg-black/20 p-2" data-recent-gem-media="velo-chart">
      <div className="relative aspect-video overflow-hidden rounded bg-[#0b0b0e]">
        <svg
          className="h-full w-full"
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${pitcherName} average velocity by inning${reference === null ? "" : ` with ${reference.toFixed(1)} mph season reference`}`}
          data-velo-by-inning={JSON.stringify(data?.innings ?? [])}
          data-season-average-velocity={reference?.toFixed(1)}
        >
          <defs>
            <linearGradient id={`recent-gem-velo-${pitcherName.replace(/[^a-z0-9]/gi, "-")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF6B2C" stopOpacity="0.34" />
              <stop offset="100%" stopColor="#FF6B2C" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {referenceY === null ? null : <rect x={padX} y={referenceY - 5} width={width - padX * 2} height="10" fill="#F6C445" opacity="0.09" />}
          {referenceY === null ? null : <line x1={padX} y1={referenceY} x2={width - padX} y2={referenceY} stroke="#F6C445" strokeWidth="1.5" opacity="0.28" />}
          {fillPath ? <path d={fillPath} fill={`url(#recent-gem-velo-${pitcherName.replace(/[^a-z0-9]/gi, "-")})`} /> : null}
          {linePath ? <path d={linePath} fill="none" stroke="#FF6B2C" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /> : null}
        </svg>
      </div>
      <p className="mt-2 inline-flex font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">Velo by inning</p>
    </div>
  );
}
