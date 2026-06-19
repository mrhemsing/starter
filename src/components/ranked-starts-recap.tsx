import Link from "next/link";
import { Headshot } from "@/components/headshot";
import { HeatHighlightModal } from "@/components/heat-highlight-modal";
import { PitcherChip } from "@/components/pitcher-chip";
import { MetaLine, StartLineText } from "@/components/wrap-safe-text";
import { qualityTierOf } from "@/lib/form-tokens";
import { formatStartLine } from "@/lib/format";
import { inningsFromIP } from "@/lib/innings";
import { rankedStartsPath, sourceParams, startHref } from "@/lib/routes";
import type { FeaturedStartHighlight, StartSummary } from "@/lib/types";

type RankedStartsRecapProps = {
  date: string;
  label?: string;
  starts: StartSummary[];
  highlights?: Map<string, FeaturedStartHighlight | null>;
};

export function RankedStartsRecap({ date, label = "Yesterday", starts, highlights }: RankedStartsRecapProps) {
  const settledStarts = starts
    .filter((start) => start.source?.line !== "fixture")
    .sort((a, b) => b.gameScorePlus - a.gameScorePlus || inningsFromIP(b.line.inningsPitched) - inningsFromIP(a.line.inningsPitched) || a.pitcher.name.localeCompare(b.pitcher.name))
    .map((start, index) => ({ ...start, rank: index + 1 }));
  const topStarts = settledStarts.slice(0, 5);
  const listStarts = topStarts;
  const duds = settledStarts.slice(-3);
  const slateAverage = average(settledStarts.map((start) => start.gameScorePlus));

  return (
    <section id="slate" className="border-y border-white/10 bg-[#0c0b09] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col justify-between gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-amber-300">Settled results / {label} / {formatShortDate(date)}</p>
            <h2 className="mt-2 font-serif text-4xl font-bold text-zinc-50">Ranked Starts Recap</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Final starter lines only: {settledStarts.length} scored starts from the completed slate, ranked by GS+.
            </p>
          </div>
          <Link href={rankedStartsPath(date)} className="inline-flex min-h-11 items-center rounded border border-amber-300/40 px-3 font-mono text-xs uppercase tracking-[0.16em] text-amber-300">
            See all {settledStarts.length} starts
          </Link>
        </div>

        {settledStarts.length === 0 ? (
          <div className="rounded border border-white/10 bg-[#101014] p-6" data-responsive-check="completed-start-empty">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">Games in progress</p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
              The most recent settled slate will appear here after final MLB gamefeed data is available. No old demo or fixture starts are used.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-start">
            <SlateSwarm starts={settledStarts} mean={slateAverage} />
            <div className="space-y-4">
              <div className="grid gap-2">
                {listStarts.map((start) => <TopStartRow key={start.id} start={start} highlight={highlights?.get(start.id) ?? null} />)}
              </div>
              {duds.length > 0 ? <Duds starts={duds} /> : null}
            </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function SlateSwarm({ starts, mean }: { starts: StartSummary[]; mean: number }) {
  const width = 760;
  const stripHeight = 166;
  const scatterHeight = 600;
  const stripPad = { left: 36, right: 24, top: 24, bottom: 34 };
  const scatterPad = { left: 48, right: 30, top: 42, bottom: 46 };
  const stripMin = 18;
  const stripMax = 82;
  const axisY = stripHeight - stripPad.bottom;
  const stripXFor = (score: number) => stripPad.left + ((score - stripMin) / (stripMax - stripMin)) * (width - stripPad.left - stripPad.right);
  const scatterXFor = (score: number) => scatterPad.left + (clamp(score, 0, 100) / 100) * (width - scatterPad.left - scatterPad.right);
  const maxInnings = Math.max(9, ...starts.map((start) => inningsFromIP(start.line.inningsPitched)));
  const yFor = (innings: number) => scatterPad.top + ((maxInnings - innings) / maxInnings) * (scatterHeight - scatterPad.top - scatterPad.bottom);
  const levels = [0, -1, 1, -2, 2, -3, 3];
  const placed: Array<{ start: StartSummary; x: number; y: number; level: number }> = [];

  for (const start of [...starts].sort((a, b) => a.gameScorePlus - b.gameScorePlus || a.pitcher.name.localeCompare(b.pitcher.name))) {
    const x = stripXFor(start.gameScorePlus);
    const level = levels.find((candidate) => placed.every((point) => Math.abs(point.x - x) > 17 || Math.abs(point.level - candidate) > 0)) ?? 0;
    placed.push({ start, x, y: axisY - 54 + level * 13, level });
  }

  const scatterPoints = [...starts]
    .sort((a, b) => a.gameScorePlus - b.gameScorePlus || inningsFromIP(a.line.inningsPitched) - inningsFromIP(b.line.inningsPitched) || a.pitcher.name.localeCompare(b.pitcher.name))
    .map((start) => {
      const seed = stableHash(start.pitcher.id || start.id);
      const xDodge = ((seed % 5) - 2) * 3.2;
      const yDodge = ((Math.floor(seed / 5) % 5) - 2) * 3.2;
      const innings = inningsFromIP(start.line.inningsPitched);
      return {
        start,
        innings,
        x: clamp(scatterXFor(start.gameScorePlus) + xDodge, scatterPad.left + 8, width - scatterPad.right - 8),
        y: clamp(yFor(innings) + yDodge, scatterPad.top + 8, scatterHeight - scatterPad.bottom - 8),
      };
    });
  const topLabels = new Set(starts.slice(0, 2).map((start) => start.id));
  const worst = starts.at(-1);
  if (worst) topLabels.add(worst.id);
  const best = starts[0];
  const longest = starts.reduce<StartSummary | null>((winner, start) => {
    if (!winner) return start;
    return inningsFromIP(start.line.inningsPitched) > inningsFromIP(winner.line.inningsPitched) ? start : winner;
  }, null);
  if (longest && inningsFromIP(longest.line.inningsPitched) >= 9) topLabels.add(longest.id);
  const ariaLabel = `${starts.length} completed starts on ${starts[0]?.date ?? "the slate"}; average GS+ ${mean.toFixed(1)}, plotted by GS+ and innings pitched. Best ${best?.pitcher.name ?? "none"} at GS+ ${best?.gameScorePlus ?? 0}, worst ${worst?.pitcher.name ?? "none"} at GS+ ${worst?.gameScorePlus ?? 0}.`;

  return (
    <div className="self-start rounded border border-white/10 bg-[#101014] p-4 lg:min-h-[600px]" data-responsive-check="slate-swarm">
      <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Slate swarm</p>
          <h3 className="mt-1 font-serif text-2xl font-bold text-zinc-50">The day at a glance</h3>
        </div>
        <p className="font-mono text-xs text-zinc-500">avg {mean.toFixed(1)} GS+</p>
      </div>
      <div className="overflow-hidden sm:hidden">
        <svg className="h-[166px] w-full" viewBox={`0 0 ${width} ${stripHeight}`} role="img" aria-label={ariaLabel}>
          {[20, 30, 40, 50, 60, 70, 80].map((tick) => (
            <g key={tick}>
              <line x1={stripXFor(tick)} x2={stripXFor(tick)} y1={stripPad.top} y2={axisY} stroke="#27272a" />
              <text x={stripXFor(tick)} y={stripHeight - 14} textAnchor="middle" fill="#71717a" fontSize="11">{tick}</text>
            </g>
          ))}
          <line x1={stripPad.left} x2={width - stripPad.right} y1={axisY} y2={axisY} stroke="#3f3f46" />
          <line x1={stripXFor(mean)} x2={stripXFor(mean)} y1={stripPad.top} y2={axisY} stroke="#a1a1aa" strokeDasharray="4 5" />
          <text x={Math.min(width - 118, stripXFor(mean) + 8)} y={stripPad.top + 12} fill="#a1a1aa" fontSize="12">avg {mean.toFixed(1)} GS+</text>
          {placed.map(({ start, x, y }) => {
            const tier = qualityTierOf(start.gameScorePlus);
            const label = lastName(start.pitcher.name);
            const shouldLabel = topLabels.has(start.id);
            const labelAbove = start.rank <= 2;
            const labelX = Math.min(width - 74, Math.max(stripPad.left + 6, x + (labelAbove ? 10 : -58)));
            const labelY = labelAbove ? Math.max(18, y - 18 - start.rank * 10) : Math.min(axisY - 10, y + 22);
            return (
              <a key={start.id} href={startHref(start, sourceParams("home"))} aria-label={`${start.pitcher.name}, ${start.pitcher.team}, ${formatStartLine(start.line)}, ${tier.label}, GS+ ${start.gameScorePlus}`}>
                <circle cx={x} cy={y} r={starts.length > 24 ? 7.5 : 8.5} fill={tier.color} stroke="#08080a" strokeWidth="2">
                  <title>{`${start.pitcher.name} (${start.pitcher.team}) / ${tier.label} / ${formatStartLine(start.line)} / GS+ ${start.gameScorePlus}`}</title>
                </circle>
                {shouldLabel ? (
                  <>
                    <line x1={x} y1={y - 8} x2={labelX} y2={labelY + 4} stroke={tier.color} strokeOpacity="0.65" />
                    <text x={labelX} y={labelY} fill={tier.color} fontSize="11" fontWeight="700">{label}</text>
                  </>
                ) : null}
              </a>
            );
          })}
        </svg>
      </div>
      <div className="hidden overflow-hidden sm:block">
        <svg className="h-[430px] w-full lg:h-[512px]" viewBox={`0 0 ${width} ${scatterHeight}`} role="img" aria-label={ariaLabel}>
          <rect x={scatterPad.left} y={scatterPad.top} width={width - scatterPad.left - scatterPad.right} height={scatterHeight - scatterPad.top - scatterPad.bottom} fill="#0b0b0e" opacity="0.58" />
          {[20, 40, 60, 80].map((tick) => (
            <g key={`x-${tick}`}>
              <line x1={scatterXFor(tick)} x2={scatterXFor(tick)} y1={scatterPad.top} y2={scatterHeight - scatterPad.bottom} stroke="#27272a" />
              <text x={scatterXFor(tick)} y={scatterHeight - 16} textAnchor="middle" fill="#71717a" fontSize="11">{tick}</text>
            </g>
          ))}
          {[0, 3, 6, 9].map((tick) => (
            <g key={`y-${tick}`}>
              <line x1={scatterPad.left} x2={width - scatterPad.right} y1={yFor(tick)} y2={yFor(tick)} stroke="#27272a" />
              <text x={scatterPad.left - 12} y={yFor(tick) + 4} textAnchor="end" fill="#71717a" fontSize="11">{tick}</text>
            </g>
          ))}
          <line x1={scatterPad.left} x2={width - scatterPad.right} y1={scatterHeight - scatterPad.bottom} y2={scatterHeight - scatterPad.bottom} stroke="#3f3f46" />
          <line x1={scatterPad.left} x2={scatterPad.left} y1={scatterPad.top} y2={scatterHeight - scatterPad.bottom} stroke="#3f3f46" />
          <line x1={scatterXFor(mean)} x2={scatterXFor(mean)} y1={scatterPad.top} y2={scatterHeight - scatterPad.bottom} stroke="#a1a1aa" strokeDasharray="4 5" />
          <line x1={scatterPad.left} x2={width - scatterPad.right} y1={yFor(5)} y2={yFor(5)} stroke="#a1a1aa" strokeDasharray="4 5" opacity="0.9" />
          <text x={Math.min(width - 122, scatterXFor(mean) + 8)} y={scatterPad.top + 16} fill="#a1a1aa" fontSize="12">avg {mean.toFixed(1)} GS+</text>
          <text x={width - scatterPad.right - 88} y={yFor(5) - 8} fill="#a1a1aa" fontSize="12">5.0 IP</text>
          <text x={(scatterPad.left + width - scatterPad.right) / 2} y={scatterHeight - 4} textAnchor="middle" fill="#71717a" fontSize="11" fontFamily="monospace">GS+</text>
          <text x="14" y={(scatterPad.top + scatterHeight - scatterPad.bottom) / 2} textAnchor="middle" fill="#71717a" fontSize="11" fontFamily="monospace" transform={`rotate(-90 14 ${(scatterPad.top + scatterHeight - scatterPad.bottom) / 2})`}>IP</text>
          {scatterPoints.map(({ start, x, y }) => {
            const band = qualityTierOf(start.gameScorePlus);
            const isFeatured = start.rank === 1;
            const color = isFeatured ? "#facc15" : band.color;
            const label = lastName(start.pitcher.name);
            const shouldLabel = topLabels.has(start.id);
            const labelX = Math.min(width - 82, Math.max(scatterPad.left + 8, x + (start.rank <= 2 ? 13 : -58)));
            const labelY = Math.min(scatterHeight - scatterPad.bottom - 10, Math.max(scatterPad.top + 16, y + (start.rank <= 2 ? -14 : 22)));
            const line = formatStartLine(start.line);
            return (
              <a key={start.id} href={startHref(start, sourceParams("home"))} aria-label={`${start.pitcher.name}, ${start.pitcher.team}, ${line}, GS+ ${start.gameScorePlus}, ${band.label}`}>
                {isFeatured ? <circle cx={x} cy={y} r="13" fill="none" stroke="#fde68a" strokeWidth="2" opacity="0.9" /> : null}
                <circle cx={x} cy={y} r={isFeatured ? 8.8 : 7.4} fill={color} stroke="#08080a" strokeWidth="2">
                  <title>{`${start.pitcher.name} (${start.pitcher.team}) / ${line} / GS+ ${start.gameScorePlus} / ${band.label}`}</title>
                </circle>
                {shouldLabel ? (
                  <>
                    <line x1={x} y1={y} x2={labelX} y2={labelY + 4} stroke={color} strokeOpacity="0.65" />
                    <text x={labelX} y={labelY} fill={color} fontSize="11" fontWeight="700">{label}</text>
                  </>
                ) : null}
              </a>
            );
          })}
        </svg>
      </div>
      <table className="sr-only">
        <caption>Ranked starts swarm data</caption>
        <tbody>
          {starts.map((start) => (
            <tr key={start.id}>
              <td>{start.pitcher.name}</td>
              <td>{start.pitcher.team}</td>
              <td>{start.gameScorePlus}</td>
              <td>{start.line.inningsPitched}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopStartRow({ start, highlight }: { start: StartSummary; highlight?: FeaturedStartHighlight | null }) {
  const tier = qualityTierOf(start.gameScorePlus);
  const profile = recapBandProfile(tier.label);
  const color = profile.scoreColor;
  const gas = isRecapGasStart(start, tier.label);

  return (
    <article
      className={`relative grid min-h-16 grid-cols-[38px_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded border px-3 py-2 transition hover:border-white/20 ${profile.borderClass}`}
      style={{ background: profile.background }}
      data-band={qualityBandSlug(tier.label)}
      data-gas={gas ? "true" : "false"}
    >
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: profile.rail }} aria-hidden="true" />
      <Link href={startHref(start, sourceParams("home"))} className="font-serif text-2xl text-zinc-500 hover:text-amber-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">#{start.rank}</Link>
      <Link href={startHref(start, sourceParams("home"))} className="grid min-w-0 grid-cols-[36px_minmax(0,1fr)] items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
        <Headshot playerId={start.pitcher.mlbId} name={start.pitcher.name} team={start.pitcher.team} size="sm" decorative className="ml-1 border-2" />
        <div className="min-w-0">
          <p className="pitcher-name font-serif text-lg font-bold leading-tight text-zinc-50">{start.pitcher.name}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
            <MetaLine segments={[start.pitcher.team, <StartLineText key="line" line={start.line} />]} />
          </p>
          {gas ? <span className="mt-1 inline-flex rounded border border-[#FF7A3D]/40 bg-[#FF7A3D]/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#F6C445]">GAS</span> : null}
        </div>
      </Link>
      <div className="flex items-center gap-2">
        {highlight ? (
          <HeatHighlightModal
            highlight={highlight}
            pitcherName={start.pitcher.name}
            className="grid h-11 w-11 place-items-center rounded-full border border-amber-300/35 bg-black/45 text-amber-200 shadow-sm transition hover:border-amber-300/70 hover:bg-amber-300/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          />
        ) : null}
        <Link href={startHref(start, sourceParams("home"))} className="text-right focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
          <span className="block font-mono text-3xl font-black tabular-nums leading-none" style={{ color }}>{start.gameScorePlus}</span>
          <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">GS+</span>
        </Link>
      </div>
    </article>
  );
}

function isRecapGasStart(start: StartSummary, bandLabel: string) {
  return (bandLabel === "Elite" || bandLabel === "Plus") && (start.line.strikeouts >= 8 || inningsFromIP(start.line.inningsPitched) >= 7);
}

function recapBandProfile(label: string) {
  if (label === "Elite" || label === "Plus") {
    return {
      scoreColor: "#F6C445",
      ringColor: label === "Elite" ? "#F6C445" : "#EF9F27",
      rail: "linear-gradient(180deg,#F6C445,#FF7A3D)",
      background: "linear-gradient(90deg,rgba(255,122,61,0.14),rgba(16,16,20,0.96) 42%,rgba(10,11,13,0.96))",
      borderClass: "border-[#F6C445]/25",
      plateBackground: "radial-gradient(circle at 50% 18%,rgba(246,196,69,0.22),rgba(10,11,13,0.92))",
    };
  }
  if (label === "Solid") {
    return {
      scoreColor: "#F5F2EA",
      ringColor: "#888780",
      rail: "#888780",
      background: "linear-gradient(90deg,rgba(136,135,128,0.08),rgba(16,16,20,0.96))",
      borderClass: "border-white/10",
      plateBackground: "rgba(21,24,28,0.95)",
    };
  }
  if (label === "Below") {
    return {
      scoreColor: "#85B7EB",
      ringColor: "#5BA8FF",
      rail: "rgba(91,168,255,0.64)",
      background: "linear-gradient(90deg,rgba(91,168,255,0.10),rgba(14,18,24,0.92))",
      borderClass: "border-white/10",
      plateBackground: "rgba(16,24,34,0.92)",
    };
  }
  return {
    scoreColor: "#5BA8FF",
    ringColor: "rgba(91,168,255,0.65)",
    rail: "rgba(91,168,255,0.42)",
    background: "linear-gradient(90deg,rgba(91,168,255,0.07),rgba(10,13,18,0.9))",
    borderClass: "border-white/5",
    plateBackground: "rgba(12,18,26,0.88)",
  };
}

function Duds({ starts, className = "" }: { starts: StartSummary[]; className?: string }) {
  return (
    <div className={`rounded border border-white/10 bg-black/20 p-3 ${className}`} data-responsive-check="ranked-start-duds">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">Rough ones</p>
      <div className="mt-2 grid gap-2">
        {starts.map((start) => {
          const tier = qualityTierOf(start.gameScorePlus);
          const color = tierDisplayColor(tier);
          return (
            <Link key={start.id} href={startHref(start, sourceParams("home"))} className="grid min-h-14 grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 rounded border border-white/5 bg-[#101014]/70 px-3 py-2 text-sm text-zinc-400">
              <span className="font-serif text-xl text-zinc-500">#{start.rank}</span>
              <PitcherChip
                pitcherId={String(start.pitcher.mlbId)}
                name={start.pitcher.name}
                team={`${start.pitcher.team} / ${formatStartLine(start.line)}`}
                size="sm"
              />
              <span className="shrink-0 font-mono" style={{ color }}>GS+ {start.gameScorePlus}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function lastName(name: string) {
  return name.trim().split(/\s+/).at(-1) ?? name;
}

function qualityBandSlug(label: string) {
  return label.toLowerCase().replace(/\s+/g, "-");
}

function stableHash(value: string) {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function tierDisplayColor(tier: { color: string; textCssVar?: string }) {
  return tier.textCssVar ? `var(${tier.textCssVar})` : tier.color;
}

function formatShortDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}
