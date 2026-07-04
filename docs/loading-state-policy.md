# Loading State Policy

Navigation paints within 100 ms: cached content is preferred, and the fallback is the destination shell plus scoped skeleton data regions. Frozen screens, blocking overlays, blurred previous pages, and full-page dimming are forbidden. Live regions keep their own polling loaders.

Skeletons mirror the destination rows and pulse only inside the data region that is not ready. Route-level `loading.tsx` files provide the coarse shell-first fallback for main routes while page-level Suspense boundaries can later narrow the skeleton to individual boards, tables, and modules.

Shell elements render exactly once outside the streamed/skeleton data boundary. Title, subtitle, nav, date controls, and other URL-derived chrome must not be duplicated between fallback and loaded trees. The fallback and content for a swappable data region share the same root wrapper class, and that wrapper owns top spacing with padding or a stable parent gap rather than differing child margins, so no shell pixel moves when skeletons swap to content.

Every navigation skeleton records a `[navigation-skeleton]` log with the route and in-process count so frequent misses are visible by route; a route that shows skeletons often is a caching/warmup signal, not the target state.

The same empty-slot rule applies to pending modules and chips: if a profile/card module lacks its minimum viable data, do not render a placeholder module.

Micro-mono type is reserved for eyebrows, chips, compact counters, and metadata. Any string that reads as a sentence renders at the standard body size, or one step below body size in dense panels. Empty-state copy, slate verdicts, and first-pitch sentences must not use label-scale type.

Current audit: route-transition overlays remain absent. Scoped route-control pending is allowed only inside affected data regions through `src/components/route-control-pending.tsx`; full-page dimming or blocking route overlays remain forbidden. The active non-live navigation fallback is `src/components/route-loading-shell.tsx`; live-polling indicators still live inside `src/components/live-scoreboard.tsx`.
