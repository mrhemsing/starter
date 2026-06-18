import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const timeWords = await readFile("src/lib/time-words.ts", "utf8");
const homeDeferredSections = await readFile("src/components/home-deferred-sections.tsx", "utf8");
const mustWatch = await readFile("src/components/tonights-must-watch.tsx", "utf8");
const pitchingDuels = await readFile("src/components/pitching-duels.tsx", "utf8");
const heatCheck = await readFile("src/app/form/page.tsx", "utf8");
const watchlist = await readFile("src/app/watchlist/page.tsx", "utf8");
const startsPage = await readFile("src/app/starts/[id]/page.tsx", "utf8");
const matchupBadge = await readFile("src/components/matchup-score-badge.tsx", "utf8");

assert(
  timeWords.includes("export function slateTimeWord") &&
    timeWords.includes("export function gameTimeWord") &&
    timeWords.includes('return "today";') &&
    timeWords.includes('return "tomorrow";') &&
    timeWords.includes('return "yesterday";') &&
    timeWords.includes('hour < 17 ? "this afternoon" : "tonight"'),
  "time-word helpers must centralize slate-level and game-specific language",
);

assert(
  homeDeferredSections.includes('import { slateTimeWord, slateTimeWordTitle } from "@/lib/time-words";') &&
    homeDeferredSections.includes("const watchWord = watch ? slateTimeWord(watch, { today }) : \"today\";") &&
    homeDeferredSections.includes("fullSlateLabel={`See ${watchWord}'s full slate`}") &&
    homeDeferredSections.includes("eyebrow={slateTimeWordTitle(watch, { today })}") &&
    homeDeferredSections.includes("rankLabel={watchWord}"),
  "home Must-Watch copy must derive slate labels from slateTimeWord",
);

assert(
  mustWatch.includes('import { slateTimeWordTitle } from "@/lib/time-words";') &&
    mustWatch.includes('rankLabel = "today"') &&
    mustWatch.includes("const eyebrowLabel = eyebrow ?? slateTimeWordTitle(tonight);") &&
    mustWatch.includes("isSlateRankLabel(rankLabel)"),
  "shared Must-Watch module must default to today and derive fallback eyebrow copy from slateTimeWord",
);

assert(
  pitchingDuels.includes('import { slateTimeWord, slateTimeWordTitle } from "@/lib/time-words";') &&
    pitchingDuels.includes("const slateWord = duels.mode === \"settled\" ? \"last settled\" : slateTimeWord({ date: duels.date });") &&
    pitchingDuels.includes("Closest matchups ${slateWord}") &&
    pitchingDuels.includes("Biggest gap {slateWord}"),
  "Best Duels home copy must use slateTimeWord for slate-level labels",
);

assert(
  heatCheck.includes('import { gameTimeWord } from "@/lib/time-words";') &&
    heatCheck.includes("Starts {gameTimeWord(start)} {matchup}"),
  "Heat Check game-specific start copy must use gameTimeWord",
);

assert(
  watchlist.includes('import { slateTimeWordTitle } from "@/lib/time-words";') &&
    watchlist.includes("{slateTimeWordTitle({ date: today }, { today })}&apos;s starters"),
  "Watchlist slate CTA must use slateTimeWordTitle",
);

assert(
  startsPage.includes('import { slateTimeWord } from "@/lib/time-words";') &&
    startsPage.includes("still to come {slateTimeWord({ date }, { today })}"),
  "Ranked starts partial-slate CTA must use slateTimeWord",
);

assert(
  matchupBadge.includes('rankLabel = "today"'),
  "shared matchup score badge must default rank labels to today",
);

for (const [label, source] of [
  ["home deferred sections", homeDeferredSections],
  ["must-watch", mustWatch],
  ["pitching duels", pitchingDuels],
  ["heat check", heatCheck],
  ["watchlist", watchlist],
  ["starts page", startsPage],
  ["matchup badge", matchupBadge],
]) {
  assert(!source.includes("tonight&apos;s"), `${label} must not hardcode tonight's`);
  assert(!source.includes("tonight's"), `${label} must not hardcode tonight's`);
  assert(!source.includes("Tonight&apos;s"), `${label} must not hardcode Tonight's`);
  assert(!source.includes("Tonight's"), `${label} must not hardcode Tonight's`);
  assert(!source.includes("still to come tonight"), `${label} must not hardcode partial-slate tonight copy`);
  assert(!source.includes("rankLabel = \"tonight\""), `${label} must not default rank labels to tonight`);
}

console.log("time-word contract ok: slate/game copy flows through central helpers and hardcoded descriptive tonight copy is blocked");
