import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";

const host = "127.0.0.1";
const date = process.env.THE_BUMP_UPCOMING_CONTRACT_DATE ?? "2026-06-08";
const days = process.env.THE_BUMP_UPCOMING_CONTRACT_DAYS ?? "1";
const windowSize = process.env.THE_BUMP_UPCOMING_CONTRACT_WINDOW ?? "5";
const siteTimeZone = process.env.THE_BUMP_TIME_ZONE ?? "America/Los_Angeles";
const FORM_TIER_KEYS = ["onfire", "hot", "even", "cooling", "ice"];

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

function assertNumber(value, label) {
  assert(typeof value === "number" && Number.isFinite(value), `${label} must be a finite number`);
}

function assertNonEmptyString(value, label) {
  assert(typeof value === "string" && value.length > 0, `${label} must be a non-empty string`);
}

function assertIsoTimestamp(value, label) {
  assert(typeof value === "string" && value.length > 0, `${label} must be present`);
  const parsed = Date.parse(value);
  assert(Number.isFinite(parsed), `${label} must be an ISO timestamp`);
}

function assertDateKey(value, label) {
  assert(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value), `${label} must be YYYY-MM-DD`);
}

function assertUpcomingEnvelope(upcoming, expectedStart, expectedDays, label) {
  const expectedEnd = addDays(expectedStart, expectedDays - 1);
  assertDateKey(upcoming.range?.start, `${label} range start`);
  assertDateKey(upcoming.range?.end, `${label} range end`);
  assert(upcoming.range?.start === expectedStart, `${label} range start must be ${expectedStart}`);
  assert(upcoming.range?.end === expectedEnd, `${label} range end must be ${expectedEnd}`);
  assertIsoTimestamp(upcoming.generatedAt, `${label} generatedAt`);
  assert(Array.isArray(upcoming.days) && upcoming.days.length === expectedDays, `${label} should return ${expectedDays} day groups`);
}

function assertStarterForm(starter, label) {
  assert(["home", "away"].includes(starter.side), `${label} side must be home or away`);
  assert(["ok", "insufficient", "tbd"].includes(starter.status), `${label} status must be valid`);

  if (starter.status === "tbd") {
    assert(starter.pitcherId === null && starter.name === null, `${label} tbd starter should not fabricate identity`);
    assert(starter.lastStart === undefined, `${label} tbd starter should not expose lastStart`);
    return false;
  }

  assert(typeof starter.pitcherId === "string" && starter.pitcherId.length > 0, `${label} pitcherId missing`);
  assert(typeof starter.name === "string" && starter.name.length > 0, `${label} name missing`);
  assert(typeof starter.team === "string" && starter.team.length > 0, `${label} team missing`);

  if (starter.status === "insufficient") {
    if (starter.rgs !== undefined) {
      assertNumber(starter.rgs, `${label} limited rgs`);
      assert(FORM_TIER_KEYS.includes(starter.tier), `${label} limited tier must be valid`);
      assert(["heating", "steady", "cooling"].includes(starter.trend), `${label} limited trend must be valid`);
      assertNumber(starter.deltaForm, `${label} limited deltaForm`);
      assert(Array.isArray(starter.spark), `${label} limited spark must be an array`);
      starter.spark.forEach((value, index) => assertNumber(value, `${label} limited spark[${index}]`));
      assertLastStart(starter.lastStart, `${label} limited lastStart`);
    }
    return false;
  }

  assertNumber(starter.rgs, `${label} rgs`);
  assert(FORM_TIER_KEYS.includes(starter.tier), `${label} tier must be valid`);
  assert(["heating", "steady", "cooling"].includes(starter.trend), `${label} trend must be valid`);
  assertNumber(starter.deltaForm, `${label} deltaForm`);
  assert(Array.isArray(starter.spark) && starter.spark.length > 0, `${label} spark must include recent form`);
  starter.spark.forEach((value, index) => assertNumber(value, `${label} spark[${index}]`));
  assertLastStart(starter.lastStart, `${label} lastStart`);
  return true;
}

function assertMatchupScoreRange(range, label) {
  assert(range && typeof range === "object", `${label} matchupScoreRange must be present`);
  assertNumber(range.min, `${label} matchupScoreRange.min`);
  assertNumber(range.max, `${label} matchupScoreRange.max`);
  assert(range.min === 0, `${label} matchupScoreRange.min should match the public watch scale`);
  assert(range.max === 100, `${label} matchupScoreRange.max should match the public watch scale`);
  assert(range.min < range.max, `${label} matchupScoreRange should be ascending`);
}

function assertLastStart(lastStart, label) {
  if (lastStart === null) return;
  assert(lastStart && typeof lastStart === "object", `${label} must be an object or null`);
  assertNonEmptyString(lastStart.id, `${label} id`);
  assertDateKey(lastStart.gameDate, `${label} gameDate`);
  assertNonEmptyString(lastStart.gamePk, `${label} gamePk`);
  assertNonEmptyString(lastStart.opp, `${label} opponent`);
  assertNonEmptyString(lastStart.park, `${label} park`);
  assertNumber(lastStart.ip, `${label} ip`);
  assertNumber(lastStart.h, `${label} hits`);
  assertNumber(lastStart.er, `${label} earned runs`);
  assertNumber(lastStart.bb, `${label} walks`);
  assertNumber(lastStart.k, `${label} strikeouts`);
  assertNumber(lastStart.gsPlus, `${label} gsPlus`);
  assert(FORM_TIER_KEYS.includes(lastStart.tier), `${label} tier must be valid`);
  assertNumber(lastStart.rollingMean, `${label} rollingMean`);
  assertNumber(lastStart.bandLow, `${label} bandLow`);
  assertNumber(lastStart.bandHigh, `${label} bandHigh`);
  assertNonEmptyString(lastStart.startHref, `${label} startHref`);
}

function assertDay(day, expectedDate, options = {}) {
  assertDateKey(day.date, `${expectedDate} day date`);
  assert(day.date === expectedDate, `expected day ${expectedDate}, got ${day.date}`);
  assertIsoTimestamp(day.generatedAt, `${expectedDate} generatedAt`);
  assertNumber(day.leagueMeanGS, `${expectedDate} leagueMeanGS`);
  assertMatchupScoreRange(day.matchupScoreRange, expectedDate);
  assertNumber(day.scheduledGames, `${expectedDate} scheduledGames`);
  assert(day.scheduledGames >= day.games.length, `${expectedDate} scheduledGames must cover returned games`);

  const gamePks = new Set();
  const matchupRanks = new Set();
  const expectedMatchupRanks = rankMatchupsForContract(day.games);
  let previousSortGroup = -Infinity;
  let previousWatchScore = Infinity;
  let okStarterCount = 0;

  for (const game of day.games) {
    assertNonEmptyString(game.gamePk, `${expectedDate} gamePk`);
    assert(!gamePks.has(game.gamePk), `${expectedDate} duplicate game card ${game.gamePk}`);
    gamePks.add(game.gamePk);
    assert(game.date === expectedDate, `${game.gamePk} date mismatch`);
    assert(["pregame", "live", "ppd"].includes(game.status), `${game.gamePk} should not return final games`);
    assertIsoTimestamp(game.firstPitch, `${game.gamePk} firstPitch`);
    assertNonEmptyString(game.away, `${game.gamePk} away team`);
    assertNonEmptyString(game.home, `${game.gamePk} home team`);
    assert(game.label === `${game.away} @ ${game.home}`, `${game.gamePk} label should match away/home teams`);
    if (game.park !== null && game.park !== undefined) {
      assertNonEmptyString(game.park, `${game.gamePk} park`);
    }
    assertNumber(game.gameWatchScore, `${game.gamePk} gameWatchScore`);
    assert(
      game.gameWatchScore >= 0 && game.gameWatchScore <= 100,
      `${game.gamePk} gameWatchScore should fit inside the public 0-100 watch scale`,
    );
    assert(game.watchComponents && typeof game.watchComponents === "object", `${game.gamePk} watchComponents must be present`);
    assertNumber(game.watchComponents.topArm, `${game.gamePk} watchComponents.topArm`);
    assertNumber(game.watchComponents.pairing, `${game.gamePk} watchComponents.pairing`);
    assertNumber(game.watchComponents.matchup, `${game.gamePk} watchComponents.matchup`);
    assert(
      game.watchTier === expectedWatchTier(game.gameWatchScore),
      `${game.gamePk} watchTier should match watch score ${game.gameWatchScore}`,
    );
    assertNumber(game.matchupScore, `${game.gamePk} matchupScore`);
    assert(
      game.matchupScore >= day.matchupScoreRange.min && game.matchupScore <= day.matchupScoreRange.max,
      `${game.gamePk} matchupScore should fit inside the advertised matchupScoreRange`,
    );
    assertNumber(game.matchupRankTonight, `${game.gamePk} matchupRankTonight`);
    assert(
      Number.isInteger(game.matchupRankTonight) && game.matchupRankTonight >= 1,
      `${game.gamePk} matchupRankTonight must be a positive integer`,
    );
    assert(
      game.matchupRankTonight <= day.games.length,
      `${game.gamePk} matchupRankTonight must fit inside the returned slate`,
    );
    assert(
      game.matchupRankTonight === expectedMatchupRanks.get(game.gamePk),
      `${game.gamePk} matchupRankTonight should match matchup-score order`,
    );
    assert(!matchupRanks.has(game.matchupRankTonight), `${expectedDate} duplicate matchup rank ${game.matchupRankTonight}`);
    matchupRanks.add(game.matchupRankTonight);
    assert(Array.isArray(game.starters) && game.starters.length === 2, `${game.gamePk} must include two starter slots`);
    const starterSides = game.starters.map((starter) => starter.side).sort().join(",");
    assert(starterSides === "away,home", `${game.gamePk} must include one away starter and one home starter slot`);
    const awayStarter = game.starters.find((starter) => starter.side === "away");
    const homeStarter = game.starters.find((starter) => starter.side === "home");
    assert(awayStarter?.team === game.away, `${game.gamePk} away starter team should match away team`);
    assert(homeStarter?.team === game.home, `${game.gamePk} home starter team should match home team`);
    assert(typeof game.flags?.tbd === "boolean", `${game.gamePk} flags.tbd must be boolean`);
    assert(typeof game.flags?.limitedForm === "boolean", `${game.gamePk} flags.limitedForm must be boolean`);
    assert(
      game.flags.tbd === game.starters.some((starter) => starter.status === "tbd"),
      `${game.gamePk} flags.tbd should match starter TBD state`,
    );
    assert(
      game.flags.limitedForm === game.starters.some((starter) => starter.status !== "ok"),
      `${game.gamePk} flags.limitedForm should match limited starter state`,
    );

    if (game.status !== "ppd") {
      const sortGroup = expectedStatusSortGroup(game.status);
      assert(sortGroup >= previousSortGroup, `${expectedDate} games must keep pregame games ahead of started/postponed games`);
      if (sortGroup !== previousSortGroup) previousWatchScore = Infinity;
      assert(game.gameWatchScore <= previousWatchScore, `${expectedDate} games must be sorted by watch score within status groups`);
      previousSortGroup = sortGroup;
      previousWatchScore = game.gameWatchScore;
    }

    okStarterCount += game.starters.filter((starter, index) => assertStarterForm(starter, `${game.gamePk} starter ${index + 1}`)).length;
  }

  if (options.requireCompleteStarter && day.games.length > 0) {
    assert(okStarterCount > 0, `${expectedDate} should expose at least one probable with complete form fields`);
  }
  return { games: day.games.length, okStarterCount };
}

function rankMatchupsForContract(games) {
  return new Map(
    [...games]
      .sort((a, b) => {
        if (a.status === "ppd" && b.status !== "ppd") return 1;
        if (a.status !== "ppd" && b.status === "ppd") return -1;
        return b.matchupScore - a.matchupScore || Number(a.gamePk) - Number(b.gamePk);
      })
      .map((game, index) => [game.gamePk, index + 1]),
  );
}

function gameOrder(day) {
  return day.games.map((game) => game.gamePk).join(",");
}

function formWindowSignature(day) {
  return JSON.stringify(
    day.games.map((game) => ({
      gamePk: game.gamePk,
      gameWatchScore: game.gameWatchScore,
      starters: game.starters.map((starter) => ({
        pitcherId: starter.pitcherId,
        status: starter.status,
        rgs: starter.rgs,
        tier: starter.tier,
        trend: starter.trend,
        deltaForm: starter.deltaForm,
        spark: starter.spark,
      })),
    })),
  );
}

function dayApiSignature(day) {
  return JSON.stringify({
    date: day.date,
    leagueMeanGS: day.leagueMeanGS,
    matchupScoreRange: day.matchupScoreRange,
    scheduledGames: day.scheduledGames,
    games: day.games.map((game) => ({
      gamePk: game.gamePk,
      date: game.date,
      status: game.status,
      firstPitch: game.firstPitch,
      park: game.park,
      away: game.away,
      home: game.home,
      label: game.label,
      matchupScore: game.matchupScore,
      matchupRankTonight: game.matchupRankTonight,
      gameWatchScore: game.gameWatchScore,
      watchTier: game.watchTier,
      flags: game.flags,
      starters: game.starters,
    })),
  });
}

function expectedWatchTier(score) {
  if (score >= 58) return "mustwatch";
  if (score >= 48) return "worthit";
  return "background";
}

function expectedWatchTierLabel(score) {
  const tier = expectedWatchTier(score);
  if (tier === "mustwatch") return "Must-watch";
  if (tier === "worthit") return "Worth it";
  return "Background";
}

function expectedStatusSortGroup(status) {
  if (status === "pregame") return 0;
  if (status === "live") return 1;
  return 2;
}

function expectedWatchTierLabelForRank(rank) {
  if (rank <= 3) return "Must-watch";
  if (rank <= 8) return "Worth it";
  return "Background";
}

function expectedTrendLabel(trend) {
  if (trend === "heating") return "Rising";
  if (trend === "cooling") return "Falling";
  return "Steady";
}

function expectedGameStatusLabel(status) {
  if (status === "live") return "Live";
  if (status === "ppd") return "Postponed";
  return "Pregame";
}

function formatSignedValue(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function assertMetadata(html, route, title, description) {
  const absoluteUrl = `https://soma4.b-average.com${route}`;
  const imageUrl = `${absoluteUrl}/opengraph-image`;
  const escapedDescription = escapeHtmlAttribute(description);

  assert(html.includes(`<link rel="canonical" href="${absoluteUrl}"/>`), `${route} should render canonical metadata`);
  assert(
    html.includes(`<meta name="description" content="${escapedDescription}"/>`) || /<meta name="description" content="[^"]+"/.test(html),
    `${route} should render description metadata`,
  );
  assert(html.includes(`<meta property="og:url" content="${absoluteUrl}"/>`), `${route} should render Open Graph URL metadata`);
  assert(html.includes(`<meta property="og:title" content="${title}"/>`), `${route} should render Open Graph title metadata`);
  assert(
    html.includes(`<meta property="og:description" content="${escapedDescription}"/>`) || /<meta property="og:description" content="[^"]+"/.test(html),
    `${route} should render Open Graph description metadata`,
  );
  assert(html.includes(`<meta property="og:image" content="${imageUrl}"/>`), `${route} should render Open Graph image metadata`);
  assert(html.includes(`<meta property="og:image:width" content="1200"/>`), `${route} should render Open Graph image width metadata`);
  assert(html.includes(`<meta property="og:image:height" content="630"/>`), `${route} should render Open Graph image height metadata`);
  assert(html.includes(`<meta property="og:image:alt" content="${title}"/>`), `${route} should render Open Graph image alt metadata`);
  assert(html.includes(`<meta name="twitter:card" content="summary_large_image"/>`), `${route} should render Twitter large image card metadata`);
  assert(html.includes(`<meta name="twitter:title" content="${title}"/>`), `${route} should render Twitter title metadata`);
  assert(
    html.includes(`<meta name="twitter:description" content="${escapedDescription}"/>`) || /<meta name="twitter:description" content="[^"]+"/.test(html),
    `${route} should render Twitter description metadata`,
  );
  assert(html.includes(`<meta name="twitter:image" content="${imageUrl}"/>`), `${route} should render Twitter image metadata`);
  assert(html.includes(`<meta name="twitter:image:alt" content="${title}"/>`), `${route} should render Twitter image alt metadata`);
}

function escapeHtmlAttribute(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function expectedUpcomingDayDescription(day) {
  const topGame = day.games[0];
  const lead = topGame
    ? `Top watch: ${topGame.label} with a ${topGame.gameWatchScore.toFixed(1)} watch score.`
    : "Probable starter watch list will update as starters are named.";
  return `${day.scheduledGames} MLB games ranked by probable starter form and matchup context for ${formatUpcomingDate(day.date)}. ${lead}`;
}

function expectedUpcomingWeekDescription(upcoming) {
  const games = upcoming.days.flatMap((day) => day.games);
  const topGame = games.reduce(
    (best, game) => (!best || game.gameWatchScore > best.gameWatchScore ? game : best),
    null,
  );
  const lead = topGame
    ? `Top watch: ${topGame.label} at ${topGame.gameWatchScore.toFixed(1)}.`
    : "Updates as probable starters are named.";
  return `${games.length} upcoming MLB games from ${formatUpcomingDate(upcoming.range.start)} to ${formatUpcomingDate(upcoming.range.end)}, ranked by starter form and matchup context. ${lead}`;
}

async function assertPng(url, label) {
  const response = await fetch(url);
  assert(response.ok, `${label} returned HTTP ${response.status}`);
  assert(response.headers.get("content-type")?.startsWith("image/png"), `${label} should return a PNG image`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  assert(bytes.length > 1024, `${label} should return a non-empty PNG body`);
  assert(pngSignature.every((value, index) => bytes[index] === value), `${label} should return valid PNG bytes`);
  assert(bytes[12] === 73 && bytes[13] === 72 && bytes[14] === 68 && bytes[15] === 82, `${label} should start with a PNG IHDR chunk`);

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert(view.getUint32(16) === 1200, `${label} PNG width should be 1200`);
  assert(view.getUint32(20) === 630, `${label} PNG height should be 630`);
}

function assertJsonLd(html, route, expectedName, expectedDescription, expectedItemCount, expectedGames, expectedListUrl) {
  const match = html.match(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/s);
  assert(match, `${route} should render JSON-LD`);

  const jsonLd = JSON.parse(match[1]);
  const jsonLdLimit = route.includes("/week") ? 20 : 10;
  assert(jsonLd["@context"] === "https://schema.org", `${route} JSON-LD should use schema.org context`);
  assert(jsonLd["@type"] === "ItemList", `${route} JSON-LD should describe an ItemList`);
  assert(jsonLd.name === expectedName, `${route} JSON-LD name should match route title`);
  assert(jsonLd.description === expectedDescription, `${route} JSON-LD description should match route metadata`);
  assertNumber(jsonLd.numberOfItems, `${route} JSON-LD numberOfItems`);
  assert(jsonLd.numberOfItems === expectedItemCount, `${route} JSON-LD should expose exact item count`);
  assert(Array.isArray(jsonLd.itemListElement), `${route} JSON-LD itemListElement must be an array`);
  assert(
    jsonLd.itemListElement.length === Math.min(jsonLd.numberOfItems, jsonLdLimit, expectedGames.length),
    `${route} JSON-LD should cap visible list items correctly`,
  );

  jsonLd.itemListElement.forEach((entry, index) => {
    const expectedGame = expectedGames.find((game) => game.label === entry.item?.name && game.firstPitch === entry.item?.startDate) ?? expectedGames[index];
    assert(entry["@type"] === "ListItem", `${route} JSON-LD item ${index + 1} should be a ListItem`);
    assert(entry.position === index + 1, `${route} JSON-LD item ${index + 1} should preserve list order`);
    assert(entry.url === absoluteSiteUrl(expectedListUrl), `${route} JSON-LD item ${index + 1} list URL should match the route surface`);
    assert(entry.item?.["@type"] === "SportsEvent", `${route} JSON-LD item ${index + 1} should describe a SportsEvent`);
    assert(entry.item.name === expectedGame.label, `${route} JSON-LD item ${index + 1} event name should match API order`);
    assert(entry.item.url === absoluteSiteUrl(`/upcoming/${expectedGame.date}`), `${route} JSON-LD item ${index + 1} event URL should point to its day slate`);
    assert(entry.item.startDate === expectedGame.firstPitch, `${route} JSON-LD item ${index + 1} startDate should match API first pitch`);
    const expectedEventStatus = expectedJsonLdEventStatus(expectedGame.status);
    assert(
      entry.item.eventStatus === expectedEventStatus,
      `${route} JSON-LD item ${index + 1} eventStatus should match API status ${expectedGame.status}: expected ${expectedEventStatus}, got ${entry.item.eventStatus}`,
    );
    assertJsonLdLocation(entry.item.location, expectedGame, `${route} JSON-LD item ${index + 1}`);
    const expectedStarterCompetitors = expectedGame.starters.filter((starter) => starter.name && starter.pitcherId);
    assert(Array.isArray(entry.item.competitor), `${route} JSON-LD item ${index + 1} should include competitors`);
    assert(
      entry.item.competitor.length === 2 + expectedStarterCompetitors.length,
      `${route} JSON-LD item ${index + 1} should include only the two teams and named starters as competitors`,
    );
    assertJsonLdCompetitor(entry.item.competitor, expectedGame.away, `${route} JSON-LD item ${index + 1}`);
    assertJsonLdCompetitor(entry.item.competitor, expectedGame.home, `${route} JSON-LD item ${index + 1}`);
    expectedStarterCompetitors.forEach((starter) => {
      assertJsonLdStarter(entry.item.competitor, starter, `${route} JSON-LD item ${index + 1}`);
    });
    assert(Array.isArray(entry.item.additionalProperty) && entry.item.additionalProperty.length === 4, `${route} JSON-LD item ${index + 1} should include watch properties`);
    assertJsonLdProperty(entry.item.additionalProperty, "Watch Score", expectedGame.gameWatchScore, `${route} JSON-LD item ${index + 1}`);
    assertJsonLdProperty(entry.item.additionalProperty, "Watch Tier", expectedWatchTierLabel(expectedGame.gameWatchScore), `${route} JSON-LD item ${index + 1}`);
    assertJsonLdProperty(entry.item.additionalProperty, "Matchup Score", expectedGame.matchupScore, `${route} JSON-LD item ${index + 1}`);
    assertJsonLdProperty(entry.item.additionalProperty, "Matchup Rank", expectedGame.matchupRankTonight, `${route} JSON-LD item ${index + 1}`);
  });
}

function assertJsonLdLocation(location, expectedGame, label) {
  if (!expectedGame.park) {
    assert(location === undefined, `${label} location should be omitted when API park is missing`);
    return;
  }

  assert(location?.["@type"] === "Place", `${label} location should be a Place`);
  assert(location.name === expectedGame.park, `${label} location name should match API park`);
}

function assertJsonLdCompetitor(competitors, expectedName, label) {
  const competitor = competitors.find((candidate) => candidate.name === expectedName);
  assert(competitor, `${label} should include ${expectedName} as a competitor`);
  assert(competitor["@type"] === "SportsTeam", `${label} competitor ${expectedName} should be a SportsTeam`);
}

function assertJsonLdStarter(competitors, starter, label) {
  const competitor = competitors.find((candidate) => candidate.name === starter.name);
  assert(competitor, `${label} should include starter ${starter.name} as a competitor`);
  assert(competitor["@type"] === "Person", `${label} starter ${starter.name} should be a Person`);
  assert(competitor.identifier === starter.pitcherId, `${label} starter ${starter.name} identifier should match API`);
  assert(competitor.url === absoluteSiteUrl(`/pitchers/${starter.pitcherId}/form`), `${label} starter ${starter.name} URL should point to pitcher Form`);
  assert(
    competitor.image === starterHeadshotUrl(starter.pitcherId),
    `${label} starter ${starter.name} image should point to the MLB headshot`,
  );
  assert(competitor.memberOf?.["@type"] === "SportsTeam", `${label} starter ${starter.name} memberOf should be a SportsTeam`);
  assert(competitor.memberOf?.name === starter.team, `${label} starter ${starter.name} team should match API`);
}

function assertJsonLdProperty(properties, name, expectedValue, label) {
  const property = properties.find((candidate) => candidate.name === name);
  assert(property, `${label} should include ${name}`);
  assert(property["@type"] === "PropertyValue", `${label} ${name} should be a PropertyValue`);
  assert(property.value === expectedValue, `${label} ${name} value should match API`);
}

function starterHeadshotUrl(pitcherId) {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_100,q_auto:best/v1/people/${pitcherId}/headshot/67/current`;
}

function absoluteSiteUrl(path) {
  return new URL(path, "https://soma4.b-average.com").toString();
}

function expectedJsonLdEventStatus(status) {
  if (status === "ppd") return "https://schema.org/EventPostponed";
  if (status === "live") return "https://schema.org/EventInProgress";
  return "https://schema.org/EventScheduled";
}

function assertNoLegacySlateLinks(html, route) {
  assert(!html.includes("/slate/today/"), `${route} should not link back to legacy today slate routes`);
  assert(!html.includes("/slate/tomorrow/"), `${route} should not link back to legacy tomorrow slate routes`);
  assert(!html.includes("/slate/week/"), `${route} should not link back to legacy week slate routes`);
}

function assertFollowedRedirect(response, fromRoute, toRoute) {
  assert(response.ok, `${fromRoute} redirect target returned HTTP ${response.status}`);
  assert(response.redirected, `${fromRoute} should redirect`);
  assert(response.url === `${baseUrl}${toRoute}`, `${fromRoute} should redirect to ${toRoute}, got ${response.url}`);
}

function assertUpcomingRangeToggle(html, route, today, expectedWeekStart = today, expectedActiveHref = null) {
  const tomorrow = addDays(today, 1);
  assert(html.includes("Upcoming range"), `${route} should expose the upcoming range navigation`);
  assert(
    anchorWithTextHasAttributes(html, "Today", {
      href: `/upcoming/${today}`,
      "aria-label": `View today slate for ${formatUpcomingDate(today)}`,
    }),
    `${route} should link the Today toggle to the resolved home slate with an accessible label`,
  );
  assert(
    anchorWithTextHasAttributes(html, "Tomorrow", {
      href: `/upcoming/${tomorrow}`,
      "aria-label": `View tomorrow slate for ${formatUpcomingDate(tomorrow)}`,
    }),
    `${route} should link the Tomorrow toggle to the next slate with an accessible label`,
  );
  assert(
    anchorWithTextHasAttributes(html, "This week", {
      href: `/upcoming/week/${expectedWeekStart}`,
      "aria-label": `View week of ${formatUpcomingDate(expectedWeekStart)}`,
    }),
    `${route} should link the This week toggle to the expected weekly slate with an accessible label`,
  );
  if (expectedActiveHref) {
    assert(
      anchorHasAttributes(html, { href: expectedActiveHref, "aria-current": "page" }),
      `${route} should mark the active upcoming range toggle`,
    );
  }
}

function assertUpcomingControls(html, route, expectedLabel = "Filters / All statuses / Watch rank / All teams") {
  assert(html.includes('data-responsive-check="upcoming-controls"'), `${route} should render the upcoming filter controls`);
  assert(
    elementWithTextHasAttributes(html, "summary", { "aria-label": expectedLabel }, expectedLabel),
    `${route} should expose the current upcoming filter state on the controls summary`,
  );
}

function anchorHasAttributes(html, attributes) {
  const anchors = html.match(/<a\b[^>]*>/g) ?? [];
  return anchors.some((anchor) =>
    Object.entries(attributes).every(([name, value]) => anchor.includes(`${name}="${escapeHtmlAttribute(value)}"`)),
  );
}

function anchorWithTextHasAttributes(html, text, attributes) {
  const anchors = html.match(/<a\b[^>]*>.*?<\/a>/gs) ?? [];
  return anchors.some((anchor) => {
    const openTag = anchor.match(/^<a\b[^>]*>/)?.[0] ?? "";
    return (
      Object.entries(attributes).every(([name, value]) => openTag.includes(`${name}="${escapeHtmlAttribute(value)}"`)) &&
      normalizeHtmlText(anchor).includes(text)
    );
  });
}

function imageHasAttributes(html, attributes) {
  const images = html.match(/<img\b[^>]*>/g) ?? [];
  return images.some((image) =>
    Object.entries(attributes).every(([name, value]) => image.includes(`${name}="${escapeHtmlAttribute(value)}"`)),
  );
}

function divHasAttributes(html, attributes) {
  const divs = html.match(/<div\b[^>]*>/g) ?? [];
  return divs.some((div) =>
    Object.entries(attributes).every(([name, value]) => div.includes(`${name}="${escapeHtmlAttribute(value)}"`)),
  );
}

function elementHasAttributes(html, tagName, attributes) {
  const elements = html.match(new RegExp(`<${tagName}\\b[^>]*>`, "g")) ?? [];
  return elements.some((element) =>
    Object.entries(attributes).every(([name, value]) => element.includes(`${name}="${escapeHtmlAttribute(value)}"`)),
  );
}

function timeHasDateTime(html, value) {
  const times = html.match(/<time\b[^>]*>/g) ?? [];
  const escapedValue = escapeHtmlAttribute(value);
  return times.some((time) => time.includes(`dateTime="${escapedValue}"`) || time.includes(`datetime="${escapedValue}"`));
}

function elementWithTextHasAttributes(html, tagName, attributes, text) {
  const elements = html.match(new RegExp(`<${tagName}\\b[^>]*>.*?<\\/${tagName}>`, "gs")) ?? [];
  return elements.some((element) => {
    const openTag = element.match(new RegExp(`^<${tagName}\\b[^>]*>`))?.[0] ?? "";
    return (
      Object.entries(attributes).every(([name, value]) => openTag.includes(`${name}="${escapeHtmlAttribute(value)}"`)) &&
      normalizeHtmlText(element).includes(text)
    );
  });
}

function spanHasAttributes(html, attributes) {
  const spans = html.match(/<span\b[^>]*>/g) ?? [];
  return spans.some((span) =>
    Object.entries(attributes).every(([name, value]) => span.includes(`${name}="${escapeHtmlAttribute(value)}"`)),
  );
}

function assertPrimarySlateCta(html, route, label, href, ariaLabel = label) {
  assert(
    anchorHasAttributes(html, { href, "aria-label": ariaLabel }),
    `${route} should expose the primary ${label} CTA target with an accessible label`,
  );
  assert(normalizeHtmlText(html).includes(label), `${route} should expose the primary ${label} CTA label`);
}

function assertWeekMustWatchCallout(html, route, games) {
  const bestGame = [...games].sort((a, b) => b.gameWatchScore - a.gameWatchScore)[0];
  assert(bestGame, `${route} should have a best watch game to feature`);
  const normalized = normalizeHtmlText(html);
  assert(normalized.includes("Week's must-watch"), `${route} should render the weekly must-watch callout`);
  assert(normalized.includes(bestGame.label), `${route} weekly must-watch callout should feature ${bestGame.label}`);
  assert(
    normalized.includes(formatUpcomingDate(bestGame.date)),
    `${route} weekly must-watch callout should show the featured game's slate date`,
  );
  assert(
    anchorHasAttributes(html, {
      href: `/upcoming/${bestGame.date}`,
      "aria-label": `View featured game day slate for ${formatUpcomingDate(bestGame.date)}`,
    }),
    `${route} weekly must-watch callout should link to the featured game's day slate with an accessible label`,
  );
  assert(
    normalized.includes("#1 week pick"),
    `${route} weekly must-watch callout should use slate-relative watch copy`,
  );
}

function assertWeekDaySlateLinks(html, route, days) {
  assert(html.includes("Day slate"), `${route} should link back to day slates`);
  assert(!html.includes('id="must-watch"'), `${route} should not reuse the default day watch-list section id`);
  days.forEach((day) => {
    const sectionId = `must-watch-${day.date}`;
    assert(
      anchorHasAttributes(html, {
        href: `/upcoming/${day.date}`,
        "aria-label": `View day slate for ${formatUpcomingDate(day.date)}`,
      }),
      `${route} should link ${day.date} back to its day slate with an accessible label`,
    );
    assert(
      countOccurrences(html, `id="${sectionId}"`) === 1,
      `${route} should render a stable watch-list section id for ${day.date}`,
    );
  });
}

function countOccurrences(value, needle) {
  let count = 0;
  let index = value.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = value.indexOf(needle, index + needle.length);
  }
  return count;
}

function assertRenderedWatchCards(html, route, games, rankLabel, sectionId = "must-watch", scheduledGames = games.length) {
  const normalized = normalizeHtmlText(html);
  const headingId = `${sectionId}-heading`;
  assert(
    elementHasAttributes(html, "section", { id: sectionId, "aria-labelledby": headingId }),
    `${route} should render a labelled watch-list section ${sectionId}`,
  );
  assert(
    countOccurrences(html, `id="${headingId}"`) === 1,
    `${route} should render exactly one watch-list heading id for ${sectionId}`,
  );
  assert(
    elementWithTextHasAttributes(html, "h2", { id: headingId }, "Must-Watch Games"),
    `${route} should label watch-list section ${sectionId} with its visible heading`,
  );
  if (games.length === 0) {
    const expectedEmptyHeading = scheduledGames > 0 ? "Slate complete" : "No games on this slate";
    const unexpectedEmptyHeading = scheduledGames > 0 ? "No games on this slate" : "Slate complete";
    assert(
      divHasAttributes(html, { role: "status", "aria-label": "Upcoming slate status" }),
      `${route} should expose its empty upcoming slate state as a status region`,
    );
    assert(
      normalized.includes(expectedEmptyHeading),
      `${route} should render ${expectedEmptyHeading} for its empty upcoming slate state`,
    );
    assert(
      !normalized.includes(unexpectedEmptyHeading),
      `${route} should not render ${unexpectedEmptyHeading} for its empty upcoming slate state`,
    );
    return;
  }

  games.forEach((game, index) => {
    const rank = index + 1;
    const card = renderedGameCard(html, route, game, rank, rankLabel);
    const summaryId = `watch-card-${game.gamePk}-summary`;
    assert(
      countOccurrences(card.html, `id="${summaryId}"`) === 1,
      `${route} should render exactly one watch-card summary id for ${game.label}`,
    );
    assert(
      elementHasAttributes(card.html, "article", {
        "aria-label": `Watch card for ${game.label} on ${formatUpcomingDate(game.date)}`,
        "aria-describedby": summaryId,
      }),
      `${route} should label and describe the watch-card article for ${game.label} on ${formatUpcomingDate(game.date)}`,
    );
    assert(
      elementHasAttributes(card.html, "p", {
        id: summaryId,
        "aria-label": `${expectedGameStatusLabel(game.status)} ${game.label}, ${formatFirstPitch(game.firstPitch)}, ${game.park ?? "Venue TBD"}`,
      }),
      `${route} should expose the watch-card summary description for ${game.label}`,
    );
    assert(card.text.includes(game.label), `${route} should render visible card label for ${game.label}`);
    assert(
      card.text.includes(expectedGameStatusLabel(game.status)),
      `${route} should render visible status ${game.status} for ${game.label}`,
    );
    assert(
      card.text.includes(formatFirstPitch(game.firstPitch)),
      `${route} should render first pitch time for ${game.label}`,
    );
    assert(
      timeHasDateTime(card.html, game.firstPitch),
      `${route} should render first pitch as a time element for ${game.label}`,
    );
    if (game.park) {
      assert(card.text.includes(game.park), `${route} should render venue for ${game.label}`);
    } else {
      assert(card.text.includes("Venue TBD"), `${route} should render venue fallback for ${game.label}`);
    }
    assert(
      card.text.includes(expectedWatchTierLabelForRank(rank)),
      `${route} should render visible watch tier for ${game.label}`,
    );
    assertRenderedWatchRank(card.text, route, game, rank);
    assert(
      hasSlateWatchRank(card.text, rank, scheduledGames),
      `${route} should render visible slate-relative watch rank for ${game.label}`,
    );
    assert(card.text.includes("Matchup"), `${route} should render matchup context for ${game.label}`);
    assert(
      card.text.includes("Matchup") && card.text.includes(game.matchupScore.toFixed(1)),
      `${route} should render matchup score for ${game.label}`,
    );
    assert(
      card.text.includes(`${ordinal(game.matchupRankTonight)} ${rankLabel}`),
      `${route} should render matchup rank for ${game.label}`,
    );
    assert(
      divHasAttributes(card.html, {
        role: "img",
        "aria-label": `Matchup score ${Math.round(game.matchupScore)}, ranked ${ordinal(game.matchupRankTonight)} ${rankLabel}`,
      }),
      `${route} should render an accessible matchup summary for ${game.label}`,
    );
    assertRenderedWatchFlags(card.html, card.text, route, game);
    assertRenderedWatchComponents(card.html, card.text, route, game);
    assertRenderedStarters(card.html, card.text, route, game, { requireSparkline: true });
  });
}

function renderedGameCard(html, route, game, rank, rankLabel) {
  const articles = html.match(/<article\b[^>]*>.*?<\/article>/gs) ?? [];
  const rankLine = `#${rank} of`;
  const firstPitch = formatFirstPitch(game.firstPitch);
  const matchupRankLine = `${ordinal(game.matchupRankTonight)} ${rankLabel}`;
  const matches = articles
    .map((article) => ({ html: article, text: normalizeHtmlText(article) }))
    .filter(
      (article) =>
        article.text.includes(game.label) &&
        article.text.includes(rankLine) &&
        article.text.includes("watch rank") &&
        article.text.includes(firstPitch) &&
        article.text.includes(matchupRankLine),
    );
  assert(matches.length > 0, `${route} should render a card article for ${game.label}`);
  assert(matches.length === 1, `${route} should render exactly one card article for ${game.label}`);
  return matches[0];
}

function hasSlateWatchRank(text, rank, slateSize) {
  return new RegExp(`#\\s*${rank}\\s+of\\s+${slateSize}\\s+watch rank`).test(text);
}

function assertRenderedWatchRank(normalizedHtml, route, game, rank) {
  const tierLabel = expectedWatchTierLabelForRank(rank);
  const visibleRank = game.status === "ppd" ? "#-" : `#${rank}`;
  assert(
    normalizedHtml.includes(visibleRank) && normalizedHtml.includes(tierLabel),
    `${route} should render visible watch rank ${visibleRank} with tier ${tierLabel} for ${game.label}`,
  );
}

function assertRenderedWatchComponents(html, normalizedHtml, route, game) {
  assert(
    divHasAttributes(html, {
      "data-game-pk": game.gamePk,
      role: "group",
      "aria-label": watchComponentsAriaLabel(game),
    }),
    `${route} should group watch components for ${game.label} with a game-scoped accessible label`,
  );

  for (const [label, value] of [
    ["Top arm", game.watchComponents?.topArm],
    ["Pairing", game.watchComponents?.pairing],
    ["Matchup", game.matchupScore],
  ]) {
    assertNumber(value, `${route} ${game.label} ${label} watch component`);
    assert(
      normalizedHtml.includes(label) && normalizedHtml.includes(value.toFixed(1)),
      `${route} should render ${label} watch component for ${game.label}`,
    );
  }
}

function assertRenderedWatchFlags(html, normalizedHtml, route, game) {
  if (game.flags?.tbd) {
    assert(
      normalizedHtml.includes("TBD starter included with league-mean fallback."),
      `${route} should explain TBD starter fallback on ${game.label}`,
    );
  }

  if (game.flags?.limitedForm) {
    assert(
      normalizedHtml.includes("Limited form samples use baseline fallback where needed."),
      `${route} should explain limited-form fallback on ${game.label}`,
    );
  }

  if (game.flags?.tbd || game.flags?.limitedForm) {
    assert(
      elementHasAttributes(html, "p", { "aria-label": watchFlagNoteAriaLabel(game) }),
      `${route} should expose accessible watch-card fallback context for ${game.label}`,
    );
  }
}

function assertRenderedStarters(html, normalizedHtml, route, game, options = {}) {
  game.starters.forEach((starter) => {
    const label = `${route} ${game.label} ${starter.side} starter`;
    const starterName = starter.name ?? "TBD";
    assert(normalizedHtml.includes(starterName), `${label} should render ${starterName}`);
    assert(normalizedHtml.includes(starter.team), `${label} should render ${starter.team}`);
    assert(
      divHasAttributes(html, { role: "group", "aria-label": starterBlockAriaLabel(starter) }),
      `${label} should expose its side, name, and team on a grouped starter block`,
    );
    if (starter.pitcherId) {
      assert(
        anchorHasAttributes(html, {
          href: `/pitchers/${starter.pitcherId}/form`,
          "aria-label": `View ${starter.name} form`,
        }),
        `${label} starter name link should point to pitcher Form with an accessible label`,
      );
      assert(
        html.includes(`/people/${starter.pitcherId}/headshot/67/current`),
        `${label} should render a linked MLB headshot`,
      );
      assert(
        imageHasAttributes(html, {
          src: starterHeadshotUrl(starter.pitcherId),
          alt: starter.name,
          width: "100",
          height: "100",
        }),
        `${label} headshot image should expose starter src, alt text, and stable dimensions on the same image`,
      );
      assert(
        anchorHasAttributes(html, {
          href: `/pitchers/${starter.pitcherId}/form`,
          "aria-label": `${starter.name} form`,
        }),
        `${label} headshot link should point to pitcher Form with an accessible label`,
      );
    }

    if (starter.status === "ok") {
      assertNumber(starter.rgs, `${label} rendered rgs`);
      assertNumber(starter.deltaForm, `${label} rendered deltaForm`);
      assert(normalizedHtml.includes(starter.rgs.toFixed(1)), `${label} should render Form ${starter.rgs.toFixed(1)}`);
      assert(
        normalizedHtml.includes(`${expectedTrendLabel(starter.trend)} ${formatSignedValue(starter.deltaForm)}`),
        `${label} should render trend ${starter.trend} ${formatSignedValue(starter.deltaForm)}`,
      );
      if (options.requireSparkline) {
        assert(
          html.includes(`aria-label="${starter.name} recent form GS+: ${starter.spark.join(", ")}"`),
          `${label} should render accessible recent-form sparkline`,
        );
      }
      return;
    }

    if (starter.status === "insufficient") {
      assert(
        elementHasAttributes(html, "p", { "aria-label": starterFallbackAriaLabel(starter) }),
        `${label} should expose accessible limited-form fallback copy`,
      );
      assert(
        normalizedHtml.includes("Limited form sample") || normalizedHtml.includes("Limited"),
        `${label} should render limited-form fallback copy`,
      );
      if (starter.lastStart) {
        assert(
          normalizedHtml.includes(`Last: vs ${starter.lastStart.opp}`),
          `${label} should render limited-form last-start opponent`,
        );
        assert(
          normalizedHtml.includes(`GS+ ${starter.lastStart.gsPlus}`),
          `${label} should render limited-form last-start GS+`,
        );
      }
      return;
    }

    assert(
      elementHasAttributes(html, "p", { "aria-label": starterFallbackAriaLabel(starter) }),
      `${label} should expose accessible TBD fallback copy`,
    );
    assert(normalizedHtml.includes("Starter TBD") || normalizedHtml.includes("TBD"), `${label} should render TBD fallback copy`);
    assert(
      spanHasAttributes(html, { role: "img", "aria-label": `TBD ${starter.team} starter` }),
      `${label} should render an accessible TBD starter placeholder`,
    );
  });
}

function starterBlockAriaLabel(starter) {
  const side = starter.side === "away" ? "Away" : "Home";
  return `${side} starter: ${starter.name ?? "TBD"} (${starter.team})`;
}

function starterFallbackAriaLabel(starter) {
  return starter.status === "tbd" ? "Starter TBD / league baseline used" : "Limited form sample";
}

function watchFlagNoteAriaLabel(game) {
  const notes = [];
  if (game.flags?.tbd) notes.push("TBD starter included with league-mean fallback");
  if (game.flags?.limitedForm) notes.push("Limited form samples use baseline fallback where needed");
  return notes.join("; ");
}

function watchComponentsAriaLabel(game) {
  return `Watch components for ${game.label} on ${formatUpcomingDate(game.date)}`;
}

function normalizeHtmlText(html) {
  return html
    .replace(/<!-- -->/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function formatFirstPitch(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: siteTimeZone,
    timeZoneName: "short",
  }).format(parsed);
}

function ordinal(value) {
  const suffix = value % 10 === 1 && value % 100 !== 11
    ? "st"
    : value % 10 === 2 && value % 100 !== 12
      ? "nd"
      : value % 10 === 3 && value % 100 !== 13
        ? "rd"
        : "th";
  return `${value}${suffix}`;
}

function formatUpcomingDate(dateToFormat) {
  const parsed = new Date(`${dateToFormat}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf())) return dateToFormat;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(parsed);
}

function addDays(start, offset) {
  const value = new Date(`${start}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

const port = await reservePort();
const baseUrl = `http://${host}:${port}`;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
  env: {
    ...process.env,
    PORT: String(port),
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

  const response = await fetch(`${baseUrl}/api/upcoming?start=${encodeURIComponent(date)}&days=${encodeURIComponent(days)}&window=${encodeURIComponent(windowSize)}`);
  assert(response.ok, `/api/upcoming returned HTTP ${response.status}`);
  const upcoming = await response.json();

  const expectedDays = Math.max(1, Math.min(7, Number(days)));
  assertUpcomingEnvelope(upcoming, date, expectedDays, "requested upcoming range");

  const totals = upcoming.days.map((day, index) => assertDay(day, addDays(date, index), { requireCompleteStarter: expectedDays === 1 }));
  const gameCount = totals.reduce((total, row) => total + row.games, 0);
  const okStarterCount = totals.reduce((total, row) => total + row.okStarterCount, 0);
  assert(okStarterCount > 0, `${upcoming.range.start}..${upcoming.range.end} should expose at least one probable with complete form fields`);

  const dateResponse = await fetch(`${baseUrl}/api/upcoming?date=${encodeURIComponent(date)}&window=${encodeURIComponent(windowSize)}`);
  assert(dateResponse.ok, `/api/upcoming?date=${date} returned HTTP ${dateResponse.status}`);
  const dateUpcoming = await dateResponse.json();
  assert(dateUpcoming.range?.start === date, `date query range start must be ${date}`);
  assert(dateUpcoming.range?.end === date, `date query range end must be ${date}`);
  assertIsoTimestamp(dateUpcoming.generatedAt, "date query upcoming generatedAt");
  assert(Array.isArray(dateUpcoming.days) && dateUpcoming.days.length === 1, "date query should return exactly one day group");
  assertDay(dateUpcoming.days[0], date, { requireCompleteStarter: true });
  assert(
    gameOrder(dateUpcoming.days[0]) === gameOrder(upcoming.days[0]),
    "date query should match the first range day game order",
  );
  assert(
    dayApiSignature(dateUpcoming.days[0]) === dayApiSignature(upcoming.days[0]),
    "date query should match the first range day payload",
  );

  const tonightDateResponse = await fetch(`${baseUrl}/api/tonight?date=${encodeURIComponent(date)}&window=${encodeURIComponent(windowSize)}`);
  assert(tonightDateResponse.ok, `/api/tonight?date=${date} returned HTTP ${tonightDateResponse.status}`);
  const tonightDate = await tonightDateResponse.json();
  assertDay(tonightDate, date, { requireCompleteStarter: dateUpcoming.days[0].games.length > 0 });
  assert(
    gameOrder(tonightDate) === gameOrder(dateUpcoming.days[0]),
    "explicit tonight date query should match the upcoming date query game order",
  );
  assert(
    formWindowSignature(tonightDate) === formWindowSignature(dateUpcoming.days[0]),
    "explicit tonight date query should match the upcoming date query form payload",
  );
  assert(
    dayApiSignature(tonightDate) === dayApiSignature(dateUpcoming.days[0]),
    "explicit tonight date query should match the upcoming date query day payload",
  );

  const mixedStart = addDays(date, 1);
  const mixedDateStartResponse = await fetch(
    `${baseUrl}/api/upcoming?date=${encodeURIComponent(date)}&start=${encodeURIComponent(mixedStart)}&days=2&window=${encodeURIComponent(windowSize)}`,
  );
  assert(mixedDateStartResponse.ok, `/api/upcoming mixed date/start query returned HTTP ${mixedDateStartResponse.status}`);
  const mixedDateStartUpcoming = await mixedDateStartResponse.json();
  assert(mixedDateStartUpcoming.range?.start === mixedStart, "mixed date/start query should prefer start for range requests");
  assert(mixedDateStartUpcoming.range?.end === addDays(mixedStart, 1), "mixed date/start query should preserve requested range length");
  assert(Array.isArray(mixedDateStartUpcoming.days) && mixedDateStartUpcoming.days.length === 2, "mixed date/start query should return a two-day range");
  mixedDateStartUpcoming.days.forEach((day, index) => {
    assertDay(day, addDays(mixedStart, index), { requireCompleteStarter: index === 0 });
  });

  const window10Response = await fetch(`${baseUrl}/api/upcoming?date=${encodeURIComponent(date)}&window=10`);
  assert(window10Response.ok, `/api/upcoming?date=${date}&window=10 returned HTTP ${window10Response.status}`);
  const window10Upcoming = await window10Response.json();
  assert(window10Upcoming.range?.start === date, "window=10 query range start should match the requested date");
  assert(window10Upcoming.range?.end === date, "window=10 query range end should match the requested date");
  assert(Array.isArray(window10Upcoming.days) && window10Upcoming.days.length === 1, "window=10 query should return one day group");
  assertDay(window10Upcoming.days[0], date, { requireCompleteStarter: true });

  const tonightWindow10Response = await fetch(`${baseUrl}/api/tonight?date=${encodeURIComponent(date)}&window=10`);
  assert(tonightWindow10Response.ok, `/api/tonight?date=${date}&window=10 returned HTTP ${tonightWindow10Response.status}`);
  const tonightWindow10 = await tonightWindow10Response.json();
  assertDay(tonightWindow10, date, { requireCompleteStarter: window10Upcoming.days[0].games.length > 0 });
  assert(
    dayApiSignature(tonightWindow10) === dayApiSignature(window10Upcoming.days[0]),
    "explicit tonight window=10 query should match the upcoming window=10 day payload",
  );

  const invalidWindowResponse = await fetch(`${baseUrl}/api/upcoming?date=${encodeURIComponent(date)}&window=99`);
  assert(invalidWindowResponse.ok, `/api/upcoming?date=${date}&window=99 returned HTTP ${invalidWindowResponse.status}`);
  const invalidWindowUpcoming = await invalidWindowResponse.json();
  assert(Array.isArray(invalidWindowUpcoming.days) && invalidWindowUpcoming.days.length === 1, "invalid window query should return one day group");
  assertDay(invalidWindowUpcoming.days[0], date, { requireCompleteStarter: true });
  assert(
    formWindowSignature(invalidWindowUpcoming.days[0]) === formWindowSignature(dateUpcoming.days[0]),
    "invalid window query should fall back to the default form window",
  );

  const invalidTonightWindowResponse = await fetch(`${baseUrl}/api/tonight?date=${encodeURIComponent(date)}&window=99`);
  assert(invalidTonightWindowResponse.ok, `/api/tonight?date=${date}&window=99 returned HTTP ${invalidTonightWindowResponse.status}`);
  const invalidTonightWindow = await invalidTonightWindowResponse.json();
  assertDay(invalidTonightWindow, date, { requireCompleteStarter: dateUpcoming.days[0].games.length > 0 });
  assert(
    dayApiSignature(invalidTonightWindow) === dayApiSignature(dateUpcoming.days[0]),
    "invalid tonight window query should fall back to the default upcoming day payload",
  );

  const fractionalWindowResponse = await fetch(`${baseUrl}/api/upcoming?date=${encodeURIComponent(date)}&window=3.5`);
  assert(fractionalWindowResponse.ok, `/api/upcoming?date=${date}&window=3.5 returned HTTP ${fractionalWindowResponse.status}`);
  const fractionalWindowUpcoming = await fractionalWindowResponse.json();
  assert(Array.isArray(fractionalWindowUpcoming.days) && fractionalWindowUpcoming.days.length === 1, "fractional window query should return one day group");
  assertDay(fractionalWindowUpcoming.days[0], date, { requireCompleteStarter: true });
  assert(
    dayApiSignature(fractionalWindowUpcoming.days[0]) === dayApiSignature(dateUpcoming.days[0]),
    "fractional window query should fall back to the default upcoming day payload",
  );

  const fractionalTonightWindowResponse = await fetch(`${baseUrl}/api/tonight?date=${encodeURIComponent(date)}&window=3.5`);
  assert(fractionalTonightWindowResponse.ok, `/api/tonight?date=${date}&window=3.5 returned HTTP ${fractionalTonightWindowResponse.status}`);
  const fractionalTonightWindow = await fractionalTonightWindowResponse.json();
  assertDay(fractionalTonightWindow, date, { requireCompleteStarter: dateUpcoming.days[0].games.length > 0 });
  assert(
    dayApiSignature(fractionalTonightWindow) === dayApiSignature(dateUpcoming.days[0]),
    "fractional tonight window query should fall back to the default upcoming day payload",
  );

  const clampedDaysResponse = await fetch(`${baseUrl}/api/upcoming?start=${encodeURIComponent(date)}&days=99&window=${encodeURIComponent(windowSize)}`);
  assert(clampedDaysResponse.ok, `/api/upcoming?days=99 returned HTTP ${clampedDaysResponse.status}`);
  const clampedDaysUpcoming = await clampedDaysResponse.json();
  assert(clampedDaysUpcoming.range?.start === date, "oversized days query should preserve the requested start date");
  assert(clampedDaysUpcoming.range?.end === addDays(date, 6), "oversized days query should clamp to a 7-day range");
  assert(Array.isArray(clampedDaysUpcoming.days) && clampedDaysUpcoming.days.length === 7, "oversized days query should return 7 day groups");
  clampedDaysUpcoming.days.forEach((day, index) => {
    assertDay(day, addDays(date, index), { requireCompleteStarter: index === 0 });
  });

  const undersizedDaysResponse = await fetch(`${baseUrl}/api/upcoming?start=${encodeURIComponent(date)}&days=0&window=${encodeURIComponent(windowSize)}`);
  assert(undersizedDaysResponse.ok, `/api/upcoming?days=0 returned HTTP ${undersizedDaysResponse.status}`);
  const undersizedDaysUpcoming = await undersizedDaysResponse.json();
  assert(undersizedDaysUpcoming.range?.start === date, "undersized days query should preserve the requested start date");
  assert(undersizedDaysUpcoming.range?.end === date, "undersized days query should clamp to a one-day range");
  assert(Array.isArray(undersizedDaysUpcoming.days) && undersizedDaysUpcoming.days.length === 1, "undersized days query should return one day group");
  assertDay(undersizedDaysUpcoming.days[0], date, { requireCompleteStarter: true });
  assert(
    gameOrder(undersizedDaysUpcoming.days[0]) === gameOrder(upcoming.days[0]),
    "undersized days query should match the first range day game order",
  );
  assert(
    dayApiSignature(undersizedDaysUpcoming.days[0]) === dayApiSignature(upcoming.days[0]),
    "undersized days query should match the first range day payload",
  );

  const negativeDaysResponse = await fetch(`${baseUrl}/api/upcoming?start=${encodeURIComponent(date)}&days=-3&window=${encodeURIComponent(windowSize)}`);
  assert(negativeDaysResponse.ok, `/api/upcoming?days=-3 returned HTTP ${negativeDaysResponse.status}`);
  const negativeDaysUpcoming = await negativeDaysResponse.json();
  assert(negativeDaysUpcoming.range?.start === date, "negative days query should preserve the requested start date");
  assert(negativeDaysUpcoming.range?.end === date, "negative days query should clamp to a one-day range");
  assert(Array.isArray(negativeDaysUpcoming.days) && negativeDaysUpcoming.days.length === 1, "negative days query should return one day group");
  assertDay(negativeDaysUpcoming.days[0], date, { requireCompleteStarter: true });
  assert(
    gameOrder(negativeDaysUpcoming.days[0]) === gameOrder(upcoming.days[0]),
    "negative days query should match the first range day game order",
  );
  assert(
    dayApiSignature(negativeDaysUpcoming.days[0]) === dayApiSignature(upcoming.days[0]),
    "negative days query should match the first range day payload",
  );

  const invalidDaysResponse = await fetch(`${baseUrl}/api/upcoming?start=${encodeURIComponent(date)}&days=abc&window=${encodeURIComponent(windowSize)}`);
  assert(invalidDaysResponse.ok, `/api/upcoming?days=abc returned HTTP ${invalidDaysResponse.status}`);
  const invalidDaysUpcoming = await invalidDaysResponse.json();
  assert(invalidDaysUpcoming.range?.start === date, "invalid days query should preserve the requested start date");
  assert(invalidDaysUpcoming.range?.end === date, "invalid days query should fall back to a one-day range");
  assert(Array.isArray(invalidDaysUpcoming.days) && invalidDaysUpcoming.days.length === 1, "invalid days query should return one day group");
  assertDay(invalidDaysUpcoming.days[0], date, { requireCompleteStarter: true });
  assert(
    gameOrder(invalidDaysUpcoming.days[0]) === gameOrder(upcoming.days[0]),
    "invalid days query should match the first range day game order",
  );
  assert(
    dayApiSignature(invalidDaysUpcoming.days[0]) === dayApiSignature(upcoming.days[0]),
    "invalid days query should match the first range day payload",
  );

  const fractionalDaysResponse = await fetch(`${baseUrl}/api/upcoming?start=${encodeURIComponent(date)}&days=2.9&window=${encodeURIComponent(windowSize)}`);
  assert(fractionalDaysResponse.ok, `/api/upcoming?days=2.9 returned HTTP ${fractionalDaysResponse.status}`);
  const fractionalDaysUpcoming = await fractionalDaysResponse.json();
  assert(fractionalDaysUpcoming.range?.start === date, "fractional days query should preserve the requested start date");
  assert(fractionalDaysUpcoming.range?.end === addDays(date, 1), "fractional days query should floor to a two-day range");
  assert(Array.isArray(fractionalDaysUpcoming.days) && fractionalDaysUpcoming.days.length === 2, "fractional days query should return two day groups");
  fractionalDaysUpcoming.days.forEach((day, index) => {
    assertDay(day, addDays(date, index), { requireCompleteStarter: index === 0 });
  });
  assert(
    gameOrder(fractionalDaysUpcoming.days[0]) === gameOrder(upcoming.days[0]),
    "fractional days query should match the first range day game order",
  );
  assert(
    dayApiSignature(fractionalDaysUpcoming.days[0]) === dayApiSignature(upcoming.days[0]),
    "fractional days query should match the first range day payload",
  );

  const defaultDateResponse = await fetch(`${baseUrl}/api/upcoming?window=${encodeURIComponent(windowSize)}`);
  assert(defaultDateResponse.ok, `/api/upcoming default date returned HTTP ${defaultDateResponse.status}`);
  const defaultDateUpcoming = await defaultDateResponse.json();
  assertDateKey(defaultDateUpcoming.range?.start, "default date query range start");
  assert(defaultDateUpcoming.range?.start === defaultDateUpcoming.range?.end, "default date query should return a one-day range");
  assert(Array.isArray(defaultDateUpcoming.days) && defaultDateUpcoming.days.length === 1, "default date query should return one day group");
  const defaultDayTotals = assertDay(defaultDateUpcoming.days[0], defaultDateUpcoming.range.start, { requireCompleteStarter: true });

  const defaultTonightResponse = await fetch(`${baseUrl}/api/tonight?window=${encodeURIComponent(windowSize)}`);
  assert(defaultTonightResponse.ok, `/api/tonight default date returned HTTP ${defaultTonightResponse.status}`);
  const defaultTonight = await defaultTonightResponse.json();
  assertDay(defaultTonight, defaultDateUpcoming.range.start, { requireCompleteStarter: true });
  assert(
    dayApiSignature(defaultTonight) === dayApiSignature(defaultDateUpcoming.days[0]),
    "default tonight query should match the default upcoming day payload",
  );

  const invalidTonightDateResponse = await fetch(`${baseUrl}/api/tonight?date=not-a-date&window=${encodeURIComponent(windowSize)}`);
  assert(invalidTonightDateResponse.ok, `/api/tonight?date=not-a-date returned HTTP ${invalidTonightDateResponse.status}`);
  const invalidTonightDate = await invalidTonightDateResponse.json();
  assertDay(invalidTonightDate, defaultDateUpcoming.range.start, { requireCompleteStarter: true });
  assert(
    gameOrder(invalidTonightDate) === gameOrder(defaultTonight),
    "invalid tonight date query should match the default home slate game order",
  );
  assert(
    dayApiSignature(invalidTonightDate) === dayApiSignature(defaultTonight),
    "invalid tonight date query should match the default tonight day payload",
  );

  const defaultWeekResponse = await fetch(`${baseUrl}/api/upcoming?start=${encodeURIComponent(defaultDateUpcoming.range.start)}&days=7&window=${encodeURIComponent(windowSize)}`);
  assert(defaultWeekResponse.ok, `/api/upcoming default week returned HTTP ${defaultWeekResponse.status}`);
  const defaultWeekUpcoming = await defaultWeekResponse.json();
  assert(defaultWeekUpcoming.range?.start === defaultDateUpcoming.range.start, "default week query should start from the home slate date");
  assert(defaultWeekUpcoming.range?.end === addDays(defaultDateUpcoming.range.start, 6), "default week query should return a seven-day range");
  assert(Array.isArray(defaultWeekUpcoming.days) && defaultWeekUpcoming.days.length === 7, "default week query should return seven day groups");
  const defaultWeekTotals = defaultWeekUpcoming.days.map((day, index) => assertDay(day, addDays(defaultDateUpcoming.range.start, index), { requireCompleteStarter: index === 0 }));
  const defaultWeekGameCount = defaultWeekTotals.reduce((total, row) => total + row.games, 0);
  const defaultWeekGames = defaultWeekUpcoming.days.flatMap((day) => day.games.map((game) => ({ ...game, date: day.date })));

  const invalidDateResponse = await fetch(`${baseUrl}/api/upcoming?date=not-a-date&window=${encodeURIComponent(windowSize)}`);
  assert(invalidDateResponse.ok, `/api/upcoming?date=not-a-date returned HTTP ${invalidDateResponse.status}`);
  const invalidDateUpcoming = await invalidDateResponse.json();
  assert(
    invalidDateUpcoming.range?.start === defaultDateUpcoming.range.start,
    "invalid date query should fall back to the default home slate date",
  );
  assert(invalidDateUpcoming.range?.end === defaultDateUpcoming.range.end, "invalid date query should fall back to a one-day range");
  assert(Array.isArray(invalidDateUpcoming.days) && invalidDateUpcoming.days.length === 1, "invalid date query should return one day group");
  assertDay(invalidDateUpcoming.days[0], defaultDateUpcoming.range.start, { requireCompleteStarter: true });
  assert(
    gameOrder(invalidDateUpcoming.days[0]) === gameOrder(defaultDateUpcoming.days[0]),
    "invalid date query should match the default home slate game order",
  );
  assert(
    dayApiSignature(invalidDateUpcoming.days[0]) === dayApiSignature(defaultDateUpcoming.days[0]),
    "invalid date query should match the default home slate payload",
  );

  const invalidStartResponse = await fetch(`${baseUrl}/api/upcoming?start=not-a-date&days=7&window=${encodeURIComponent(windowSize)}`);
  assert(invalidStartResponse.ok, `/api/upcoming?start=not-a-date returned HTTP ${invalidStartResponse.status}`);
  const invalidStartUpcoming = await invalidStartResponse.json();
  assert(
    invalidStartUpcoming.range?.start === defaultDateUpcoming.range.start,
    "invalid start query should fall back to the default home slate date",
  );
  assert(
    invalidStartUpcoming.range?.end === addDays(defaultDateUpcoming.range.start, 6),
    "invalid start query should preserve the requested week length from the default home slate date",
  );
  assert(Array.isArray(invalidStartUpcoming.days) && invalidStartUpcoming.days.length === 7, "invalid start query should return a seven-day range");
  invalidStartUpcoming.days.forEach((day, index) => {
    assertDay(day, addDays(defaultDateUpcoming.range.start, index), { requireCompleteStarter: index === 0 });
  });
  assert(
    gameOrder(invalidStartUpcoming.days[0]) === gameOrder(defaultDateUpcoming.days[0]),
    "invalid start query should match the default home slate game order on the first day",
  );
  assert(
    dayApiSignature(invalidStartUpcoming.days[0]) === dayApiSignature(defaultDateUpcoming.days[0]),
    "invalid start query should match the default home slate payload on the first day",
  );

  const mixedInvalidStartResponse = await fetch(
    `${baseUrl}/api/upcoming?date=${encodeURIComponent(date)}&start=not-a-date&days=2&window=${encodeURIComponent(windowSize)}`,
  );
  assert(mixedInvalidStartResponse.ok, `/api/upcoming mixed invalid start query returned HTTP ${mixedInvalidStartResponse.status}`);
  const mixedInvalidStartUpcoming = await mixedInvalidStartResponse.json();
  assert(
    mixedInvalidStartUpcoming.range?.start === defaultDateUpcoming.range.start,
    "mixed invalid start query should still follow range-start fallback semantics",
  );
  assert(
    mixedInvalidStartUpcoming.range?.end === addDays(defaultDateUpcoming.range.start, 1),
    "mixed invalid start query should preserve requested two-day range from the fallback slate",
  );
  assert(Array.isArray(mixedInvalidStartUpcoming.days) && mixedInvalidStartUpcoming.days.length === 2, "mixed invalid start query should return a two-day range");
  mixedInvalidStartUpcoming.days.forEach((day, index) => {
    assertDay(day, addDays(defaultDateUpcoming.range.start, index), { requireCompleteStarter: index === 0 });
  });
  assert(
    gameOrder(mixedInvalidStartUpcoming.days[0]) === gameOrder(defaultDateUpcoming.days[0]),
    "mixed invalid start query should match the default home slate game order on the first day",
  );
  assert(
    dayApiSignature(mixedInvalidStartUpcoming.days[0]) === dayApiSignature(defaultDateUpcoming.days[0]),
    "mixed invalid start query should match the default home slate payload on the first day",
  );

  const legacyTodayPage = await fetch(`${baseUrl}/slate/today/${encodeURIComponent(date)}`);
  assertFollowedRedirect(legacyTodayPage, `/slate/today/${date}`, `/upcoming/${date}`);

  const legacyTomorrowPage = await fetch(`${baseUrl}/slate/tomorrow/${encodeURIComponent(addDays(date, 1))}`);
  assertFollowedRedirect(legacyTomorrowPage, `/slate/tomorrow/${addDays(date, 1)}`, `/upcoming/${addDays(date, 1)}`);

  const legacyWeekPage = await fetch(`${baseUrl}/slate/week/${encodeURIComponent(date)}`);
  assertFollowedRedirect(legacyWeekPage, `/slate/week/${date}`, `/upcoming/week/${date}`);

  const dayPage = await fetch(`${baseUrl}/upcoming/${encodeURIComponent(date)}`);
  assert(dayPage.ok, `/upcoming/${date} returned HTTP ${dayPage.status}`);
  const dayHtml = await dayPage.text();
  assert(dayHtml.includes("Upcoming MLB Starters"), `/upcoming/${date} should render route metadata`);
  assertMetadata(
    dayHtml,
    `/upcoming/${date}`,
    `Upcoming MLB Starters: ${formatUpcomingDate(date)}`,
    expectedUpcomingDayDescription(upcoming.days[0]),
  );
  assertJsonLd(
    dayHtml,
    `/upcoming/${date}`,
    `Upcoming MLB Starters: ${formatUpcomingDate(date)}`,
    expectedUpcomingDayDescription(upcoming.days[0]),
    totals[0].games,
    upcoming.days[0].games,
    `/upcoming/${date}`,
  );
  assertRenderedWatchCards(dayHtml, `/upcoming/${date}`, upcoming.days[0].games, `on ${formatUpcomingDate(date)}`, "must-watch", upcoming.days[0].scheduledGames);
  assertPrimarySlateCta(dayHtml, `/upcoming/${date}`, "Week view", `/upcoming/week/${date}`, `View week of ${formatUpcomingDate(date)}`);
  assertUpcomingRangeToggle(
    dayHtml,
    `/upcoming/${date}`,
    defaultDateUpcoming.range.start,
    defaultDateUpcoming.range.start,
    [defaultDateUpcoming.range.start, addDays(defaultDateUpcoming.range.start, 1)].includes(date) ? `/upcoming/${date}` : null,
  );
  assertUpcomingControls(dayHtml, `/upcoming/${date}`);
  assertNoLegacySlateLinks(dayHtml, `/upcoming/${date}`);
  await assertPng(`${baseUrl}/upcoming/${encodeURIComponent(date)}/opengraph-image`, `/upcoming/${date}/opengraph-image`);

  const invalidDayPage = await fetch(`${baseUrl}/upcoming/not-a-date`);
  assert(invalidDayPage.ok, "/upcoming/not-a-date returned HTTP " + invalidDayPage.status);
  const invalidDayHtml = await invalidDayPage.text();
  assertMetadata(
    invalidDayHtml,
    `/upcoming/${defaultDateUpcoming.range.start}`,
    `Upcoming MLB Starters: ${formatUpcomingDate(defaultDateUpcoming.range.start)}`,
    expectedUpcomingDayDescription(defaultDateUpcoming.days[0]),
  );
  assertJsonLd(
    invalidDayHtml,
    "/upcoming/not-a-date",
    `Upcoming MLB Starters: ${formatUpcomingDate(defaultDateUpcoming.range.start)}`,
    expectedUpcomingDayDescription(defaultDateUpcoming.days[0]),
    defaultDayTotals.games,
    defaultDateUpcoming.days[0].games,
    `/upcoming/${defaultDateUpcoming.range.start}`,
  );
  assertRenderedWatchCards(
    invalidDayHtml,
    "/upcoming/not-a-date",
    defaultDateUpcoming.days[0].games,
    `on ${formatUpcomingDate(defaultDateUpcoming.range.start)}`,
    "must-watch",
    defaultDateUpcoming.days[0].scheduledGames,
  );
  assertPrimarySlateCta(
    invalidDayHtml,
    "/upcoming/not-a-date",
    "Week view",
    `/upcoming/week/${defaultDateUpcoming.range.start}`,
    `View week of ${formatUpcomingDate(defaultDateUpcoming.range.start)}`,
  );
  assertUpcomingRangeToggle(
    invalidDayHtml,
    "/upcoming/not-a-date",
    defaultDateUpcoming.range.start,
    defaultDateUpcoming.range.start,
    `/upcoming/${defaultDateUpcoming.range.start}`,
  );
  assertUpcomingControls(invalidDayHtml, "/upcoming/not-a-date");
  assertNoLegacySlateLinks(invalidDayHtml, "/upcoming/not-a-date");
  await assertPng(`${baseUrl}/upcoming/not-a-date/opengraph-image`, "/upcoming/not-a-date/opengraph-image");

  const upcomingIndex = await fetch(`${baseUrl}/upcoming`);
  assert(upcomingIndex.ok, "/upcoming returned HTTP " + upcomingIndex.status);
  const upcomingIndexHtml = await upcomingIndex.text();
  assert(upcomingIndexHtml.includes("Upcoming MLB Starters"), "/upcoming should render the primary upcoming surface");
  assertMetadata(
    upcomingIndexHtml,
    "/upcoming",
    `Upcoming MLB Starters: ${formatUpcomingDate(defaultDateUpcoming.range.start)}`,
    expectedUpcomingDayDescription(defaultDateUpcoming.days[0]),
  );
  assertJsonLd(
    upcomingIndexHtml,
    "/upcoming",
    `Upcoming MLB Starters: ${formatUpcomingDate(defaultDateUpcoming.range.start)}`,
    expectedUpcomingDayDescription(defaultDateUpcoming.days[0]),
    defaultDayTotals.games,
    defaultDateUpcoming.days[0].games,
    `/upcoming/${defaultDateUpcoming.range.start}`,
  );
  assertRenderedWatchCards(
    upcomingIndexHtml,
    "/upcoming",
    defaultDateUpcoming.days[0].games,
    `on ${formatUpcomingDate(defaultDateUpcoming.range.start)}`,
    "must-watch",
    defaultDateUpcoming.days[0].scheduledGames,
  );
  assertPrimarySlateCta(
    upcomingIndexHtml,
    "/upcoming",
    "Week view",
    `/upcoming/week/${defaultDateUpcoming.range.start}`,
    `View week of ${formatUpcomingDate(defaultDateUpcoming.range.start)}`,
  );
  assertUpcomingRangeToggle(upcomingIndexHtml, "/upcoming", defaultDateUpcoming.range.start, defaultDateUpcoming.range.start, `/upcoming/${defaultDateUpcoming.range.start}`);
  assertUpcomingControls(upcomingIndexHtml, "/upcoming");
  assertNoLegacySlateLinks(upcomingIndexHtml, "/upcoming");
  await assertPng(`${baseUrl}/upcoming/opengraph-image`, "/upcoming/opengraph-image");

  if (expectedDays > 1) {
    const weekPage = await fetch(`${baseUrl}/upcoming/week/${encodeURIComponent(date)}`);
    assert(weekPage.ok, `/upcoming/week/${date} returned HTTP ${weekPage.status}`);
    const weekHtml = await weekPage.text();
    const weekGames = upcoming.days.flatMap((day) => day.games.map((game) => ({ ...game, date: day.date })));
    assert(weekHtml.includes("Upcoming MLB Starter Watch"), `/upcoming/week/${date} should render route metadata`);
    assertMetadata(
      weekHtml,
      `/upcoming/week/${date}`,
      `Upcoming MLB Starter Watch: Week of ${formatUpcomingDate(date)}`,
      expectedUpcomingWeekDescription(upcoming),
    );
    assertJsonLd(
      weekHtml,
      `/upcoming/week/${date}`,
      `Upcoming MLB Starter Watch: Week of ${formatUpcomingDate(date)}`,
      expectedUpcomingWeekDescription(upcoming),
      gameCount,
      weekGames,
      `/upcoming/week/${date}`,
    );
    assertWeekMustWatchCallout(weekHtml, `/upcoming/week/${date}`, weekGames);
    upcoming.days.forEach((day) => {
      assertRenderedWatchCards(
        weekHtml,
        `/upcoming/week/${date} day ${day.date}`,
        day.games,
        `on ${formatUpcomingDate(day.date)}`,
        `must-watch-${day.date}`,
        day.scheduledGames,
      );
      assertPrimarySlateCta(
        weekHtml,
        `/upcoming/week/${date} day ${day.date}`,
        "Day slate",
        `/upcoming/${day.date}`,
        `View day slate for ${formatUpcomingDate(day.date)}`,
      );
    });
    assertWeekDaySlateLinks(weekHtml, `/upcoming/week/${date}`, upcoming.days);
    assertUpcomingRangeToggle(weekHtml, `/upcoming/week/${date}`, defaultDateUpcoming.range.start, date, `/upcoming/week/${date}`);
    assertUpcomingControls(weekHtml, `/upcoming/week/${date}`);
    assertNoLegacySlateLinks(weekHtml, `/upcoming/week/${date}`);
    await assertPng(`${baseUrl}/upcoming/week/${encodeURIComponent(date)}/opengraph-image`, `/upcoming/week/${date}/opengraph-image`);

    const invalidWeekPage = await fetch(`${baseUrl}/upcoming/week/not-a-date`);
    assert(invalidWeekPage.ok, "/upcoming/week/not-a-date returned HTTP " + invalidWeekPage.status);
    const invalidWeekHtml = await invalidWeekPage.text();
    assertMetadata(
      invalidWeekHtml,
      `/upcoming/week/${defaultDateUpcoming.range.start}`,
      `Upcoming MLB Starter Watch: Week of ${formatUpcomingDate(defaultDateUpcoming.range.start)}`,
      expectedUpcomingWeekDescription(defaultWeekUpcoming),
    );
    assertJsonLd(
      invalidWeekHtml,
      "/upcoming/week/not-a-date",
      `Upcoming MLB Starter Watch: Week of ${formatUpcomingDate(defaultDateUpcoming.range.start)}`,
      expectedUpcomingWeekDescription(defaultWeekUpcoming),
      defaultWeekGameCount,
      defaultWeekGames,
      `/upcoming/week/${defaultDateUpcoming.range.start}`,
    );
    assertWeekMustWatchCallout(invalidWeekHtml, "/upcoming/week/not-a-date", defaultWeekGames);
    defaultWeekUpcoming.days.forEach((day) => {
      assertRenderedWatchCards(
        invalidWeekHtml,
        `/upcoming/week/not-a-date day ${day.date}`,
        day.games,
        `on ${formatUpcomingDate(day.date)}`,
        `must-watch-${day.date}`,
        day.scheduledGames,
      );
      assertPrimarySlateCta(
        invalidWeekHtml,
        `/upcoming/week/not-a-date day ${day.date}`,
        "Day slate",
        `/upcoming/${day.date}`,
        `View day slate for ${formatUpcomingDate(day.date)}`,
      );
    });
    assertWeekDaySlateLinks(invalidWeekHtml, "/upcoming/week/not-a-date", defaultWeekUpcoming.days);
    assertUpcomingRangeToggle(
      invalidWeekHtml,
      "/upcoming/week/not-a-date",
      defaultDateUpcoming.range.start,
      defaultDateUpcoming.range.start,
      `/upcoming/week/${defaultDateUpcoming.range.start}`,
    );
    assertUpcomingControls(invalidWeekHtml, "/upcoming/week/not-a-date");
    assertNoLegacySlateLinks(invalidWeekHtml, "/upcoming/week/not-a-date");
    await assertPng(`${baseUrl}/upcoming/week/not-a-date/opengraph-image`, "/upcoming/week/not-a-date/opengraph-image");

    const upcomingWeekIndex = await fetch(`${baseUrl}/upcoming/week`);
    assert(upcomingWeekIndex.ok, "/upcoming/week returned HTTP " + upcomingWeekIndex.status);
    const upcomingWeekIndexHtml = await upcomingWeekIndex.text();
    assert(upcomingWeekIndexHtml.includes("Upcoming MLB Starter Watch"), "/upcoming/week should render the primary weekly watch surface");
    assertMetadata(
      upcomingWeekIndexHtml,
      "/upcoming/week",
      `Upcoming MLB Starter Watch: Week of ${formatUpcomingDate(defaultDateUpcoming.range.start)}`,
      expectedUpcomingWeekDescription(defaultWeekUpcoming),
    );
    assertJsonLd(
      upcomingWeekIndexHtml,
      "/upcoming/week",
      `Upcoming MLB Starter Watch: Week of ${formatUpcomingDate(defaultDateUpcoming.range.start)}`,
      expectedUpcomingWeekDescription(defaultWeekUpcoming),
      defaultWeekGameCount,
      defaultWeekGames,
      `/upcoming/week/${defaultDateUpcoming.range.start}`,
    );
    assertWeekMustWatchCallout(upcomingWeekIndexHtml, "/upcoming/week", defaultWeekGames);
    defaultWeekUpcoming.days.forEach((day) => {
      assertRenderedWatchCards(
        upcomingWeekIndexHtml,
        `/upcoming/week day ${day.date}`,
        day.games,
        `on ${formatUpcomingDate(day.date)}`,
        `must-watch-${day.date}`,
        day.scheduledGames,
      );
      assertPrimarySlateCta(
        upcomingWeekIndexHtml,
        `/upcoming/week day ${day.date}`,
        "Day slate",
        `/upcoming/${day.date}`,
        `View day slate for ${formatUpcomingDate(day.date)}`,
      );
    });
    assertWeekDaySlateLinks(upcomingWeekIndexHtml, "/upcoming/week", defaultWeekUpcoming.days);
    assertUpcomingRangeToggle(
      upcomingWeekIndexHtml,
      "/upcoming/week",
      defaultDateUpcoming.range.start,
      defaultDateUpcoming.range.start,
      `/upcoming/week/${defaultDateUpcoming.range.start}`,
    );
    assertUpcomingControls(upcomingWeekIndexHtml, "/upcoming/week");
    assertNoLegacySlateLinks(upcomingWeekIndexHtml, "/upcoming/week");
    await assertPng(`${baseUrl}/upcoming/week/opengraph-image`, "/upcoming/week/opengraph-image");
  }

  console.log(`upcoming contract ok: ${upcoming.range.start}..${upcoming.range.end}, days ${upcoming.days.length}, games ${gameCount}, form starters ${okStarterCount}`);
} catch (error) {
  if (output.trim()) {
    console.error(output.trim());
  }
  throw error;
} finally {
  stopProcessTree(server);
}
