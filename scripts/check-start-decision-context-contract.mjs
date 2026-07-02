import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const types = await readFile("src/lib/types.ts", "utf8");
const formService = await readFile("src/lib/data/form-service.ts", "utf8");
const pitcherFormPage = await readFile("src/app/pitchers/[id]/form/page.tsx", "utf8");
const rankedRecap = await readFile("src/components/ranked-starts-recap.tsx", "utf8");
const homeDeferred = await readFile("src/components/home-deferred-sections.tsx", "utf8");

assert(
  types.includes('result: StartSummary["result"];') &&
    formService.includes("result: start.result,"),
  "form start points must carry canonical pitcher decisions into pitcher game logs",
);

assert(
  pitcherFormPage.includes("function DecisionPill({ result, className = \"\" }") &&
    pitcherFormPage.includes("data-pitcher-start-decision={result}") &&
    pitcherFormPage.includes("Official pitcher decision, shown as context only") &&
    pitcherFormPage.includes('if (result === "W") return "Win";') &&
    pitcherFormPage.includes('if (result === "L") return "Loss";') &&
    pitcherFormPage.includes("return \"No decision\";") &&
    pitcherFormPage.includes("<DecisionPill result={start.result} />") &&
    pitcherFormPage.includes("<DecisionPill result={start.result} className=\"mt-3\" />"),
  "pitcher profile game logs must show neutral W/L/ND context in collapsed and expanded rows",
);

assert(
  rankedRecap.includes("function DecisionPill({ result }: { result: StartSummary[\"result\"] })") &&
    rankedRecap.includes("data-home-start-decision={result}") &&
    rankedRecap.includes("<DecisionPill result={start.result} />") &&
    homeDeferred.includes("data-home-best-start-decision={start.result}") &&
    homeDeferred.includes("function formatDecisionLabel(result: StartSummary[\"result\"])"),
  "homepage completed-start recap surfaces must show canonical pitcher decisions as context",
);

for (const source of [pitcherFormPage, rankedRecap, homeDeferred]) {
  assert(
    !source.includes('sort === "result"') &&
      !source.includes('sort === "decision"') &&
      !source.includes('sort === "win"') &&
      !source.includes('sort === "loss"'),
    "decision context must not add W/L/ND sorting or ranking inputs",
  );
}

console.log("start decision context contract ok: W/L/ND is visible as context across completed-start surfaces");
