# WarmingUp shared loading-route inventory

Audit date: 2026-07-30

The codebase contains loading boundaries for:

- Homepage: `/(home)`
- Shared root fallback
- Ranked Starts and start detail: `/starts/[id]`, `/starts/[id]/[slug]`; `/starts/latest` redirects into the date route
- Heat Check: `/heat-check`, `/heat-check/season`
- Live: `/live/[date]`
- Upcoming: `/upcoming`, `/upcoming/[date]`, `/upcoming/week`, `/upcoming/week/[startDate]`, `/upcoming/streamers`
- Watchlist: `/watchlist`
- Pitcher pages: `/pitchers/[id]`, `/pitchers/[id]/form`
- Best Starts archive: `/best-starts`, `/best-starts/[month]`

All non-home boundaries render through `RouteLoadingShell`, which now adds the shared compact `WarmingUp` tunnel before retaining each route's existing controls and skeleton markup. The homepage continues to use the same component's full variant. The tunnel SVG and imperative pitch timeline exist only in `src/components/warming-up.tsx`.
