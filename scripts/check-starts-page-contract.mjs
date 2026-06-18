import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const startsPage = await readFile("src/app/starts/[id]/page.tsx", "utf8");
const routes = await readFile("src/lib/routes.ts", "utf8");
const siteNav = await readFile("src/components/site-nav.tsx", "utf8");

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

assert(
  routes.includes("export function startHref") &&
    startsPage.includes("startHref(start, sourceParams(\"starts\"))") &&
    startsPage.includes("pitcherHref({ id: start.pitcher.id, name: start.pitcher.name }, sourceParams(\"starts\"))"),
  "ranked starts list cards must carry starts source context to start and pitcher entity pages",
);

assert(
  startsPage.includes('const source = parseEntitySource(query?.from, "starts");') &&
    startsPage.includes("<EntityOrientation") &&
    startsPage.includes('<SiteHeader active={null} today={today} responsiveCheck="start-detail-site-header" />') &&
    siteNav.includes("active: NavKey | null"),
  "start detail pages must render neutral nav and source-aware back/breadcrumb orientation",
);

assert(
  startsPage.includes('import { slateTimeWord } from "@/lib/time-words";') &&
    startsPage.includes("still to come {slateTimeWord({ date }, { today })}") &&
    !startsPage.includes("still to come tonight"),
  "ranked starts partial-slate CTA must use slateTimeWord instead of hardcoded tonight copy",
);

assert(
  startsPage.includes("pitcherHref({ id: start.pitcher.id, name: start.pitcher.name }, sourceParams(source))"),
  "start detail pitcher links must preserve the current source context",
);

console.log("starts page contract ok: completed date chips include weekday, ranked cards source-link entities, and start detail pages show neutral source orientation");
