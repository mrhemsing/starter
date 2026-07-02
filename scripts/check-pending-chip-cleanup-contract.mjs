import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const mustWatch = await readFile("src/components/tonights-must-watch.tsx", "utf8");

assert(
  mustWatch.includes("function MoreDataLine({ game, compact = false }") &&
    mustWatch.includes('data-watch-more-data="true"') &&
    mustWatch.includes('data-watch-more-data-keys={keys.join(",")}') &&
    mustWatch.includes("More data closer to first pitch."),
  "Upcoming cards must collapse unresolved optional inputs into one subtle card-level line",
);

assert(
  mustWatch.includes("function unresolvedOptionalInputKeys(game: TonightGame)") &&
    mustWatch.includes("if (game.flags?.tbd) return [];") &&
    mustWatch.includes('keys.push("opponent-splits")') &&
    mustWatch.includes('keys.push("form-clash")') &&
    mustWatch.includes('keys.push(`${starter.side}-projection`)') &&
    mustWatch.includes('keys.push(`${starter.side}-market`)') &&
    mustWatch.includes('keys.push(`${starter.side}-prop`)') &&
    mustWatch.includes('keys.push(`${starter.side}-team-total`)'),
  "TBD cards must keep their provisional warning separate, while other unresolved inputs feed the one-line closer-to-first-pitch note",
);

assert(
  mustWatch.includes('return <span className="hidden" aria-hidden="true" {...clashData} />;') &&
    !mustWatch.includes("Form clash pending"),
  "FORM CLASH must be hidden until computable, not rendered as a pending chip",
);

assert(
  mustWatch.includes('return <span className="hidden" aria-hidden="true" {...projectionData} />;') &&
    !mustWatch.includes("Projection pending"),
  "Projection pending chips must stay hidden until projection data resolves",
);

assert(
  !mustWatch.includes("prop pending") &&
    !mustWatch.includes("Team total {market.opposingTeamTotal === null") &&
    mustWatch.includes("const strikeoutPropLine = market.strikeoutPropLine;") &&
    mustWatch.includes("const opposingTeamTotal = market.opposingTeamTotal;"),
  "Market pending chips must not render prop-pending or team-total-pending copy",
);

assert(
  !mustWatch.includes('game.matchupContext.status === "pending-opponent-splits") keys.push("pending-opponent-splits")') &&
    !mustWatch.includes("Opponent split context pending."),
  "Opponent split pending state must not render as a first-class card chip",
);

console.log("pending chip cleanup contract ok: unresolved Upcoming inputs collapse to one line and FORM CLASH stays hidden until ready");
