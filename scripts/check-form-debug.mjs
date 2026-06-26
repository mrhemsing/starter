import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";

const host = "127.0.0.1";

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

function calibrationSignature(calibration) {
  return JSON.stringify({
    window: calibration.window,
    counts: calibration.counts,
    rgs: calibration.rgs,
    trendDelta: calibration.trendDelta,
    heatIndex: calibration.heatIndex,
    bandShare: calibration.bandShare,
    misiorowski: calibration.misiorowski,
    topForm: calibration.topForm,
    bottomForm: calibration.bottomForm,
    config: calibration.config,
  });
}

function homeSignature(home) {
  return JSON.stringify({
    window: home.window,
    leagueMeanGS: home.leagueMeanGS,
    totalQualified: home.totalQualified,
    bands: home.bands,
    hot: home.hot,
    cold: home.cold,
  });
}

async function fetchJson(url, label) {
  const response = await fetch(url);
  assert(response.ok, `${label} returned HTTP ${response.status}`);
  return response.json();
}

function assertHomePayload(home, calibration, label) {
  assert(home.window === calibration.window, `${label} window must match calibration window`);
  assert(home.totalQualified === calibration.counts.qualified, `${label} qualified count must match calibration`);
  assert(sumValues(home.bands) === home.totalQualified, `${label} heat band counts must sum to qualified count`);
  for (const [key, count] of Object.entries(calibration.counts.bands)) {
    assert(home.bands[key] === count, `${label} band ${key} count ${home.bands[key]} must match calibration ${count}`);
  }
  assert(home.hot.length > 0, `${label} expected hot rail entries`);
  assert(home.cold.length > 0, `${label} expected cold rail entries`);
}

function assertCalibrationPage(html, calibration, label) {
  const normalizedPageHtml = html.replaceAll("<!-- -->", "");
  assert(normalizedPageHtml.includes("Form calibration"), `${label} should render the calibration page`);
  assert(normalizedPageHtml.includes("Heat bands"), `${label} should render Heat band readouts`);
  assert(normalizedPageHtml.includes("Config snapshot"), `${label} should render the config snapshot`);
  assert(normalizedPageHtml.includes(`>${calibration.counts.qualified}<`), `${label} should render the qualified pitcher count`);
  assert(normalizedPageHtml.includes("On Fire") && normalizedPageHtml.includes("Heating Up") && normalizedPageHtml.includes("Cooling Down") && normalizedPageHtml.includes("Ice Cold"), `${label} should render FORM band labels`);
  assert(normalizedPageHtml.includes("Misiorowski") && normalizedPageHtml.includes("Top FORM") && normalizedPageHtml.includes("Bottom FORM"), `${label} should render FORM diagnostic leaderboards`);
}

function assertCalibrationPayload(calibration, expectedWindow, label, options = {}) {
  assert(calibration.window === Number(expectedWindow), `${label} expected window ${expectedWindow}, got ${calibration.window}`);
  assert(calibration.counts?.qualified > 0, `${label} expected at least one qualified pitcher`);
  assert(sumValues(calibration.counts.bands) === calibration.counts.qualified, `${label} heat band counts must sum to qualified count`);
  assert(calibration.config?.heatIndexTrendWeight !== undefined, `${label} config snapshot missing heatIndexTrendWeight`);
  const windowThresholds = calibration.config?.formBandThresholds?.[String(expectedWindow)];
  assert(
    windowThresholds &&
      Number.isFinite(windowThresholds.onFireMin) &&
      Number.isFinite(windowThresholds.heatingMin) &&
      Number.isFinite(windowThresholds.coolingMax) &&
      Number.isFinite(windowThresholds.iceColdMax),
    `${label} config snapshot missing tuned window-specific FORM-band thresholds`,
  );
  assert(windowThresholds.onFireMin <= calibration.rgs.max, `${label} On Fire FORM cutoff ${windowThresholds.onFireMin} must be reachable by max FORM ${calibration.rgs.max}`);
  assert(windowThresholds.iceColdMax >= calibration.rgs.min, `${label} Ice Cold FORM cutoff ${windowThresholds.iceColdMax} must be reachable by min FORM ${calibration.rgs.min}`);
  assert(calibration.config?.buyLowGsPlusMax === 50 && calibration.config?.sellHighGsPlusMin === 58, `${label} config snapshot missing crossover thresholds`);
  assert(calibration.bandShare?.onfire !== undefined, `${label} debug payload missing band shares`);
  for (const key of ["min", "p10", "p20", "p30", "p40", "p50", "p60", "p70", "p80", "p90", "p95", "max", "mean", "stddev"]) {
    assert(Number.isFinite(calibration.rgs[key]), `${label} FORM distribution missing ${key}`);
  }
  assert(calibration.misiorowski?.present, `${label} Misiorowski must be present in qualified FORM population`);
  assert(Array.isArray(calibration.misiorowski.gsPlusInputs) && calibration.misiorowski.gsPlusInputs.length > 0, `${label} Misiorowski diagnostic must include per-start GS+ inputs`);
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
  if (String(expectedWindow) === "5") {
    assert(calibration.misiorowski.band === "onfire", `${label} Misiorowski must land in On Fire for Last 5`);
    assert(
      calibration.topForm.slice(0, 3).some((pitcher) => pitcher.name.includes("Misiorowski")),
      `${label} Misiorowski must rank near the top of Last 5 FORM`,
    );
  }
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
  assert(
    calibrationSignature(invalidWindowCalibration) === calibrationSignature(defaultCalibration),
    "invalid debug window should fall back to the default calibration payload",
  );
  const invalidWindowHomeResponse = await fetch(`${baseUrl}/api/form/home?window=99`);
  assert(invalidWindowHomeResponse.ok, `/api/form/home?window=99 returned HTTP ${invalidWindowHomeResponse.status}`);
  const invalidWindowHome = await invalidWindowHomeResponse.json();
  assert(
    homeSignature(invalidWindowHome) === homeSignature(defaultHome),
    "invalid home window should fall back to the default home payload",
  );

  const fractionalWindowResponse = await fetch(`${baseUrl}/api/form/debug?window=3.5`);
  assert(fractionalWindowResponse.ok, `/api/form/debug?window=3.5 returned HTTP ${fractionalWindowResponse.status}`);
  const fractionalWindowCalibration = await fractionalWindowResponse.json();
  assert(
    calibrationSignature(fractionalWindowCalibration) === calibrationSignature(defaultCalibration),
    "fractional debug window should fall back to the default calibration payload",
  );
  const fractionalWindowHomeResponse = await fetch(`${baseUrl}/api/form/home?window=3.5`);
  assert(fractionalWindowHomeResponse.ok, `/api/form/home?window=3.5 returned HTTP ${fractionalWindowHomeResponse.status}`);
  const fractionalWindowHome = await fractionalWindowHomeResponse.json();
  assert(
    homeSignature(fractionalWindowHome) === homeSignature(defaultHome),
    "fractional home window should fall back to the default home payload",
  );

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
