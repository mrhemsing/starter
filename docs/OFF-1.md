# OFF-1: offseason program

## Phase 0

The shared source is `src/lib/season-state.ts`. Runtime key `season-state`
overrides the code default. Default: season_complete, 2026, final slate
2026-10-28 (verified from the complete canonical slate-state table).
Reads are cached for five minutes. An invalid state fails closed to the default.
No 2027 opening date is assumed. No Phase 3 implementation is included.

Daily and minute crons retain their schedules and authentication. Eight routes
return before job work, with one skip log. Wire headlines ingestion is not
paused. Direct generation and form-warming entry points are also gated.
Canonical record and slate-state writes fail with an integrity error when the
season is complete. The integrity probe checks recent post-cutoff dates for
unexpected settled records, without fetching MLB schedules during winter.
Form's canonical fold-in window anchors at the final slate rather than moving
past it throughout winter. Reads still diagnose actual missing settled data.

Home reuses TopPerformerCard for the final slate's highest GS+ start. The movers
module is suppressed until Phase 1, as permitted by the brief. Watchlist retains
Wire and follows while removing impending-start framing. Heat Check defaults to
SEASON; TREND remains available with final framing. Upcoming, Fantasy, Live and
upcoming Duels show the common season-complete component.

### Baseline conflicts resolved

Untouched main 96f1a2a failed three required checks before implementation:

- read-path-cache referenced the former src/app/page.tsx path and expected a
  60-second homepage instead of the current statically cached homepage. The test
  now checks the actual route and its static caching. Dated Upcoming's missing
  60-second caching was restored.
- site-performance required a shared Next cache for Must-Watch but the service
  only had process-local caching. Restored the shared wrapper, retaining the
  existing TTL and cache tags.
- archive-gap-closeout and form-staleness expected a removed archive-status log.
  Their assertions now pin the actual unlocked canonical job path and absence
  of an archive-status prerequisite. Existing seeded integrity assertions remain.

### Verification

- `node scripts/check-offseason.mjs`: real route bodies, no job dependency calls,
  one skip line per cron, Wire still runs, quiet-night no alert, unexpected-settle
  failure and alert, in-season rearm.
- TypeScript and production build.
- Required settled-start-integrity, supabase-egress, read-path-cache,
  site-performance, archive-gap-closeout; also form-staleness and build-memory.
- `scripts/verify-offseason-dom.mjs BASE OUTPUT`: rendered text audit and
  1440/390 snapshots. Production evidence must be collected after deployment;
  a local pass is not a production claim.

## Phase 1 open metric naming conflict

Main has no MIN_QUALIFIED constant. The existing shared season qualification is
`seasonQualificationMinStarts(teamGamesPlayed)` using ceil(teamGamesPlayed / 16).
The owner has been notified; reuse this rule rather than inventing a threshold.
