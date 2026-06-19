import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const startsPage = await readFile("src/app/starts/[id]/page.tsx", "utf8");
const routes = await readFile("src/lib/routes.ts", "utf8");
const siteNav = await readFile("src/components/site-nav.tsx", "utf8");
const globals = await readFile("src/app/globals.css", "utf8");

assert(
  startsPage.includes("return `Completed recap · ${formatWeekday(state.date)} · ${formatMetadataDate(state.date)} · final`;"),
  "completed non-today starts pages must include weekday and completed recap in the slate completion chip",
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

assert(
  startsPage.includes('return `Live ranked starts · Today · ${state.finalGames} of ${state.totalGames} final · updating`;') &&
    startsPage.includes('return "Completed recap · Today · final";') &&
    !startsPage.includes("{date} / completed starts recap"),
  "ranked starts header must use state-aware live/completed copy and remove the redundant ISO date line",
);

assert(
  startsPage.includes('className="-ml-[13px] inline-flex min-h-8 items-center rounded border border-amber-300/30 bg-amber-300/10 px-3') &&
    startsPage.includes('className="font-mono text-xs uppercase tracking-[0.16em] text-amber-300" href="/methodology"'),
  "ranked starts header status badge text and methodology link must share the title left edge",
);

assert(
  startsPage.includes("grid-cols-[48px_52px_minmax(0,1fr)_auto] sm:grid-cols-[48px_64px_minmax(0,1fr)_auto_auto]") &&
    startsPage.includes("grid-cols-[48px_44px_minmax(0,1fr)_auto] sm:grid-cols-[48px_52px_minmax(0,1fr)_auto_auto]") &&
    startsPage.includes("grid-cols-[48px_40px_minmax(0,1fr)_auto] sm:grid-cols-[48px_40px_minmax(0,1fr)_auto_auto]"),
  "ranked starts rows must use fixed rank/photo/meta/stats/score grid columns by tier",
);

assert(
  startsPage.includes("rounded border border-[#F6C445]/35") &&
    startsPage.includes("border-b border-white/10") &&
    startsPage.includes("gap-x-4") &&
    startsPage.includes("sm:text-right"),
  "ranked starts rows must use uniform gas outlines, field hairlines, 16px column gap, and right-aligned terminal stats/score",
);

assert(
  startsPage.includes("plateClass: \"!h-[65px] !w-[52px] sm:!h-20 sm:!w-16\"") &&
    startsPage.includes("plateClass: \"!h-[55px] !w-11 sm:!h-[65px] sm:!w-[52px]\"") &&
    startsPage.includes("plateClass: \"!h-[50px] !w-10\""),
  "ranked starts headshot plates must use tiered 4:5 dimensions",
);

assert(
  globals.includes(".ranked-start-plate") &&
    globals.includes("background: #15181C !important;") &&
    globals.includes("object-fit: cover;") &&
    globals.includes("object-position: center 18%;"),
  "ranked starts headshot plates must use neutral backgrounds and consistent cover crop",
);

console.log("starts page contract ok: completed date chips include weekday, ranked cards source-link entities, and start detail pages show neutral source orientation");
