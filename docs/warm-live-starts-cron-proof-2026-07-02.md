# Warm Live Starts Cron Proof - 2026-07-02

## Change

`/api/cron/warm-live-starts` now delegates to `runWarmLiveStartsJob` in `src/lib/data/warm-live-starts-job.ts`.

The route remains production-safe:

- Vercel production/preview ignores date overrides.
- Local development may pass `?date=yyyy-mm-dd` for full-slate simulations.
- The cron still has `maxDuration = 60`.

The job keeps the critical warm path inside budget:

- Revalidates shared data-change cache tags.
- Revalidates the home page, Heat Check, Ranked Starts date page, and pitcher form pages in batches.
- Warms global Heat Check leaderboards.
- Warms homepage ranked/top-performer data.
- Defers team-specific Heat Check warming by default, because full-slate team warming was the budget risk. It can be enabled explicitly with `THE_BUMP_WARM_TEAM_FORM_ON_CRON=1`.

## Local Full-Slate Simulation

Built production output, then ran:

```powershell
curl.exe -s -o - -w "`nstatus=%{http_code} ttfb=%{time_starttransfer}s total=%{time_total}s`n" "http://127.0.0.1:3031/api/cron/warm-live-starts?date=2026-07-01"
```

Result:

```json
{
  "warmed": true,
  "date": "2026-07-01",
  "liveGames": 0,
  "finalGames": 14,
  "totalGames": 14,
  "completedStarts": 28,
  "affectedPitchers": 28,
  "warmedTeams": 0,
  "deferredTeams": 28,
  "pitcherBatches": 4,
  "teamBatches": 0,
  "revalidated": true,
  "durationMs": 3943
}
```

Timing:

- Status: `200`
- TTFB: `4.001s`
- Total: `4.004s`

## Result

The cron completed a full 28-start archived slate simulation well under the 60-second route budget, without returning a 504.
