import type { TonightGame, TonightStarter } from "@/lib/types";

type SignalType = "confidence" | "tbd" | "form-gap" | "trend-split" | "park" | "rest" | "handedness" | "strikeouts" | "market-total" | "watch-band";

type ContextSignal = {
  type: SignalType;
  score: number;
  phrases: string[];
};

const PHRASE_BANK: Record<SignalType, readonly string[]> = {
  confidence: [
    "Thin samples keep {name}'s number provisional.",
    "Limited data makes {name}'s grade more caution than verdict.",
    "{name}'s sample is light, so the score needs restraint.",
    "Small-sample flags make {name}'s side less settled.",
  ],
  tbd: [
    "{team} has not named a starter; {name} sets the number.",
    "{team}'s starter is still open, leaving {name} as the anchor.",
    "A pending {team} arm keeps the matchup provisional around {name}.",
    "{team} remains TBD, so {name}'s side carries the read.",
  ],
  "form-gap": [
    "{leader}'s {leadForm} form gives him clear separation from {trailer}.",
    "{leader} owns the form gap, {leadForm} to {trailForm}.",
    "{leader} enters sharper by form, with {trailer} chasing.",
    "{leader}'s recent shape is the separator over {trailer}.",
  ],
  "trend-split": [
    "{up} is rising while {down} trends down.",
    "{up}'s arrow points up; {down}'s recent line is sliding.",
    "Opposite trend lines put {up} ahead of {down}.",
    "{up} brings momentum while {down}'s form slips.",
  ],
  park: [
    "{parkLabel} at {park} raises the run stress.",
    "{park} tilts {parkTone}, sharpening the context.",
    "{parkLabel} makes the setting matter here.",
    "The park leans {parkTone}, adding shape to the grade.",
  ],
  rest: [
    "{name} gets the rest edge at {rest} days.",
    "Extra rest helps {name}'s side of the card.",
    "{name}'s workload looks cleaner with {rest} days off.",
    "Rest tilts toward {name}, who gets {rest} days.",
  ],
  handedness: [
    "{team} {split} is the split to watch against {name}.",
    "{name} draws the key handedness test: {team} {split}.",
    "The matchup turns on {team}'s {split} split for {name}.",
    "{team}'s {split} profile colors {name}'s projection.",
  ],
  strikeouts: [
    "{name}'s K outlook leads the card at {value}.",
    "The strikeout lean sits with {name} at {value}.",
    "{name} brings the bigger bat-missing projection at {value}.",
    "K upside points to {name}, projected near {value}.",
  ],
  "market-total": [
    "{name} faces the higher implied total at {total}.",
    "Markets put more run pressure on {name} at {total}.",
    "{name}'s opponent total is the sharper betting warning.",
    "The run-total edge makes {name}'s side tougher.",
  ],
  "watch-band": [
    "{label} score, with both sides close enough to matter.",
    "The watch grade lands {label}, not just schedule filler.",
    "{label} board position keeps the matchup in play.",
    "The score reads {label}, with enough starter context attached.",
  ],
};

export function upcomingSimpleContextSentence(game: TonightGame, rank: number, leagueMeanGS: number) {
  const signals = contextSignals(game, rank, leagueMeanGS)
    .sort((a, b) => b.score - a.score || a.type.localeCompare(b.type));
  const lead = signals[0] ?? fallbackSignal(game, rank);
  const secondary = signals.find((signal) => signal.type !== lead.type && signal.score >= 70);
  const first = pickPhrase(lead, game.gamePk);
  const second = secondary ? pickPhrase(secondary, `${game.gamePk}:${lead.type}`) : null;
  return fitSentence(first, second);
}

function contextSignals(game: TonightGame, rank: number, leagueMeanGS: number): ContextSignal[] {
  const [awayStarter, homeStarter] = game.starters;
  const namedStarters = game.starters.filter(hasNamedStarter);
  const signals: ContextSignal[] = [];

  if (game.watchScoreConfidence !== "HIGH" || game.flags?.limitedForm) {
    signals.push(signal("confidence", 120, confidencePhrases(game, namedStarters[0] ?? awayStarter)));
  }

  if (namedStarters.length < 2) {
    signals.push(signal("tbd", 115, tbdPhrases(game, namedStarters[0])));
    return signals;
  }

  const formGap = starterFormValue(awayStarter, leagueMeanGS) - starterFormValue(homeStarter, leagueMeanGS);
  if (Math.abs(formGap) >= 4) {
    const leader = formGap > 0 ? awayStarter : homeStarter;
    const trailer = formGap > 0 ? homeStarter : awayStarter;
    signals.push(signal("form-gap", 100 + Math.abs(formGap), formGapPhrases(leader, trailer, leagueMeanGS)));
  }

  const trendSignal = trendSplitSignal(awayStarter, homeStarter);
  if (trendSignal) signals.push(trendSignal);

  const environmentSignal = parkSignal(game);
  if (environmentSignal) signals.push(environmentSignal);

  const restSignal = restEdgeSignal(game.starters);
  if (restSignal) signals.push(restSignal);

  const handednessSignal = handednessSignalFor(game.starters);
  if (handednessSignal) signals.push(handednessSignal);

  const strikeoutSignal = strikeoutSignalFor(game.starters);
  if (strikeoutSignal) signals.push(strikeoutSignal);

  const marketTotalSignal = marketTotalSignalFor(game.starters);
  if (marketTotalSignal) signals.push(marketTotalSignal);

  signals.push(signal("watch-band", 40 + game.gameWatchScore / 2, watchBandPhrases(game, rank)));
  return signals;
}

function confidencePhrases(game: TonightGame, starter: TonightStarter) {
  const name = shortName(starter);
  return PHRASE_BANK.confidence.map((phrase) => fill(phrase, { name, label: watchBandLabel(game.gameWatchScore) }));
}

function tbdPhrases(game: TonightGame, named: TonightStarter | undefined) {
  const pending = game.starters.find((starter) => !hasNamedStarter(starter));
  const anchor = named ?? game.starters.find(hasNamedStarter) ?? game.starters[0];
  return PHRASE_BANK.tbd.map((phrase) => fill(phrase, {
    team: pending?.team ?? "one side",
    name: shortName(anchor),
  }));
}

function formGapPhrases(leader: TonightStarter, trailer: TonightStarter, leagueMeanGS: number) {
  return PHRASE_BANK["form-gap"].map((phrase) => fill(phrase, {
    leader: shortName(leader),
    trailer: shortName(trailer),
    leadForm: formatScore(starterFormValue(leader, leagueMeanGS)),
    trailForm: formatScore(starterFormValue(trailer, leagueMeanGS)),
  }));
}

function trendSplitSignal(awayStarter: TonightStarter, homeStarter: TonightStarter) {
  const awayTrend = trendDirection(awayStarter);
  const homeTrend = trendDirection(homeStarter);
  if (!awayTrend || !homeTrend || awayTrend === homeTrend || awayTrend === "steady" || homeTrend === "steady") return null;
  const up = awayTrend === "rising" ? awayStarter : homeStarter;
  const down = awayTrend === "falling" ? awayStarter : homeStarter;
  return signal("trend-split", 92, PHRASE_BANK["trend-split"].map((phrase) => fill(phrase, {
    up: shortName(up),
    down: shortName(down),
  })));
}

function parkSignal(game: TonightGame) {
  const environment = Math.abs(game.weatherContext.runValue) > Math.abs(game.parkContext.runValue)
    ? { value: game.weatherContext.runValue, label: shortEnvironmentLabel(game.weatherContext.label), park: game.park }
    : { value: game.parkContext.runValue, label: game.parkContext.label, park: game.park };
  if (Math.abs(environment.value) < 0.35) return null;
  const parkTone = environment.value > 0 ? "toward bats" : "toward arms";
  return signal("park", 86 + Math.abs(environment.value) * 10, PHRASE_BANK.park.map((phrase) => fill(phrase, {
    park: environment.park,
    parkLabel: environment.label,
    parkTone,
  })));
}

function restEdgeSignal(starters: readonly TonightStarter[]) {
  const rested = starters
    .map((starter) => ({ starter, rest: starter.workload?.daysRest ?? null }))
    .filter((entry): entry is { starter: TonightStarter; rest: number } => typeof entry.rest === "number")
    .sort((a, b) => b.rest - a.rest);
  if (rested.length < 2 || rested[0].rest - rested[1].rest < 2) return null;
  return signal("rest", 78 + rested[0].rest - rested[1].rest, PHRASE_BANK.rest.map((phrase) => fill(phrase, {
    name: shortName(rested[0].starter),
    rest: String(rested[0].rest),
  })));
}

function handednessSignalFor(starters: readonly TonightStarter[]) {
  const splitStarter = starters
    .filter((starter) => starter.opponentSplit)
    .sort((a, b) => Math.abs((b.opponentSplit?.matchupRunValue ?? 0)) - Math.abs((a.opponentSplit?.matchupRunValue ?? 0)))[0];
  const split = splitStarter?.opponentSplit;
  if (!split || !splitStarter || Math.abs(split.matchupRunValue) < 0.2) return null;
  return signal("handedness", 76 + Math.abs(split.matchupRunValue) * 10, PHRASE_BANK.handedness.map((phrase) => fill(phrase, {
    name: shortName(splitStarter),
    team: split.team,
    split: splitLabel(split.split),
  })));
}

function strikeoutSignalFor(starters: readonly TonightStarter[]) {
  const projected = starters
    .map((starter) => ({
      starter,
      value: starter.marketContext?.projectedStrikeouts ?? starter.projection?.line.strikeouts ?? null,
      prop: starter.marketContext?.strikeoutPropLine ?? null,
    }))
    .filter((entry): entry is { starter: TonightStarter; value: number; prop: number | null } => typeof entry.value === "number")
    .sort((a, b) => b.value - a.value);
  if (projected.length === 0 || projected[0].value < 5.5) return null;
  const value = projected[0].prop === null ? projected[0].value.toFixed(1) : `${projected[0].value.toFixed(1)} vs ${projected[0].prop.toFixed(1)}`;
  return signal("strikeouts", 72 + projected[0].value, PHRASE_BANK.strikeouts.map((phrase) => fill(phrase, {
    name: shortName(projected[0].starter),
    value,
  })));
}

function marketTotalSignalFor(starters: readonly TonightStarter[]) {
  const priced = starters
    .map((starter) => ({
      starter,
      opposingTeamTotal: starter.marketContext?.opposingTeamTotal ?? null,
    }))
    .filter((entry): entry is { starter: TonightStarter; opposingTeamTotal: number } => typeof entry.opposingTeamTotal === "number")
    .sort((a, b) => b.opposingTeamTotal - a.opposingTeamTotal);
  if (priced.length < 2 || priced[0].opposingTeamTotal - priced[1].opposingTeamTotal < 0.6) return null;
  return signal("market-total", 68 + priced[0].opposingTeamTotal, PHRASE_BANK["market-total"].map((phrase) => fill(phrase, {
    name: shortName(priced[0].starter),
    total: priced[0].opposingTeamTotal.toFixed(1),
  })));
}

function watchBandPhrases(game: TonightGame, rank: number) {
  return PHRASE_BANK["watch-band"].map((phrase) => fill(phrase, {
    label: rank <= 3 ? "Top-three" : watchBandLabel(game.gameWatchScore),
  }));
}

function fallbackSignal(game: TonightGame, rank: number): ContextSignal {
  return signal("watch-band", 1, [
    `Ranked #${rank} because the starter context beats the slate baseline.`,
    `${game.label} stays on the board through starter form and matchup shape.`,
    `The score holds because both probable slots have usable context.`,
    `Starter form and run context keep this matchup ranked #${rank}.`,
  ]);
}

function signal(type: SignalType, score: number, phrases: string[]): ContextSignal {
  return { type, score, phrases };
}

function pickPhrase(signal: ContextSignal, seed: string) {
  return signal.phrases[hash(`${seed}:${signal.type}`) % signal.phrases.length];
}

function fitSentence(first: string, second: string | null) {
  const cleanedFirst = cleanCopy(first);
  if (!second) return cleanedFirst;
  const combined = `${cleanedFirst} ${cleanCopy(second)}`;
  return wordCount(combined) <= 22 ? combined : cleanedFirst;
}

function cleanCopy(value: string) {
  return value.replace(/—/g, "-").replace(/\bthis one\b/gi, "the game").replace(/\s+/g, " ").trim();
}

function starterFormValue(starter: TonightStarter, leagueMeanGS: number) {
  return starter.rgs ?? starter.projection?.projectedGsPlus ?? leagueMeanGS;
}

function trendDirection(starter: TonightStarter) {
  if (starter.trend === "heating") return "rising";
  if (starter.trend === "cooling") return "falling";
  if (starter.trend === "steady") return "steady";
  const delta = starter.deltaForm;
  if (typeof delta !== "number") return null;
  if (delta >= 1) return "rising";
  if (delta <= -1) return "falling";
  return "steady";
}

function watchBandLabel(score: number) {
  if (score >= 75) return "elite";
  if (score >= 65) return "plus";
  if (score >= 55) return "solid";
  return "thin";
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

function splitLabel(split: "vs-lhp" | "vs-rhp") {
  return split === "vs-lhp" ? "vs LHP" : "vs RHP";
}

function shortEnvironmentLabel(label: string) {
  if (/precip|weather|wind|mph|F\b/i.test(label)) return "Weather";
  return label;
}

function fill(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((current, [key, value]) => current.replaceAll(`{${key}}`, value), template);
}

function hash(value: string) {
  let total = 0;
  for (let index = 0; index < value.length; index += 1) {
    total = (total * 31 + value.charCodeAt(index)) >>> 0;
  }
  return total;
}

function wordCount(sentence: string) {
  return sentence.trim().split(/\s+/).filter(Boolean).length;
}
