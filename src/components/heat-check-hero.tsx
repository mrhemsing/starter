import Link from "next/link";
import type { CSSProperties } from "react";
import { FormDriverChips } from "@/components/form-driver-chips";
import { FormSparkline } from "@/components/form-visuals";
import { HeatHighlightModal } from "@/components/heat-highlight-modal";
import { HEAT_BANDS, HOME_CONFIG } from "@/lib/form-tokens";
import type { FormHomeResponse, FormSummary, HeatBand } from "@/lib/types";

export function HeatCheckHero({ home }: { home: FormHomeResponse }) {
  return (
    <section className="px-2 py-8 sm:px-6 lg:px-8" data-responsive-check="heat-check-hero">
      <div className="mx-auto max-w-7xl rounded border border-white/10 bg-[#101014] p-2 sm:p-6">
        <div className="mb-5 flex flex-col justify-between gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-amber-300">Rolling form trend</p>
            <h2 className="mt-2 font-serif text-3xl font-bold text-zinc-50">Who&apos;s Hot, Who&apos;s Not</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Last {home.window} qualified starts, movement, and next probable start context.</p>
            <p className={`mt-2 font-mono text-[10px] uppercase tracking-[0.16em] ${home.stale ? "text-amber-300" : "text-zinc-500"}`} title={home.latestScoredStartDate ? `Latest scored start date: ${home.latestScoredStartDate}` : undefined}>
              Form through {home.formThroughDate ?? "pending"}{home.stale ? " / updating" : ""}
            </p>
          </div>
          <Link href="/heat-check" className="inline-flex min-h-11 items-center rounded border border-amber-300/40 px-3 font-mono text-xs uppercase tracking-[0.16em] text-amber-300">
            See the full board
          </Link>
        </div>

        {home.totalQualified === 0 ? (
          <div className="rounded border border-white/10 bg-black/20 p-5">
            <p className="font-mono text-sm text-zinc-300">No qualified form sample yet. Check today&apos;s probables while the season settles.</p>
          </div>
        ) : (
          <>
            <LeagueTempStrip home={home} />
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <HeatRail title="On fire & hot" tone="hot" pitchers={home.hot} window={home.window} leagueMeanGS={home.leagueMeanGS} />
              <HeatRail title="Cooling & ice cold" tone="cold" pitchers={home.cold} window={home.window} leagueMeanGS={home.leagueMeanGS} />
            </div>
            {home.totalQualified < HOME_CONFIG.railSize * 4 ? (
              <p className="mt-4 font-mono text-xs text-zinc-500">Form stabilizes after a few starts. Sample is still small.</p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function LeagueTempStrip({ home }: { home: FormHomeResponse }) {
  return (
    <div>
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">League temperature / {home.totalQualified} qualified starters</p>
      <div className="flex h-8 gap-0.5 overflow-hidden rounded" role="img" aria-label={`League temperature across ${home.totalQualified} qualified starters`}>
        {HEAT_BANDS.map((band) => {
          const count = home.bands[band.key];
          const width = home.totalQualified > 0 ? (count / home.totalQualified) * 100 : 0;
          return (
            <Link
              key={band.key}
              href={`/heat-check?band=${band.key}`}
              className="flex min-w-[2px] items-center justify-center font-mono text-xs font-semibold text-[#101014]"
              style={{ width: `${width}%`, backgroundColor: band.color }}
              aria-label={`${band.label}: ${count} pitchers`}
            >
              {width >= 7 ? count : null}
            </Link>
          );
        })}
      </div>
      <div className="mt-3 grid gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500 sm:grid-cols-5">
        {HEAT_BANDS.map((band) => (
          <Link key={band.key} href={`/heat-check?band=${band.key}`} className="flex items-center justify-between gap-2 rounded border border-white/10 px-2 py-1" aria-label={`${band.label}: ${home.bands[band.key]} of ${home.totalQualified} qualified starters`}>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: band.color }} />
              {band.label}
            </span>
            <span className="whitespace-nowrap text-zinc-300">{home.bands[band.key]}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function HeatRail({ title, tone, pitchers, window, leagueMeanGS }: { title: string; tone: "hot" | "cold"; pitchers: FormSummary[]; window: number; leagueMeanGS: number }) {
  const toneColor = tone === "hot" ? HEAT_BANDS[0].color : HEAT_BANDS[HEAT_BANDS.length - 1].color;
  const railMarker = tone === "hot" ? "▲" : "▼";
  const railIntensity = Math.max(
    0,
    ...pitchers.map((pitcher) => heatIntensity(pitcher.heatIndex ?? 0, levelBandFor(pitcher)).value),
  );
  const railStyle = tone === "hot"
    ? ({ "--rail-burn": railIntensity } as CSSProperties)
    : ({ "--rail-chill": railIntensity } as CSSProperties);

  return (
    <section className="rounded border border-white/10 bg-black/20 p-1 sm:p-3" style={{ borderTopColor: toneColor, borderTopWidth: 3 }}>
      <div className={`heat-rail-heading mb-3 flex items-center gap-2 ${tone}`} style={railStyle}>
        <span className="font-mono text-sm font-semibold" style={{ color: toneColor }}>{railMarker}</span>
        <h3 className="font-mono text-xs uppercase tracking-[0.18em]" style={{ color: toneColor }}>{title}</h3>
      </div>
      <div className="space-y-2">
        {pitchers.map((pitcher) => <HeatRow key={pitcher.pitcherId} pitcher={pitcher} window={window} leagueMeanGS={leagueMeanGS} />)}
      </div>
    </section>
  );
}

function HeatRow({ pitcher, window, leagueMeanGS }: { pitcher: FormSummary; window: number; leagueMeanGS: number }) {
  const band = levelBandFor(pitcher);
  const nextStart = nextStartDetails(pitcher);
  const tone = heatTone(band);
  const teamColors = teamColor(pitcher.team);
  const intensity = heatIntensity(pitcher.heatIndex ?? 0, band);
  const cardStyle = intensity.mode === "fire"
    ? ({ "--burn": intensity.value } as CSSProperties)
    : intensity.mode === "ice"
      ? ({ "--chill": intensity.value } as CSSProperties)
      : undefined;
  const cardClassName = [
    "heat-intensity-card group relative grid grid-cols-[92px_minmax(0,1fr)] gap-x-3.5 gap-y-3 overflow-hidden rounded-2xl border border-[#26262c] bg-[#141418] p-3.5 transition hover:border-white/20 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 sm:grid-cols-[92px_minmax(0,1fr)] sm:rounded",
    intensity.mode === "fire" ? "fire" : "",
    intensity.mode === "ice" ? "ice" : "",
  ].filter(Boolean).join(" ");

  return (
    <article
      className={cardClassName}
      style={cardStyle}
      data-responsive-check="heat-row"
    >
      <Link
        href={`/pitchers/${pitcher.pitcherId}/form?window=${window}`}
        scroll
        className="absolute inset-0 z-20 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:rounded"
        aria-label={`Open ${pitcher.name} form page`}
      />
      <HeatCardEffects intensity={intensity} />
      <div
        className="heat-photo pointer-events-none relative z-30 h-[118px] w-[92px] overflow-hidden rounded-xl bg-[#23232a] shadow-[0_4px_14px_rgba(0,0,0,0.4)]"
        style={{ background: `linear-gradient(160deg, ${teamColors.primary}, #16161b)`, boxShadow: `inset 0 0 0 2px ${teamColors.accent}, 0 4px 14px rgba(0,0,0,0.4)` }}
      >
        {HOME_CONFIG.showHeadshots ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://img.mlbstatic.com/mlb-photos/image/upload/w_240,q_auto:best/v1/people/${pitcher.pitcherId}/headshot/67/current`}
            alt={`${pitcher.name}, ${pitcher.team} ${handednessLabel(pitcher.throws)}`}
            className="relative z-10 h-full w-full object-cover object-top"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-mono text-xl font-semibold text-zinc-300">{initials(pitcher.name)}</span>
        )}
        <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-b from-transparent from-[55%] to-black/35" />
        <div className="heat-photo-tint pointer-events-none absolute inset-0 z-0" />
      </div>

      <div className="pointer-events-none relative z-30 flex min-h-[118px] min-w-0 flex-col justify-between">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-start gap-2">
              <p className="min-w-0 text-lg font-bold leading-[1.1] text-zinc-100">{pitcher.name}</p>
              {pitcher.highlight ? (
                <span className="pointer-events-auto relative z-40">
                  <HeatHighlightModal highlight={pitcher.highlight} pitcherName={pitcher.name} />
                </span>
              ) : null}
            </div>
            <span className="mt-1 block font-mono text-[11px] uppercase tracking-[0.12em] text-[#7d7d86]">{pitcher.team} · {handednessLabel(pitcher.throws)}</span>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full border px-2 py-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: tone.accent, borderColor: tone.border, backgroundColor: tone.background }}>
            {statusLabel(band)}
          </span>
        </div>

        <div className="flex items-baseline gap-0.5 min-[360px]:gap-1.5" aria-label={`RGS ${pitcher.rgs.toFixed(1)}, movement ${formatSignedDecimal(pitcher.deltaForm)}`}>
          <p className="font-mono text-[26px] font-extrabold leading-none tracking-normal tabular-nums min-[360px]:text-[36px]" style={{ color: tone.scoreColor }}>{pitcher.rgs.toFixed(1)}</p>
          <p className="whitespace-nowrap font-mono text-[10px] font-semibold tracking-normal min-[360px]:text-sm" style={{ color: tone.deltaColor }}>{trendMarker(pitcher.deltaForm)} {formatSignedDecimal(pitcher.deltaForm)}</p>
          <p className="ml-auto self-end pb-1 font-mono text-[7px] uppercase tracking-[0.14em] text-[#56565e] min-[360px]:text-[10.5px]">RGS</p>
        </div>

        <HeatMeter heatIndex={pitcher.heatIndex ?? 0} band={band} deltaForm={pitcher.deltaForm} />
        <FormSparkline
          values={pitcher.spark}
          tier={pitcher.tier}
          leagueMeanGS={leagueMeanGS}
          label={`${pitcher.name} recent GS+: ${pitcher.spark.join(", ")}`}
          trend={pitcher.trend}
          variant="mini"
        />
        <FormDriverChips chips={pitcher.driverChips} compact />
      </div>

      <div className="pointer-events-none relative z-30 col-span-full mt-1 flex items-center justify-between gap-3 border-t border-[#26262c] pt-3 font-mono text-[11px] uppercase tracking-[0.12em]">
        <p className="text-[#56565e]">Next start</p>
        <p className="truncate font-semibold text-[#f3f3f5]">{nextStart}</p>
      </div>
    </article>
  );
}

function HeatCardEffects({ intensity }: { intensity: HeatIntensity }) {
  if (intensity.mode === "fire") {
    return (
      <>
        <span aria-hidden="true" className="heat-flames" />
        {intensity.value >= 0.88 ? <span aria-hidden="true" className="heat-shimmer" /> : null}
        {intensity.value >= 0.7 ? (
          <>
            <span aria-hidden="true" className="heat-ember left-[16%] [animation-delay:.2s]" />
            <span aria-hidden="true" className="heat-ember left-[44%] [animation-delay:.9s]" />
            <span aria-hidden="true" className="heat-ember left-[72%] [animation-delay:1.4s]" />
          </>
        ) : null}
      </>
    );
  }

  if (intensity.mode === "ice") {
    return (
      <>
        <span aria-hidden="true" className="heat-frost" />
        <span aria-hidden="true" className="heat-icicles">
          {[14, 8, 20, 7, 13, 9, 18, 7, 11, 16].map((height, index) => (
            <i key={index} style={{ height }} />
          ))}
        </span>
      </>
    );
  }

  return null;
}

function nextStartDetails(pitcher: FormSummary) {
  if (!pitcher.nextStart) return "TBD";
  if (!pitcher.nextStart.opponent || !isValidDate(pitcher.nextStart.date)) return "TBD";
  const matchup = pitcher.nextStart.side === "away" ? `@${pitcher.nextStart.opponent}` : `vs ${pitcher.nextStart.opponent}`;
  return `${matchup} · ${formatShortDate(pitcher.nextStart.date)}`;
}

function statusLabel(band: HeatBand) {
  if (band.key === "onfire") return "🔥 ON FIRE";
  if (band.key === "hot") return "HOT";
  return band.label;
}

function handednessLabel(throws: FormSummary["throws"]) {
  if (throws === "R") return "RHP";
  if (throws === "L") return "LHP";
  return "Hand TBD";
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

function isValidDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf());
}

function formatSigned(value: number) {
  const rounded = Math.round(value);
  if (rounded > 0) return `+${rounded}`;
  return String(rounded);
}

function formatSignedDecimal(value: number) {
  const rounded = value.toFixed(1);
  if (value > 0) return `+${rounded}`;
  return rounded;
}

function trendMarker(value: number) {
  if (value > 0) return "↑";
  if (value < 0) return "↓";
  return "→";
}

type HeatIntensity = { mode: "fire" | "ice" | "neutral"; value: number };

function heatIntensity(heatIndex: number, band: HeatBand): HeatIntensity {
  if (band.key === "onfire" || band.key === "hot") {
    return { mode: "fire", value: clamp((heatIndex - 57) / 35, 0.28, 0.95) };
  }

  if (band.key === "cooling" || band.key === "ice") {
    return { mode: "ice", value: clamp((43 - heatIndex) / 32, 0.28, 0.95) };
  }

  return { mode: "neutral", value: 0 };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function heatTone(band: HeatBand) {
  if (band.key === "onfire") {
    return {
      accent: "#ff6a2b",
      background: "rgba(255,106,43,0.08)",
      border: "rgba(255,106,43,0.4)",
      deltaColor: "#2ee6c5",
      fillFrom: "#b53a12",
      fillTo: "#ff6a2b",
      scoreColor: "#ff6a2b",
    };
  }

  if (band.key === "hot") {
    return {
      accent: "#2ee6c5",
      background: "rgba(46,230,197,0.08)",
      border: "rgba(46,230,197,0.4)",
      deltaColor: "#2ee6c5",
      fillFrom: "#127d6c",
      fillTo: "#2ee6c5",
      scoreColor: "#f3f3f5",
    };
  }

  if (band.key === "cooling" || band.key === "ice") {
    return {
      accent: "#4aa3ff",
      background: "rgba(74,163,255,0.08)",
      border: "rgba(74,163,255,0.4)",
      deltaColor: "#4aa3ff",
      fillFrom: "#1c4c8c",
      fillTo: "#4aa3ff",
      scoreColor: "#f3f3f5",
    };
  }

  return {
    accent: band.color,
    background: "rgba(136,135,128,0.08)",
    border: "rgba(136,135,128,0.35)",
    deltaColor: "#a1a1aa",
    fillFrom: "#56565e",
    fillTo: "#888780",
    scoreColor: "#f3f3f5",
  };
}

function levelBandFor(pitcher: FormSummary) {
  return HEAT_BANDS.find((band) => band.key === pitcher.tier) ?? HEAT_BANDS[HEAT_BANDS.length - 1];
}

const TEAM_COLORS: Record<string, { primary: string; accent: string }> = {
  ARI: { primary: "#a71930", accent: "#e3d4ad" },
  ATL: { primary: "#13274f", accent: "#ce1141" },
  BAL: { primary: "#df4601", accent: "#000000" },
  BOS: { primary: "#bd3039", accent: "#0c2340" },
  CHC: { primary: "#0e3386", accent: "#cc3433" },
  CIN: { primary: "#c6011f", accent: "#ffffff" },
  CLE: { primary: "#00385d", accent: "#e50022" },
  COL: { primary: "#33006f", accent: "#c4ced4" },
  CWS: { primary: "#27251f", accent: "#c4ced4" },
  DET: { primary: "#0c2340", accent: "#fa4616" },
  HOU: { primary: "#002d62", accent: "#eb6e1f" },
  KC: { primary: "#004687", accent: "#bd9b60" },
  LAA: { primary: "#ba0021", accent: "#003263" },
  LAD: { primary: "#005a9c", accent: "#ef3e42" },
  MIA: { primary: "#00a3e0", accent: "#ef3340" },
  MIL: { primary: "#12284b", accent: "#ffc52f" },
  MIN: { primary: "#002b5c", accent: "#d31145" },
  NYM: { primary: "#002d72", accent: "#ff5910" },
  NYY: { primary: "#0c2340", accent: "#c4ced4" },
  OAK: { primary: "#003831", accent: "#efb21e" },
  PHI: { primary: "#e81828", accent: "#002d72" },
  PIT: { primary: "#27251f", accent: "#fdb827" },
  SD: { primary: "#2f241d", accent: "#ffc425" },
  SEA: { primary: "#0c2c56", accent: "#005c5c" },
  SF: { primary: "#fd5a1e", accent: "#27251f" },
  STL: { primary: "#c41e3a", accent: "#0c2340" },
  TB: { primary: "#092c5c", accent: "#8fbce6" },
  TEX: { primary: "#003278", accent: "#c0111f" },
  TOR: { primary: "#134a8e", accent: "#e8291c" },
  WSH: { primary: "#ab0003", accent: "#14225a" },
};

function teamColor(team: string) {
  return TEAM_COLORS[team] ?? { primary: "#23232a", accent: "#56565e" };
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function HeatMeter({ heatIndex, band, deltaForm }: { heatIndex: number; band: HeatBand; deltaForm: number }) {
  const position = Math.max(0, Math.min(100, heatIndex));
  const tone = heatTone(band);

  return (
    <div role="img" aria-label={`Heat Index ${heatIndex} on the 0 to 100 scale, ${band.label}, movement ${formatSigned(deltaForm)}`}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 font-mono text-[10.5px] uppercase tracking-[0.1em] text-[#7d7d86]">
        <span>Heat</span>
        <span className="font-semibold text-[#f3f3f5]">
          {heatIndex}<span className="ml-1.5" style={{ color: tone.deltaColor }}>{formatSigned(deltaForm)}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#1f1f25]">
        <div
          className="h-full rounded-full"
          style={{ width: `${position}%`, background: `linear-gradient(90deg, ${tone.fillFrom}, ${tone.fillTo})` }}
        />
      </div>
    </div>
  );
}
