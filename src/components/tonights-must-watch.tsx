import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { FormDriverChips } from "@/components/form-driver-chips";
import { FormSparkline, TrendChip, tierTextClass } from "@/components/form-visuals";
import { Headshot } from "@/components/headshot";
import { LocalTime } from "@/components/local-time";
import { PitcherAvailabilityNote } from "@/components/pitcher-availability";
import { MetaLine, StartLineText } from "@/components/wrap-safe-text";
import { HEAT_BANDS, watchTierForRank } from "@/lib/form-tokens";
import { pitcherHref, sourceParams } from "@/lib/routes";
import { slateTimeWordTitle } from "@/lib/time-words";
import type { FormTier, TonightGame, TonightResponse, TonightStarter } from "@/lib/types";

const SITE_TIME_ZONE = process.env.THE_BUMP_TIME_ZONE ?? "America/Los_Angeles";
const WATCH_COMPONENT_KEYS = ["top-arm", "pairing", "matchup"] as const;
const WATCH_COMPONENT_LABELS = ["Top arm", "Pairing", "Matchup"] as const;

export function TonightsMustWatch({
  tonight,
  fullSlateHref,
  fullSlateLabel = "Full slate & probables",
  fullSlateAriaLabel,
  eyebrow,
  title = "Must-Watch",
  rankLabel = "today",
  previewLimit,
  sectionId = "must-watch",
  compactTopPadding = false,
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
  compactTopPadding?: boolean;
}) {
  const shownGames = typeof previewLimit === "number" ? tonight.games.slice(0, previewLimit) : tonight.games;
  const headliner = shownGames[0];
  const rows = shownGames.slice(1);
  const headingId = `${sectionId}-heading`;
  const eyebrowLabel = eyebrow ?? slateTimeWordTitle(tonight);

  return (
    <section
      id={sectionId}
      aria-labelledby={headingId}
      className={`border-y border-white/10 bg-[#0d0d11] px-4 ${compactTopPadding ? "pb-10 pt-4" : "py-10"} sm:px-6 lg:px-8`}
      data-responsive-check="must-watch"
      data-slate-date={tonight.date}
      data-generated-at={tonight.generatedAt}
      data-game-count={shownGames.length}
      data-visible-game-pks={shownGames.length ? shownGames.map((game) => game.gamePk).join(",") : "none"}
      data-visible-game-dates={shownGames.length ? shownGames.map((game) => game.date).join(",") : "none"}
      data-visible-matchup-labels={shownGames.length ? shownGames.map((game) => game.label).join(",") : "none"}
      data-visible-team-matchups={shownGames.length ? shownGames.map((game) => `${game.away}@${game.home}`).join(",") : "none"}
      data-visible-team-names={shownGames.length ? shownGames.map((game) => `${game.awayName}/${game.homeName}`).join(",") : "none"}
      data-visible-venues={shownGames.length ? shownGames.map((game) => game.park ?? "Venue TBD").join(",") : "none"}
      data-visible-first-pitches={shownGames.length ? shownGames.map((game) => game.firstPitch).join(",") : "none"}
      data-visible-game-statuses={shownGames.length ? shownGames.map((game) => game.status).join(",") : "none"}
      data-visible-detailed-states={shownGames.length ? shownGames.map((game) => game.detailedState).join(",") : "none"}
      data-visible-card-aria-labels={shownGames.length ? shownGames.map((game) => watchCardAriaLabel(game)).join("|") : "none"}
      data-visible-summary-status-labels={shownGames.length ? shownGames.map((game) => gameStatusLabel(game.status)).join(",") : "none"}
      data-visible-summary-ids={shownGames.length ? shownGames.map((game) => watchCardSummaryId(game)).join(",") : "none"}
      data-visible-summary-aria-labels={shownGames.length ? shownGames.map((game) => watchCardSummaryAriaLabel(game)).join("|") : "none"}
      data-visible-starter-sides={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.side).join("/")).join(",") : "none"}
      data-visible-starter-statuses={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.status).join("/")).join(",") : "none"}
      data-visible-starter-fallback-labels={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starterFallbackDataLabel(starter)).join("|")).join(",") : "none"}
      data-visible-starter-pitcher-ids={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.pitcherId ?? "tbd").join("/")).join(",") : "none"}
      data-visible-starter-names={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.name ?? "TBD").join("/")).join(",") : "none"}
      data-visible-starter-teams={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.team).join("/")).join(",") : "none"}
      data-visible-starter-form-hrefs={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.pitcherId ? pitcherFormHref(starter.pitcherId, starter.name) : "none").join("|")).join(",") : "none"}
      data-visible-starter-name-linkeds={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => String(Boolean(starter.pitcherId))).join("/")).join(",") : "none"}
      data-visible-starter-form-tiers={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.tier ?? "none").join("/")).join(",") : "none"}
      data-visible-starter-form-trends={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.trend ?? "none").join("/")).join(",") : "none"}
      data-visible-starter-form-scores={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.rgs === null || starter.rgs === undefined ? "pending" : starter.rgs.toFixed(1)).join("/")).join(",") : "none"}
      data-visible-starter-delta-forms={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.deltaForm === null || starter.deltaForm === undefined ? "pending" : starter.deltaForm.toFixed(1)).join("/")).join(",") : "none"}
      data-visible-starter-spark-counts={shownGames.length ? shownGames.map(gameSparkCountPairValue).join(",") : "none"}
      data-visible-starter-spark-readies={shownGames.length ? shownGames.map(gameSparkReadyPairValue).join(",") : "none"}
      data-visible-starter-spark-ready-counts={shownGames.length ? shownGames.map(gameSparkReadyCountValue).join(",") : "none"}
      data-visible-starter-spark-latest={shownGames.length ? shownGames.map(gameSparkLatestPairValue).join(",") : "none"}
      data-visible-starter-season-ip={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => seasonNumberValue(starter.seasonStats?.inningsPitched, 1)).join("/")).join(",") : "none"}
      data-visible-starter-season-era={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => seasonNumberValue(starter.seasonStats?.era, 2)).join("/")).join(",") : "none"}
      data-visible-starter-season-whip={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => seasonNumberValue(starter.seasonStats?.whip, 2)).join("/")).join(",") : "none"}
      data-visible-starter-season-k9={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => seasonNumberValue(starter.seasonStats?.k9, 1)).join("/")).join(",") : "none"}
      data-visible-starter-window-counts={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.windowCount === null || starter.windowCount === undefined ? "pending" : String(starter.windowCount)).join("/")).join(",") : "none"}
      data-visible-starter-last-start-dates={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.lastStart?.gameDate ?? "none").join("/")).join(",") : "none"}
      data-visible-starter-last-start-game-pks={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.lastStart?.gamePk ?? "none").join("/")).join(",") : "none"}
      data-visible-starter-last-start-opponents={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.lastStart?.opp ?? "none").join("/")).join(",") : "none"}
      data-visible-starter-last-start-parks={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.lastStart?.park ?? "none").join("/")).join(",") : "none"}
      data-visible-starter-last-start-lines={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starterLastStartLineValue(starter)).join("/")).join(",") : "none"}
      data-visible-starter-last-start-gs={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.lastStart ? starter.lastStart.gsPlus.toFixed(1) : "none").join("/")).join(",") : "none"}
      data-visible-starter-last-start-tiers={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.lastStart?.tier ?? "none").join("/")).join(",") : "none"}
      data-visible-starter-last-start-hrefs={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.lastStart?.startHref ?? "none").join("|")).join(",") : "none"}
      data-visible-starter-driver-counts={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => String(starter.driverChips?.length ?? 0)).join("/")).join(",") : "none"}
      data-visible-starter-visible-driver-counts={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => String(Math.min(starter.driverChips?.length ?? 0, 3))).join("/")).join(",") : "none"}
      data-visible-starter-top-driver-keys={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.driverChips?.[0]?.key ?? "none").join("/")).join(",") : "none"}
      data-visible-starter-top-driver-labels={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.driverChips?.[0]?.label ?? "none").join("/")).join(",") : "none"}
      data-visible-starter-top-driver-directions={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.driverChips?.[0]?.direction ?? "none").join("/")).join(",") : "none"}
      data-visible-starter-top-driver-deltas={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.driverChips?.[0] ? starter.driverChips[0].delta.toFixed(1) : "none").join("/")).join(",") : "none"}
      data-visible-starter-top-driver-scores={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.driverChips?.[0] ? starter.driverChips[0].score.toFixed(1) : "none").join("/")).join(",") : "none"}
      data-visible-starter-accent-sources={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starterFormAccent(starter).source).join("/")).join(",") : "none"}
      data-visible-starter-accent-bands={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starterFormAccent(starter).band).join("/")).join(",") : "none"}
      data-visible-starter-accent-colors={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starterFormAccent(starter).color).join("/")).join(",") : "none"}
      data-visible-starter-market-statuses={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.marketContext?.status ?? "none").join("/")).join(",") : "none"}
      data-visible-starter-market-sources={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.marketContext?.source ?? "none").join("/")).join(",") : "none"}
      data-visible-starter-market-labels={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.marketContext?.label ?? "none").join("|")).join(",") : "none"}
      data-visible-starter-projection-statuses={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.projection?.status ?? "none").join("/")).join(",") : "none"}
      data-visible-starter-projection-confidences={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.projection?.confidence ?? "none").join("/")).join(",") : "none"}
      data-visible-starter-projection-gs={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => projectionDisplayValue(starter.projection?.projectedGsPlus)).join("/")).join(",") : "none"}
      data-visible-starter-projection-innings={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => projectionDisplayValue(starter.projection?.line.inningsPitched)).join("/")).join(",") : "none"}
      data-visible-starter-projection-strikeouts={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => projectionDisplayValue(starter.projection?.line.strikeouts)).join("/")).join(",") : "none"}
      data-visible-starter-projection-earned-runs={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => projectionDisplayValue(starter.projection?.line.earnedRuns)).join("/")).join(",") : "none"}
      data-visible-starter-projection-token-counts={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => projectionLineTokenCount(starter)).join("/")).join(",") : "none"}
      data-visible-starter-opponent-split-teams={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.opponentSplit?.team ?? "none").join("/")).join(",") : "none"}
      data-visible-starter-opponent-splits={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.opponentSplit?.split ?? "none").join("/")).join(",") : "none"}
      data-visible-starter-opponent-split-labels={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.opponentSplit?.label ?? "none").join("|")).join("||") : "none"}
      data-visible-starter-opponent-split-ops={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => splitNumberValue(starter.opponentSplit?.ops, 3)).join("/")).join(",") : "none"}
      data-visible-starter-opponent-split-run-values={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => splitNumberValue(starter.opponentSplit?.matchupRunValue, 1)).join("/")).join(",") : "none"}
      data-visible-starter-rest-labels={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.workload?.restLabel ?? "unknown").join("/")).join(",") : "none"}
      data-visible-starter-days-rest={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.workload?.daysRest === null || starter.workload?.daysRest === undefined ? "pending" : String(starter.workload.daysRest)).join("/")).join(",") : "none"}
      data-visible-starter-avg-pitches-last-5={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => workloadNumberValue(starter.workload?.avgPitchesLast5)).join("/")).join(",") : "none"}
      data-visible-starter-avg-ip-last-5={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => workloadNumberValue(starter.workload?.avgIpLast5)).join("/")).join(",") : "none"}
      data-visible-starter-limited-samples={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => String(starter.flags?.limitedSample === true)).join("/")).join(",") : "none"}
      data-visible-starter-rust-flags={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => String(starter.flags?.rust === true)).join("/")).join(",") : "none"}
      data-visible-starter-status-chip-counts={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => String(starterStatusChipCount(starter))).join("/")).join(",") : "none"}
      data-visible-park-run-factors={shownGames.length ? shownGames.map((game) => game.parkContext.runFactor.toFixed(2)).join(",") : "none"}
      data-visible-park-run-values={shownGames.length ? shownGames.map((game) => game.parkContext.runValue.toFixed(1)).join(",") : "none"}
      data-visible-park-labels={shownGames.length ? shownGames.map((game) => game.parkContext.label).join("|") : "none"}
      data-visible-park-tones={shownGames.length ? shownGames.map((game) => parkContextTone(game)).join(",") : "none"}
      data-visible-weather-sources={shownGames.length ? shownGames.map((game) => game.weatherContext.source).join(",") : "none"}
      data-visible-weather-run-values={shownGames.length ? shownGames.map((game) => game.weatherContext.runValue.toFixed(1)).join(",") : "none"}
      data-visible-weather-labels={shownGames.length ? shownGames.map((game) => game.weatherContext.label).join("|") : "none"}
      data-visible-weather-temp-f={shownGames.length ? shownGames.map((game) => weatherMetricValue(game.weatherContext.tempF, 0)).join(",") : "none"}
      data-visible-weather-wind-mph={shownGames.length ? shownGames.map((game) => weatherMetricValue(game.weatherContext.windMph, 0)).join(",") : "none"}
      data-visible-weather-precip-probabilities={shownGames.length ? shownGames.map((game) => weatherMetricValue(game.weatherContext.precipProbability, 0)).join(",") : "none"}
      data-visible-weather-tones={shownGames.length ? shownGames.map((game) => weatherContextTone(game)).join(",") : "none"}
      data-visible-watch-card-kinds={shownGames.length ? shownGames.map((_, index) => watchCardKind(index)).join(",") : "none"}
      data-visible-watch-ranks={shownGames.length ? shownGames.map((game, index) => watchCardRankValue(game, index)).join(",") : "none"}
      data-visible-watch-rank-labels={shownGames.length ? shownGames.map(() => rankLabel).join("|") : "none"}
      data-visible-watch-scores={shownGames.length ? shownGames.map((game) => game.gameWatchScore.toFixed(1)).join(",") : "none"}
      data-visible-watch-score-labels={shownGames.length ? shownGames.map((game) => watchScoreLabel(game)).join("|") : "none"}
      data-visible-watch-tiers={shownGames.length ? shownGames.map((game) => game.watchTier).join(",") : "none"}
      data-visible-watch-tier-labels={shownGames.length ? shownGames.map((_, index) => watchTierForRank(index + 1).label).join("|") : "none"}
      data-visible-watch-sort-groups={shownGames.length ? shownGames.map((game) => game.watchSortGroup).join(",") : "none"}
      data-visible-watch-sort-group-labels={shownGames.length ? shownGames.map((game) => watchSortGroupLabel(game)).join("|") : "none"}
      data-visible-watch-flag-keys={shownGames.length ? shownGames.map((game) => watchFlagNoteKeys(game).join("+") || "clear").join(",") : "none"}
      data-visible-watch-flag-labels={shownGames.length ? shownGames.map((game) => watchFlagNoteDataLabel(game)).join("|") : "none"}
      data-visible-component-counts={shownGames.length ? shownGames.map(() => String(WATCH_COMPONENT_KEYS.length)).join(",") : "none"}
      data-visible-component-keys={shownGames.length ? shownGames.map(() => WATCH_COMPONENT_KEYS.join("/")).join(",") : "none"}
      data-visible-component-layouts={shownGames.length ? shownGames.map((_, index) => watchComponentLayout(index === 0 ? "featured" : "compact")).join(",") : "none"}
      data-visible-component-labels={shownGames.length ? shownGames.map(() => WATCH_COMPONENT_LABELS.join("/")).join("|") : "none"}
      data-visible-component-top-arms={shownGames.length ? shownGames.map((game) => game.watchComponents.topArm.toFixed(1)).join(",") : "none"}
      data-visible-component-pairings={shownGames.length ? shownGames.map((game) => game.watchComponents.pairing.toFixed(1)).join(",") : "none"}
      data-visible-component-matchups={shownGames.length ? shownGames.map((game) => game.matchupScore.toFixed(1)).join(",") : "none"}
      data-visible-component-details={shownGames.length ? shownGames.map((game) => watchComponentDetails(game, rankLabel).join("/")).join(",") : "none"}
      data-visible-component-item-aria-labels={shownGames.length ? shownGames.map((game) => watchComponentItemAriaLabels(game, rankLabel).join("/")).join("|") : "none"}
      data-visible-component-aria-labels={shownGames.length ? shownGames.map((game) => watchComponentsAriaLabel(game)).join("|") : "none"}
      data-visible-matchup-ranks={shownGames.length ? shownGames.map((game) => game.matchupRankTonight).join(",") : "none"}
      data-visible-matchup-context-statuses={shownGames.length ? shownGames.map((game) => game.matchupContext.status).join(",") : "none"}
      data-visible-matchup-context-labels={shownGames.length ? shownGames.map((game) => game.matchupContext.label).join(",") : "none"}
      data-visible-matchup-status-labels={shownGames.length ? shownGames.map((game) => matchupStatusLabel(game)).join(",") : "none"}
      data-visible-hook-reason-keys={shownGames.length ? shownGames.map((game) => watchHookReasonKey(game, rankLabel)).join(",") : "none"}
      data-visible-hook-reasons={shownGames.length ? shownGames.map((game) => watchHookReason(game, rankLabel)).join("|") : "none"}
      data-scheduled-games={tonight.scheduledGames}
      data-rank-label={rankLabel}
      data-active-card-statuses={tonight.activeCardStatuses.join(",")}
      data-form-window={tonight.formWindow}
      data-form-through-date={tonight.formThroughDate ?? "none"}
      data-latest-scored-start-date={tonight.latestScoredStartDate ?? "none"}
      data-form-data-stale={String(tonight.formDataStale)}
      data-league-mean-gs={tonight.leagueMeanGS.toFixed(1)}
      data-watch-weight-top-arm={tonight.watchScoreWeights.topArm}
      data-watch-weight-pairing={tonight.watchScoreWeights.pairAvg}
      data-watch-weight-matchup={tonight.watchScoreWeights.matchup}
      data-watch-sort-policy={tonight.watchSortPolicy}
      data-watch-score-min={tonight.watchScoreRange.min}
      data-watch-score-max={tonight.watchScoreRange.max}
      data-watch-score-precision={tonight.watchScorePrecision}
      data-matchup-score-min={tonight.matchupScoreRange.min}
      data-matchup-score-max={tonight.matchupScoreRange.max}
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col justify-between gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-zinc-500">{eyebrowLabel}</p>
            <h2 id={headingId} className="section-title mt-2 font-serif text-4xl font-bold text-zinc-50">{title}</h2>
            <p className="blurb mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
              One card per game, ranked by starter form and matchup context.
            </p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-600">
              <MetaLine
                segments={[
                  <>Data through <LocalTime value={tonight.generatedAt} fallback={formatFirstPitch(tonight.generatedAt)} /></>,
                  "MLB Stats API",
                  "Baseball Savant",
                  "Open-Meteo",
                ]}
              />
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
          <div
            className="rounded border border-white/10 bg-[#101014] p-6"
            role="status"
            aria-label="Upcoming slate status"
            data-empty-reason={tonight.scheduledGames > 0 ? "completed-or-postponed" : "no-games"}
            data-empty-game-count={shownGames.length}
            data-empty-scheduled-games={tonight.scheduledGames}
          >
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">{tonight.scheduledGames > 0 ? "Slate complete" : "No games on this slate"}</p>
            <p className="mt-3 text-sm text-zinc-400">
              {tonight.scheduledGames > 0
                ? "No active pregame matchups remain on this slate. Final or postponed games are removed from the upcoming watch list."
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

function MustWatchHeadliner({ game, leagueMeanGS, rankLabel }: { game: TonightGame; leagueMeanGS: number; slateSize: number; rankLabel: string }) {
  const tier = watchTierForRank(1);
  const summaryId = watchCardSummaryId(game);
  const awayStarter = game.starters[0];
  const homeStarter = game.starters[1];
  const awayAccent = starterFormAccent(awayStarter);
  const homeAccent = starterFormAccent(homeStarter);

  return (
    <article
      className="heat-glow-card relative overflow-hidden rounded border border-amber-300/25 bg-[#101014] p-5 lg:p-6"
      style={{ ...glowStyle(game.gameWatchScore, 100), ...duelStyle(awayAccent.color, homeAccent.color) }}
      data-responsive-check="must-watch-headliner"
      data-game-pk={game.gamePk}
      data-game-date={game.date}
      data-game-status={game.status}
      data-game-detailed-state={game.detailedState}
      data-away-team={game.away}
      data-away-team-name={game.awayName}
      data-home-team={game.home}
      data-home-team-name={game.homeName}
      data-matchup-label={game.label}
      data-first-pitch={game.firstPitch}
      data-venue={gameVenueLabel(game)}
      data-has-tbd={String(game.flags?.tbd === true)}
      data-limited-form={String(game.flags?.limitedForm === true)}
      data-matchup-context-status={game.matchupContext.status}
      data-matchup-context-label={game.matchupContext.label}
      data-matchup-status-label={matchupStatusLabel(game)}
      data-matchup-score={game.matchupScore.toFixed(1)}
      data-matchup-rank={game.matchupRankTonight}
      data-watch-card-kind="headliner"
      data-watch-rank={game.status === "ppd" ? "-" : "1"}
      data-watch-rank-label={rankLabel}
      data-watch-sort-group={game.watchSortGroup}
      data-watch-sort-group-label={watchSortGroupLabel(game)}
      data-watch-score={game.gameWatchScore.toFixed(1)}
      data-watch-score-label={watchScoreLabel(game)}
      data-watch-score-tier={game.watchTier}
      data-watch-tier={tier.label}
      data-watch-flag-keys={watchFlagNoteKeys(game).join("+") || "clear"}
      data-watch-flag-label={watchFlagNoteDataLabel(game)}
      data-watch-summary-id={summaryId}
      data-watch-summary-aria-label={watchCardSummaryAriaLabel(game)}
      data-away-accent-source={awayAccent.source}
      data-away-accent-band={awayAccent.band}
      data-away-accent-color={awayAccent.color}
      data-home-accent-source={homeAccent.source}
      data-home-accent-band={homeAccent.band}
      data-home-accent-color={homeAccent.color}
      aria-label={watchCardAriaLabel(game)}
      aria-describedby={summaryId}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgb(var(--away-rgb)/0.24),transparent_32%),radial-gradient(circle_at_82%_12%,rgb(var(--home-rgb)/0.24),transparent_30%),linear-gradient(90deg,rgb(var(--away-rgb)/0.13),transparent_35%,transparent_65%,rgb(var(--home-rgb)/0.13))]" />
      <div className="relative">
        <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-5 md:flex-row md:items-start">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em]" style={{ color: tier.color }}>{tier.label}</p>
            <h3 className="card-title mt-2 font-serif text-[1.8rem] font-bold text-zinc-50 lg:text-[2.4rem]">{game.label}</h3>
            <p
              id={summaryId}
              className="mt-2 font-mono text-xs uppercase tracking-[0.16em] text-zinc-500"
              data-summary-status-label={gameStatusLabel(game.status)}
              data-first-pitch={game.firstPitch}
              data-venue={gameVenueLabel(game)}
              aria-label={watchCardSummaryAriaLabel(game)}
            >
              <MetaLine segments={[gameStatusLabel(game.status), <LocalTime key="first-pitch" value={game.firstPitch} fallback={formatFirstPitch(game.firstPitch)} />, gameVenueLabel(game)]} />
            </p>
            <GameEnvironmentChips game={game} />
          </div>
          <div className="rounded border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-left md:text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200">Top watch score</p>
            <p className="mt-1 font-serif text-3xl font-black text-amber-100">#1 {rankLabel}</p>
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

function watchCardRankValue(game: TonightGame, index: number) {
  return game.status === "ppd" && index === 0 ? "-" : String(index + 1);
}

function watchCardKind(index: number) {
  return index === 0 ? "headliner" : "row";
}

function watchScoreLabel(game: TonightGame) {
  return `Watch score ${game.gameWatchScore.toFixed(1)}`;
}

function watchSortGroupLabel(game: TonightGame) {
  if (game.status === "pregame") return "Pregame sort bucket";
  if (game.status === "live") return "Live sort bucket";
  return "Fallback sort bucket";
}

function MustWatchRow({ game, rank, slateSize, leagueMeanGS, rankLabel }: { game: TonightGame; rank: number; slateSize: number; leagueMeanGS: number; rankLabel: string }) {
  const tier = watchTierForRank(rank);
  const summaryId = watchCardSummaryId(game);
  const isStarted = game.status === "live";
  const awayAccent = starterFormAccent(game.starters[0]);
  const homeAccent = starterFormAccent(game.starters[1]);

  return (
    <article
      className={`heat-glow-card relative overflow-hidden rounded border bg-[#101014] p-4 ${isStarted ? "border-sky-300/20 opacity-75" : "border-white/10"}`}
      style={{ ...glowStyle(game.gameWatchScore, 100), ...duelStyle(awayAccent.color, homeAccent.color) }}
      data-responsive-check="must-watch-row"
      data-game-pk={game.gamePk}
      data-game-date={game.date}
      data-game-status={game.status}
      data-game-detailed-state={game.detailedState}
      data-away-team={game.away}
      data-away-team-name={game.awayName}
      data-home-team={game.home}
      data-home-team-name={game.homeName}
      data-matchup-label={game.label}
      data-first-pitch={game.firstPitch}
      data-venue={gameVenueLabel(game)}
      data-has-tbd={String(game.flags?.tbd === true)}
      data-limited-form={String(game.flags?.limitedForm === true)}
      data-matchup-context-status={game.matchupContext.status}
      data-matchup-context-label={game.matchupContext.label}
      data-matchup-status-label={matchupStatusLabel(game)}
      data-matchup-score={game.matchupScore.toFixed(1)}
      data-matchup-rank={game.matchupRankTonight}
      data-watch-card-kind="row"
      data-watch-rank={rank}
      data-watch-rank-label={rankLabel}
      data-watch-sort-group={game.watchSortGroup}
      data-watch-sort-group-label={watchSortGroupLabel(game)}
      data-watch-score={game.gameWatchScore.toFixed(1)}
      data-watch-score-label={watchScoreLabel(game)}
      data-watch-score-tier={game.watchTier}
      data-watch-tier={tier.label}
      data-watch-flag-keys={watchFlagNoteKeys(game).join("+") || "clear"}
      data-watch-flag-label={watchFlagNoteDataLabel(game)}
      data-watch-summary-id={summaryId}
      data-watch-summary-aria-label={watchCardSummaryAriaLabel(game)}
      data-away-accent-source={awayAccent.source}
      data-away-accent-band={awayAccent.band}
      data-away-accent-color={awayAccent.color}
      data-home-accent-source={homeAccent.source}
      data-home-accent-band={homeAccent.band}
      data-home-accent-color={homeAccent.color}
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
              <h3 className="card-title font-serif text-[1.2rem] font-bold text-zinc-50">{game.label}</h3>
              <p
                id={summaryId}
                className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-zinc-500"
                data-summary-status-label={gameStatusLabel(game.status)}
                data-first-pitch={game.firstPitch}
                data-venue={gameVenueLabel(game)}
                aria-label={watchCardSummaryAriaLabel(game)}
              >
                <MetaLine
                  segments={[
                    gameStatusLabel(game.status),
                    <LocalTime key="first-pitch" value={game.firstPitch} fallback={formatFirstPitch(game.firstPitch)} />,
                    gameVenueLabel(game),
                    `#${rank} of ${slateSize} watch rank`,
                  ]}
                />
              </p>
              <GameEnvironmentChips game={game} compact />
            </div>
            <p className="shrink-0 rounded border border-amber-300/25 bg-amber-300/10 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-200">
              {matchupStatusLabel(game)}
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
  const [topArmDetail, pairingDetail, matchupDetail] = watchComponentDetails(game, rankLabel);
  const [topArmAriaLabel, pairingAriaLabel, matchupAriaLabel] = watchComponentItemAriaLabels(game, rankLabel);
  const layout = watchComponentLayout(featured ? "featured" : compact ? "compact" : "standard");
  const items = [
    { key: WATCH_COMPONENT_KEYS[0], label: WATCH_COMPONENT_LABELS[0], value: game.watchComponents.topArm, detail: topArmDetail, ariaLabel: topArmAriaLabel },
    { key: WATCH_COMPONENT_KEYS[1], label: WATCH_COMPONENT_LABELS[1], value: game.watchComponents.pairing, detail: pairingDetail, ariaLabel: pairingAriaLabel },
    {
      key: WATCH_COMPONENT_KEYS[2],
      label: WATCH_COMPONENT_LABELS[2],
      value: game.matchupScore,
      detail: matchupDetail,
      ariaLabel: matchupAriaLabel,
    },
  ];

  return (
    <div
      className={`${compact ? "mt-3" : featured ? "mt-5" : "mt-5"} grid gap-2 sm:grid-cols-3`}
      data-responsive-check="watch-components"
      data-game-pk={game.gamePk}
      data-watch-component-count={items.length}
      data-watch-component-keys={items.map((item) => item.key).join("/")}
      data-watch-component-layout={layout}
      data-watch-component-labels={items.map((item) => item.label).join("/")}
      data-watch-component-values={items.map((item) => item.value.toFixed(1)).join("/")}
      data-watch-component-details={items.map((item) => item.detail).join("/")}
      data-watch-component-item-aria-labels={items.map((item) => item.ariaLabel).join("/")}
      data-watch-component-aria-label={watchComponentsAriaLabel(game)}
      data-matchup-rank={game.matchupRankTonight}
      data-matchup-rank-label={rankLabel}
      role="group"
      aria-label={watchComponentsAriaLabel(game)}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={`${featured ? "px-3.5 py-3" : "px-3 py-2"} rounded border border-white/10 bg-black/25`}
          style={glowStyle(item.value, 100)}
          data-watch-component={item.key}
          data-watch-label={item.label}
          data-watch-value={item.value.toFixed(1)}
          data-watch-detail={item.detail}
          data-watch-item-aria-label={item.ariaLabel}
          role={item.ariaLabel === "none" ? undefined : "img"}
          aria-label={item.ariaLabel === "none" ? undefined : item.ariaLabel}
        >
          <div className="flex items-baseline justify-between gap-3 font-mono">
            <p className="text-[10px] uppercase tracking-[0.14em]" style={{ color: componentBarColor(item.value) }}>{item.label}</p>
            <p className="text-xs font-semibold text-zinc-200">{item.value.toFixed(1)}{item.detail !== "none" ? <span className="ml-1 text-zinc-500">{item.detail}</span> : null}</p>
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

function watchComponentLayout(layout: "featured" | "compact" | "standard") {
  return layout;
}

function watchComponentDetails(game: TonightGame, rankLabel: string) {
  return [
    "none",
    "none",
    game.matchupContext.status === "pending-opponent-splits" ? "pending" : `${ordinal(game.matchupRankTonight)} ${rankLabel}`,
  ];
}

function watchComponentItemAriaLabels(game: TonightGame, rankLabel: string) {
  const [, , matchupDetail] = watchComponentDetails(game, rankLabel);
  return [
    "none",
    "none",
    matchupDetail === "pending"
      ? "Opponent split matchup context pending"
      : `Matchup score ${Math.round(game.matchupScore)}, ranked ${matchupDetail}`,
  ];
}

function MatchupSpine({ game, leagueMeanGS, rankLabel }: { game: TonightGame; leagueMeanGS: number; rankLabel: string }) {
  const [awayStarter, homeStarter] = game.starters;
  const reason = watchHookReason(game, rankLabel);
  const reasonKey = watchHookReasonKey(game, rankLabel);

  return (
    <div
      className="flex min-h-full flex-col justify-between rounded border border-amber-300/25 bg-black/35 p-4 text-center shadow-[inset_0_0_42px_rgba(251,191,36,0.08)]"
      data-responsive-check="watch-hook"
      data-hook-score={game.gameWatchScore.toFixed(1)}
      data-hook-score-label="score"
      data-hook-reason-key={reasonKey}
      data-hook-reason={reason}
    >
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-200">The hook</p>
        <p className="mt-1 font-serif text-5xl font-black leading-none text-amber-100">{game.gameWatchScore.toFixed(1)}</p>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-zinc-400">score</p>
        <p className="mt-3 text-sm leading-5 text-zinc-300">{reason}</p>
      </div>
      <div className="mt-4">
        <FormClash away={awayStarter} home={homeStarter} leagueMeanGS={leagueMeanGS} />
      </div>
    </div>
  );
}

function watchHookReason(game: TonightGame, rankLabel: string) {
  const reasonKey = watchHookReasonKey(game, rankLabel);
  if (reasonKey === "fallback-slate" || reasonKey === "fallback-group") {
    return isSlateRankLabel(rankLabel) ? "Top watch score on the slate" : "Top watch score in this group";
  }
  if (reasonKey === "best-matchup") return "Best matchup on the board";
  if (reasonKey === "two-heating") return "Two arms trending up";
  if (reasonKey === "strikeout-upside") return "Strikeout upside";
  return isSlateRankLabel(rankLabel) ? "Top watch score on the slate" : "Top watch score in this group";
}

function watchHookReasonKey(game: TonightGame, rankLabel: string) {
  if (game.flags?.tbd || game.flags?.limitedForm || game.matchupContext.status === "pending-opponent-splits") {
    return isSlateRankLabel(rankLabel) ? "fallback-slate" : "fallback-group";
  }
  if (game.matchupRankTonight === 1) return "best-matchup";
  if (game.starters.every((starter) => starter.trend === "heating")) return "two-heating";
  if (combinedProjectedStrikeouts(game.starters) >= 12) return "strikeout-upside";
  return isSlateRankLabel(rankLabel) ? "fallback-slate" : "fallback-group";
}

function isSlateRankLabel(rankLabel: string) {
  return rankLabel === "today" || rankLabel === "tomorrow" || rankLabel === "yesterday" || rankLabel.startsWith("on ");
}

function combinedProjectedStrikeouts(starters: TonightGame["starters"]) {
  return starters.reduce((total, starter) => {
    const projected = starter.marketContext?.projectedStrikeouts ?? starter.projection?.line.strikeouts ?? 0;
    return total + projected;
  }, 0);
}

function DuelStarterPanel({ starter, leagueMeanGS, align }: { starter: TonightStarter; leagueMeanGS: number; align: "away" | "home" }) {
  const name = starter.name ?? "TBD";
  const formHref = starter.pitcherId ? pitcherFormHref(starter.pitcherId, starter.name) : null;
  const accent = starterFormAccent(starter);
  const teamColor = teamAccentColor(starter.team);

  return (
    <div
      className={`relative overflow-hidden rounded border border-white/10 bg-black/25 p-4 ${align === "home" ? "lg:text-right" : ""}`}
      style={{
        borderColor: `${accent.color}${accent.source === "form-band" ? "66" : "33"}`,
        boxShadow: `inset ${align === "home" ? "-" : ""}4px 0 0 ${accent.color}, 0 0 28px rgb(${accent.rgb} / 0.10)`,
        background: `linear-gradient(${align === "home" ? "270deg" : "90deg"}, rgb(${accent.rgb} / 0.12), rgba(0,0,0,0.25) 48%)`,
      }}
      role="group"
      aria-label={starterBlockAriaLabel(starter)}
      data-starter-layout="duel"
      data-starter-side={starter.side}
      data-starter-pitcher-id={starter.pitcherId ?? "tbd"}
      data-starter-name={starter.name ?? "TBD"}
      data-starter-team={starter.team}
      data-starter-status={starter.status}
      data-starter-accent-source={accent.source}
      data-starter-accent-band={accent.band}
      data-starter-accent-color={accent.color}
      data-starter-form-href={formHref ?? "none"}
      data-starter-name-linked={String(formHref !== null)}
      data-starter-fallback-label={starterFallbackDataLabel(starter)}
      {...starterFormData(starter)}
      {...starterSeasonData(starter)}
      {...starterLastStartData(starter)}
      {...starterWorkloadData(starter)}
      {...starterDriverData(starter)}
    >
      <div className={`flex gap-3 sm:gap-4 ${align === "home" ? "lg:flex-row-reverse" : ""}`}>
        <StarterHeadshot starter={starter} size="duel" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            <MetaLine
              segments={[
                <span key="team" className={`inline-flex items-center gap-1.5 ${align === "home" ? "lg:flex-row-reverse" : ""}`}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: teamColor }} aria-hidden="true" />
                  {starter.team}
                </span>,
                starter.side,
              ]}
            />
          </p>
          <h4 className="pitcher-name mt-1 min-w-0 font-serif text-2xl font-bold leading-tight text-zinc-50 lg:text-3xl">
            {formHref ? <Link href={formHref} className="transition hover:text-amber-200" aria-label={`View ${name} form`}>{name}</Link> : name}
          </h4>
          {starter.status === "ok" && starter.rgs !== undefined && starter.tier ? (
            <div className={`mt-3 flex flex-wrap items-center gap-2 ${align === "home" ? "lg:justify-end" : ""}`}>
              <p className={`font-mono text-sm ${tierTextClass(starter.tier)}`} style={{ color: accent.color }}>{starter.rgs.toFixed(1)}<EraAnchor starter={starter} /></p>
              {starter.trend && starter.deltaForm !== undefined ? <TrendChip summary={{ trend: starter.trend, deltaForm: starter.deltaForm }} compact /> : null}
              <StarterStatusChips starter={starter} />
              <FormDriverChips chips={starter.driverChips} limit={3} compact />
            </div>
          ) : (
            <LimitedStarterLine starter={starter} />
          )}
          <PitcherAvailabilityNote availability={starter.availability} compact className={align === "home" ? "mt-2 lg:ml-auto" : "mt-2"} />
          <StarterProjectionLine starter={starter} align={align} />
          <OpponentSplitLine starter={starter} align={align} />
          <MarketContextLine starter={starter} align={align} />
        </div>
      </div>
      {hasStarterSparkForm(starter) ? (
        <div className="mt-3">
          <FormSparkline values={starter.spark} tier={starter.tier} leagueMeanGS={leagueMeanGS} label={`${name} recent form GS+: ${starter.spark.join(", ")}`} trend={starter.trend ?? "steady"} strokeColor={accent.color} variant="row" />
        </div>
      ) : null}
    </div>
  );
}

function FormClash({ away, home, leagueMeanGS }: { away: TonightStarter; home: TonightStarter; leagueMeanGS: number }) {
  const clashData = formClashData(away, home);
  if (!hasStarterSparkForm(away) || !hasStarterSparkForm(home)) {
    return (
      <p
        className="rounded border border-white/10 bg-black/25 px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] text-zinc-500"
        {...clashData}
      >
        Form clash pending
      </p>
    );
  }

  const awayAccent = starterFormAccent(away);
  const homeAccent = starterFormAccent(home);
  const sameBand = awayAccent.band === homeAccent.band;

  return (
    <div className="rounded border border-white/10 bg-black/25 p-3 text-left" {...clashData}>
      <div className="mb-1 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
        <TeamEndLabel team={away.team} />
        <span>Form clash</span>
        <TeamEndLabel team={home.team} align="end" />
      </div>
      <div className="grid gap-1">
        <FormSparkline values={away.spark} tier={away.tier} leagueMeanGS={leagueMeanGS} label={`${away.name ?? away.team} recent form GS+: ${away.spark.join(", ")}`} trend={away.trend ?? "steady"} strokeColor={awayAccent.color} variant="mini" />
        <FormSparkline values={home.spark} tier={home.tier} leagueMeanGS={leagueMeanGS} label={`${home.name ?? home.team} recent form GS+: ${home.spark.join(", ")}`} trend={home.trend ?? "steady"} strokeColor={homeAccent.color} strokeDasharray={sameBand ? "5 4" : undefined} variant="mini" />
      </div>
    </div>
  );
}

function formClashData(away: TonightStarter, home: TonightStarter) {
  const ready = hasStarterSparkForm(away) && hasStarterSparkForm(home);
  const awayAccent = starterFormAccent(away);
  const homeAccent = starterFormAccent(home);
  return {
    "data-form-clash-status": ready ? "ready" : "pending",
    "data-form-clash-away-team": away.team,
    "data-form-clash-home-team": home.team,
    "data-form-clash-away-accent-source": awayAccent.source,
    "data-form-clash-away-accent-band": awayAccent.band,
    "data-form-clash-away-accent-color": awayAccent.color,
    "data-form-clash-home-accent-source": homeAccent.source,
    "data-form-clash-home-accent-band": homeAccent.band,
    "data-form-clash-home-accent-color": homeAccent.color,
    "data-form-clash-same-band": String(awayAccent.band === homeAccent.band),
    "data-form-clash-away-spark-count": starterSparkCountValue(away),
    "data-form-clash-home-spark-count": starterSparkCountValue(home),
    "data-form-clash-away-spark-ready": starterSparkReadyValue(away),
    "data-form-clash-home-spark-ready": starterSparkReadyValue(home),
  };
}

function hasStarterSparkForm(starter: TonightStarter): starter is TonightStarter & { spark: number[]; tier: FormTier } {
  return starter.status === "ok" && Boolean(starter.spark?.length && starter.tier);
}

function starterSparkCountValue(starter: TonightStarter) {
  return String(starter.spark?.length ?? 0);
}

function gameSparkCountPairValue(game: TonightGame) {
  return game.starters.map(starterSparkCountValue).join("/");
}

function starterSparkReadyValue(starter: TonightStarter) {
  return String(hasStarterSparkForm(starter));
}

function gameSparkReadyPairValue(game: TonightGame) {
  return game.starters.map(starterSparkReadyValue).join("/");
}

function gameSparkReadyCountValue(game: TonightGame) {
  return String(game.starters.filter(hasStarterSparkForm).length);
}

function starterSparkLatestValue(starter: TonightStarter) {
  return starter.spark?.length ? starter.spark[starter.spark.length - 1].toFixed(1) : "none";
}

function gameSparkLatestPairValue(game: TonightGame) {
  return game.starters.map(starterSparkLatestValue).join("/");
}

function TeamEndLabel({ team, align = "start" }: { team: string; align?: "start" | "end" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-zinc-400 ${align === "end" ? "flex-row-reverse" : ""}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: teamAccentColor(team) }} aria-hidden="true" />
      {team}
    </span>
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
  if (!game.flags?.tbd && !game.flags?.limitedForm && game.matchupContext.status !== "pending-opponent-splits") return null;
  const flagKeys = watchFlagNoteKeys(game);

  return (
    <p
      className={`${compact ? "mt-2" : "mt-4"} font-mono text-xs text-zinc-500`}
      aria-label={watchFlagNoteAriaLabel(game)}
      data-watch-flag-count={flagKeys.length}
      data-watch-flag-keys={flagKeys.join(",")}
      data-watch-flag-label={watchFlagNoteDataLabel(game)}
    >
      {game.flags?.tbd ? "TBD starter included with league-mean fallback. " : ""}
      {game.flags?.limitedForm ? "Limited form samples use baseline fallback where needed." : ""}
      {game.matchupContext.status === "pending-opponent-splits" ? "Opponent split context pending." : ""}
    </p>
  );
}

function watchFlagNoteKeys(game: TonightGame) {
  const keys: string[] = [];
  if (game.flags?.tbd) keys.push("tbd");
  if (game.flags?.limitedForm) keys.push("limited-form");
  if (game.matchupContext.status === "pending-opponent-splits") keys.push("pending-opponent-splits");
  return keys;
}

function watchFlagNoteDataLabel(game: TonightGame) {
  return watchFlagNoteAriaLabel(game) || "clear";
}

function GameEnvironmentChips({ game, compact = false }: { game: TonightGame; compact?: boolean }) {
  const chips = [
    {
      key: "park",
      label: `Park ${game.parkContext.runFactor.toFixed(2)}`,
      detail: game.parkContext.label,
      source: "shared-venue-run-factors",
      value: game.parkContext.runValue.toFixed(1),
      tone: game.parkContext.runFactor >= 1.06 ? "warm" : game.parkContext.runFactor <= 0.96 ? "cool" : "muted",
      metadata: {
        "data-context-park-factor": game.parkContext.runFactor.toFixed(2),
      },
    },
    {
      key: "weather",
      label: weatherChipLabel(game),
      detail: game.weatherContext.label,
      source: game.weatherContext.source,
      value: game.weatherContext.runValue.toFixed(1),
      tone: weatherContextTone(game),
      metadata: {
        "data-weather-temp-f": weatherMetricValue(game.weatherContext.tempF, 0),
        "data-weather-wind-mph": weatherMetricValue(game.weatherContext.windMph, 0),
        "data-weather-precip-probability": weatherMetricValue(game.weatherContext.precipProbability, 0),
      },
    },
  ] as const;

  return (
    <div className={`${compact ? "mt-2" : "mt-3"} flex flex-wrap gap-1.5`} aria-label={`${game.label} park and weather context`}>
      {chips.map((chip) => (
        <span
          key={chip.label}
          title={chip.detail}
          data-context-chip={chip.key}
          data-context-source={chip.source}
          data-context-run-value={chip.value}
          data-context-label={chip.detail}
          data-context-tone={chip.tone}
          {...chip.metadata}
          className={`inline-flex min-h-6 items-center rounded border px-2 font-mono text-[10px] uppercase tracking-[0.12em] ${
            chip.tone === "warm"
              ? "border-amber-300/30 bg-amber-300/10 text-amber-200"
              : chip.tone === "cool"
                ? "border-sky-300/30 bg-sky-300/10 text-sky-200"
                : "border-white/10 bg-white/[0.04] text-zinc-400"
          }`}
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}

function weatherMetricValue(value: number | undefined, precision: number) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(precision) : "pending";
}

function parkContextTone(game: TonightGame) {
  if (game.parkContext.runFactor >= 1.06) return "warm";
  if (game.parkContext.runFactor <= 0.96) return "cool";
  return "muted";
}

function weatherContextTone(game: TonightGame) {
  if (game.weatherContext.runValue > 0.4) return "warm";
  if (game.weatherContext.runValue < -0.4) return "cool";
  return "muted";
}

function StarterMini({ starter, leagueMeanGS }: { starter: TonightStarter; leagueMeanGS: number }) {
  const name = starter.name ?? "TBD";
  const formHref = starter.pitcherId ? pitcherFormHref(starter.pitcherId, starter.name) : null;
  const accent = starterFormAccent(starter);

  return (
    <div
      className="grid min-w-0 grid-cols-[38px_minmax(0,1fr)_auto] items-start gap-3 rounded border border-white/10 bg-black/25 p-3"
      style={{
        borderColor: `${accent.color}${accent.source === "form-band" ? "44" : "2E"}`,
        boxShadow: `inset 3px 0 0 ${accent.color}`,
        background: `linear-gradient(90deg, rgb(${accent.rgb} / 0.10), rgba(0,0,0,0.25) 45%)`,
      }}
      role="group"
      aria-label={starterBlockAriaLabel(starter)}
      data-starter-layout="mini"
      data-starter-side={starter.side}
      data-starter-pitcher-id={starter.pitcherId ?? "tbd"}
      data-starter-name={starter.name ?? "TBD"}
      data-starter-team={starter.team}
      data-starter-status={starter.status}
      data-starter-accent-source={accent.source}
      data-starter-accent-band={accent.band}
      data-starter-accent-color={accent.color}
      data-starter-form-href={formHref ?? "none"}
      data-starter-name-linked={String(formHref !== null)}
      data-starter-fallback-label={starterFallbackDataLabel(starter)}
      {...starterFormData(starter)}
      {...starterSeasonData(starter)}
      {...starterLastStartData(starter)}
      {...starterWorkloadData(starter)}
      {...starterDriverData(starter)}
    >
      <StarterHeadshot starter={starter} size="small" />
      <div className="min-w-0">
        <p className="pitcher-name min-w-0 text-sm font-medium leading-tight text-zinc-100">
          {formHref ? <Link href={formHref} className="transition hover:text-amber-200" aria-label={`View ${name} form`}>{name}</Link> : name}
        </p>
        <p className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: teamAccentColor(starter.team) }} aria-hidden="true" />
          {starter.team}
        </p>
        {starter.status === "insufficient" && starter.lastStart ? (
          <p className="mt-1 text-[11px] text-zinc-500">
            <MetaLine segments={[`Last: vs ${starter.lastStart.opp}`, `GS+ ${starter.lastStart.gsPlus}`]} />
          </p>
        ) : null}
      </div>
      <div className="ml-auto text-right">
        {starter.status === "ok" && starter.rgs !== undefined && starter.tier ? (
          <>
            <p className={`font-mono text-sm ${tierTextClass(starter.tier)}`} style={{ color: accent.color }}>{starter.rgs.toFixed(1)}<EraAnchor starter={starter} /></p>
            {starter.trend && starter.deltaForm !== undefined ? <TrendChip summary={{ trend: starter.trend, deltaForm: starter.deltaForm }} compact /> : null}
          </>
        ) : (
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500" aria-label={starterFallbackAriaLabel(starter)}>
            {starter.status === "tbd" ? "TBD" : "Limited"}
          </p>
        )}
      </div>
      {starter.status === "ok" ? (
        <div className="col-span-full -mt-1">
          <StarterStatusChips starter={starter} />
          <PitcherAvailabilityNote availability={starter.availability} compact className="mt-1" />
          <FormDriverChips chips={starter.driverChips} limit={3} compact />
          <StarterProjectionLine starter={starter} compact />
          <OpponentSplitLine starter={starter} compact />
          <MarketContextLine starter={starter} compact />
        </div>
      ) : null}
      {hasStarterSparkForm(starter) ? (
        <div className="col-span-full -mt-1">
          <FormSparkline values={starter.spark} tier={starter.tier} leagueMeanGS={leagueMeanGS} label={`${name} recent form GS+: ${starter.spark.join(", ")}`} trend={starter.trend ?? "steady"} strokeColor={accent.color} />
        </div>
      ) : null}
    </div>
  );
}

function LimitedStarterLine({ starter }: { starter: TonightStarter }) {
  if (starter.status === "tbd") {
    return (
      <p className="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-zinc-500" aria-label={starterFallbackAriaLabel(starter)}>
        <MetaLine segments={["Starter TBD", "league baseline used"]} />
      </p>
    );
  }

  return (
    <div className="mt-3 text-sm text-zinc-400">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-500" aria-label={starterFallbackAriaLabel(starter)}>Limited form sample</p>
      {starter.lastStart ? (
        <p className="mt-1">
          <MetaLine
            segments={[
              `Last: vs ${starter.lastStart.opp}`,
              <StartLineText
                key="line"
                line={{
                  inningsPitched: starter.lastStart.ip,
                  hits: starter.lastStart.h,
                  earnedRuns: starter.lastStart.er,
                  walks: starter.lastStart.bb,
                  strikeouts: starter.lastStart.k,
                  pitches: 0,
                }}
              />,
              `GS+ ${starter.lastStart.gsPlus}`,
            ]}
          />
        </p>
      ) : null}
    </div>
  );
}

function StarterProjectionLine({ starter, compact = false, align }: { starter: TonightStarter; compact?: boolean; align?: "away" | "home" }) {
  const projection = starter.projection;
  if (!projection) return null;
  const justify = align === "home" ? "lg:justify-end" : "";
  const projectionData = {
    "data-projection-status": projection.status,
    "data-projection-confidence": projection.confidence,
    "data-projection-notes": projection.notes.join("; "),
    "data-projection-line-token-count": String([
      projection.line.inningsPitched,
      projection.line.strikeouts,
      projection.line.earnedRuns,
    ].filter((value) => value !== null).length),
    "data-projected-gs-plus": projection.projectedGsPlus === null ? "pending" : projection.projectedGsPlus.toFixed(1),
    "data-projected-innings": projection.line.inningsPitched === null ? "pending" : projection.line.inningsPitched.toFixed(1),
    "data-projected-strikeouts": projection.line.strikeouts === null ? "pending" : projection.line.strikeouts.toFixed(1),
    "data-projected-earned-runs": projection.line.earnedRuns === null ? "pending" : projection.line.earnedRuns.toFixed(1),
  };
  if (projection.status !== "line-backed" || projection.projectedGsPlus === null) {
    return (
      <p
        className={`${compact ? "mt-1" : "mt-3"} font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500 ${justify}`}
        {...projectionData}
      >
        Projection pending
      </p>
    );
  }

  const projectedLine: ReactNode[] = [
    projection.line.inningsPitched === null ? null : <span key="ip" className="stat-token">{projection.line.inningsPitched.toFixed(1)} IP</span>,
    projection.line.strikeouts === null ? null : <span key="k" className="stat-token">{projection.line.strikeouts.toFixed(1)} K</span>,
    projection.line.earnedRuns === null ? null : <span key="er" className="stat-token">{projection.line.earnedRuns.toFixed(1)} ER</span>,
  ].filter((segment): segment is NonNullable<typeof segment> => segment !== null);

  return (
    <div
      className={`${compact ? "mt-1" : "mt-3"} flex flex-wrap gap-1.5 ${justify}`}
      title={projection.notes.join("; ")}
      {...projectionData}
    >
      <span className="inline-flex min-h-6 items-center rounded border border-white/10 bg-white/[0.04] px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-300">
        Proj GS+ {projection.projectedGsPlus.toFixed(1)}
      </span>
      {projectedLine.length ? (
        <span className="inline-flex min-h-6 items-center rounded border border-white/10 bg-white/[0.04] px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
          <MetaLine segments={projectedLine} />
        </span>
      ) : null}
      <span className="inline-flex min-h-6 items-center rounded border border-white/10 bg-white/[0.04] px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
        {projection.confidence} confidence
      </span>
    </div>
  );
}

function projectionDisplayValue(value: number | null | undefined) {
  return value === null || value === undefined ? "pending" : value.toFixed(1);
}

function projectionLineTokenCount(starter: TonightStarter) {
  const projection = starter.projection;
  if (!projection) return 0;
  return [
    projection.line.inningsPitched,
    projection.line.strikeouts,
    projection.line.earnedRuns,
  ].filter((value) => value !== null).length;
}

function seasonNumberValue(value: number | null | undefined, precision: number) {
  return value === null || value === undefined ? "pending" : value.toFixed(precision);
}

function workloadNumberValue(value: number | null | undefined) {
  return value === null || value === undefined ? "pending" : value.toFixed(1);
}

function splitNumberValue(value: number | null | undefined, precision: number) {
  return value === null || value === undefined ? "none" : value.toFixed(precision);
}

function OpponentSplitLine({ starter, compact = false, align }: { starter: TonightStarter; compact?: boolean; align?: "away" | "home" }) {
  const split = starter.opponentSplit;
  if (!split) return null;
  const justify = align === "home" ? "lg:justify-end" : "";
  return (
    <div
      className={`${compact ? "mt-1" : "mt-2"} flex flex-wrap gap-1.5 ${justify}`}
      title={split.label}
      aria-label={`${starter.name ?? "Starter"} opponent split context`}
      data-opponent-split-team={split.team}
      data-opponent-split={split.split}
      data-opponent-split-label={split.label}
      data-opponent-split-ops={split.ops.toFixed(3)}
      data-opponent-split-k-rate={split.strikeoutRate.toFixed(3)}
      data-opponent-split-ops-rank={split.opsRank}
      data-opponent-split-k-rate-rank={split.strikeoutRateRank}
      data-opponent-split-run-value={split.matchupRunValue.toFixed(1)}
    >
      <span className="inline-flex min-h-6 items-center rounded border border-white/10 bg-white/[0.04] px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-300">
        Opp {split.split === "vs-lhp" ? "vs LHP" : "vs RHP"} {split.ops.toFixed(3)} OPS
      </span>
      <span className="inline-flex min-h-6 items-center rounded border border-white/10 bg-white/[0.04] px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400">
        {(split.strikeoutRate * 100).toFixed(1)}% K
      </span>
      <span className="inline-flex min-h-6 items-center rounded border border-white/10 bg-white/[0.04] px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
        OPS rank {ordinal(split.opsRank)}
      </span>
    </div>
  );
}

function MarketContextLine({ starter, compact = false, align }: { starter: TonightStarter; compact?: boolean; align?: "away" | "home" }) {
  const market = starter.marketContext;
  if (!market) return null;
  const justify = align === "home" ? "lg:justify-end" : "";
  const strikeoutText = market.strikeoutPropLine === null
    ? <MetaLine segments={[<span key="projected" className="stat-token">Proj K {market.projectedStrikeouts === null ? "--" : market.projectedStrikeouts.toFixed(1)}</span>, "prop pending"]} />
    : <>K edge {market.strikeoutEdge === null ? "--" : formatSigned(market.strikeoutEdge)}</>;

  return (
    <div
      className={`${compact ? "mt-1" : "mt-2"} flex flex-wrap gap-1.5 ${justify}`}
      title={market.label}
      aria-label={`${starter.name ?? "Starter"} betting and DFS context`}
      data-market-status={market.status}
      data-market-source={market.source}
      data-market-label={market.label}
      data-projected-strikeouts={market.projectedStrikeouts === null ? "pending" : market.projectedStrikeouts.toFixed(1)}
      data-strikeout-prop-line={market.strikeoutPropLine === null ? "pending" : market.strikeoutPropLine.toFixed(1)}
      data-strikeout-edge={market.strikeoutEdge === null ? "pending" : market.strikeoutEdge.toFixed(1)}
      data-opposing-team-total={market.opposingTeamTotal === null ? "pending" : market.opposingTeamTotal.toFixed(1)}
    >
      <span className="inline-flex min-h-6 items-center rounded border border-emerald-300/20 bg-emerald-300/10 px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-200">
        {strikeoutText}
      </span>
      <span className="inline-flex min-h-6 items-center rounded border border-white/10 bg-white/[0.04] px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
        Team total {market.opposingTeamTotal === null ? "pending" : market.opposingTeamTotal.toFixed(1)}
      </span>
    </div>
  );
}

function EraAnchor({ starter }: { starter: TonightStarter }) {
  const era = starter.seasonStats?.era;
  const ip = starter.seasonStats?.inningsPitched ?? 0;
  if (typeof era !== "number") return <span className="text-zinc-500"> · —</span>;
  if (ip < 10) return null;
  return <span className="font-normal text-zinc-500" title="ERA over the selected recent-start form window"> · {era.toFixed(2)} L5 ERA</span>;
}

function formatSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function StarterStatusChips({ starter }: { starter: TonightStarter }) {
  const chips: Array<{ label: string; tone: "warn" | "muted" | "info" }> = [];
  if (starter.flags?.limitedSample) chips.push({ label: "Small sample", tone: "warn" });
  if (starter.flags?.rust) chips.push({ label: "Rust watch", tone: "warn" });
  if (starter.workload?.daysRest !== null && starter.workload?.daysRest !== undefined) {
    const restLabel = `${starter.workload.daysRest}d rest`;
    chips.push({ label: restLabel, tone: starter.workload.restLabel === "short" ? "warn" : starter.workload.restLabel === "extended" ? "info" : "muted" });
  }
  if (typeof starter.workload?.avgPitchesLast5 === "number") {
    chips.push({ label: `${starter.workload.avgPitchesLast5.toFixed(0)} pitch avg`, tone: "muted" });
  }
  if (chips.length === 0) return null;
  const visibleChips = chips.slice(0, 3);

  return (
    <div className="flex max-h-14 flex-wrap gap-1.5 overflow-hidden" aria-label={`${starter.name ?? "Starter"} rest and workload`} data-starter-status-chip-count={visibleChips.length}>
      {visibleChips.map((chip) => (
        <span
          key={chip.label}
          className={`inline-flex min-h-6 items-center rounded border px-2 font-mono text-[10px] uppercase tracking-[0.12em] ${
            chip.tone === "warn"
              ? "border-amber-300/30 bg-amber-300/10 text-amber-200"
              : chip.tone === "info"
                ? "border-sky-300/30 bg-sky-300/10 text-sky-200"
                : "border-white/10 bg-white/[0.04] text-zinc-400"
          }`}
        >
          {chip.label}
        </span>
      ))}
    </div>
  );
}

function starterStatusChipCount(starter: TonightStarter) {
  let chipCount = 0;
  if (starter.flags?.limitedSample) chipCount += 1;
  if (starter.flags?.rust) chipCount += 1;
  if (starter.workload?.daysRest !== null && starter.workload?.daysRest !== undefined) chipCount += 1;
  if (typeof starter.workload?.avgPitchesLast5 === "number") chipCount += 1;
  return Math.min(chipCount, 3);
}

function starterWorkloadData(starter: TonightStarter) {
  return {
    "data-starter-days-rest": starter.workload?.daysRest === null || starter.workload?.daysRest === undefined ? "pending" : String(starter.workload.daysRest),
    "data-starter-rest-label": starter.workload?.restLabel ?? "unknown",
    "data-starter-avg-pitches-last-5": starter.workload?.avgPitchesLast5 === null || starter.workload?.avgPitchesLast5 === undefined ? "pending" : starter.workload.avgPitchesLast5.toFixed(1),
    "data-starter-avg-ip-last-5": starter.workload?.avgIpLast5 === null || starter.workload?.avgIpLast5 === undefined ? "pending" : starter.workload.avgIpLast5.toFixed(1),
    "data-starter-limited-sample": String(starter.flags?.limitedSample === true),
    "data-starter-rust": String(starter.flags?.rust === true),
  };
}

function starterFormData(starter: TonightStarter) {
  return {
    "data-starter-form-tier": starter.tier ?? "none",
    "data-starter-form-trend": starter.trend ?? "none",
    "data-starter-rgs": starter.rgs === null || starter.rgs === undefined ? "pending" : starter.rgs.toFixed(1),
    "data-starter-delta-form": starter.deltaForm === null || starter.deltaForm === undefined ? "pending" : starter.deltaForm.toFixed(1),
    "data-starter-spark-count": starterSparkCountValue(starter),
    "data-starter-spark-ready": starterSparkReadyValue(starter),
    "data-starter-spark-latest": starterSparkLatestValue(starter),
    "data-starter-window-count": starter.windowCount === null || starter.windowCount === undefined ? "pending" : String(starter.windowCount),
  };
}

function starterSeasonData(starter: TonightStarter) {
  return {
    "data-starter-season-ip": starter.seasonStats?.inningsPitched === null || starter.seasonStats?.inningsPitched === undefined ? "pending" : starter.seasonStats.inningsPitched.toFixed(1),
    "data-starter-season-era": starter.seasonStats?.era === null || starter.seasonStats?.era === undefined ? "pending" : starter.seasonStats.era.toFixed(2),
    "data-starter-season-whip": starter.seasonStats?.whip === null || starter.seasonStats?.whip === undefined ? "pending" : starter.seasonStats.whip.toFixed(2),
    "data-starter-season-k9": starter.seasonStats?.k9 === null || starter.seasonStats?.k9 === undefined ? "pending" : starter.seasonStats.k9.toFixed(1),
  };
}

function starterLastStartData(starter: TonightStarter) {
  const lastStart = starter.lastStart;
  return {
    "data-starter-last-start-date": lastStart?.gameDate ?? "none",
    "data-starter-last-start-game-pk": lastStart?.gamePk ?? "none",
    "data-starter-last-start-opponent": lastStart?.opp ?? "none",
    "data-starter-last-start-park": lastStart?.park ?? "none",
    "data-starter-last-start-line": starterLastStartLineValue(starter),
    "data-starter-last-start-gs-plus": lastStart ? lastStart.gsPlus.toFixed(1) : "none",
    "data-starter-last-start-tier": lastStart?.tier ?? "none",
    "data-starter-last-start-href": lastStart?.startHref ?? "none",
  };
}

function starterLastStartLineValue(starter: TonightStarter) {
  const lastStart = starter.lastStart;
  if (!lastStart) return "none";
  return `${lastStart.ip.toFixed(1)}:${lastStart.h}:${lastStart.er}:${lastStart.bb}:${lastStart.k}`;
}

function starterDriverData(starter: TonightStarter) {
  const topDriver = starter.driverChips?.[0];
  const visibleDriverCount = Math.min(starter.driverChips?.length ?? 0, 3);
  return {
    "data-starter-driver-count": String(starter.driverChips?.length ?? 0),
    "data-starter-visible-driver-count": String(visibleDriverCount),
    "data-starter-top-driver-key": topDriver?.key ?? "none",
    "data-starter-top-driver-label": topDriver?.label ?? "none",
    "data-starter-top-driver-direction": topDriver?.direction ?? "none",
    "data-starter-top-driver-delta": topDriver ? topDriver.delta.toFixed(1) : "none",
    "data-starter-top-driver-score": topDriver ? topDriver.score.toFixed(1) : "none",
  };
}

function StarterHeadshot({ starter, size }: { starter: TonightStarter; size: "small" | "large" | "duel" }) {
  const headshotSize = size === "duel" ? "xl" : size === "large" ? "lg" : "sm";
  const thermalBand = starter.status === "ok" ? starter.tier ?? null : null;
  const sampleSufficient = starter.status === "ok" && !starter.flags?.limitedSample;
  const label = starter.name ?? `TBD ${starter.team} starter`;
  const image = (
    <Headshot
      playerId={starter.pitcherId}
      name={label}
      team={starter.team}
      size={headshotSize}
      band={thermalBand}
      sampleSufficient={sampleSufficient}
      decorative
      starterStatus={starter.status}
      className="ml-1"
    />
  );

  if (!starter.pitcherId) return image;

  return (
    <Link href={pitcherFormHref(starter.pitcherId, starter.name)} className="shrink-0" aria-label={`${starter.name ?? "Pitcher"} form`}>
      {image}
    </Link>
  );
}

function pitcherFormHref(pitcherId: string, name?: string | null) {
  return pitcherHref({ pitcherId, name }, sourceParams("upcoming"));
}

function gameStatusLabel(status: TonightGame["status"]) {
  if (status === "live") return "Live";
  if (status === "ppd") return "Postponed";
  return "Pregame";
}

function gameVenueLabel(game: TonightGame) {
  return game.park || "Venue TBD";
}

function weatherChipLabel(game: TonightGame) {
  if (game.weatherContext.source === "indoor") return "Indoor";
  if (game.weatherContext.source === "unavailable") return "Forecast unavailable";
  const parts = [];
  if (typeof game.weatherContext.tempF === "number") parts.push(`${Math.round(game.weatherContext.tempF)}F`);
  if (typeof game.weatherContext.windMph === "number") parts.push(`${Math.round(game.weatherContext.windMph)} mph wind`);
  if (typeof game.weatherContext.precipProbability === "number" && game.weatherContext.precipProbability >= 10) {
    parts.push(`${Math.round(game.weatherContext.precipProbability)}% rain`);
  }
  return parts.length > 0 ? parts.join(" / ") : "Weather neutral";
}

function matchupStatusLabel(game: TonightGame) {
  if (game.matchupContext.status === "pending-opponent-splits") return "Matchup pending";
  return `${ordinal(game.matchupRankTonight)} matchup`;
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

function starterFallbackDataLabel(starter: TonightStarter) {
  return starter.status === "ok" ? "none" : starterFallbackAriaLabel(starter);
}

function starterFallbackAriaLabel(starter: TonightStarter) {
  return starter.status === "tbd" ? "Starter TBD / league baseline used" : "Limited form sample";
}

function watchFlagNoteAriaLabel(game: TonightGame) {
  const notes = [];
  if (game.flags?.tbd) notes.push("TBD starter included with league-mean fallback");
  if (game.flags?.limitedForm) notes.push("Limited form samples use baseline fallback where needed");
  if (game.matchupContext.status === "pending-opponent-splits") notes.push("Opponent split context pending");
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

const FORM_ACCENT_COLORS: Record<FormTier | "neutral", string> = {
  onfire: "#FF5A1F",
  hot: "#FF7A3D",
  even: "#888780",
  cooling: "#8FCBFF",
  ice: "#5BA8FF",
  neutral: "#888780",
};

function starterFormAccent(starter: TonightStarter) {
  const band = starter.status === "ok" && !starter.flags?.limitedSample && starter.tier ? starter.tier : "neutral";
  const color = FORM_ACCENT_COLORS[band];
  return {
    band,
    color,
    rgb: colorToRgb(color),
    source: band === "neutral" ? "neutral" : "form-band",
  };
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
