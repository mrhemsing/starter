import { chromium } from "playwright-core";

const baseUrl = normalizeBaseUrl(process.env.THE_BUMP_SLATE_SYNC_BASE_URL ?? process.env.THE_BUMP_BASE_URL ?? "https://www.toetheslab.com");
const chromePath = process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const explicitDate = process.env.THE_BUMP_SLATE_SYNC_DATE;
const explicitSettledDate = process.env.THE_BUMP_SLATE_SYNC_SETTLED_DATE;

function assert(condition, message, detail) {
  if (!condition) {
    const suffix = detail ? `\n${JSON.stringify(detail, null, 2)}` : "";
    console.error("[slate-sync] divergence", { message, detail });
    throw new Error(`${message}${suffix}`);
  }
}

const statusPath = explicitDate ? `/api/home/status?date=${encodeURIComponent(explicitDate)}` : "/api/home/status";
const slateState = await fetchJson(statusPath);
const date = slateState.date;
const settledDate = explicitSettledDate ?? previousDate(date);
const [liveBoard, slateApi, settledState, settledSlateApi] = await Promise.all([
  fetchJson(`/api/live/${date}`),
  fetchJson(`/api/slate/today/${date}`),
  fetchJson(`/api/home/status?date=${encodeURIComponent(settledDate)}`),
  fetchJson(`/api/slate/yesterday/${settledDate}`),
]);

assertSlateProgressAgreement("status-api/live-board", slateState, liveBoard.slateProgress);
assertSlateProgressAgreement("status-api/slate-api", slateState, progressFromSlateApi(slateApi, slateState));

const browser = await chromium.launch({ executablePath: chromePath });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await assertRenderedCounts(page, "home", slateState);
  await assertNoBannedArchiveVocabulary(page, "home");

  await page.goto(`${baseUrl}/live/${date}`, { waitUntil: "networkidle" });
  await assertLiveBoard(page, liveBoard);
  await assertNoBannedArchiveVocabulary(page, "live");

  await page.goto(`${baseUrl}/starts/${date}`, { waitUntil: "networkidle" });
  await assertRenderedCounts(page, "ranked", slateState);
  await assertNoBannedArchiveVocabulary(page, "current-ranked");

  await page.goto(`${baseUrl}/starts/${settledDate}`, { waitUntil: "networkidle" });
  await assertRenderedCounts(page, "ranked", settledState);
  assert(settledState.state === "all-starts-complete", "settled date status API must report complete", { settledDate, settledState });
  await assertSettledRankedLeader(page, settledSlateApi);
  await assertNoBannedArchiveVocabulary(page, "settled-ranked");
} finally {
  await browser.close();
}

console.log("slate sync ok", {
  baseUrl,
  date,
  status: compactProgress(slateState),
  live: compactProgress(liveBoard.slateProgress),
  settledDate,
  settled: compactProgress(settledState),
});

async function fetchJson(path) {
  const response = await fetch(new URL(path, baseUrl), { cache: "no-store" });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    assert(false, `fetch ${path} failed`, { status: response.status, body });
  }
  return response.json();
}

function assertSlateProgressAgreement(label, left, right) {
  assert(right, `${label} missing right progress`);
  const leftProgress = compactProgress(left);
  const rightProgress = compactProgress(right);
  assert(
    leftProgress.state === rightProgress.state &&
      leftProgress.totalStarts === rightProgress.totalStarts &&
      leftProgress.completedStarts === rightProgress.completedStarts &&
      leftProgress.liveStarts === rightProgress.liveStarts,
    `${label} slate progress mismatch`,
    { left: leftProgress, right: rightProgress },
  );
}

function progressFromSlateApi(slateApi, fallback) {
  const totalStarts = slateApi.counts?.starts ?? fallback.totalStarts;
  const finalStarts = (slateApi.starts ?? []).filter((start) => start.source?.line !== "fixture").length;
  const completedStarts = Math.max(fallback.completedStarts, finalStarts);
  const liveStarts = fallback.liveStarts;
  return {
    date: slateApi.date ?? fallback.date,
    state: completedStarts >= totalStarts && totalStarts > 0 ? "all-starts-complete" : fallback.state,
    totalStarts,
    completedStarts,
    liveStarts: completedStarts >= totalStarts && totalStarts > 0 ? 0 : liveStarts,
  };
}

async function assertRenderedCounts(page, variant, expected) {
  const selector = `[data-slate-counts="${variant}"]`;
  await page.locator(selector).first().waitFor({ timeout: 15_000 });
  await page.waitForFunction(
    ({ selector, expected }) => {
      const element = document.querySelector(selector);
      if (!element) return false;
      return element.getAttribute("data-slate-state") === expected.state &&
        Number(element.getAttribute("data-slate-completed-starts")) === expected.completedStarts &&
        Number(element.getAttribute("data-slate-live-starts")) === expected.liveStarts;
    },
    { selector, expected: compactProgress(expected) },
    { timeout: 15_000 },
  );
}

async function assertLiveBoard(page, board) {
  const boardSelector = "[data-live-board-date]";
  await page.locator(boardSelector).first().waitFor({ timeout: 15_000 });
  const rendered = await page.locator(boardSelector).first().evaluate((element) => ({
    date: element.getAttribute("data-live-board-date"),
    liveStarts: Number(element.getAttribute("data-live-starts")),
    finalStarts: Number(element.getAttribute("data-final-starts")),
    scheduledStarts: Number(element.getAttribute("data-scheduled-starts")),
  }));
  assert(
    rendered.date === board.date &&
      rendered.liveStarts === board.liveStarts &&
      rendered.finalStarts === board.finalStarts &&
      rendered.scheduledStarts === board.scheduledStarts,
    "live board rendered counts must match live API",
    { rendered, api: { date: board.date, liveStarts: board.liveStarts, finalStarts: board.finalStarts, scheduledStarts: board.scheduledStarts } },
  );
}

async function assertSettledRankedLeader(page, slateApi) {
  const topApiStart = [...(slateApi.starts ?? [])].sort(compareStarts)[0];
  assert(topApiStart, "settled slate API must expose at least one ranked start", { date: slateApi.date });
  const firstCard = page.locator('[data-responsive-check="ranked-start-card"]:not([data-skeleton-row])').first();
  await firstCard.waitFor({ timeout: 15_000 });
  const renderedRaw = await firstCard.evaluate((element) => ({
    rank: element.getAttribute("data-rank"),
    gsPlus: element.getAttribute("data-gs-plus"),
    pitcherName: element.getAttribute("data-pitcher-name"),
    text: element.textContent ?? "",
  }));
  const rendered = {
    ...renderedRaw,
    rank: numberValue(renderedRaw.rank) ?? numberFromText(renderedRaw.text, /#(\d+)/),
    gsPlus: numberValue(renderedRaw.gsPlus) ?? numberFromText(renderedRaw.text, /(\d{2,3})\s*GS\+/),
  };
  assert(
    rendered.rank === 1 &&
      rendered.gsPlus === topApiStart.gameScorePlus &&
      (rendered.pitcherName === topApiStart.pitcherName || rendered.text.includes(topApiStart.pitcherName)),
    "settled ranked #1 must match top canonical GS+",
    { rendered, api: { pitcherName: topApiStart.pitcherName, gameScorePlus: topApiStart.gameScorePlus, rank: topApiStart.rank } },
  );
}

function numberFromText(text, pattern) {
  const match = text.match(pattern);
  if (!match?.[1]) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberValue(value) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function assertNoBannedArchiveVocabulary(page, surface) {
  const bodyText = await page.locator("body").innerText({ timeout: 10_000 });
  const banned = ["context at settle", "canonical context", "slate context"].filter((term) => bodyText.toLowerCase().includes(term));
  assert(banned.length === 0, `${surface} rendered banned archive vocabulary`, { surface, banned });
}

function compareStarts(a, b) {
  return (
    b.gameScorePlus - a.gameScorePlus ||
    inningsFromIP(b.line?.inningsPitched ?? 0) - inningsFromIP(a.line?.inningsPitched ?? 0) ||
    (a.line?.earnedRuns ?? 0) - (b.line?.earnedRuns ?? 0) ||
    (b.line?.strikeouts ?? 0) - (a.line?.strikeouts ?? 0) ||
    (a.line?.walks ?? 0) - (b.line?.walks ?? 0) ||
    (a.line?.hits ?? 0) - (b.line?.hits ?? 0) ||
    String(a.pitcherName ?? "").localeCompare(String(b.pitcherName ?? ""))
  );
}

function inningsFromIP(value) {
  const whole = Math.trunc(value);
  return whole * 3 + Math.round((value - whole) * 10);
}

function compactProgress(progress) {
  return {
    date: progress.date,
    state: progress.state,
    totalStarts: progress.totalStarts,
    completedStarts: progress.completedStarts,
    liveStarts: progress.liveStarts,
  };
}

function previousDate(date) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() - 1);
  return parsed.toISOString().slice(0, 10);
}

function normalizeBaseUrl(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
