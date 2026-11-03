import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const [base, output] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const results = [];
try {
  for (const width of [1440, 390]) {
    for (let run = 0; run < 5; run++) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 40, downloadThroughput: 1250000, uploadThroughput: 625000 });
      await page.addInitScript(() => {
        window.lcp = null;
        new PerformanceObserver(list => { for (const entry of list.getEntries()) window.lcp = { ms: entry.startTime, tag: entry.element?.tagName, text: entry.element?.textContent?.slice(0, 100), url: entry.url }; }).observe({ type: "largest-contentful-paint", buffered: true });
      });
      await page.goto(base, { waitUntil: "networkidle", timeout: 120000 });
      await page.waitForTimeout(1000);
      results.push({ width, run, ...await page.evaluate(() => window.lcp) });
      await context.close();
    }
  }
} finally { await browser.close(); }
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({ base, profile: "fresh context; 40ms RTT; 10Mbps down; 5Mbps up; reduced motion; 5 samples", results }, null, 2));
console.log(JSON.stringify(results));
