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
  assert(source.includes('className="flex max-w-5xl items-start gap-4 sm:gap-6"'), `${label} header must align the headshot to the left of the name block`);
  assert(source.includes('size="hero"'), `${label} header must use the larger hero headshot`);
  assert(!source.includes('md:grid-cols-[1fr_240px]'), `${label} header must not keep the old detached right-column headshot layout`);
  assert(!source.includes('className="mx-auto"'), `${label} header headshot must not be centered away from the name`);
}

console.log("pitcher page contract ok: player headers use larger left-aligned hero headshots");
