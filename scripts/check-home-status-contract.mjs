import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const homePage = await readFile("src/app/page.tsx", "utf8");

assert(
  homePage.includes('if (/\\b(suspended)\\b/.test(status)) return "suspended";'),
  "homepage status normalizer must classify suspended games separately",
);

assert(
  homePage.includes('if (/\\b(live|in progress|manager challenge|delayed)\\b/.test(status)) return "live";'),
  "homepage live status normalizer must not count suspended games as in progress",
);

assert(
  homePage.indexOf('return "suspended"') < homePage.indexOf('return "live"'),
  "homepage status normalizer must check suspended before live statuses",
);

console.log("home status contract ok: suspended games do not count as in progress");
