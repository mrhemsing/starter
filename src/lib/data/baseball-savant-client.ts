import type { MlbStartPitchDetails, PitchEvent, PitchResultKey, PitchTypeKey } from "@/lib/types";

const BASEBALL_SAVANT_CSV = "https://baseballsavant.mlb.com/statcast_search/csv";
const SAVANT_REVALIDATE_SECONDS = 24 * 60 * 60;

type SavantRow = Record<string, string>;

export async function fetchSavantStartPitchDetails(date: string, gamePk: number, pitcherMlbId: number): Promise<MlbStartPitchDetails | null> {
  const params = new URLSearchParams({
    all: "true",
    hfGT: "R|",
    game_date_gt: date,
    game_date_lt: date,
    player_type: "pitcher",
    type: "details",
  });
  params.append("pitchers_lookup[]", String(pitcherMlbId));

  try {
    const response = await fetch(`${BASEBALL_SAVANT_CSV}?${params.toString()}`, {
      headers: { "User-Agent": "FrontFive/1.0" },
      next: { revalidate: SAVANT_REVALIDATE_SECONDS },
    });
    if (!response.ok) return null;

    const rows = parseCsv(await response.text())
      .filter((row) => Number(row.game_pk) === gamePk && Number(row.pitcher) === pitcherMlbId)
      .sort(compareSavantRows);
    const pitchEvents = rows
      .map((row, index) => rowToPitchEvent(row, gamePk, pitcherMlbId, index + 1))
      .filter((pitch): pitch is PitchEvent => Boolean(pitch));

    if (pitchEvents.length === 0) return null;
    return {
      source: "statcast-savant",
      arsenal: summarizePitchEvents(pitchEvents),
      pitchEvents,
    };
  } catch {
    return null;
  }
}

function rowToPitchEvent(row: SavantRow, gamePk: number, pitcherMlbId: number, pitchNumber: number): PitchEvent | null {
  const type = readPitchType(row.pitch_type);
  const result = readPitchResult(row.description, row.type);
  const velocity = Number(row.release_speed);
  const plateX = Number(row.plate_x);
  const plateZ = Number(row.plate_z);
  const balls = Number(row.balls);
  const strikes = Number(row.strikes);
  const inning = Number(row.inning);

  if (!type || !result || !Number.isFinite(velocity) || !Number.isFinite(plateX) || !Number.isFinite(plateZ)) return null;

  return {
    id: `${gamePk}-${pitcherMlbId}-${pitchNumber}`,
    gamePk,
    pitchNumber,
    inning: Number.isFinite(inning) ? inning : 1,
    count: {
      balls: Number.isFinite(balls) ? balls : 0,
      strikes: Number.isFinite(strikes) ? strikes : 0,
    },
    type,
    velocityMph: Number(velocity.toFixed(1)),
    plateX: Number(plateX.toFixed(2)),
    plateZ: Number(plateZ.toFixed(2)),
    result,
  };
}

function compareSavantRows(a: SavantRow, b: SavantRow) {
  return Number(a.inning) - Number(b.inning)
    || topBottomOrder(a.inning_topbot) - topBottomOrder(b.inning_topbot)
    || Number(a.at_bat_number) - Number(b.at_bat_number)
    || Number(a.pitch_number) - Number(b.pitch_number);
}

function topBottomOrder(value: string | undefined) {
  return value === "Top" ? 0 : 1;
}

function readPitchType(code: string | undefined): PitchTypeKey | undefined {
  if (!code) return undefined;
  if (["FF", "FA"].includes(code)) return "FF";
  if (["SI", "FT"].includes(code)) return "SI";
  if (["SL", "ST", "SV"].includes(code)) return "SL";
  if (["CH", "FS", "FO", "SC"].includes(code)) return "CH";
  if (["CU", "KC", "CS", "EP"].includes(code)) return "CU";
  if (code === "FC") return "FC";
  return undefined;
}

function readPitchResult(description: string | undefined, type: string | undefined): PitchResultKey | undefined {
  if (description === "called_strike") return "called_strike";
  if (description?.includes("swinging_strike") || description === "missed_bunt") return "swinging_strike";
  if (description?.startsWith("foul")) return "foul";
  if (type === "X" || description === "hit_into_play") return "hit_into_play";
  if (type === "B" || ["ball", "blocked_ball", "pitchout"].includes(description ?? "")) return "ball";
  if (type === "S") return "called_strike";
  return undefined;
}

function summarizePitchEvents(pitchEvents: PitchEvent[]): MlbStartPitchDetails["arsenal"] {
  const pitchTypes = Array.from(new Set(pitchEvents.map((pitch) => pitch.type)));

  return pitchTypes.map((type) => {
    const ofType = pitchEvents.filter((pitch) => pitch.type === type);
    const velocities = ofType.map((pitch) => pitch.velocityMph);
    const whiffs = ofType.filter((pitch) => pitch.result === "swinging_strike").length;
    const swings = ofType.filter((pitch) => ["swinging_strike", "foul", "hit_into_play"].includes(pitch.result)).length;
    const calledStrikes = ofType.filter((pitch) => pitch.result === "called_strike").length;

    return {
      type,
      usagePct: Math.max(1, Math.round((ofType.length / pitchEvents.length) * 100)),
      avgVelocityMph: Number((velocities.reduce((total, velocity) => total + velocity, 0) / velocities.length).toFixed(1)),
      whiffPct: swings > 0 ? Math.round((whiffs / swings) * 100) : 0,
      calledStrikePct: Math.round((calledStrikes / ofType.length) * 100),
    };
  });
}

function parseCsv(csv: string): SavantRow[] {
  const rows = parseCsvRows(csv.replace(/^\uFEFF/, ""));
  const header = rows.shift();
  if (!header) return [];
  return rows
    .filter((row) => row.length === header.length)
    .map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ""])));
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];
    if (quoted && char === "\"" && next === "\"") {
      field += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (!quoted && char === ",") {
      row.push(field);
      field = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
