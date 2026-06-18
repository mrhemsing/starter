import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";

const host = "127.0.0.1";
const pitcherId = process.env.THE_BUMP_WATCHLIST_PITCHER_ID ?? "694819";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function reservePort() {
  const server = net.createServer();
  server.listen(0, host);
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object", "could not reserve port");
  const port = address.port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
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
  throw new Error(`server did not become ready: ${lastError?.message ?? "unknown"}`);
}

function stopProcessTree(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    } catch {}
    return;
  }
  child.kill("SIGTERM");
}

function cookieFrom(response) {
  const value = response.headers.get("set-cookie");
  assert(value?.includes("the_bump_watchlist_id="), "follow response should set watchlist cookie");
  assert(value.includes("wlids_"), "follow response should persist followed pitcher ids in the cookie");
  return value.split(";")[0];
}

const port = await reservePort();
const baseUrl = `http://${host}:${port}`;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });

try {
  await waitForHttp(baseUrl);

  const empty = await fetch(`${baseUrl}/api/watchlist`);
  assert(empty.ok, "empty watchlist API should return 200");
  const emptyJson = await empty.json();
  assert(emptyJson.entries.length === 0, "empty watchlist should have no entries");

  const followed = await fetch(`${baseUrl}/api/watchlist`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pitcherId }),
  });
  assert(followed.ok, `follow API returned ${followed.status}`);
  const cookie = cookieFrom(followed);
  const followedJson = await followed.json();
  assert(followedJson.pitcherIds.includes(pitcherId), "follow API should persist pitcher id");
  assert(followedJson.entries.some((entry) => entry.pitcherId === pitcherId), "follow API should hydrate followed pitcher");

  const page = await fetch(`${baseUrl}/watchlist`, { headers: { cookie } });
  assert(page.ok, `/watchlist returned ${page.status}`);
  const html = await page.text();
  assert(html.includes("Watchlist"), "watchlist page should render");
  assert(html.includes("Digest preview"), "watchlist should render digest preview");
  assert(html.includes("Following"), "watchlist should render following control");
  assert(html.includes(pitcherId) || html.includes("Misiorowski"), "watchlist should render followed pitcher");

  const unfollowed = await fetch(`${baseUrl}/api/watchlist`, {
    method: "DELETE",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ pitcherId }),
  });
  assert(unfollowed.ok, `unfollow API returned ${unfollowed.status}`);
  const unfollowedJson = await unfollowed.json();
  assert(!unfollowedJson.pitcherIds.includes(pitcherId), "unfollow API should remove pitcher id");

  console.log(`watchlist ok: followed/unfollowed pitcher ${pitcherId}, rendered page and digest preview`);
} finally {
  stopProcessTree(server);
  if (output && process.env.DEBUG_WATCHLIST_CHECK) process.stderr.write(output);
}
