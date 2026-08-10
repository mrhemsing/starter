import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import net from "node:net";

const host = "127.0.0.1";
const formService = await readFile(new URL("../src/lib/data/form-service.ts", import.meta.url), "utf8");
assert(
  /const getCachedFormHome = unstable_cache\([\s\S]*\{ revalidate: FORM_DATA_REVALIDATE_SECONDS, tags: \[HEAT_CHECK_CACHE_TAG, SLATE_CACHE_TAG\] \}/.test(formService),
  "Form Home cache must invalidate with both Heat Check tuning and slate/archive refreshes",
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function reservePort() {
  const server = net.createServer();
  server.listen(0, host);
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object", "could not reserve a local port");
  const port = address.port;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

async function waitForHttp(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`server did not become ready at ${url}: ${lastError?.message ?? "unknown error"}`);
}

function stopProcessTree(child) {
  if (!child.pid || child.exitCode !== null) return;

  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    } catch {
      // The server may already have exited; keep the original failure visible.
    }
    return;
  }

  child.kill("SIGTERM");
}

function sumValues(values) {
  return Object.values(values).reduce((total, value) => total + Number(value), 0);
}

async function fetchJson(url, label) {
  const response = await fetch(url);
  assert(response.ok, `${label} returned HTTP ${response.status}`);
  return response.json();
}

function assertHomePayload(home, calibration, label) {
  assert(home.window === calibration.window, `${label} window must match calibration window`);
  const homeGeneratedAt = Date.parse(home.generatedAt);
  const calibrationGeneratedAt = Date.parse(calibration.generatedAt);
  assert(
    Number.isFinite(homeGeneratedAt) && Number.isFinite(calibrationGeneratedAt),
    `${label} and calibration snapshots must expose valid generatedAt timestamps`,
  );
  const snapshotsShareCacheWindow = home.generatedAt === calibration.generatedAt;
  if (snapshotsShareCacheWindow) {
    assert(
      Math.abs(home.totalQualified - calibration.counts.qualified) <= 1,
      `${label} qualified count ${home.totalQualified} must match calibration ${calibration.counts.qualified} within one adjacent cache-generation pitcher`,
    );
  }
  assert(home.leagueMeanGS >= 49 && home.leagueMeanGS <= 51, `${label} league mean GS+ must stay centered near 50 after archive purges, got ${home.leagueMeanGS}`);
  assert(sumValues(home.bands) === home.totalQualified, `${label} heat band counts must sum to qualified count`);
  if (snapshotsShareCacheWindow && home.totalQualified === calibration.counts.qualified) {
    for (const [key, count] of Object.entries(calibration.counts.bands)) {
      assert(home.bands[key] === count, `${label} band ${key} count ${home.bands[key]} must match calibration ${count}`);
    }
  }
  assert(home.hot.length > 0, `${label} expected hot rail entries`);
  assert(home.cold.length > 0, `${label} expected cold rail entries`);
}

function assertCalibrationPage(html, calibration, label) {
  const normalizedPageHtml = html.replaceAll("<!-- -->", "");
  const pageWindow = Number(normalizedPageHtml.match(/data-form-debug-window="(\d+)"/)?.[1]);
  const pageQualified = Number(normalizedPageHtml.match(/data-form-debug-qualified="(\d+)"/)?.[1]);
  assert(normalizedPageHtml.includes("Form calibration"), `${label} should render the calibration page`);
  assert(normalizedPageHtml.includes("Heat bands"), `${label} should render Heat band readouts`);
  assert(normalizedPageHtml.includes("Config snapshot"), `${label} should render the config snapshot`);
  assert(pageWindow === calibration.window, `${label} should render window ${calibration.window}, got ${pageWindow}`);
  assert(pageQualified > 0, `${label} should render a positive qualified pitcher count, got ${pageQualified}`);
  assert(normalizedPageHtml.includes("On Fire") && normalizedPageHtml.includes("Heating Up") && normalizedPageHtml.includes("Cooling Off") && normalizedPageHtml.includes("Ice Cold"), `${label} should render FORM band labels`);
  assert(normalizedPageHtml.includes("Misiorowski") && normalizedPageHtml.includes("Top FORM") && normalizedPageHtml.includes("Bottom FORM"), `${label} should render FORM diagnostic leaderboards`);
}

function assertCalibrationPayload(calibration, expectedWindow, label, options = {}) {
  assert(calibration.window === Number(expectedWindow), `${label} expected window ${expectedWindow}, got ${calibration.window}`);
  assert(calibration.counts?.qualified > 0, `${label} expected at least one qualified pitcher`);
  assert(sumValues(calibration.counts.bands) === calibration.counts.qualified, `${label} heat band counts must sum to qualified count`);
  assert(calibration.config?.heatIndexTrendWeight !== undefined, `${label} config snapshot missing heatIndexTrendWeight`);
  const windowThresholds = calibration.config?.directionBandThresholds?.[String(expectedWindow)];
  assert(
    windowThresholds &&
      Number.isFinite(windowThresholds.onFireDelta) &&
      Number.isFinite(windowThresholds.heatingDelta) &&
      Number.isFinite(windowThresholds.coolingDelta) &&
      Number.isFinite(windowThresholds.iceColdDelta),
    `${label} config snapshot missing window-specific direction-band thresholds`,
  );
  assert(calibration.config?.buyLowGsPlusMax === 50 && calibration.config?.sellHighGsPlusMin === 58, `${label} config snapshot missing crossover thresholds`);
  assert(calibration.bandShare?.onfire !== undefined, `${label} debug payload missing band shares`);
  for (const key of ["min", "p10", "p20", "p30", "p40", "p50", "p60", "p70", "p80", "p90", "p95", "max", "mean", "stddev"]) {
    assert(Number.isFinite(calibration.rgs[key]), `${label} FORM distribution missing ${key}`);
  }
  assert(calibration.misiorowski && typeof calibration.misiorowski.present === "boolean", `${label} must expose the Misiorowski diagnostic`);
  if (calibration.misiorowski.present) {
    assert(Array.isArray(calibration.misiorowski.gsPlusInputs) && calibration.misiorowski.gsPlusInputs.length > 0, `${label} present Misiorowski diagnostic must include per-start GS+ inputs`);
  }
  assert(Array.isArray(calibration.topForm) && calibration.topForm.length === 5, `${label} must report top 5 FORM pitchers`);
  assert(Array.isArray(calibration.bottomForm) && calibration.bottomForm.length === 5, `${label} must report bottom 5 FORM pitchers`);
  if (options.requireCenteredMean) {
    assert(
      calibration.heatIndex.mean >= 46 && calibration.heatIndex.mean <= 54,
      `${label} heat index mean should stay centered near 50, got ${calibration.heatIndex.mean}`,
    );
  }
  assert(calibration.trendDelta.p25 < 0 && calibration.trendDelta.p75 > 0, `${label} trendDelta should span both cooling and heating sides`);
  if (calibration.counts.qualified >= 40) {
    assert(calibration.counts.bands.onfire > 0, `${label} On Fire band should be reachable for a full league window`);
    assert(calibration.counts.bands.ice > 0, `${label} Ice Cold band should be reachable for a full league window`);
    assert(
      calibration.counts.bands.even / calibration.counts.qualified < 0.65,
      `${label} Even band should not absorb a collapsed majority, got ${calibration.counts.bands.even}/${calibration.counts.qualified}`,
    );
  }
  if (String(expectedWindow) === "5" && calibration.misiorowski.present) {
    assert(directionMatchesDelta(calibration.misiorowski.band, calibration.misiorowski.deltaForm), `${label} Misiorowski direction band must agree with displayed delta`);
  }
}

function directionMatchesDelta(band, delta) {
  if (band === "onfire" || band === "hot") return delta > 0;
  if (band === "cooling" || band === "ice") return delta < 0;
  return band === "even";
}

function assertTrendRender(html, label) {
  const rowTags = [...html.matchAll(/<article\b[^>]*data-form-row[^>]*>/g)].map((match) => match[0]);
  const visibleRows = rowTags.filter((tag) => /data-display-rank="\d+"/.test(tag) && !tag.includes('data-heat-overflow-hidden="true"') && !tag.includes("data-heat-limited-sample-row"));
  assert(visibleRows.length > 0, `${label} must render visible ranked trend rows`);
  const ranks = visibleRows.map((tag) => Number(tag.match(/data-display-rank="(\d+)"/)?.[1]));
  const sortedRanks = [...ranks].sort((a, b) => a - b);
  assert(sortedRanks.every((rank, index) => rank === index + 1), `${label} display ranks must be dense and unique, got ${ranks.join(",")}`);
  for (const tag of visibleRows) {
    const band = tag.match(/data-heat-band="([^"]+)"/)?.[1];
    const delta = Number(tag.match(/data-form-delta="([^"]+)"/)?.[1]);
    assert(directionMatchesDelta(band, delta), `${label} direction contradiction: band=${band}, delta=${delta}`);
    assert(/data-form-rank="\d+"/.test(tag), `${label} trend row must preserve labeled form rank telemetry`);
  }
  return ranks;
}

const windowSize = process.env.THE_BUMP_FORM_WINDOW ?? "5";
const calibrationWindows = ["3", "5", "10"];
const alternateWindowSize = calibrationWindows.find((candidate) => candidate !== windowSize) ?? "3";
const port = await reservePort();
const baseUrl = `http://${host}:${port}`;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
  env: {
    ...process.env,
    PORT: String(port),
    THE_BUMP_FORM_DEBUG: "1",
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=8192`.trim(),
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
server.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

try {
  await waitForHttp(baseUrl);

  const response = await fetch(`${baseUrl}/api/form/debug?window=${encodeURIComponent(windowSize)}`);
  assert(response.ok, `/api/form/debug returned HTTP ${response.status}`);
  const calibration = await response.json();
  const homeResponse = await fetch(`${baseUrl}/api/form/home?window=${encodeURIComponent(windowSize)}`);
  assert(homeResponse.ok, `/api/form/home returned HTTP ${homeResponse.status}`);
  const home = await homeResponse.json();
  const defaultCalibration = String(calibration.window) === "5" ? calibration : await fetchJson(`${baseUrl}/api/form/debug?window=5`, "/api/form/debug?window=5");
  const defaultHome = String(home.window) === "5" ? home : await fetchJson(`${baseUrl}/api/form/home?window=5`, "/api/form/home?window=5");

  assertCalibrationPayload(calibration, windowSize, "/api/form/debug", { requireCenteredMean: true });
  assertHomePayload(home, calibration, "/api/form/home");
  assert(calibration.counts.bands.even > 0, "FORM-band calibration should leave a populated middle band");

  const windowCalibrations = new Map([[String(calibration.window), calibration]]);

  const alternateWindowResponse = await fetch(`${baseUrl}/api/form/debug?window=${encodeURIComponent(alternateWindowSize)}`);
  assert(alternateWindowResponse.ok, `/api/form/debug?window=${alternateWindowSize} returned HTTP ${alternateWindowResponse.status}`);
  const alternateWindowCalibration = await alternateWindowResponse.json();
  assertCalibrationPayload(alternateWindowCalibration, alternateWindowSize, `/api/form/debug?window=${alternateWindowSize}`);
  windowCalibrations.set(String(alternateWindowCalibration.window), alternateWindowCalibration);

  const alternateWindowHomeResponse = await fetch(`${baseUrl}/api/form/home?window=${encodeURIComponent(alternateWindowSize)}`);
  assert(alternateWindowHomeResponse.ok, `/api/form/home?window=${alternateWindowSize} returned HTTP ${alternateWindowHomeResponse.status}`);
  const alternateWindowHome = await alternateWindowHomeResponse.json();
  assertHomePayload(alternateWindowHome, alternateWindowCalibration, `/api/form/home?window=${alternateWindowSize}`);

  for (const candidateWindow of calibrationWindows) {
    if (windowCalibrations.has(candidateWindow)) continue;
    const candidateResponse = await fetch(`${baseUrl}/api/form/debug?window=${encodeURIComponent(candidateWindow)}`);
    assert(candidateResponse.ok, `/api/form/debug?window=${candidateWindow} returned HTTP ${candidateResponse.status}`);
    const candidateCalibration = await candidateResponse.json();
    assertCalibrationPayload(candidateCalibration, candidateWindow, `/api/form/debug?window=${candidateWindow}`);
    windowCalibrations.set(String(candidateCalibration.window), candidateCalibration);

    const candidateHomeResponse = await fetch(`${baseUrl}/api/form/home?window=${encodeURIComponent(candidateWindow)}`);
    assert(candidateHomeResponse.ok, `/api/form/home?window=${candidateWindow} returned HTTP ${candidateHomeResponse.status}`);
    const candidateHome = await candidateHomeResponse.json();
    assertHomePayload(candidateHome, candidateCalibration, `/api/form/home?window=${candidateWindow}`);
  }

  const invalidWindowResponse = await fetch(`${baseUrl}/api/form/debug?window=99`);
  assert(invalidWindowResponse.ok, `/api/form/debug?window=99 returned HTTP ${invalidWindowResponse.status}`);
  const invalidWindowCalibration = await invalidWindowResponse.json();
  assertCalibrationPayload(invalidWindowCalibration, 5, "/api/form/debug?window=99");
  const invalidWindowHomeResponse = await fetch(`${baseUrl}/api/form/home?window=99`);
  assert(invalidWindowHomeResponse.ok, `/api/form/home?window=99 returned HTTP ${invalidWindowHomeResponse.status}`);
  const invalidWindowHome = await invalidWindowHomeResponse.json();
  assertHomePayload(invalidWindowHome, invalidWindowCalibration, "/api/form/home?window=99");

  const fractionalWindowResponse = await fetch(`${baseUrl}/api/form/debug?window=3.5`);
  assert(fractionalWindowResponse.ok, `/api/form/debug?window=3.5 returned HTTP ${fractionalWindowResponse.status}`);
  const fractionalWindowCalibration = await fractionalWindowResponse.json();
  assertCalibrationPayload(fractionalWindowCalibration, 5, "/api/form/debug?window=3.5");
  const fractionalWindowHomeResponse = await fetch(`${baseUrl}/api/form/home?window=3.5`);
  assert(fractionalWindowHomeResponse.ok, `/api/form/home?window=3.5 returned HTTP ${fractionalWindowHomeResponse.status}`);
  const fractionalWindowHome = await fractionalWindowHomeResponse.json();
  assertHomePayload(fractionalWindowHome, fractionalWindowCalibration, "/api/form/home?window=3.5");

  const pageResponse = await fetch(`${baseUrl}/form/debug?window=${encodeURIComponent(windowSize)}`);
  assert(pageResponse.ok, `/form/debug returned HTTP ${pageResponse.status}`);
  const pageHtml = await pageResponse.text();
  assertCalibrationPage(pageHtml, calibration, "/form/debug");

  const invalidWindowPageResponse = await fetch(`${baseUrl}/form/debug?window=99`);
  assert(invalidWindowPageResponse.ok, `/form/debug?window=99 returned HTTP ${invalidWindowPageResponse.status}`);
  const invalidWindowPageHtml = await invalidWindowPageResponse.text();
  assertCalibrationPage(invalidWindowPageHtml, defaultCalibration, "/form/debug?window=99");

  const fractionalWindowPageResponse = await fetch(`${baseUrl}/form/debug?window=3.5`);
  assert(fractionalWindowPageResponse.ok, `/form/debug?window=3.5 returned HTTP ${fractionalWindowPageResponse.status}`);
  const fractionalWindowPageHtml = await fractionalWindowPageResponse.text();
  assertCalibrationPage(fractionalWindowPageHtml, defaultCalibration, "/form/debug?window=3.5");

  const alternateWindowPageResponse = await fetch(`${baseUrl}/form/debug?window=${encodeURIComponent(alternateWindowSize)}`);
  assert(alternateWindowPageResponse.ok, `/form/debug?window=${alternateWindowSize} returned HTTP ${alternateWindowPageResponse.status}`);
  const alternateWindowPageHtml = await alternateWindowPageResponse.text();
  assertCalibrationPage(alternateWindowPageHtml, alternateWindowCalibration, `/form/debug?window=${alternateWindowSize}`);

  const trendSweepRoutes = [
    "/heat-check",
    "/heat-check?sort=risers",
    "/heat-check?sort=fallers",
    `/heat-check?team=${encodeURIComponent(defaultHome.hot[0]?.team ?? "NYY")}`,
  ];
  for (const route of trendSweepRoutes) {
    const trendResponse = await fetch(`${baseUrl}${route}`);
    assert(trendResponse.ok, `${route} returned HTTP ${trendResponse.status}`);
    assertTrendRender(await trendResponse.text(), route);
  }

  const bands = Object.entries(calibration.counts.bands)
    .map(([key, count]) => `${key}=${count}/${calibration.bandShare[key]}%`)
    .join(", ");

  console.log(
    `form debug ok: window ${calibration.window}, qualified ${calibration.counts.qualified}, heating ${calibration.counts.heating}, cooling ${calibration.counts.cooling}, FORM min/p10/p20/p30/p40/p50/p60/p70/p80/p90/p95/max/mean/stddev ${calibration.rgs.min}/${calibration.rgs.p10}/${calibration.rgs.p20}/${calibration.rgs.p30}/${calibration.rgs.p40}/${calibration.rgs.p50}/${calibration.rgs.p60}/${calibration.rgs.p70}/${calibration.rgs.p80}/${calibration.rgs.p90}/${calibration.rgs.p95}/${calibration.rgs.max}/${calibration.rgs.mean}/${calibration.rgs.stddev}, trendDelta p25/p50/p75 ${calibration.trendDelta.p25}/${calibration.trendDelta.p50}/${calibration.trendDelta.p75}, Misiorowski FORM ${calibration.misiorowski.form} inputs ${calibration.misiorowski.gsPlusInputs.join("/")}, top FORM ${calibration.topForm.map((pitcher) => `${pitcher.name}:${pitcher.form}`).join(" | ")}, bottom FORM ${calibration.bottomForm.map((pitcher) => `${pitcher.name}:${pitcher.form}`).join(" | ")}, bands ${bands}`,
  );
} catch (error) {
  if (output.trim()) {
    console.error(output.trim());
  }
  throw error;
} finally {
  stopProcessTree(server);
}
