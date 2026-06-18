import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const packageJson = await readFile("package.json", "utf8");
const headshotComponent = await readFile("src/components/headshot.tsx", "utf8");
const pitcherPage = await readFile("src/app/pitchers/[id]/page.tsx", "utf8");
const pitcherFormPage = await readFile("src/app/pitchers/[id]/form/page.tsx", "utf8");

assert(
  packageJson.includes('"check:pitcher-pages": "node scripts/check-pitcher-page-contract.mjs"'),
  "package scripts must expose the pitcher page contract",
);

assert(
  headshotComponent.includes('export type HeadshotSize = "hero" | "xl" | "lg" | "md" | "sm" | "xs";') &&
    headshotComponent.includes('hero: "h-[112px] w-[75px] sm:h-[132px] sm:w-[88px] lg:h-[148px] lg:w-[99px]"') &&
    headshotComponent.includes('if (size === "hero") return 320;'),
  "shared headshot component must expose a larger hero size for pitcher page headers",
);

for (const [label, source] of [
  ["pitcher profile", pitcherPage],
  ["pitcher form", pitcherFormPage],
]) {
  assert(source.includes('import { SiteNav } from "@/components/site-nav";'), `${label} must import shared site navigation`);
  assert(source.includes("getHomeSlateDate"), `${label} must resolve today for shared site navigation`);
  assert(source.includes('href="/" className="font-mono text-2xl uppercase tracking-[0.18em] text-amber-300"'), `${label} must keep the Toe the Slab wordmark link`);
  assert(source.includes('className="flex max-w-5xl items-start gap-4 sm:gap-6"'), `${label} header must align the headshot to the left of the name block`);
  assert(source.includes('size="hero"'), `${label} header must use the larger hero headshot`);
  assert(!source.includes('md:grid-cols-[1fr_240px]'), `${label} header must not keep the old detached right-column headshot layout`);
  assert(!source.includes('className="mx-auto"'), `${label} header headshot must not be centered away from the name`);
}

assert(
  pitcherPage.includes('data-responsive-check="pitcher-site-header"') &&
    pitcherPage.includes('<SiteNav active="starts" today={today} />'),
  "pitcher profile must render the shared header with the Ranked Starts nav context",
);

assert(
  pitcherFormPage.includes('data-responsive-check="pitcher-form-site-header"') &&
    pitcherFormPage.includes('<SiteNav active="heat" today={today} />'),
  "pitcher form must render the shared header with the Heat Check nav context",
);

assert(pitcherFormPage.includes('data-responsive-check="pitcher-form-score-summary"'), "pitcher form score block must expose a stable layout hook");
assert(pitcherFormPage.includes("sm:grid-cols-[minmax(0,1fr)_auto_auto]"), "pitcher form score/actions row must keep score text separate from controls");
assert(pitcherFormPage.includes("font-bold leading-none"), "pitcher form score must use a tight line-height so it cannot collide with its label");
assert(pitcherFormPage.includes("[overflow-wrap:anywhere]"), "pitcher form stat line must be allowed to wrap inside the header");
assert(!pitcherFormPage.includes('<div className="mt-5 flex flex-wrap items-center gap-3">'), "pitcher form score/action row must not return to the overlapping flex layout");

console.log("pitcher page contract ok: shared header/nav and larger left-aligned hero headshots");
