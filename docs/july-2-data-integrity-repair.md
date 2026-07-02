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

## Code guardrails

- MLB schedule and archive ingestion request `gameTypes=R` and drop non-regular-season games before storage.
- Pitcher profile game logs filter out non-regular-season starts.
- Heat Check qualification ignores non-MLB team codes instead of letting unknown teams qualify through a zero-game threshold.
- Canonical reconciliation now diffs and corrects GSv2, result, and venue, and strips source metadata from venue display fields.
- Starter-out live gamefeed lines can mark the canonical record final through `source.lineStatus`.
- Pitcher profile arsenals no longer fall back to the demo arsenal table; no real data means no arsenal module.

## Verification

- `npm run check:mlb-archive -- --season=2026 --expect-start=2026-03-25 --expect-end=2026-07-02 --min-starts=1`
- `npm run sync:supabase-mlb-archive -- --season=2026`
- Supabase canonical check: zero rows before `2026-03-25`; Misiorowski row is final, frozen, result `L`, venue `American Family Field`.
