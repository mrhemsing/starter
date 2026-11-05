# P0-7: complete pitcher profiles and official reconciliation

## Root cause

The profile had two independent completeness failures. Form used archive history plus a bounded recent canonical tail. The pitcher API explicitly preferred an archived profile over the official profile for season totals and game logs. A current global form-through date therefore did not prove full pitcher history. All profile stats now read the full settled canonical season. See the reader inventory and attached repository-wide callsite search.

Soroka's June 13 and June 19 starts were not deleted. Their durable audit records show creation on July 2 at 14:40:53.259Z and 14:40:56.240Z, respectively. Both had `source.line=live-gamefeed`, no final `lineStatus`, `status=live`, `frozen=false`, and `finalizedAt=null`. A July 18 side-metadata backfill did not settle them. The canonical factory classifies a live feed as final only when final status is propagated. They therefore disappeared from final-only season consumers without disappearing from storage.

This state predates the July 8 P0-6 both-starters/recent-settled fallback guard (`ec6faa6`) and P1-14 archive-trust retirement. Historical July 2 code contains paths that replace source metadata without preserving `lineStatus`. The stored audit establishes the unfinalized July 2 import; it does not identify an exact historical request or prove which source-replacing caller executed. No deletion is claimed. The July 8 repair protected recent slates, not a retroactive full-season settle sweep. Later scheduled/missing slates also exist, so the entire incident cannot be attributed solely to pre-guard dates.

## League-wide repair

The approved MLB Stats API season registry plus every canonical pitcher produced 380 pitchers. Each official game log was reconciled by pitcher ID and gamePk, with regular season and postseason game types R,F,D,L,W. The initial final-only source contained 4,425 records.

- 531 missing final starts across 202 pitchers: 490 stranded live projections, 11 scheduled projections, and 30 absent rows.
- Official lines, notables, context and scoring were prepared through the existing schedule/gamefeed client and `buildScheduledStarts` builder.
- 30 absent rows were inserted with conflict-ignore. The 501 unfrozen projections were finalized through the existing `upsertCanonicalStartRecord` / reconciliation path, with a conditional update requiring unfrozen, non-final, unchanged timestamps. Existing frozen rows cannot be changed by this maintenance entry point.
- All 4,425 pre-existing frozen records compare exactly equal before and after. No existing start recap or notable was regenerated. Only the 531 newly finalized starts received recap entries.
- A stricter count check found 18 duplicate-date aliases across nine games. Each pair has identical pitching lines and scores. The official game log identifies the actual game date. Both frozen records remain stored unchanged; a documented read projection selects the official-date record. There are 4,956 stored final records and 4,938 distinct starts.
- All 380 projected canonical start counts and game identities match official logs. The detailed list, new records, conditional-settle receipts, alias map and all-pitcher rendered sweep are separate evidence artifacts.

## Soroka and relief scope

Official game logs show 21 starts, not 22. Those starts total 112.0 IP through September 27. A September 9 relief appearance contributes 4.0 IP to the official 116.0 all-appearance total. The page says `21 starts · 112.0 IP as starter` and `4.0 IP in relief not included`. Relief is display-only context and never enters starts, scoring, form, or a new relief surface.

## Pitch mix

Path (a): the existing approved MLB client supplies pitch events. The stored arsenal backfill covers all 4,938 distinct starts and 380 pitchers, with per-start IDs and explicit date coverage. No archive refresh or request-time season backfill is required. The 264 newly discovered games were also checked for completed no-hitters; none were added. Existing individual/combined notables remain unchanged.

## Authorized derived review changes

The owner was informed before publication. Season count changes from 4,425 to 4,938. Arm podium identities remain Misiorowski, Schlittler, Sale, with updated starts and means. Two recovered starts enter the Top 25. Four additional individual bids increase the stored bid list from 14 to 18, or 15 to 19 including the existing combined-game overlay. Gem counts, rotation metrics, league average, distribution and dependent form aggregates change. Start of the Year, its frozen recap/highlight, and Hottest Streak are unchanged. Only affected explanatory copy and trace lists are updated through the existing deterministic copy packets. The correction receipt records old/new hashes and changed fields.

## Durable guard

The integrity suite tests rendered count, last-start date and starter IP against canonical, plus canonical game/count parity against official logs. Soroka, heavy/postseason Misiorowski and LTD Ohtani are rendered samples. Deliberately missing rendered and canonical starts fail with alerts, including in `season_complete`. The deployed cron runs nightly; the external nightly runner checks every official/canonical pitcher and the rendered samples and routes execution failures to the owner. No offseason skip applies.

Owner alert automation: `36a41cd6-b48a-463d-9503-0fe84cb22c9e`, daily 02:40 America/Los_Angeles, runs `scripts/run-nightly-pitcher-integrity.mjs` as a command without an agent. Successful runs are silent. The first failure alerts Matt's existing Sora Telegram destination, with a one-hour cooldown. The deployed sampled route also runs at 10:30 UTC. The nightly command must retain its repository checkout and configured environment file.

Heat Check code, cache version and qualification rules are unchanged. `/2026` changes only through the explicitly authorized repaired derived review. Pre-existing brittle static contract failures, if present, are reported separately from actual DOM regression evidence.
