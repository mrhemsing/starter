# Performance Guardrail - 2026-07-08

Context: P1-13 rides with the Supabase egress fixes. P0-5 batched cron writes and P1-12 cached read-heavy routes. This guardrail confirms those changes preserve the intended performance model: compute and write in cron or settle jobs, then serve cached or stored results on page requests.

## Tolerance

- LCP must not regress by more than 10% on the same route, viewport, and network profile.
- TTFB and server response time on cached routes should improve or stay within 10% of baseline.
- CLS must not increase beyond the existing route budget. No caching change should introduce layout shift.
- Dynamic exceptions are `/watchlist` and `/live/[date]`; they must read the minimum live or user-specific data.

## Measurement method

Repeatable HTTP timing probe:

```bash
npm run build
npm run start -- -p 3155
$env:PERF_BASE_URL="http://127.0.0.1:3155"; npm run measure:performance-guardrail
```

The probe records cold and warm TTFB, total response time, response size, and available cache headers for:

- `/`
- `/starts/2026-07-06`
- `/heat-check`
- `/upcoming`
- `/live/2026-07-08`
- `/watchlist`
- `/pitchers/dylan-cease-656302`

Core Web Vitals source: Vercel Analytics is mounted in `src/app/layout.tsx`, so production LCP, CLS, and INP remain visible after deploy. Lighthouse can be run against the same `PERF_BASE_URL` and mobile profile when browser-based CWV lab numbers are needed.

## Before and after table

The hard pre-change deploy is not available in this local worktree after commits `025063e`, `56c1795`, and `593cdfc`. The baseline column below uses the last known behavior documented in the P1-12 read-path audit: forced-dynamic or request-path render for several key pages, plus per-item runtime_state confidence writes before P0-5. The after columns are captured by the repeatable local production probe above.

Measured locally against `http://127.0.0.1:3155` after `npm run build` and `npm run start -- -p 3155`, using `npm run measure:performance-guardrail` at `2026-07-09T02:35:35.895Z`.

| Route | Cache class after P1-12 | Baseline risk before P0-5/P1-12 | After local warm TTFB | After local warm total | CWV/RUM gate |
| --- | --- | --- | ---: | ---: | --- |
| `/` | CACHED, `revalidate = 60` | Dynamic shell could regenerate per visit, cached data underneath | 6 ms | 7 ms | Vercel Analytics LCP/CLS/INP |
| `/starts/2026-07-06` | CACHED, `revalidate = 60` | Ranked/start detail shell could regenerate per visit | 71 ms | 164 ms | Vercel Analytics LCP/CLS/INP |
| `/heat-check` | CACHED, `revalidate = 900` | Server watchlist cookie read and dynamic shell could scale with visits | 266 ms | 311 ms | Vercel Analytics LCP/CLS/INP |
| `/upcoming` | CACHED, `revalidate = 60` | Metadata and shell could rebuild more of the matchup board than needed | 55 ms | 130 ms | Vercel Analytics LCP/CLS/INP |
| `/live/2026-07-08` | MIXED live route | Intentionally live, short-cadence data | 21 ms | 23 ms | Vercel Analytics LCP/CLS/INP |
| `/watchlist` | UNCACHED per user | Intentionally user-specific, cookie-backed | 25 ms | 30 ms | Vercel Analytics LCP/CLS/INP |
| `/pitchers/dylan-cease-656302` | CACHED, `revalidate = 900` | Profile/form page could server-read follow state | 20 ms | 1687 ms | Vercel Analytics LCP/CLS/INP |

Notes:

- `/` returned `x-nextjs-cache: HIT` on the warm probe. Local Next does not expose Vercel `x-vercel-cache`; production verification should use the same route list with `PERF_BASE_URL=https://www.toetheslab.com`.
- `/heat-check` has a large response body, about 5.8 MB in the local probe, but warm TTFB stayed under 300 ms and the page no longer server-reads watchlist state.
- `/pitchers/dylan-cease-656302` has low warm TTFB but higher total response time from server-rendered profile output. The guardrail keeps this page on cached form/profile reads and prevents request-path generation or writes.

## Compute-write-read verification

The page request path now reads stored or cached results:

| Data product | Compute/write owner | Page read behavior | Guard |
| --- | --- | --- | --- |
| Form, band, direction, rank | settle and warm-live-starts path | Heat Check and pitcher pages read cached form leaderboards or pitcher form | `check:form-staleness`, `check:read-path-cache`, `check:performance-guardrail` |
| Probable confidence and runtime state | cron/live reconciliation with batched diff-before-write | Pages read cached runtime packets or confidence values | `check:supabase-egress`, `check:watch-confidence` |
| Upcoming writeups | `/api/cron/upcoming-writeups` | Upcoming pages read `readCachedRuntimeState` packets | `check:performance-guardrail` |
| Fantasy Coach | `/api/cron/fantasy-streaming-read` | Streamers page reads stored coach content or deterministic fallback | `check:fantasy-streaming-read`, `check:performance-guardrail` |
| GS+ proof examples | `/api/cron/home-gs-plus-proofs` | Homepage reads stored proof packet or documented fallback | `check:home-status`, `check:performance-guardrail` |
| Ranked starts, archive, best starts | slate settle, archive sync, cached services | Pages read scoped archive/canonical rows through `unstable_cache` | `check:site-performance`, `check:read-path-cache` |

`check:performance-guardrail` rejects page-path imports or calls that look like runtime generation, backfill, broad sync, OpenAI generation, Supabase writes, or direct upstream enrichment.

## Cache behavior

Cached routes use ISR or data-cache reads:

- Home, Upcoming, and ranked/start detail pages: `revalidate = 60`.
- Heat Check, Best Starts, Rotations, Streamers, and pitcher form pages: `revalidate = 900`.
- API routes used by client refreshes emit `Cache-Control: public, s-maxage=..., stale-while-revalidate=...`.
- Read-heavy services use tagged `unstable_cache`, and cron calls `revalidateTag(..., "max")` after data changes.

The stale-while-revalidate model means a revalidating visitor gets the cached response first while fresh data is rebuilt in the background. The visitor should not wait on a fresh PostgREST read unless they are the first request after a cache miss.

## Dynamic exceptions

- `/watchlist` remains `force-dynamic` because it is cookie-backed and user-specific. It still reads shared form data through cached services where possible.
- `/live/[date]` remains mixed by product need. It reads the live scoreboard cadence and must not do broad archive/runtime reads directly.

## Ongoing visibility

Vercel Analytics is mounted in `src/app/layout.tsx` through `<Analytics />`. Production Core Web Vitals and traffic regressions remain visible after future deploys. The contract check keeps this wiring installed.

## Commands

- `npm run check:performance-guardrail`
- `npm run measure:performance-guardrail`
- `npm run check:read-path-cache`
- `npm run check:site-performance`
- `npm run check:form-staleness`
