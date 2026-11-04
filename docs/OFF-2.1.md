# OFF-2.1: archive design polish

## Source and reuse

The existing `teamLogoUrl` in `src/lib/team-metadata.ts` already returns `https://www.mlbstatic.com/team-logos/{id}.svg`. The live rotation board imports this helper and renders native SVG images. No raster replacement or new image host was necessary. All 30 URLs were fetched and checked for HTTP 200, `image/svg+xml`, an SVG root and absence of embedded raster images. The evidence includes every URL and response type.

Both archive surfaces still import `SeasonReviewTopStarts` and `SeasonReviewAwards`. Each Top Starts list item keeps its existing shared row and highlight component together. The shared CSS grid uses two equal columns at 1024px and above, normal row-major rank order, and one column below. Items align at their top rather than stretching short entries to match long cards. Existing top-five full cards and compact rows from rank six remain unchanged. Paired full-card covers have equal widths, aligned tops and 16:9 aspect ratios. The fifth full card intentionally remains a card beside the sixth compact entry; no placeholder fills the shorter unit.

The same `SeasonRotationRow` serves both award modules and the frozen standings board. The winner uses an 84px logo box, gold ring and hairline, a 240px ghost extending 54px beyond the right edge, 22% opacity, and clipped overflow. The ghost uses the same official SVG with a monochrome CSS filter, not a different asset. Foreground text is stacked above it. Standard preview rows use 56px SVG boxes and a fixed rank gutter. Expanded standings use 38px boxes and denser rows. Native disclosure and all 30 server-rendered rows are preserved; links still disable prefetch.

## Typography, rhythm and interaction

`ArchiveType` wraps numeric runs and recognized pitcher names without changing their text. Numeric values, dates, scores and microlines use the house mono family. Names and headings use the house serif family. Decorative ghost ranks are the explicit exception requested by the spec: they are serif, aria-hidden, and duplicated semantically in each link's accessible rank label. They are excluded from readable-numeral sampling, not passed off as mono.

The browser audit walks every visible text node in the Top Starts and awards sections, before and after expanding standings. All readable nodes containing digits must compute to the mono family. Names and titles are sampled separately for serif. Section and paired-column rhythm share `--archive-section-space: 24px`. Panels and rows share 1px hairlines and 4px radii. Linked units and rows expose a border or surface-lift hover state, verified by computed-style changes.

## Verification and freeze

The winner contrast test samples every text rectangle against the actual composited ghost background. It temporarily hides only the foreground for measurement, restores it, and captures final screenshots from the unmodified page. Thresholds are 4.5:1 for normal text and 3:1 for large text. Normal and genuine device-scale-factor-2 screenshots document the SVG ghost at both breakpoints.

No data, scores, recaps, notables, media references or canonical content is rewritten. All 15 tracked data files are byte-compared against the parent release and hashed. Top Starts text and rank identity are compared with the existing production baseline. Static/cache contracts and the 4096MB build ceiling remain in force. Production evidence contains both plain URL cache/build checks, raw server HTML, source/network assertions, typography and contrast samples, layout measurements, and requested screenshots at 1440 and 390.
