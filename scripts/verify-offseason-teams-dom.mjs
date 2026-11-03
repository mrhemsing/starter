import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const base = process.argv[2];
const out = process.argv[3];
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const results = [];
try {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await context.clearCookies();
    let response = await page.goto(`${base}/watchlist?q=Michael%20Lorenzen`, { timeout: 120000 });
    assert.equal(response.status(), 200);
    await page.getByText("Track your arms through the offseason", { exact: true }).waitFor();
    const suggestion = page.locator('[data-responsive-check="watchlist-follow-search-results"]');
    await suggestion.getByText("Michael Lorenzen", { exact: true }).waitFor();
    assert((await suggestion.innerText()).includes("TOR"));
    await page.screenshot({ path: path.join(out, `suggested-${width}.png`), fullPage: true });
    results.push({ surface: "suggested follows", width, currentTeam: "TOR", status: 200 });
    await context.addCookies([{ name: "the_bump_watchlist_id", value: "wlids_547179", url: base }]);
    response = await page.goto(`${base}/watchlist`, { timeout: 120000 });
    assert.equal(response.status(), 200);
    await page.getByText("Team updated to TOR", { exact: true }).waitFor();
    const body = await page.locator("body").innerText();
    assert(body.includes("Final 2026 form"));
    assert(body.includes("Next start: 2027 season"));
    assert(body.includes("Wire"));
    assert(!/NEXT:\s*TBD/i.test(body));
    assert(!body.includes("YOUR MORNING BRIEF"));
    assert(!/\b(today|tomorrow|tonight|next up)\b/i.test(body));
    await page.screenshot({ path: path.join(out, `followed-${width}.png`), fullPage: true });
    await writeFile(path.join(out, `followed-${width}.txt`), body);
    results.push({ surface: "followed card", width, currentTeam: "TOR", note: "Team updated to TOR", status: 200 });
    const link = page.locator('a[href*="547179"]').filter({ hasText: "Michael Lorenzen" }).first();
    const href = await link.getAttribute("href");
    response = await page.goto(new URL(href, base).href, { timeout: 120000 });
    assert.equal(response.status(), 200);
    const hero = page.locator('[data-responsive-check="pitcher-form-hero"]');
    await hero.waitFor();
    assert(/TOR \/ LAST/i.test(await hero.innerText()));
    const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
    assert(schemas.some((text) => JSON.parse(text).memberOf?.name === "TOR"));
    await page.screenshot({ path: path.join(out, `pitcher-${width}.png`), fullPage: true });
    results.push({ surface: "pitcher header", width, currentTeam: "TOR", status: 200 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "no horizontal overflow");
  }
  const unauthorized = await fetch(`${base}/api/cron/offseason-teams`);
  assert.equal(unauthorized.status, 401);
  await writeFile(path.join(out, "result.json"), JSON.stringify({ base, checkedAt: new Date().toISOString(), results, unauthorizedCron: 401 }, null, 2));
  console.log(JSON.stringify({ results, unauthorizedCron: 401 }));
} finally { await browser.close(); }
