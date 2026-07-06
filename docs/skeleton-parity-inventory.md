# Skeleton parity inventory

P3-13 inventory and migration notes.

## Prior loading surfaces

- `src/app/live/[date]/loading.tsx`: replaced generic eight-row list fallback with the real Live scoreboard module in loading mode. The fallback now resolves the current slate state server-side and renders pregame, scoreboard, or final recap structure.
- `src/app/starts/[id]/loading.tsx`: changed from a fixed eight-row fallback to a slate-count-aware ranked list fallback using the current slate count, with a documented median fallback of 28.
- `src/app/watchlist/loading.tsx`: changed from a fixed six-row fallback to a followed-count-aware fallback using the watchlist cookie when available, with a documented median fallback of 6.
- `src/app/heat-check/loading.tsx` and `src/app/heat-check/season/loading.tsx`: skeleton rows already live in the real Heat Check renderer file and keep the route shell, filter chrome, and row treatment.
- `src/app/upcoming*/loading.tsx`: upcoming card placeholders already live in the real Must-Watch card file and keep the same matchup-card grid.
- `src/components/route-loading-shell.tsx`: remains the shared route shell and shimmer primitive host for navigation fallbacks.

## Optional elements

- Live recap Tomorrow details and scatter point labels reserve structure but do not reserve exact text widths.
- Ranked Start rows preserve card count and card geometry; individual optional badges are represented by shimmer blocks.
- Watchlist followed rows preserve card count; signals and next-start optional details are represented by fixed card regions.

## Allowed skeleton primitive

- `route-shell-shimmer` remains the shared shimmer primitive.
- No standalone `*skeleton*` component file is allowed except `src/lib/navigation-skeleton-log.ts`, which is telemetry, not a layout approximation.
