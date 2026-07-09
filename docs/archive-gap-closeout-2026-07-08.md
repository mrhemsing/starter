# Archive Gap Closeout - 2026-07-08

Context: P1-14 closes the root condition behind the Bryan Woo P0-6 incident. The P0-6 patch made recent settled dates recover through MLB live schedule and canonical rows, but the file archive still stopped at July 3 and the build kept logging archive-gap noise.

## Root Cause

Confirmed cause: the local file archive is an offline artifact, not a deployed daily writer.

- Current local manifest: `data/mlb-archive/2026/manifest.json`.
- Manifest stop date: `2026-07-03`.
- Manifest archived timestamp: `2026-07-04T05:45:53.641Z`.
- No deployed archive writer exists in `vercel.json`.
- No GitHub Actions workflow exists in this repo to run `npm run archive:mlb-season` or `npm run sync:supabase-mlb-archive`.
- The archive scripts write to `data/mlb-archive/[season]`, and `.gitignore` excludes `/data/mlb-archive`.

The archive stopped after the last manual local archive/sync run. Because the output is ignored and no scheduled writer maintains it, the file archive cannot be trusted as a production freshness authority.

## Decision

Decision: Option B, promote live/canonical to the primary recent-settled path and retire archive trust.

Rationale:

- The app already has a durable canonical store for settled starts.
- The P0-6 fix proved the live MLB schedule fallback can recover a settled date when archive/canonical state is missing or incomplete.
- The archive remains optional enrichment for historical completed-start reads, pitch details, pitcher arsenal/profile depth, and local backfill workflows.
- Nothing downstream should treat an empty or behind archive as proof that a settled slate has zero games.

## Archive Reader Map

| Reader | Purpose | Current policy |
| --- | --- | --- |
| `readSupabaseArchivedCompletedStarts(date)` | Ranked starts and start detail completed-start rows | Optional historical data source. Canonical overlay and live fallback protect recent settled slates. |
| `readSupabaseArchivedCompletedStartsRange(startDate, endDate)` | Heat Check, Best Starts, season/range boards | Cached historical read. Recent canonical rows fill archive lag for form freshness. |
| `readArchivedSchedule(date)` | Settled-date schedule shape | No longer authoritative when empty or incomplete. `shouldFetchSettledScheduleFallback` fetches MLB live schedule for recent settled recovery. |
| `readArchivedCompletedPitchingLines(date)` | Completed pitching-line overlay | Optional archive detail. Canonical/live gamefeed lines still settle rows. |
| `readArchivedStartPitchDetails(date, gamePk, pitcherMlbId)` | Start-detail pitch chart and arsenal events | Optional local pitch-detail enrichment. Missing local archive detail does not define slate existence. |
| `readArchivedPitcherSeasonProfile` / `readArchivedPitcherRecentArsenal` | Pitcher profile season line and arsenal cards | Optional enrichment with live/profile fallback. |
| `getSupabaseArchiveStatus` | Operational archive status | Diagnostic only. Warm jobs continue canonical settle/revalidation instead of deferring to archive freshness. |

## Code Policy

- Recent settled existence is canonical/live-first.
- Complete canonical settled dates stay cheap and do not fetch live data unnecessarily.
- Empty archive plus missing/incomplete canonical state triggers the live MLB schedule fallback.
- The form pipeline logs only if the canonical fold-in window is too small to cover recent settled dates. It no longer logs routine archive-gap noise when canonical rows cover the gap.
- The archive writer remains an offline maintenance tool. It is not a request-path or build-path authority.

## Chronically Ignored Warning Audit

Removed/reclassified:

- `[form-pipeline] recent canonical form gap`: removed from normal build output. A covered archive gap is not actionable.
- `[form-pipeline] archive gap exceeds canonical fold-in cap`: renamed to `[form-pipeline] canonical fold-in window exceeded...` so the warning is about the real visitor-facing freshness risk.

Still intentionally present:

- `[navigation-skeleton] ...`: route skeleton instrumentation, not a freshness warning.
- `[canonical-store] query ...`: request/read instrumentation, useful during egress audits.
- `[ranked-archive] file shard availability ...`: only emits when a settled-date context checks archive/canonical availability; its payload now includes `settledLiveFallbackGames`, making fallback behavior explicit.

## Incident Guard

P0-6 failure mode:

- Date: `2026-07-07`
- Archive schedule: empty
- Canonical slate state: missing
- Real MLB schedule: `16` final games

Expected behavior now: the completion/context path fetches the live MLB schedule, persists canonical starts through warm-live-starts, and does not report zero games just because the archive read was empty.

Pinned by:

- `npm run check:archive-gap-closeout`
- `npm run check:settled-start-integrity`
- `npm run check:form-staleness`
- `npm run check:supabase-egress`
