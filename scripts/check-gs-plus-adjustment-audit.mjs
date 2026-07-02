import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const audit = await readFile("docs/gs-plus-adjustment-audit.md", "utf8");
const startService = await readFile("src/lib/data/start-service.ts", "utf8");
const slateContract = await readFile("scripts/check-slate-contract.mjs", "utf8");
const startContract = await readFile("scripts/check-start-contract.mjs", "utf8");
const methodologyPage = await readFile("src/app/methodology/page.tsx", "utf8");

assert(
  audit.includes("GS+ already adjusts completed-start scores for both park and opponent context.") &&
    audit.includes("A formula rewrite is not the first move for P1-5.") &&
    audit.includes("Treat P1-5 as transparency and calibration, not an immediate GS+ v2 rewrite."),
  "GS+ adjustment audit must state the scoped verdict",
);

assert(
  audit.includes("Park context: `(1 - parkRunFactor) * 12`") &&
    audit.includes("Opponent quality: `opponentQualityRunValue`") &&
    audit.includes("Opponent offense: `opponentOffenseRunValue`"),
  "GS+ adjustment audit must name the current park and opponent components",
);

assert(
  startService.includes('key: "parkContext" as const') &&
    startService.includes("value: (NEUTRAL_PARK_RUN_FACTOR - context.parkRunFactor) * 12") &&
    startService.includes('key: "opponentQuality" as const') &&
    startService.includes("value: context.opponentQualityRunValue") &&
    startService.includes('key: "opponentOffense" as const') &&
    startService.includes("value: context.opponentOffenseRunValue") &&
    startService.includes('formulaVersion: "context-v7"'),
  "completed-start GS+ must still expose park, opponent quality, opponent offense, and context-v7",
);

assert(
  slateContract.includes('scoreKeys.has("parkContext")') &&
    slateContract.includes('scoreKeys.has("opponentQuality")') &&
    slateContract.includes('scoreKeys.has("opponentOffense")') &&
    startContract.includes('scoreKeys.has("parkContext")') &&
    startContract.includes('scoreKeys.has("opponentQuality")') &&
    startContract.includes('scoreKeys.has("opponentOffense")'),
  "existing contracts must continue pinning GS+ context components",
);

assert(
  methodologyPage.includes("Completed starts use line, park, opponent, and verified pitch-event context when available.") &&
    methodologyPage.includes('<FormulaItem label="Opponent quality" value="team quality run value" />') &&
    methodologyPage.includes('<FormulaItem label="Opponent offense" value="offense run value" />'),
  "public methodology must already disclose park and opponent context at a high level",
);

console.log("gs-plus adjustment audit ok: park and opponent components are documented and pinned");
