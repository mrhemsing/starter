# Ranked Starts date-gap audit

Audit date: 2026-07-30

## July 28 diagnosis

- Production `toetheslab_mlb_completed_starts`: 0 rows for 2026-07-28 and 0 rows for 2026-07-29.
- Production `toetheslab_canonical_start_records`: 32 rows for 2026-07-28 and 32 rows for 2026-07-29.
- July 28 canonical records were created on July 28 and reconciled/frozen after their games completed. Their IDs and stored `date` values remain July 28 even when finalization occurred after UTC midnight.
- Result: reconciliation succeeded and date bucketing is correct. The failing layer was the indefinite ranked-page/archive cache retaining an earlier zero-row read. No score backfill or GS+ recomputation was appropriate.

The cache versions were advanced so canonical rows are read into the page again. Valid scheduled dates with a genuine zero-row result now render an honest data-gap state instead of a not-found response.

## Season blast radius

The production canonical store was compared with the MLB regular-season schedule for 2026-03-25 through 2026-07-29:

- Scheduled dates: 124
- Dates with canonical rows: 124
- Scheduled dates with zero canonical rows: none
- Dates with fewer than two stored starts per scheduled game: 2026-05-05 (28/30), 2026-05-09 (28/30), 2026-05-23 (30/32), 2026-05-24 (30/32). These are not zero-date gaps and were left out of scope.

## Ongoing detection

The minute reconciliation job now checks the prior seven dates on every cycle. A scheduled date with zero settled canonical starts logs a hard `[settled-slate-integrity]` error with the affected date and scheduled game count.
