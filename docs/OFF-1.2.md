# OFF-1.2: field-test repairs

## Root cause, before implementation

Production Sep 27 had no completed-start archive rows or local schedule shard.
The date had aged beyond the 35-day live schedule fallback window.
`getDailySlate` seeded from those missing sources, then returned demo rows.
`readCanonicalizedStartSummaries` only overlays incoming rows; it does not add
canonical records missing from that seed. The page removed fixture rows, leaving
an empty list. Independently the completion chip used the stale canonical slate
expectation (30), and `isPast` alone labeled it complete. Schedule-based progress
said `no-games`, selecting the pre-slate off-day copy.

Phase 0 did NOT gate this read path. `guardSeasonWrite` occurs at canonical record
and slate-state write boundaries; the read functions have no season gate. The
sweep also checked start-service, form-service, archive reads, and integrity
monitoring. Form's offseason gate skips probable/next-start enrichment, not
settled form reads. Archive status adjusts its expected cutoff, not read access.
Season-flip fixtures exercise the real daily-slate read with identical records
under both flags and verify identical results with no write dependencies.

## Important acceptance conflict: Sep 27 is 28 real starts, not 30

Canonical contains 30 records: 28 final, plus TWO SCHEDULED FIXTURE records for
Baltimore at New York, gamePk 823490. The initial diagnostic counted 28 finals;
the later record inspection established the other two are scheduled, not live.
MLB's existing gamefeed reports `Cancelled: Rain`, statusCode CR, zero innings,
and no completed pitching lines. Therefore the candidate page renders 28 real
starts and `SLATE COMPLETE · 28 STARTS`. Rendering 30 would publish fabricated
fixture lines for a cancelled game. Neither canonical history nor the frozen
4,425-record season review was changed. Evidence includes the official response.
A separate seeded 30-real-start fixture passes, as does the 28-final plus two
scheduled-fixture negative control.

## Fix

- Archive reads use canonical records first under BOTH season states. The existing
  canonical-to-summary adapter was extracted unchanged from form-service and
  imported by both consumers, not forked. Scheduled fixture rows are excluded.
- Historical progress and chip counts use the same actual rows as the list.
  Past-date alone no longer implies completion. Offseason chips do not poll a
  different status source. Short outings render by default for slate completeness.
- Canonical settled-record dates, including postseason, are the shared archive
  source for default/date navigation and home/interstitial final-slate labels.
  The old navigation registry explicitly queried regular-season game type R,
  explaining Sep 27 versus Oct 28. Postseason is now browsable; true final slate
  is Oct 28. Off days inside the season range remain date-picker browsable.
- Offseason empty dates use season-framed off-day copy and no Upcoming CTA.
- Existing proxy date validation is preserved. Valid Live/Upcoming routes return
  flag-driven 302 to /. Fantasy /upcoming/streamers remains reachable. Flipping
  in_season restores route handling and six nav links; offseason has four.
- Newly surfaced archive heroes use the existing exact-game MLB asset option,
  rejecting generated or other-game action images and using headshots if absent.
- TopStartRow's existing HeatHighlightModal receives approved assets for ranks
  4, 5, 14, 20, 24. Top three keep their shipped cards. No placeholders or new
  media pipeline; approved first-three assets and hero image stay unchanged.

## Checks and limitations

Production build, TypeScript, targeted lint, required five regression checks,
form-staleness, build-memory, OFF-1 gates, OFF-1.1 imagery fixtures, frozen season
review hashes, and OFF-1.2 fixtures pass. DOM scripts cover both widths, redirects,
actual counts, four nav links, off-day framing, compact highlight dialogs, decoded
images, and OFF-1.1's extended approved-host network assertion.

Not an all-tests-green claim: supplemental `check:home-ranked` already fails on
unmodified a22e3c6 due to stale Must-Watch assertions. `check:starts-page` also
fails on unmodified a22e3c6 at its cron-date assertion. Relevant source assertions
were updated for the new cache/status behavior and existing OFF-1.1 headshot
fallback, but this supplemental check then reaches missing ignored archive fixture
files (`data/mlb-archive/2026/dates`). Baseline and current logs are retained.
No frozen expectations were weakened to manufacture a green result.
