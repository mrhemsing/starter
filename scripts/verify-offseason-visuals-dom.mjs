import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const [base, output] = process.argv.slice(2);
const review = JSON.parse(await readFile("src/data/season-review-2026.json", "utf8"));
const media = JSON.parse(await readFile("src/data/season-review-media-2026.json", "utf8"));
await mkdir(output, { recursive: true });
const result = { base, at: new Date().toISOString(), pages: [], images: [], cache: [], links: [] };
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const origin = new URL(base).origin;
function approvedImage(value) {
  const url = new URL(value, base);
  if (url.pathname === "/_next/image") return approvedImage(url.searchParams.get("url"));
  return url.origin === origin || ["img.mlbstatic.com", "img.youtube.com"].includes(url.hostname);
}
try {
  for (const route of ["/", "/2026"]) {
    for (let repeat = 0; repeat < 3; repeat++) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert(html.replaceAll("<!-- -->", "").includes("2026 Season in Review") && html.includes("Start of the Year / 2026"));
      assert(!/Warming up|Loading the board/.test(html), "no loading placeholders in raw HTML");
      const cache = response.headers.get("x-vercel-cache") ?? response.headers.get("x-nextjs-cache");
      if (!base.includes("127.0.0.1") && repeat > 0) assert.equal(cache, "HIT");
      result.cache.push({ route, repeat, cache, bytes: html.length, realHeading: true, skeleton: false });
      if (!repeat) await writeFile(path.join(output, route === "/" ? "home-raw.html" : "2026-raw.html"), html);
    }
    const nojs = await browser.newContext({ javaScriptEnabled: false });
    const staticPage = await nojs.newPage();
    await staticPage.goto(base + route);
    assert(await staticPage.locator("h1").isVisible(), "real heading visible without JS");
    assert(await staticPage.locator("[data-top-performer-pitcher-link]").first().isVisible(), "hero visible without JS");
    await nojs.close();
    for (const width of [1440, 390]) {
      console.log(`Checking ${route} at ${width}`);
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
      const page = await context.newPage();
      page.on("request", req => { if (req.resourceType() === "image") result.images.push({ route, width, url: req.url(), approved: approvedImage(req.url()) }); });
      await page.goto(base + route, { waitUntil: "networkidle", timeout: 120000 });
      const hero = page.locator("[data-top-performer-photo]");
      assert.equal(await hero.getAttribute("data-top-performer-photo"), media.image ? "action" : "headshot");
      const heroImage = hero.locator("img");
      await heroImage.evaluate(img => img.decode());
      assert(await heroImage.evaluate(img => img.naturalWidth > 0));
      const focal = await heroImage.evaluate(img => getComputedStyle(img).objectPosition);
      assert.equal(focal, width < 1024 ? media.image.mobileObjectPosition : media.image.objectPosition);
      const gameLog = hero.getByRole("link", { name: "Game log", exact: true });
      const href = await gameLog.getAttribute("href");
      assert(href.startsWith("/starts/2026-06-12/"));
      const linkResponse = await page.request.get(base + href);
      assert.equal(linkResponse.status(), 200);
      result.links.push({ href, status: linkResponse.status() });
      await hero.locator("button").filter({ hasText: "Video highlights" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      assert.equal(await dialog.locator("iframe").getAttribute("src"), review.highlight.embedUrl);
      await dialog.getByRole("button", { name: /close/i }).click();
      const rows = page.locator("[data-review-top-starts] > li");
      assert.equal(await rows.count(), route === "/" ? 5 : 25);
      for (const row of await rows.all()) assert.equal(await row.locator(".headshot img").count(), 1);
      assert(await page.locator("[data-ranked-archive-line]").evaluateAll(lines => lines.every(line => {
        const bounds = line.getBoundingClientRect();
        return [...line.querySelectorAll(".stat-token")].every(token => {
          const rect = token.getBoundingClientRect();
          return rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1;
        });
      })), "archive stat tokens stay inside their full-width row");
      for (const [index, start] of review.topStarts.slice(0, 5).entries()) {
        const row = rows.nth(index);
        assert.equal(await row.locator("[data-review-gem]").count(), media.highlights[start.id] ? 1 : 0);
        if (media.highlights[start.id]) assert.equal(await row.getByRole("button", { name: /^Play .* highlight/ }).count(), 1);
      }
      for (const [offset, start] of review.topStarts.slice(5, route === "/" ? 5 : 25).entries()) {
        const row = rows.nth(offset + 5);
        assert.equal(await row.locator("[data-review-gem]").count(), 0);
        const button = row.getByRole("button", { name: `Watch highlight: ${start.pitcher.name}, ${start.date}` });
        assert.equal(await button.count(), media.highlights[start.id] ? 1 : 0);
        if (media.highlights[start.id]) {
          await button.click();
          const modal = page.getByRole("dialog");
          const asset = media.highlights[start.id];
          const player = modal.locator(asset.source === "mlb-game-content" ? "video" : "iframe");
          assert.equal(await player.getAttribute("src"), asset.embedUrl);
          if (asset.source === "mlb-game-content") {
            await player.evaluate(video => new Promise((resolve, reject) => {
              if (video.readyState >= 1) return resolve(true);
              const timeout = setTimeout(() => reject(new Error("MLB video metadata timeout")), 20000);
              video.addEventListener("loadedmetadata", () => {clearTimeout(timeout); resolve(true);}, {once:true});
              video.addEventListener("error", () => {clearTimeout(timeout); reject(new Error("MLB video load failed"));}, {once:true});
            }));
          }
          await modal.getByRole("button", { name: "Close highlight" }).click();
        }
      }
      if (route === "/") {
        const cards = page.locator('[data-responsive-check="heat-row"]');
        assert.equal(await cards.count(), review.home.hot.length + review.home.cold.length);
        for (const card of await cards.all()) assert.equal(await card.locator(".headshot img").count(), 1);
      } else {
        for (const id of ["arm", "gems", "blowup", "streak"]) assert(await page.locator(`#${id} .headshot img`).count() > 0);
      }
      // Trigger all below-fold lazy images, then verify decoded images and sizing.
      for (const img of await page.locator("main img").all()) {
        await img.scrollIntoViewIfNeeded();
        await img.evaluate(el => el.decode());
        assert(await img.evaluate(el => el.naturalWidth > 0 && el.getBoundingClientRect().width > 0));
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal overflow");
      const text = await page.locator("main").innerText();
      assert(!/\u2014|Warming up|Loading the board/.test(text));
      await page.evaluate(() => scrollTo(0, 0));
      const prefix = route === "/" ? "home" : "2026";
      await page.screenshot({ path: path.join(output, `${prefix}-${width}.png`), fullPage: true });
      for (const [label, selector] of [["hero", "[data-season-review-hero]"], ["rows", "#top-starts"], ...(route === "/" ? [["movers", '[data-responsive-check="heat-check-hero"]']] : [["awards", "#arm"]])]) {
        await page.locator(selector).screenshot({ path: path.join(output, `${prefix}-${label}-${width}.png`) });
      }
      result.pages.push({ route, width, heading: await page.locator("h1").innerText(), focal, rows: await rows.count(), imageCount: await page.locator("main img").count(), noSkeleton: true });
      await context.close();
    }
  }
  // Render the actual no-asset component fixture in a browser and observe its image requests.
  const fixture = await readFile("../../reports/OFF-1.1/no-asset-fixture.html", "utf8");
  const page = await browser.newPage();
  const fixtureRequests = [];
  page.on("request", req => { if (req.resourceType() === "image") fixtureRequests.push(req.url()); });
  await page.route("**/off11-no-asset-fixture", route => route.fulfill({ contentType: "text/html", body: fixture }));
  await page.goto(base + "/off11-no-asset-fixture");
  await page.locator("img").scrollIntoViewIfNeeded();
  await page.locator("img").evaluate(img => img.decode());
  assert(fixtureRequests.length > 0 && fixtureRequests.every(approvedImage));
  assert.equal(await page.locator('[data-top-performer-photo="headshot"] img').count(), 1);
  result.fixture = { state: "headshot", imageRequests: fixtureRequests, approved: true };
  assert(result.images.every(row => row.approved), "all image requests use existing MLB/MLB-channel hosts");
  console.log(JSON.stringify({ pages: result.pages, cache: result.cache, images: result.images.length, fixture: result.fixture }, null, 2));
} finally {
  await writeFile(path.join(output, "dom-network-results.json"), JSON.stringify(result, null, 2));
  await browser.close();
}
