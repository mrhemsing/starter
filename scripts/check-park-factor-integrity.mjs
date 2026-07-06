import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const runEnvironment = readFileSync("src/lib/data/run-environment.ts", "utf8");
const startService = readFileSync("src/lib/data/start-service.ts", "utf8");
const tonightCards = readFileSync("src/components/tonights-must-watch.tsx", "utf8");
const watchlistNextStartBlock = readFileSync("src/components/watchlist-next-start-block.tsx", "utf8");
const auditDoc = readFileSync("docs/park-factor-integrity-audit-2026-07-05.md", "utf8");

const factorEntries = [...runEnvironment.matchAll(/^\s+"([^"]+)":\s+([0-9.]+),$/gm)]
  .filter((entry) => !runEnvironment.slice(0, entry.index).includes("VENUE_WEATHER_PROFILES"))
  .map((entry) => ({ venue: entry[1], factor: Number(entry[2]) }));

assert(factorEntries.length >= 30, `expected at least 30 venue run factors, found ${factorEntries.length}`);
for (const { venue, factor } of factorEntries) {
  assert(factor >= 0.85 && factor <= 1.2, `${venue} has out-of-range park factor ${factor}`);
}

const factors = new Map(factorEntries.map((entry) => [entry.venue, entry.factor]));
assert(factors.get("Petco Park") === 0.95, "Petco Park should store the full 0.95 factor, not 0.05");
assert(factors.get("Oracle Park") === 0.94, "Oracle Park should store the full 0.94 factor, not 0.04");
assert(factors.get("Citi Field") === 0.97, "Citi Field should store the full 0.97 factor, not a deviation");

assert(runEnvironment.includes("export const PARK_RUN_FACTOR_MIN = 0.85"), "park factor minimum gate must be exported");
assert(runEnvironment.includes("export const PARK_RUN_FACTOR_MAX = 1.2"), "park factor maximum gate must be exported");
assert(runEnvironment.includes("validateVenueRunFactorTable(VENUE_RUN_FACTORS)"), "park factor source table must be validated at module load");
assert(runEnvironment.includes("export function validateVenueRunFactorForWrite"), "write gate helper must be exported");
assert(runEnvironment.includes("throw new Error(`${venue} park run factor ${runFactor}"), "write gate must reject out-of-range factors");
assert(runEnvironment.includes("logInvalidParkRunFactor(venue, storedRunFactor)"), "read gate must log invalid stored park factors");
assert(runEnvironment.includes("available ? Number(") && runEnvironment.includes(": 0,"), "read gate must neutralize invalid park contribution");
assert(runEnvironment.includes("available,"), "park context must expose availability to UI consumers");

assert(startService.includes('import { getVenueRunFactor as sharedVenueRunFactor } from "@/lib/data/run-environment";'), "start service must import the shared venue run factor source");
assert(!startService.includes("const venueRunFactors: Record<string, number>"), "start service must not carry a duplicate park factor table");
assert(startService.includes("return sharedVenueRunFactor(venue);"), "start service must delegate park factor reads to the shared source");

assert(tonightCards.includes("game.parkContext.available ?"), "Upcoming card PARK chip must render only for available park factors");
assert(watchlistNextStartBlock.includes("isValidParkRunFactor(nextStart.parkRunFactor)"), "Watchlist next-start PARK chip must use the shared range gate");

for (const needle of ["PARK 0.0", "PARK 0.04", "PARK 0.05"]) {
  assert(!tonightCards.includes(needle), `${needle} must not be hardcoded in Upcoming UI`);
  assert(!watchlistNextStartBlock.includes(needle), `${needle} must not be hardcoded in Watchlist UI`);
}

assert(auditDoc.includes("| Petco Park | 0.95 | sane |"), "audit doc must include Petco");
assert(auditDoc.includes("| Oracle Park | 0.94 | sane |"), "audit doc must include Oracle");
assert(auditDoc.includes("| Citi Field | 0.97 | sane |"), "audit doc must include Citi");
assert((auditDoc.match(/^\| [^|]+ \| [0-9.]+ \| sane \|$/gm) ?? []).length >= 30, "audit doc must include the full park factor table");

console.log(`park factor integrity checks passed for ${factorEntries.length} venue rows`);

