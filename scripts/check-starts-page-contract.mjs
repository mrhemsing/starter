import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const startsPage = await readFile("src/app/starts/[id]/page.tsx", "utf8");

assert(
  startsPage.includes("return `${formatWeekday(state.date)} · ${formatMetadataDate(state.date)} · final`;"),
  "completed non-today starts pages must include weekday in the slate completion chip",
);

assert(
  !startsPage.includes("state.date === addDays(getHomeSlateDate(), -1)"),
  "starts page completion chip must not limit weekday labels to yesterday",
);

assert(
  startsPage.includes("function formatWeekday(date: string)"),
  "starts page must keep the weekday formatter for completed slate labels",
);

assert(
  startsPage.includes(">Pitcher Profile</Link>") && !startsPage.includes(">Pitcher</Link>"),
  "ranked starts card CTA must read Pitcher Profile instead of the terse Pitcher label",
);

console.log("starts page contract ok: completed date chips include weekday, and ranked cards link to Pitcher Profile");
