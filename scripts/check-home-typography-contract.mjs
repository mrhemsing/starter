import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const [
  globals,
  wrapSafeText,
  homePage,
  homeStatusLine,
  siteHeader,
  topPerformerCard,
  mustWatch,
  homeDeferredSections,
  heatCheckHero,
  pitchingDuels,
  rankedRecap,
  formPage,
  upcomingPage,
  watchlistPage,
  methodologyPage,
  leaderboardPage,
  pitchersPage,
] = await Promise.all([
  readFile("src/app/globals.css", "utf8"),
  readFile("src/components/wrap-safe-text.tsx", "utf8"),
  readFile("src/app/page.tsx", "utf8"),
  readFile("src/components/home-slate-status-line.tsx", "utf8"),
  readFile("src/components/site-header.tsx", "utf8"),
  readFile("src/components/top-performer-card.tsx", "utf8"),
  readFile("src/components/tonights-must-watch.tsx", "utf8"),
  readFile("src/components/home-deferred-sections.tsx", "utf8"),
  readFile("src/components/heat-check-hero.tsx", "utf8"),
  readFile("src/components/pitching-duels.tsx", "utf8"),
  readFile("src/components/ranked-starts-recap.tsx", "utf8"),
  readFile("src/app/form/page.tsx", "utf8"),
  readFile("src/app/upcoming/[date]/page.tsx", "utf8"),
  readFile("src/app/watchlist/page.tsx", "utf8"),
  readFile("src/app/methodology/page.tsx", "utf8"),
  readFile("src/app/leaderboard/page.tsx", "utf8"),
  readFile("src/app/pitchers/page.tsx", "utf8"),
]);

assert(
  globals.includes("text-wrap: balance;") && globals.includes("text-wrap: pretty;"),
  "global typography must use balance for headings and pretty for body copy",
);

assert(
  globals.includes("@media (max-width: 639.98px)") &&
    globals.includes("h1.font-serif") &&
    globals.includes("font-size: 2.4rem;") &&
    globals.includes("line-height: 1;"),
  "mobile page titles must match the homepage Every MLB start title size",
);

assert(
  globals.includes("@media (min-width: 640px)") &&
    globals.includes("h1.font-serif,\n  .section-title") &&
    globals.includes("margin-top: 24px;"),
  "desktop page and section titles must have 24px of top margin",
);

assert(
  siteHeader.includes("site-header-nav") &&
    siteHeader.includes("border-b border-white/10 pb-5") &&
    siteHeader.includes("<SiteNav active={active} today={today} rankedDate={rankedDate} />"),
  "site header must own the shared logo/nav hairline divider",
);

assert(
  [
    formPage,
    upcomingPage,
    watchlistPage,
    methodologyPage,
    leaderboardPage,
    pitchersPage,
  ].every((page) => page.includes("font-serif text-5xl font-black") && !page.includes("font-serif text-5xl font-black text-zinc-50 sm:text-6xl")),
  "standard page titles must use the same desktop text-5xl size",
);

assert(
  upcomingPage.includes('<span className="block">One card per game, ranked by starter form and matchup context.</span>') &&
    upcomingPage.includes('<span className="block lg:whitespace-nowrap">Probables are grouped head-to-head instead of duplicated by pitcher.</span>'),
  "upcoming page deck must force a break after the first sentence and keep the second sentence unwrapped on desktop",
);

assert(
  watchlistPage.includes('<span className="block">Follow starters from Heat Check or pitcher pages.</span>') &&
    watchlistPage.includes('<span className="block lg:whitespace-nowrap">This view joins your followed arms to current Form, next scheduled start, and digest-worthy events.</span>'),
  "watchlist page deck must force a break after the first sentence and keep the second sentence unwrapped on desktop",
);

assert(
  !watchlistPage.includes("Delivery status") &&
    !watchlistPage.includes("The digest payload is live in-app."),
  "watchlist page must not render the old delivery status provider-pluggable box",
);

assert(
  globals.includes(".meta-seg") && globals.includes(".stat-token") && globals.includes(".status-token") && globals.includes("white-space: nowrap;"),
  "global typography must include nowrap units for meta segments, stat tokens, and status tokens",
);

assert(
  wrapSafeText.includes("export function MetaLine") && wrapSafeText.includes("export function StartLineText"),
  "wrap-safe text helpers must expose MetaLine and StartLineText",
);

assert(
  homePage.includes("section-title") && homePage.includes("blurb"),
  "homepage masthead must opt into shared heading/body wrapping",
);

assert(
  homePage.includes('className="grid gap-5 py-4 lg:pb-0 lg:pt-5" data-responsive-check="home-masthead"'),
  "homepage masthead must remove desktop bottom padding while preserving desktop top padding",
);

assert(
  homePage.includes('<span className="block">Every MLB start,</span>') &&
    homePage.includes('<span className="block">ranked.</span>'),
  "homepage H1 must force a line break after the comma",
);

assert(
  homeStatusLine.includes("status-token block sm:inline") &&
    homeStatusLine.includes('Upcoming{"\\u00A0"}starts{"\\u00A0"}{"->"}'),
  "homepage status line must keep state text and the upcoming arrow link together",
);

assert(
  topPerformerCard.includes("<StartLineText line={line} />") &&
    topPerformerCard.includes("pitcher-name") &&
    !topPerformerCard.includes("const statLine ="),
  "top performer card must render visible stat lines and names with wrap-safe markup",
);

assert(
  mustWatch.includes("MetaLine") &&
    mustWatch.includes("StartLineText") &&
    mustWatch.includes("gameVenueLabel(game)") &&
    mustWatch.includes("watch rank") &&
    !mustWatch.includes("formatStartLine"),
  "must-watch cards must use segmented meta lines and tokenized visible stat lines",
);

assert(
  mustWatch.includes('compactTopPadding ? "pb-10 pt-4" : "py-10"') &&
    upcomingPage.includes("compactTopPadding"),
  "upcoming day must-watch section must use compact top padding without changing shared default spacing",
);

assert(
  homeDeferredSections.includes("StartLineText") &&
    homeDeferredSections.includes("MetaLine") &&
    homeDeferredSections.includes("pitcher-name"),
  "home best-start cards must use wrap-safe title, meta, and stat markup",
);

assert(
  heatCheckHero.includes("section-title") && heatCheckHero.includes("pitcher-name"),
  "heat check homepage module must use shared heading and name wrapping",
);

assert(
  pitchingDuels.includes("section-title") && pitchingDuels.includes("card-title") && pitchingDuels.includes("pitcher-name"),
  "pitching duels module must use shared heading/card/name wrapping",
);

assert(
  rankedRecap.includes("MetaLine") && rankedRecap.includes("StartLineText") && rankedRecap.includes("pitcher-name"),
  "ranked recap rows must use segmented meta and stat token markup",
);

console.log("home typography contract ok: headings, body copy, meta lines, stats, status links, and names use shared wrap-safe rules");
