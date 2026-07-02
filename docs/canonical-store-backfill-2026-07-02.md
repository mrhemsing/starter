# Canonical Store Backfill Verification - 2026-07-02

## Scope

- Project: Toe the Slab
- Durable backend: Supabase Postgres
- Source: local MLB archive pipeline files under `data/mlb-archive/2026`
- Archive source: `mlb-stats-api`
- Archive range: `2026-03-01` through `2026-06-12`

## Schema Verification

Applied `docs/supabase-mlb-archive.sql` to Supabase through the Postgres pooler.

Canonical tables verified:

| Table | RLS | Policies |
| --- | --- | --- |
| `toetheslab_canonical_start_records` | enabled | service canonical starts read/write |
| `toetheslab_canonical_slate_states` | enabled | service canonical slate read/write |
| `toetheslab_canonical_pitcher_season_aggregates` | enabled | service canonical aggregates read/write |

No public policies were added. Access is via service role policies only.

## Backfill Verification

The canonical start records were rebuilt from the archive pipeline source, not from `/tmp` or any canonical cache.

| Check | Result |
| --- | ---: |
| Manifest starts | 2800 |
| Backfilled canonical starts | 2800 |
| Dates verified | 104 |
| Pitcher season aggregates | 406 |
| Per-date count mismatches | 0 |

Table counts in the archive range:

| Table scope | Rows |
| --- | ---: |
| `canonical_start_records_in_archive_range` | 2800 |
| `canonical_slate_states_in_archive_range` | 104 |
| `canonical_pitcher_season_aggregates_for_season` | 406 |

## Notes

- The first verification pass found pre-existing canonical rows on four archive dates, so the canonical tables were cleared only for the archive date range and rebuilt from pipeline source files.
- After the clean rebuild, every manifest date matched its expected start count.
- The local direct Supabase DB host resolved only over IPv6 from this environment, so the schema and backfill used the Supabase pooler host over IPv4.
