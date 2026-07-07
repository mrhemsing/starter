import type { TonightGame, TonightStarter } from "@/lib/types";

export function upcomingSimpleContextSentence(game: TonightGame, rank: number, leagueMeanGS: number) {
  const [awayStarter, homeStarter] = game.starters;
  const limitedStarter = game.watchScoreConfidence === "LOW"
    ? firstLimitedStarter(game.starters)
    : null;

  if (limitedStarter) {
    return `Low sample on ${surname(limitedStarter)}, rate with caution.`;
  }

  if (startersGradePlus(game.starters, leagueMeanGS) && game.matchupScore >= 60) {
    return "Elite matchup: both starters grading plus.";
  }

  const formGap = starterFormValue(awayStarter, leagueMeanGS) - starterFormValue(homeStarter, leagueMeanGS);
  if (Math.abs(formGap) >= 6) {
    const carrier = formGap > 0 ? awayStarter : homeStarter;
    const cooled = formGap > 0 ? homeStarter : awayStarter;
    return `${surname(carrier)}'s form carries this one; ${surname(cooled)} has cooled.`;
  }

  if (startersAreRising(game.starters) && game.parkContext.runValue > 0) {
    return "Two rising arms in a hitter-friendly park.";
  }

  return `Ranked #${rank} on today's board.`;
}

function firstLimitedStarter(starters: readonly TonightStarter[]) {
  return starters.find((starter) => starter.flags?.limitedSample === true || starter.formStatus !== "ok") ?? starters[0];
}

function startersGradePlus(starters: readonly TonightStarter[], leagueMeanGS: number) {
  return starters.every((starter) => starterFormValue(starter, leagueMeanGS) >= leagueMeanGS + 3);
}

function startersAreRising(starters: readonly TonightStarter[]) {
  return starters.every((starter) => starter.trend === "heating" || (starter.deltaForm ?? 0) > 0);
}

function starterFormValue(starter: TonightStarter, leagueMeanGS: number) {
  return starter.rgs ?? starter.projection?.projectedGsPlus ?? leagueMeanGS;
}

function surname(starter: TonightStarter) {
  const name = starter.name?.trim();
  if (!name) return starter.team;
  const parts = name.split(/\s+/);
  return parts[parts.length - 1] ?? name;
}
