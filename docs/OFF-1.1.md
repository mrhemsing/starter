# OFF-1.1: frozen homepage photography

The homepage and /2026 import TopPerformerCard, the Ranked Starts TopStartRow,
HeatCheckHero and the Recent Gems FeaturedStartHighlightEmbed. Award winners
use the existing Headshot component. The first three ranked rows get highlight
stills only when the existing pipeline resolves a video. Sanchez has no asset;
his row has no placeholder. The shared row has optional archive href/date props.

The immutable season review, canonical snapshot and recap are unchanged.
Presentation assets live in a separate frozen JSON manifest, produced explicitly
by scripts/freeze-season-review-media.mjs, not by page requests or builds.
The exact-game image resolver skips pitcher-level photo reuse, placeholders,
generated images and caches without MLB provenance. It does not overwrite
existing approved image metadata. The existing daily resolver defaults remain.

Conflict resolved in favor of the brief: the winning start's old local cache
points to a generated photo. It is excluded. The existing MLB game content
pipeline for gamePk 823778 resolves the official Misiorowski pitching image
qx3qhrxpo9wdyltgcz4w. The shared focal handling supplies desktop/mobile positions.
No image scraping or new source is introduced. The headshot-only fallback is
tested with an empty game-content fixture. Existing MLB-channel YouTube
highlights are preserved, with search disabled for the media freeze operation.

The root and home route-convention skeletons are removed so frozen HTML is
visible without JavaScript. In-season home retains its original loading shell
inside an explicit Suspense boundary after the season gate. Other route loaders
remain; Heat Check loading controls now own narrow query-dependent boundaries.
Loading and performance contracts assert this scoped policy change. Static
rendering and build-memory settings are unchanged.

Verification scripts:

- check-offseason-visuals.mjs: shared imports, provenance rejection, real
  no-asset resolution/rendering, all row/mover/award headshots, top-three cases.
- verify-offseason-visuals-dom.mjs BASE OUTPUT: raw HTML, JavaScript-disabled
  content, hero controls, decoded images, approved network hosts, focal styles,
  no overflow, repeat cache HIT, and 1440/390 snapshots for both changed pages.
- measure-offseason-lcp.mjs BASE OUTPUT: five fresh-context samples per width,
  40 ms latency, 10 Mbps download and 5 Mbps upload, reduced motion.
- Existing frozen-review, offseason, loading, image-reuse and five owner-required
  regression gates, TypeScript and production build.

Evidence is stored in workspace reports/OFF-1.1. Prior OFF-1 cron-secret and
published-history identity issues are separate and are not silently changed.
