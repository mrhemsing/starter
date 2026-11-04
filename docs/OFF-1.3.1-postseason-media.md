# OFF-1.3.1: dated heroes and settled-start media

## Attribution diagnosis and sweep

The canonical Oct 28 record has Jacob Misiorowski, team MIL, opponent TB, side away. The dated hero payload passed team and opponent but omitted side. TopPerformerCard already imports the same startMatchupLabel used by RankedStartCard. Without side, the shared formatter cannot establish orientation and falls back to the opponent. Thus the apparent home-team binding was a missing-side payload bug, not corrupt canonical data.

The repair passes canonical side to the existing shared hero. Fixtures execute the actual dated payload builder and render both hero and ranked row: Misiorowski MIL @ TB (away), Rasmussen TB vs MIL (home).

Offseason surface sweep:

- Start of the Year already passes team, opponent and side into the shared TopPerformerCard.
- Top Starts uses the shared TopStartRow and its canonical orientation.
- Award start rows (no-hitter bids and biggest blowup) independently hard-coded vs. They now import startMatchupLabel.
- Arm awards, gem leaders and hottest-streak cards do not format matchup team labels.
- No frozen records, scores, lines, narrative copy or recaps are edited.

## Media scope and method

The explicitly approved sweep covers the 2,205 unique gamePks in the frozen 2026 canonical receipt. Postseason membership comes from MLB schedule gameTypes F,D,L,W, not a guessed date boundary. The schedule has 41 entries but only 40 unique gamePks: game 849817 appears once postponed on Oct 16 and once final on Oct 18. The 40 games match 80 canonical starts.

Content is fetched once per game, with requests globally spaced at least 500 ms (at most three in flight), retry backoff for throttling/server failures, resumable response caching, and per-start outcomes. The existing OFF-1.3 resolveMlbGameContentHighlight is imported. The existing daily image resolver's selection and focal transformation are exposed as resolveMlbGameContentActionImageFromContent and imported, without a second selector. YouTube fallback imports the existing official-channel resolver and is permitted only for content-unresolved postseason starts or GS+ >= 70 starts. Other starts never trigger YouTube lookup.

Published exact-start references use the same FeaturedStartHighlight and TopPerformerImage shapes as the existing archive. Explicit null results prevent request-time rediscovery from silently masking an absent asset. The shared dated hero already supplies action-image, highlight modal, game-log and focal handling. The frozen season-review hero is not replaced.

## Postseason results

All 80 starts in 40 distinct postseason games have exact-game content lookups. Shared selector repairs resolve 71 approved action photos and 75 content highlights; an existing successful official YouTube lookup resolves one additional highlight (76 total). Three completed YouTube misses remain explicit, and Shawn Armstrong on Oct 19 has a partial fallback blocked by a documented daily search quota error. This is not a no-highlight verdict.

The selector defects were (1) postseason strikeout clips tagged in-game-highlight with exact player/game IDs but without the pitching taxonomy, and (2) promotion checking action wording in the title but not the description, rejecting the Oct 28 scoreless-innings montage. The shared repair requires exact player/game identity for the new taxonomy branch, rejects interview copy, and uses the same action/focal policy for daily and backfill paths. No new media source is introduced. Visual QA caught a baked-in stat graphic and clipped mobile face in the Oct 28 reel thumbnail. Image selection now excludes unreviewed reel graphics and uses the clean individual-play pitching photo, while retaining the full montage as the highlight video.

The five initial action-image misses are AJ Blubaugh Sep 29, Anthony Kay Oct 5, Walker Buehler Oct 7, Hagen Smith Oct 8, and Shawn Armstrong Oct 19. Their exact-game feeds contain no qualifying pitching-action asset. Visual inspection additionally rejected unreviewed reel/stat graphics: Logan Henderson Oct 4, Drew Rasmussen Oct 12 and Oct 24, and Griffin Jax Oct 27 have logged no-approved-photo outcomes. Their highlight videos remain available. Hagen Smith has an official YouTube highlight but no approved action-image candidate. These outcomes and all source lookups are in 2026-postseason-media-log.json.

Dated-page cache keys now include a hash of the media manifest. This invalidates cached highlight lists when published references change, while keeping the existing final-slate cache policy intact. Existing curator crops and previously attributed highlight references remain preferred where appropriate.

## Approved full-season sweep

All 2,205 unique game-content responses succeeded and all 4,425 frozen final starts have per-start outcomes. No scheduled or fixture records were swept.

| Disjoint tier | Starts | Content highlights | Final highlights | Action photos | YouTube fallback attempts | Quota deferred |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Postseason | 80 | 75 | 76 | 71 | 5 | 1 |
| Regular-season GS+ >= 70 | 199 | 199 | 199 | 192 | 0 | 0 |
| Other regular-season starts | 4,146 | 3,823 | 3,823 | 3,621 | 0 | 0 |
| Total | 4,425 | 4,097 | 4,098 | 3,884 | 5 | 1 |

The regular-season gem diagnostic found an official MLB caption typo (Wrobelski for Wrobleski). The shared selector now recognizes an exact sole player ID with a matching first-name subject, without fuzzy matching or a parallel finder. Ambiguous-player and wrong-game fixtures fail selection. All 199 regular-season gems now resolve through game content.

`npm run check:postseason-media` passes coverage, shared selection, frozen-byte, attribution, cache and rendering contracts. `node scripts/check-season-media-sweep.mjs --require-complete` intentionally fails while the one quota-deferred fallback remains. This is an explicit incomplete discovery item, not an unavailable-highlight claim. The retry is scoped to Shawn Armstrong, gamePk 849815, Oct 19; use the stored per-game log for the canonical identifier and pending query.

Final production verification is recorded in the attached DOM/network results and snapshots.
