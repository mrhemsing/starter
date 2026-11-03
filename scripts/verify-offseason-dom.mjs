import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const base = process.argv[2] ?? "http://127.0.0.1:3118";
const out = process.argv[3] ?? ".responsive-screenshots/offseason";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const routes = ["/", "/live", "/upcoming", "/upcoming/streamers", "/watchlist", "/heat-check", "/heat-check?view=trend", "/best-starts", "/rotations", "/starts", "/pitchers", "/leaderboard", "/leaderboard/2026", "/leaderboard/ceiling", "/leaderboard/consistency", "/duels", "/parks", "/glossary", "/methodology", "/tools", "/upcoming/week", "/upcoming/2026-11-03", "/upcoming/week/2026-11-02", "/teams/MIL"];
const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  for (const route of routes) {
    try {
      const response = await page.goto(base + route, { timeout: 120000 });
      await page.locator("h1").first().waitFor({ timeout: 30000 });
      await page.waitForFunction(() => ![...document.querySelectorAll("h1")].some((node) => node.textContent === "Warming up"), { timeout: 30000 });
      await page.waitForTimeout(500);
      const text = await page.locator("body").innerText();
      const timeWords = text.split("\n").filter((line) => /\b(today|tomorrow|tonight|next up|countdown)\b/i.test(line));
      const result = { route, status: response.status(), headings: await page.locator("h1").allTextContents(), timeWords };
      if (routes.indexOf(route) < 6) {
        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.screenshot({ path: path.join(out, `${route.replace(/\W/g, "_") || "home"}-${width}.png`), fullPage: true });
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
      }
      await writeFile(path.join(out, `${route.replace(/\W/g, "_") || "home"}.txt`), text);
      if (route === "/heat-check") {
        result.seasonHeader = text.includes("Final 2026 form");
        result.seasonDefault = text.includes("SEASON LIST");
      }
      results.push(result);
      console.log(JSON.stringify(result));
    } catch (error) { results.push({ route, error: error.message }); console.log(route, error.message); }
    await writeFile(path.join(out, "dom-audit.json"), JSON.stringify({ base, checkedAt: new Date().toISOString(), results }, null, 2));
  }
} finally { await browser.close(); }
if (results.some((row) => row.error || row.status >= 400 || row.timeWords.length)) process.exitCode = 1;
