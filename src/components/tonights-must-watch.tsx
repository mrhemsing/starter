import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { FormDriverChips } from "@/components/form-driver-chips";
import { FormSparkline, TrendChip, tierTextClass } from "@/components/form-visuals";
import { Headshot } from "@/components/headshot";
import { LocalTime } from "@/components/local-time";
import { PitcherAvailabilityNote } from "@/components/pitcher-availability";
import { MetaLine, StartLineText } from "@/components/wrap-safe-text";
import { HEAT_BANDS, MUSTWATCH_CONFIG } from "@/lib/form-tokens";
import { pitcherHref, sourceParams } from "@/lib/routes";
import { slateTimeWordTitle } from "@/lib/time-words";
import type { FormTier, TonightGame, TonightResponse, TonightStarter } from "@/lib/types";
import { watchScoreConfidenceLabel } from "@/lib/watch-score-confidence";

const SITE_TIME_ZONE = process.env.THE_BUMP_TIME_ZONE ?? "America/Los_Angeles";
const WATCH_COMPONENT_KEYS = ["top-arm", "pairing", "matchup"] as const;
const WATCH_COMPONENT_LABELS = ["Top arm", "Pairing", "Matchup"] as const;
const WATCH_SCORE_PRECISION = 1;

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
  const marketAttribution = marketAttributionForGames(shownGames);

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
      data-visible-summary-ids={shownGames.length ? shownGames.map(watchCardSummaryIdValue).join(",") : "none"}
      data-visible-summary-aria-labels={shownGames.length ? shownGames.map(watchCardSummaryAriaLabelValue).join("|") : "none"}
      data-visible-starter-sides={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.side).join("/")).join(",") : "none"}
      data-visible-starter-statuses={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.status).join("/")).join(",") : "none"}
      data-visible-starter-limited-reasons={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.limitedReason ?? "none").join("/")).join(",") : "none"}
      data-visible-starter-form-statuses={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.formStatus).join("/")).join(",") : "none"}
      data-visible-starter-form-completeness={shownGames.length ? shownGames.map((game) => game.starters.map(starterFormCompletenessValue).join("/")).join(",") : "none"}
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
      data-visible-starter-role-contexts={shownGames.length ? shownGames.map((game) => game.starters.map(starterRoleContextDataValue).join("/")).join(",") : "none"}
      data-visible-starter-role-usages={shownGames.length ? shownGames.map((game) => game.starters.map(starterRoleUsageDataValue).join("/")).join(",") : "none"}
      data-visible-starter-accent-sources={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starterFormAccent(starter).source).join("/")).join(",") : "none"}
      data-visible-starter-accent-bands={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starterFormAccent(starter).band).join("/")).join(",") : "none"}
      data-visible-starter-accent-colors={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starterFormAccent(starter).color).join("/")).join(",") : "none"}
      data-visible-starter-market-statuses={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.marketContext?.status ?? "none").join("/")).join(",") : "none"}
      data-visible-starter-market-sources={shownGames.length ? shownGames.map((game) => game.starters.map((starter) => starter.marketContext?.source ?? "none").join("/")).join(",") : "none"}
      data-visible-starter-market-labels={shownGames.length ? shownGames.map((game) => game.starters.map(starterMarketLabelDataValue).join("|")).join(",") : "none"}
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
      data-visible-watch-rank-labels={shownGames.length ? shownGames.map(() => watchRankLabelValue(rankLabel)).join("|") : "none"}
      data-visible-watch-scores={shownGames.length ? shownGames.map(watchScoreValue).join(",") : "none"}
      data-visible-watch-score-labels={shownGames.length ? shownGames.map((game) => watchScoreLabel(game)).join("|") : "none"}
      data-visible-watch-score-confidences={shownGames.length ? shownGames.map((game) => game.watchScoreConfidence).join(",") : "none"}
      data-visible-watch-score-confidence-labels={shownGames.length ? shownGames.map((game) => watchScoreConfidenceLabel(game.watchScoreConfidence) || "none").join("|") : "none"}
      data-visible-watch-score-qualified-counts={shownGames.length ? shownGames.map((game) => `${game.watchScoreQualifiedStartCounts.away}/${game.watchScoreQualifiedStartCounts.home}`).join(",") : "none"}
      data-visible-watch-tiers={shownGames.length ? shownGames.map((game) => game.watchTier).join(",") : "none"}
      data-visible-watch-tier-labels={shownGames.length ? shownGames.map(watchTierLabel).join("|") : "none"}
      data-visible-matchup-confidences={shownGames.length ? shownGames.map((game) => game.matchupConfidence).join(",") : "none"}
      data-visible-watch-sort-groups={shownGames.length ? shownGames.map(watchSortGroupValue).join(",") : "none"}
      data-visible-watch-sort-group-labels={shownGames.length ? shownGames.map(watchSortGroupLabelValue).join("|") : "none"}
      data-visible-watch-flag-keys={shownGames.length ? shownGames.map(watchFlagNoteKeysValue).join(",") : "none"}
      data-visible-watch-flag-labels={shownGames.length ? shownGames.map(watchFlagNoteLabelValue).join("|") : "none"}
      data-visible-component-counts={shownGames.length ? shownGames.map(watchComponentCountValue).join(",") : "none"}
      data-visible-component-keys={shownGames.length ? shownGames.map(watchComponentKeysValue).join(",") : "none"}
      data-visible-component-layouts={shownGames.length ? shownGames.map((_, index) => watchComponentSectionLayout(index)).join(",") : "none"}
      data-visible-component-labels={shownGames.length ? shownGames.map(watchComponentLabelsValue).join("|") : "none"}
      data-visible-component-values={shownGames.length ? shownGames.map(watchComponentValuesValue).join(",") : "none"}
      data-visible-component-top-arms={shownGames.length ? shownGames.map((game) => game.watchComponents.topArm.toFixed(1)).join(",") : "none"}
      data-visible-component-pairings={shownGames.length ? shownGames.map((game) => game.watchComponents.pairing.toFixed(1)).join(",") : "none"}
      data-visible-component-matchups={shownGames.length ? shownGames.map((game) => game.matchupScore.toFixed(1)).join(",") : "none"}
      data-visible-component-details={shownGames.length ? shownGames.map((game) => watchComponentDetailsValue(game, rankLabel)).join(",") : "none"}
      data-visible-component-item-aria-labels={shownGames.length ? shownGames.map((game) => watchComponentItemAriaLabelsValue(game, rankLabel)).join("|") : "none"}
      data-visible-component-aria-labels={shownGames.length ? shownGames.map(watchComponentsAriaLabelValue).join("|") : "none"}
      data-visible-matchup-ranks={shownGames.length ? shownGames.map((game) => game.matchupRankTonight).join(",") : "none"}
      data-visible-matchup-context-statuses={shownGames.length ? shownGames.map((game) => game.matchupContext.status).join(",") : "none"}
      data-visible-matchup-context-labels={shownGames.length ? shownGames.map((game) => game.matchupContext.label).join(",") : "none"}
      data-visible-matchup-status-labels={shownGames.length ? shownGames.map((game) => matchupStatusLabel(game)).join(",") : "none"}
      data-visible-hook-reason-keys={shownGames.length ? shownGames.map((game) => watchHookReasonKeyValue(game, rankLabel)).join(",") : "none"}
      data-visible-hook-reasons={shownGames.length ? shownGames.map((game) => watchHookReasonValue(game, rankLabel)).join("|") : "none"}
      data-scheduled-games={tonight.scheduledGames}
      data-rank-label={rankLabel}
      data-active-card-statuses={tonight.activeCardStatuses.join(",")}
      data-form-window={tonight.formWindow}
      data-form-through-date={tonight.formThroughDate ?? "none"}
      data-latest-scored-start-date={tonight.latestScoredStartDate ?? "none"}
      data-form-data-stale={String(tonight.formDataStale)}
      data-league-mean-gs={leagueMeanGsValue(tonight.leagueMeanGS)}
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
        {marketAttribution ? <MarketAttributionLine attribution={marketAttribution} /> : null}
      </div>
    </section>
  );
}

function MustWatchHeadliner({ game, leagueMeanGS, rankLabel }: { game: TonightGame; leagueMeanGS: number; slateSize: number; rankLabel: string }) {
  const tier = watchTierForGame(game);
  const summaryId = watchCardSummaryIdValue(game);
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
      data-cold-start-form={String(game.flags?.coldStartForm === true)}
      data-join-gap-form={String(game.flags?.joinGapForm === true)}
      data-mlb-debut={String(game.flags?.mlbDebut === true)}
      data-likely-opener={String(game.flags?.likelyOpener === true)}
      data-matchup-confidence={game.matchupConfidence}
      data-matchup-context-status={game.matchupContext.status}
      data-matchup-context-label={game.matchupContext.label}
      data-matchup-status-label={matchupStatusLabel(game)}
      data-matchup-score={game.matchupScore.toFixed(1)}
      data-matchup-rank={game.matchupRankTonight}
      data-watch-card-kind="headliner"
      data-watch-rank={watchCardRankValue(game, 0)}
      data-watch-rank-label={watchRankLabelValue(rankLabel)}
      data-watch-sort-group={watchSortGroupValue(game)}
      data-watch-sort-group-label={watchSortGroupLabelValue(game)}
      data-watch-score={watchScoreValue(game)}
      data-watch-score-label={watchScoreLabel(game)}
      data-watch-score-confidence={game.watchScoreConfidence}
      data-watch-score-confidence-label={watchScoreConfidenceLabel(game.watchScoreConfidence) || "none"}
      data-watch-score-qualified-starts={`${game.watchScoreQualifiedStartCounts.away}/${game.watchScoreQualifiedStartCounts.home}`}
      data-watch-score-tier={game.watchTier}
      data-watch-tier={watchTierLabel(game)}
      data-watch-flag-keys={watchFlagNoteKeysValue(game)}
      data-watch-flag-label={watchFlagNoteLabelValue(game)}
      data-watch-summary-id={summaryId}
      data-watch-summary-aria-label={watchCardSummaryAriaLabelValue(game)}
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
              aria-label={watchCardSummaryAriaLabelValue(game)}
            >
              <MetaLine segments={[gameStatusLabel(game.status), <LocalTime key="first-pitch" value={game.firstPitch} fallback={formatFirstPitch(game.firstPitch)} />, gameVenueLabel(game)]} />
            </p>
            <GameEnvironmentChips game={game} />
          </div>
          <div className="rounded border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-left md:text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-amber-200">Top watch score</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 md:justify-end">
              <p className="font-serif text-3xl font-black text-amber-100">#1 {rankLabel}</p>
              <WatchScoreConfidenceChip game={game} compact />
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(230px,0.78fr)_minmax(0,1fr)] lg:items-stretch">
          <DuelStarterPanel starter={awayStarter} leagueMeanGS={leagueMeanGS} align="away" />
          <MatchupSpine game={game} leagueMeanGS={leagueMeanGS} rankLabel={rankLabel} />
          <DuelStarterPanel starter={homeStarter} leagueMeanGS={leagueMeanGS} align="home" />
        </div>

        <WatchComponentReadout game={game} rankLabel={rankLabel} featured />
        <WatchFlagNote game={game} />
        <MoreDataLine game={game} />
      </div>
    </article>
  );
}

function watchCardRankValue(game: TonightGame, index: number) {
  return game.status === "ppd" && index === 0 ? "-" : String(index + 1);
}

function watchRankLabelValue(rankLabel: string) {
  return rankLabel;
}

function watchCardKind(index: number) {
  return index === 0 ? "headliner" : "row";
}

export function UpcomingWatchCardSkeleton({ index = 0, headliner = false }: { index?: number; headliner?: boolean }) {
  if (headliner) {
    return (
      <article className="heat-glow-card relative overflow-hidden rounded border border-amber-300/25 bg-[#101014] p-5 lg:p-6" data-responsive-check="must-watch-headliner" data-skeleton-row="upcoming-headliner">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgb(255_122_61/0.12),transparent_32%),radial-gradient(circle_at_82%_12%,rgb(91_168_255/0.12),transparent_30%)]" />
        <div className="relative">
          <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-5 md:flex-row md:items-start">
            <div>
              <span className="route-shell-shimmer block h-4 w-28 rounded" />
              <span className="route-shell-shimmer mt-3 block h-10 w-64 max-w-full rounded" />
              <span className="route-shell-shimmer mt-3 block h-3 w-80 max-w-full rounded" />
            </div>
            <div className="rounded border border-amber-300/30 bg-amber-300/10 px-3 py-2">
              <span className="route-shell-shimmer block h-3 w-24 rounded" />
              <span className="route-shell-shimmer mt-2 block h-8 w-28 rounded" />
            </div>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(230px,0.78fr)_minmax(0,1fr)] lg:items-stretch">
            <UpcomingStarterPanelSkeleton />
            <span className="route-shell-shimmer min-h-32 rounded border border-white/10" />
            <UpcomingStarterPanelSkeleton align="home" />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="heat-glow-card relative overflow-hidden rounded border border-white/10 bg-[#101014] p-4" data-responsive-check="must-watch-row" data-skeleton-row="upcoming-row">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgb(255_122_61/0.08),transparent_35%,transparent_65%,rgb(91_168_255/0.08))]" />
      <div className="relative grid gap-4 lg:grid-cols-[86px_minmax(0,1fr)] lg:items-start">
        <div>
          <span className="route-shell-shimmer block h-9 w-12 rounded" />
          <span className="route-shell-shimmer mt-2 block h-3 w-16 rounded" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
            <div>
              <span className={`route-shell-shimmer block h-6 rounded ${index % 2 === 0 ? "w-48" : "w-40"}`} />
              <span className="route-shell-shimmer mt-2 block h-3 w-72 max-w-full rounded" />
            </div>
            <span className="route-shell-shimmer h-12 w-20 rounded" />
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <UpcomingStarterPanelSkeleton />
            <UpcomingStarterPanelSkeleton align="home" />
          </div>
        </div>
      </div>
    </article>
  );
}

function UpcomingStarterPanelSkeleton({ align = "away" }: { align?: "away" | "home" }) {
  return (
    <div className={`grid min-w-0 grid-cols-[52px_minmax(0,1fr)] gap-3 rounded border border-white/10 bg-black/20 p-3 ${align === "home" ? "lg:grid-cols-[minmax(0,1fr)_52px]" : ""}`}>
      {align === "away" ? <span className="route-shell-shimmer h-[65px] w-[52px] rounded" /> : null}
      <div className={`min-w-0 ${align === "home" ? "lg:text-right" : ""}`}>
        <span className={`route-shell-shimmer block h-6 rounded ${align === "home" ? "lg:ml-auto" : ""} w-2/3`} />
        <span className={`route-shell-shimmer mt-2 block h-3 rounded ${align === "home" ? "lg:ml-auto" : ""} w-5/6`} />
        <div className={`mt-3 flex flex-wrap gap-1.5 ${align === "home" ? "lg:justify-end" : ""}`}>
          <span className="route-shell-shimmer h-6 w-16 rounded" />
          <span className="route-shell-shimmer h-6 w-20 rounded" />
        </div>
      </div>
      {align === "home" ? <span className="route-shell-shimmer h-[65px] w-[52px] rounded" /> : null}
    </div>
  );
}

function watchScoreValue(game: TonightGame) {
  return game.gameWatchScore.toFixed(WATCH_SCORE_PRECISION);
}

function watchScoreLabel(game: TonightGame) {
  return `Watch score ${watchScoreValue(game)}`;
}

function WatchScoreConfidenceChip({ game, compact = false }: { game: TonightGame; compact?: boolean }) {
  const label = watchScoreConfidenceLabel(game.watchScoreConfidence);
  if (!label) return null;

  return (
    <span
      className={`inline-flex items-center rounded border border-amber-300/30 bg-amber-300/10 font-mono uppercase tracking-[0.12em] text-amber-100 ${compact ? "px-1.5 py-0.5 text-[8px]" : "px-2 py-1 text-[10px]"}`}
      data-watch-score-confidence-chip={game.watchScoreConfidence}
      data-watch-score-confidence-chip-label={label}
    >
      {label}
    </span>
  );
}

function leagueMeanGsValue(value: number) {
  return value.toFixed(WATCH_SCORE_PRECISION);
}

function watchTierForGame(game: TonightGame) {
  return MUSTWATCH_CONFIG.watchTiers.find((tier) => tier.key === game.watchTier) ?? MUSTWATCH_CONFIG.watchTiers[MUSTWATCH_CONFIG.watchTiers.length - 1];
}

function watchTierLabel(game: TonightGame) {
  return watchTierForGame(game).label;
}

function watchSortGroupValue(game: TonightGame) {
  return String(game.watchSortGroup);
}

function watchSortGroupLabel(game: TonightGame) {
  if (game.status === "pregame") return "Pregame sort bucket";
  if (game.status === "live") return "Live sort bucket";
  return "Fallback sort bucket";
}

function watchSortGroupLabelValue(game: TonightGame) {
  return watchSortGroupLabel(game);
}

function MustWatchRow({ game, rank, slateSize, leagueMeanGS, rankLabel }: { game: TonightGame; rank: number; slateSize: number; leagueMeanGS: number; rankLabel: string }) {
  const tier = watchTierForGame(game);
  const summaryId = watchCardSummaryIdValue(game);
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
      data-cold-start-form={String(game.flags?.coldStartForm === true)}
      data-join-gap-form={String(game.flags?.joinGapForm === true)}
      data-mlb-debut={String(game.flags?.mlbDebut === true)}
      data-likely-opener={String(game.flags?.likelyOpener === true)}
      data-matchup-confidence={game.matchupConfidence}
      data-matchup-context-status={game.matchupContext.status}
      data-matchup-context-label={game.matchupContext.label}
      data-matchup-status-label={matchupStatusLabel(game)}
      data-matchup-score={game.matchupScore.toFixed(1)}
      data-matchup-rank={game.matchupRankTonight}
      data-watch-card-kind="row"
      data-watch-rank={watchCardRankValue(game, rank - 1)}
      data-watch-rank-label={watchRankLabelValue(rankLabel)}
      data-watch-sort-group={watchSortGroupValue(game)}
      data-watch-sort-group-label={watchSortGroupLabelValue(game)}
      data-watch-score={watchScoreValue(game)}
      data-watch-score-label={watchScoreLabel(game)}
      data-watch-score-confidence={game.watchScoreConfidence}
      data-watch-score-confidence-label={watchScoreConfidenceLabel(game.watchScoreConfidence) || "none"}
      data-watch-score-qualified-starts={`${game.watchScoreQualifiedStartCounts.away}/${game.watchScoreQualifiedStartCounts.home}`}
      data-watch-score-tier={game.watchTier}
      data-watch-tier={watchTierLabel(game)}
      data-watch-flag-keys={watchFlagNoteKeysValue(game)}
      data-watch-flag-label={watchFlagNoteLabelValue(game)}
      data-watch-summary-id={summaryId}
      data-watch-summary-aria-label={watchCardSummaryAriaLabelValue(game)}
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
          <div className="mt-2">
            <WatchScoreConfidenceChip game={game} compact />
          </div>
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
                aria-label={watchCardSummaryAriaLabelValue(game)}
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
          <MoreDataLine game={game} compact />
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
      data-watch-component-count={watchComponentCountValue()}
      data-watch-component-keys={watchComponentKeysValue()}
      data-watch-component-layout={layout}
      data-watch-component-labels={watchComponentLabelsValue()}
      data-watch-component-values={watchComponentValuesValue(game)}
      data-watch-component-details={watchComponentDetailsValue(game, rankLabel)}
      data-watch-component-item-aria-labels={watchComponentItemAriaLabelsValue(game, rankLabel)}
      data-watch-component-aria-label={watchComponentsAriaLabelValue(game)}
      data-matchup-rank={game.matchupRankTonight}
      data-matchup-rank-label={rankLabel}
      role="group"
      aria-label={watchComponentsAriaLabelValue(game)}
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

function watchComponentSectionLayout(index: number) {
  return watchComponentLayout(index === 0 ? "featured" : "compact");
}

function watchComponentCountValue() {
  return String(WATCH_COMPONENT_KEYS.length);
}

function watchComponentKeysValue() {
  return WATCH_COMPONENT_KEYS.join("/");
}

function watchComponentLabelsValue() {
  return WATCH_COMPONENT_LABELS.join("/");
}

function watchComponentValuesValue(game: TonightGame) {
  return [game.watchComponents.topArm, game.watchComponents.pairing, game.matchupScore].map((value) => value.toFixed(WATCH_SCORE_PRECISION)).join("/");
}

function watchComponentDetails(game: TonightGame, rankLabel: string) {
  return [
    "none",
    "none",
    game.matchupContext.status === "pending-opponent-splits" ? "pending" : `${ordinal(game.matchupRankTonight)} ${rankLabel}`,
  ];
}

function watchComponentDetailsValue(game: TonightGame, rankLabel: string) {
  return watchComponentDetails(game, rankLabel).join("/");
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

function watchComponentItemAriaLabelsValue(game: TonightGame, rankLabel: string) {
  return watchComponentItemAriaLabels(game, rankLabel).join("/");
}

function MatchupSpine({ game, leagueMeanGS, rankLabel }: { game: TonightGame; leagueMeanGS: number; rankLabel: string }) {
  const [awayStarter, homeStarter] = game.starters;
  const reason = watchHookReasonValue(game, rankLabel);
  const reasonKey = watchHookReasonKeyValue(game, rankLabel);

  return (
    <div
      className="flex min-h-full flex-col justify-between rounded border border-amber-300/25 bg-black/35 p-4 text-center shadow-[inset_0_0_42px_rgba(251,191,36,0.08)]"
      data-responsive-check="watch-hook"
      data-hook-score={watchScoreValue(game)}
      data-hook-score-label="score"
      data-hook-score-confidence={game.watchScoreConfidence}
      data-hook-score-confidence-label={watchScoreConfidenceLabel(game.watchScoreConfidence) || "none"}
      data-hook-reason-key={reasonKey}
      data-hook-reason={reason}
    >
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-200">The hook</p>
        <div className="mt-1 flex flex-wrap items-end justify-center gap-2">
          <p className="font-serif text-5xl font-black leading-none text-amber-100">{watchScoreValue(game)}</p>
          <WatchScoreConfidenceChip game={game} />
        </div>
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

function watchHookReasonValue(game: TonightGame, rankLabel: string) {
  return watchHookReason(game, rankLabel);
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

function watchHookReasonKeyValue(game: TonightGame, rankLabel: string) {
  return watchHookReasonKey(game, rankLabel);
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
      data-starter-form-status={starter.formStatus}
      data-starter-limited-reason={starter.limitedReason ?? "none"}
      data-starter-form-completeness={starterFormCompletenessValue(starter)}
      data-starter-probable-source={starter.probableSource}
      data-starter-probable-confidence={starter.probableConfidence}
      data-starter-likely-opener={String(starter.likelyOpener === true)}
      data-starter-role-context={starterRoleContextDataValue(starter)}
      data-starter-role-usage={starterRoleUsageDataValue(starter)}
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
          <ProbableConfidenceChip starter={starter} align={align} />
          <LikelyOpenerBadge starter={starter} align={align} />
          <StarterRoleContextLine starter={starter} align={align} />
          {starter.formStatus === "ok" && starter.rgs !== undefined && starter.tier ? (
            <div className={`mt-3 flex flex-wrap items-center gap-2 ${align === "home" ? "lg:justify-end" : ""}`}>
              <div className={`flex flex-col gap-1 ${align === "home" ? "lg:items-end" : "items-start"}`}>
                <StarterFormScoreLine starter={starter} accentColor={accent.color} />
                {starter.trend && starter.deltaForm !== undefined ? <TrendChip summary={{ trend: starter.trend, deltaForm: starter.deltaForm }} compact /> : null}
              </div>
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
    return <span className="hidden" aria-hidden="true" {...clashData} />;
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
  return starter.formStatus === "ok" && Boolean(starter.spark?.length && starter.tier);
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
  if (!game.flags?.tbd && !game.flags?.limitedForm && !game.flags?.mlbDebut && !game.flags?.likelyOpener) return null;
  const flagKeys = watchFlagNoteKeys(game);

  return (
    <p
      className={`${compact ? "mt-2" : "mt-4"} font-mono text-xs text-zinc-500`}
      aria-label={watchFlagNoteAriaLabel(game)}
      data-watch-flag-count={flagKeys.length}
      data-watch-flag-keys={flagKeys.join(",")}
      data-watch-flag-label={watchFlagNoteDataLabel(game)}
    >
      {watchFlagNoteText(game)}
    </p>
  );
}

function watchFlagNoteKeys(game: TonightGame) {
  const keys: string[] = [];
  if (game.flags?.tbd) keys.push("tbd");
  if (game.flags?.coldStartForm) keys.push("cold-start");
  if (game.flags?.mlbDebut) keys.push("mlb-debut");
  if (game.flags?.joinGapForm) keys.push("join-gap");
  if (game.flags?.likelyOpener) keys.push("likely-opener");
  return keys;
}

function watchFlagNoteKeysValue(game: TonightGame) {
  return watchFlagNoteKeys(game).join("+") || "clear";
}

function watchFlagNoteLabelValue(game: TonightGame) {
  return watchFlagNoteDataLabel(game);
}

function watchFlagNoteDataLabel(game: TonightGame) {
  return watchFlagNoteAriaLabel(game) || "clear";
}

function MoreDataLine({ game, compact = false }: { game: TonightGame; compact?: boolean }) {
  const keys = unresolvedOptionalInputKeys(game);
  if (keys.length === 0) return null;

  return (
    <p
      className={`${compact ? "mt-2" : "mt-4"} font-mono text-xs text-zinc-500`}
      data-watch-more-data="true"
      data-watch-more-data-keys={keys.join(",")}
    >
      More data closer to first pitch.
    </p>
  );
}

function unresolvedOptionalInputKeys(game: TonightGame) {
  if (game.flags?.tbd) return [];

  const keys: string[] = [];
  if (game.matchupContext.status === "pending-opponent-splits") keys.push("opponent-splits");
  if (!hasStarterSparkForm(game.starters[0]) || !hasStarterSparkForm(game.starters[1])) keys.push("form-clash");

  for (const starter of game.starters) {
    if (starter.projection?.status === "pending") keys.push(`${starter.side}-projection`);
    if (starter.marketContext?.status === "pending-feed") keys.push(`${starter.side}-market`);
    if (starter.marketContext && starter.marketContext.strikeoutPropLine === null) keys.push(`${starter.side}-prop`);
    if (starter.marketContext && starter.marketContext.opposingTeamTotal === null) keys.push(`${starter.side}-team-total`);
  }

  return [...new Set(keys)];
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
      data-starter-form-status={starter.formStatus}
      data-starter-limited-reason={starter.limitedReason ?? "none"}
      data-starter-form-completeness={starterFormCompletenessValue(starter)}
      data-starter-probable-source={starter.probableSource}
      data-starter-probable-confidence={starter.probableConfidence}
      data-starter-likely-opener={String(starter.likelyOpener === true)}
      data-starter-role-context={starterRoleContextDataValue(starter)}
      data-starter-role-usage={starterRoleUsageDataValue(starter)}
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
        <ProbableConfidenceChip starter={starter} compact />
        <LikelyOpenerBadge starter={starter} compact />
        <StarterRoleContextLine starter={starter} compact />
        <p className="mt-0.5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: teamAccentColor(starter.team) }} aria-hidden="true" />
          {starter.team}
        </p>
        {starter.formStatus === "cold_start" && starter.lastStart ? (
          <p className="mt-1 text-[11px] text-zinc-500">
            <MetaLine segments={[`Last: vs ${starter.lastStart.opp}`, `GS+ ${starter.lastStart.gsPlus}`]} />
          </p>
        ) : starter.formStatus === "mlb_debut" ? (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-200">MLB DEBUT</p>
        ) : starter.formStatus === "join_gap" ? (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">Form pending</p>
        ) : null}
      </div>
      <div className="ml-auto text-right">
        {starter.formStatus === "ok" && starter.rgs !== undefined && starter.tier ? (
          <>
            <StarterFormScoreLine starter={starter} accentColor={accent.color} />
            {starter.trend && starter.deltaForm !== undefined ? <TrendChip summary={{ trend: starter.trend, deltaForm: starter.deltaForm }} compact /> : null}
          </>
        ) : (
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500" aria-label={starterFallbackAriaLabel(starter)}>
            {starter.status === "tbd" ? "TBD" : starter.formStatus === "mlb_debut" ? "MLB debut" : starter.formStatus === "join_gap" ? "Form pending" : "Limited"}
          </p>
        )}
      </div>
      {starter.formStatus === "ok" ? (
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
      <div className="mt-3 text-sm text-zinc-400" aria-label={starterFallbackAriaLabel(starter)}>
        <p className="inline-flex items-center rounded border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-300">PROVISIONAL</p>
        <p className="mt-1 text-xs leading-5 text-zinc-500">Starter unconfirmed. Score uses league baseline.</p>
      </div>
    );
  }

  if (starter.formStatus === "mlb_debut") {
    return (
      <div className="mt-3 text-sm text-zinc-400">
        <p className="inline-flex items-center rounded border border-amber-300/40 bg-amber-300/15 px-2 py-1 font-mono text-xs uppercase tracking-[0.14em] text-amber-100" aria-label={starterFallbackAriaLabel(starter)}>MLB DEBUT</p>
        <p className="mt-1 text-xs leading-5 text-zinc-500">First major-league start carries the watch story.</p>
      </div>
    );
  }

  if (starter.formStatus === "join_gap") {
    return (
      <div className="mt-3 text-sm text-zinc-400">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-400" aria-label={starterFallbackAriaLabel(starter)}>Form pending</p>
        <p className="mt-1 text-xs leading-5 text-zinc-500">Schedule context is live while pitcher form joins.</p>
      </div>
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
              "BASELINE",
            ]}
          />
        </p>
      ) : null}
    </div>
  );
}

function ProbableConfidenceChip({ starter, align, compact = false }: { starter: TonightStarter; align?: "away" | "home"; compact?: boolean }) {
  if (starter.probableConfidence !== "REPORTED") return null;

  return (
    <p className={`mt-1 inline-flex items-center rounded border border-amber-300/30 bg-amber-300/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-amber-200 ${align === "home" ? "lg:ml-auto" : ""} ${compact ? "text-[8px]" : ""}`}>
      UNCONFIRMED
    </p>
  );
}

function LikelyOpenerBadge({ starter, align, compact = false }: { starter: TonightStarter; align?: "away" | "home"; compact?: boolean }) {
  if (starter.likelyOpener !== true) return null;

  return (
    <p className={`mt-1 inline-flex items-center rounded border border-sky-300/30 bg-sky-300/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-sky-200 ${align === "home" ? "lg:ml-auto" : ""} ${compact ? "text-[8px]" : ""}`}>
      Likely opener / bullpen game
    </p>
  );
}

function StarterRoleContextLine({ starter, align, compact = false }: { starter: TonightStarter; align?: "away" | "home"; compact?: boolean }) {
  const role = starter.roleContext;
  if (!role) return null;

  return (
    <div
      className={`mt-1 flex flex-wrap gap-1.5 ${align === "home" ? "lg:justify-end" : ""}`}
      data-starter-role-context-line={role.label}
      data-starter-role-usage-line={starterRoleUsageDataValue(starter)}
    >
      <span className={`inline-flex items-center rounded border border-sky-300/30 bg-sky-300/10 px-1.5 py-0.5 font-mono uppercase tracking-[0.12em] text-sky-200 ${compact ? "text-[8px]" : "text-[9px]"}`}>
        {role.label}
      </span>
      <span className={`inline-flex items-center rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono uppercase tracking-[0.12em] text-zinc-400 ${compact ? "text-[8px]" : "text-[9px]"}`}>
        {starterRoleUsageLine(starter)}
      </span>
    </div>
  );
}

function StarterProjectionLine({ starter, compact = false, align }: { starter: TonightStarter; compact?: boolean; align?: "away" | "home" }) {
  const projection = starter.projection;
  if (!projection) return null;
  const justify = align === "home" ? "lg:justify-end" : "";
  const baselineProjection = starter.formStatus === "cold_start";
  const projectionData = {
    "data-projection-status": projection.status,
    "data-projection-confidence": projection.confidence,
    "data-projection-baseline": String(baselineProjection),
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
    return <span className="hidden" aria-hidden="true" {...projectionData} />;
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
      {baselineProjection ? (
        <span className="inline-flex min-h-6 items-center rounded border border-amber-300/25 bg-amber-300/10 px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-200">
          BASELINE
        </span>
      ) : null}
      {starter.formStatus === "mlb_debut" ? (
        <span className="inline-flex min-h-6 items-center rounded border border-amber-300/40 bg-amber-300/15 px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-100">
          MLB DEBUT
        </span>
      ) : null}
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

function starterMarketLabelDataValue(starter: TonightStarter) {
  return (starter.marketContext?.label ?? "none").replaceAll(",", ";");
}

function starterRoleContextDataValue(starter: TonightStarter) {
  return starter.roleContext?.label ?? "none";
}

function starterRoleUsageLine(starter: TonightStarter) {
  const role = starter.roleContext;
  if (!role) return "none";
  return `2026: ${role.seasonStarts} GS / ${role.seasonReliefAppearances} RP`;
}

function starterRoleUsageDataValue(starter: TonightStarter) {
  return starterRoleUsageLine(starter);
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
  const strikeoutPropLine = market.strikeoutPropLine;
  const opposingTeamTotal = market.opposingTeamTotal;
  const edgeTone = market.strikeoutEdge === null ? "text-zinc-400" : market.strikeoutEdge >= 0 ? "text-emerald-300" : "text-rose-300";

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
      data-market-captured-at={market.capturedAt ?? "pending"}
    >
      {strikeoutPropLine !== null ? (
        <span className="inline-flex min-h-6 flex-wrap items-center gap-x-1.5 rounded border border-white/10 bg-white/[0.04] px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-300">
          <span>K line {strikeoutPropLine.toFixed(1)}</span>
          {market.projectedStrikeouts !== null ? <span className="text-zinc-500">Proj {market.projectedStrikeouts.toFixed(1)}</span> : null}
          {market.strikeoutEdge !== null ? <span className={edgeTone}>Edge {formatSigned(market.strikeoutEdge)}</span> : null}
        </span>
      ) : (
        <span className="inline-flex min-h-6 items-center rounded border border-white/10 bg-white/[0.04] px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
          K line pending
        </span>
      )}
      {opposingTeamTotal !== null ? (
        <span className="inline-flex min-h-6 items-center rounded border border-white/10 bg-white/[0.04] px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
          Team total {opposingTeamTotal.toFixed(1)}
        </span>
      ) : null}
    </div>
  );
}

type MarketAttributionSource = "the-odds-api" | "prop-line" | "odds-deferred";

function MarketAttributionLine({ attribution }: { attribution: { capturedAt: string | null; source: MarketAttributionSource } }) {
  const label = attribution.source === "prop-line" ? "PropLine" : "The Odds API";
  return (
    <p className="mt-4 px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600" data-market-attribution={attribution.source}>
      Lines {label}{attribution.capturedAt ? ` · captured ${formatMarketCapturedAt(attribution.capturedAt)}` : ""} · 21+ only. For help call 1-800-GAMBLER
    </p>
  );
}

function marketAttributionForGames(games: TonightGame[]) {
  const markets = games.flatMap((game) => game.starters.map((starter) => starter.marketContext).filter((market): market is NonNullable<TonightStarter["marketContext"]> => Boolean(market)));
  if (markets.length === 0) return null;
  if (!markets.some((market) => market.source === "the-odds-api" || market.source === "prop-line" || market.source === "odds-deferred")) return null;
  const source: MarketAttributionSource = markets.some((market) => market.source === "prop-line")
    ? "prop-line"
    : markets.some((market) => market.source === "the-odds-api")
      ? "the-odds-api"
      : "odds-deferred";
  const capturedAt = markets
    .map((market) => market.capturedAt)
    .filter((value): value is string => typeof value === "string")
    .sort()
    .at(-1) ?? null;
  return { capturedAt, source };
}

function formatMarketCapturedAt(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: SITE_TIME_ZONE,
    timeZoneName: "short",
  }).format(parsed);
}

function EraAnchor({ starter }: { starter: TonightStarter }) {
  const era = starter.seasonStats?.era;
  const ip = starter.seasonStats?.inningsPitched ?? 0;
  if (typeof era !== "number") return <span className="text-zinc-500"> · —</span>;
  if (ip < 10) return null;
  return <span className="font-normal text-zinc-500" title="ERA over the selected recent-start form window"> · {era.toFixed(2)} L5 ERA</span>;
}

function StarterFormScoreLine({ starter, accentColor }: { starter: TonightStarter; accentColor: string }) {
  return (
    <p
      className={`font-mono text-[11px] leading-none ${starter.tier ? tierTextClass(starter.tier) : "text-zinc-400"}`}
      style={{ color: accentColor }}
      data-starter-form-context-line="rgs-era"
    >
      {starter.rgs?.toFixed(1)}
      <EraAnchor starter={starter} />
    </p>
  );
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
  const thermalBand = starter.formStatus === "ok" ? starter.tier ?? null : null;
  const sampleSufficient = starter.formStatus === "ok" && !starter.flags?.limitedSample;
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

function watchCardSummaryIdValue(game: TonightGame) {
  return watchCardSummaryId(game);
}

function watchCardSummaryAriaLabel(game: TonightGame) {
  return `${gameStatusLabel(game.status)} ${game.label}, ${formatFirstPitch(game.firstPitch)}, ${gameVenueLabel(game)}`;
}

function watchCardSummaryAriaLabelValue(game: TonightGame) {
  return watchCardSummaryAriaLabel(game);
}

function watchComponentsAriaLabel(game: TonightGame) {
  return `Watch components for ${game.label} on ${formatSlateDate(game.date)}`;
}

function watchComponentsAriaLabelValue(game: TonightGame) {
  return watchComponentsAriaLabel(game);
}

function starterBlockAriaLabel(starter: TonightStarter) {
  const side = starter.side === "away" ? "Away" : "Home";
  return `${side} starter: ${starter.name ?? "TBD"} (${starter.team})`;
}

function starterFallbackDataLabel(starter: TonightStarter) {
  return starter.formStatus === "ok" ? "none" : starterFallbackAriaLabel(starter);
}

function starterFormCompletenessValue(starter: TonightStarter) {
  const completeness = starter.formCompleteness;
  if (!completeness) return "none";
  const career = completeness.careerGS === null ? "unknown" : String(completeness.careerGS);
  return `${completeness.matched}/${completeness.expected}/${career}`;
}

function starterFallbackAriaLabel(starter: TonightStarter) {
  if (starter.status === "tbd") return "Starter unconfirmed. Score uses league baseline.";
  if (starter.formStatus === "mlb_debut") return "MLB debut";
  if (starter.formStatus === "join_gap") return "Form pending";
  return "Limited form sample / baseline projection";
}

function watchFlagNoteAriaLabel(game: TonightGame) {
  const notes = [];
  if (game.flags?.tbd) notes.push("Starter unconfirmed. Score uses league baseline");
  if (game.flags?.likelyOpener) notes.push("Likely opener or bullpen game");
  if (game.flags?.coldStartForm) notes.push("Cold-start pitchers use baseline fallback where needed");
  if (game.flags?.mlbDebut) notes.push("MLB debut novelty can qualify the game as must-watch");
  if (game.flags?.joinGapForm) notes.push("Form pending for a scheduled pitcher");
  return notes.join("; ");
}

function watchFlagNoteText(game: TonightGame) {
  const notes = [];
  if (game.flags?.tbd) notes.push("Starter unconfirmed. Score uses league baseline.");
  if (game.flags?.likelyOpener) notes.push("Likely opener or bullpen game.");
  if (game.flags?.coldStartForm) notes.push("Cold-start pitchers use baseline fallback where needed.");
  if (game.flags?.mlbDebut) notes.push("MLB debut novelty can qualify this game as must-watch.");
  if (game.flags?.joinGapForm) notes.push("Form pending for a scheduled pitcher.");
  return notes.join(" ");
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
  if (starter.formStatus === "mlb_debut") {
    return {
      band: "neutral" as const,
      color: "#EF9F27",
      rgb: colorToRgb("#EF9F27"),
      source: "mlb-debut",
    };
  }
  const band = starter.formStatus === "ok" && !starter.flags?.limitedSample && starter.tier ? starter.tier : "neutral";
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
