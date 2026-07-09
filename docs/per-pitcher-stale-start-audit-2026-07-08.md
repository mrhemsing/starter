# Per-Pitcher Stale Start Audit - 2026-07-08

Context: P0-6 investigated Bryan Woo missing his July 7, 2026 start at Miami. Heat Check global freshness was current, but Woo's Heat Check card and pitcher game log were stale.

## Root Cause

Confirmed cause: ingest/settle failure for the entire July 7 slate, not pitcher attribution and not P0-5 runtime_state batching.

Findings:

- MLB schedule for `2026-07-07` had `SEA @ MIA`, `gamePk 823847`, final.
- Away starter: Bryan Woo, `693433`.
- Home starter: Max Meyer, `676974`.
- Before the repair, `toetheslab_canonical_start_records` had no Woo rows for July 1 through July 8.
- Before the repair, July 7 had zero canonical rows and no `toetheslab_canonical_slate_states` row.
- July 4, 5, 6, and 8 had canonical rows, so this was a one-date settle gap rather than global form staleness.
- The Miami side was not correctly ingested either; because the whole July 7 slate was absent, there was no away-only home/away swap.

Mechanism:

- For past dates, `getRankedSlateContextForStarts` trusted the local archive schedule.
- The file archive currently stops at July 3.
- When warm-live-starts was called for July 7, the settled-date completion check saw no archived schedule, treated the slate as `0` games, and returned `no-live-or-final-games`.
- That early exit happened before `getDailySlate({ persistCanonical: true })`, so the MLB live schedule/gamefeed fallback never wrote July 7 canonical rows.

Fix:

- Settled dates now fall back to the recent live MLB schedule when archive/canonical state is missing or incomplete.
- Complete settled dates with archive/canonical coverage stay cheap and do not refetch the live schedule.
- Added `check:settled-start-integrity` with seeded guards for:
  - missing settled date fallback,
  - settled game missing one starter,
  - settled game with a misattributed starter,
  - pitcher behind a settled start he made.

## Data Repair

Ran the patched warm-live-starts path for `2026-07-07`.

After repair:

| Date | Canonical rows | Final starts | Games | Slate state |
| --- | ---: | ---: | ---: | --- |
| `2026-07-07` | 32 | 32 | 16 | complete |

Woo/Miami game after repair:

| Pitcher | ID | Start record | Team | Opponent | GamePk | Line | GS+ |
| --- | ---: | --- | --- | --- | ---: | --- | ---: |
| Max Meyer | 676974 | `2026-07-07-mia-sea-676974` | MIA | SEA | 823847 | 5 IP, 4 H, 2 ER, 2 BB, 4 K | 50 |
| Bryan Woo | 693433 | `2026-07-07-sea-mia-693433` | SEA | MIA | 823847 | 5 IP, 9 H, 3 ER, 1 BB, 5 K | 44 |

## Multi-Day Sweep

Canonical slate state after repair:

| Date | Rows | Finals | Games | State |
| --- | ---: | ---: | ---: | --- |
| `2026-07-04` | 30 | 30 | 15 | complete |
| `2026-07-05` | 30 | 30 | 15 | complete |
| `2026-07-06` | 16 | 16 | 8 | complete |
| `2026-07-07` | 32 | 32 | 16 | complete |
| `2026-07-08` | 30 | 26 | 15 | active at audit time |

No July 7 attribution swap was found. The missing Woo row was part of a full-slate missing canonical state.

## No P0-5 Regression

This fix does not touch runtime_state batching. The probable-confidence path still uses batched `key=in.(...)` reads, bulk upserts, and diff-before-write, and `check:supabase-egress` remains the guard.
