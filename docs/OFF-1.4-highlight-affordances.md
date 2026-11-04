# OFF-1.4: highlight affordance audit

Owner ruling: rows 1-5 use FeaturedStartHighlightEmbed by import. Rows 6-25 use HeatHighlightModal with a stored 16:9 thumbnail, 112px desktop / 80px mobile. No discovery, asset or cache-policy changes.

## Surface audit

- SeasonReviewTopStarts: same full-card component, boundary changed from 3 to 5. Compact rows use the shared modal through TopStartRow.
- Ranked Starts Recap and dated ranked rows: removed circular trigger styling; shared compact thumbnail replaces it.
- Season-review awards and no-hitter bids, pitcher-form start highlights, Heat Check: shared compact trigger now shows a thumbnail rather than a bare circle.
- TopPerformerCard: labeled rectangular Video highlights button retained. Its 56px play overlays are centered on large action photos, not in the ranked-row disclosure slot. They cannot be mistaken for a row expansion control.
- Recap detail: labeled VIDEO HIGHLIGHTS button retained, not a bare icon.
- Full highlight cards: whole thumbnail is the button; centered play overlay is inside the image, not a separate disclosure-shaped row control.

Compact buttons expose Watch highlight: pitcher, date wherever the start record is supplied, and Highlight · MLB / MLB on YouTube attribution as a tooltip. Heat Check's aggregate pitcher highlight retains the pitcher name without inventing a game date.

## Acceptance checks

- scripts/check-highlight-affordance.mjs: five cards, twenty compact thumbnails, names/dates/attribution, shared-card import, asset-less full-card and compact fixtures.
- scripts/verify-highlight-link-sample.mjs: ranks 4-8. Stored official-channel metadata matches pitcher and game-date publication window; live YouTube oEmbed confirms official MLB author and exact title. Includes Cease and Sale. No new search pipeline.
- scripts/verify-highlight-affordance-dom.mjs: plain /2026 and / at 1440/390, exact card boundary, 16:9 dimensions, decoded thumbnails, accessible names, approved image requests, modal opens, no horizontal overflow, frozen row text identical to pre-change production. Mobile compact row ceiling: 210px including the statistical line. Screenshots cover rows 4-7.
- Existing OFF-1.1, OFF-1.2 and OFF-1.3 regression checks preserve data hashes, shared components and static route contracts.

No score, line, recap, notable, ordering, asset reference, or cache configuration is modified.
