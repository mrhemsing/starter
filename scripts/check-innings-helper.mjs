import { inningsFromIP } from "../src/lib/innings.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nearlyEqual(a, b) {
  return Math.abs(a - b) < 0.000000001;
}

const cases = [
  ["5.1", 5 + 1 / 3],
  [5.2, 5 + 2 / 3],
  ["0.2", 2 / 3],
  [7.0, 7],
];

for (const [input, expected] of cases) {
  assert(nearlyEqual(inningsFromIP(input), expected), `${input} should convert to ${expected}`);
}

const lengthForFiveOne = inningsFromIP("5.1") * 3;
assert(lengthForFiveOne !== 3 * 5.1, "Length(5.1) must not use decimal IP math");
assert(nearlyEqual(lengthForFiveOne, 16), "Length(5.1) must equal 16 outs");
assert(nearlyEqual(inningsFromIP("4.2") * 3, 14), "Length(4.2) must equal 14 outs");
assert(nearlyEqual(inningsFromIP("4.1") * 3, 13), "Length(4.1) must equal 13 outs");
assert(nearlyEqual(inningsFromIP("2.2") * 3, 8), "Length(2.2) must equal 8 outs");
assert(nearlyEqual(inningsFromIP("1.2") * 3, 5), "Length(1.2) must equal 5 outs");
assert(nearlyEqual(inningsFromIP("0.2") * 3, 2), "Length(0.2) must equal 2 outs");

let rejected = false;
try {
  inningsFromIP("5.3");
} catch {
  rejected = true;
}
assert(rejected, "5.3 must be rejected as invalid baseball IP notation");

console.log("innings helper ok: baseball IP fractions score by outs");
