import Link from "next/link";
import { Headshot } from "@/components/headshot";
import { LocalTime } from "@/components/local-time";
import { UpcomingSimpleCardFrame } from "@/components/upcoming-view-mode";
import { HEAT_BANDS } from "@/lib/form-tokens";
import { pitcherHref, sourceParams } from "@/lib/routes";
import { upcomingSimpleContextSentence } from "@/lib/upcoming-simple-context";
import type { FormTier, TonightGame, TonightResponse, TonightStarter } from "@/lib/types";
import { watchScoreConfidenceLabel } from "@/lib/watch-score-confidence";

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
          <div className="grid gap-3" data-upcoming-simple-card-list>
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

  return (
    <UpcomingSimpleCardFrame gamePk={game.gamePk}>
      <div className="grid grid-cols-[minmax(0,1fr)_74px_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_112px_minmax(0,1fr)] sm:gap-4">
        <SimpleStarter starter={game.starters[0]} orientation={`${game.away} @ ${game.home}`} align="away" />
        <div className="text-center" data-upcoming-simple-score>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">#{rank}</p>
          <p className="font-serif text-3xl font-black leading-none text-amber-100 sm:text-4xl" data-simple-watch-score>{game.gameWatchScore.toFixed(1)}</p>
          {confidenceLabel ? (
            <p className="mx-auto mt-1 inline-flex rounded border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-amber-100" data-simple-confidence-chip={game.watchScoreConfidence}>
              {confidenceLabel}
            </p>
          ) : null}
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-500" data-simple-first-pitch>
            <LocalTime value={game.firstPitch} fallback="First pitch" />
          </p>
        </div>
        <SimpleStarter starter={game.starters[1]} orientation={`${game.home} vs ${game.away}`} align="home" />
      </div>
      <p className="mt-3 border-t border-white/10 pt-3 text-center text-sm leading-5 text-zinc-300" data-upcoming-simple-context data-simple-context-word-count={wordCount(sentence)} data-simple-context-has-em-dash={String(sentence.includes("—"))}>
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

  return (
    <div className={`min-w-0 ${align === "home" ? "text-right" : ""}`} data-upcoming-simple-starter={starter.side}>
      <div className={`flex items-center gap-2 ${align === "home" ? "flex-row-reverse" : ""}`}>
        <StarterHeadshot starter={starter} formBand={formBand} />
        <div className="min-w-0">
          {starter.pitcherId ? (
            <Link href={pitcherHref({ pitcherId: starter.pitcherId, name: starter.name }, sourceParams("upcoming"))} className="block truncate text-sm font-semibold text-zinc-50" data-simple-starter-name>
              {name}
            </Link>
          ) : (
            <p className="truncate text-sm font-semibold text-zinc-50" data-simple-starter-name>{name}</p>
          )}
          <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-500" data-simple-orientation>{orientation}</p>
        </div>
      </div>
      <p className={`mt-2 inline-flex rounded border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] ${formChipClass(formBand)}`} data-simple-form-chip data-form-band={formBand ?? "neutral"}>
        {formBand ? heatBandLabel(formBand) : "Form"} {formatFormValue(starter, formBand)}
      </p>
    </div>
  );
}

function StarterHeadshot({ starter, formBand }: { starter: TonightStarter; formBand: FormTier | null }) {
  return (
    <Headshot
      playerId={starter.pitcherId}
      name={starter.name ?? `TBD ${starter.team} starter`}
      team={starter.team}
      size="lg"
      band={formBand}
      sampleSufficient={starter.formStatus === "ok" && !starter.flags?.limitedSample}
      decorative
      starterStatus={starter.status}
      className="rounded-lg"
    />
  );
}

function formatFormValue(starter: TonightStarter, formBand: FormTier | null) {
  if (starter.rgs === null || starter.rgs === undefined) return "pending";
  return formBand ? starter.rgs.toFixed(1) : starter.rgs.toFixed(1);
}

function heatBandLabel(band: FormTier) {
  return HEAT_BANDS.find((candidate) => candidate.key === band)?.label ?? "Form";
}

function formChipClass(band: FormTier | null) {
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
