import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright-core";

const baseUrl = process.env.THE_BUMP_BASE_URL ?? "http://127.0.0.1:3000";
const chromePath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outputDir = process.env.THE_BUMP_CARD_SCREENSHOT_DIR ?? ".responsive-screenshots";
const rankedDate = process.env.THE_BUMP_CARD_RANKED_DATE ?? "2026-07-02";
const minScreenshotBytes = 35_000;

const viewports = [
  { name: "mobile-320", width: 320, height: 844, kind: "mobile" },
  { name: "mobile-390", width: 390, height: 844, kind: "mobile" },
  { name: "mobile-430", width: 430, height: 844, kind: "mobile" },
  { name: "desktop-1280", width: 1280, height: 900, kind: "desktop" },
  { name: "desktop-1440", width: 1440, height: 1000, kind: "desktop" },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ executablePath: chromePath });

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    const page = await context.newPage();

    await page.goto(`${baseUrl}/starts/${rankedDate}`, { waitUntil: "load" });
    await page.locator("[data-responsive-check='ranked-start-card']:not([data-skeleton-row])").first().waitFor({ timeout: 10_000 });
    if (viewport.kind === "mobile") {
      await assertVisible(page, "[data-mobile-card-shell]", true, `ranked ${viewport.name} mobile shell`);
      await assertVisible(page, "[data-mobile-card-chips]", true, `ranked ${viewport.name} mobile chip row`);
      await assertVisible(page, "[data-ranked-desktop-chip-row]", false, `ranked ${viewport.name} desktop chip row`);
    } else {
      await assertVisible(page, "[data-mobile-card-shell]", false, `ranked ${viewport.name} mobile shell`);
      await assertVisible(page, "[data-ranked-desktop-chip-row]", true, `ranked ${viewport.name} desktop chip row`);
      await assertVisible(page, "[data-ranked-desktop-detail-block]", true, `ranked ${viewport.name} desktop detail block`);
      await assertVisible(page, "[data-ranked-desktop-score-stack]", true, `ranked ${viewport.name} desktop score stack`);
      await assertDesktopRankedColumns(page, viewport.name);
    }
    await saveScreenshot(page, `ranked-${viewport.name}.png`);

    await page.goto(`${baseUrl}/heat-check`, { waitUntil: "load" });
    await page.locator("[data-form-row]:not([data-skeleton-row])").first().waitFor({ timeout: 10_000 });
    if (viewport.kind === "mobile") {
      await assertHeatScheduledChipBreak(page, viewport.name);
    }
    if (viewport.kind === "desktop") {
      await assertVisible(page, "[data-mobile-card-shell]", false, `heat ${viewport.name} mobile shell`);
      await assertVisible(page, "[data-form-row]", true, `heat ${viewport.name} desktop row`);
    }
    await saveScreenshot(page, `heat-${viewport.name}.png`);

    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`mobile card layout ok: ranked and heat screenshots across ${viewports.length} viewport(s) -> ${outputDir}`);

async function assertVisible(page, selector, expected, label) {
  const matches = page.locator(selector);
  const count = await matches.count();
  assert(count > 0, `${label} expected ${selector} to match at least one element`);
  const visibleCount = await matches.evaluateAll((elements) =>
    elements.filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
    }).length,
  );
  const visible = visibleCount > 0;
  assert(visible === expected, `${label} expected ${selector} visible=${expected}, got ${visible} (${visibleCount}/${count} visible)`);
}

async function assertHeatScheduledChipBreak(page, viewportName) {
  const scheduled = page.locator("[data-mobile-card-shell] [data-heat-start-status-chip='scheduled']").first();
  await scheduled.waitFor({ timeout: 10_000 });
  const geometry = await scheduled.evaluate((chip) => {
    const chipRect = chip.getBoundingClientRect();
    const row = chip.closest("[data-mobile-card-chips]");
    const nextVisible = Array.from(row?.children ?? []).find((element) => {
      if (element === chip || element.hasAttribute("data-heat-mobile-start-status-break")) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0 && rect.left >= chipRect.left - 1 && rect.top >= chipRect.top - 1;
    });
    const nextRect = nextVisible?.getBoundingClientRect();

    return {
      chip: { top: chipRect.top, bottom: chipRect.bottom, height: chipRect.height },
      next: nextRect ? { top: nextRect.top, bottom: nextRect.bottom, height: nextRect.height } : null,
      hasBreak: Boolean(row?.querySelector("[data-heat-mobile-start-status-break]")),
    };
  });

  assert(geometry.hasBreak, `heat ${viewportName} scheduled chip row must include a mobile row break: ${JSON.stringify(geometry)}`);
  assert(geometry.next, `heat ${viewportName} scheduled chip should be followed by another visible chip row item: ${JSON.stringify(geometry)}`);
  assert(geometry.next.top >= geometry.chip.bottom - 1, `heat ${viewportName} chips after scheduled STARTS must begin on the next row: ${JSON.stringify(geometry)}`);
}

async function assertDesktopRankedColumns(page, viewportName) {
  const geometry = await page.locator("[data-responsive-check='ranked-start-card']:not([data-skeleton-row])").first().evaluate((card) => {
    const chip = card.querySelector("[data-ranked-desktop-chip-row]")?.getBoundingClientRect();
    const details = card.querySelector("[data-ranked-desktop-detail-block]")?.getBoundingClientRect();
    const score = card.querySelector("[data-ranked-desktop-score-stack]")?.getBoundingClientRect();
    const mobileShell = card.querySelector("[data-mobile-card-shell]")?.getBoundingClientRect();

    return {
      chip: chip ? { left: chip.left, top: chip.top, right: chip.right, bottom: chip.bottom, width: chip.width, height: chip.height } : null,
      details: details ? { left: details.left, top: details.top, right: details.right, bottom: details.bottom, width: details.width, height: details.height } : null,
      score: score ? { left: score.left, top: score.top, right: score.right, bottom: score.bottom, width: score.width, height: score.height } : null,
      mobileShell: mobileShell ? { width: mobileShell.width, height: mobileShell.height } : null,
    };
  });

  assert(geometry.chip && geometry.details && geometry.score, `ranked ${viewportName} missing desktop geometry: ${JSON.stringify(geometry)}`);
  assert((geometry.mobileShell?.width ?? 0) === 0 || (geometry.mobileShell?.height ?? 0) === 0, `ranked ${viewportName} mobile shell must not occupy desktop geometry`);
  assert(geometry.chip.left < geometry.details.left, `ranked ${viewportName} chips should sit in the left name cluster before details: ${JSON.stringify(geometry)}`);
  assert(geometry.details.right <= geometry.score.left + 8, `ranked ${viewportName} details should sit before the score stack: ${JSON.stringify(geometry)}`);
  assert(geometry.chip.height > 0 && geometry.chip.height <= 70, `ranked ${viewportName} desktop chip row height drifted: ${JSON.stringify(geometry)}`);
}

async function saveScreenshot(page, filename) {
  const screenshot = await page.screenshot({
    path: join(outputDir, filename),
    fullPage: true,
  });
  assert(screenshot.byteLength >= minScreenshotBytes, `${filename} screenshot looks too small (${screenshot.byteLength} bytes < ${minScreenshotBytes} bytes)`);
}
