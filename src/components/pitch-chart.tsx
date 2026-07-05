"use client";

import { useMemo, useState } from "react";
import { ScoreComponentList } from "@/components/score-component-list";
import { formatStartLine } from "@/lib/format";
import { pitchResults, pitchTypes } from "@/lib/pitch-taxonomy";
import { summarizePitchEventQuality } from "@/lib/pitch-event-quality";
import { startMatchupLabel } from "@/lib/start-matchup-label";
import type { PitchEvent, PitchResultKey, PitchTypeKey, StartApiGameScorePlusBreakdown, StartApiPitchSequenceRow, StartDetail } from "@/lib/types";

const strikeZone = { xMin: -0.83, xMax: 0.83, zMin: 1.5, zMax: 3.5 };
const view = { xMin: -2.2, xMax: 2.2, zMin: 0.3, zMax: 4.7 };
const countFilters = {
  all: "All counts",
  ahead: "Pitcher ahead",
  even: "Even",
  behind: "Pitcher behind",
  twoStrike: "Two-strike",
} as const;

type CountFilter = keyof typeof countFilters;

function pxToView(px: number, zoneW: number) {
  return ((px - view.xMin) / (view.xMax - view.xMin)) * zoneW;
}

function pzToView(pz: number, zoneH: number) {
  return zoneH - ((pz - view.zMin) / (view.zMax - view.zMin)) * zoneH;
}

export function PitchChart({ start }: { start: StartDetail }) {
  const [activeTypes, setActiveTypes] = useState<Set<PitchTypeKey>>(new Set(Object.keys(pitchTypes) as PitchTypeKey[]));
  const [activeResults, setActiveResults] = useState<Set<PitchResultKey>>(new Set(Object.keys(pitchResults) as PitchResultKey[]));
  const [hover, setHover] = useState<PitchEvent | null>(null);
  const [sizeBy, setSizeBy] = useState<"velo" | "uniform">("velo");
  const [countFilter, setCountFilter] = useState<CountFilter>("all");
  const zoneW = 380;
  const zoneH = 460;
  const pitches = start.pitchEvents;

  const filtered = useMemo(
    () => pitches.filter((pitch) => activeTypes.has(pitch.type) && activeResults.has(pitch.result) && matchesCountFilter(pitch, countFilter)),
    [activeResults, activeTypes, countFilter, pitches],
  );
  const filteredSequence = (start.pitchSequence ?? []).filter((pitch) => activeTypes.has(pitch.type) && activeResults.has(pitch.result) && matchesCountFilter(pitch, countFilter));
  const sequenceRows = filteredSequence.slice(0, 18);

  const qualityStats = useMemo(() => summarizePitchEventQuality(pitches), [pitches]);
  const mixStats = qualityStats.byType;

  const velocityTrend = start.velocityTrend ?? [];
  const inningTimeline = start.inningTimeline ?? [];
  const countLeverage = start.countLeverage ?? [];
  const maxInningPitches = Math.max(...inningTimeline.map((inning) => inning.pitches), 1);
  const maxLeveragePitches = Math.max(...countLeverage.map((inning) => inning.ahead + inning.even + inning.behind), 1);
  const minTrendVelo = Math.floor(Math.min(...velocityTrend.map((inning) => inning.avgVelocityMph), 90) - 1);
  const maxTrendVelo = Math.ceil(Math.max(...velocityTrend.map((inning) => inning.avgVelocityMph), 96) + 1);
  const scoreBreakdown = start.gameScorePlusBreakdown;
  const hasPitchDetails = start.pitchDetailSource !== "fixture" && pitches.length > 0;

  function toggleType(type: PitchTypeKey) {
    const next = new Set(activeTypes);
    if (next.has(type)) next.delete(type);
    else next.add(type);
    setActiveTypes(next);
  }

  function toggleResult(result: PitchResultKey) {
    const next = new Set(activeResults);
    if (next.has(result)) next.delete(result);
    else next.add(result);
    setActiveResults(next);
  }

  function dotRadius(velo: number) {
    if (sizeBy === "uniform") return 7;
    return 4 + ((velo - 80) / 21) * 6;
  }

  if (!hasPitchDetails) {
    return (
      <section className="border-t border-white/10 bg-[#08080a] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded border border-white/10 bg-[#101014] p-6">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Pitch data</p>
            <h2 className="mt-3 font-serif text-4xl font-bold text-zinc-50">Pitch data pending</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              The start line and GS+ are available from the MLB gamefeed. Pitch-level data is hidden until real pitch events are available.
            </p>
          </div>

          {scoreBreakdown ? (
            <section className="rounded border border-white/10 bg-[#101014] p-4">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Game Score+ why</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-600">{scoreBreakdown.formulaVersion}</p>
                </div>
                <p className="font-serif text-4xl font-semibold text-amber-300">{scoreBreakdown.total}</p>
              </div>
              {typeof start.expectedGameScorePlus === "number" ? (
                <div className="mb-4 rounded border border-white/10 bg-black/25 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">xGS+ process check</p>
                  <p className="mt-1 font-serif text-3xl text-zinc-50">{start.expectedGameScorePlus}</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">Line-backed expected score from length, strikeouts, walks, and park; excludes hits/runs until Statcast contact quality is available.</p>
                </div>
              ) : null}
              <ScoreComponentList components={nonPitchScoreComponents(scoreBreakdown.components)} />
            </section>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section className="border-t border-white/10 bg-[#08080a] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col justify-between gap-5 border-b border-white/10 pb-6 md:flex-row md:items-end">
          <div>
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Start log / {start.date}</p>
            <h2 className="font-serif text-4xl font-bold text-zinc-50 sm:text-5xl">{start.pitcher.name}</h2>
            <p className="mt-3 font-mono text-sm text-zinc-400">
              {startMatchupLabel(start)} / {formatStartLine(start.line)}
            </p>
          </div>
          <div className="md:text-right">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Game Score+</p>
            <p className="font-serif text-6xl font-bold leading-none text-amber-300">{start.gameScorePlus}</p>
            {typeof start.expectedGameScorePlus === "number" ? (
              <p className="mt-2 font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">xGS+ {start.expectedGameScorePlus}</p>
            ) : null}
            {scoreBreakdown ? (
              <p className="mt-2 font-mono text-xs uppercase tracking-[0.16em] text-zinc-500">
                {scoreBreakdown.gradeBand.label} / {scoreBreakdown.gradeBand.percentileLabel}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Pitch location / catcher view</p>
            <div className="relative flex justify-center rounded border border-white/10 bg-[#101014] p-4 shadow-2xl shadow-black/40 sm:p-6">
              <svg className="h-auto w-full max-w-[380px]" width={zoneW} height={zoneH} viewBox={`0 0 ${zoneW} ${zoneH}`} role="img" aria-label="Pitch location chart">
                <defs>
                  <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1c1c22" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width={zoneW} height={zoneH} fill="url(#grid)" />
                <rect
                  x={pxToView(strikeZone.xMin, zoneW)}
                  y={pzToView(strikeZone.zMax, zoneH)}
                  width={pxToView(strikeZone.xMax, zoneW) - pxToView(strikeZone.xMin, zoneW)}
                  height={pzToView(strikeZone.zMin, zoneH) - pzToView(strikeZone.zMax, zoneH)}
                  fill="none"
                  stroke="#71717a"
                  strokeWidth="2"
                />
                {[1, 2].map((i) => {
                  const w = (strikeZone.xMax - strikeZone.xMin) / 3;
                  const h = (strikeZone.zMax - strikeZone.zMin) / 3;
                  return (
                    <g key={i}>
                      <line x1={pxToView(strikeZone.xMin + w * i, zoneW)} y1={pzToView(strikeZone.zMax, zoneH)} x2={pxToView(strikeZone.xMin + w * i, zoneW)} y2={pzToView(strikeZone.zMin, zoneH)} stroke="#3f3f46" strokeWidth="1" />
                      <line x1={pxToView(strikeZone.xMin, zoneW)} y1={pzToView(strikeZone.zMin + h * i, zoneH)} x2={pxToView(strikeZone.xMax, zoneW)} y2={pzToView(strikeZone.zMin + h * i, zoneH)} stroke="#3f3f46" strokeWidth="1" />
                    </g>
                  );
                })}
                <polygon
                  points={`${pxToView(-0.83, zoneW)},${pzToView(0.5, zoneH)} ${pxToView(0.83, zoneW)},${pzToView(0.5, zoneH)} ${pxToView(0.83, zoneW)},${pzToView(0.35, zoneH)} ${pxToView(0, zoneW)},${pzToView(0.2, zoneH)} ${pxToView(-0.83, zoneW)},${pzToView(0.35, zoneH)}`}
                  fill="#18181b"
                  stroke="#52525b"
                  strokeWidth="1"
                />
                {filtered.map((pitch) => {
                  const cx = pxToView(pitch.plateX, zoneW);
                  const cy = pzToView(pitch.plateZ, zoneH);
                  const r = dotRadius(pitch.velocityMph);
                  const isHover = hover?.pitchNumber === pitch.pitchNumber;
                  const isWhiff = pitch.result === "swinging_strike";
                  return (
                    <g key={pitch.id}>
                      <circle cx={cx} cy={cy} r={r + 3} fill={pitchTypes[pitch.type].color} opacity={isHover ? 0.35 : 0} />
                      <circle cx={cx} cy={cy} r={r} fill={pitchTypes[pitch.type].color} fillOpacity={isWhiff ? 0.95 : 0.74} stroke={isWhiff ? "#fafafa" : "none"} strokeWidth={isWhiff ? 1.5 : 0} className="cursor-pointer transition" onMouseEnter={() => setHover(pitch)} onMouseLeave={() => setHover(null)} />
                    </g>
                  );
                })}
                <text x={zoneW / 2} y={zoneH - 6} textAnchor="middle" fill="#71717a" fontSize="10">
                  INSIDE TO RHB / INSIDE TO LHB
                </text>
              </svg>

              {hover ? (
                <div className="absolute right-4 top-4 min-w-44 rounded border bg-zinc-950/95 p-3 font-mono text-xs shadow-xl" style={{ borderColor: pitchTypes[hover.type].color }}>
                <p className="mb-1 uppercase tracking-[0.16em] text-zinc-500">
                    Pitch #{hover.pitchNumber} / Inn {hover.inning} / {hover.count.balls}-{hover.count.strikes}
                  </p>
                  <p className="font-semibold" style={{ color: pitchTypes[hover.type].color }}>
                    {pitchTypes[hover.type].name}
                  </p>
                  <p className="mt-1 font-serif text-2xl text-zinc-50">
                    {hover.velocityMph} <span className="font-mono text-xs text-zinc-500">MPH</span>
                  </p>
                  <p className="mt-1 text-zinc-300">{pitchResults[hover.result].label}</p>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-5">
              <ControlGroup label="Pitch type">
                {(Object.keys(pitchTypes) as PitchTypeKey[]).map((type) => {
                  const active = activeTypes.has(type);
                  return (
                    <button key={type} type="button" onClick={() => toggleType(type)} className="min-h-11 rounded border px-3 py-2 font-mono text-xs font-semibold transition" style={{ background: active ? pitchTypes[type].color : "transparent", borderColor: pitchTypes[type].color, color: active ? "#08080a" : pitchTypes[type].color }}>
                      {pitchTypes[type].name}
                    </button>
                  );
                })}
              </ControlGroup>

              <ControlGroup label="Dot size">
                {[
                  ["velo", "By velo"],
                  ["uniform", "Uniform"],
                ].map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setSizeBy(key as "velo" | "uniform")} className={`min-h-11 rounded border border-white/15 px-3 py-2 font-mono text-xs font-semibold transition ${sizeBy === key ? "bg-zinc-100 text-zinc-950" : "text-zinc-400 hover:text-zinc-100"}`}>
                    {label}
                  </button>
                ))}
              </ControlGroup>
            </div>

            <ControlGroup label="Result" className="mt-4">
              {(Object.keys(pitchResults) as PitchResultKey[]).map((result) => {
                const active = activeResults.has(result);
                return (
                  <button key={result} type="button" onClick={() => toggleResult(result)} className={`min-h-11 rounded border border-white/15 px-3 py-2 font-mono text-xs font-semibold transition ${active ? "bg-zinc-800 text-zinc-50" : "text-zinc-500 hover:text-zinc-200"}`}>
                    {pitchResults[result].label}
                  </button>
                );
              })}
            </ControlGroup>

            <ControlGroup label={`Count sequence / ${filtered.length} shown`} className="mt-4">
              {(Object.keys(countFilters) as CountFilter[]).map((filter) => (
                <button key={filter} type="button" onClick={() => setCountFilter(filter)} className={`min-h-11 rounded border border-white/15 px-3 py-2 font-mono text-xs font-semibold transition ${countFilter === filter ? "bg-amber-300 text-zinc-950" : "text-zinc-500 hover:text-zinc-200"}`}>
                  {countFilters[filter]}
                </button>
              ))}
            </ControlGroup>

            <section className="mt-8 rounded border border-white/10 bg-[#101014]">
              <div className="flex flex-col justify-between gap-2 border-b border-white/10 p-4 sm:flex-row sm:items-end">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Pitch-by-pitch sequence</p>
                  <p className="mt-1 font-mono text-xs text-zinc-500">First 18 pitches matching active type, result, and count filters</p>
                </div>
                <p className="font-mono text-xs text-zinc-500">
                  {sequenceRows.length} of {filteredSequence.length}
                </p>
              </div>
              <div className="divide-y divide-white/5 sm:hidden" data-responsive-check="pitch-sequence-cards">
                {sequenceRows.map((pitch) => (
                  <div key={`sequence-card-${pitch.id}`} className="p-4 font-mono text-xs text-zinc-300">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                          #{pitch.pitchNumber} / Inn {pitch.inning} / {pitch.countLabel}
                        </p>
                        <p className="mt-2 inline-flex items-center gap-2 font-semibold text-zinc-100">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pitchTypes[pitch.type].color }} />
                          {pitchTypes[pitch.type].name}
                        </p>
                      </div>
                      <p className="text-right text-zinc-100">{pitch.velocityMph.toFixed(1)}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                      <span>{pitchResults[pitch.result].label}</span>
                      <span>{pitch.locationLabel}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto sm:block" data-responsive-check="pitch-sequence-table">
                <table className="w-full min-w-[640px] border-collapse text-left font-mono text-xs">
                  <thead className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Inn</th>
                      <th className="px-4 py-3 font-medium">Count</th>
                      <th className="px-4 py-3 font-medium">Pitch</th>
                      <th className="px-4 py-3 font-medium">Result</th>
                      <th className="px-4 py-3 text-right font-medium">Velo</th>
                      <th className="px-4 py-3 text-right font-medium">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sequenceRows.map((pitch) => (
                      <tr key={`sequence-${pitch.id}`} className="border-t border-white/5 text-zinc-300">
                        <td className="px-4 py-3 text-zinc-500">{pitch.pitchNumber}</td>
                        <td className="px-4 py-3">{pitch.inning}</td>
                        <td className="px-4 py-3">
                          {pitch.countLabel}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: pitchTypes[pitch.type].color }} />
                            {pitchTypes[pitch.type].name}
                          </span>
                        </td>
                        <td className="px-4 py-3">{pitchResults[pitch.result].label}</td>
                        <td className="px-4 py-3 text-right">{pitch.velocityMph.toFixed(1)}</td>
                        <td className="px-4 py-3 text-right text-zinc-500">
                          {pitch.locationLabel}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="mt-8 grid gap-5 xl:grid-cols-3">
              <section className="rounded border border-white/10 bg-[#101014] p-4">
                <div className="mb-4 flex items-baseline justify-between gap-3">
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Velocity trend</p>
                  <p className="font-mono text-xs text-zinc-500">
                    {minTrendVelo}-{maxTrendVelo} MPH
                  </p>
                </div>
                <div className="flex h-44 items-end gap-2">
                  {velocityTrend.map((inning) => {
                    const range = Math.max(maxTrendVelo - minTrendVelo, 1);
                    const height = 22 + ((inning.avgVelocityMph - minTrendVelo) / range) * 116;

                    return (
                      <div key={inning.inning} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                        <div className="relative flex h-36 w-full items-end justify-center border-b border-white/10">
                          <div className="w-full rounded-t bg-amber-300/80" style={{ height }} />
                          <span className="absolute -top-1 font-mono text-[10px] text-zinc-400">{inning.avgVelocityMph.toFixed(1)}</span>
                        </div>
                        <span className="font-mono text-[10px] uppercase text-zinc-500">Inn {inning.inning}</span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded border border-white/10 bg-[#101014] p-4">
                <div className="mb-4 flex items-baseline justify-between gap-3">
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Inning timeline</p>
                  <p className="font-mono text-xs text-zinc-500">{pitches.length} pitches</p>
                </div>
                <div className="space-y-3">
                  {inningTimeline.map((inning) => (
                    <div key={inning.inning} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3">
                      <p className="font-mono text-xs text-zinc-500">Inn {inning.inning}</p>
                      <div className="h-2 overflow-hidden rounded bg-zinc-800">
                        <div className="h-full rounded bg-zinc-100" style={{ width: `${Math.max(6, (inning.pitches / maxInningPitches) * 100)}%` }} />
                      </div>
                      <p className="font-mono text-xs text-zinc-400">{inning.pitches}</p>
                      <div className="col-span-3 flex flex-wrap gap-3 pl-14 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                        <span>{inning.strikes} strikes</span>
                        <span>{inning.whiffs} whiffs</span>
                        <span>{inning.inPlay} in play</span>
                        <span>{inning.maxVelocityMph.toFixed(1)} max</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded border border-white/10 bg-[#101014] p-4">
                <div className="mb-4 flex items-baseline justify-between gap-3">
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Count leverage</p>
                  <p className="font-mono text-xs text-zinc-500">{countLeverage.length} innings</p>
                </div>
                <div className="space-y-3">
                  {countLeverage.map((inning) => {
                    const total = Math.max(inning.ahead + inning.even + inning.behind, 1);

                    return (
                      <div key={inning.inning} className="grid grid-cols-[3rem_1fr] items-center gap-3">
                        <p className="font-mono text-xs text-zinc-500">Inn {inning.inning}</p>
                        <div>
                          <div className="flex h-2 overflow-hidden rounded bg-zinc-800" style={{ width: `${Math.max(8, (total / maxLeveragePitches) * 100)}%` }}>
                            <div className="bg-emerald-300" style={{ width: `${(inning.ahead / total) * 100}%` }} />
                            <div className="bg-zinc-300" style={{ width: `${(inning.even / total) * 100}%` }} />
                            <div className="bg-rose-300" style={{ width: `${(inning.behind / total) * 100}%` }} />
                          </div>
                          <div className="mt-1 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                            <span>{inning.ahead} ahead</span>
                            <span>{inning.even} even</span>
                            <span>{inning.behind} behind</span>
                            <span>{inning.twoStrike} 2-strike</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>

          <aside>
            {scoreBreakdown ? (
              <section className="mb-6 rounded border border-white/10 bg-[#101014] p-4">
                <div className="mb-4 flex items-baseline justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Game Score+ why</p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-600">{scoreBreakdown.formulaVersion}</p>
                  </div>
                  <p className="font-serif text-4xl font-semibold text-amber-300">{scoreBreakdown.total}</p>
                </div>
                <div className="mb-4 rounded border border-amber-300/20 bg-amber-300/5 p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-mono text-xs font-semibold text-amber-200">{scoreBreakdown.gradeBand.label}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                      {scoreBreakdown.gradeBand.rangeLabel} / {scoreBreakdown.gradeBand.percentileLabel}
                    </p>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">{scoreBreakdown.gradeBand.description}</p>
                </div>
                <ScoreComponentList components={scoreBreakdown.components} />
              </section>
            ) : null}

            <ArsenalEventPanel eventSummary={start.arsenalEventSummary} />

            <section className="mb-6 rounded border border-white/10 bg-[#101014] p-4" data-responsive-check="start-arsenal-quality">
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Arsenal quality</p>
                <p className="font-mono text-xs text-zinc-500">{pitches.length} pitches</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <QualityMetric label="CSW" value={formatPct(qualityStats.cswPct)} tone="strong" />
                <QualityMetric label="Whiff" value={formatPct(qualityStats.whiffPct)} />
                <QualityMetric label="Zone" value={formatPct(qualityStats.zonePct)} />
                <QualityMetric label="Swing" value={formatPct(qualityStats.swingPct)} />
              </div>
              {qualityStats.topType ? (
                <div className="mt-4 rounded border border-white/10 bg-black/25 p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-mono text-xs font-semibold" style={{ color: pitchTypes[qualityStats.topType.type].color }}>
                      {pitchTypes[qualityStats.topType.type].name}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">Best CSW</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                    <span>{formatPct(qualityStats.topType.cswPct)} CSW</span>
                    <span>{formatPct(qualityStats.topType.zonePct)} zone</span>
                    <span>{formatPct(qualityStats.topType.whiffPct)} whiff</span>
                  </div>
                </div>
              ) : null}
            </section>

            <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Arsenal breakdown</p>
            <div className="flex flex-col gap-3">
              {mixStats
                .filter((stat) => stat.count > 0)
                .map((stat) => (
                  <div key={stat.type} className="rounded border border-white/10 bg-[#101014] p-4" style={{ borderLeftColor: pitchTypes[stat.type].color, borderLeftWidth: 4 }}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-mono text-sm font-semibold" style={{ color: pitchTypes[stat.type].color }}>
                        {pitchTypes[stat.type].name}
                      </p>
                      <p className="font-mono text-xs text-zinc-500">{(stat.pct * 100).toFixed(0)}%</p>
                    </div>
                    <p className="mt-1 font-serif text-3xl font-semibold text-zinc-50">
                      {stat.avgVelo.toFixed(1)}
                      <span className="ml-2 font-mono text-xs text-zinc-500">AVG / {stat.maxVelo.toFixed(1)} MAX</span>
                    </p>
                    <div className="mt-3 flex justify-between font-mono text-xs">
                      <span className="text-zinc-500">{stat.count} thrown</span>
                      <span className={stat.whiffPct > 0.25 ? "text-amber-300" : "text-zinc-400"}>{(stat.whiffPct * 100).toFixed(0)}% whiff</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                      <span>{formatPct(stat.cswPct)} CSW</span>
                      <span>{formatPct(stat.zonePct)} zone</span>
                      <span>{formatPct(stat.swingPct)} swing</span>
                    </div>
                  </div>
                ))}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

function nonPitchScoreComponents(components: StartApiGameScorePlusBreakdown["components"]) {
  const hiddenKeys = new Set(["whiffDelta", "velocityDelta"]);
  return components.filter((component) => !hiddenKeys.has(component.key));
}

function ArsenalEventPanel({ eventSummary }: { eventSummary: StartDetail["arsenalEventSummary"] }) {
  if (!eventSummary || (eventSummary.newPitchTypes.length === 0 && eventSummary.usageShifts.length === 0)) return null;

  return (
    <section className="mb-6 rounded border border-amber-300/20 bg-amber-300/5 p-4" data-responsive-check="start-arsenal-events">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-200">Arsenal event</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {eventSummary.newPitchTypes.map((type) => (
          <span key={`new-${type}`} className="inline-flex min-h-7 items-center rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-100">
            New {pitchTypes[type].name}
          </span>
        ))}
        {eventSummary.usageShifts.map((shift) => (
          <span key={`shift-${shift.type}`} className="inline-flex min-h-7 items-center rounded-full border border-white/10 bg-black/25 px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-300">
            {pitchTypes[shift.type].name} {formatSignedPct(shift.usageDeltaPct)} usage
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-zinc-400">
        Compared with prior archived starts for this pitcher.
      </p>
    </section>
  );
}

function QualityMetric({ label, value, tone = "muted" }: { label: string; value: string; tone?: "strong" | "muted" }) {
  return (
    <div className={`rounded border p-3 ${tone === "strong" ? "border-amber-300/25 bg-amber-300/10" : "border-white/10 bg-black/20"}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className={`mt-1 font-serif text-3xl font-semibold ${tone === "strong" ? "text-amber-200" : "text-zinc-50"}`}>{value}</p>
    </div>
  );
}

function formatPct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatSignedPct(value: number) {
  return `${value > 0 ? "+" : ""}${value}`;
}

function matchesCountFilter(pitch: Pick<PitchEvent | StartApiPitchSequenceRow, "count">, filter: CountFilter) {
  if (filter === "all") return true;
  if (filter === "twoStrike") return pitch.count.strikes === 2;
  if (filter === "ahead") return pitch.count.strikes > pitch.count.balls;
  if (filter === "behind") return pitch.count.balls > pitch.count.strikes;
  return pitch.count.balls === pitch.count.strikes;
}

function ControlGroup({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <div className="flex flex-wrap gap-2" data-responsive-check="pitch-chart-controls">{children}</div>
    </div>
  );
}
