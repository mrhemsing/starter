import { stat } from "node:fs/promises";
import { chromium } from "playwright-core";

const baseUrl = process.env.THE_BUMP_BASE_URL ?? "http://127.0.0.1:3000";
const chromePath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch({ executablePath: chromePath });
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
  });
  const page = await context.newPage();
  const resourceBytes = [];
  page.on("response", async (response) => {
    if (!response.url().startsWith(baseUrl)) return;
    try {
      resourceBytes.push({ url: response.url(), bytes: (await response.body()).byteLength });
    } catch {
      // Redirects and streaming responses may not expose a body.
    }
  });

  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(3_000);
  const images = await page.locator("img").evaluateAll((nodes) => nodes.map((node) => ({
    src: node.currentSrc || node.src,
    loading: node.loading,
    width: node.width,
    height: node.height,
    belowFold: node.getBoundingClientRect().top >= window.innerHeight,
  })));
  const preloadImages = await page.locator('link[rel="preload"][as="image"]').count();
  const localActionImages = images.filter((image) => image.src.includes("/images/top-performer-action-shots/"));
  const localActionSizes = await Promise.all(localActionImages.map(async (image) => {
    const pathname = new URL(image.src).pathname;
    return { pathname, bytes: (await stat(`public${pathname}`)).size };
  }));
  const transferEntries = await page.evaluate(() => performance.getEntriesByType("resource").map((entry) => ({
    url: entry.name,
    bytes: "transferSize" in entry ? entry.transferSize : 0,
  })));
  const documentBytes = await page.evaluate(() => {
    const entry = performance.getEntriesByType("navigation")[0];
    return entry && "transferSize" in entry ? entry.transferSize : 0;
  });
  const totalBytes = documentBytes + transferEntries.reduce((sum, resource) => sum + resource.bytes, 0);
  const largestResources = [{ url: `${baseUrl}/`, bytes: documentBytes }, ...transferEntries].sort((a, b) => b.bytes - a.bytes).slice(0, 12);

  assert(totalBytes < 1_500_000, `homepage transferred ${totalBytes} bytes, expected under 1500000: ${JSON.stringify(largestResources)}`);
  assert(images.every((image) => !image.src.includes("maxresdefault")), "rendered homepage contains maxresdefault");
  assert(images.every((image) => !image.src.endsWith(".png")), "rendered homepage contains a PNG image URL");
  const eagerBelowFold = images.filter((image) => image.belowFold && image.loading !== "lazy");
  assert(eagerBelowFold.length === 0, `below-fold images are not lazy loaded: ${JSON.stringify(eagerBelowFold)}`);
  assert(preloadImages <= 1, `homepage preloads ${preloadImages} images, expected at most one`);
  assert(localActionSizes.every((image) => image.bytes <= 150_000), `oversized action image: ${JSON.stringify(localActionSizes)}`);
  assert(images.every((image) => image.width > 0 && image.height > 0), "an image rendered without dimensions");

  console.log("homepage performance contract passed", {
    totalBytes,
    requests: resourceBytes.length,
    images: images.length,
    belowFoldImages: images.filter((image) => image.belowFold).length,
    preloadImages,
    actionImages: localActionSizes,
  });
} finally {
  await browser.close();
}
