# Homepage request-path audit

Audit date: 2026-07-30

## Current assembly

The homepage previously declared `dynamic = "force-dynamic"` and awaited these branches on every render:

- `getSlateStartProgress`: reads the canonical/archive slate and calls the MLB schedule endpoint for the active date.
- `getRankedHome`: cached for 60 seconds. On a miss it reads slate completion, daily starts, the live scoreboard, featured-highlight metadata, action-photo metadata, and performer metrics. The slate/live branches can call MLB schedule, game feed, team context, and player endpoints.
- `getTonightMustWatch` for today and tomorrow: process-memory cached for 60 seconds. On a miss it reads MLB schedules, rolling form, odds snapshots, pitcher completeness, and game-time weather. Open-Meteo is called for outdoor parks. Extra MLB split/availability and live odds enrichment is also possible when `THE_BUMP_REQUEST_TIME_ENRICHMENT=1`.
- `getBestStartsHome`: cached for 60 seconds. On a miss it reads 7-day, 30-day, and season archives, then resolves highlights, action photos, and velocity. Archive gaps can fall back to MLB schedule/game data; request-time Savant pitch detail is gated by `THE_BUMP_REQUEST_TIME_SAVANT=1`.
- `getFormHome`: cached by the form data layer. On a miss it assembles rolling-form and league-temperature data from archived/canonical starts; MLB availability enrichment is gated by `THE_BUMP_REQUEST_TIME_ENRICHMENT=1`.
- `getLiveScoreboard`: cached for 30 seconds. On a miss it reads MLB schedule and live pitching lines and joins the must-watch projection data.
- `readHomeGsPlusProofs`: reads precomputed runtime state and falls back to frozen examples. Proof generation is already cron/write-time work.

Caching existed at individual service and fetch layers, but a cache miss could still fan out to MLB Stats API, Baseball Savant, and Open-Meteo while the dynamic homepage request waited.

## Chosen boundary

The homepage now uses event-driven ISR (`revalidate = false`) instead of per-request or interval-driven rendering. The existing minute cron performs the expensive reconciliation/warming work, invalidates the shared data tags, and calls `revalidatePath("/")` after changed slate data is persisted. This avoids query-string cache misses starting duplicate interval regenerations. Visitors receive the static/ISR shell; time-sensitive first-pitch copy continues to tick in `SlateCounts` from the server-provided `firstPitchAt` timestamp.

The service caches remain in place for the background regeneration path, and the `WarmingUp` route fallback remains unchanged.
