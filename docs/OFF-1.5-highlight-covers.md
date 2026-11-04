# OFF-1.5: uniform action-photo covers

## Shared implementation

FeaturedStartHighlightEmbed and HeatHighlightModal import HighlightCover. It uses the stored action photo, the daily hero's top-performer-image class, and the existing desktop/mobile focal positions. Every full or compact frame is 16:9, including a Short's frame. Video destinations and attribution remain independent of the cover. No thumbnail lookups run while rendering.

The season media adapters attach a small cover descriptor to each existing highlight. They do not send the full media inventory to the client. The original Start of the Year hero photo remains the cover for its start. An absent photo uses the stored video thumbnail at center 50% 50%, never an unrelated photo.

## Discovery and outcomes

The backfill imports resolveMlbGameContentActionImageFromContent, resolveMlbGameContentHighlight and resolveYouTubeHighlight. It covers the union of 41 featured starts and 80 postseason starts: 119 unique starts across 78 games. Existing successful exact-game responses are reused; new requests use the shared 500ms limiter. No season-wide or bulk YouTube sweep.

110 action photos are available. All 41 featured starts, including all Top 25, have photos. Nine postseason starts have no approved photo; four have no highlight surface, while five use the logged video-thumbnail fallback. Each has an exact-game HTTP 200 receipt and diagnostic. Rejected montage/stat graphics remain rejected. A shared caption gap for 'completes shutout' was repaired, resolving Alcantara through the existing approved photo selector.

Three vertical references now use standard MLB game-content videos: Sale August 27, Skenes May 12, Rasmussen October 3. Sale selects the full 11-strikeout reel, not merely the final strikeout. Shared discovery now prefers full pitching reels before individual plays, and validated longer YouTube candidates before short-form candidates instead of awarding a short-duration bonus. Duration is a discovery heuristic, not proof of orientation; the selected MLB videos are checked for actual 16:9 video dimensions.

Hagen Smith October 8 retains the only player-specific official result found by both shared YouTube queries, an 8-second fielding moment. No standard pitcher highlight was returned. Its exact title, duration, all query receipts, and retained destination are in the relink log. This is not represented as a standard pitching reel.

Photo and relink receipts: data/season-reviews/2026-highlight-cover-log.json. Historical OFF-1.3 logs remain intact; its regression check recognizes explicitly logged OFF-1.5 supersessions.

## Header and verification

The offseason homepage reuses public/images/header-baseball-bg-desktop.jpg. It is decorative with empty alt, top-right aligned in reserved space beside the season heading. No new art asset.

check-highlight-covers.mjs checks all 119 lookup outcomes, source hosts, all featured photos, fallback counts, Sale's full-reel replacement, Short/standard 16:9 fixtures, center fallback and shared focal classes. It also verifies standard-first YouTube selection and immutable canonical/review/receipt hashes.

verify-highlight-covers-dom.mjs checks every archive frame, decoded cover URL and computed focal position, frozen row text, approved main-document image requests, header src/alt/non-overlap, and five actual player destinations including Sale and Cease. Embedded YouTube player's internal requests are distinct from the site's cover requests; iframe sources are checked against the approved stored destination. Screenshots are captured without DOM styling overrides or query strings at 1440 and 390.

Frozen scores, lines, recaps, notables, ranking, copy and static cache configuration are unchanged. Only presentation media records, selection policy and rendering are changed.
