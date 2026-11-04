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

The explicitly approved sweep covers the 2,205 unique gamePks in the frozen 2026 canonical receipt. Postseason membership comes from MLB schedule gameTypes F,D,L,W, not a guessed date boundary. Those 41 gamePks match 80 canonical starts.

Content is fetched once per game, with sequential requests spaced at least 750 ms, retry backoff for throttling/server failures, resumable response caching, and per-start outcomes. The existing OFF-1.3 resolveMlbGameContentHighlight is imported. The existing daily image resolver's selection and focal transformation are exposed as resolveMlbGameContentActionImageFromContent and imported, without a second selector. YouTube fallback imports the existing official-channel resolver and is permitted only for content-unresolved postseason starts or GS+ >= 70 starts. Other starts never trigger YouTube lookup.

Published exact-start references use the same FeaturedStartHighlight and TopPerformerImage shapes as the existing archive. Explicit null results prevent request-time rediscovery from silently masking an absent asset. The shared dated hero already supplies action-image, highlight modal, game-log and focal handling. The frozen season-review hero is not replaced.

Results and production verification will be recorded after the sweep and deployment.
