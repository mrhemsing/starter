const apply = process.argv.includes("--apply");
const season = process.argv.find((arg) => arg.startsWith("--season="))?.split("=")[1] ?? "2026";
const baseUrl = process.env.THE_BUMP_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.THE_BUMP_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.THE_BUMP_SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SECRET_KEY;
if (!baseUrl || !serviceKey) throw new Error("Supabase canonical-store credentials are required");

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
const url = new URL("/rest/v1/toetheslab_canonical_start_records", baseUrl);
url.searchParams.set("select", "date,start_id,game_pk,record");
url.searchParams.set("date", `gte.${season}-01-01`);
url.searchParams.append("date", `lte.${season}-12-31`);
url.searchParams.set("order", "date.asc");
const rows = [];
for (let offset = 0; ; offset += 1000) {
  const response = await fetch(url, { headers: { ...headers, Range: `${offset}-${offset + 999}`, Prefer: "count=exact" } });
  if (!response.ok) throw new Error(`canonical read failed: ${response.status} ${await response.text()}`);
  const page = await response.json();
  rows.push(...page);
  if (page.length < 1000) break;
}
const missing = rows.filter((row) => !row.record?.side);
const gamesByDate = new Map();
const backfilled = [];
const underivable = [];

for (const row of missing) {
  if (!gamesByDate.has(row.date)) {
    const scheduleUrl = `https://statsapi.mlb.com/api/v1/schedule?sportId=1&gameTypes=R&date=${row.date}&hydrate=team`;
    const scheduleResponse = await fetch(scheduleUrl);
    if (!scheduleResponse.ok) throw new Error(`MLB schedule read failed for ${row.date}: ${scheduleResponse.status}`);
    const payload = await scheduleResponse.json();
    gamesByDate.set(row.date, (payload.dates ?? []).flatMap((date) => date.games ?? []));
  }
  const game = gamesByDate.get(row.date).find((candidate) => Number(candidate.gamePk) === Number(row.game_pk));
  const home = game?.teams?.home?.team?.abbreviation;
  const away = game?.teams?.away?.team?.abbreviation;
  const side = row.record.team === home ? "home" : row.record.team === away ? "away" : null;
  if (!side) {
    underivable.push(row.start_id);
    continue;
  }
  const at = new Date().toISOString();
  const record = {
    ...row.record,
    side,
    updatedAt: at,
    audit: [...(row.record.audit ?? []), { at, event: "final-correction", source: row.record.source?.line ?? "archive-gamefeed", note: `Backfilled side metadata from MLB schedule home/away fields: ${side}. Scoring fields unchanged.` }],
  };
  backfilled.push({ id: row.start_id, date: row.date, side, source: "mlb-schedule" });
  if (apply) {
    const patchUrl = new URL("/rest/v1/toetheslab_canonical_start_records", baseUrl);
    patchUrl.searchParams.set("start_id", `eq.${row.start_id}`);
    const patchResponse = await fetch(patchUrl, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ record, updated_at: at }) });
    if (!patchResponse.ok) throw new Error(`canonical write failed for ${row.start_id}: ${patchResponse.status} ${await patchResponse.text()}`);
  }
}

console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", season, scanned: rows.length, missingSide: missing.length, backfilled: backfilled.length, underivable: underivable.length, underivableIds: underivable, records: backfilled }, null, 2));
if (underivable.length) process.exitCode = 2;
