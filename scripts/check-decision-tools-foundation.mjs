import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";

const host = "127.0.0.1";
const start = process.env.THE_BUMP_DECISION_TOOLS_START ?? "2026-06-13";
const days = process.env.THE_BUMP_DECISION_TOOLS_DAYS ?? "3";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function reservePort() {
  const server = net.createServer();
  server.listen(0, host);
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object", "could not reserve a local port");
  const port = address.port;
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return port;
}

async function waitForHttp(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // keep waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`server did not become ready at ${url}`);
}

function stopServer(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    return;
  }
  child.kill("SIGTERM");
}

function assertFoundation(data) {
  assert(data.range?.start === start, "foundation range start should match request");
  assert(Array.isArray(data.source?.schedule) && data.source.schedule.length === Number(days), "foundation should expose one schedule source per day");
  assert(data.source.park === "shared-venue-run-factors", "foundation should expose shared park factor source");
  assert(data.source.weather === "open-meteo", "foundation should expose weather source");
  assert(Array.isArray(data.games) && data.games.length > 0, "foundation should expose lookahead games");

  let probableCount = 0;
  const weatherSources = new Set();
  for (const game of data.games) {
    assert(typeof game.gamePk === "string" && game.gamePk.length > 0, "gamePk missing");
    assert(typeof game.firstPitch === "string" && game.firstPitch.length > 0, "firstPitch missing");
    assert(game.parkContext && typeof game.parkContext.runFactor === "number", `${game.label} missing park context`);
    assert(game.weatherContext && typeof game.weatherContext.runValue === "number", `${game.label} missing weather context`);
    weatherSources.add(game.weatherContext.source);
    assert(Array.isArray(game.starters) && game.starters.length === 2, `${game.label} should include two starter slots`);
    for (const starter of game.starters) {
      if (starter.pitcherId) probableCount += 1;
      assert(starter.opponentContext && typeof starter.opponentContext.offenseRunValue === "number", `${game.label} starter missing opponent context`);
      assert(starter.parkContext?.venue === game.parkContext.venue, `${game.label} starter park context should match game`);
      assert(starter.weatherContext?.source === game.weatherContext.source, `${game.label} starter weather context should match game`);
    }
  }
  assert(probableCount > 0, "foundation should include named probables");
  assert(weatherSources.has("open-meteo") || weatherSources.has("indoor"), "foundation should include real weather or indoor weather state");
}

let child;

try {
  const port = await reservePort();
  const baseUrl = `http://${host}:${port}`;
  child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForHttp(baseUrl, 60000);

  const foundationResponse = await fetch(`${baseUrl}/api/tools/foundation?start=${encodeURIComponent(start)}&days=${encodeURIComponent(days)}`);
  assert(foundationResponse.ok, `foundation API returned HTTP ${foundationResponse.status}`);
  const foundation = await foundationResponse.json();
  assertFoundation(foundation);

  const toolsResponse = await fetch(`${baseUrl}/tools?start=${encodeURIComponent(start)}&days=${encodeURIComponent(days)}`);
  assert(toolsResponse.ok, `/tools returned HTTP ${toolsResponse.status}`);
  const html = await toolsResponse.text();
  assert(html.includes("Tools Foundation"), "/tools should render hub title");
  assert(html.includes("Schedule lookahead"), "/tools should render schedule source card");
  assert(html.includes("Opponent strength"), "/tools should render opponent source card");
  assert(html.includes("Park factors"), "/tools should render park source card");
  assert(html.includes("Weather"), "/tools should render weather source card");

  console.log(`decision tools foundation ok: ${foundation.range.start}..${foundation.range.end}, games ${foundation.games.length}`);
} finally {
  if (child) stopServer(child);
}
