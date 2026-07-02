import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const [phase, homePage, deferred, rankedRecap, siteNav] = await Promise.all([
  readFile("src/lib/home-slate-phase.ts", "utf8"),
  readFile("src/app/page.tsx", "utf8"),
  readFile("src/components/home-deferred-sections.tsx", "utf8"),
  readFile("src/components/ranked-starts-recap.tsx", "utf8"),
  readFile("src/components/site-nav.tsx", "utf8"),
]);

assert(
  phase.includes('export type HomeSlatePhase = "PREGAME" | "EARLY" | "PRIME" | "WRAP";') &&
    phase.includes('export const HOME_SLATE_PHASE_EXPERIMENT_ENV = "NEXT_PUBLIC_HOME_SLATE_PHASE_EXPERIMENT";') &&
    phase.includes('return process.env[HOME_SLATE_PHASE_EXPERIMENT_ENV] === "1";'),
  "home slate phase experiment must be default-off behind the named public flag",
);

assert(
  phase.includes('PREGAME: ["watch", "heat", "ranked", "duels", "spotlight", "best"]') &&
    phase.includes('EARLY: ["watch", "spotlight", "duels", "heat", "ranked", "best"]') &&
    phase.includes("PRIME: CONTROL_MODULE_ORDER") &&
    phase.includes('WRAP: ["ranked", "watch", "spotlight", "heat", "duels", "best"]'),
  "home slate phase experiment must define the requested phase-specific module weights",
);

assert(
  phase.includes("slateProgress.liveGames >= 4") &&
    phase.includes("HOME_PRIME_LIVE_GS_PLUS_THRESHOLD") &&
    phase.includes('return "EARLY";'),
  "home slate phase helper must preserve the early-to-prime transition rules",
);

assert(
  homePage.includes('import { getHomeSlatePhase, isHomeSlatePhaseExperimentEnabled } from "@/lib/home-slate-phase";') &&
    homePage.includes("const homeSlatePhaseExperiment = isHomeSlatePhaseExperimentEnabled();") &&
    homePage.includes("const homeSlatePhase = getHomeSlatePhase({ slateProgress: slateStatus, ranked });") &&
    homePage.includes("slatePhase={homeSlatePhase}") &&
    homePage.includes("slatePhaseExperiment={homeSlatePhaseExperiment}"),
  "homepage must compute the phase server-side and pass the default-off experiment state to the client modules",
);

assert(
  deferred.includes("if (slatePhaseExperiment)") &&
    deferred.includes('data-home-slate-phase={slatePhase}') &&
    deferred.includes('data-home-slate-phase-variant={slatePhaseVariant}') &&
    deferred.includes("getHomeModuleOrder(slatePhase, slatePhaseVariant).map") &&
    deferred.includes("track(\"home_slate_phase_view\"") &&
    deferred.includes("track(\"home_slate_phase_scroll_depth\"") &&
    deferred.includes("track(\"home_slate_phase_module_click\""),
  "home deferred sections must only reorder and measure modules inside the flag-on branch",
);

assert(
  deferred.includes('compact={slatePhase === "PREGAME"}') &&
    rankedRecap.includes("compact?: boolean;") &&
    rankedRecap.includes('data-home-ranked-recap-compact={compact ? "true" : "false"}') &&
    rankedRecap.includes('data-responsive-check="home-ranked-recap-compact"'),
  "pregame experiment order must collapse the ranked recap to compact rows",
);

assert(
  siteNav.includes('type NavKey = "home" | "starts" | "heat" | "live" | "upcoming" | "watchlist";') &&
    (siteNav.match(/\{ key: "/g) ?? []).length === 6 &&
    siteNav.includes("grid-cols-3"),
  "main navigation must remain exactly six items with the existing mobile 2x3 grid",
);

console.log("home slate phase contract ok: default-off phase ordering, measurement, compact recap, and six-item nav are pinned");
