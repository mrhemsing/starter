import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright-core";

const baseUrl = process.env.THE_BUMP_BASE_URL ?? "http://127.0.0.1:3000";
const chromePath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outputDir = process.env.THE_BUMP_SCREENSHOT_DIR ?? ".responsive-screenshots";
const includeLiveTargets = process.env.THE_BUMP_RESPONSIVE_LIVE === "1";
const useLiveMlbData = process.env.THE_BUMP_LIVE_MLB === "1";
const liveSlateDate = process.env.THE_BUMP_RESPONSIVE_LIVE_DATE ?? "2026-05-24";
const contractSlateDate = process.env.THE_BUMP_CONTRACT_DATE ?? "2026-05-24";
const upcomingSlateDate = process.env.THE_BUMP_RESPONSIVE_UPCOMING_DATE ?? "2026-06-08";
const nextUpcomingSlateDate = addDays(upcomingSlateDate, 1);
const minScreenshotBytes = 45_000;

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 1000 },
];

const fixturePages = [
  {
    name: "home",
    path: "/",
    text: "Every MLB start,",
    mobileChecks: [
      { selector: "[data-responsive-check='home-mobile-nav']", visible: true },
      { selector: "[data-responsive-check='home-mobile-nav'] a", count: 5 },
      { selector: "[data-responsive-check='home-mobile-nav'] a", minHeight: 44 },
      { selector: "[data-responsive-check='home-masthead']", visible: true },
      { selector: "[data-responsive-check='slate-swarm']", visible: true },
      { selector: "[data-responsive-check='must-watch']", visible: true },
    ],
    desktopChecks: [{ selector: "[data-responsive-check='home-mobile-nav']", visible: false }],
  },
  {
    name: "slate",
    path: `/starts/${contractSlateDate}`,
    text: "Completed starts ranked by GS+.",
    mobileChecks: [
      { selector: "[data-responsive-check='ranked-start-card']", maxHeight: 760 },
      { selector: "[data-responsive-check='ranked-start-card'] a", minHeight: 44 },
    ],
  },
  {
    name: "upcoming-day",
    path: `/upcoming/${upcomingSlateDate}`,
    text: "One card per game",
    mobileChecks: [
      { selector: "[data-responsive-check='must-watch']", visible: true },
    ],
  },
  {
    name: "upcoming-next-day",
    path: `/upcoming/${nextUpcomingSlateDate}`,
    text: "One card per game",
    mobileChecks: [
      { selector: "[data-responsive-check='must-watch']", visible: true },
    ],
  },
  {
    name: "upcoming-week",
    path: `/upcoming/week/${upcomingSlateDate}`,
    text: "Upcoming Matchups",
    mobileChecks: [
      { selector: "[data-responsive-check='must-watch']", visible: true },
    ],
  },
  {
    name: "start",
    path: "/starts/2026-05-23-pit-chc-694973",
    text: "Pitch-by-pitch sequence",
    mobileChecks: [
      { selector: "[data-responsive-check='pitch-chart-controls'] button", minHeight: 44 },
      { selector: "[data-responsive-check='pitch-sequence-cards']", visible: true },
      { selector: "[data-responsive-check='pitch-sequence-table']", visible: false },
    ],
    desktopChecks: [
      { selector: "[data-responsive-check='pitch-sequence-cards']", visible: false },
      { selector: "[data-responsive-check='pitch-sequence-table']", visible: true },
    ],
  },
  {
    name: "pitcher",
    path: "/pitchers/694973",
    text: "Paul Skenes",
    mobileChecks: [
      { selector: "[data-responsive-check='pitcher-form-hero']", visible: true },
      { selector: "[data-responsive-check='pitcher-game-log-row']", minHeight: 44 },
    ],
  },
  {
    name: "pitcher-loss-filter",
    path: "/pitchers/694973?result=L",
    text: "Paul Skenes",
    fixtureOnly: true,
    mobileChecks: [
      { selector: "[data-responsive-check='pitcher-form-hero']", visible: true },
      { selector: "[data-responsive-check='pitcher-game-log-row']", minHeight: 44 },
    ],
  },
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

await mkdir(outputDir, { recursive: true });

const pages = [
  ...fixturePages.filter((page) => !page.fixtureOnly || !useLiveMlbData),
  ...(includeLiveTargets ? await getLiveResponsiveTargets() : []),
];

const browser = await chromium.launch({
  executablePath: chromePath,
});

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();

    for (const target of pages) {
      const response = await page.goto(`${baseUrl}${target.path}`, { waitUntil: "networkidle" });
      assert(response?.ok(), `${target.name} ${viewport.name} returned HTTP ${response?.status()}`);
      await page.getByText(target.text).first().waitFor({ timeout: 10_000 });

      const overflow = await page.evaluate(() => {
        const documentWidth = document.documentElement.scrollWidth;
        const viewportWidth = window.innerWidth;
        const overflowing = [...document.querySelectorAll("body *")]
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              tag: element.tagName.toLowerCase(),
              text: element.textContent?.trim().slice(0, 80) ?? "",
              left: Math.floor(rect.left),
              right: Math.ceil(rect.right),
              width: Math.ceil(rect.width),
            };
          })
          .filter((rect) => rect.width > 0 && (rect.left < -2 || rect.right > viewportWidth + 2))
          .slice(0, 5);

        return { documentWidth, viewportWidth, overflowing };
      });

      assert(
        overflow.documentWidth <= overflow.viewportWidth + 2,
        `${target.name} ${viewport.name} has horizontal document overflow ${overflow.documentWidth}px > ${overflow.viewportWidth}px: ${JSON.stringify(overflow.overflowing)}`,
      );

      await runViewportChecks(page, target, viewport.name);

      const screenshot = await page.screenshot({
        path: join(outputDir, `${target.name}-${viewport.name}.png`),
        fullPage: true,
      });
      assert(
        screenshot.byteLength >= minScreenshotBytes,
        `${target.name} ${viewport.name} screenshot looks too small (${screenshot.byteLength} bytes < ${minScreenshotBytes} bytes)`,
      );
    }

    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`responsive screenshots ok: ${pages.length} pages x ${viewports.length} viewports -> ${outputDir}`);

async function getLiveResponsiveTargets() {
  const response = await fetch(`${baseUrl}/api/slate/yesterday/${liveSlateDate}`);
  assert(response.ok, `live slate API returned HTTP ${response.status}`);

  const slate = await response.json();
  assert(slate.source?.schedule === "live", `live screenshot check expected live schedule source, got ${slate.source?.schedule}`);
  assert(["archive-gamefeed", "live-gamefeed"].includes(slate.source?.completedStartStats), `live screenshot check expected gamefeed lines, got ${slate.source?.completedStartStats}`);
  assert(Array.isArray(slate.starts) && slate.starts.length > 0, "live screenshot check needs at least one start");
  const completedSourceText = slate.source.completedStartStats === "archive-gamefeed" ? "Archived gamefeed lines" : "Live gamefeed lines";

  return [
    {
      name: "live-slate",
      path: `/slate/yesterday/${liveSlateDate}`,
      text: completedSourceText,
      mobileChecks: [
        { selector: "[data-responsive-check='slate-score-breakdown']", visible: true },
        { selector: "[data-responsive-check='score-explainer']", visible: true },
        { selector: "[data-responsive-check='score-component-list']", visible: true },
        { selector: "[data-responsive-check='score-delta-comparison']", visible: true },
        { selector: "[data-responsive-check='completed-slate-card']", maxHeight: 720 },
        { selector: "[data-responsive-check='slate-card-actions']", visible: true },
        { selector: "[data-responsive-check='slate-card-actions'] a", minHeight: 44 },
      ],
    },
    {
      name: "live-start",
      path: `/starts/${slate.starts[0].id}`,
      text: "Pitch chart",
      mobileChecks: [
        { selector: "[data-responsive-check='pitch-chart-controls'] button", minHeight: 44 },
        { selector: "[data-responsive-check='pitch-sequence-cards']", visible: true },
        { selector: "[data-responsive-check='pitch-sequence-table']", visible: false },
      ],
      desktopChecks: [
        { selector: "[data-responsive-check='pitch-sequence-cards']", visible: false },
        { selector: "[data-responsive-check='pitch-sequence-table']", visible: true },
      ],
    },
  ];
}

async function runViewportChecks(page, target, viewportName) {
  const checks = viewportName === "mobile" ? target.mobileChecks : target.desktopChecks;
  if (!checks) return;

  for (const check of checks) {
    if ("visible" in check) {
      const visible = await page.locator(check.selector).first().isVisible();
      assert(
        visible === check.visible,
        `${target.name} ${viewportName} expected ${check.selector} visible=${check.visible}, got ${visible}`,
      );
    }

    if ("minHeight" in check) {
      const boxes = await page.locator(check.selector).evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return { text: element.textContent?.trim() ?? "", height: Math.round(rect.height) };
        }),
      );
      assert(boxes.length > 0, `${target.name} ${viewportName} expected ${check.selector} to match at least one element`);
      const tooShort = boxes.filter((box) => box.height < check.minHeight);
      assert(
        tooShort.length === 0,
        `${target.name} ${viewportName} expected ${check.selector} min-height ${check.minHeight}px, got ${JSON.stringify(tooShort.slice(0, 5))}`,
      );
    }

    if ("maxHeight" in check) {
      const boxes = await page.locator(check.selector).evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return { text: element.textContent?.trim().slice(0, 80) ?? "", height: Math.round(rect.height) };
        }),
      );
      assert(boxes.length > 0, `${target.name} ${viewportName} expected ${check.selector} to match at least one element`);
      const tooTall = boxes.filter((box) => box.height > check.maxHeight);
      assert(
        tooTall.length === 0,
        `${target.name} ${viewportName} expected ${check.selector} max-height ${check.maxHeight}px, got ${JSON.stringify(tooTall.slice(0, 5))}`,
      );
    }

    if ("count" in check) {
      const count = await page.locator(check.selector).count();
      assert(
        count === check.count,
        `${target.name} ${viewportName} expected ${check.selector} count ${check.count}, got ${count}`,
      );
    }
  }
}
