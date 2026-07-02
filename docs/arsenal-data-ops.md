# Arsenal Data Ops

Pitcher arsenal panels are archive-backed first. The nightly job should refresh completed MLB gamefeed data after the slate is final, then sync the archive to Supabase so pitcher profiles read stored pitch events instead of calling live Savant or MLB gamefeed paths during page render.

## Nightly Run

Run the archive for the completed date range, validate it, then sync it:

```powershell
npm run archive:mlb-season -- --season=2026 --date=YYYY-MM-DD
npm run check:mlb-archive -- --season=2026 --expect-end=YYYY-MM-DD
npm run sync:supabase-mlb-archive
```

Use `THE_BUMP_ARCHIVE_CONCURRENCY=4` by default. Raise it only for a supervised backfill, and keep the run bounded by date when filling one missed slate.

## Rate Limits

The archive script reads the MLB schedule once for the date range and fetches one gamefeed per completed game with bounded concurrency. Failed gamefeeds are recorded on the date shard as an error and must not make page renders retry the upstream path.

Request-time Baseball Savant fallback is disabled by default to protect normal traffic and external rate limits. Use `THE_BUMP_REQUEST_TIME_SAVANT_PITCH_DETAIL=1` only for a supervised repair or diagnostic run; the normal path is archive first, then a pending/fixture pitch-detail state.

## Stale State

Pitcher pages surface the archive status only when the Arsenal panel has pitch data. When archived pitch events exist, the label shows `Archive through YYYY-MM-DD`; when fixture-backed pitch data is present, the label uses plain copy such as `More data after next archive run` instead of a pending placeholder module.

## Statcast Quality

See `docs/statcast-arsenal-quality-spike.md` for the split between archive-derived quality metrics that are available now and true Statcast contact-quality fields that require schema and backfill work.
