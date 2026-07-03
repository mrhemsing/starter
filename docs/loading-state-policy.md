# Loading State Policy

Navigation paints within 100 ms: cached content is preferred, and the fallback is the destination shell plus scoped skeleton data regions. Frozen screens, blocking overlays, blurred previous pages, and full-page dimming are forbidden. Live regions keep their own polling loaders.

Skeletons mirror the destination rows and pulse only inside the data region that is not ready. Route-level `loading.tsx` files provide the coarse shell-first fallback for main routes while page-level Suspense boundaries can later narrow the skeleton to individual boards, tables, and modules.

Every navigation skeleton records a `[navigation-skeleton]` log with the route and in-process count so frequent misses are visible by route; a route that shows skeletons often is a caching/warmup signal, not the target state.

The same empty-slot rule applies to pending modules and chips: if a profile/card module lacks its minimum viable data, do not render a placeholder module.

Current audit: route-transition overlays and pending-event dispatchers remain absent. The active non-live navigation fallback is `src/components/route-loading-shell.tsx`; live-polling indicators still live inside `src/components/live-scoreboard.tsx`.
