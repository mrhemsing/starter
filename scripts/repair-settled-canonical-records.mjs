import fs from "node:fs";

const CANONICAL_STARTS_TABLE = "toetheslab_canonical_start_records";
const APPLY = process.argv.includes("--apply");
const LIMIT = 1000;
const BANNED_VENUE_WORDS = /\b(canonical|context|fixture|slate|settle|stored|pipeline|cache|snapshot|source|implementation)\b/i;
const KNOWN_MLB_VENUES = new Set([
  "Angel Stadium",
  "American Family Field",
  "Busch Stadium",
  "Chase Field",
  "Citi Field",
  "Citizens Bank Park",
  "Comerica Park",
  "Coors Field",
  "Daikin Park",
  "Dodger Stadium",
  "Estadio Alfredo Harp Helu",
  "Fenway Park",
  "George M. Steinbrenner Field",
  "Globe Life Field",
  "Great American Ball Park",
  "Guaranteed Rate Field",
  "Kauffman Stadium",
  "Las Vegas Ballpark",
  "loanDepot park",
  "Minute Maid Park",
  "Nationals Park",
  "Oracle Park",
  "Oriole Park at Camden Yards",
  "Petco Park",
  "PNC Park",
  "Progressive Field",
  "Rate Field",
  "Rogers Centre",
  "T-Mobile Park",
  "Target Field",
  "Tropicana Field",
  "Truist Park",
  "Sutter Health Park",
  "UNIQLO Field at Dodger Stadium",
  "Wrigley Field",
  "Yankee Stadium",
]);

loadDotEnv();

const baseUrl = process.env.THE_BUMP_SUPABASE_URL ?? process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.THE_BUMP_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.THE_BUMP_SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SECRET_KEY;

if (!baseUrl || !serviceKey) {
  throw new Error("Supabase URL and service role key are required");
}

const rows = await readRows();
const scheduleVenuesByGamePk = await readScheduleVenues(rows);
const now = new Date().toISOString();
const diffs = [];
const repairs = [];
const invalidVenues = [];

for (const row of rows) {
  const record = row.record;
  if (record.status !== "final" && !record.frozen) continue;

  const expectedGameScoreV2 = calculateGameScoreV2(record.line);
  const scheduleVenue = scheduleVenuesByGamePk.get(record.gamePk);
  const expectedVenue = scheduleVenue && validateVenue(scheduleVenue) === null ? scheduleVenue : record.venue;
  const venueIssue = validateVenue(expectedVenue);
  const recordDiffs = [];
  const repairedContextSnapshot = record.contextSnapshot && expectedVenue
    ? { ...record.contextSnapshot, parkLabel: expectedVenue }
    : record.contextSnapshot;

  if (record.gameScoreV2 !== expectedGameScoreV2) {
    recordDiffs.push({ field: "gameScoreV2", before: record.gameScoreV2, after: expectedGameScoreV2 });
  }

  if (expectedVenue && record.venue !== expectedVenue) {
    recordDiffs.push({ field: "venue", before: record.venue, after: expectedVenue });
  }

  if (expectedVenue && record.contextSnapshot?.parkLabel && record.contextSnapshot.parkLabel !== expectedVenue) {
    recordDiffs.push({ field: "venue", before: record.contextSnapshot.parkLabel, after: expectedVenue });
  }

  if (venueIssue) {
    invalidVenues.push({ id: record.id, venue: expectedVenue, issue: venueIssue });
    if (!recordDiffs.some((diff) => diff.field === "venue")) {
      recordDiffs.push({ field: "venue", before: record.venue, after: "known MLB venue" });
    }
  }

  if (recordDiffs.length === 0) continue;
  diffs.push({ id: record.id, pitcherName: record.pitcherName, date: record.date, diffs: recordDiffs });
  if (venueIssue) continue;

  repairs.push({
    ...row,
    record: {
      ...record,
      gameScoreV2: expectedGameScoreV2,
      venue: expectedVenue,
      contextSnapshot: repairedContextSnapshot,
      updatedAt: now,
      audit: [
        ...(record.audit ?? []),
        {
          at: now,
          event: "final-correction",
          source: record.source?.line ?? "archive-gamefeed",
          note: repairAuditNote(record, recordDiffs),
          diffs: recordDiffs,
        },
      ],
    },
    updated_at: now,
  });
}

if (APPLY && invalidVenues.length > 0) {
  console.error(JSON.stringify({ invalidVenues }, null, 2));
  throw new Error("refusing to apply canonical repairs while venue validation failures remain");
}

if (APPLY && repairs.length > 0) {
  await upsertRows(repairs);
}

console.log(JSON.stringify({
  mode: APPLY ? "apply" : "dry-run",
  scannedRows: rows.length,
  diffRecords: diffs.length,
  repairedRecords: APPLY ? repairs.length : 0,
  invalidVenueRecords: invalidVenues.length,
  sampleDiffs: diffs.slice(0, 20),
}, null, 2));

async function readRows() {
  const allRows = [];
  for (let offset = 0; ; offset += LIMIT) {
    const url = new URL(`/rest/v1/${CANONICAL_STARTS_TABLE}`, baseUrl);
    url.searchParams.set("select", "date,start_id,game_pk,pitcher_mlb_id,status,frozen,record,updated_at");
    url.searchParams.set("order", "date.asc,start_id.asc");
    url.searchParams.set("limit", String(LIMIT));
    url.searchParams.set("offset", String(offset));
    const response = await fetch(url, { headers: supabaseHeaders(), cache: "no-store" });
    if (!response.ok) throw new Error(`canonical read failed ${response.status}: ${await response.text()}`);
    const batch = await response.json();
    allRows.push(...batch);
    if (batch.length < LIMIT) return allRows;
  }
}

async function readScheduleVenues(rowsToScan) {
  const dates = Array.from(new Set(rowsToScan.filter((row) => !row.record.venue || validateVenue(row.record.venue)).map((row) => row.date))).sort();
  const venuesByGamePk = new Map();
  for (const date of dates) {
    const url = new URL("https://statsapi.mlb.com/api/v1/schedule");
    url.searchParams.set("sportId", "1");
    url.searchParams.set("date", date);
    url.searchParams.set("hydrate", "venue");
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`MLB schedule venue read failed ${response.status} for ${date}: ${await response.text()}`);
    const payload = await response.json();
    for (const day of payload.dates ?? []) {
      for (const game of day.games ?? []) {
        if (typeof game.gamePk !== "number") continue;
        const venueName = game.venue?.name;
        if (typeof venueName === "string" && venueName.trim()) venuesByGamePk.set(game.gamePk, venueName.trim());
      }
    }
  }
  return venuesByGamePk;
}

async function upsertRows(rowsToRepair) {
  const url = new URL(`/rest/v1/${CANONICAL_STARTS_TABLE}`, baseUrl);
  url.searchParams.set("on_conflict", "date,start_id");
  for (let offset = 0; offset < rowsToRepair.length; offset += 200) {
    const batch = rowsToRepair.slice(offset, offset + 200).map((row) => ({
      date: row.date,
      start_id: row.start_id,
      game_pk: row.game_pk,
      pitcher_mlb_id: row.pitcher_mlb_id,
      status: row.record.status,
      frozen: row.record.frozen,
      record: row.record,
      updated_at: row.updated_at,
    }));
    const response = await fetch(url, {
      method: "POST",
      headers: { ...supabaseHeaders(), "content-type": "application/json", prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(batch),
    });
    if (!response.ok) throw new Error(`canonical repair upsert failed ${response.status}: ${await response.text()}`);
  }
}

function calculateGameScoreV2(line) {
  return Math.round(40 + inningsToOuts(line.inningsPitched) * 2 + line.strikeouts - line.walks * 2 - line.hits * 2 - line.earnedRuns * 3);
}

function inningsToOuts(inningsPitched) {
  return Math.round(inningsPitched * 3);
}

function validateVenue(venue) {
  const trimmed = venue?.trim();
  if (!trimmed) return "missing";
  if (BANNED_VENUE_WORDS.test(trimmed)) return "implementation vocabulary";
  if (!KNOWN_MLB_VENUES.has(trimmed)) return "unknown venue";
  return null;
}

function repairAuditNote(record, recordDiffs) {
  const fields = new Set(recordDiffs.map((diff) => diff.field));
  if (fields.has("venue") && fields.has("gameScoreV2")) {
    return "Settled canonical record repaired by batch audit: venue restored from MLB schedule data and GSv2 restored from the earned-run pitcher line.";
  }
  if (fields.has("venue")) {
    return "Settled canonical venue repaired by batch audit after context-at-settle pollution review.";
  }
  return record.id === "2026-07-02-mil-cin-694819"
    ? "Second manual repair after freeze-sweep regression review: GSv2 restored from the earned-run pitcher line and the settled-record validation gate now guards future writes."
    : "Settled canonical GSv2 repaired by formula-validation batch after the earned-run GSv2 guard was restored.";
}

function supabaseHeaders() {
  return {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
  };
}

function loadDotEnv() {
  if (!fs.existsSync(".env.local")) return;
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}
