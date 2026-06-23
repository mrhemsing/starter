"use client";

import { useMemo, useState } from "react";
import { FORM_CHART_COLORS, FORM_CONFIG, GS_TIERS } from "@/lib/form-tokens";
import type { FormStartPoint } from "@/lib/types";

type FormWindow = typeof FORM_CONFIG.windows[number];

export function PitcherFormWindowPanel({
  initialWindow,
  leagueMeanGS,
  series,
}: {
  initialWindow: FormWindow;
  leagueMeanGS: number;
  series: FormStartPoint[];
}) {
  const [activeWindow, setActiveWindow] = useState<FormWindow>(initialWindow);
  const chartSeries = useMemo(() => recalculateRollingSeries(series, activeWindow), [series, activeWindow]);

  return (
    <>
      <div className="flex flex-wrap gap-2" data-responsive-check="pitcher-form-local-window-controls">
        {FORM_CONFIG.windows.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={activeWindow === value}
            onClick={() => setActiveWindow(value)}
            className={`inline-flex min-h-11 items-center rounded border px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] ${
              activeWindow === value ? "border-amber-300 bg-amber-300 text-zinc-950" : "border-white/10 text-zinc-300 hover:border-amber-300/60 hover:text-amber-200"
            }`}
          >
            Last {value}
          </button>
        ))}
      </div>
      <FormTrendChart series={chartSeries} leagueMeanGS={leagueMeanGS} />
    </>
  );
}

function recalculateRollingSeries(series: FormStartPoint[], window: FormWindow) {
  return series.map((point, index) => {
    const rollingStarts = series.slice(Math.max(0, index - window + 1), index + 1);
    const values = rollingStarts.map((candidate) => candidate.gsPlus);
    const rollingMean = mean(values);
    const sd = sampleStddev(values);

    return {
      ...point,
      rollingMean: round1(rollingMean),
      bandLow: round1(rollingMean - sd),
      bandHigh: round1(rollingMean + sd),
    };
  });
}

function FormTrendChart({ series, leagueMeanGS }: { series: FormStartPoint[]; leagueMeanGS: number }) {
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
    <div className="max-w-full overflow-x-auto rounded border border-white/10 bg-[#101014] p-4" data-responsive-check="form-trend-chart">
      <svg className="block w-full" viewBox={`0 0 ${width} ${height}`} height={height} role="img" aria-label={`Season form chart with ${series.length} starts and league mean ${leagueMeanGS.toFixed(1)} GS+`}>
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
          const tier = GS_TIERS.find((candidate) => candidate.key === point.tier) ?? GS_TIERS[0];
          return (
            <a key={point.id} href={point.startHref}>
              <circle cx={xFor(index)} cy={yFor(point.gsPlus)} r={radius} fill={tier.color}>
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

function mean(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function sampleStddev(values: number[]) {
  if (values.length < 2) return 0;
  const average = mean(values);
  const variance = values.reduce((total, value) => total + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
