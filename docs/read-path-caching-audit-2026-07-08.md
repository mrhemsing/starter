# Read Path Caching Audit - 2026-07-08

Context: P1-12 follows the Supabase egress work. P0-5 reduced cron/write egress; this audit covers user-facing read paths and whether page traffic scales into PostgREST reads.

## Route audit

| Route | Classification | Rendering mode | Supabase/Postgres read path | Cache strategy | Notes |
| --- | --- | --- | --- | --- | --- |
| `/` | CACHED | ISR, `revalidate = 60` | Ranked home, form home, best starts, live board, must-watch, GS+ proofs | Page shell revalidates every 60s; data services use `unstable_cache` with 60s to 15m windows or stored runtime packets | Changed from `force-dynamic`; live board still uses its own short live cadence. |
| `/starts/[date]` ranked starts | CACHED | ISR, `revalidate = 60` | Archived completed starts, canonical slate state, highlights | Page shell revalidates every 60s; settled ranked data uses tagged `unstable_cache`; archive reads are date/range-scoped and column-scoped | Changed from `force-dynamic`; active slate freshness stays within one minute plus existing revalidation tags. |
| `/starts/[id]` start detail | CACHED | ISR, `revalidate = 60` | Start detail, archived pitch detail, highlight lookup | Page shell revalidates every 60s; underlying archive reads are cached and scoped | Same route file as ranked starts. |
| `/heat-check` | CACHED | ISR, `revalidate = 900` | Form leaderboard, slate schedule/live board, rotation schedule | Form data uses `unstable_cache` tagged with `HEAT_CHECK_CACHE_TAG`; page shell revalidates every 15m | Removed request-path cookie/read of watchlist IDs; follow stars hydrate client-side from `/api/watchlist`. |
| `/heat-check/season` | CACHED | ISR, `revalidate = 900` | Season form leaderboard and rotation data | Same cached form layer as Heat Check | Changed from `force-dynamic`. |
| `/rotations` | CACHED | ISR, `revalidate = 900` | Rotation leaderboard from cached form data | Existing route revalidation plus form `unstable_cache` | Already aligned. |
| `/upcoming`, `/upcoming/[date]` | CACHED | ISR, `revalidate = 60` | Must-watch slate, slate progress, context writeups | Page shell revalidates every 60s; must-watch and archive/canonical services use cached data | Changed from `force-dynamic`; query-filter variants are noindexed. |
| `/upcoming/week`, `/upcoming/week/[startDate]` | CACHED | ISR, `revalidate = 60` | Week must-watch data | Page shell revalidates every 60s; must-watch data service caches | Changed from `force-dynamic`. |
| `/upcoming/streamers` | CACHED | ISR, `revalidate = 900` | Streamer candidates and stored Fantasy Coach packet | Page shell revalidates every 15m; coach generation remains cron-only | Changed from `force-dynamic`. |
| `/live/[date]` | MIXED | Dynamic/live surface | Live scoreboard | Live data cache is intentionally short; `/api/live/[date]` revalidates at 30s | Dynamic by product need; keep minimal and live-scoped. |
| `/watchlist` | UNCACHED | `force-dynamic` | Per-user watchlist, followed IDs, live board, headline events | User-specific cookie route | Dynamic is justified because followed-set output is per user. |
| `/pitchers/[id]`, `/pitchers/[id]/form` | CACHED | ISR, `revalidate = 900` | Pitcher form, pitcher archive/profile, recent starts, Wire headlines | Form/profile data uses `unstable_cache`; page shell revalidates every 15m | Removed request-path cookie/read of watchlist IDs; follow button hydrates client-side. |
| `/best-starts`, `/best-starts/[month]` | CACHED | ISR, `revalidate = 900` | Archived season completed starts and highlights | Page shell revalidates every 15m; season archive reads are half-month cached chunks | Added explicit revalidation. |
| `/methodology`, `/how-it-works`, `/glossary`, `/tools`, `/parks` | CACHED | Static or static-like | None | No PostgREST read path | Mostly content pages. |
| `/teams/[abbr]`, `/duels`, `/duels/[date]`, `/leaderboard*` | MIXED | Static-like page with cached data services | Form/slate derived services | Existing data-service caching; not changed in this pass | Lower traffic and smaller data surfaces; keep under monitor. |

## Before and after read-path estimate

Before this pass, several high-traffic candidates were route-forced dynamic even though their data layer was cached. That meant page HTML could be regenerated per visit, and any uncached side read in the render tree, such as Heat Check's server watchlist lookup, scaled with page views.

After this pass, steady-state DB reads for cached routes should be revalidation-bound:

| Surface | Before per 1000 views | After per 1000 views |
| --- | --- | --- |
| Heat Check | Up to 1000 watchlist/runtime reads plus cached form misses by revalidation window | 0 server watchlist reads; form DB reads only on 15m revalidation or tag invalidation |
| Home | 1000 dynamic HTML renders, with cached data underneath | About one route regeneration per 60s cache window |
| Upcoming day/week | 1000 dynamic HTML renders, with cached data underneath | About one route regeneration per 60s cache window per route/query variant |
| Ranked Starts and start detail | 1000 dynamic HTML renders, with cached archive/canonical data underneath | About one route regeneration per 60s cache window |
| Best Starts | HTML render per request if uncached by platform defaults | About one route regeneration per 15m cache window |

The expected PostgREST egress reduction is mainly removing page-view-linear incidental reads and letting Vercel serve repeated route requests from cache. The large P0-5 runtime-state loop remains the dominant confirmed fix.

## Verification plan

- `npm run check:read-path-cache` pins route cache config for home, Heat Check, Upcoming, Starts, Best Starts, Streamers, Rotations, and Pitcher pages.
- The same check prevents Heat Check and Pitcher pages from importing `cookies()` or server-reading watchlist IDs.
- On Vercel, verify with:
  - `curl -I https://www.toetheslab.com/heat-check`
  - repeat after the first request and confirm `x-vercel-cache: HIT` or `STALE` followed by `HIT`.
  - repeat for `/starts/2026-07-06`, `/upcoming`, and `/best-starts`.
- Supabase verification: during a burst of repeated cached-route requests, PostgREST logs should not show one `toetheslab_mlb_completed_starts`, `toetheslab_canonical_start_records`, or `toetheslab_runtime_state` read per page view. Reads should cluster around revalidation misses.

## Dynamic routes left intentionally

- `/watchlist` is per-user and cookie-backed.
- `/live/[date]` and `/api/live/[date]` are live/provisional surfaces.
- Cron, admin, social image, sitemap, and API mutation routes remain dynamic by design.
