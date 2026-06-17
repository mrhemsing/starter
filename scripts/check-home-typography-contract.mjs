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
  topPerformerCard,
  mustWatch,
  homeDeferredSections,
  heatCheckHero,
  pitchingDuels,
  rankedRecap,
] = await Promise.all([
  readFile("src/app/globals.css", "utf8"),
  readFile("src/components/wrap-safe-text.tsx", "utf8"),
  readFile("src/app/page.tsx", "utf8"),
  readFile("src/components/home-slate-status-line.tsx", "utf8"),
  readFile("src/components/top-performer-card.tsx", "utf8"),
  readFile("src/components/tonights-must-watch.tsx", "utf8"),
  readFile("src/components/home-deferred-sections.tsx", "utf8"),
  readFile("src/components/heat-check-hero.tsx", "utf8"),
  readFile("src/components/pitching-duels.tsx", "utf8"),
  readFile("src/components/ranked-starts-recap.tsx", "utf8"),
]);

assert(
  globals.includes("text-wrap: balance;") && globals.includes("text-wrap: pretty;"),
  "global typography must use balance for headings and pretty for body copy",
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
