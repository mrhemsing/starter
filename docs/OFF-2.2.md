# OFF-2.2: mobile award person rows

## Audit and reuse

The Arm of the Year podium and Hottest Streak were the two stacked award headshot treatments in `season-review.tsx`. Gem Leaders, bids and Biggest Blowup already render headshots beside details and retain their existing layout. Both archive surfaces import these same award components.

`AwardPersonLayout` imports the existing `Headshot` and wraps the existing content once. Below 1024px it applies the house row conventions: fixed, non-shrinking portrait, 12px gap, centered alignment and a `min-width: 0` text column. These conventions match the Watchlist row skeleton's `gap-3` and constrained text column, and Heat Check's non-shrinking portrait and constrained name block. The award portrait is 64 by 80px. No image source or asset changes.

Rank and name share a compact baseline row. Names remain serif and wrap within their column; ranks, stats and qualification remain mono. The podium uses one column below 1024px. Hottest Streak reuses the same responsive layout for its existing date and link without changing its copy.

At desktop, the new wrappers use `display: contents`, preserving the original layout and margins. The podium still has three columns. There is no mobile component fork or client-side breakpoint code.

## Acceptance

The browser verifier compares every affected section's text against production OFF-2.1 and requires exact pixel equality for Arm, Gems and Streak at 1440 on both surfaces. At 390 it requires each entire podium card, including border and padding, to be at most 120px high; the three cards plus gaps must fit within 400px. It checks portrait/text orientation, no horizontal overflow and a Jacob Misiorowski fixture with unchanged portrait dimensions. Both the normal full podium and long-name fixture are captured.

All 15 tracked frozen data files are byte-compared with `c5ce5ac`. Production is checked using plain URLs. The desktop baseline screenshots are included with the test evidence.
