import { Headshot } from "@/components/headshot";
import { LocalTime } from "@/components/local-time";
import { UpcomingSimpleCardFrame } from "@/components/upcoming-view-mode";
import { HEAT_BANDS, watchTierOf } from "@/lib/form-tokens";
import { upcomingSimpleContextSentence } from "@/lib/upcoming-simple-context";
import type { FormTier, TonightGame, TonightResponse, TonightStarter } from "@/lib/types";
import { watchScoreConfidenceLabel } from "@/lib/watch-score-confidence";
import type { CSSProperties } from "react";

export function UpcomingSimpleBoard({
  tonight,
  rankLabel = "today",
}: {
  tonight: TonightResponse;
  rankLabel?: string;
}) {
  return (
    <section
      className="border-y border-white/10 bg-[#0d0d11] px-4 pb-10 pt-4 sm:px-6 lg:px-8"
      data-responsive-check="upcoming-simple-board"
      data-simple-game-count={tonight.games.length}
      data-simple-visible-game-pks={tonight.games.length ? tonight.games.map((game) => game.gamePk).join(",") : "none"}
      data-simple-watch-ranks={tonight.games.length ? tonight.games.map((game, index) => simpleRankValue(game, index)).join(",") : "none"}
      data-simple-watch-scores={tonight.games.length ? tonight.games.map((game) => game.gameWatchScore.toFixed(1)).join(",") : "none"}
      data-simple-context-sentences={tonight.games.length ? tonight.games.map((game, index) => upcomingSimpleContextSentence(game, index + 1, tonight.leagueMeanGS)).join("|") : "none"}
      data-simple-rank-label={rankLabel}
    >
      <div className="mx-auto max-w-7xl">
        {tonight.games.length === 0 ? (
          <div className="rounded border border-white/10 bg-[#101014] p-6" role="status" data-empty-reason={tonight.scheduledGames > 0 ? "completed-or-postponed" : "no-games"}>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">{tonight.scheduledGames > 0 ? "Slate complete" : "No games on this slate"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 justify-center gap-4 sm:grid-cols-[minmax(0,560px)] lg:grid-cols-[repeat(2,minmax(500px,560px))] lg:gap-5" data-upcoming-simple-card-list data-simple-desktop-layout="two-up-vs">
            {tonight.games.map((game, index) => (
              <UpcomingSimpleCard key={game.gamePk} game={game} rank={index + 1} leagueMeanGS={tonight.leagueMeanGS} rankLabel={rankLabel} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function UpcomingSimpleCard({
  game,
  rank,
  leagueMeanGS,
}: {
  game: TonightGame;
  rank: number;
  leagueMeanGS: number;
  rankLabel: string;
}) {
  const sentence = upcomingSimpleContextSentence(game, rank, leagueMeanGS);
  const confidenceLabel = watchScoreConfidenceLabel(game.watchScoreConfidence);
  const watchTier = watchTierOf(game.gameWatchScore);
  const accentColor = watchTier.color;
  const cardTint = simpleCardTint(game.gameWatchScore, accentColor);
  const awayTeamColor = starterTeamColor(game.starters[0]);
  const homeTeamColor = starterTeamColor(game.starters[1]);

  return (
    <UpcomingSimpleCardFrame
      gamePk={game.gamePk}
      ariaLabel={`${starterDisplayName(game.starters[0])} versus ${starterDisplayName(game.starters[1])}, watch score ${game.gameWatchScore.toFixed(1)}, ${game.label}`}
      bandKey={cardTint.key}
      background={cardTint.background}
      accentColor={accentColor}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{ backgroundColor: accentColor }}
        data-simple-card-accent={watchTier.key}
      />
      <div
        className="relative grid grid-cols-[minmax(0,1fr)_76px_minmax(0,1fr)] items-stretch gap-2 overflow-hidden rounded-lg sm:grid-cols-[minmax(0,1fr)_126px_minmax(0,1fr)] sm:gap-4 lg:grid-cols-[minmax(0,1fr)_104px_minmax(0,1fr)] lg:gap-0 lg:[background:var(--simple-vs-gradient)]"
        style={{ "--simple-vs-gradient": simpleVsGradient(awayTeamColor, homeTeamColor) } as CSSProperties}
        data-simple-vs-composition
        data-simple-vs-gradient={`${awayTeamColor}|${homeTeamColor}`}
      >
        <span className="pointer-events-none absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-white/20 lg:block" aria-hidden="true" data-simple-vs-seam />
        <span className="pointer-events-none absolute left-1/2 top-[42%] z-10 hidden -translate-x-1/2 rounded-full border border-white/15 bg-black/45 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.14em] text-zinc-300 lg:block" aria-hidden="true" data-simple-vs-mark>VS</span>
        <SimpleStarter starter={game.starters[0]} orientation={`${game.away} @ ${game.home}`} align="away" />
        <div className="relative z-20 flex flex-col items-center justify-start px-1 pt-2 text-center sm:pt-4 lg:justify-center lg:bg-black/20 lg:py-5" data-upcoming-simple-score data-simple-score-column>
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">#{rank}</p>
          <p className="font-serif text-[2.35rem] font-black leading-none sm:text-5xl" style={{ color: accentColor }} data-simple-watch-score>{game.gameWatchScore.toFixed(1)}</p>
          {confidenceLabel ? (
            <p className="mx-auto mt-1 inline-flex rounded border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-amber-100" data-simple-confidence-chip={game.watchScoreConfidence}>
              {confidenceLabel}
            </p>
          ) : null}
          <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-500" data-simple-first-pitch>
            <LocalTime value={game.firstPitch} fallback="First pitch" />
          </p>
        </div>
        <SimpleStarter starter={game.starters[1]} orientation={`${game.home} vs ${game.away}`} align="home" />
      </div>
      <p
        className="mt-4 border-t border-white/10 pt-4 text-center text-sm leading-5 text-zinc-300"
        data-upcoming-simple-context
        data-simple-context-sentence-count={sentenceCount(sentence)}
        data-simple-context-word-count={wordCount(sentence)}
        data-simple-context-has-em-dash={String(sentence.includes("—"))}
        data-simple-context-has-this-one={String(/\bthis one\b/i.test(sentence))}
      >
        {sentence}
      </p>
    </UpcomingSimpleCardFrame>
  );
}

function SimpleStarter({
  starter,
  orientation,
  align,
}: {
  starter: TonightStarter;
  orientation: string;
  align: "away" | "home";
}) {
  const formBand = starter.formStatus === "ok" ? starter.tier ?? null : null;
  const name = starter.name ?? `TBD ${starter.team}`;
  const teamColor = starterTeamColor(starter);

  return (
    <div
      className={`relative z-10 min-w-0 overflow-hidden rounded-lg border bg-black/20 lg:rounded-none lg:border-0 lg:[background:var(--simple-starter-panel-gradient)] ${align === "home" ? "text-right" : ""}`}
      style={{ borderColor: `${teamColor}CC`, "--simple-starter-panel-gradient": simpleStarterPanelGradient(teamColor, align) } as CSSProperties}
      data-upcoming-simple-starter={starter.side}
      data-simple-starter-frame
      data-simple-starter-team-color={teamColor}
    >
      <div className={`flex justify-center bg-black/15 px-2 pt-2 lg:absolute lg:top-0 lg:h-[150px] lg:w-[calc(100%-18px)] lg:overflow-hidden lg:bg-transparent lg:p-0 ${align === "home" ? "lg:right-0 lg:justify-end" : "lg:left-0 lg:justify-start"}`} data-simple-portrait-bleed>
        <StarterHeadshot starter={starter} formBand={formBand} />
      </div>
      <div
        className="px-2 py-2 lg:relative lg:z-10 lg:mt-[112px] lg:min-h-[72px] lg:px-3 lg:py-2.5"
        style={{ background: `linear-gradient(135deg, ${teamColor}F0, rgba(12,12,16,0.92))` }}
        data-simple-starter-nameplate
      >
        <p className="whitespace-normal break-words text-sm font-semibold leading-[1.04] text-white sm:text-base" data-simple-starter-name>
          <PitcherNameLines name={name} />
        </p>
        <p className="mt-1 truncate font-mono text-[8px] uppercase tracking-[0.12em] text-white/75" data-simple-orientation>{orientation}</p>
      </div>
      <div className="px-2 pb-2 pt-2 lg:relative lg:z-10 lg:px-3" data-simple-starter-card-back>
        <p className={`inline-flex rounded border px-1.5 py-1 font-mono text-[8px] uppercase tracking-[0.1em] ${formChipClass(starter, formBand)}`} data-simple-form-chip data-form-band={formBand ?? starter.formStatus}>
          {simpleFormChipLabel(starter, formBand)}
        </p>
        <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-zinc-400" data-simple-mini-stat-line>
          {miniStatLine(starter)}
        </p>
      </div>
    </div>
  );
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
      className="rounded-lg lg:h-[150px] lg:w-[112px] lg:rounded-none lg:border-0 lg:bg-transparent"
    />
  );
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

function simpleVsGradient(awayTeamColor: string, homeTeamColor: string) {
  return `linear-gradient(90deg, ${hexToRgba(awayTeamColor, 0.42)} 0%, ${hexToRgba(awayTeamColor, 0.30)} 43%, rgba(12,12,16,0.74) 49%, rgba(12,12,16,0.74) 51%, ${hexToRgba(homeTeamColor, 0.30)} 57%, ${hexToRgba(homeTeamColor, 0.42)} 100%)`;
}

function simpleStarterPanelGradient(teamColor: string, align: "away" | "home") {
  const direction = align === "home" ? "225deg" : "135deg";
  return `linear-gradient(${direction}, ${hexToRgba(teamColor, 0.36)}, rgba(8,8,12,0.34) 48%, ${hexToRgba(teamColor, 0.22)})`;
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized.length === 3 ? normalized.split("").map((char) => `${char}${char}`).join("") : normalized, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
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
  return colors[team] ?? "#888780";
}

function starterTeamColor(starter: TonightStarter) {
  return starter.status === "tbd" ? "#888780" : teamAccentColor(starter.team);
}

function formatFormValue(starter: TonightStarter, formBand: FormTier | null) {
  if (starter.rgs === null || starter.rgs === undefined) return "pending";
  return formBand ? starter.rgs.toFixed(1) : starter.rgs.toFixed(1);
}

function heatBandLabel(band: FormTier) {
  return HEAT_BANDS.find((candidate) => candidate.key === band)?.label ?? "Form";
}

function simpleFormChipLabel(starter: TonightStarter, formBand: FormTier | null) {
  if (starter.status === "tbd") return "TBD";
  if (starter.formStatus === "mlb_debut") return "MLB DEBUT";
  if (formBand) return `${heatBandLabel(formBand)} ${formatFormValue(starter, formBand)}`;
  return `Form ${formatFormValue(starter, formBand)}`;
}

function formChipClass(starter: TonightStarter, band: FormTier | null) {
  if (starter.formStatus === "mlb_debut") return "border-amber-300/40 bg-amber-300/15 text-amber-100";
  if (band === "onfire" || band === "hot") return "border-orange-300/30 bg-orange-300/10 text-orange-100";
  if (band === "cooling" || band === "ice") return "border-sky-300/30 bg-sky-300/10 text-sky-100";
  return "border-white/10 bg-white/[0.04] text-zinc-300";
}

function simpleRankValue(game: TonightGame, index: number) {
  return game.status === "ppd" && index === 0 ? "-" : String(index + 1);
}

function wordCount(sentence: string) {
  return sentence.trim().split(/\s+/).filter(Boolean).length;
}

function sentenceCount(sentence: string) {
  return sentence.match(/[.!?](?:\s|$)/g)?.length ?? 0;
}
