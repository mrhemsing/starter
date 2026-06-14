import Link from "next/link";
import type { CSSProperties } from "react";
import { FormSparkline, TrendChip, tierTextClass } from "@/components/form-visuals";
import { LocalTime } from "@/components/local-time";
import { HEAT_BANDS, watchTierForRank } from "@/lib/form-tokens";
import { formatStartLine } from "@/lib/format";
import type { TonightGame, TonightResponse, TonightStarter } from "@/lib/types";

const SITE_TIME_ZONE = process.env.THE_BUMP_TIME_ZONE ?? "America/Los_Angeles";

export function TonightsMustWatch({
  tonight,
  fullSlateHref,
  fullSlateLabel = "Full slate & probables",
  fullSlateAriaLabel,
  eyebrow = "Tonight",
  title = "Must-Watch",
  rankLabel = "tonight",
  previewLimit,
  sectionId = "must-watch",
}: {
  tonight: TonightResponse;
  fullSlateHref: string;
  fullSlateLabel?: string;
  fullSlateAriaLabel?: string;
  eyebrow?: string;
  title?: string;
  rankLabel?: string;
  previewLimit?: number;
  sectionId?: string;
}) {
  const shownGames = typeof previewLimit === "number" ? tonight.games.slice(0, previewLimit) : tonight.games;
  const headliner = shownGames[0];
  const rows = shownGames.slice(1);
  const headingId = `${sectionId}-heading`;

  return (
    <section id={sectionId} aria-labelledby={headingId} className="border-y border-white/10 bg-[#0d0d11] px-4 py-10 sm:px-6 lg:px-8" data-responsive-check="must-watch">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col justify-between gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-zinc-500">{eyebrow}</p>
            <h2 id={headingId} className="mt-2 font-serif text-4xl font-bold text-zinc-50">{title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              Ranked by starter form, pairing quality, and matchup context. Matchup values are shown with a slate rank, never as a bare number.
            </p>
          </div>
          <Link
            href={fullSlateHref}
            className="inline-flex min-h-11 items-center rounded border border-amber-300/40 px-3 font-mono text-xs uppercase tracking-[0.16em] text-amber-300"
            aria-label={fullSlateAriaLabel ?? fullSlateLabel}
          >
            {fullSlateLabel}
          </Link>
        </div>

        {!headliner ? (
          <div className="rounded border border-white/10 bg-[#101014] p-6" role="status" aria-label="Upcoming slate status">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">{tonight.scheduledGames > 0 ? "Slate complete" : "No games on this slate"}</p>
            <p className="mt-3 text-sm text-zinc-400">
              {tonight.scheduledGames > 0
                ? "No pregame matchups remain on this slate. Final games move into the ranked-start recap."
                : "The next probable slate will appear when MLB publishes it."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <MustWatchHeadliner game={headliner} leagueMeanGS={tonight.leagueMeanGS} slateSize={tonight.scheduledGames} rankLabel={rankLabel} />
            <div className="grid gap-3">
              {rows.map((game, index) => <MustWatchRow key={game.gamePk} game={game} rank={index + 2} slateSize={tonight.scheduledGames} leagueMeanGS={tonight.leagueMeanGS} rankLabel={rankLabel} />)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function MustWatchHeadliner({ game, leagueMeanGS, slateSize, rankLabel }: { game: TonightGame; leagueMeanGS: number; slateSize: number; rankLabel: string }) {
  const tier = watchTierForRank(1);
  const summaryId = watchCardSummaryId(game);
  const awayStarter = game.starters[0];
  const homeStarter = game.starters[1];
  const awayColor = teamAccentColor(awayStarter.team);
  const homeColor = teamAccentColor(homeStarter.team);

  return (
    <article
      className="heat-glow-card relative overflow-hidden rounded border border-amber-300/25 bg-[#101014] p-5 lg:p-6"
      style={{ ...glowStyle(game.gameWatchScore, 100), ...duelStyle(awayColor, homeColor) }}
      data-responsive-check="must-watch-headliner"
      aria-label={watchCardAriaLabel(game)}
      aria-describedby={summaryId}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgb(var(--away-rgb)/0.24),transparent_32%),radial-gradient(circle_at_82%_12%,rgb(var(--home-rgb)/0.24),transparent_30%),linear-gradient(90deg,rgb(var(--away-rgb)/0.13),transparent_35%,transparent_65%,rgb(var(--home-rgb)/0.13))]" />
      <div className="relative">
        <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-5 md:flex-row md:items-start">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em]" style={{ color: tier.color }}>#{game.status === "ppd" ? "-" : "1"} / {tier.label}</p>
            <h3 className="mt-2 font-serif text-4xl font-bold text-zinc-50 lg:text-5xl">{game.label}</h3>
            <p id={summaryId} className="mt-2 font-mono text-xs uppercase tracking-[0.16em] text-zinc-500" aria-label={watchCardSummaryAriaLabel(game)}>
              {gameStatusLabel(game.status)} / <LocalTime value={game.firstPitch} fallback={formatFirstPitch(game.firstPitch)} /> / {gameVenueLabel(game)} / #1 of {slateSize} watch rank
            </p>
          </div>
          <div className="rounded border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-left md:text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200">Best matchup on the board</p>
            <p className="mt-1 font-serif text-3xl font-black text-amber-100">#1 tonight</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(230px,0.78fr)_minmax(0,1fr)] lg:items-stretch">
          <DuelStarterPanel starter={awayStarter} leagueMeanGS={leagueMeanGS} align="away" />
          <MatchupSpine game={game} leagueMeanGS={leagueMeanGS} rankLabel={rankLabel} />
          <DuelStarterPanel starter={homeStarter} leagueMeanGS={leagueMeanGS} align="home" />
        </div>

        <WatchComponentReadout game={game} rankLabel={rankLabel} featured />
        <WatchFlagNote game={game} />
      </div>
    </article>
  );
}

function MustWatchRow({ game, rank, slateSize, leagueMeanGS, rankLabel }: { game: TonightGame; rank: number; slateSize: number; leagueMeanGS: number; rankLabel: string }) {
  const tier = watchTierForRank(rank);
  const summaryId = watchCardSummaryId(game);
  const isStarted = game.status === "live";

  return (
    <article
      className={`heat-glow-card relative overflow-hidden rounded border bg-[#101014] p-4 ${isStarted ? "border-sky-300/20 opacity-75" : "border-white/10"}`}
      style={{ ...glowStyle(game.gameWatchScore, 100), ...duelStyle(teamAccentColor(game.starters[0].team), teamAccentColor(game.starters[1].team)) }}
      data-responsive-check="must-watch-row"
      aria-label={watchCardAriaLabel(game)}
      aria-describedby={summaryId}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgb(var(--away-rgb)/0.11),transparent_35%,transparent_65%,rgb(var(--home-rgb)/0.11))]" />
      <div className="relative grid gap-4 lg:grid-cols-[86px_minmax(0,1fr)] lg:items-start">
        <div>
          <p className="font-serif text-3xl text-zinc-500">#{rank}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: tier.color }}>{tier.label}</p>
        </div>
        <div className="min-w-0">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <h3 className="font-serif text-2xl font-bold text-zinc-50">{game.label}</h3>
              <p id={summaryId} className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-zinc-500" aria-label={watchCardSummaryAriaLabel(game)}>
                {gameStatusLabel(game.status)} / <LocalTime value={game.firstPitch} fallback={formatFirstPitch(game.firstPitch)} /> / {gameVenueLabel(game)} / #{rank} of {slateSize} watch rank
              </p>
            </div>
            <p className="shrink-0 rounded border border-amber-300/25 bg-amber-300/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-200">
              {ordinal(game.matchupRankTonight)} matchup
            </p>
          </div>
          <WatchComponentReadout game={game} compact rankLabel={rankLabel} />
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {game.starters.map((starter) => <StarterMini key={`${game.gamePk}-${starter.side}`} starter={starter} leagueMeanGS={leagueMeanGS} />)}
          </div>
          <WatchFlagNote game={game} compact />
        </div>
      </div>
    </article>
  );
}

function WatchComponentReadout({ game, compact = false, featured = false, rankLabel }: { game: TonightGame; compact?: boolean; featured?: boolean; rankLabel: string }) {
  const items = [
    { label: "Top arm", value: game.watchComponents.topArm },
    { label: "Pairing", value: game.watchComponents.pairing },
    {
      label: "Matchup",
      value: game.matchupScore,
      detail: `${ordinal(game.matchupRankTonight)} ${rankLabel}`,
      ariaLabel: `Matchup score ${Math.round(game.matchupScore)}, ranked ${ordinal(game.matchupRankTonight)} ${rankLabel}`,
    },
  ];

  return (
    <div
      className={`${compact ? "mt-3" : featured ? "mt-5" : "mt-5"} grid gap-2 sm:grid-cols-3`}
      data-responsive-check="watch-components"
      data-game-pk={game.gamePk}
      role="group"
      aria-label={watchComponentsAriaLabel(game)}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={`${featured ? "px-3.5 py-3" : "px-3 py-2"} rounded border border-white/10 bg-black/25`}
          style={glowStyle(item.value, 100)}
          role={"ariaLabel" in item ? "img" : undefined}
          aria-label={"ariaLabel" in item ? item.ariaLabel : undefined}
        >
          <div className="flex items-baseline justify-between gap-3 font-mono">
            <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: componentBarColor(item.value) }}>{item.label}</p>
            <p className="text-xs font-semibold text-zinc-200">{item.value.toFixed(1)}{"detail" in item && item.detail ? <span className="ml-1 text-zinc-500">{item.detail}</span> : null}</p>
          </div>
          <div className={`${featured ? "h-3.5" : "h-3"} mt-2 overflow-hidden rounded-full border border-white/10 bg-zinc-800/80 shadow-inner`}>
            <span
              className="heat-band-fill block h-full rounded-full"
              style={{
                width: `${Math.max(4, Math.min(100, item.value))}%`,
                background: `linear-gradient(90deg, ${componentBarColor(item.value)}, ${componentBarTail(item.value)})`,
                boxShadow: `0 0 18px rgb(${colorToRgb(componentBarColor(item.value))} / 0.5)`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function MatchupSpine({ game, leagueMeanGS, rankLabel }: { game: TonightGame; leagueMeanGS: number; rankLabel: string }) {
  const [awayStarter, homeStarter] = game.starters;

  return (
    <div className="flex min-h-full flex-col justify-between rounded border border-amber-300/25 bg-black/35 p-4 text-center shadow-[inset_0_0_42px_rgba(251,191,36,0.08)]">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-200">The hook</p>
        <p className="mt-1 font-serif text-5xl font-black leading-none text-amber-100">#1</p>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-zinc-400">matchup {rankLabel}</p>
        <p className="mt-3 text-sm leading-5 text-zinc-300">Best matchup on the board tonight</p>
        <p className="mt-1 font-mono text-xs text-zinc-500">Score {game.matchupScore.toFixed(1)}</p>
      </div>
      <div className="mt-4">
        <FormClash away={awayStarter} home={homeStarter} leagueMeanGS={leagueMeanGS} />
      </div>
    </div>
  );
}

function DuelStarterPanel({ starter, leagueMeanGS, align }: { starter: TonightStarter; leagueMeanGS: number; align: "away" | "home" }) {
  const name = starter.name ?? "TBD";
  const formHref = starter.pitcherId ? pitcherFormHref(starter.pitcherId) : null;
  const color = teamAccentColor(starter.team);

  return (
    <div
      className={`relative overflow-hidden rounded border border-white/10 bg-black/25 p-4 ${align === "home" ? "lg:text-right" : ""}`}
      style={{ borderColor: `${color}66`, boxShadow: `inset ${align === "home" ? "-" : ""}4px 0 0 ${color}` }}
      role="group"
      aria-label={starterBlockAriaLabel(starter)}
    >
      <div className={`flex gap-4 ${align === "home" ? "lg:flex-row-reverse" : ""}`}>
        <StarterHeadshot starter={starter} size="duel" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">{starter.team} / {starter.side}</p>
          <h4 className="mt-1 min-w-0 text-wrap font-serif text-2xl font-bold leading-tight text-zinc-50 lg:text-3xl">
            {formHref ? <Link href={formHref} className="transition hover:text-amber-200" aria-label={`View ${name} form`}>{name}</Link> : name}
          </h4>
          {starter.status === "ok" && starter.rgs !== undefined && starter.tier ? (
            <div className={`mt-3 flex flex-wrap items-center gap-2 ${align === "home" ? "lg:justify-end" : ""}`}>
              <p className={`font-mono text-sm ${tierTextClass(starter.tier)}`}>Form {starter.rgs.toFixed(1)}</p>
              {starter.trend && starter.deltaForm !== undefined ? <TrendChip summary={{ trend: starter.trend, deltaForm: starter.deltaForm }} compact /> : null}
            </div>
          ) : (
            <LimitedStarterLine starter={starter} />
          )}
        </div>
      </div>
      {starter.status === "ok" && starter.spark && starter.tier ? (
        <div className="mt-3">
          <FormSparkline values={starter.spark} tier={starter.tier} leagueMeanGS={leagueMeanGS} label={`${name} recent form GS+: ${starter.spark.join(", ")}`} trend={starter.trend ?? "steady"} strokeColor={color} variant="row" />
        </div>
      ) : null}
    </div>
  );
}

function FormClash({ away, home, leagueMeanGS }: { away: TonightStarter; home: TonightStarter; leagueMeanGS: number }) {
  if (away.status !== "ok" || home.status !== "ok" || !away.spark || !home.spark || !away.tier || !home.tier) {
    return <p className="rounded border border-white/10 bg-black/25 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-zinc-500">Form clash pending</p>;
  }

  return (
    <div className="rounded border border-white/10 bg-black/25 p-3 text-left">
      <div className="mb-1 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
        <span style={{ color: teamAccentColor(away.team) }}>{away.team}</span>
        <span>Form clash</span>
        <span style={{ color: teamAccentColor(home.team) }}>{home.team}</span>
      </div>
      <div className="grid gap-1">
        <FormSparkline values={away.spark} tier={away.tier} leagueMeanGS={leagueMeanGS} label={`${away.name ?? away.team} recent form GS+: ${away.spark.join(", ")}`} trend={away.trend ?? "steady"} strokeColor={teamAccentColor(away.team)} variant="mini" />
        <FormSparkline values={home.spark} tier={home.tier} leagueMeanGS={leagueMeanGS} label={`${home.name ?? home.team} recent form GS+: ${home.spark.join(", ")}`} trend={home.trend ?? "steady"} strokeColor={teamAccentColor(home.team)} variant="mini" />
      </div>
    </div>
  );
}

function glowColor(value: number, max: number) {
  const pct = max > 0 ? value / max : 0;
  if (pct >= 0.66) return HEAT_BANDS[1].color;
  if (pct >= 0.48) return HEAT_BANDS[2].color;
  return HEAT_BANDS[3].color;
}

function glowStyle(value: number, max: number) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const color = glowColor(value, max);
  const rgb = colorToRgb(color);
  return {
    "--heat-glow-color": rgb,
    "--heat-glow-opacity": (0.08 + pct * 0.22).toFixed(2),
  } as CSSProperties;
}

function colorToRgb(color: string) {
  const normalized = color.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

function componentBarTail(value: number) {
  if (value >= 58) return "#F8C15A";
  if (value >= 52) return "#FDBA74";
  if (value >= 48) return "#93C5FD";
  return "#60A5FA";
}

function componentBarColor(value: number) {
  if (value >= 58) return "#EF9F27";
  if (value >= 52) return "#F8C15A";
  if (value >= 48) return "#85B7EB";
  return "#378ADD";
}

function WatchFlagNote({ game, compact = false }: { game: TonightGame; compact?: boolean }) {
  if (!game.flags?.tbd && !game.flags?.limitedForm) return null;

  return (
    <p className={`${compact ? "mt-2" : "mt-4"} font-mono text-xs text-zinc-500`} aria-label={watchFlagNoteAriaLabel(game)}>
      {game.flags.tbd ? "TBD starter included with league-mean fallback. " : ""}
      {game.flags.limitedForm ? "Limited form samples use baseline fallback where needed." : ""}
    </p>
  );
}

function StarterMini({ starter, leagueMeanGS }: { starter: TonightStarter; leagueMeanGS: number }) {
  const name = starter.name ?? "TBD";
  const formHref = starter.pitcherId ? pitcherFormHref(starter.pitcherId) : null;
  const color = teamAccentColor(starter.team);

  return (
    <div
      className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-3 rounded border border-white/10 bg-black/25 p-3"
      style={{ borderColor: `${color}44`, boxShadow: `inset 3px 0 0 ${color}` }}
      role="group"
      aria-label={starterBlockAriaLabel(starter)}
    >
      <StarterHeadshot starter={starter} size="small" />
      <div className="min-w-0">
        <p className="min-w-0 text-wrap text-sm font-medium leading-tight text-zinc-100">
          {formHref ? <Link href={formHref} className="transition hover:text-amber-200" aria-label={`View ${name} form`}>{name}</Link> : name}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">{starter.team}</p>
        {starter.status === "insufficient" && starter.lastStart ? (
          <p className="mt-1 truncate text-[11px] text-zinc-500">
            Last: vs {starter.lastStart.opp} / GS+ {starter.lastStart.gsPlus}
          </p>
        ) : null}
      </div>
      <div className="ml-auto text-right">
        {starter.status === "ok" && starter.rgs !== undefined && starter.tier ? (
          <>
            <p className={`font-mono text-sm ${tierTextClass(starter.tier)}`}>Form {starter.rgs.toFixed(1)}</p>
            {starter.trend && starter.deltaForm !== undefined ? <TrendChip summary={{ trend: starter.trend, deltaForm: starter.deltaForm }} compact /> : null}
          </>
        ) : (
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500" aria-label={starterFallbackAriaLabel(starter)}>
            {starter.status === "tbd" ? "TBD" : "Limited"}
          </p>
        )}
      </div>
      {starter.status === "ok" && starter.spark && starter.tier ? (
        <div className="col-span-full -mt-1">
          <FormSparkline values={starter.spark} tier={starter.tier} leagueMeanGS={leagueMeanGS} label={`${name} recent form GS+: ${starter.spark.join(", ")}`} trend={starter.trend ?? "steady"} strokeColor={color} />
        </div>
      ) : null}
    </div>
  );
}

function LimitedStarterLine({ starter }: { starter: TonightStarter }) {
  if (starter.status === "tbd") {
    return <p className="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-zinc-500" aria-label={starterFallbackAriaLabel(starter)}>Starter TBD / league baseline used</p>;
  }

  return (
    <div className="mt-3 text-sm text-zinc-400">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500" aria-label={starterFallbackAriaLabel(starter)}>Limited form sample</p>
      {starter.lastStart ? <p className="mt-1">Last: vs {starter.lastStart.opp} / {formatStartLine({ inningsPitched: starter.lastStart.ip, hits: starter.lastStart.h, earnedRuns: starter.lastStart.er, walks: starter.lastStart.bb, strikeouts: starter.lastStart.k, pitches: 0 })} / GS+ {starter.lastStart.gsPlus}</p> : null}
    </div>
  );
}

function StarterHeadshot({ starter, size }: { starter: TonightStarter; size: "small" | "large" | "duel" }) {
  const className = size === "duel" ? "h-24 w-24 lg:h-28 lg:w-28" : size === "large" ? "h-16 w-16" : "h-10 w-10";
  const color = teamAccentColor(starter.team);
  if (!starter.pitcherId) {
    return (
      <span
        className={`${className} flex shrink-0 items-center justify-center rounded-full bg-zinc-800 font-mono text-[10px] text-zinc-300`}
        style={{ boxShadow: `0 0 0 ${size === "duel" ? "4px" : "2px"} ${color}66, 0 0 28px ${color}33` }}
        role="img"
        aria-label={`TBD ${starter.team} starter`}
      >
        {starter.team}
      </span>
    );
  }

  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://img.mlbstatic.com/mlb-photos/image/upload/w_100,q_auto:best/v1/people/${starter.pitcherId}/headshot/67/current`}
      alt={starter.name ?? ""}
      width={100}
      height={100}
      className={`${className} shrink-0 rounded-full bg-black/30 object-contain object-bottom`}
      style={{ boxShadow: `0 0 0 ${size === "duel" ? "4px" : "2px"} ${color}66, 0 0 28px ${color}33` }}
    />
  );

  return (
    <Link href={pitcherFormHref(starter.pitcherId)} className="shrink-0" aria-label={`${starter.name ?? "Pitcher"} form`}>
      {image}
    </Link>
  );
}

function pitcherFormHref(pitcherId: string) {
  return `/pitchers/${pitcherId}/form`;
}

function gameStatusLabel(status: TonightGame["status"]) {
  if (status === "live") return "Live";
  if (status === "ppd") return "Postponed";
  return "Pregame";
}

function gameVenueLabel(game: TonightGame) {
  return game.park || "Venue TBD";
}

function watchCardAriaLabel(game: TonightGame) {
  return `Watch card for ${game.label} on ${formatSlateDate(game.date)}`;
}

function watchCardSummaryId(game: TonightGame) {
  return `watch-card-${game.gamePk}-summary`;
}

function watchCardSummaryAriaLabel(game: TonightGame) {
  return `${gameStatusLabel(game.status)} ${game.label}, ${formatFirstPitch(game.firstPitch)}, ${gameVenueLabel(game)}`;
}

function watchComponentsAriaLabel(game: TonightGame) {
  return `Watch components for ${game.label} on ${formatSlateDate(game.date)}`;
}

function starterBlockAriaLabel(starter: TonightStarter) {
  const side = starter.side === "away" ? "Away" : "Home";
  return `${side} starter: ${starter.name ?? "TBD"} (${starter.team})`;
}

function starterFallbackAriaLabel(starter: TonightStarter) {
  return starter.status === "tbd" ? "Starter TBD / league baseline used" : "Limited form sample";
}

function watchFlagNoteAriaLabel(game: TonightGame) {
  const notes = [];
  if (game.flags?.tbd) notes.push("TBD starter included with league-mean fallback");
  if (game.flags?.limitedForm) notes.push("Limited form samples use baseline fallback where needed");
  return notes.join("; ");
}

function formatSlateDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

function formatFirstPitch(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: SITE_TIME_ZONE,
    timeZoneName: "short",
  }).format(date);
}

function ordinal(value: number) {
  const suffix = value % 10 === 1 && value % 100 !== 11
    ? "st"
    : value % 10 === 2 && value % 100 !== 12
      ? "nd"
      : value % 10 === 3 && value % 100 !== 13
        ? "rd"
        : "th";
  return `${value}${suffix}`;
}

function duelStyle(awayColor: string, homeColor: string) {
  return {
    "--away-rgb": colorToRgb(awayColor),
    "--home-rgb": colorToRgb(homeColor),
  } as CSSProperties;
}

function teamAccentColor(team: string) {
  const colors: Record<string, string> = {
    ARI: "#A71930",
    ATL: "#CE1141",
    BAL: "#DF4601",
    BOS: "#BD3039",
    CHC: "#0E3386",
    CWS: "#C4CED4",
    CIN: "#C6011F",
    CLE: "#E31937",
    COL: "#C4CED4",
    DET: "#FA4616",
    HOU: "#EB6E1F",
    KC: "#7AB2DD",
    LAA: "#BA0021",
    LAD: "#005A9C",
    MIA: "#00A3E0",
    MIL: "#FFC52F",
    MIN: "#D31145",
    NYM: "#FF5910",
    NYY: "#C4CED4",
    OAK: "#EFB21E",
    PHI: "#E81828",
    PIT: "#FDB827",
    SD: "#FFC425",
    SEA: "#6CACE4",
    SF: "#FD5A1E",
    STL: "#C41E3A",
    TB: "#8FBCE6",
    TEX: "#C0111F",
    TOR: "#134A8E",
    WSH: "#AB0003",
  };
  return colors[team] ?? "#EF9F27";
}
