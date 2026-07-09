import { Headshot } from "@/components/headshot";
import type { HTMLAttributes } from "react";
import { formBandValueColor, formBandWhisperLabel, formLineEraText, hasQualifiedStarterFormSample, LIMITED_SAMPLE_FORM_COLOR } from "@/components/limited-sample-form-chip";
import { LocalTime } from "@/components/local-time";
import { UpcomingSimpleCardFrame } from "@/components/upcoming-view-mode";
import { HEAT_BANDS, watchTierOf } from "@/lib/form-tokens";
import { formatUpcomingDate, pitcherHref, sourceParams } from "@/lib/routes";
import { upcomingSimpleContextSentence, upcomingSimpleContextSentencesForSlate } from "@/lib/upcoming-simple-context";
import type { FormTier, TonightGame, TonightResponse, TonightStarter } from "@/lib/types";
import { watchScoreConfidenceLabel } from "@/lib/watch-score-confidence";

const SIMPLE_EVEN_PANEL_COLOR = "#A79B83";

export function UpcomingSimpleBoard({
  tonight,
  rankLabel = "today",
  sortMode = "watch",
  contextWriteups = {},
  dateLabel,
  showCardDate = false,
}: {
  tonight: TonightResponse;
  rankLabel?: string;
  sortMode?: "watch" | "time";
  contextWriteups?: Record<string, string>;
  dateLabel?: string;
  showCardDate?: boolean;
}) {
  const dateGroups = simpleDateGroups(tonight.games);
  const dateHeaderLabels = dateGroups.map((group) => simpleDateHeaderLabel(group.date, dateLabel));
  const fallbackContextSentences = upcomingSimpleContextSentencesForSlate(tonight.games, tonight.leagueMeanGS);
  const renderedContextSentences = Object.fromEntries(tonight.games.map((game) => [game.gamePk, contextWriteups[game.gamePk] ?? fallbackContextSentences[game.gamePk] ?? upcomingSimpleContextSentence(game, 1, tonight.leagueMeanGS)]));

  return (
    <section
      className="border-y border-white/10 bg-[#0d0d11] px-0 pb-10 pt-4 sm:px-6 lg:px-8"
      data-responsive-check="upcoming-simple-board"
      data-simple-game-count={tonight.games.length}
      data-simple-visible-game-pks={tonight.games.length ? tonight.games.map((game) => game.gamePk).join(",") : "none"}
      data-simple-watch-ranks={tonight.games.length ? tonight.games.map((game, index) => simpleRankValue(game, index)).join(",") : "none"}
      data-simple-watch-scores={tonight.games.length ? tonight.games.map(simpleScoreLabel).join(",") : "none"}
      data-simple-context-sentences={tonight.games.length ? tonight.games.map((game) => renderedContextSentences[game.gamePk]).join("|") : "none"}
      data-simple-context-source={Object.keys(contextWriteups).length > 0 ? "stored-llm-or-fallback" : "deterministic-fallback"}
      data-simple-rank-label={rankLabel}
      data-simple-sort-mode={sortMode}
      data-simple-date-groups={dateGroups.length ? dateGroups.map((group) => group.date).join(",") : "none"}
      data-simple-date-header-labels={dateHeaderLabels.length ? dateHeaderLabels.join("|") : "none"}
      data-simple-card-date-visible={String(showCardDate)}
    >
      <div className="mx-auto max-w-7xl">
        {tonight.games.length === 0 ? (
          <div className="rounded border border-white/10 bg-[#101014] p-6" role="status" data-empty-reason={tonight.scheduledGames > 0 ? "completed-or-postponed" : "no-games"}>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">{tonight.scheduledGames > 0 ? "Slate complete" : "No games on this slate"}</p>
          </div>
        ) : (
          <div className="space-y-8 pb-8 sm:pb-10 lg:pb-12" data-upcoming-simple-date-groups-wrapper>
            {dateGroups.map((group, groupIndex) => (
              <div key={group.date} data-upcoming-simple-date-group data-simple-date-group-date={group.date} data-simple-date-group-index={groupIndex}>
                <SimpleDateGroupHeader date={group.date} label={simpleDateHeaderLabel(group.date, dateLabel)} />
                <UpcomingSimpleCardGrid data-simple-date-card-list={group.date}>
                  {group.games.map(({ game, rankIndex }) => (
                    <UpcomingSimpleCard
                      key={game.gamePk}
                      game={game}
                      rank={rankIndex + 1}
                      leagueMeanGS={tonight.leagueMeanGS}
                      rankLabel={rankLabel}
                      sortMode={sortMode}
                      contextWriteup={contextWriteups[game.gamePk]}
                      fallbackContextSentence={fallbackContextSentences[game.gamePk]}
                      showCardDate={showCardDate}
                      cardClassName="mb-4 sm:mb-0"
                    />
                  ))}
                </UpcomingSimpleCardGrid>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function UpcomingSimpleCardGrid({
  children,
  className = "",
  ...attributes
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`grid grid-cols-1 justify-center gap-3 sm:grid-cols-[minmax(0,560px)] sm:gap-4 lg:grid-cols-[repeat(2,minmax(500px,560px))] lg:gap-5 ${className}`}
      data-upcoming-simple-card-list
      data-simple-desktop-layout="two-up-vs"
      {...attributes}
    >
      {children}
    </div>
  );
}

export function UpcomingSimpleCard({
  game,
  rank,
  leagueMeanGS,
  sortMode,
  contextWriteup,
  fallbackContextSentence,
  showCardDate = false,
  cardClassName,
}: {
  game: TonightGame;
  rank: number;
  leagueMeanGS: number;
  rankLabel: string;
  sortMode: "watch" | "time";
  contextWriteup?: string;
  fallbackContextSentence?: string;
  showCardDate?: boolean;
  cardClassName?: string;
}) {
  const sentence = contextWriteup ?? fallbackContextSentence ?? upcomingSimpleContextSentence(game, rank, leagueMeanGS);
  const confidenceLabel = watchScoreConfidenceLabel(game.watchScoreConfidence);
  const hasNamedStarterMatchup = hasNamedStarters(game);
  const watchTier = watchTierOf(game.gameWatchScore);
  const accentColor = watchTier.color;
  const cardTint = simpleCardTint(game.gameWatchScore, accentColor);
  const showRankSlot = sortMode === "watch";
  const rankLabelText = hasNamedStarterMatchup ? `#${rank}` : "--";
  const scoreLabel = hasNamedStarterMatchup ? game.gameWatchScore.toFixed(1) : "--";
  const awayHeatColor = starterHeatPanelColor(game.starters[0]);
  const homeHeatColor = starterHeatPanelColor(game.starters[1]);

  return (
    <UpcomingSimpleCardFrame
      gamePk={game.gamePk}
      ariaLabel={`${starterDisplayName(game.starters[0])} versus ${starterDisplayName(game.starters[1])}, watch score ${scoreLabel}, ${game.label}`}
      bandKey={cardTint.key}
      background={cardTint.background}
      accentColor={accentColor}
      className={cardClassName}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{ background: simpleHeatStripGradient(awayHeatColor, homeHeatColor) }}
        data-simple-card-accent={watchTier.key}
        data-simple-heat-strip
        data-simple-heat-strip-away-color={awayHeatColor}
        data-simple-heat-strip-home-color={homeHeatColor}
      />
      <div
        className="relative z-10 flex items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5 sm:pt-5"
        data-simple-header-band
        data-simple-rank-visible={String(showRankSlot)}
        data-simple-named-starter-matchup={String(hasNamedStarterMatchup)}
      >
        <div className="flex min-w-0 items-start gap-2 pt-1 font-mono text-[12px] uppercase text-zinc-400" data-simple-header-left>
          {showRankSlot ? <p className={`font-semibold tracking-[0.18em] ${hasNamedStarterMatchup ? "text-white" : "text-zinc-400"}`} data-simple-card-rank data-simple-card-rank-tone={hasNamedStarterMatchup ? "ranked" : "muted"}>{rankLabelText}</p> : null}
          <p className="tracking-[0.12em]" data-simple-first-pitch>
            {showCardDate ? (
              <>
                <span data-simple-card-date data-simple-card-date-source={game.date}>{formatSimpleCardDate(game.date)}</span>
                <span aria-hidden="true"> · </span>
              </>
            ) : null}
            <LocalTime value={game.firstPitch} fallback="First pitch" />
          </p>
        </div>
        <span aria-hidden="true" />
      </div>
      <div
        className="relative grid min-h-[150px] grid-cols-2 overflow-hidden"
        data-simple-vs-composition
        data-simple-diagonal-panels
        data-simple-seam-layout="single-opaque-bar"
      >
        <SimplePortraitPanel starter={game.starters[0]} align="away" />
        <div
          className="absolute inset-y-0 left-1/2 z-20 flex w-[26%] min-w-[94px] max-w-[110px] -translate-x-1/2 flex-col items-center justify-center bg-[#08080c] px-3 text-center shadow-[0_0_26px_rgba(0,0,0,0.42)] sm:w-[124px] sm:min-w-0 sm:max-w-none sm:px-2"
          style={{ clipPath: "polygon(18% 0, 100% 0, 82% 100%, 0 100%)" }}
          data-upcoming-simple-score
          data-simple-score-seam-column
          data-simple-score-seam-bar="single-opaque"
          data-simple-score-seam-bar-width="26%"
        >
          <p className="font-serif text-[32px] font-black leading-none sm:text-[42px]" style={{ color: hasNamedStarterMatchup ? accentColor : "#888780" }} data-simple-watch-score>{scoreLabel}</p>
          <p className="mt-1 font-mono text-[12px] lowercase tracking-[0.14em] text-zinc-400" data-simple-vs-mark data-simple-vs-text>vs.</p>
          {confidenceLabel ? (
            <p className="mx-auto mt-2 inline-flex rounded border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 font-mono text-[12px] uppercase tracking-[0.1em] text-amber-100" data-simple-confidence-chip={game.watchScoreConfidence}>
              {confidenceLabel}
            </p>
          ) : null}
        </div>
        <SimplePortraitPanel starter={game.starters[1]} align="home" />
      </div>
      <div className="grid grid-cols-2 divide-x divide-white/10 border-y border-white/10 bg-[#07070a]" data-simple-form-strip>
        <SimpleIdentityStrip starter={game.starters[0]} orientation={`${game.away} @ ${game.home}`} align="away" />
        <SimpleIdentityStrip starter={game.starters[1]} orientation={`${game.home} vs ${game.away}`} align="home" />
      </div>
      <p
        className="px-4 py-5 text-left text-base leading-6 text-zinc-200 sm:px-6"
        data-upcoming-simple-context
        data-simple-context-sentence-count={sentenceCount(sentence)}
        data-simple-context-word-count={wordCount(sentence)}
        data-simple-context-has-em-dash={String(sentence.includes("—"))}
        data-simple-context-has-this-one={String(/\bthis one\b/i.test(sentence))}
        data-simple-context-source={contextWriteup ? "stored-llm" : "deterministic-fallback"}
      >
        {sentence}
      </p>
    </UpcomingSimpleCardFrame>
  );
}

function SimplePortraitPanel({
  starter,
  align,
}: {
  starter: TonightStarter;
  align: "away" | "home";
}) {
  const formBand = hasQualifiedStarterFormSample(starter) ? starter.tier ?? null : null;
  const panelColor = starterHeatPanelColor(starter, formBand);

  return (
    <div
      className="relative min-w-0 overflow-hidden bg-[#09090d]"
      style={{ background: simplePortraitPanelGradient(panelColor) }}
      data-upcoming-simple-starter={starter.side}
      data-simple-portrait-panel
      data-simple-diagonal-panel={align}
      data-simple-starter-panel-color={panelColor}
      data-simple-starter-panel-source="heat-band"
      data-simple-panel-clip-path="none"
      data-simple-panel-overlap="none"
    >
      <div className={`flex min-h-[150px] items-end ${align === "home" ? "justify-end pr-2" : "justify-start pl-2"}`} data-simple-portrait-bleed data-simple-starter-portrait-zone data-simple-starter-portrait-zone-source="heat-band" data-simple-starter-portrait-zone-color={panelColor}>
        <StarterHeadshot starter={starter} formBand={formBand} />
      </div>
    </div>
  );
}

function SimpleIdentityStrip({
  starter,
  orientation,
  align,
}: {
  starter: TonightStarter;
  orientation: string;
  align: "away" | "home";
}) {
  const formBand = hasQualifiedStarterFormSample(starter) ? starter.tier ?? null : null;
  const name = starter.name ?? `TBD ${starter.team}`;
  const heatColor = starterHeatColor(starter, formBand);
  const bandLabel = simpleStarterBandLabel(starter, formBand);
  const qualifiedSample = Boolean(formBand);
  const valueColor = formBandValueColor(formBand, qualifiedSample);
  const formValue = typeof starter.rgs === "number" ? starter.rgs.toFixed(1) : "--";
  const href = starter.pitcherId && starter.name ? pitcherHref({ pitcherId: starter.pitcherId, name: starter.name }, sourceParams("upcoming")) : null;
  const nameNode = (
    <div className={`${align === "home" ? "text-right" : "text-left"}`} data-simple-starter-name-block>
      {href ? (
        <a href={href} className="relative z-30 block whitespace-normal break-words font-serif text-[21px] font-black leading-[0.98] text-white hover:text-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300" data-simple-starter-name>
          <PitcherNameLines name={name} />
        </a>
      ) : (
        <p className="whitespace-normal break-words font-serif text-[21px] font-black leading-[0.98] text-white" data-simple-starter-name>
          <PitcherNameLines name={name} />
        </p>
      )}
      <p className="mt-1 inline-flex items-end gap-2 font-mono text-[12px] uppercase leading-none tracking-[0.12em] text-zinc-500" data-simple-name-band-label data-simple-name-band-label-align="bottom">
        <span className="font-semibold tabular-nums sm:hidden" style={{ color: valueColor }} data-simple-mobile-form-value>{formValue}</span>
        <span className="whitespace-nowrap leading-none">{bandLabel}</span>
      </p>
    </div>
  );
  const valueNode = <SimpleFormValueBlock starter={starter} formBand={formBand} align={align} />;
  return (
    <div className={`min-w-0 px-4 py-4 ${align === "home" ? "text-right" : "text-left"}`} data-simple-identity-strip data-simple-starter-card-back data-simple-starter-card-back-source="heat-band">
      <div className={`grid grid-cols-1 items-start gap-2 ${align === "home" ? "sm:grid-cols-[54px_minmax(0,1fr)]" : "sm:grid-cols-[minmax(0,1fr)_54px]"}`} data-simple-name-value-row>
        {align === "home" ? valueNode : nameNode}
        {align === "home" ? nameNode : valueNode}
      </div>
      <p className="mt-2 truncate font-mono text-[12px] uppercase tracking-[0.14em] text-zinc-500" data-simple-orientation>{orientation}</p>
      <p className="mt-1 font-mono text-[12px] uppercase tracking-[0.1em] text-zinc-500" data-simple-mini-stat-line data-simple-form-microline data-simple-form-microline-text={formMicroLine(starter)} data-simple-form-line-color={heatColor}>
        <SimpleFormMicroLine starter={starter} />
      </p>
    </div>
  );
}

function SimpleFormValueBlock({ starter, formBand, align }: { starter: TonightStarter; formBand: FormTier | null; align: "away" | "home" }) {
  const qualifiedSample = Boolean(formBand);
  const valueColor = formBandValueColor(formBand, qualifiedSample);
  const value = typeof starter.rgs === "number" ? starter.rgs.toFixed(1) : "--";

  return (
    <div
      className={`hidden sm:block ${align === "home" ? "text-left" : "text-right"}`}
      data-simple-form-line
      data-simple-form-value-block
      data-form-band={formBand ?? (starter.formStatus === "ok" ? "limited" : starter.formStatus)}
      data-simple-form-line-color={valueColor}
      data-simple-form-line-source={formBand ? "heat-band" : starter.formStatus === "ok" ? "limited-sample" : starter.formStatus}
    >
      <p className="font-serif text-[26px] font-black leading-none tabular-nums" style={{ color: valueColor }} data-simple-form-promoted-value>{value}</p>
    </div>
  );
}

function simpleStarterBandLabel(starter: TonightStarter, formBand: FormTier | null) {
  if (starter.status === "tbd") return "TBD";
  if (starter.formStatus === "mlb_debut") return "DEBUT";
  return formBandWhisperLabel(formBand, Boolean(formBand));
}

function PitcherNameLines({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return <>{name}</>;
  const last = parts.pop();
  return (
    <>
      <span className="block">{parts.join(" ")}</span>
      {" "}
      <span className="block">{last}</span>
    </>
  );
}

function StarterHeadshot({ starter, formBand }: { starter: TonightStarter; formBand: FormTier | null }) {
  return (
    <Headshot
      playerId={starter.pitcherId}
      name={starter.name ?? `TBD ${starter.team} starter`}
      team={starter.team}
      size="simple"
      band={formBand}
      sampleSufficient={starter.formStatus === "ok" && !starter.flags?.limitedSample}
      decorative
      starterStatus={starter.status}
      suppressThermalBackground
      className="h-[128px] w-[128px] rounded-none border-0 bg-transparent sm:h-[150px] sm:w-[150px] [&_.headshot__img]:h-full [&_.headshot__img]:max-h-none [&_.headshot__img]:max-w-none [&_.headshot__img]:object-cover [&_.headshot__img]:object-[center_18%] [&_.headshot__img]:w-full"
    />
  );
}

function SimpleDateGroupHeader({ date, label }: { date: string; label: string }) {
  return (
    <div className="mx-4 mb-4 border-b border-white/10 pb-3 sm:mx-0" data-upcoming-simple-date-header data-simple-date-header-date={date} data-simple-date-header-label={label}>
      <p className="font-mono text-xs uppercase tracking-[0.24em] text-zinc-500">{label}</p>
      <h2 className="mt-2 font-serif text-3xl font-black text-zinc-50 sm:text-4xl">Matchup Board</h2>
    </div>
  );
}

function simpleDateGroups(games: TonightGame[]) {
  const groups: Array<{ date: string; games: Array<{ game: TonightGame; rankIndex: number }> }> = [];
  const byDate = new Map<string, Array<{ game: TonightGame; rankIndex: number }>>();

  games.forEach((game, rankIndex) => {
    const date = game.date;
    const current = byDate.get(date);
    if (current) {
      current.push({ game, rankIndex });
      return;
    }
    byDate.set(date, [{ game, rankIndex }]);
    groups.push({ date, games: byDate.get(date) ?? [] });
  });

  return groups.sort((a, b) => a.date.localeCompare(b.date));
}

function simpleDateHeaderLabel(date: string, preferredLabel?: string) {
  return preferredLabel ?? formatUpcomingDate(date);
}

function formatSimpleCardDate(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return date.toUpperCase();
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsed).replace(",", "").toUpperCase();
}

function starterDisplayName(starter: TonightStarter) {
  return starter.name ?? `TBD ${starter.team}`;
}

function miniStatLine(starter: TonightStarter) {
  if (starter.status === "tbd") return "Starter TBD";
  if (starter.formStatus === "mlb_debut") return "MLB debut start";
  const projected = starter.projection?.projectedGsPlus;
  if (typeof projected === "number") return `Proj GS+ ${projected.toFixed(1)}`;
  if (starter.lastStart?.gsPlus) return `Last GS+ ${starter.lastStart.gsPlus.toFixed(1)}`;
  if (typeof starter.workload?.daysRest === "number") return `${starter.workload.daysRest}d rest`;
  return starter.probableConfidence === "REPORTED" ? "Reported probable" : "Probable starter";
}

function formMicroLine(starter: TonightStarter) {
  const era = formLineEraText(starter.seasonStats?.era);
  const projected = starter.projection?.projectedGsPlus;
  if (typeof projected === "number") return `${era} · PROJ ${projected.toFixed(1)}`;
  return `${era} · ${miniStatLine(starter).toUpperCase()}`;
}

function SimpleFormMicroLine({ starter }: { starter: TonightStarter }) {
  const era = formLineEraText(starter.seasonStats?.era);
  const projected = starter.projection?.projectedGsPlus;
  const detail = typeof projected === "number" ? `PROJ ${projected.toFixed(1)}` : miniStatLine(starter).toUpperCase();

  return (
    <>
      <span>{era}</span>
      <span className="hidden sm:inline"> · </span>
      <span className="block sm:inline" data-simple-form-mobile-break-before-proj>{detail}</span>
    </>
  );
}

function simpleCardTint(score: number, accentColor: string) {
  if (score >= 58) {
    return {
      key: "warm",
      background: `linear-gradient(135deg, ${hexToRgba(accentColor, 0.22)}, rgba(16,16,20,0.96) 38%, rgba(16,16,20,0.98))`,
    };
  }
  if (score >= 48) {
    return {
      key: "even",
      background: "linear-gradient(135deg, rgba(136,135,128,0.10), rgba(16,16,20,0.98) 44%, rgba(16,16,20,0.98))",
    };
  }
  return {
    key: "cool",
    background: `linear-gradient(135deg, rgba(55,138,221,0.20), rgba(16,16,20,0.97) 42%, ${hexToRgba(accentColor, 0.10)})`,
  };
}

function simpleHeatStripGradient(awayColor: string, homeColor: string) {
  return awayColor === homeColor ? awayColor : `linear-gradient(90deg, ${awayColor}, ${homeColor})`;
}

function simplePortraitPanelGradient(panelColor: string) {
  return `linear-gradient(0deg, ${hexToRgba(panelColor, 0.82)} 0%, ${hexToRgba(panelColor, 0.42)} 42%, rgba(9,9,13,0.94) 100%)`;
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized.length === 3 ? normalized.split("").map((char) => `${char}${char}`).join("") : normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function starterHeatColor(starter: TonightStarter, band: FormTier | null) {
  if (starter.formStatus === "mlb_debut") return "#FBBF24";
  if (!band) return LIMITED_SAMPLE_FORM_COLOR;
  return HEAT_BANDS.find((candidate) => candidate.key === band)?.color ?? "#888780";
}

function starterHeatPanelColor(starter: TonightStarter, band: FormTier | null = hasQualifiedStarterFormSample(starter) ? starter.tier ?? null : null) {
  if (starter.formStatus === "mlb_debut") return "#FBBF24";
  if (band === "even") return SIMPLE_EVEN_PANEL_COLOR;
  if (!band) return SIMPLE_EVEN_PANEL_COLOR;
  return HEAT_BANDS.find((candidate) => candidate.key === band)?.color ?? SIMPLE_EVEN_PANEL_COLOR;
}

function simpleRankValue(game: TonightGame, index: number) {
  if (!hasNamedStarters(game)) return "-";
  return game.status === "ppd" && index === 0 ? "-" : String(index + 1);
}

function simpleScoreLabel(game: TonightGame) {
  return hasNamedStarters(game) ? game.gameWatchScore.toFixed(1) : "--";
}

function hasNamedStarters(game: TonightGame) {
  return game.starters.every((starter) => starter.status !== "tbd" && Boolean(starter.name));
}

function wordCount(sentence: string) {
  return sentence.trim().split(/\s+/).filter(Boolean).length;
}

function sentenceCount(sentence: string) {
  return sentence.match(/[.!?](?:\s|$)/g)?.length ?? 0;
}
