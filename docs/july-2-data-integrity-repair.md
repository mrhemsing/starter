# July 2 data integrity repair

Date: 2026-07-02

## Scope

This repair addressed the full-site review P0 trust bugs before continuing the enriched Statcast product lane.

## Repairs

- Regular-season archive rebuilt from MLB `gameTypes=R`, covering `2026-03-25` through `2026-07-02`.
- Removed 24 pre-regular-season local archive shards from `data/mlb-archive/2026/dates`.
- Synced the rebuilt archive to Supabase: 100 date files, 2,616 starts, 213,690 pitch events.
- Removed 708 pre-regular-season rows from `toetheslab_mlb_completed_starts`.
- Removed 708 pre-regular-season rows from `toetheslab_canonical_start_records` and 24 pre-regular-season slate-state rows.
- Reconciled the July 2 Jacob Misiorowski canonical record to final state with official archive fields: result `L`, venue `American Family Field`, line status `final`.
- Kept GSv2 on the official Tango formula, including total runs and home runs. The July 2 Misiorowski GSv2 remains 43 because MLB's official final box has 5 total runs and 2 home runs.
- Re-centered post-purge GS+ form calibration after removing spring starts.

## Code guardrails

- MLB schedule and archive ingestion request `gameTypes=R` and drop non-regular-season games before storage.
- Pitcher profile game logs filter out non-regular-season starts.
- Heat Check qualification ignores non-MLB team codes instead of letting unknown teams qualify through a zero-game threshold.
- Canonical reconciliation now diffs and corrects GSv2, result, and venue, and strips source metadata from venue display fields.
- GSv2 contract fixtures now anchor the formula to external July 2 lines, including the total-runs/HR Misiorowski case.
- Form debug checks assert the post-purge league mean GS+ remains centered near 50.
- Starter-out live gamefeed lines can mark the canonical record final through `source.lineStatus`.
- Pitcher profile arsenals no longer fall back to the demo arsenal table; no real data means no arsenal module.

## Verification

- `npm run check:mlb-archive -- --season=2026 --expect-start=2026-03-25 --expect-end=2026-07-02 --min-starts=1`
- `npm run sync:supabase-mlb-archive -- --season=2026`
- `node scripts/check-game-score-v2-contract.mjs`
- `npm run check:form-debug`
- Supabase canonical check: zero rows before `2026-03-25`; Misiorowski row is final, frozen, result `L`, venue `American Family Field`.
- Production warm cron after deploy: revalidated successfully for `2026-07-02`.
- Production form home after deploy: league mean GS+ `50`, 202 qualified pitchers.
- Production Heat Check Season probe: no `GBR`, `SAC`, or John Michael Bertrand.
