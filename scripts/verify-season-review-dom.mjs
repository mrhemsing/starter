import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const base = process.argv[2];
const out = process.argv[3];
if (!base || !out) throw new Error("Usage: verify-season-review-dom.mjs BASE OUTPUT");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const result = { base, at: new Date().toISOString(), pages: [], links: [], cache: [] };
try {
  const page = await browser.newPage({ reducedMotion: "reduce" });
  for (const route of ["/2026", "/", "/2026/rotations"]) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const response = await page.goto(base + route, { timeout: 120000 });
      assert.equal(response.status(), 200);
      await page.waitForTimeout(250);
      const text = await page.locator("main").innerText();
      assert(!/\b(today|tomorrow|tonight|next up|countdown)\b/i.test(text));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "horizontal overflow");
      if (route === "/2026") {
        assert.equal(await page.locator("[data-review-top-starts] > li").count(), 25);
        assert.equal(await page.locator("[data-review-no-hit-bids] > li").count(), 14);
        const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
        const data = ld.flatMap((value) => JSON.parse(value));
        assert(data.some((row) => row["@type"] === "Article" && row.datePublished));
        assert(data.some((row) => row["@type"] === "ItemList" && row.itemListElement.length === 25 && row.itemListElement.every((item, index) => item.position === index + 1)));
        if (width === 1440) result.links = [...new Set(await page.locator('main a[href^="/"]').evaluateAll((links) => links.map((link) => link.getAttribute("href"))))];
      }
      if (route === "/") assert(text.includes("Final 2026 form"));
      await page.screenshot({ path: path.join(out, `${route.replace(/\W/g, "_")}-${width}.png`), fullPage: true });
      result.pages.push({ route, width, status: response.status(), headings: await page.locator("h1").allTextContents() });
    }
  }
  for (let index = 0; index < 3; index++) {
    const response = await fetch(base + "/2026");
    const bytes = await response.text();
    result.cache.push({ status: response.status, cache: response.headers.get("x-vercel-cache") ?? response.headers.get("x-nextjs-cache"), sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  assert.equal(new Set(result.cache.map((row) => row.sha256)).size, 1, "later loads byte-identical");
  if (!base.includes("127.0.0.1")) assert(result.cache.slice(1).every((row) => row.cache === "HIT"), "repeated production cache HIT");
  const hrefs = result.links;
  result.links = [];
  for (let index = 0; index < hrefs.length; index += 4) {
    const batch = await Promise.all(hrefs.slice(index, index + 4).map(async (href) => {
      const response = await page.request.get(base + href, { timeout: 120000 });
      return { href, status: response.status() };
    }));
    result.links.push(...batch);
    console.log(`Internal links checked: ${result.links.length}/${hrefs.length}`);
  }
  assert(result.links.every((row) => row.status === 200), "all internal links resolve 200");
  console.log(JSON.stringify({ pages: result.pages, cache: result.cache, links: result.links.length }));
} finally {
  await writeFile(path.join(out, "review-dom.json"), JSON.stringify(result, null, 2));
  await browser.close();
}
