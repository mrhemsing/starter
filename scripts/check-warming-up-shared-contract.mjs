import { readFile } from "node:fs/promises";
import { glob } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const warming = await readFile("src/components/warming-up.tsx", "utf8");
const shell = await readFile("src/components/route-loading-shell.tsx", "utf8");
const homeWrapper = await readFile("src/components/home-warming-up-loader.tsx", "utf8");
const eslint = await readFile("eslint.config.mjs", "utf8");
const loadingFiles = [];
for await (const file of glob("src/app/**/loading.tsx")) loadingFiles.push(file);

assert(loadingFiles.length >= 16, `expected all loading routes, found ${loadingFiles.length}`);
assert(warming.includes('variant: "full"') && warming.includes('variant: "compact"'), "WarmingUp must expose full and compact variants");
assert(shell.includes('<WarmingUp variant="compact" statusLines={loadingStatusLines(route)} />'), "shared route shell must render compact WarmingUp");
assert(homeWrapper.includes('<WarmingUp variant="full" slateState={slateState} />'), "homepage must retain the full WarmingUp variant");
assert(!eslint.includes("@/components/warming-up"), "homepage-only WarmingUp import restriction must be removed");
assert((warming.match(/data-zone-cell/g)?.length ?? 0) >= 2, "shared implementation must contain the zone marker");
assert(!warming.includes("setState") && !warming.includes("setPitch"), "animation must not use per-frame React state");
assert(warming.includes("cancelAnimationFrame(frameId)") && warming.includes("clearInterval(statusTimer)") && warming.includes("timers.forEach(clearTimeout)"), "animation must clean up rAF and timers");
assert(shell.includes("Ranking completed starts") && shell.includes("Reading rolling form") && shell.includes("Tracking live starts") && shell.includes("Reading the slate") && shell.includes("Loading your arms") && shell.includes("Pulling the game log"), "shared shell must configure route-specific status lines");
assert(!/["'`][^"'`]*[—!][^"'`]*["'`]/.test(shell.match(/function loadingStatusLines[\s\S]*?\n}/)?.[0] ?? ""), "loading status copy must not contain em dashes or exclamation points");

console.log("shared WarmingUp contract passed", { loadingRoutes: loadingFiles.length });
