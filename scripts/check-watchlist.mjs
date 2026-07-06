import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import net from "node:net";

const host = "127.0.0.1";
const pitcherId = process.env.THE_BUMP_WATCHLIST_PITCHER_ID ?? "694819";

const [watchlistPageSource, watchlistServiceSource, headlineServiceSource, headlineCronSource, vercelConfigSource, searchFormSource, followButtonSource, nextStartBlockSource, suggestedFollowsSource] = await Promise.all([
  readFile("src/app/watchlist/page.tsx", "utf8"),
  readFile("src/lib/data/watchlist-service.ts", "utf8"),
  readFile("src/lib/data/watchlist-headlines-service.ts", "utf8"),
  readFile("src/app/api/cron/watchlist-headlines/route.ts", "utf8"),
  readFile("vercel.json", "utf8"),
  readFile("src/components/watchlist-search-form.tsx", "utf8"),
  readFile("src/components/follow-pitcher-button.tsx", "utf8"),
  readFile("src/components/watchlist-next-start-block.tsx", "utf8"),
  readFile("src/components/watchlist-suggested-follows.tsx", "utf8"),
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
assert(
  watchlistPageSource.includes("PitcherAvailabilityNote") &&
    watchlistPageSource.includes("availability={entry.availability}") &&
    suggestedFollowsSource.includes("PitcherAvailabilityNote") &&
    suggestedFollowsSource.includes("availability={pitcher.availability}"),
  "watchlist rows and search results should surface current MLB IL availability when present",
);
assert(
  watchlistPageSource.includes('<div className="mt-5"><TrendChip summary={entry} compact /></div>'),
  "watchlist row trend chip should keep enough top space to align with the follow action box",
);
assert(
  watchlistServiceSource.includes('import { getLiveScoreboard, type LiveScoreboardRow } from "@/lib/data/live-scoreboard-service";') &&
    watchlistServiceSource.includes("livePitchingNow: WatchlistLiveEntry[];") &&
    watchlistServiceSource.includes("getLiveScoreboard({ date: today }).catch(() => null)") &&
    watchlistServiceSource.includes("const liveRowsByPitcherId = new Map") &&
    watchlistServiceSource.includes('return row.status === "live" && row.scoreLabel !== "PROJ";'),
  "watchlist service should derive followed pitching-now rows from live scoreboard rows",
);
assert(
  watchlistPageSource.includes("<PitchingNowStrip entries={watchlist.livePitchingNow} />") &&
    watchlistPageSource.includes('data-responsive-check="watchlist-pitching-now"') &&
    watchlistPageSource.includes("entry.liveStart.liveHref") &&
    watchlistPageSource.includes("entry.liveStart.scoreLabel === \"FINAL\" ? \"FINAL\" : \"PROV\"") &&
    watchlistPageSource.includes('SummaryStat label="Pitching now" value={String(watchlist.livePitchingNow.length)}'),
  "watchlist page should pin followed live arms with provisional GS+ and live-board links",
);
assert(
  watchlistPageSource.includes('data-responsive-check="watchlist-summary-stats"') &&
    watchlistPageSource.includes("mt-5 grid grid-cols-3 gap-2 font-mono text-xs sm:gap-3") &&
    watchlistPageSource.includes("min-w-0 rounded border border-white/10 bg-[#101014] p-2 sm:p-3") &&
    watchlistPageSource.includes("text-[8px] uppercase leading-4 tracking-[0.12em] text-zinc-500 sm:text-[10px]"),
  "watchlist summary stats must render as three equal mobile columns with compact labels",
);
assert(
  watchlistServiceSource.includes("export const WATCHLIST_SOON_DAYS = 3;") &&
    watchlistPageSource.includes("WATCHLIST_SOON_DAYS") &&
    !watchlistPageSource.includes(`next ${"two"} days`),
  "watchlist soon copy must use the shared 3-day constant instead of stale two-day copy",
);
assert(
  watchlistPageSource.includes('data-responsive-check="watchlist-wire"') &&
    watchlistPageSource.includes("The Wire") &&
    watchlistPageSource.includes("News for your arms") &&
    watchlistPageSource.includes("Quiet stretch for your arms.") &&
    watchlistPageSource.includes("data-wire-event") &&
    watchlistServiceSource.includes("wireEventsForPitcher") &&
    watchlistServiceSource.includes("headlineEvents: WatchlistWireEvent[];") &&
    watchlistServiceSource.includes("signalEvents: WatchlistWireEvent[];") &&
    !watchlistPageSource.includes("Today&apos;s hooks") &&
    !watchlistPageSource.includes(`Digest ${"preview"}`),
  "watchlist should replace Today's Hooks with news-only Wire cards and a quiet empty state",
);
assert(
  watchlistServiceSource.includes('"rest-anomaly"') &&
    watchlistServiceSource.includes('"two-start-week"') &&
    watchlistServiceSource.includes('"streak"') &&
    watchlistServiceSource.includes('"gem"') &&
    watchlistServiceSource.includes('"blowup"') &&
    watchlistServiceSource.includes('"headlines"') &&
    watchlistPageSource.includes("<SignalsRow events={entry.signalEvents} />"),
  "watchlist Wire v1 should keep derived rest, two-start, streak, gem, and blowup events as capped card signals",
);
assert(
  watchlistServiceSource.includes("export function sortWatchlistWireEvents") &&
    watchlistServiceSource.includes("watchlistWireEventSortTime(b) - watchlistWireEventSortTime(a)") &&
    watchlistServiceSource.includes("event.headline?.publishedAt ?? event.detectedAt"),
  "watchlist Wire events must sort newest-first, using headline published time for NEWS items",
);
assert(
  headlineServiceSource.includes("collapseHeadlineClusters(state.headlines)") &&
    headlineServiceSource.includes("sameHeadlineCluster(existing.headline, candidate.headline)") &&
    headlineServiceSource.includes("normalizeHeadlineTitle(existing.headline) === normalizeHeadlineTitle(candidate.headline)") &&
    headlineServiceSource.includes('const SYNDICATOR_HOSTS = ["msn.com"];') &&
    headlineServiceSource.includes("const HEADLINE_DEDUPE_WINDOW_MS = 96 * 60 * 60 * 1000;") &&
    headlineServiceSource.includes("HEADLINE_SOURCE_SUFFIX_PATTERN") &&
    headlineServiceSource.includes("stripSourceSuffix(headline.headline, headline.source)") &&
    headlineServiceSource.includes("HEADLINE_TOPIC_STOP_WORDS"),
  "watchlist headline events must collapse same-topic clusters and strip duplicated source suffixes before storage and render",
);
assert(
  headlineServiceSource.includes('source: "google-news"') &&
    headlineServiceSource.includes('source: "mlb-trade-rumors"') &&
    headlineServiceSource.includes('source: "espn"') &&
    headlineServiceSource.includes("THE_BUMP_WIRE_GOOGLE_NEWS_ENABLED") &&
    headlineServiceSource.includes("THE_BUMP_WIRE_MLBTR_ENABLED") &&
    headlineServiceSource.includes("THE_BUMP_WIRE_ESPN_ENABLED") &&
    headlineServiceSource.includes("openSourceBreaker") &&
    headlineServiceSource.includes("readWatchlistHeadlineEvents") &&
    headlineServiceSource.includes("ingestWatchlistHeadlines"),
  "watchlist headline ingest must expose best-effort Google News, MLBTR, and ESPN adapters with per-source kill switches and breakers",
);
assert(
  headlineServiceSource.includes("resolveEspnAthleteId") &&
    headlineServiceSource.includes("https://site.web.api.espn.com/apis/search/v2") &&
    headlineServiceSource.includes("watchlist-headline-espn-ids") &&
    headlineServiceSource.includes("https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/news?athlete="),
  "watchlist ESPN headline ingest should auto-resolve and cache ESPN athlete ids before using the working athlete news endpoint",
);
assert(
  headlineServiceSource.includes("headline: item.title") &&
    headlineServiceSource.includes("source: item.source || \"Google News\"") &&
    headlineServiceSource.includes("url: item.link") &&
    headlineServiceSource.includes("publishedAt: item.pubDate") &&
    headlineServiceSource.includes("truncateHeadline") &&
    !/\bdescription\b|\bsummary\b|\bexcerpt\b|\brotowire\b/i.test(headlineServiceSource),
  "headline ingest must allowlist headline/source/url/published fields and never store snippets, summaries, excerpts, or rotowire text",
);
assert(
  watchlistPageSource.includes("event.headline?.url") &&
    watchlistPageSource.includes('target="_blank"') &&
    watchlistPageSource.includes('rel="noopener"') &&
    watchlistPageSource.includes(">NEWS<") &&
    watchlistPageSource.includes("event.headline?.source") &&
    watchlistPageSource.includes("text-zinc-500"),
  "watchlist Wire NEWS items must render as external headline links with visible, separate source attribution",
);
assert(
  headlineCronSource.includes('import { ingestWatchlistHeadlines } from "@/lib/data/watchlist-headlines-service";') &&
    vercelConfigSource.includes('"/api/cron/watchlist-headlines"') &&
    vercelConfigSource.includes('"*/30 * * * *"') &&
    headlineServiceSource.includes("isHeadlinePollingWindow") &&
    headlineServiceSource.includes('reason: "outside-hourly-cadence"') &&
    headlineServiceSource.includes('"America/Los_Angeles"'),
  "watchlist headline ingest must run from cron with PT-aware half-hour/daytime and hourly/off-hours cadence",
);
assert(
  watchlistPageSource.includes('import { WatchlistNextStartBlock } from "@/components/watchlist-next-start-block";') &&
    watchlistPageSource.includes("<WatchlistNextStartBlock nextStart={entry.nextStart} compact />") &&
    nextStartBlockSource.includes('data-watchlist-next-start-row="matchup"') &&
    nextStartBlockSource.includes('data-watchlist-next-start-row="context"') &&
    nextStartBlockSource.includes("nextStart.parkRunFactor && nextStart.parkRunFactor > 0") &&
    nextStartBlockSource.includes("nextStart.parkRunFactor.toFixed(2)") &&
    nextStartBlockSource.includes('badge={nextStart.projectionSource === "baseline" ? "BASELINE" : undefined}') &&
    watchlistServiceSource.includes('projectionSource: Math.round(probable.matchupScore) === 50 ? "baseline" : "measured"') &&
    watchlistServiceSource.includes("parkRunFactor: typeof parkRunFactor === \"number\" && parkRunFactor > 0 ? parkRunFactor : null") &&
    !watchlistPageSource.includes("formatNextStartBlock") &&
    !watchlistPageSource.includes(`Park ${"0.0"}`),
  "watchlist next-start cards should use the shared two-row block, omit missing parks, and tag baseline-looking projected GS+ values",
);
assert(
  watchlistPageSource.includes("<NextOnTheSlabModule entries={watchlist.pitchingSoon} />") &&
    watchlistPageSource.includes("Today on the slab") &&
    watchlistPageSource.includes("Next on the slab") &&
    !watchlistPageSource.includes(`Daily ${"decision"} strip`) &&
    !watchlistPageSource.includes("<WatchlistGroup title=\"Pitching today / soon\""),
  "watchlist must merge the daily decision strip and pitching-soon list into one next-on-the-slab module",
);
assert(
  watchlistPageSource.includes("WatchlistSuggestedFollows") &&
    suggestedFollowsSource.includes("Dismiss suggested follows") &&
    suggestedFollowsSource.includes("toe-the-slab-watchlist-suggestions-dismissed") &&
    suggestedFollowsSource.includes("Suggestions") &&
    suggestedFollowsSource.includes("visibleResults.length === 0") &&
    suggestedFollowsSource.includes("FollowPitcherButton"),
  "watchlist suggested follows must be dismissible, recoverable, and self-hide when suggestions are already followed",
);
assert(
  followButtonSource.includes("useState(() => initialFollowing || (followState.get(pitcherId) ?? false))") &&
    followButtonSource.includes("if (initialFollowing || !followState.has(pitcherId))"),
  "followed watchlist rows must force the shared star state filled when server state says followed",
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
  assert(Array.isArray(followedJson.livePitchingNow), "watchlist API should expose livePitchingNow group");
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
  assert(html.includes("The Wire"), "watchlist should render the Wire");
  assert(!html.includes(`Today&apos;s ${"hooks"}`) && !html.includes(`Today's ${"hooks"}`), "watchlist should not render old hooks copy");
  assert(!html.includes(`next ${"two"} days`), "watchlist should not render stale soon-window copy");
  assert(!/K LINE PENDING|pending/i.test(html.match(/data-responsive-check="watchlist-wire"[\s\S]*?<\/section>/)?.[0] ?? ""), "Wire should not render pending placeholders");
  assert(html.includes("Pitching now"), "watchlist should expose the live pitching summary label");
  assert(html.includes("Sort"), "watchlist should render sort controls");
  assert(html.includes("Search pitchers"), "watchlist should render inline add-pitcher search");
  assert(html.includes('data-responsive-check="watchlist-pitching-soon"'), "watchlist should render the merged next-on-the-slab module");
  assert(html.includes("Everyone else") || html.includes("No followed arms are scheduled"), "watchlist should render grouped default list");
  assert(html.includes("Following"), "watchlist should render following control");
  assert(html.includes('aria-pressed="true"'), "followed watchlist rows should render filled/following star state");
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

  console.log(`watchlist ok: followed/unfollowed pitcher ${pitcherId}, rendered page and Wire`);
} finally {
  stopProcessTree(server);
  if (output && process.env.DEBUG_WATCHLIST_CHECK) process.stderr.write(output);
}
