import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const baseUrl = normalizeBaseUrl(process.env.THE_BUMP_BASE_URL ?? "http://127.0.0.1:3000");
const chromePath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const archiveDir = path.join(process.cwd(), "data", "mlb-archive", "2026", "dates");
const limit = Number(process.env.THE_BUMP_RENDERED_PHOTO_LIMIT ?? 0);
const progressEvery = Number(process.env.THE_BUMP_RENDERED_PHOTO_PROGRESS_EVERY ?? 25);

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail ? `\n${JSON.stringify(detail, null, 2)}` : "";
    throw new Error(`${message}${suffix}`);
  }
}

const leaders = await readArchivedStartOfDayLeaders();
const targets = limit > 0 ? leaders.slice(-limit) : leaders;

const browser = await chromium.launch({ executablePath: chromePath });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const failures = [];

  for (const leader of targets) {
    const route = `/starts/${leader.date}`;
    await page.goto(new URL(route, baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });

    const hero = page.locator('[data-responsive-check="ranked-starts-archived-hero"] [data-responsive-check="home-top-performer-marquee"]').first();
    const heroCount = await hero.count();
    if (heroCount === 0) {
      failures.push({ date: leader.date, pitcher: leader.pitcherName, startId: leader.startId, reason: "missing-hero" });
      continue;
    }

    const rendered = await hero.evaluate((element) => ({
      photo: element.getAttribute("data-top-performer-photo"),
      pitcher: element.getAttribute("data-top-performer-pitcher"),
      text: element.textContent ?? "",
      imageSrc: element.querySelector("img")?.getAttribute("src") ?? null,
    }));

    const localActionImageMatch = rendered.imageSrc?.match(/url=([^&]+)/);
    const renderedImageUrl = localActionImageMatch ? decodeURIComponent(localActionImageMatch[1]) : rendered.imageSrc;
    const rendersStoredLocalActionImage =
      typeof renderedImageUrl === "string" &&
      renderedImageUrl.startsWith("/images/top-performer-action-shots/") &&
      /\.(?:jpg|jpeg|png|webp)$/i.test(renderedImageUrl);

    if (rendered.photo !== "action" || !rendersStoredLocalActionImage) {
      failures.push({
        date: leader.date,
        expectedArchiveLeader: leader.pitcherName,
        expectedArchiveLeaderStartId: leader.startId,
        rendered,
        renderedImageUrl,
      });
    }

    if (progressEvery > 0 && (targets.indexOf(leader) + 1) % progressEvery === 0) {
      console.log("rendered photo audit progress", { checked: targets.indexOf(leader) + 1, total: targets.length });
    }
  }

  assert(failures.length === 0, `rendered ranked Start of the Day photo audit failed for ${failures.length} date(s)`, failures);
  await context.close();
} finally {
  await browser.close();
}

console.log("rendered ranked Start of the Day photos ok", {
  baseUrl,
  checked: targets.length,
  total: leaders.length,
});

async function readArchivedStartOfDayLeaders() {
  const files = (await readdir(archiveDir)).filter((file) => file.endsWith(".json")).sort();
  const leaders = [];

  for (const file of files) {
    const date = file.replace(/\.json$/, "");
    const archive = JSON.parse(await readFile(path.join(archiveDir, file), "utf8"));
    const starts = [];
    for (const game of archive.games ?? []) {
      for (const start of game.starts ?? []) {
        if (archivedStartInnings(start.line?.inningsPitched) < 2) continue;
        starts.push({
          ...start,
          date,
          gamePk: game.gamePk,
          startId: `${date}-${start.team.toLowerCase()}-${start.opponent.toLowerCase()}-${start.pitcherMlbId}`,
        });
      }
    }
    if (starts.length === 0) continue;
    starts.sort(compareArchivedStartOfDay);
    leaders.push(starts[0]);
  }

  return leaders;
}

function compareArchivedStartOfDay(a, b) {
  return (
    b.gameScorePlus - a.gameScorePlus ||
    archivedStartInnings(b.line.inningsPitched) - archivedStartInnings(a.line.inningsPitched) ||
    a.line.earnedRuns - b.line.earnedRuns ||
    b.line.strikeouts - a.line.strikeouts ||
    a.line.walks - b.line.walks ||
    a.line.hits - b.line.hits ||
    a.date.localeCompare(b.date) ||
    (a.gamePk ?? 0) - (b.gamePk ?? 0) ||
    (a.pitcherName ?? "").localeCompare(b.pitcherName ?? "")
  );
}

function archivedStartInnings(ip) {
  const value = Number(ip) || 0;
  const whole = Math.trunc(value);
  const outs = Math.round((value - whole) * 10);
  return whole + outs / 3;
}

function normalizeBaseUrl(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
