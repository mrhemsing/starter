import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

function readArg(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
}

const season = readArg("season", process.env.THE_BUMP_ARCHIVE_SEASON ?? "2026");
const archiveRoot = readArg("dir", process.env.THE_BUMP_ARCHIVE_DIR ?? path.join("data", "mlb-archive", season));
const supabaseUrl = process.env.THE_BUMP_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.THE_BUMP_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const batchSize = Number(process.env.THE_BUMP_SUPABASE_SYNC_BATCH_SIZE ?? 500);

if (!supabaseUrl || !serviceKey) {
  throw new Error("Set THE_BUMP_SUPABASE_URL and THE_BUMP_SUPABASE_SERVICE_ROLE_KEY before syncing");
}

const manifest = await readJson(path.join(archiveRoot, "manifest.json"));
const dateDir = path.join(archiveRoot, "dates");
const dateFiles = (await readdir(dateDir)).filter((file) => file.endsWith(".json")).sort();
const rows = [];
const statcastRows = [];
const pitcherArsenalStarts = [];

for (const file of dateFiles) {
  const archive = await readJson(path.join(dateDir, file));
  for (const game of archive.games ?? []) {
    for (const start of game.starts ?? []) {
      rows.push({
        season: archive.season,
        date: archive.date,
        game_pk: start.gamePk,
        game_date: game.gameDate,
        venue: game.venue,
        away_team: {
          abbreviation: game.awayTeam.abbreviation,
          name: game.awayTeam.name,
        },
        home_team: {
          abbreviation: game.homeTeam.abbreviation,
          name: game.homeTeam.name,
        },
        pitcher_mlb_id: start.pitcherMlbId,
        pitcher_name: start.pitcherName,
        team: start.team,
        opponent: start.opponent,
        side: start.side,
        result: start.result,
        line: start.line,
        pitch_event_count: start.pitchEventCount ?? start.pitchEvents?.length ?? 0,
        arsenal: start.arsenal ?? [],
        pitch_events: [],
        archived_at: archive.archivedAt ?? manifest.archivedAt,
      });
      if ((start.pitchEvents?.length ?? 0) > 0) {
        pitcherArsenalStarts.push({
          season: archive.season,
          date: archive.date,
          pitcherMlbId: start.pitcherMlbId,
          pitcherName: start.pitcherName,
          team: start.team,
          pitchEvents: start.pitchEvents,
        });
      }
      for (const pitchEvent of start.pitchEvents ?? []) {
        if (!pitchEvent.statcast || Object.keys(pitchEvent.statcast).length === 0) continue;
        statcastRows.push({
          season: archive.season,
          date: archive.date,
          game_pk: start.gamePk,
          pitcher_mlb_id: start.pitcherMlbId,
          pitch_number: pitchEvent.pitchNumber,
          pitch_event_id: pitchEvent.id,
          pitch_type: pitchEvent.type,
          result: pitchEvent.result,
          statcast: pitchEvent.statcast,
          enriched_at: archive.archivedAt ?? manifest.archivedAt,
          source: "baseball-savant",
        });
      }
    }
  }
}

for (let index = 0; index < rows.length; index += batchSize) {
  const batch = rows.slice(index, index + batchSize);
  await upsert("toetheslab_mlb_completed_starts", batch, "date,game_pk,pitcher_mlb_id");
  console.log(`synced starts ${Math.min(index + batch.length, rows.length)} / ${rows.length}`);
}

const pitcherArsenalRows = buildPitcherArsenalRows(pitcherArsenalStarts, manifest);
for (let index = 0; index < pitcherArsenalRows.length; index += batchSize) {
  const batch = pitcherArsenalRows.slice(index, index + batchSize);
  await upsert("toetheslab_pitcher_archive_arsenals", batch, "season,pitcher_mlb_id");
  console.log(`synced pitcher archive arsenals ${Math.min(index + batch.length, pitcherArsenalRows.length)} / ${pitcherArsenalRows.length}`);
}

for (let index = 0; index < statcastRows.length; index += batchSize) {
  const batch = statcastRows.slice(index, index + batchSize);
  await upsert("toetheslab_statcast_pitch_event_enrichments", batch, "date,game_pk,pitcher_mlb_id,pitch_number");
  console.log(`synced statcast pitch enrichments ${Math.min(index + batch.length, statcastRows.length)} / ${statcastRows.length}`);
}

await upsert("toetheslab_mlb_archive_manifests", [{
  season: manifest.season,
  start_date: manifest.startDate,
  end_date: manifest.endDate,
  archived_at: manifest.archivedAt,
  source: manifest.source,
  counts: manifest.counts,
  dates: manifest.dates,
}], "season");

console.log(`supabase archive sync ok: ${season}, dates ${dateFiles.length}, starts ${rows.length}, pitcher arsenals ${pitcherArsenalRows.length}, statcast pitch enrichments ${statcastRows.length}`);

async function upsert(table, body, conflictColumns) {
  const url = new URL(`/rest/v1/${table}`, supabaseUrl);
  url.searchParams.set("on_conflict", conflictColumns);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`${table} upsert failed with HTTP ${response.status}: ${await response.text()}`);
  }
}

function buildPitcherArsenalRows(starts, manifest) {
  const byPitcher = new Map();
  for (const start of starts) {
    const key = String(start.pitcherMlbId);
    const values = byPitcher.get(key) ?? [];
    values.push(start);
    byPitcher.set(key, values);
  }

  return Array.from(byPitcher.values()).map((pitcherStarts) => {
    const sorted = [...pitcherStarts].sort((a, b) => b.date.localeCompare(a.date));
    const recent = sorted.slice(0, 5);
    const dates = recent.map((start) => start.date).sort();
    const pitchEvents = recent.flatMap((start) => start.pitchEvents ?? []);
    const first = recent[0];

    return {
      season: manifest.season,
      pitcher_mlb_id: first.pitcherMlbId,
      pitcher_name: first.pitcherName,
      team: first.team,
      arsenal: summarizePitchEvents(pitchEvents),
      starts: recent.length,
      pitch_events: pitchEvents.length,
      first_start_date: dates[0],
      last_start_date: dates.at(-1),
      start_date: manifest.startDate,
      end_date: manifest.endDate,
      archived_at: manifest.archivedAt,
      source: "mlb-stats-api",
    };
  }).filter((row) => row.arsenal.length > 0);
}

function summarizePitchEvents(pitchEvents) {
  const pitchTypes = Array.from(new Set(pitchEvents.map((pitch) => pitch.type)));

  return pitchTypes.map((type) => {
    const ofType = pitchEvents.filter((pitch) => pitch.type === type);
    const velocities = ofType.map((pitch) => pitch.velocityMph).filter(Number.isFinite);
    const whiffs = ofType.filter((pitch) => pitch.result === "swinging_strike").length;
    const swings = ofType.filter((pitch) => ["swinging_strike", "foul", "hit_into_play"].includes(pitch.result)).length;
    const calledStrikes = ofType.filter((pitch) => pitch.result === "called_strike").length;

    return {
      type,
      usagePct: Math.max(1, Math.round((ofType.length / pitchEvents.length) * 100)),
      avgVelocityMph: Number((velocities.reduce((total, velocity) => total + velocity, 0) / Math.max(1, velocities.length)).toFixed(1)),
      whiffPct: swings > 0 ? Math.round((whiffs / swings) * 100) : 0,
      calledStrikePct: Math.round((calledStrikes / ofType.length) * 100),
    };
  });
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}
