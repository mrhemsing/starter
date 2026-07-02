# Loading State Policy

Initial navigation should render cached server HTML with page content already present; do not add page-level overlays, dimming, route skeletons, or spinner copy for idle slate pages. Skeletons or spinners belong only inside live-polling regions such as Live Board rows, provisional scores, warming states, and alert surfaces. New loading states need a short PR note explaining why the content cannot be server-rendered or served from the durable store/cache path.

Current audit: the remaining animated loading indicator is the Live Board status pulse in `src/components/live-scoreboard.tsx`, which sits inside the live-polling region.
