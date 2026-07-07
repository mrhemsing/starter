import { FORM_CONFIG, formHeatBandOf } from "@/lib/form-tokens";
import type { HeatBandKey, TonightGame, TonightStarter } from "@/lib/types";

type MatchupArchetype = "ACE_DUEL" | "CLEAR_EDGE" | "MISMATCH_DOWN" | "COIN_FLIP" | "BOTH_COLD" | "PROVISIONAL" | "TBD";
type SignalType = "confidence" | "tbd" | "form-gap" | "trend-split" | "park" | "rest" | "handedness" | "strikeouts" | "market-total" | "watch-band";

type ContextInput = {
  archetype: MatchupArchetype;
  namedStarters: TonightStarter[];
  values: [number, number];
  gap: number;
  leader: TonightStarter;
  trailer: TonightStarter;
  confidenceStarter: TonightStarter;
};

type ContextSignal = {
  type: SignalType;
  score: number;
  phrases: string[];
};

const CLEAR_EDGE_GAP = 8;
const SMALL_GAP = 5;
const TOP_BANDS: HeatBandKey[] = ["onfire", "hot"];
const LOW_BANDS: HeatBandKey[] = ["cooling", "ice"];
const PROHIBITED_SMALL_GAP_CLAIMS = /\b(separation|towers|clear|runs away)\b/i;
const NARRATIVE_VERBS = /\b(unhittable|dominant stretch|has been|since|revenge|owns him)\b/i;

const ARCHETYPE_BANK: Record<MatchupArchetype, readonly string[]> = {
  ACE_DUEL: [
    "{leader} and {trailer} are both hot, with {leader} slightly higher at {leadForm}.",
    "Two hot arms meet, and {leader}'s {leadForm} gives the small lean.",
    "{leader} and {trailer} both bring heat; {leader} has the better number.",
    "Both starters are rolling, with {leader} a tick ahead at {leadForm}.",
  ],
  CLEAR_EDGE: [
    "{leader}'s sharper form sets the tone against {trailer}.",
    "{leader} brings the stronger recent shape against {trailer}.",
    "{leader}'s form is the matchup's loudest signal against {trailer}.",
    "{leader} has the trusted side of the form read over {trailer}.",
  ],
  MISMATCH_DOWN: [
    "{trailer} is cold, while {leader}'s {leadForm} keeps the trust edge.",
    "{leader} brings the only strong form side against cold {trailer}.",
    "{trailer}'s cold band drags the matchup below {leader}'s side.",
    "{leader} is the steadier read with {trailer} stuck low.",
  ],
  COIN_FLIP: [
    "Pick-em on form, so the park and run context matter most.",
    "{leader} leads by only {gap} points, making the context do the work.",
    "Small form gap, with {leader} getting the narrow contextual lean.",
    "The starters sit close, so the board leans on matchup details.",
  ],
  BOTH_COLD: [
    "Two cold arms meet, and the lower grade is honest.",
    "{leader} gets the lean, but both starters are scuffling.",
    "Both bands sit low, keeping the watch score restrained.",
    "Cold form on both sides makes this a cautious grade.",
  ],
  PROVISIONAL: [
    "Thin sample on {name}, so read the number as provisional.",
    "Limited data around {name} keeps the grade cautious.",
    "{name}'s sample is light, so the score needs restraint.",
    "Small-sample flags make {name}'s side less settled.",
  ],
  TBD: [
    "{team} has not named a starter; {name} anchors the read.",
    "{team}'s starter is still open, leaving {name} as the anchor.",
    "A pending {team} arm keeps the matchup provisional around {name}.",
    "{team} remains TBD, so {name}'s side carries the read.",
  ],
};

const SECONDARY_BANK: Record<SignalType, readonly string[]> = {
  confidence: ARCHETYPE_BANK.PROVISIONAL,
  tbd: ARCHETYPE_BANK.TBD,
  "form-gap": ARCHETYPE_BANK.CLEAR_EDGE,
  "trend-split": [
    "{up} is rising while {down} trends down.",
    "{up}'s arrow points up while {down}'s form slips.",
    "Opposite trend lines put {up} ahead of {down}.",
    "{up} brings momentum while {down} slides.",
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
    "The score reads {label}, with starter context attached.",
  ],
};

export function upcomingSimpleContextSentence(game: TonightGame, rank: number, leagueMeanGS: number) {
  const input = classifyMatchup(game, leagueMeanGS);
  const primary = archetypeSentence(input, game.gamePk);
  const secondary = contextSignals(game, input, rank)
    .sort((a, b) => b.score - a.score || a.type.localeCompare(b.type))
    .find((signal) => signal.score >= 82);
  const candidate = fitSentence(primary, secondary ? pickPhrase(secondary, `${game.gamePk}:${input.archetype}`) : null);
  return validateSentence(candidate, input) ? candidate : archetypeSentence(input, `${game.gamePk}:fallback`);
}

export function validateUpcomingSimpleContextSentence(sentence: string, game: TonightGame, leagueMeanGS: number) {
  const input = classifyMatchup(game, leagueMeanGS);
  return validateSentence(sentence.trim(), input);
}

export function upcomingSimpleContextArchetype(game: TonightGame, leagueMeanGS: number) {
  return classifyMatchup(game, leagueMeanGS).archetype;
}

function classifyMatchup(game: TonightGame, leagueMeanGS: number): ContextInput {
  const namedStarters = game.starters.filter(hasNamedStarter);
  const [awayStarter, homeStarter] = game.starters;
  const values: [number, number] = [starterFormValue(awayStarter, leagueMeanGS), starterFormValue(homeStarter, leagueMeanGS)];
  const gap = Math.abs(values[0] - values[1]);
  const leader = values[0] >= values[1] ? awayStarter : homeStarter;
  const trailer = leader === awayStarter ? homeStarter : awayStarter;
  const confidenceStarter = namedStarters.find((starter) => starter.formStatus !== "ok" || starter.limitedReason) ?? namedStarters[0] ?? awayStarter;

  if (namedStarters.length < 2) {
    const named = namedStarters[0] ?? awayStarter;
    const pending = game.starters.find((starter) => !hasNamedStarter(starter)) ?? homeStarter;
    return { archetype: "TBD", namedStarters, values, gap, leader: named, trailer: pending, confidenceStarter: named };
  }
  if (game.watchScoreConfidence !== "HIGH" || game.flags?.limitedForm || namedStarters.some((starter) => starter.formStatus !== "ok" || starter.limitedReason)) {
    return { archetype: "PROVISIONAL", namedStarters, values, gap, leader, trailer, confidenceStarter };
  }

  const bands = namedStarters.map((starter) => starterBand(starter, leagueMeanGS));
  const bothTop = bands.every((band) => TOP_BANDS.includes(band));
  const bothCold = bands.every((band) => LOW_BANDS.includes(band));
  const oneTopOneCold = bands.some((band) => TOP_BANDS.includes(band)) && bands.some((band) => LOW_BANDS.includes(band));

  if (bothTop && gap < CLEAR_EDGE_GAP) return { archetype: "ACE_DUEL", namedStarters, values, gap, leader, trailer, confidenceStarter };
  if (oneTopOneCold) return { archetype: "MISMATCH_DOWN", namedStarters, values, gap, leader, trailer, confidenceStarter };
  if (gap >= CLEAR_EDGE_GAP) return { archetype: "CLEAR_EDGE", namedStarters, values, gap, leader, trailer, confidenceStarter };
  if (bothCold) return { archetype: "BOTH_COLD", namedStarters, values, gap, leader, trailer, confidenceStarter };
  if (gap <= SMALL_GAP) return { archetype: "COIN_FLIP", namedStarters, values, gap, leader, trailer, confidenceStarter };
  return { archetype: "COIN_FLIP", namedStarters, values, gap, leader, trailer, confidenceStarter };
}

function archetypeSentence(input: ContextInput, seed: string) {
  const pending = input.namedStarters.length < 2 ? input.trailer : null;
  const anchor = input.namedStarters[0] ?? input.leader;
  return fill(pickFrom(ARCHETYPE_BANK[input.archetype], `${seed}:${input.archetype}`), {
    leader: shortName(input.leader),
    trailer: shortName(input.trailer),
    leadForm: formatScore(starterValue(input.leader, input)),
    trailForm: formatScore(starterValue(input.trailer, input)),
    gap: formatGap(input.gap),
    name: shortName(input.confidenceStarter),
    team: pending?.team ?? "one side",
    label: "solid",
    park: "the park",
    parkTone: "neutral",
    parkLabel: "Park context",
    up: shortName(input.leader),
    down: shortName(input.trailer),
    rest: "",
    split: "",
    value: "",
    total: "",
    rank: "",
    anchor: shortName(anchor),
  });
}

function contextSignals(game: TonightGame, input: ContextInput, rank: number): ContextSignal[] {
  const signals: ContextSignal[] = [];
  if (input.archetype === "TBD") return signals;
  const trendSignal = trendSplitSignal(game.starters[0], game.starters[1]);
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

function trendSplitSignal(awayStarter: TonightStarter, homeStarter: TonightStarter) {
  const awayTrend = trendDirection(awayStarter);
  const homeTrend = trendDirection(homeStarter);
  if (!awayTrend || !homeTrend || awayTrend === homeTrend || awayTrend === "steady" || homeTrend === "steady") return null;
  const up = awayTrend === "rising" ? awayStarter : homeStarter;
  const down = awayTrend === "falling" ? awayStarter : homeStarter;
  return signal("trend-split", 92, SECONDARY_BANK["trend-split"].map((phrase) => fill(phrase, {
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
  return signal("park", 86 + Math.abs(environment.value) * 10, SECONDARY_BANK.park.map((phrase) => fill(phrase, {
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
  return signal("rest", 78 + rested[0].rest - rested[1].rest, SECONDARY_BANK.rest.map((phrase) => fill(phrase, {
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
  return signal("handedness", 76 + Math.abs(split.matchupRunValue) * 10, SECONDARY_BANK.handedness.map((phrase) => fill(phrase, {
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
  return signal("strikeouts", 72 + projected[0].value, SECONDARY_BANK.strikeouts.map((phrase) => fill(phrase, {
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
  return signal("market-total", 68 + priced[0].opposingTeamTotal, SECONDARY_BANK["market-total"].map((phrase) => fill(phrase, {
    name: shortName(priced[0].starter),
    total: priced[0].opposingTeamTotal.toFixed(1),
  })));
}

function watchBandPhrases(game: TonightGame, rank: number) {
  return SECONDARY_BANK["watch-band"].map((phrase) => fill(phrase, {
    label: rank <= 3 ? "Top-three" : watchBandLabel(game.gameWatchScore),
  }));
}

function validateSentence(sentence: string, input: ContextInput) {
  if (wordCount(sentence) > 22 || sentence.includes("—") || /\bthis one\b/i.test(sentence)) return false;
  if (sentenceCount(sentence) !== 1) return false;
  if (NARRATIVE_VERBS.test(sentence)) return false;
  if (input.gap < CLEAR_EDGE_GAP && PROHIBITED_SMALL_GAP_CLAIMS.test(sentence)) return false;
  if (input.archetype !== "CLEAR_EDGE" && /\b(separation|owns the form gap)\b/i.test(sentence)) return false;
  if (input.archetype === "ACE_DUEL" && !/\b(both|Two)\b/i.test(sentence)) return false;
  if (input.archetype === "TBD" && /\b(gap|separation|towers|runs away)\b/i.test(sentence)) return false;
  return numberTokens(sentence).every((token) => allowedNumberTokens(input).has(token));
}

function signal(type: SignalType, score: number, phrases: string[]): ContextSignal {
  return { type, score, phrases };
}

function pickPhrase(signal: ContextSignal, seed: string) {
  return pickFrom(signal.phrases, `${seed}:${signal.type}`);
}

function pickFrom(phrases: readonly string[], seed: string) {
  return phrases[hash(seed) % phrases.length];
}

function fitSentence(first: string, second: string | null) {
  const cleanedFirst = cleanCopy(first);
  if (!second) return cleanedFirst;
  const combined = `${cleanedFirst.replace(/[.?!]$/, ",")} ${lowercaseFirst(cleanCopy(second))}`;
  return wordCount(combined) <= 22 ? combined : cleanedFirst;
}

function cleanCopy(value: string) {
  return value.replace(/—/g, "-").replace(/\bthis one\b/gi, "the game").replace(/\s+/g, " ").trim();
}

function lowercaseFirst(value: string) {
  return value ? `${value.charAt(0).toLowerCase()}${value.slice(1)}` : value;
}

function starterFormValue(starter: TonightStarter, leagueMeanGS: number) {
  return starter.rgs ?? starter.projection?.projectedGsPlus ?? leagueMeanGS;
}

function starterValue(starter: TonightStarter, input: ContextInput) {
  const index = input.namedStarters.findIndex((candidate) => candidate === starter);
  if (index === 0 || starter === input.namedStarters[0]) return input.values[starter.side === "away" ? 0 : 1];
  if (index === 1 || starter === input.namedStarters[1]) return input.values[starter.side === "away" ? 0 : 1];
  return input.values[starter.side === "away" ? 0 : 1];
}

function starterBand(starter: TonightStarter, leagueMeanGS: number): HeatBandKey {
  if (starter.tier) return starter.tier;
  return formHeatBandOf(starterFormValue(starter, leagueMeanGS), FORM_CONFIG.windowDefault).key;
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

function formatGap(value: number) {
  return Math.round(value).toString();
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

function allowedNumberTokens(input: ContextInput) {
  return new Set([
    formatScore(input.values[0]),
    formatScore(input.values[1]),
    formatGap(input.gap),
  ]);
}

function numberTokens(sentence: string) {
  return sentence.match(/\d+(?:\.\d+)?/g) ?? [];
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

function sentenceCount(sentence: string) {
  return sentence.match(/[.!?](?:\s|$)/g)?.length ?? 0;
}
