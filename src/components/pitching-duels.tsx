import Link from "next/link";
import type { CSSProperties } from "react";
import { CtaArrowTail } from "@/components/cta-arrow";
import { FormSparkline, TrendChip, tierTextClass } from "@/components/form-visuals";
import { Headshot } from "@/components/headshot";
import { LocalTime } from "@/components/local-time";
import { HEAT_BANDS, tierOf } from "@/lib/form-tokens";
import { duelsPath } from "@/lib/routes";
import { slateTimeWord, slateTimeWordTitle } from "@/lib/time-words";
import type { PitchingDuel, PitchingDuelsResponse } from "@/lib/types";

export function PitchingDuelsModule({
  duels,
  title = "Best Pitching Duels",
  compact = false,
}: {
  duels: PitchingDuelsResponse;
  title?: string;
  compact?: boolean;
}) {
  if (compact) return <HomepagePitchingDuelsModule duels={duels} title={title} />;

  const shownDuels = duels.bestDuels.slice(0, 6);
  const shownMismatches = duels.mismatches.slice(0, 6);
  const boardHref = duels.mode === "settled" ? `${duelsPath(duels.date)}?mode=settled` : duelsPath(duels.date);

  if (shownDuels.length === 0 && shownMismatches.length === 0) return null;

  return (
    <section className="border-y border-white/10 bg-[#09090b] px-4 py-10 sm:px-6 lg:px-8" data-responsive-check="pitching-duels">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col justify-between gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-zinc-500">{duels.mode === "settled" ? "Last settled slate" : "Today"}</p>
            <h2 className="section-title mt-2 font-serif text-4xl font-bold text-zinc-50">{title}</h2>
            <p className="blurb mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Two lenses from the same game-level scores: best duel rewards two strong, even arms; mismatch rewards the biggest gap.
            </p>
          </div>
          <Link href={boardHref} className="inline-flex min-h-11 items-center rounded border border-amber-300/40 px-3 font-mono text-xs uppercase tracking-[0.16em] text-amber-300">
            Full duels board
          </Link>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <DuelList title="Best duels" duels={shownDuels} kind="best" />
          <DuelList title="Biggest mismatches" duels={shownMismatches} kind="mismatch" />
        </div>
      </div>
    </section>
  );
}

function HomepagePitchingDuelsModule({ duels, title }: { duels: PitchingDuelsResponse; title: string }) {
  const qualifyingDuels = duels.bestDuels.slice(0, 3);
  const fallbackDuels = duels.closestDuels.slice(0, 2);
  const displayDuels = qualifyingDuels.length > 0 ? qualifyingDuels : fallbackDuels;
  const hasBestDuel = qualifyingDuels.length > 0;
  const topMismatch = duels.mismatches[0] ?? null;
  const boardHref = duels.mode === "settled" ? `${duelsPath(duels.date)}?mode=settled` : duelsPath(duels.date);
  const slateWord = duels.mode === "settled" ? "last settled" : slateTimeWord({ date: duels.date });
  const slatePossessive = duels.mode === "settled" ? "the last settled slate" : `${slateWord}'s slate`;
  const desktopTitle = hasBestDuel ? title : `Closest matchups ${slateWord}`;
  const mobileTitle = hasBestDuel ? title.replace(/\s+today$/i, "") : "Closest matchups";

  if (displayDuels.length === 0 && !topMismatch) return null;

  return (
    <section className="border-y border-white/10 bg-[#09090b] px-4 py-10 sm:px-6 lg:px-8" data-responsive-check="pitching-duels" data-duel-mode={hasBestDuel ? "best" : "closest"}>
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col justify-between gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-zinc-500">{duels.mode === "settled" ? "Last settled slate" : slateTimeWordTitle({ date: duels.date })}</p>
            <h2 className="section-title mt-2 font-serif text-4xl font-bold text-zinc-50">
              <span className="sm:hidden">{mobileTitle}</span>
              <span className="hidden sm:inline">{desktopTitle}</span>
            </h2>
            <p className="blurb mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              The strongest, most evenly matched matchups on {slatePossessive}.
            </p>
          </div>
          <Link href={boardHref} className="inline-flex min-h-11 items-center rounded border border-amber-300/40 px-3 font-mono text-xs uppercase tracking-[0.16em] text-amber-300">
            Full duels board
          </Link>
        </div>
        {displayDuels.length > 0 ? (
          <div className={`grid gap-4 ${displayDuels.length === 1 ? "" : "lg:grid-cols-2"} ${displayDuels.length >= 3 ? "xl:grid-cols-3" : ""}`}>
            {displayDuels.map((duel, index) => (
              <DuelCard key={`homepage-duel-${duel.gamePk}`} duel={duel} rank={index + 1} kind={hasBestDuel ? "best" : "closest"} />
            ))}
          </div>
        ) : null}
        {topMismatch ? (
          <div className="mt-5 border-t border-white/10 pt-4">
            <Link href={boardHref} className="group/cta inline-flex min-h-9 items-center font-mono text-xs uppercase tracking-[0.14em] text-zinc-400 underline-offset-4 hover:text-amber-300 hover:underline">
              Biggest gap {slateWord}: {topMismatch.label} · {topMismatch.gap}-pt edge to {leadingTeam(topMismatch)}
              <CtaArrowTail className="ml-2" />
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DuelList({ title, duels, kind }: { title: string; duels: PitchingDuel[]; kind: "best" | "mismatch" }) {
  return (
    <div>
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">{title}</p>
      <div className="grid gap-3">
        {duels.map((duel, index) => <DuelCard key={`${kind}-${duel.gamePk}`} duel={duel} rank={index + 1} kind={kind} />)}
      </div>
    </div>
  );
}

function DuelCard({ duel, rank, kind }: { duel: PitchingDuel; rank: number; kind: "best" | "closest" | "mismatch" }) {
  const rankLabel = kind === "mismatch" ? "mismatch" : kind === "closest" ? "matchup" : "duel";
  const glowValue = kind === "mismatch" ? duel.gap : duel.combinedQuality;
  const glowMax = kind === "mismatch" ? 50 : 160;
  return (
    <article
      className="heat-glow-card rounded border border-white/10 bg-[#101014] p-4"
      data-first-pitch={duel.firstPitch ?? undefined}
      style={duelGlowStyle(glowValue, glowMax)}
    >
      <div className="flex flex-col justify-between gap-3 border-b border-white/10 pb-3 md:flex-row md:items-start">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-300">#{rank} {rankLabel}</p>
          <h3 className="card-title mt-1 font-serif text-2xl font-bold text-zinc-50">{duel.label}</h3>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.12em] text-zinc-500">
            {duel.park ?? "Venue TBD"}
            {duel.firstPitch ? (
              <>
                <span className="mx-2 text-zinc-700">/</span>
                Start{" "}
                <LocalTime value={duel.firstPitch} fallback={formatFirstPitch(duel.firstPitch)} />
              </>
            ) : null}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 font-mono text-xs">
          <Stat label="Combined" value={String(duel.combinedQuality)} />
          <Stat label="Gap" value={String(duel.gap)} tone={kind === "mismatch" ? "amber" : "neutral"} />
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {duel.starters.map((starter) => <DuelStarterCard key={`${duel.gamePk}-${starter.pitcherId}-${starter.team}`} starter={starter} />)}
      </div>
    </article>
  );
}

function DuelStarterCard({ starter }: { starter: PitchingDuel["starters"][number] }) {
  const color = tierOf(starter.score).color;
  return (
    <Link href={starter.href} className="min-w-0 rounded border border-white/10 bg-black/20 p-3 transition hover:border-amber-300/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Headshot playerId={starter.pitcherId} name={starter.name} team={starter.team} size="sm" band={starter.tier ?? null} decorative className="ml-1" />
          <div className="min-w-0">
            <p className="pitcher-name text-sm font-medium leading-tight text-zinc-100">{starter.name}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{starter.team}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className={`font-mono text-sm ${starter.tier ? tierTextClass(starter.tier) : ""}`} style={!starter.tier ? { color } : undefined}>{starter.scoreLabel} {starter.score}</p>
        </div>
      </div>
      {starter.trend && starter.deltaForm !== undefined ? <div className="mt-2"><TrendChip summary={{ trend: starter.trend, deltaForm: starter.deltaForm }} compact /></div> : null}
      {starter.spark && starter.tier ? (
        <div className="mt-3">
          <FormSparkline values={starter.spark} tier={starter.tier} leagueMeanGS={50} label={`${starter.name} recent form GS+: ${starter.spark.join(", ")}`} />
        </div>
      ) : null}
    </Link>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "amber" }) {
  const numericValue = Number(value);
  return (
    <div className="rounded border border-white/10 bg-black/20 px-3 py-2 text-right" style={Number.isFinite(numericValue) ? duelGlowStyle(numericValue, label === "Combined" ? 160 : 50) : undefined}>
      <p className={tone === "amber" ? "text-amber-300" : "text-zinc-100"}>{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      {Number.isFinite(numericValue) ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
          <span className="heat-band-fill block h-full rounded-full" style={{ width: `${Math.max(5, Math.min(100, (numericValue / (label === "Combined" ? 160 : 50)) * 100))}%`, backgroundColor: duelGlowColor(numericValue, label === "Combined" ? 160 : 50) }} />
        </div>
      ) : null}
    </div>
  );
}

function duelGlowStyle(value: number, max: number) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return {
    "--heat-glow-color": colorToRgb(duelGlowColor(value, max)),
    "--heat-glow-opacity": (0.07 + pct * 0.2).toFixed(2),
  } as CSSProperties;
}

function duelGlowColor(value: number, max: number) {
  const pct = max > 0 ? value / max : 0;
  if (pct >= 0.6) return HEAT_BANDS[1].color;
  if (pct >= 0.36) return HEAT_BANDS[2].color;
  return HEAT_BANDS[3].color;
}

function leadingTeam(duel: PitchingDuel) {
  const [a, b] = duel.starters;
  if (a.score === b.score) return "EVEN";
  return a.score > b.score ? a.team : b.team;
}

function formatFirstPitch(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Time TBD";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: process.env.THE_BUMP_TIME_ZONE ?? "America/Los_Angeles",
    timeZoneName: "short",
  }).format(date).replace("PDT", "PT").replace("PST", "PT");
}

function colorToRgb(color: string) {
  const normalized = color.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}
