# P1-5 Production Timing Evidence - 2026-07-02

Captured after deploy `8e03a60` with Supabase archive freshness reporting active.

## Archive Freshness

`/api/archive/status?date=2026-07-02`

- Expected last completed date: `2026-07-01`
- Supabase archive last date: `2026-07-01`
- Completed starts: `3316`
- Lag days: `0`
- Stale: `false`

## Main Page Timing

Measured with `curl -L -s -o NUL -w` against `https://www.toetheslab.com`.

| Route | Status | TTFB | Total | Bytes |
| --- | ---: | ---: | ---: | ---: |
| `/` | 200 | 0.486s | 0.507s | 482420 |
| `/starts/2026-07-01` | 200 | 0.322s | 0.485s | 674562 |
| `/heat-check` | 200 | 0.434s | 0.563s | 997612 |
| `/heat-check/season` | 200 | 0.390s | 0.530s | 549598 |
| `/upcoming` | 200 | 0.225s | 0.418s | 589851 |
| `/upcoming/2026-07-02` | 200 | 0.201s | 0.290s | 614733 |
| `/live/2026-07-02` | 200 | 0.185s | 0.237s | 81793 |

## Result

All probed main routes met the P1-5 cold/warm TTFB target of under 600 ms in this deployed snapshot.

## Post Skeleton Removal Check

Captured after deploy `4d2ff7c`, which removed the interim route-level skeletons.

HTML probes for `/`, `/starts/2026-07-01`, `/heat-check`, `/heat-check/season`, `/upcoming`, `/upcoming/2026-07-02`, and `/live/2026-07-02` returned HTTP 200 with no legacy loader markers:

- `LOADING PAGE`
- `FETCHING DATA`
- `Loading cached page`
- `data-skeleton-layout`

Second timing pass:

| Route | Status | TTFB | Total | Bytes |
| --- | ---: | ---: | ---: | ---: |
| `/` | 200 | 0.429s | 0.451s | 474963 |
| `/starts/2026-07-01` | 200 | 0.481s | 0.630s | 643683 |
| `/heat-check` | 200 | 0.342s | 0.541s | 972249 |
| `/heat-check/season` | 200 | 0.382s | 0.451s | 507870 |
| `/upcoming` | 200 | 0.300s | 0.433s | 550349 |
| `/upcoming/2026-07-02` | 200 | 0.317s | 0.341s | 551105 |
| `/live/2026-07-02` | 200 | 0.392s | 0.396s | 72762 |

All routes remained under the 600 ms P1-5 TTFB target after route-level skeleton removal.
