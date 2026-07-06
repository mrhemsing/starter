import { FORM_CHART_COLORS, GS_TIERS, formDeltaBand } from "@/lib/form-tokens";
import type { CSSProperties } from "react";
import type { FormStartPoint, FormSummary, FormTier } from "@/lib/types";

const tierStyles = Object.fromEntries(GS_TIERS.map((tier) => [tier.key, tier])) as Record<FormTier, typeof GS_TIERS[number]>;

export function tierLabel(tier: FormTier) {
  return tierStyles[tier].label;
}

export function tierTextClass(tier: FormTier) {
  return tierStyles[tier].textClass;
}

export function TrendChip({ summary }: { summary: Pick<FormSummary, "trend" | "deltaForm">; compact?: boolean }) {
  const trend = formDeltaBand(summary.deltaForm);
  const value = `${summary.deltaForm >= 0 ? "+" : ""}${summary.deltaForm.toFixed(1)}`;

  return (
    <span className="inline-flex min-h-8 items-center gap-2 rounded border px-2.5 py-1 font-mono text-xs uppercase tracking-[0.12em]" style={{ borderColor: `color-mix(in srgb, ${trend.color} 35%, transparent)`, color: trend.color }} aria-label={`${trend.label} ${value}`}>
      <span>{trend.marker}</span>
      <span>{`${trend.label} ${value}`}</span>
    </span>
  );
}

export function FormSparkline({
  values,
  tier,
  leagueMeanGS,
  label,
  strokeColor,
  strokeDasharray,
  deltaForm,
  baselineValue,
  window,
  trend = "steady",
  variant = "row",
  intensity = "field",
}: {
  values: number[];
  tier: FormTier;
  leagueMeanGS: number;
  label: string;
  strokeColor?: string;
  strokeDasharray?: string;
  deltaForm?: number;
  baselineValue?: number;
  window?: number;
  trend?: FormSummary["trend"];
  variant?: "row" | "hero" | "mini";
  intensity?: "pole" | "field";
}) {
  const width = variant === "hero" ? 260 : variant === "mini" ? 128 : 190;
  const height = variant === "hero" ? 92 : variant === "mini" ? 42 : 66;
  const padding = 5;
  const points = values.length > 0 ? values : [leagueMeanGS];
  const deltaBand = typeof deltaForm === "number" ? formDeltaBand(deltaForm) : null;
  const lineColor = strokeColor ?? deltaBand?.color ?? (trend === "heating" ? "var(--level-hot)" : trend === "cooling" ? "var(--level-cooling)" : tierStyles[tier].color);
  const min = 20;
  const max = 80;
  const xFor = (index: number) => padding + (points.length === 1 ? width / 2 - padding : (index / (points.length - 1)) * (width - padding * 2));
  const yFor = (value: number) => padding + ((max - value) / (max - min)) * (height - padding * 2);
  const path = points.map((value, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(1)} ${yFor(value).toFixed(1)}`).join(" ");
  const baselineY = yFor(baselineValue ?? leagueMeanGS);
  const lastX = xFor(points.length - 1);
  const lastY = yFor(points.at(-1) ?? leagueMeanGS);
  const areaPath = `${path} L ${lastX.toFixed(1)} ${(height - padding).toFixed(1)} L ${xFor(0).toFixed(1)} ${(height - padding).toFixed(1)} Z`;
  const gradientId = `form-spark-${tier}-${deltaBand?.key ?? trend}-${points.join("-").replaceAll(".", "_")}-${window ?? "default"}-${variant}`;
  const fillColor = lineColor;
  const lineStyle = { stroke: lineColor } satisfies CSSProperties;
  const fillStyle = { fill: lineColor } satisfies CSSProperties;
  const stopStyle = { stopColor: fillColor } satisfies CSSProperties;

  return (
    <div>
      <svg className={variant === "hero" ? "h-24 w-full" : variant === "mini" ? "h-11 w-full" : "h-16 w-full"} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" style={stopStyle} stopOpacity={variant === "hero" ? "0.34" : "0.26"} />
            <stop offset="100%" style={stopStyle} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={padding} y1={baselineY} x2={width - padding} y2={baselineY} stroke={FORM_CHART_COLORS.gridStrong} strokeDasharray="3 3" />
        {points.length > 1 ? <path className="form-spark-area" d={areaPath} fill={`url(#${gradientId})`} /> : null}
        <path className={`form-spark-line ${intensity === "pole" ? "is-animated is-glowing" : ""}`} d={path} fill="none" style={lineStyle} strokeOpacity={intensity === "field" ? "0.8" : "1"} strokeWidth={variant === "hero" ? "4" : intensity === "field" ? "1.5" : variant === "mini" ? "2" : "3"} strokeDasharray={strokeDasharray} strokeLinecap="round" strokeLinejoin="round" />
        {points.slice(0, -1).map((value, index) => (
          <circle key={`${value}-${index}`} cx={xFor(index)} cy={yFor(value)} r={variant === "hero" ? "3.2" : "2.4"} style={fillStyle} opacity="0.72" />
        ))}
        <circle cx={lastX} cy={lastY} r={variant === "hero" ? "6.2" : "4.8"} style={fillStyle} />
      </svg>
      <p className="sr-only">{label}</p>
    </div>
  );
}

export function FormTrendChart({ series, leagueMeanGS }: { series: FormStartPoint[]; leagueMeanGS: number }) {
  const width = Math.max(520, series.length * 56);
  const height = 260;
  const pad = { top: 20, right: 18, bottom: 36, left: 42 };
  const min = 20;
  const max = 80;
  const xFor = (index: number) => pad.left + (series.length <= 1 ? 0 : (index / (series.length - 1)) * (width - pad.left - pad.right));
  const yFor = (value: number) => pad.top + ((max - value) / (max - min)) * (height - pad.top - pad.bottom);
  const rollingPath = series.map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(1)} ${yFor(point.rollingMean).toFixed(1)}`).join(" ");
  const bandTop = series.map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(1)} ${yFor(point.bandHigh).toFixed(1)}`).join(" ");
  const bandBottom = series.map((point, index) => `L ${xFor(series.length - index - 1).toFixed(1)} ${yFor(series[series.length - index - 1].bandLow).toFixed(1)}`).join(" ");
  const best = series.reduce((winner, point) => point.gsPlus > winner.gsPlus ? point : winner, series[0]);
  const worst = series.reduce((winner, point) => point.gsPlus < winner.gsPlus ? point : winner, series[0]);

  return (
    <div className="overflow-x-auto rounded border border-white/10 bg-[#101014] p-4" data-responsive-check="form-trend-chart">
      <svg width={width} height={height} role="img" aria-label={`Season form chart with ${series.length} starts and league mean ${leagueMeanGS.toFixed(1)} GS+`}>
        {[20, 40, 60, 80].map((tick) => (
          <g key={tick}>
            <line x1={pad.left} y1={yFor(tick)} x2={width - pad.right} y2={yFor(tick)} stroke={FORM_CHART_COLORS.grid} />
            <text x={8} y={yFor(tick) + 4} fill={FORM_CHART_COLORS.textMuted} fontSize="11">{tick}</text>
          </g>
        ))}
        <line x1={pad.left} y1={yFor(leagueMeanGS)} x2={width - pad.right} y2={yFor(leagueMeanGS)} stroke={FORM_CHART_COLORS.leagueReference} strokeDasharray="4 4" />
        {series.length > 1 ? <path d={`${bandTop} ${bandBottom} Z`} fill={FORM_CHART_COLORS.formBandFill} /> : null}
        {series.length > 1 ? <path d={rollingPath} fill="none" stroke={GS_TIERS[0].color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {series.map((point, index) => {
          const radius = point.ip < 3 ? 3 : Math.min(8, 3 + point.ip * 0.7);
          return (
            <a key={point.id} href={point.startHref}>
              <circle cx={xFor(index)} cy={yFor(point.gsPlus)} r={radius} fill={tierStyles[point.tier].color}>
                <title>{`${point.gameDate} vs ${point.opp}: GS+ ${point.gsPlus}, ${point.ip.toFixed(1)} IP`}</title>
              </circle>
            </a>
          );
        })}
        {best ? <text x={xFor(series.indexOf(best)) + 8} y={yFor(best.gsPlus) - 8} fill={FORM_CHART_COLORS.best} fontSize="11">Best</text> : null}
        {worst ? <text x={xFor(series.indexOf(worst)) + 8} y={yFor(worst.gsPlus) + 16} fill={FORM_CHART_COLORS.worst} fontSize="11">Worst</text> : null}
        {series.map((point, index) => index % Math.ceil(series.length / 6) === 0 ? (
          <text key={point.id} x={xFor(index)} y={height - 10} fill={FORM_CHART_COLORS.textMuted} fontSize="10" textAnchor="middle">
            {point.gameDate.slice(5)}
          </text>
        ) : null)}
      </svg>
      <table className="sr-only">
        <caption>Season form data</caption>
        <tbody>
          {series.map((point) => (
            <tr key={point.id}>
              <td>{point.gameDate}</td>
              <td>{point.gsPlus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
