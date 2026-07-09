# Supabase Egress Audit - 2026-07-08

Context: Supabase logs showed PostgREST egress dominated by `toetheslab_runtime_state` requests and `toetheslab_mlb_completed_starts` reads. This audit covers server and cron paths in this repo after the egress fixes.

| Path or job | Tables | Access pattern after fix | Columns and filters | Frequency | Egress risk |
| --- | --- | --- | --- | --- | --- |
| MLB probable confidence transition logging in `mlb-stats-client` | `toetheslab_runtime_state` | Batched `key=in.(...)` read for all game sides, one bulk upsert for changed rows only | `select=key,value`; keys are `probable-confidence:{gamePk}:{side}` | Runs when live schedule is fetched inside cached slate assembly | Low. Full slate is 1 read request and 0 or 1 write request instead of one read plus one write per side. |
| `warm-live-starts` progress, lock, lifecycle, home leader | `toetheslab_runtime_state` | Single coarse state rows, diffed where applicable by signature/progress step | One key per slate/progress state | Every minute via Vercel, guarded by overlap lock | Medium but bounded. Writes are coarse-grained lifecycle/progress, not per pitcher. |
| No-hitter alert state | `toetheslab_runtime_state` | One date-level state row from guarded warm-live path | One key per date | Existing live cron cadence | Low. No page-render writes. |
| Odds snapshots | `toetheslab_runtime_state` | One date-level snapshot row, skipped while fresh | One key per date | Daily pre-first-pitch cron | Low. |
| Upcoming writeups | `toetheslab_runtime_state` | One date-level LLM writeup row, reused by input hash | One key per date | Six-hour cron | Low. |
| Fantasy Coach | `toetheslab_runtime_state` | One week-level coach row, reused by input hash | One key per week | Six-hour cron | Low. |
| Watchlist headlines | `toetheslab_runtime_state` | Per-followed-pitcher headline rows plus breaker/cache rows | One key per pitcher/source | Half-hour cron, PT-aware source window | Medium. External fetch bound, but still per followed pitcher. Keep watched if follow list grows. |
| Home GS+ proofs | `toetheslab_runtime_state` | One stored proof packet | One fixed key | Daily cron | Low. |
| Archive reads from `supabase-archive` | `toetheslab_mlb_completed_starts`, archive manifests, arsenal, highlights | Column-scoped REST reads, cached with Next revalidate | Completed starts select only `date,game_pk,game_date,venue,away_team,home_team,pitcher_mlb_id,pitcher_name,team,opponent,side,result,line`; filtered by date or range | Page/API demand, absorbed by 15-minute data cache and half-month range chunks | Low after `025063e`. Avoid reintroducing `select=*` or full-season cache items. |
| Canonical start store | `toetheslab_canonical_start_records`, slate state | Cached canonical reads, write-on-settle path | Date-filtered canonical records | Render demand plus settle cron | Medium-low after `025063e` cache TTL. |

Top offenders found:

- `probable-confidence` was still doing a read-one/write-one loop against `runtime_state` for every game side. Fixed by batched read, diff-before-write, and one bulk upsert.
- `mlb_completed_starts` had already been narrowed and cached in `025063e`; no `select=*` fallback remains.

Before/after estimate:

- Runtime confidence loop before: up to 2 PostgREST requests per active game side per schedule fetch. A 15-game slate could issue roughly 60 runtime-state requests per fetch, multiplied by concurrent cached-page misses or cron calls.
- Runtime confidence loop after: one batched read request and, only if any value changed, one bulk write request for the full slate. Unchanged slates write zero rows.
- Completed starts before `025063e`: broad archive reads could pull repeated large JSON payloads. After: date/range-filtered explicit columns, cached slate reads, half-month season chunks.

Guardrails:

- `npm run check:supabase-egress` pins runtime-state batching, diff-before-write, completed-start column scoping, half-month archive caching, and absence of recurring backfill cron entries.
- The probable-confidence path logs `readRequests`, `writeRequests`, `rowsRead`, `rowsWritten`, and warns if a slate exceeds the runtime-state slot ceiling.
