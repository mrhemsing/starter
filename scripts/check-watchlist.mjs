import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import net from "node:net";

const host = "127.0.0.1";
const pitcherId = process.env.THE_BUMP_WATCHLIST_PITCHER_ID ?? "694819";

const [watchlistPageSource, searchFormSource, followButtonSource] = await Promise.all([
  readFile("src/app/watchlist/page.tsx", "utf8"),
  readFile("src/components/watchlist-search-form.tsx", "utf8"),
  readFile("src/components/follow-pitcher-button.tsx", "utf8"),
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  watchlistPageSource.includes("<WatchlistSearchForm query={query} sort={watchlist.sort} />"),
  "watchlist page should render the no-scroll client search form",
);
assert(
  searchFormSource.includes("event.preventDefault()") &&
    searchFormSource.includes("router.replace(nextPath, { scroll: false })"),
  "watchlist search should update query results without resetting scroll",
);
assert(
  watchlistPageSource.includes("compact refreshOnChange") &&
    followButtonSource.includes("refreshOnChange?: boolean") &&
    followButtonSource.includes("if (refreshOnChange) router.refresh()"),
  "watchlist follow buttons should refresh rows after successful API updates",
);

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
  assert(Array.isArray(followedJson.pitchingSoon), "watchlist API should expose pitchingSoon group");
  assert(Array.isArray(followedJson.bench), "watchlist API should expose bench group");
  assert(["default", "form", "soonest", "mover"].includes(followedJson.sort), "watchlist API should expose supported sort mode");
  assert(
    followedJson.entries.every((entry) => !entry.nextStart || typeof entry.nextStart.projectedGsPlus === "number"),
    "watchlist next-start entries should expose projected GS+",
  );

  const page = await fetch(`${baseUrl}/watchlist`, { headers: { cookie } });
  assert(page.ok, `/watchlist returned ${page.status}`);
  const html = await page.text();
  assert(html.includes("Watchlist"), "watchlist page should render");
  assert(html.includes("Digest preview"), "watchlist should render digest preview");
  assert(html.includes("Sort"), "watchlist should render sort controls");
  assert(html.includes("Search pitchers"), "watchlist should render inline add-pitcher search");
  assert(html.includes("Pitching today / soon"), "watchlist should render actionable pitching-soon group");
  assert(html.includes("Everyone else") || html.includes("No followed arms are scheduled"), "watchlist should render grouped default list");
  assert(html.includes("Following"), "watchlist should render following control");
  assert(html.includes(pitcherId) || html.includes("Misiorowski"), "watchlist should render followed pitcher");

  const formSorted = await fetch(`${baseUrl}/watchlist?sort=form`, { headers: { cookie } });
  assert(formSorted.ok, `/watchlist?sort=form returned ${formSorted.status}`);
  const formHtml = await formSorted.text();
  assert(formHtml.includes('data-watchlist-sort="form"'), "watchlist form sort should render sorted rows");

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
