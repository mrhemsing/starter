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
        archived_at: archive.archivedAt ?? manifest.archivedAt,
      });
    }
  }
}

for (let index = 0; index < rows.length; index += batchSize) {
  const batch = rows.slice(index, index + batchSize);
  await upsert("frontfive_mlb_completed_starts", batch, "date,game_pk,pitcher_mlb_id");
  console.log(`synced starts ${Math.min(index + batch.length, rows.length)} / ${rows.length}`);
}

await upsert("frontfive_mlb_archive_manifests", [{
  season: manifest.season,
  start_date: manifest.startDate,
  end_date: manifest.endDate,
  archived_at: manifest.archivedAt,
  source: manifest.source,
  counts: manifest.counts,
  dates: manifest.dates,
}], "season");

console.log(`supabase archive sync ok: ${season}, dates ${dateFiles.length}, starts ${rows.length}`);

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

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}
