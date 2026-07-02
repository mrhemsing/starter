# Loading State Policy

Initial navigation should render cached server HTML with page content already present; do not add page-level overlays, dimming, or spinner copy for idle slate pages. Route-level `loading.tsx` skeletons are allowed only as an interim while the P1-5 timing gate is unmet, and skeletons or spinners otherwise belong only inside live-polling regions such as Live Board rows, provisional scores, warming states, and alert surfaces. New loading states need a short PR note explaining why the content cannot be server-rendered or served from the durable store/cache path.

Current audit: the remaining animated loading indicator is the Live Board status pulse in `src/components/live-scoreboard.tsx`, which sits inside the live-polling region.
