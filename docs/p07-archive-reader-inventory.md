# P0-7 archive reader audit

Starting point: `archive-gap-closeout-2026-07-08.md`. Current callers verified with a repository-wide `readArchived` / `readSupabaseArchived` search (attached as archive-readers.txt).

| Reader/caller | Consumer | Finding / policy |
| --- | --- | --- |
| form-service getQualifiedFormStarts -> getArchivedSeasonStartSummaries | Form leaderboard and pitcher summary/series | Archive history plus 14-day bounded canonical tail, not full-season canonical. A global current date does not establish individual completeness. Fix pitcher path only; Heat Check unchanged. |
| form-service buildPitcherSeasonFallbackStarts -> readArchivedPitcherSeasonProfile | Low-sample Form fallback | Archive wins before live profile. Pitcher page will bypass this fallback; leaderboard behavior unchanged. |
| start-service getPitcherDetail -> readArchivedPitcherSeasonProfile | Pitcher API season line, starts, skills, velocity and mix charts | Archived starts and season line override even a successfully fetched live profile. Replace primary statistics with canonical. |
| start-service getPitcherDetail -> Supabase/file recent arsenal | Pitcher pitch mix | Legitimate optional enrichment, but stale and recent-only. Approved MLB client has full pitch events; pursue stored full-season backfill. |
| start-service getStartDetail and profile-context helper | Individual start details, recent depth cards | Archive schedules, line summaries, pitch details and profile context are optional enrichment; canonical line/score overlay already exists. Keep frozen semantics. |
| start-service readCompletedStarts/readRangeCompletedStarts | Best Starts, historical boards, shared season summaries | Supabase/file archive reads remain. Daily canonical-first path protects settled slates; range consumers are not automatically complete. Inventory finding, outside pitcher-only mutation scope. |
| mlb-archive readDateArchive/readSeasonManifest wrappers | File schedules, summaries, season profiles and pitch events | Retired offline artifacts; never evidence of canonical absence. |
| supabase-archive readers and getSupabaseArchiveStatus | Stored archive enrichment and operational status | Optional enrichment / diagnostic; not season coverage authority. |
| API archive status/revalidate, archive and sync scripts | Operations | Explicit maintenance readers, not rendered-stat authority. |

The game log, trend and best/worst/streak in pitcher form/page all use `form.series`; the visible aggregate uses `form.summary.seasonStats`. Thus replacing only getPitcherDetail would not fix the incident.

Initial source discrepancy: final-only durable canonical had 19 Soroka starts, 104.0 IP through September 27. The approved MLB profile reports 116.0 IP across all appearances and 21 starts. June 13 and June 19 were absent from the settled set, not physically deleted: raw inspection found unfrozen live projections. See `p07-root-cause-and-repair.md` for the July 2 creation timestamps, league-wide repair and explicit relief scope. The brief's 22 count represents appearances, not starts.
