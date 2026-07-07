import type { TonightGame, TonightStarter } from "@/lib/types";

export function upcomingSimpleContextSentence(game: TonightGame, rank: number, leagueMeanGS: number) {
  const [awayStarter, homeStarter] = game.starters;
  const namedStarters = game.starters.filter(hasNamedStarter);

  if (namedStarters.length < 2) {
    const named = namedStarters[0];
    const pendingTeam = game.starters.find((starter) => !hasNamedStarter(starter))?.team ?? "one side";
    if (!named) {
      return `${game.label} is ranked #${rank}, but both starter slots are still pending.`;
    }
    return `${shortName(named)} brings ${formSummary(named, leagueMeanGS)} while ${pendingTeam} is still TBD. ${secondaryDetail(named, game)}`;
  }

  const formGap = starterFormValue(awayStarter, leagueMeanGS) - starterFormValue(homeStarter, leagueMeanGS);
  const lead = Math.abs(formGap) >= 4
    ? formGap > 0
      ? `${shortName(awayStarter)} has the form edge at ${formatScore(starterFormValue(awayStarter, leagueMeanGS))} to ${formatScore(starterFormValue(homeStarter, leagueMeanGS))}.`
      : `${shortName(homeStarter)} has the form edge at ${formatScore(starterFormValue(homeStarter, leagueMeanGS))} to ${formatScore(starterFormValue(awayStarter, leagueMeanGS))}.`
    : `${shortName(awayStarter)} and ${shortName(homeStarter)} are tightly matched on recent form.`;

  return `${lead} ${matchupDetail(game)}`;
}

function matchupDetail(game: TonightGame) {
  const splitDetail = bestOpponentSplitDetail(game.starters);
  if (splitDetail) return splitDetail;

  const kDetail = projectedStrikeoutDetail(game.starters);
  if (kDetail) return kDetail;

  const environment = environmentDetail(game);
  if (environment) return environment;

  const marketDetail = opposingTotalDetail(game.starters);
  if (marketDetail) return marketDetail;

  if (game.watchScoreConfidence !== "HIGH") {
    return "Limited samples keep the grade cautious.";
  }

  return "The board keeps this matchup in watch-score order.";
}

function bestOpponentSplitDetail(starters: readonly TonightStarter[]) {
  const splitStarter = starters
    .filter((starter) => starter.opponentSplit)
    .sort((a, b) => Math.abs((b.opponentSplit?.matchupRunValue ?? 0)) - Math.abs((a.opponentSplit?.matchupRunValue ?? 0)))[0];
  const split = splitStarter?.opponentSplit;
  if (!split || !splitStarter) return null;

  const side = split.matchupRunValue <= -0.25 ? "helps" : split.matchupRunValue >= 0.25 ? "pressures" : "sets a neutral test for";
  return `${split.team} ${splitLabel(split.split)} ${side} ${shortName(splitStarter)} with a .${formatOps(split.ops)} OPS split.`;
}

function projectedStrikeoutDetail(starters: readonly TonightStarter[]) {
  const projected = starters
    .map((starter) => ({
      starter,
      value: starter.marketContext?.projectedStrikeouts ?? starter.projection?.line.strikeouts ?? null,
      prop: starter.marketContext?.strikeoutPropLine ?? null,
    }))
    .filter((entry): entry is { starter: TonightStarter; value: number; prop: number | null } => typeof entry.value === "number");
  if (projected.length === 0) return null;

  const total = projected.reduce((sum, entry) => sum + entry.value, 0);
  const leader = projected.sort((a, b) => b.value - a.value)[0];
  if (leader.prop !== null) {
    return `${shortName(leader.starter)} owns the larger K outlook at ${leader.value.toFixed(1)} against a ${leader.prop.toFixed(1)} line.`;
  }
  return `Projected strikeouts total ${total.toFixed(1)}, led by ${shortName(leader.starter)} at ${leader.value.toFixed(1)}.`;
}

function environmentDetail(game: TonightGame) {
  if (game.weatherContext.source === "indoor") {
    return `${game.park} is controlled indoors, keeping run context steady.`;
  }
  if (game.weatherContext.runValue >= 0.4) {
    return `${game.weatherContext.label} adds run pressure at ${game.park}.`;
  }
  if (game.weatherContext.runValue <= -0.4) {
    return `${game.weatherContext.label} gives the pitchers extra margin.`;
  }
  if (game.parkContext.runValue >= 0.4) {
    return `${game.parkContext.label} is the main run-risk factor.`;
  }
  if (game.parkContext.runValue <= -0.4) {
    return `${game.parkContext.label} gives both arms a park cushion.`;
  }
  return null;
}

function opposingTotalDetail(starters: readonly TonightStarter[]) {
  const priced = starters
    .map((starter) => ({
      starter,
      total: starter.marketContext?.opposingTeamTotal ?? null,
    }))
    .filter((entry): entry is { starter: TonightStarter; total: number } => typeof entry.total === "number")
    .sort((a, b) => a.total - b.total);
  if (priced.length === 0) return null;

  const toughest = priced[priced.length - 1];
  const softest = priced[0];
  if (toughest.total - softest.total >= 0.7) {
    return `${shortName(toughest.starter)} faces the higher implied total at ${toughest.total.toFixed(1)} runs.`;
  }
  return `Markets price both opposing lineups in a tight run band.`;
}

function secondaryDetail(starter: TonightStarter, game: TonightGame) {
  const split = starter.opponentSplit;
  if (split) {
    return `${split.team} ${splitLabel(split.split)} carries a .${formatOps(split.ops)} OPS split.`;
  }
  const projectedK = starter.marketContext?.projectedStrikeouts ?? starter.projection?.line.strikeouts;
  if (typeof projectedK === "number") {
    return `${shortName(starter)} projects for ${projectedK.toFixed(1)} strikeouts.`;
  }
  return `${game.parkContext.label} is the clearest available context.`;
}

function starterFormValue(starter: TonightStarter, leagueMeanGS: number) {
  return starter.rgs ?? starter.projection?.projectedGsPlus ?? leagueMeanGS;
}

function formSummary(starter: TonightStarter, leagueMeanGS: number) {
  const value = starterFormValue(starter, leagueMeanGS);
  const delta = starter.deltaForm;
  if (typeof delta === "number" && Math.abs(delta) >= 2) {
    return `${formatScore(value)} form, ${delta > 0 ? "up" : "down"} ${Math.abs(delta).toFixed(1)}`;
  }
  return `${formatScore(value)} form`;
}

function shortName(starter: TonightStarter) {
  const name = starter.name?.trim();
  if (!name) return starter.team;
  const parts = name.split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

function hasNamedStarter(starter: TonightStarter) {
  return starter.status !== "tbd" && Boolean(starter.name);
}

function formatScore(value: number) {
  return value.toFixed(1);
}

function formatOps(value: number) {
  return Math.round(value * 1000).toString().padStart(3, "0");
}

function splitLabel(split: "vs-lhp" | "vs-rhp") {
  return split === "vs-lhp" ? "vs LHP" : "vs RHP";
}
