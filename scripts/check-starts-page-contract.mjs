import { readFile } from "node:fs/promises";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const startsPage = await readFile("src/app/starts/[id]/page.tsx", "utf8");
const startClassification = await readFile("src/lib/start-classification.ts", "utf8");
const startService = await readFile("src/lib/data/start-service.ts", "utf8");
const formService = await readFile("src/lib/data/form-service.ts", "utf8");
const types = await readFile("src/lib/types.ts", "utf8");
const routes = await readFile("src/lib/routes.ts", "utf8");
const siteNav = await readFile("src/components/site-nav.tsx", "utf8");
const globals = await readFile("src/app/globals.css", "utf8");
const methodologyPage = await readFile("src/app/methodology/page.tsx", "utf8");

assert(
  startsPage.includes("return `Final · ${formatWeekday(state.date)} · ${formatMetadataDate(state.date)}`;"),
  "completed non-today starts pages must include weekday and final state in the slate completion line",
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
  startsPage.includes("function RankedSlateStatus") &&
    startsPage.includes('className="ranked-live-dot h-2 w-2 rounded-full bg-[#FF5A1F]"') &&
    startsPage.includes('return `Live · Today · ${state.finalGames} of ${state.totalGames} final`;') &&
    startsPage.includes('return `Final · Today · ${formatMetadataDate(state.date)}`;') &&
    startsPage.includes('return `Probables · Today · first pitch ${slateProgress.firstPitchAt ? formatFirstPitchStamp(slateProgress.firstPitchAt) : "soon"}`;') &&
    !startsPage.includes("{date} / completed starts recap"),
  "ranked starts header must use a no-box state-aware live/final/probables indicator and remove the redundant ISO date line",
);

assert(
  startsPage.includes('className="mt-3 flex flex-col items-start gap-2"') &&
    startsPage.includes('className="inline-flex min-h-6 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-300"') &&
    startsPage.includes('className="font-mono text-xs uppercase tracking-[0.16em] text-amber-300" href="/methodology"') &&
    !startsPage.includes("border-amber-300/30 bg-amber-300/10 px-3"),
  "ranked starts header status and methodology link must share the title left edge without a bordered badge box",
);

assert(
  !startsPage.includes(">Short outings</span>") &&
    startsPage.includes('data-responsive-check="ranked-starts-openers"') &&
    startsPage.includes("Openers & short outings · {shortStarts.length}") &&
    startsPage.includes('<ControlLink active={showOpeners} href={rankedStartsHref(date, { band, sort, showOpeners: !showOpeners })} scroll={false}>') &&
    startsPage.includes("function ControlLink({ active, href, children, color, scroll = true }") &&
    startsPage.includes("scroll={scroll}"),
  "ranked starts opener/short-outing controls must live only in the lower openers section and preserve scroll on toggle",
);

assert(
  types.includes("plannedStarter?: boolean;") &&
    startService.includes("const ESTABLISHED_STARTER_MIN_SEASON_STARTS = 5;") &&
    startService.includes("const ESTABLISHED_STARTER_MIN_AVG_IP = 4;") &&
    startService.includes("async function getEstablishedStarterPitcherIds") &&
    startService.includes("hasEstablishedStarterWorkload(profile)") &&
    startService.includes("const plannedStarter = probablePitcherIds.has(pitcher.id) || establishedStarterIds.has(pitcher.id);") &&
    startService.includes("plannedStarter,") &&
    startClassification.includes("export function isRankedRegularStart") &&
    startClassification.includes("const RANKED_START_IP_FLOOR = 2;") &&
    startClassification.includes("return inningsFromIP(start.line.inningsPitched) >= RANKED_START_IP_FLOOR;") &&
    !startClassification.includes("isPlannedStarter(start) || inningsFromIP(start.line.inningsPitched) >= RANKED_START_IP_FLOOR") &&
    startsPage.includes('import { isRankedRegularStart } from "@/lib/start-classification";') &&
    startsPage.includes("return isRankedRegularStart(start);") &&
    startsPage.includes("Board ranks starts of 2.0+ innings; openers and short outings are listed separately.") &&
    startsPage.includes("Starts under 2.0 innings are kept out of the ranked positions but remain visible for slate completeness.") &&
    methodologyPage.includes("Daily boards rank qualified starts of at least 2.0 IP; openers and short outings are listed separately.") &&
    !methodologyPage.includes("Daily boards rank qualified starts of at least 3.0 IP;") &&
    formService.includes('import { isScoredStarterSample } from "@/lib/start-classification";') &&
    formService.includes("isScoredStarterSample(start, FORM_CONFIG.ipFloor)"),
  "ranked starts must use a hard 2.0 IP eligibility floor while planned-starter workload remains available for form scoring",
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
    globals.includes("border: 1.5px solid color-mix(in srgb, var(--ranked-band-color, #878D97) 45%, transparent) !important;") &&
    globals.includes("object-fit: cover;") &&
    globals.includes("object-position: center 18%;"),
  "ranked starts headshot plates must use neutral backgrounds, band-tinted rings, and consistent cover crop",
);

assert(
  startsPage.includes('"--ranked-band-color": profile.railColor') &&
    globals.includes(".ranked-start-details > summary > span") &&
    globals.includes("right: 12px;") &&
    globals.includes("top: 50%;") &&
    globals.includes("transform: translateY(-50%);") &&
    globals.includes("@keyframes ranked-live-dot-pulse") &&
    globals.includes("animation: ranked-live-dot-pulse 2s ease-in-out infinite;"),
  "ranked starts rows must expose band ring color, center the row chevron, and pulse the live dot only through CSS",
);

console.log("starts page contract ok: completed date chips include weekday, ranked cards source-link entities, and start detail pages show neutral source orientation");
