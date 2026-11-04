# OFF-2: season awards and verified no-hitters

## Shared presentation

`SeasonReviewAwards` is imported by the homepage and the 2026 hub. Its six award components are ArmOfTheYear, RotationOfTheYear, NoHitterBids, GemLeaders, BiggestBlowup and HottestStreak. Homepage titles link to their existing hub anchors. Homepage order is hero, Top Starts, awards, Final Form.

The shared grid pairs Arm of the Year with No-Hitter Bids, and Gem Leaders with an independently stacked Biggest Blowup and Hottest Streak. Grid items align at the top, not stretched to equal heights. Panel padding is 16px on mobile and 24px on desktop; browser assertions require less than 40px of unused space inside each panel. Rotation and League Context remain full width. At widths below 1024px the grid becomes one column. Existing award copy is reused, except the bid count is computed to include the repaired missing bid. The two leading bids and the combined-no-hitter starter are visible first; remaining bids stay server-rendered in a native disclosure so the podium pairing stays compact.

The frozen rotation board and both award instances import SeasonRotationRow. It preserves the P3-18 rank, team, qualified-arm count and staff mean Form treatment. Five preview rows emphasize the winner. Native details contains all 30 standings rows in the original HTML. Links disable prefetch so disclosure does not cause a data request. The existing final standings page stays linked.

## Canonical and linescore audit

The audit starts from the frozen canonical receipt, not the supplied example. All 4,425 starts are final and frozen, spanning 2,205 distinct games. Every game has an official MLB linescore lookup and a per-game outcome in `data/season-reviews/2026-no-hitter-audit.json`. Zero-hit games additionally require pitching box-score verification, at least 27 defensive outs, multiple contributing pitchers, and a canonical starter matching the box score. Unknown or missing linescores fail the audit rather than imply absence. Individual qualification uses baseball outs conversion: at least 27 outs and zero hits. Other-length zero-hit complete games are reported separately.

Results: zero individual no-hitters; zero other-length zero-hit complete games; one combined no-hitter. Game 822899, May 25, Houston at Texas, has Texas at zero hits over nine innings. Tatsuya Imai supplied 6.0 IP, Steven Okert 1.0, Alimber Santa 2.0. All three had zero hits. Imai's canonical line agrees with both MLB box-score endpoints: 6.0 IP, 0 H, 0 ER, 4 BB, 2 K, 97 pitches. No assertion relies on the owner's supplied text.

## Missing notable diagnosis and correction

Imai's frozen canonical record had no narrative notables. The shared MLB parser's `completeInningsFromLine` divided the result of `inningsFromIP` by three, although that helper already returns innings, not outs. Six innings became two and failed the five-inning notable threshold. The conversion is repaired and covered at 5.0, 6.0, 6.2, 8.2 and 9.0. Replaying the actual May 25 game feed through the existing selector now returns six hitless innings. The old type also had no game-level combined-no-hitter field.

The verified combined event is published as an additive, source-linked notable. Frozen canonical and season-review bytes are not rewritten. The award list adds Imai's missing bid and tags it COMBINED NO-HITTER. The start-detail adapter supplies the same notable downstream. The season line computes individual and combined results, the deepest stored bid, dates and starter link from the audit and notables. Unknown seasons show an audit-unavailable line instead of claiming zero no-hitters.

Recap pages already use a deterministic template, not an LLM. That existing generator was extracted by import into `start-recap-copy.ts`. The one-time harness refuses a second regeneration. It checks live API fields against canonical, generates only Imai's corrected recap, and persists the result and input hash in `season-recap-corrections-2026.json`. Other recap outputs use the unchanged generator. No season-wide narrative regeneration was performed.

## Build and verification

P1-15 concurrency remains 2, minimum pages per worker 16, and no long-tail static generation is added. Build profiling uses a 4096MB Node heap ceiling and samples the build process tree. The clean build exposed pre-existing invalid Next route exports. Cron helper functions became private, the watchlist skeleton moved unchanged into a component import, and the Heat Check route now wraps its shared renderer with only valid page props. These changes preserve behavior and avoid disabling type checking.

The evidence bundle contains canonical query results, all per-game lookup outcomes, raw May 25 linescore/box score/game feed, one-time recap receipt, unit and regression output, build memory profile, plain URL cache/build evidence, and desktop/mobile production DOM results and screenshots. Browser assertions cover shared anchors, two-column baselines, panel padding, all server-rendered rotation rows, no fetch on expansion, verified no-hitter copy and linked tag, approved images, unchanged Top Starts text, and no horizontal overflow.
