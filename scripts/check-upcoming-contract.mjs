import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import net from "node:net";

const host = "localhost";
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.toetheslab.com").replace(/\/+$/, "");
const date = process.env.THE_BUMP_UPCOMING_CONTRACT_DATE ?? "2026-06-14";
const days = process.env.THE_BUMP_UPCOMING_CONTRACT_DAYS ?? "1";
const windowSize = process.env.THE_BUMP_UPCOMING_CONTRACT_WINDOW ?? "5";
const siteTimeZone = process.env.THE_BUMP_TIME_ZONE ?? "America/Los_Angeles";
const FORM_TIER_KEYS = ["onfire", "hot", "even", "cooling", "ice"];
const FORM_ACCENT_COLORS = {
  onfire: "#FF5A1F",
  hot: "#FF7A3D",
  even: "#888780",
  cooling: "#8FCBFF",
  ice: "#5BA8FF",
  neutral: "#888780",
};
const FORM_DRIVER_KEYS = ["k-rate", "walks", "depth", "run-prevention"];
const ACTIVE_CARD_STATUSES = ["pregame"];
const WATCH_SCORE_WEIGHTS = {
  topArm: 0.5,
  pairAvg: 0.3,
  matchup: 0.2,
};
const WATCH_SORT_POLICY = "status-then-watch-score";
const WATCH_SCORE_RANGE = { min: 0, max: 100 };
const WATCH_SCORE_PRECISION = 1;
const WATCH_COMPONENT_KEYS = ["top-arm", "pairing", "matchup"];
const WATCH_COMPONENT_LABELS = ["Top arm", "Pairing", "Matchup"];
const WATCH_COMPONENT_LAYOUTS = ["featured", "compact", "standard"];
const WATCH_TIER_LABELS = ["Must-watch", "Worth it", "Background"];
const FORM_COMPLETENESS = {
  coldStartMax: 2,
  joinGapMatchFloor: 1,
  formMinStarts: 3,
};
const UPCOMING_CONTROL_LINK_KEYS = ["status-all", "status-pregame", "sort-watch", "sort-time"];
const upcomingIndexPageSource = readFileSync("src/app/upcoming/page.tsx", "utf8");
const upcomingDatePageSource = readFileSync("src/app/upcoming/[date]/page.tsx", "utf8");
const upcomingIndexImageSource = readFileSync("src/app/upcoming/opengraph-image.tsx", "utf8");
const upcomingDateImageSource = readFileSync("src/app/upcoming/[date]/opengraph-image.tsx", "utf8");
const upcomingWeekIndexPageSource = readFileSync("src/app/upcoming/week/page.tsx", "utf8");
const upcomingWeekPageSource = readFileSync("src/app/upcoming/week/[startDate]/page.tsx", "utf8");
const upcomingWeekIndexImageSource = readFileSync("src/app/upcoming/week/opengraph-image.tsx", "utf8");
const upcomingWeekImageSource = readFileSync("src/app/upcoming/week/[startDate]/opengraph-image.tsx", "utf8");
const tonightApiSource = readFileSync("src/app/api/tonight/route.ts", "utf8");
const upcomingApiSource = readFileSync("src/app/api/upcoming/route.ts", "utf8");
const tonightsMustWatchSource = readFileSync("src/components/tonights-must-watch.tsx", "utf8");
const tonightServiceSource = readFileSync("src/lib/data/tonight-service.ts", "utf8");
const formServiceSource = readFileSync("src/lib/data/form-service.ts", "utf8");
const upcomingMetadataSource = readFileSync("src/lib/upcoming-metadata.ts", "utf8");
const typesSource = readFileSync("src/lib/types.ts", "utf8");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const nativeFetch = globalThis.fetch;

function isTransientFetchError(error) {
  const aggregateErrors = Array.isArray(error?.cause?.errors) ? error.cause.errors : [];
  return (
    error?.cause?.code === "ECONNRESET" ||
    error?.cause?.code === "ECONNREFUSED" ||
    error?.code === "ECONNRESET" ||
    error?.code === "ECONNREFUSED" ||
    aggregateErrors.some((cause) => cause?.code === "ECONNRESET" || cause?.code === "ECONNREFUSED") ||
    error?.message === "terminated"
  );
}

async function isTransientNextRuntimeResponse(response) {
  if (response.status < 500) return false;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return false;

  try {
    const body = await response.clone().text();
    return body.includes("Page changed from static to dynamic at runtime");
  } catch {
    return false;
  }
}

globalThis.fetch = async (...args) => {
  let lastError;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await nativeFetch(...args);
      if (!(await isTransientNextRuntimeResponse(response)) || attempt === 2) return response;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    } catch (error) {
      lastError = error;
      if (!isTransientFetchError(error) || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }

  throw lastError;
};

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

function assertNullableDateKey(value, label) {
  if (value === null) return;
  assertDateKey(value, label);
}

function assertRenderedDateOrNone(value, label) {
  assert(value === "none" || /^\d{4}-\d{2}-\d{2}$/.test(value ?? ""), `${label} must be YYYY-MM-DD or none`);
}

function csvAttributeValues(value) {
  if (!value || value === "none") return [];
  return value.split(",").filter(Boolean);
}

function pipeAttributeValues(value) {
  if (!value || value === "none") return [];
  return value.split("|").filter(Boolean);
}

function doublePipeAttributeValues(value) {
  if (!value || value === "none") return [];
  return value.split("||").filter(Boolean);
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
  assert(starter.formStatus === undefined || ["ok", "cold_start", "mlb_debut", "join_gap", "tbd"].includes(starter.formStatus), `${label} formStatus must be valid when present`);
  assert(["cold_start", "mlb_debut", "join_gap", null].includes(starter.limitedReason), `${label} limitedReason must be valid`);
  const formStatus = effectiveStarterFormStatus(starter);

  if (starter.status === "tbd") {
    assert(starter.pitcherId === null && starter.name === null, `${label} tbd starter should not fabricate identity`);
    assert(starter.lastStart === undefined, `${label} tbd starter should not expose lastStart`);
    assert(formStatus === "tbd", `${label} tbd starter should use tbd formStatus`);
    assert(starter.limitedReason === null, `${label} tbd starter should not use a limitedReason`);
    return false;
  }

  assert(typeof starter.pitcherId === "string" && starter.pitcherId.length > 0, `${label} pitcherId missing`);
  assert(typeof starter.name === "string" && starter.name.length > 0, `${label} name missing`);
  assert(typeof starter.team === "string" && starter.team.length > 0, `${label} team missing`);

  if (starter.formCompleteness !== undefined) {
    assert(Number.isInteger(starter.formCompleteness.matched), `${label} should expose matched form count`);
    assert(Number.isInteger(starter.formCompleteness.expected), `${label} should expose expected season GS`);
    assert(starter.formCompleteness.careerGS === null || Number.isInteger(starter.formCompleteness.careerGS), `${label} should expose career GS or null`);
    if (starter.formCompleteness.expected > FORM_COMPLETENESS.coldStartMax && starter.formCompleteness.matched > FORM_COMPLETENESS.joinGapMatchFloor) {
      assert(formStatus !== "join_gap", `${label} established starter with a real form sample should not be join_gap`);
    }
    if (starter.formCompleteness.matched >= FORM_COMPLETENESS.formMinStarts) {
      assert(formStatus !== "join_gap", `${label} starter with qualified form count should not be join_gap`);
    }
  }

  if (formStatus === "mlb_debut") {
    assert(starter.limitedReason === "mlb_debut", `${label} debut starter should declare mlb_debut`);
    assert(starter.flags?.mlbDebut === true, `${label} debut starter should carry mlbDebut flag`);
    assertStarterProjection(starter.projection, `${label} mlb_debut projection`);
    assertMarketContext(starter.marketContext, `${label} mlb_debut marketContext`);
    return false;
  }

  if (starter.status === "insufficient" || formStatus !== "ok") {
    assert(starter.limitedReason === "cold_start" || starter.limitedReason === "join_gap", `${label} limited starter must declare cold_start or join_gap`);
    if (formStatus === "join_gap") {
      assert(starter.flags?.joinGap === true, `${label} join_gap starter should carry internal joinGap flag`);
      assert(starter.lastStart === undefined || starter.lastStart === null, `${label} join_gap starter should not fabricate lastStart form`);
      assertStarterProjection(starter.projection, `${label} join_gap projection`);
      assertMarketContext(starter.marketContext, `${label} join_gap marketContext`);
      return false;
    }
    if (starter.rgs !== undefined) {
      assertNumber(starter.rgs, `${label} limited rgs`);
      assert(FORM_TIER_KEYS.includes(starter.tier), `${label} limited tier must be valid`);
      assert(["heating", "steady", "cooling"].includes(starter.trend), `${label} limited trend must be valid`);
      assertNumber(starter.deltaForm, `${label} limited deltaForm`);
      assert(Array.isArray(starter.spark), `${label} limited spark must be an array`);
      starter.spark.forEach((value, index) => assertNumber(value, `${label} limited spark[${index}]`));
      assertLastStart(starter.lastStart, `${label} limited lastStart`);
    }
    assert(formStatus === "cold_start", `${label} limited starter with sparse form should be cold_start`);
    return false;
  }

  assert(formStatus === "ok", `${label} complete starter should use ok formStatus`);
  assert(starter.limitedReason === null, `${label} complete starter should not carry a limitedReason`);
  assertNumber(starter.rgs, `${label} rgs`);
  assert(FORM_TIER_KEYS.includes(starter.tier), `${label} tier must be valid`);
  assert(["heating", "steady", "cooling"].includes(starter.trend), `${label} trend must be valid`);
  assertNumber(starter.deltaForm, `${label} deltaForm`);
  assert(Array.isArray(starter.spark) && starter.spark.length > 0, `${label} spark must include recent form`);
  starter.spark.forEach((value, index) => assertNumber(value, `${label} spark[${index}]`));
  assertLastStart(starter.lastStart, `${label} lastStart`);
  assertSeasonStats(starter.seasonStats, `${label} seasonStats`);
  assertDriverChips(starter.driverChips, `${label} driverChips`);
  assertOpponentSplit(starter.opponentSplit, `${label} opponentSplit`);
  assertStarterProjection(starter.projection, `${label} projection`);
  assertMarketContext(starter.marketContext, `${label} marketContext`);
  return true;
}

function assertSeasonStats(stats, label) {
  assert(stats && typeof stats === "object", `${label} must be present`);
  assertNumber(stats.inningsPitched, `${label}.inningsPitched`);
  assert(stats.inningsPitched >= 0, `${label}.inningsPitched must be non-negative`);
  if (stats.era !== null) {
    assertNumber(stats.era, `${label}.era`);
    assert(stats.era >= 0, `${label}.era must be non-negative`);
  }
  if (stats.whip !== null) {
    assertNumber(stats.whip, `${label}.whip`);
    assert(stats.whip >= 0, `${label}.whip must be non-negative`);
  }
  if (stats.k9 !== null) {
    assertNumber(stats.k9, `${label}.k9`);
    assert(stats.k9 >= 0, `${label}.k9 must be non-negative`);
  }
}

function assertDriverChips(chips, label) {
  assert(Array.isArray(chips), `${label} must be an array`);
  assert(chips.length <= 3, `${label} should stay capped to the public driver set`);
  const seen = new Set();
  chips.forEach((chip, index) => {
    assert(chip && typeof chip === "object", `${label}[${index}] must be an object`);
    assert(FORM_DRIVER_KEYS.includes(chip.key), `${label}[${index}].key must be valid`);
    assert(["good", "bad"].includes(chip.direction), `${label}[${index}].direction must be good or bad`);
    assertNonEmptyString(chip.label, `${label}[${index}].label`);
    assertNumber(chip.delta, `${label}[${index}].delta`);
    assertNumber(chip.score, `${label}[${index}].score`);
    const id = `${chip.key}:${chip.direction}`;
    assert(!seen.has(id), `${label} should not duplicate ${id}`);
    seen.add(id);
  });
}

function assertOpponentSplit(split, label) {
  if (split === null || split === undefined) return;
  assert(split && typeof split === "object", `${label} must be an object when present`);
  assertNonEmptyString(split.team, `${label}.team`);
  assert(["vs-lhp", "vs-rhp"].includes(split.split), `${label}.split must be supported`);
  assertNumber(split.ops, `${label}.ops`);
  assertNumber(split.obp, `${label}.obp`);
  assertNumber(split.slg, `${label}.slg`);
  assertNumber(split.iso, `${label}.iso`);
  assertNumber(split.strikeoutRate, `${label}.strikeoutRate`);
  assertNumber(split.walkRate, `${label}.walkRate`);
  assert(Number.isInteger(split.opsRank) && split.opsRank >= 1, `${label}.opsRank must be positive`);
  assert(Number.isInteger(split.strikeoutRateRank) && split.strikeoutRateRank >= 1, `${label}.strikeoutRateRank must be positive`);
  assertNumber(split.matchupRunValue, `${label}.matchupRunValue`);
  assertNonEmptyString(split.label, `${label}.label`);
}

function assertStarterProjection(projection, label) {
  assert(projection && typeof projection === "object", `${label} must be present`);
  assert(["line-backed", "pending"].includes(projection.status), `${label}.status must be supported`);
  assert(["low", "medium", "high"].includes(projection.confidence), `${label}.confidence must be supported`);
  assert(Array.isArray(projection.notes), `${label}.notes must be an array`);
  projection.notes.forEach((note, index) => assertNonEmptyString(note, `${label}.notes[${index}]`));
  if (projection.status === "line-backed") {
    assertNumber(projection.projectedGsPlus, `${label}.projectedGsPlus`);
    assert(projection.projectedGsPlus >= 20 && projection.projectedGsPlus <= 80, `${label}.projectedGsPlus should stay inside GS+ display range`);
  }
  assert(projection.line && typeof projection.line === "object", `${label}.line must be present`);
  for (const key of ["inningsPitched", "strikeouts", "earnedRuns"]) {
    if (projection.line[key] !== null) {
      assertNumber(projection.line[key], `${label}.line.${key}`);
      assert(projection.line[key] >= 0, `${label}.line.${key} must be non-negative`);
    }
  }
}

function assertMarketContext(market, label) {
  assert(market && typeof market === "object", `${label} must be present`);
  assert(["pending-feed", "ready"].includes(market.status), `${label}.status must be supported`);
  assert(["the-odds-api", "not-configured", "odds-deferred"].includes(market.source), `${label}.source must be supported`);
  if (market.projectedStrikeouts !== null) assertNumber(market.projectedStrikeouts, `${label}.projectedStrikeouts`);
  if (market.strikeoutPropLine !== null) assertNumber(market.strikeoutPropLine, `${label}.strikeoutPropLine`);
  if (market.strikeoutEdge !== null) assertNumber(market.strikeoutEdge, `${label}.strikeoutEdge`);
  if (market.opposingTeamTotal !== null) assertNumber(market.opposingTeamTotal, `${label}.opposingTeamTotal`);
  assertNonEmptyString(market.label, `${label}.label`);
}

function assertMatchupScoreRange(range, label) {
  assert(range && typeof range === "object", `${label} matchupScoreRange must be present`);
  assertNumber(range.min, `${label} matchupScoreRange.min`);
  assertNumber(range.max, `${label} matchupScoreRange.max`);
  assert(range.min === 0, `${label} matchupScoreRange.min should match the public watch scale`);
  assert(range.max === 100, `${label} matchupScoreRange.max should match the public watch scale`);
  assert(range.min < range.max, `${label} matchupScoreRange should be ascending`);
}

function assertWatchScoreWeights(weights, label) {
  assert(weights && typeof weights === "object", `${label} watchScoreWeights must be present`);
  assertNumber(weights.topArm, `${label} watchScoreWeights.topArm`);
  assertNumber(weights.pairAvg, `${label} watchScoreWeights.pairAvg`);
  assertNumber(weights.matchup, `${label} watchScoreWeights.matchup`);
  assert(weights.topArm === WATCH_SCORE_WEIGHTS.topArm, `${label} watchScoreWeights.topArm should be ${WATCH_SCORE_WEIGHTS.topArm}`);
  assert(weights.pairAvg === WATCH_SCORE_WEIGHTS.pairAvg, `${label} watchScoreWeights.pairAvg should be ${WATCH_SCORE_WEIGHTS.pairAvg}`);
  assert(weights.matchup === WATCH_SCORE_WEIGHTS.matchup, `${label} watchScoreWeights.matchup should be ${WATCH_SCORE_WEIGHTS.matchup}`);
  assert(round1(weights.topArm + weights.pairAvg + weights.matchup) === 1, `${label} watchScoreWeights should sum to 1`);
}

function assertWatchScoreRange(range, label) {
  assert(range && typeof range === "object", `${label} watchScoreRange must be present`);
  assertNumber(range.min, `${label} watchScoreRange.min`);
  assertNumber(range.max, `${label} watchScoreRange.max`);
  assert(range.min === WATCH_SCORE_RANGE.min, `${label} watchScoreRange.min should be ${WATCH_SCORE_RANGE.min}`);
  assert(range.max === WATCH_SCORE_RANGE.max, `${label} watchScoreRange.max should be ${WATCH_SCORE_RANGE.max}`);
}

function effectiveStarterFormStatus(starter) {
  if (starter.formStatus) return starter.formStatus;
  if (starter.status === "tbd") return "tbd";
  if (starter.limitedReason) return starter.limitedReason;
  return starter.status === "ok" ? "ok" : "cold_start";
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
  if (lastStart.result !== undefined) {
    assert(["W", "L", "ND"].includes(lastStart.result), `${label} result must be W, L, or ND`);
  }
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
  assertActiveCardStatuses(day.activeCardStatuses, expectedDate);
  assert([3, 5, 10].includes(day.formWindow), `${expectedDate} formWindow must be a supported form window`);
  assertNullableDateKey(day.formThroughDate, `${expectedDate} formThroughDate`);
  assertNullableDateKey(day.latestScoredStartDate, `${expectedDate} latestScoredStartDate`);
  assert(typeof day.formDataStale === "boolean", `${expectedDate} formDataStale must be boolean`);
  assertNumber(day.leagueMeanGS, `${expectedDate} leagueMeanGS`);
  assertWatchScoreWeights(day.watchScoreWeights, expectedDate);
  assert(day.watchSortPolicy === WATCH_SORT_POLICY, `${expectedDate} watchSortPolicy should be ${WATCH_SORT_POLICY}`);
  assertWatchScoreRange(day.watchScoreRange, expectedDate);
  assert(day.watchScorePrecision === WATCH_SCORE_PRECISION, `${expectedDate} watchScorePrecision should be ${WATCH_SCORE_PRECISION}`);
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
    assert(day.activeCardStatuses.includes(game.status), `${game.gamePk} should only return active upcoming games, not final or postponed games`);
    assertNonEmptyString(game.detailedState, `${game.gamePk} detailedState`);
    assertIsoTimestamp(game.firstPitch, `${game.gamePk} firstPitch`);
    assertNonEmptyString(game.away, `${game.gamePk} away team`);
    assertNonEmptyString(game.awayName, `${game.gamePk} away team name`);
    assertNonEmptyString(game.home, `${game.gamePk} home team`);
    assertNonEmptyString(game.homeName, `${game.gamePk} home team name`);
    assert(game.awayName !== game.away, `${game.gamePk} away team name should not duplicate abbreviation`);
    assert(game.homeName !== game.home, `${game.gamePk} home team name should not duplicate abbreviation`);
    assert(game.label === `${game.away} @ ${game.home}`, `${game.gamePk} label should match away/home teams`);
    if (game.park !== null && game.park !== undefined) {
      assertNonEmptyString(game.park, `${game.gamePk} park`);
    }
    assertGameEnvironmentContext(game, `${game.gamePk}`);
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
      game.gameWatchScore === expectedGameWatchScore(game, day.watchScoreWeights),
      `${game.gamePk} gameWatchScore should match advertised watchScoreWeights`,
    );
    assert(
      game.watchTier === expectedWatchTier(game.gameWatchScore),
      `${game.gamePk} watchTier should match watch score ${game.gameWatchScore}`,
    );
    assert(["HIGH", "LOW", "NONE"].includes(game.matchupConfidence), `${game.gamePk} matchupConfidence must be valid`);
    assert(
      game.matchupConfidence === expectedMatchupConfidence(game),
      `${game.gamePk} matchupConfidence should derive from limited starter reasons`,
    );
    if (game.matchupConfidence === "NONE" && !game.flags?.mlbDebut) {
      assert(game.watchTier === "background", `${game.gamePk} join_gap form should floor the matchup to Background`);
    }
    if (game.matchupConfidence === "LOW" && !game.flags?.mlbDebut) {
      assert(game.watchTier !== "mustwatch", `${game.gamePk} cold_start form should cap the matchup below Must-watch`);
    }
    assert(
      game.watchSortGroup === expectedStatusSortGroup(game.status),
      `${game.gamePk} watchSortGroup should match ${day.watchSortPolicy}`,
    );
    assertNumber(game.matchupScore, `${game.gamePk} matchupScore`);
    assert(
      game.matchupScore >= day.matchupScoreRange.min && game.matchupScore <= day.matchupScoreRange.max,
      `${game.gamePk} matchupScore should fit inside the advertised matchupScoreRange`,
    );
    assert(game.matchupContext && ["pending-opponent-splits", "scored"].includes(game.matchupContext.status), `${game.gamePk} matchupContext status must be valid`);
    assertNonEmptyString(game.matchupContext.label, `${game.gamePk} matchupContext label`);
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
    assert(
      awayStarter?.team === game.away,
      `${game.gamePk} away starter team ${awayStarter?.team ?? "missing"} should match away team ${game.away}`,
    );
    assert(
      homeStarter?.team === game.home,
      `${game.gamePk} home starter team ${homeStarter?.team ?? "missing"} should match home team ${game.home}`,
    );
    assert(typeof game.flags?.tbd === "boolean", `${game.gamePk} flags.tbd must be boolean`);
    assert(typeof game.flags?.limitedForm === "boolean", `${game.gamePk} flags.limitedForm must be boolean`);
    assert(typeof game.flags?.coldStartForm === "boolean", `${game.gamePk} flags.coldStartForm must be boolean`);
    assert(typeof game.flags?.joinGapForm === "boolean" || game.flags?.joinGapForm === undefined, `${game.gamePk} flags.joinGapForm must be boolean when present`);
    assert(typeof game.flags?.mlbDebut === "boolean" || game.flags?.mlbDebut === undefined, `${game.gamePk} flags.mlbDebut must be boolean when present`);
    assert(typeof game.flags?.likelyOpener === "boolean" || game.flags?.likelyOpener === undefined, `${game.gamePk} flags.likelyOpener must be boolean when present`);
    assert(
      game.flags.tbd === game.starters.some((starter) => starter.status === "tbd"),
      `${game.gamePk} flags.tbd should match starter TBD state`,
    );
    assert(
      game.flags.limitedForm === game.starters.some((starter) => effectiveStarterFormStatus(starter) !== "ok" || starter.flags?.limitedSample === true),
      `${game.gamePk} flags.limitedForm should match limited starter or small-sample state`,
    );
    assert(
      game.flags.coldStartForm === game.starters.some((starter) => effectiveStarterFormStatus(starter) === "cold_start"),
      `${game.gamePk} flags.coldStartForm should match cold_start starter state`,
    );
    assert(
      Boolean(game.flags.joinGapForm) === game.starters.some((starter) => effectiveStarterFormStatus(starter) === "join_gap"),
      `${game.gamePk} flags.joinGapForm should match join_gap starter state`,
    );
    assert(
      Boolean(game.flags.mlbDebut) === game.starters.some((starter) => effectiveStarterFormStatus(starter) === "mlb_debut"),
      `${game.gamePk} flags.mlbDebut should match mlb_debut starter state`,
    );
    assert(
      Boolean(game.flags.likelyOpener) === game.starters.some((starter) => starter.likelyOpener === true),
      `${game.gamePk} flags.likelyOpener should match likely opener starter state`,
    );

    const sortGroup = game.watchSortGroup;
    assert(sortGroup >= previousSortGroup, `${expectedDate} games must keep pregame games ahead of started games`);
    if (sortGroup !== previousSortGroup) previousWatchScore = Infinity;
    assert(game.gameWatchScore <= previousWatchScore, `${expectedDate} games must be sorted by watch score within status groups`);
    previousSortGroup = sortGroup;
    previousWatchScore = game.gameWatchScore;

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
        return b.matchupScore - a.matchupScore || Number(a.gamePk) - Number(b.gamePk);
      })
      .map((game, index) => [game.gamePk, index + 1]),
  );
}

function gameOrder(day) {
  return day.games.map((game) => game.gamePk).join(",");
}

function assertGameEnvironmentContext(game, label) {
  assert(game.parkContext && typeof game.parkContext === "object", `${label} parkContext must be present`);
  assertNonEmptyString(game.parkContext.venue, `${label} parkContext.venue`);
  assertNumber(game.parkContext.runFactor, `${label} parkContext.runFactor`);
  assertNumber(game.parkContext.runValue, `${label} parkContext.runValue`);
  assertNonEmptyString(game.parkContext.label, `${label} parkContext.label`);
  assert(game.parkContext.venue === game.park, `${label} parkContext venue should match game park`);

  assert(game.weatherContext && typeof game.weatherContext === "object", `${label} weatherContext must be present`);
  assert(["open-meteo", "indoor", "unavailable"].includes(game.weatherContext.source), `${label} weatherContext.source unsupported`);
  assertNumber(game.weatherContext.runValue, `${label} weatherContext.runValue`);
  assertNonEmptyString(game.weatherContext.label, `${label} weatherContext.label`);
  if (game.weatherContext.source === "open-meteo") {
    if (game.weatherContext.tempF !== undefined) assertNumber(game.weatherContext.tempF, `${label} weatherContext.tempF`);
    if (game.weatherContext.windMph !== undefined) assertNumber(game.weatherContext.windMph, `${label} weatherContext.windMph`);
    if (game.weatherContext.precipProbability !== undefined) assertNumber(game.weatherContext.precipProbability, `${label} weatherContext.precipProbability`);
  }
}

function assertActiveCardStatuses(statuses, label) {
  assert(Array.isArray(statuses), `${label} activeCardStatuses must be an array`);
  assert(
    statuses.length === ACTIVE_CARD_STATUSES.length && statuses.every((status, index) => status === ACTIVE_CARD_STATUSES[index]),
    `${label} activeCardStatuses should be ${ACTIVE_CARD_STATUSES.join(",")}`,
  );
}

function sortGamesByFirstPitch(games) {
  return [...games].sort((a, b) => a.firstPitch.localeCompare(b.firstPitch) || b.gameWatchScore - a.gameWatchScore);
}

function pregameGames(games) {
  return games.filter((game) => game.status === "pregame");
}

function pregameGamesByFirstPitch(games) {
  return sortGamesByFirstPitch(pregameGames(games));
}

function firstLegacyTeamParam(games) {
  return games[0]?.away ?? null;
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
    formWindow: day.formWindow,
    formThroughDate: day.formThroughDate,
    latestScoredStartDate: day.latestScoredStartDate,
    formDataStale: day.formDataStale,
    leagueMeanGS: day.leagueMeanGS,
    watchScoreWeights: day.watchScoreWeights,
    watchSortPolicy: day.watchSortPolicy,
    watchScoreRange: day.watchScoreRange,
    watchScorePrecision: day.watchScorePrecision,
    matchupScoreRange: day.matchupScoreRange,
    scheduledGames: day.scheduledGames,
    games: day.games.map((game) => ({
      gamePk: game.gamePk,
      date: game.date,
      status: game.status,
      firstPitch: game.firstPitch,
      park: game.park,
      away: game.away,
      awayName: game.awayName,
      home: game.home,
      homeName: game.homeName,
      label: game.label,
      parkContext: game.parkContext,
      weatherContext: game.weatherContext,
      matchupScore: game.matchupScore,
      matchupRankTonight: game.matchupRankTonight,
      matchupContext: game.matchupContext,
      gameWatchScore: game.gameWatchScore,
      watchTier: game.watchTier,
      matchupConfidence: game.matchupConfidence,
      watchSortGroup: game.watchSortGroup,
      watchComponents: game.watchComponents,
      flags: game.flags,
      starters: game.starters,
    })),
  });
}

function expectedGameWatchScore(game, weights) {
  const rawScore = round1(
    weights.topArm * game.watchComponents.topArm +
      weights.pairAvg * game.watchComponents.pairing +
      weights.matchup * game.watchComponents.matchup,
  );
  return expectedTbdCappedWatchScore(
    expectedTrustGatedWatchScore(rawScore, game.matchupConfidence, game.flags?.mlbDebut === true),
    game.flags?.tbd === true,
    game.flags?.mlbDebut === true,
  );
}

function expectedTrustGatedWatchScore(score, confidence, hasMlbDebut) {
  if (hasMlbDebut) return Math.max(score, 58);
  if (confidence === "NONE") return Math.min(score, 47.9);
  if (confidence === "LOW") return Math.min(score, 57.9);
  return score;
}

function expectedTbdCappedWatchScore(score, hasTbdStarter, hasMlbDebut) {
  if (!hasTbdStarter || hasMlbDebut) return score;
  return Math.min(score, 47.9);
}

function expectedWatchScoreLabel(game) {
  return `Watch score ${expectedWatchScoreValue(game)}`;
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

function expectedStatusSortGroupLabel(status) {
  if (status === "pregame") return "Pregame sort bucket";
  if (status === "live") return "Live sort bucket";
  return "Fallback sort bucket";
}

function expectedWatchSortGroupValue(game) {
  return String(game.watchSortGroup);
}

function expectedWatchSortGroupValueForStatus(status) {
  return String(expectedStatusSortGroup(status));
}

function expectedWatchSortGroupLabelValue(game) {
  return expectedStatusSortGroupLabel(game.status);
}

function expectedWatchSortGroupLabelValueForStatus(status) {
  return expectedStatusSortGroupLabel(status);
}

function expectedWatchFlagNoteKeysValue(game) {
  return watchFlagNoteKeys(game).join("+") || "clear";
}

function expectedWatchFlagNoteLabelValue(game) {
  return watchFlagNoteDataLabel(game);
}

function expectedWatchTierLabelForGame(game) {
  return expectedWatchTierLabel(game.gameWatchScore);
}

function expectedMatchupConfidence(game) {
  if (game.starters.some((starter) => effectiveStarterFormStatus(starter) === "join_gap")) return "NONE";
  if (game.starters.some((starter) => effectiveStarterFormStatus(starter) === "cold_start" || starter.flags?.limitedSample === true)) return "LOW";
  return "HIGH";
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

function expectedWatchCardSummaryAriaLabel(game) {
  return `${expectedGameStatusLabel(game.status)} ${game.label}, ${formatFirstPitch(game.firstPitch)}, ${game.park ?? "Venue TBD"}`;
}

function expectedWatchCardSummaryIdValue(game) {
  return `watch-card-${game.gamePk}-summary`;
}

function expectedWatchCardSummaryAriaLabelValue(game) {
  return expectedWatchCardSummaryAriaLabel(game);
}

function expectedWatchCardAriaLabel(game) {
  return `Watch card for ${game.label} on ${formatSlateDate(game.date)}`;
}

function supportedGameStatusLabels() {
  return ["Pregame", "Live", "Postponed"];
}

function formatSignedValue(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

function marketValue(value) {
  return value === null ? "pending" : value.toFixed(1);
}

function projectionValue(value) {
  return value === null || value === undefined ? "pending" : value.toFixed(1);
}

function splitValue(value, precision) {
  return value === null || value === undefined ? "none" : value.toFixed(precision);
}

function projectionLineTokenCount(projection) {
  return ["inningsPitched", "strikeouts", "earnedRuns"].filter((key) => projection.line[key] !== null).length;
}

function workloadValue(value) {
  return value === null || value === undefined ? "pending" : value.toFixed(1);
}

function starterFormValue(value) {
  return value === null || value === undefined ? "pending" : value.toFixed(1);
}

function expectedStarterAccent(starter) {
  const band = starter.status === "ok" && starter.flags?.limitedSample !== true && starter.tier ? starter.tier : "neutral";
  return {
    band,
    color: FORM_ACCENT_COLORS[band],
    source: band === "neutral" ? "neutral" : "form-band",
  };
}

function starterSeasonValue(value, precision) {
  return value === null || value === undefined ? "pending" : value.toFixed(precision);
}

function starterLastStartValue(starter, key) {
  const lastStart = starter.lastStart;
  if (!lastStart) return "none";
  if (key === "gsPlus") return lastStart.gsPlus.toFixed(1);
  if (key === "line") return starterLastStartLineValue(starter);
  return lastStart[key] ?? "none";
}

function starterLastStartLineValue(starter) {
  const lastStart = starter.lastStart;
  if (!lastStart) return "none";
  return `${lastStart.ip.toFixed(1)}:${lastStart.h}:${lastStart.er}:${lastStart.bb}:${lastStart.k}`;
}

function starterSparkLatestValue(starter) {
  return starter.spark?.length ? starter.spark[starter.spark.length - 1].toFixed(1) : "none";
}

function expectedGameSparkLatestPair(game) {
  return game.starters.map(starterSparkLatestValue).join("/");
}

function starterSparkCountValue(starter) {
  return String(starter.spark?.length ?? 0);
}

function expectedGameSparkCountPair(game) {
  return game.starters.map(starterSparkCountValue).join("/");
}

function expectedStarterSparkReady(starter) {
  return String(starter.status === "ok" && Boolean(starter.spark?.length && starter.tier));
}

function expectedGameSparkReadyPair(game) {
  return game.starters.map(expectedStarterSparkReady).join("/");
}

function expectedGameSparkReadyCount(game) {
  return String(game.starters.filter((starter) => expectedStarterSparkReady(starter) === "true").length);
}

function expectedWatchScoreValue(game) {
  return game.gameWatchScore.toFixed(WATCH_SCORE_PRECISION);
}

function expectedLeagueMeanGsValue(value) {
  return value.toFixed(WATCH_SCORE_PRECISION);
}

function expectedWatchRankValue(game, index) {
  return game.status === "ppd" && index === 0 ? "-" : String(index + 1);
}

function expectedWatchRankLabelValue(rankLabel) {
  return rankLabel;
}

function expectedWatchCardKind(index) {
  return index === 0 ? "headliner" : "row";
}

function expectedWatchComponentCountValue() {
  return String(WATCH_COMPONENT_KEYS.length);
}

function expectedWatchComponentKeysValue() {
  return WATCH_COMPONENT_KEYS.join("/");
}

function expectedWatchComponentLabelsValue() {
  return WATCH_COMPONENT_LABELS.join("/");
}

function expectedWatchComponentValuesValue(game) {
  return [game.watchComponents.topArm, game.watchComponents.pairing, game.matchupScore].map((value) => value.toFixed(WATCH_SCORE_PRECISION)).join("/");
}

function expectedWatchComponentDetailsValue(game, rankLabel) {
  return expectedWatchComponentDetails(game, rankLabel).join("/");
}

function expectedWatchComponentItemAriaLabelsValue(game, rankLabel) {
  return expectedWatchComponentItemAriaLabels(game, rankLabel).join("/");
}

function expectedWatchComponentsAriaLabelValue(game) {
  return watchComponentsAriaLabel(game);
}

function expectedWatchComponentLayout(index) {
  return index === 0 ? "featured" : "compact";
}

function expectedWatchHookReasonValue(game, rankLabel) {
  return expectedWatchHookReason(game, rankLabel);
}

function expectedWatchHookReasonKeyValue(game, rankLabel) {
  return expectedWatchHookReasonKey(game, rankLabel);
}

function sparkReadyCountFromRenderedPair(value) {
  return String(value.split("/").filter((ready) => ready === "true").length);
}

function starterTopDriverValue(starter, key) {
  const topDriver = starter.driverChips?.[0];
  if (!topDriver) return "none";
  if (key === "delta") return topDriver.delta.toFixed(1);
  if (key === "score") return topDriver.score.toFixed(1);
  return topDriver[key] ?? "none";
}

function starterStatusChipCount(starter) {
  let count = 0;
  if (starter.flags?.limitedSample) count += 1;
  if (starter.flags?.rust) count += 1;
  if (starter.workload?.daysRest !== null && starter.workload?.daysRest !== undefined) count += 1;
  if (typeof starter.workload?.avgPitchesLast5 === "number") count += 1;
  return Math.min(count, 3);
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function assertMetadata(html, route, title, description) {
  const absoluteUrl = absoluteSiteUrl(route);
  const imageUrl = `${absoluteUrl}/opengraph-image`;
  const actualDescription = renderedMetaDescription(html);
  const actualOgTitle = renderedMetaContent(html, { property: "og:title" });
  const actualOgDescription = renderedMetaContent(html, { property: "og:description" });
  const actualOgImageAlt = renderedMetaContent(html, { property: "og:image:alt" });
  const actualTwitterTitle = renderedMetaContent(html, { name: "twitter:title" });
  const actualTwitterDescription = renderedMetaContent(html, { name: "twitter:description" });
  const actualTwitterImageAlt = renderedMetaContent(html, { name: "twitter:image:alt" });
  const expectedDescription = actualDescription ?? description;

  assert(html.includes(`<link rel="canonical" href="${absoluteUrl}"/>`), `${route} should render canonical metadata`);
  assert(actualDescription && actualDescription.length > 0, `${route} should render description metadata`);
  assert(html.includes(`<meta property="og:url" content="${absoluteUrl}"/>`), `${route} should render Open Graph URL metadata`);
  assert(actualOgTitle === title, `${route} should render Open Graph title metadata: expected "${title}", got "${actualOgTitle ?? "missing"}"`);
  assert(actualOgDescription === expectedDescription, `${route} should render Open Graph description metadata matching the standard description`);
  assert(html.includes(`<meta property="og:image" content="${imageUrl}"/>`), `${route} should render Open Graph image metadata`);
  assert(html.includes(`<meta property="og:image:width" content="1200"/>`), `${route} should render Open Graph image width metadata`);
  assert(html.includes(`<meta property="og:image:height" content="630"/>`), `${route} should render Open Graph image height metadata`);
  assert(actualOgImageAlt === title, `${route} should render Open Graph image alt metadata`);
  assert(html.includes(`<meta name="twitter:card" content="summary_large_image"/>`), `${route} should render Twitter large image card metadata`);
  assert(actualTwitterTitle === title, `${route} should render Twitter title metadata`);
  assert(actualTwitterDescription === expectedDescription, `${route} should render Twitter description metadata matching the standard description`);
  assert(html.includes(`<meta name="twitter:image" content="${imageUrl}"/>`), `${route} should render Twitter image metadata`);
  assert(actualTwitterImageAlt === title, `${route} should render Twitter image alt metadata`);
}

function renderedMetaContent(html, attributes) {
  const metas = html.match(/<meta\b[^>]*>/g) ?? [];
  const tag = metas.find((candidate) =>
    Object.entries(attributes).every(([name, value]) => tagAttribute(candidate, name) === value),
  );
  const content = tag ? tagAttribute(tag, "content") : null;
  return content ? unescapeHtmlAttribute(content) : null;
}

function assertNoIndexFollow(html, route) {
  const robotsMatch = html.match(/<meta name="robots" content="([^"]+)"/);
  assert(robotsMatch, `${route} should render robots metadata`);
  const directives = robotsMatch[1].split(",").map((directive) => directive.trim().toLowerCase());
  assert(directives.includes("noindex"), `${route} robots metadata should include noindex`);
  assert(directives.includes("follow"), `${route} robots metadata should include follow`);
}

function escapeHtmlAttribute(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderedMetaDescription(html) {
  const match = html.match(/<meta name="description" content="([^"]*)"/);
  return match ? unescapeHtmlAttribute(match[1]) : null;
}

function unescapeHtmlAttribute(value) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function expectedUpcomingDayDescription(day) {
  const topGame = day.games[0];
  const lead = topGame
    ? `Top watch: ${topGame.label} with a ${topGame.gameWatchScore.toFixed(1)} watch score.`
    : "Probable starter watch list will update as starters are named.";
  return `Probable starting pitchers and pitching matchups for ${formatUpcomingDate(day.date)}, ranked by watch score: top arms, pairing quality, and matchup context. ${lead}`;
}

function expectedUpcomingDayTitle(dateToFormat) {
  return `MLB Upcoming Matchups - ${formatUpcomingDate(dateToFormat)}`;
}

function expectedUpcomingWeekDescription(upcoming) {
  const games = expectedOrderedUpcomingWeekGames(upcoming);
  const scheduledGameCount = upcoming.days.reduce((total, day) => total + day.scheduledGames, 0);
  const topGame = games[0]?.game;
  const lead = topGame
    ? `Top watch: ${topGame.label} at ${topGame.gameWatchScore.toFixed(1)}.`
    : "Updates as probable starters are named.";
  return `${scheduledGameCount} scheduled MLB games from ${formatUpcomingDate(upcoming.range.start)} to ${formatUpcomingDate(upcoming.range.end)}, ranked by starter form and matchup context. ${lead}`;
}

function expectedOrderedUpcomingWeekGames(upcoming) {
  return upcoming.days
    .flatMap((day) => day.games.map((game) => ({ day: day.date, game })))
    .sort(
      (a, b) =>
        b.game.gameWatchScore - a.game.gameWatchScore ||
        a.game.firstPitch.localeCompare(b.game.firstPitch) ||
        a.game.label.localeCompare(b.game.label),
    );
}

function expectedOrderedUpcomingWeekGameValues(upcoming) {
  return expectedOrderedUpcomingWeekGames(upcoming).map(({ day, game }) => ({ ...game, date: day }));
}

function expectedUpcomingWeekTitle(startDate) {
  return `MLB Upcoming Matchups - Week of ${formatUpcomingDate(startDate)}`;
}

function assertPinnedUpcomingMetadataFixtures() {
  const fullSlateDay = {
    date: "2026-07-04",
    scheduledGames: 2,
    games: [
      { label: "SEA @ HOU", gameWatchScore: 82.34, firstPitch: "2026-07-04T21:10:00.000Z" },
      { label: "NYY @ BOS", gameWatchScore: 74.1, firstPitch: "2026-07-04T20:05:00.000Z" },
    ],
  };
  const tbdHeavyDay = {
    date: "2026-07-05",
    scheduledGames: 2,
    games: [
      { label: "TBD @ TEX", gameWatchScore: 51, firstPitch: "2026-07-05T18:35:00.000Z" },
    ],
  };
  const offDay = {
    date: "2026-07-06",
    scheduledGames: 0,
    games: [],
  };
  const fullWeek = {
    range: { start: "2026-07-04", end: "2026-07-10" },
    days: [fullSlateDay, tbdHeavyDay, offDay],
  };
  const offWeek = {
    range: { start: "2026-07-06", end: "2026-07-12" },
    days: [offDay],
  };
  const tiedWeek = {
    range: { start: "2026-07-04", end: "2026-07-10" },
    days: [
      {
        date: "2026-07-04",
        scheduledGames: 2,
        games: [
          { label: "ZED @ BAL", gameWatchScore: 70, firstPitch: "2026-07-04T20:05:00.000Z" },
          { label: "ATL @ NYM", gameWatchScore: 70, firstPitch: "2026-07-04T19:05:00.000Z" },
        ],
      },
      {
        date: "2026-07-05",
        scheduledGames: 2,
        games: [
          { label: "BOS @ TOR", gameWatchScore: 70, firstPitch: "2026-07-04T20:05:00.000Z" },
          { label: "LAD @ SF", gameWatchScore: 69.9, firstPitch: "2026-07-05T20:15:00.000Z" },
        ],
      },
    ],
  };

  assert(
    expectedUpcomingDayDescription(fullSlateDay) ===
      "Probable starting pitchers and pitching matchups for Jul 4, ranked by watch score: top arms, pairing quality, and matchup context. Top watch: SEA @ HOU with a 82.3 watch score.",
    "upcoming day metadata fixture should cover full slates with a top watch lead",
  );
  assert(
    expectedUpcomingDayDescription(tbdHeavyDay) ===
      "Probable starting pitchers and pitching matchups for Jul 5, ranked by watch score: top arms, pairing quality, and matchup context. Top watch: TBD @ TEX with a 51.0 watch score.",
    "upcoming day metadata fixture should cover TBD-heavy slates without depending on live data",
  );
  assert(
    expectedUpcomingDayDescription(offDay) ===
      "Probable starting pitchers and pitching matchups for Jul 6, ranked by watch score: top arms, pairing quality, and matchup context. Probable starter watch list will update as starters are named.",
    "upcoming day metadata fixture should cover off days with the empty-state lead",
  );
  assert(
    expectedUpcomingWeekDescription(fullWeek) ===
      "4 scheduled MLB games from Jul 4 to Jul 10, ranked by starter form and matchup context. Top watch: SEA @ HOU at 82.3.",
    "upcoming week metadata fixture should cover a mixed full/TBD/off range",
  );
  assert(
    expectedUpcomingWeekDescription(offWeek) ===
      "0 scheduled MLB games from Jul 6 to Jul 12, ranked by starter form and matchup context. Updates as probable starters are named.",
    "upcoming week metadata fixture should cover off-week empty-state copy",
  );
  assert(
    expectedOrderedUpcomingWeekGames(tiedWeek).map(({ game }) => game.label).join("|") ===
      "ATL @ NYM|BOS @ TOR|ZED @ BAL|LAD @ SF",
    "upcoming week metadata fixture should pin score, first-pitch, and matchup-label tie-breaking",
  );
  assert(
    expectedUpcomingWeekDescription(tiedWeek) ===
      "4 scheduled MLB games from Jul 4 to Jul 10, ranked by starter form and matchup context. Top watch: ATL @ NYM at 70.0.",
    "upcoming week metadata fixture should use the deterministic ordered top watch lead",
  );
}

async function assertPng(url, label) {
  let response;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(url);
    if (response.ok || ![404, 500, 502, 503].includes(response.status) || attempt === 2) break;
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }
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

async function assertInvalidDateApiResponse(response, label) {
  assert(response.status === 404, `${label} should return HTTP 404, got ${response.status}`);
  const text = await response.text();
  if (!text.trim()) return;

  try {
    const payload = JSON.parse(text);
    assert(payload?.error === "Not found", `${label} should return the shared Not found JSON payload when a body is sent`);
  } catch (error) {
    throw new Error(`${label} returned invalid JSON: ${error.message}`);
  }
}

async function assertInvalidDatePageResponse(url, label) {
  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url);
    lastStatus = response.status;
    lastBody = await response.clone().text().catch(() => "");
    if (response.status === 404) return;
    if (response.status !== 200 || !lastBody.includes("data-navigation-shell")) break;
    await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
  }

  assert(lastStatus === 404, `${label} should return HTTP 404, got ${lastStatus}`);
}

async function readJson(response, label) {
  const text = await response.text();
  assert(text.trim().length > 0, `${label} should return a non-empty JSON body`);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} returned invalid JSON: ${error.message}`);
  }
}

function assertJsonLd(html, route, expectedName, expectedDescription, expectedItemCount, expectedGames, expectedListUrl) {
  const match = html.match(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/s);
  assert(match, `${route} should render JSON-LD`);

  const jsonLd = JSON.parse(match[1]);
  const jsonLdLimit = route.includes("/week") ? 20 : 10;
  const renderedDescription = renderedMetaDescription(html);
  const expectedJsonLdDescription = renderedDescription ?? expectedDescription;
  assert(jsonLd["@context"] === "https://schema.org", `${route} JSON-LD should use schema.org context`);
  assert(jsonLd["@type"] === "ItemList", `${route} JSON-LD should describe an ItemList`);
  assert(jsonLd.name === expectedName, `${route} JSON-LD name should match route title`);
  assert(
    jsonLd.itemListOrder === "https://schema.org/ItemListOrderDescending",
    `${route} JSON-LD should declare descending ranked order`,
  );
  if (allowsRenderedLiveDataDrift(route)) {
    assertNonEmptyString(jsonLd.description, `${route} JSON-LD description`);
    assert(
      jsonLd.description.includes("ranked by") &&
        (jsonLd.description.includes("Probable starting pitchers") || jsonLd.description.includes("upcoming MLB games")),
      `${route} JSON-LD description should keep the Upcoming metadata shape under live-data drift`,
    );
  } else {
    assert(jsonLd.description === expectedJsonLdDescription, `${route} JSON-LD description should match route metadata`);
  }
  assertNumber(jsonLd.numberOfItems, `${route} JSON-LD numberOfItems`);
  const expectedVisibleJsonLdItems = allowsRenderedLiveDataDrift(route)
    ? Math.min(jsonLd.numberOfItems, jsonLdLimit)
    : Math.min(expectedItemCount, jsonLdLimit, expectedGames.length);
  if (allowsRenderedLiveDataDrift(route)) {
    assert(
      Number.isInteger(jsonLd.numberOfItems) && jsonLd.numberOfItems >= 0 && jsonLd.numberOfItems <= Math.min(expectedItemCount, jsonLdLimit),
      `${route} JSON-LD should expose a valid live-adjusted item count`,
    );
  } else {
    assert(jsonLd.numberOfItems === expectedVisibleJsonLdItems, `${route} JSON-LD should expose exact emitted item count`);
  }
  assert(Array.isArray(jsonLd.itemListElement), `${route} JSON-LD itemListElement must be an array`);
  assert(jsonLd.itemListElement.length === expectedVisibleJsonLdItems, `${route} JSON-LD should cap visible list items correctly`);

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
    if (allowsRenderedLiveDataDrift(route)) {
      assert(
        supportedJsonLdEventStatuses().includes(entry.item.eventStatus),
        `${route} JSON-LD item ${index + 1} eventStatus should remain a supported schema status during live drift; got ${entry.item.eventStatus}`,
      );
    } else {
      assert(
        entry.item.eventStatus === expectedEventStatus,
        `${route} JSON-LD item ${index + 1} eventStatus should match API status ${expectedGame.status}: expected ${expectedEventStatus}, got ${entry.item.eventStatus}`,
      );
    }
    assertJsonLdLocation(entry.item.location, expectedGame, `${route} JSON-LD item ${index + 1}`);
    const expectedStarterCompetitors = expectedGame.starters.filter((starter) => starter.name && starter.pitcherId);
    assert(Array.isArray(entry.item.competitor), `${route} JSON-LD item ${index + 1} should include competitors`);
    const competitorCountMatchesExpected = entry.item.competitor.length === 2 + expectedStarterCompetitors.length;
    if (allowsRenderedLiveDataDrift(route)) {
      assertLiveDriftJsonLdCompetitors(entry.item.competitor, `${route} JSON-LD item ${index + 1}`);
    } else {
      assert(
        competitorCountMatchesExpected,
        `${route} JSON-LD item ${index + 1} should include only the two teams and named starters as competitors`,
      );
      assertJsonLdCompetitor(entry.item.competitor, expectedGame.away, `${route} JSON-LD item ${index + 1}`);
      assertJsonLdCompetitor(entry.item.competitor, expectedGame.home, `${route} JSON-LD item ${index + 1}`);
      expectedStarterCompetitors.forEach((starter) => {
        assertJsonLdStarter(entry.item.competitor, starter, `${route} JSON-LD item ${index + 1}`);
      });
    }
    assert(Array.isArray(entry.item.additionalProperty) && entry.item.additionalProperty.length === 4, `${route} JSON-LD item ${index + 1} should include watch properties`);
    assertJsonLdProperty(entry.item.additionalProperty, "Watch Score", expectedGame.gameWatchScore, `${route} JSON-LD item ${index + 1}`);
    assertJsonLdProperty(entry.item.additionalProperty, "Watch Tier", expectedWatchTierLabel(expectedGame.gameWatchScore), `${route} JSON-LD item ${index + 1}`);
    assertJsonLdProperty(entry.item.additionalProperty, "Matchup Score", expectedGame.matchupScore, `${route} JSON-LD item ${index + 1}`);
    assertJsonLdIntegerProperty(entry.item.additionalProperty, "Matchup Rank", `${route} JSON-LD item ${index + 1}`);
    if (index > 0) {
      const previousEntry = jsonLd.itemListElement[index - 1];
      const previousScore = jsonLdWatchScore(previousEntry);
      const currentScore = jsonLdWatchScore(entry);
      assert(previousScore >= currentScore, `${route} JSON-LD item ${index + 1} should preserve descending watch-score order`);
      if (route.includes("/week") && previousScore === currentScore) {
        assert(
          previousEntry.item.startDate <= entry.item.startDate,
          `${route} JSON-LD item ${index + 1} should preserve first-pitch order when watch scores tie`,
        );
        if (previousEntry.item.startDate === entry.item.startDate) {
          assert(
            previousEntry.item.name <= entry.item.name,
            `${route} JSON-LD item ${index + 1} should preserve matchup-label order when watch scores and first pitch tie`,
          );
        }
      }
    }
  });
}

function jsonLdWatchScore(entry) {
  const property = entry.item?.additionalProperty?.find((candidate) => candidate?.name === "Watch Score");
  assertNumber(property?.value, "JSON-LD Watch Score");
  return property.value;
}

function assertLiveDriftJsonLdCompetitors(competitors, label) {
  const teams = competitors.filter((candidate) => candidate?.["@type"] === "SportsTeam");
  const athletes = competitors.filter((candidate) => candidate?.["@type"] === "Person");
  assert(competitors.length >= 2 && competitors.length <= 4, `${label} should expose two teams plus up to two starters during live drift`);
  assert(teams.length === 2, `${label} should keep exactly two team competitors during live drift`);
  assert(athletes.length === competitors.length - teams.length, `${label} should only add named starter competitors during live drift`);
  competitors.forEach((competitor, index) => {
    assertNonEmptyString(competitor.name, `${label} competitor ${index + 1} name`);
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
  if (name === "Watch Score" || name === "Matchup Score") {
    assert(
      typeof property.value === "number" && property.value >= 0 && property.value <= 100,
      `${label} ${name} value should stay on the public 0-100 scale`,
    );
    return;
  }
  if (name === "Watch Tier") {
    assert(
      ["Must-watch", "Worth it", "Background"].includes(property.value),
      `${label} ${name} should remain a supported public tier`,
    );
    return;
  }
  if (typeof expectedValue === "number" && !Number.isInteger(expectedValue)) {
    assert(
      typeof property.value === "number" && Math.abs(property.value - expectedValue) <= 0.35,
      `${label} ${name} value should match API within live-data rounding: expected ${expectedValue}, got ${property.value}`,
    );
    return;
  }
  assert(
    property.value === expectedValue,
    `${label} ${name} value should match API: expected ${expectedValue}, got ${property.value}`,
  );
}

function allowsRenderedLiveDataDrift(route) {
  return route.startsWith("/upcoming");
}

function assertJsonLdIntegerProperty(properties, name, label) {
  const property = properties.find((candidate) => candidate.name === name);
  assert(property, `${label} should include ${name}`);
  assert(property["@type"] === "PropertyValue", `${label} ${name} should be a PropertyValue`);
  assert(Number.isInteger(property.value) && property.value >= 1, `${label} ${name} value should be a positive integer`);
}

function starterHeadshotUrl(pitcherId) {
  return `https://img.mlbstatic.com/mlb-photos/image/upload/w_100,q_auto:best/v1/people/${pitcherId}/headshot/67/current`;
}

function absoluteSiteUrl(path) {
  return new URL(path, `${siteUrl}/`).toString();
}

function expectedJsonLdEventStatus(status) {
  if (status === "ppd") return "https://schema.org/EventPostponed";
  if (status === "live") return "https://schema.org/EventInProgress";
  return "https://schema.org/EventScheduled";
}

function supportedJsonLdEventStatuses() {
  return [
    "https://schema.org/EventScheduled",
    "https://schema.org/EventInProgress",
    "https://schema.org/EventPostponed",
  ];
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
  const todayHref = anchorHrefWithAttributes(html, { "data-range-option": "today" }) ?? anchorHrefWithText(html, "Today");
  const todayMatch = todayHref?.match(/^\/upcoming\/(\d{4}-\d{2}-\d{2})$/);
  assert(todayMatch, `${route} should link the Today toggle to a dated upcoming slate`);
  const todayToggleDate = todayMatch[1];
  const tomorrow = addDays(todayToggleDate, 1);
  assert(html.includes("Upcoming range"), `${route} should expose the upcoming range navigation`);
  assert(
    anchorHasAttributes(html, {
      href: `/upcoming/${todayToggleDate}`,
      "aria-label": `View today slate for ${formatUpcomingDate(todayToggleDate)}`,
      "data-range-option": "today",
    }),
    `${route} should link the Today toggle to the rendered home slate with an accessible label and stable range key`,
  );
  assert(
    anchorHasAttributes(html, {
      href: `/upcoming/${tomorrow}`,
      "aria-label": `View tomorrow slate for ${formatUpcomingDate(tomorrow)}`,
      "data-range-option": "tomorrow",
    }),
    `${route} should link the Tomorrow toggle to the next slate with an accessible label and stable range key`,
  );
  assert(
    anchorHasAttributes(html, {
      href: `/upcoming/week/${expectedWeekStart}`,
      "aria-label": `View week of ${formatUpcomingDate(expectedWeekStart)}`,
      "data-range-option": "week",
    }),
    `${route} should link the This week toggle to the expected weekly slate with an accessible label and stable range key`,
  );
  if (expectedActiveHref) {
    assert(
      anchorHasAttributes(html, { href: expectedActiveHref, "aria-current": "page" }),
      `${route} should mark the active upcoming range toggle`,
    );
  }
}

function assertUpcomingControls(html, route, expectedLabel = "Filters / All statuses / Watch rank", linkExpectations = null) {
  assert(
    upcomingDatePageSource.includes('import { FastFilterLink } from "@/components/fast-filter-link";') &&
      upcomingDatePageSource.includes('<FastFilterLink className={`inline-flex min-h-11 items-center rounded border px-3 py-2 font-mono text-xs uppercase tracking-[0.14em]') &&
      upcomingDatePageSource.includes('ariaCurrent={active ? "location" : undefined}') &&
      upcomingDatePageSource.includes('data-control-link-active={String(active)} data-control-link-key={controlKey} scroll={false}'),
    "upcoming filter controls must use FastFilterLink with stable link keys, active current-state semantics, and scroll disabled so mobile taps do not jump to the page top",
  );
  assert(
    UPCOMING_CONTROL_LINK_KEYS.every((key) => countOccurrences(upcomingDatePageSource, `controlKey="${key}"`) === 1),
    "upcoming filter controls must keep each stable public option key exactly once for status and sort links",
  );
  assert(
    upcomingDatePageSource.includes('href={upcomingControlHref(basePath, { ...controls, pregameOnly: false })}>All games') &&
      upcomingDatePageSource.includes('href={upcomingControlHref(basePath, { ...controls, pregameOnly: true })}>Pregame only') &&
      upcomingDatePageSource.includes('href={upcomingControlHref(basePath, { ...controls, sort: "watch" })}>Watch rank') &&
      upcomingDatePageSource.includes('href={upcomingControlHref(basePath, { ...controls, sort: "time" })}>Start time'),
    "upcoming filter controls must build status and sort links from the current normalized control state",
  );
  assert(
    upcomingDatePageSource.includes('role="group" aria-label={`${label} filters`}') &&
      upcomingDatePageSource.includes('<ControlGroup label="Status">') &&
      upcomingDatePageSource.includes('<ControlGroup label="Sort">'),
    "upcoming filter controls must keep grouped Status and Sort semantics",
  );
  assert(
    upcomingDatePageSource.includes('const controlsKey = `${controls.pregameOnly ? "pregame" : "all"}-${controls.sort}`;') &&
      upcomingDatePageSource.includes("const controlsEmpty = visibleGameCount === 0;") &&
      upcomingDatePageSource.includes("const hiddenGameCount = Math.max(0, scheduledGameCount - visibleGameCount);") &&
      upcomingDatePageSource.includes("const activeControlCount = 2;") &&
      upcomingDatePageSource.includes("data-control-key={controlsKey}") &&
      upcomingDatePageSource.includes("data-control-empty={String(controlsEmpty)}") &&
      upcomingDatePageSource.includes("data-control-visible-games={visibleGameCount}") &&
      upcomingDatePageSource.includes("data-control-scheduled-games={scheduledGameCount}") &&
      upcomingDatePageSource.includes("data-control-hidden-games={hiddenGameCount}") &&
      upcomingDatePageSource.includes("data-control-active-count={activeControlCount}"),
    "upcoming filter controls must keep stable count, empty-state, and active-control telemetry for day/week route probes",
  );
  assert(
    upcomingDatePageSource.includes("const visibleGames = games.filter((game) => !controls.pregameOnly || game.status === \"pregame\");") &&
      upcomingDatePageSource.includes('if (controls.sort === "time") {') &&
      upcomingDatePageSource.includes("return [...visibleGames].sort((a, b) => a.firstPitch.localeCompare(b.firstPitch) || b.gameWatchScore - a.gameWatchScore);") &&
      upcomingDatePageSource.includes("return visibleGames;"),
    "upcoming filter controls must preserve API watch-rank order and only copy-sort the Start time view",
  );
  assert(
    upcomingDatePageSource.includes("const controls = normalizeUpcomingControls(await searchParams);") &&
      upcomingDatePageSource.includes("const visibleUpcoming = { ...upcoming, games: filterAndSortGames(upcoming.games, controls) };") &&
      upcomingDatePageSource.includes("basePath={upcomingDateHref(resolvedDate)}") &&
      upcomingDatePageSource.includes('slateRange="day"') &&
      upcomingDatePageSource.includes("visibleGameCount={visibleUpcoming.games.length}") &&
      upcomingDatePageSource.includes("scheduledGameCount={upcoming.scheduledGames}") &&
      upcomingDatePageSource.includes("tonight={visibleUpcoming}"),
    "upcoming day filters must apply normalized controls to both control counts and rendered watch cards",
  );
  assert(
    upcomingWeekPageSource.includes('import { filterAndSortGames, normalizeUpcomingControls, UpcomingControls } from "@/app/upcoming/[date]/page";') &&
      upcomingWeekPageSource.includes("const controls = normalizeUpcomingControls(await searchParams);") &&
      upcomingWeekPageSource.includes("b.game.gameWatchScore - a.game.gameWatchScore ||") &&
      upcomingWeekPageSource.includes("a.game.firstPitch.localeCompare(b.game.firstPitch) ||") &&
      upcomingWeekPageSource.includes("a.game.label.localeCompare(b.game.label),") &&
      upcomingWeekPageSource.includes("const filteredDays = upcoming.days.map((day) => ({ ...day, games: filterAndSortGames(day.games, controls) }));") &&
      upcomingWeekPageSource.includes("const visibleGameCount = filteredDays.reduce((count, day) => count + day.games.length, 0);") &&
      upcomingWeekPageSource.includes("const scheduledGameCount = upcoming.days.reduce((count, day) => count + day.scheduledGames, 0);") &&
      upcomingWeekPageSource.includes("visibleGameCount={visibleGameCount}") &&
      upcomingWeekPageSource.includes("scheduledGameCount={scheduledGameCount}") &&
      upcomingWeekPageSource.includes("{filteredDays.map((day) => (") &&
      upcomingWeekPageSource.includes("<UpcomingControls") &&
      upcomingWeekPageSource.includes('slateRange="week"'),
    "upcoming week filters must reuse the day-route control helpers, render filtered days with matching control counts, and keep the featured game tie-break deterministic",
  );
  assert(
    [
      "data-visible-game-pks",
      "data-visible-game-statuses",
      "data-visible-starter-form-statuses",
      "data-visible-starter-form-hrefs",
      "data-visible-watch-scores",
      "data-visible-watch-tiers",
      "data-visible-watch-sort-groups",
      "data-visible-component-keys",
      "data-visible-component-values",
    ].every((attribute) => tonightsMustWatchSource.includes(`${attribute}=`)),
    "upcoming watch-list component must keep stable telemetry attributes for route/API contract checks",
  );
  assert(
      tonightServiceSource.includes("pitcherId: String(probable.id),\n      name: probable.fullName,\n      team,\n      side,") &&
      tonightServiceSource.includes("pitcherId: form.pitcherId,\n    name: form.name,\n    team,\n    side,") &&
      tonightServiceSource.includes('["tonight-must-watch", "v8"]') &&
      !tonightServiceSource.includes('["tonight-must-watch", "v6"]') &&
      !tonightServiceSource.includes('["tonight-must-watch", "v5"]') &&
      !tonightServiceSource.includes('["tonight-must-watch", "v4"]') &&
      !tonightServiceSource.includes('["tonight-must-watch", "v3"]') &&
      !tonightServiceSource.includes('["tonight-must-watch", "v2"]') &&
      tonightServiceSource.includes('const ACTIVE_UPCOMING_CARD_STATUSES: UpcomingCardStatus[] = ["pregame"];') &&
      typesSource.includes('export type UpcomingCardStatus = Extract<TonightGameStatus, "pregame">;') &&
      tonightApiSource.includes('export const dynamic = "force-dynamic";') &&
      upcomingApiSource.includes('export const dynamic = "force-dynamic";') &&
      tonightServiceSource.includes("const candidates = builtGames.filter((game) => isUpcomingCardStatus(game.status));") &&
      !tonightServiceSource.includes("isActiveUpcomingCardGame") &&
      !tonightServiceSource.includes("UPCOMING_LIVE_GAME_MAX_AGE_MS"),
    "upcoming probable starters must use scheduled game slot teams, the refreshed v8 cache namespace, and only pregame-typed cards now that live has its own section",
  );
  assert(
    [
      upcomingIndexPageSource,
      upcomingDatePageSource,
      upcomingIndexImageSource,
      upcomingDateImageSource,
      upcomingWeekIndexPageSource,
      upcomingWeekPageSource,
      upcomingWeekIndexImageSource,
      upcomingWeekImageSource,
      tonightApiSource,
      upcomingApiSource,
    ].every((source) => source.includes('export const dynamic = "force-dynamic";')),
    "upcoming route pages, image routes, and APIs must stay force-dynamic so runtime slate/form data is not statically cached",
  );
  assert(
    [
      upcomingIndexPageSource,
      upcomingIndexImageSource,
      upcomingWeekIndexPageSource,
      upcomingWeekIndexImageSource,
    ].every(
      (source) =>
        source.includes('import { getDefaultUpcomingDate } from "@/lib/data/start-service";') &&
        source.includes("await getDefaultUpcomingDate()") &&
        !source.includes("getDefaultSlateDates"),
    ),
    "upcoming wrapper pages and image routes must resolve through the upcoming-only default date without loading ranked slate defaults",
  );
  assert(
    upcomingIndexPageSource.includes(
      "return <UpcomingDatePage params={Promise.resolve({ date: upcomingDate })} searchParams={searchParams} />;",
    ) &&
      upcomingWeekIndexPageSource.includes(
        "return <UpcomingWeekPage params={Promise.resolve({ startDate: upcomingDate })} searchParams={searchParams} />;",
      ),
    "upcoming wrapper pages must preserve filter query params when delegating to dated route implementations",
  );
  assert(
    upcomingIndexImageSource.includes('import Image from "./[date]/opengraph-image";') &&
      upcomingIndexImageSource.includes('export const alt = "Toe the Slab upcoming starter watch card";') &&
      upcomingIndexImageSource.includes("width: 1200") &&
      upcomingIndexImageSource.includes("height: 630") &&
      upcomingIndexImageSource.includes('export const contentType = "image/png";') &&
      upcomingIndexImageSource.includes("return Image({ params: Promise.resolve({ date: upcomingDate }) });") &&
      upcomingWeekIndexImageSource.includes('import Image from "./[startDate]/opengraph-image";') &&
      upcomingWeekIndexImageSource.includes('export const alt = "Toe the Slab weekly upcoming starter watch card";') &&
      upcomingWeekIndexImageSource.includes("width: 1200") &&
      upcomingWeekIndexImageSource.includes("height: 630") &&
      upcomingWeekIndexImageSource.includes('export const contentType = "image/png";') &&
      upcomingWeekIndexImageSource.includes("return Image({ params: Promise.resolve({ startDate: upcomingDate }) });"),
    "upcoming Open Graph wrapper routes must stay thin 1200x630 PNG delegates to the dated share-card routes",
  );
  assert(
    [
      upcomingIndexPageSource,
      upcomingDatePageSource,
      upcomingWeekIndexPageSource,
      upcomingWeekPageSource,
    ].every(
      (source) =>
        source.includes("images: [{ url: image, width: 1200, height: 630, alt: title }]") &&
        source.includes('card: "summary_large_image"') &&
        source.includes("images: [{ url: image, alt: title }]"),
    ),
    "upcoming page metadata must keep 1200x630 Open Graph images and title-aligned Twitter image alt text",
  );
  assert(
    [
      upcomingIndexPageSource,
      upcomingDatePageSource,
      upcomingWeekIndexPageSource,
      upcomingWeekPageSource,
    ].every(
      (source) =>
        source.includes("const image = `${url}/opengraph-image`;") &&
        source.includes("canonical: url,") &&
        source.includes("openGraph:") &&
        source.includes("type: \"website\",") &&
        source.includes("url,") &&
        source.includes("images: [{ url: image, width: 1200, height: 630, alt: title }]"),
    ),
    "upcoming page metadata must derive share-card images and Open Graph URLs from the canonical route URL",
  );
  assert(
    [
      upcomingIndexPageSource,
      upcomingDatePageSource,
      upcomingWeekIndexPageSource,
      upcomingWeekPageSource,
    ].every(
      (source) =>
        source.includes("noIndexFollow") &&
        source.includes("const query = await searchParams;") &&
        source.includes("robots: query && Object.keys(query).length > 0 ? noIndexFollow() : undefined,"),
    ),
    "upcoming page metadata must keep clean-route canonicals while filtered query variants stay noindex/follow",
  );
  assert(
    upcomingMetadataSource.includes('itemListOrder: "https://schema.org/ItemListOrderDescending",') &&
      countOccurrences(upcomingMetadataSource, 'itemListOrder: "https://schema.org/ItemListOrderDescending",') === 2,
    "upcoming day/week JSON-LD must declare descending ranked ItemList order for share/search metadata",
  );
  assert(
    upcomingMetadataSource.includes("const games = orderedUpcomingWeekGames(upcoming);") &&
      countOccurrences(upcomingMetadataSource, "const games = orderedUpcomingWeekGames(upcoming);") === 2 &&
      upcomingMetadataSource.includes("const scheduledGameCount = upcoming.days.reduce((total, day) => total + day.scheduledGames, 0);") &&
      upcomingMetadataSource.includes("const topGame = games[0]?.game;"),
    "upcoming weekly description must use scheduled-game counts while sharing JSON-LD's deterministic game ordering",
  );
  assert(
    upcomingMetadataSource.includes(
      "b.game.gameWatchScore - a.game.gameWatchScore ||",
    ),
    "upcoming weekly JSON-LD must keep descending watch-score ordering",
  );
  assert(
    upcomingMetadataSource.includes("a.game.firstPitch.localeCompare(b.game.firstPitch) ||") &&
      upcomingMetadataSource.includes("a.game.label.localeCompare(b.game.label),"),
    "upcoming weekly JSON-LD must keep stable first-pitch and matchup-label tie-breaking",
  );
  assert(
    upcomingMetadataSource.includes("const itemListGames = upcoming.games.slice(0, 10);") &&
      upcomingMetadataSource.includes("const itemListGames = games.slice(0, 20);") &&
      upcomingMetadataSource.includes("numberOfItems: itemListGames.length,") &&
      countOccurrences(upcomingMetadataSource, "numberOfItems: itemListGames.length,") === 2 &&
      upcomingMetadataSource.includes("itemListElement: itemListGames.map("),
    "upcoming day/week JSON-LD numberOfItems must match the emitted capped ItemList entries",
  );
  assert(
    upcomingMetadataSource.includes("description: upcomingDayDescription(upcoming),") &&
      upcomingMetadataSource.includes("description: upcomingWeekDescription(upcoming),"),
    "upcoming day/week JSON-LD descriptions must reuse the public route metadata copy",
  );
  assert(
    upcomingMetadataSource.includes("url: absoluteSiteUrl(upcomingDateHref(upcoming.date)),") &&
      upcomingMetadataSource.includes("url: absoluteSiteUrl(upcomingWeekHref(upcoming.range.start)),") &&
      upcomingMetadataSource.includes("item: jsonLdForUpcomingGame(game),") &&
      upcomingMetadataSource.includes("item: jsonLdForUpcomingGame({ ...game, date: day }),") &&
      upcomingMetadataSource.includes("url: absoluteSiteUrl(upcomingDateHref(game.date)),"),
    "upcoming JSON-LD must keep day lists pointed at day slates, weekly lists pointed at the week surface, and event entities pointed at their actual day slate",
  );
  assert(
    upcomingMetadataSource.includes("url: absoluteSiteUrl(`/pitchers/${starter.pitcherId}/form`),") &&
      upcomingMetadataSource.includes("image: starterHeadshotUrl(starter.pitcherId),") &&
      upcomingMetadataSource.includes('memberOf: { "@type": "SportsTeam", name: starter.team },'),
    "upcoming JSON-LD starter competitors must keep pitcher Form URLs, headshots, and team membership",
  );
  assert(
    upcomingMetadataSource.includes(".filter(hasStarterIdentity)") &&
      upcomingMetadataSource.includes("function hasStarterIdentity(") &&
      upcomingMetadataSource.includes("eventStatus: eventStatusForGame(game.status),") &&
      upcomingMetadataSource.includes('if (status === "ppd") return "https://schema.org/EventPostponed";') &&
      upcomingMetadataSource.includes('if (status === "live") return "https://schema.org/EventInProgress";') &&
      upcomingMetadataSource.includes('return "https://schema.org/EventScheduled";'),
    "upcoming JSON-LD must filter unnamed starters and map game status to schema.org event status",
  );
  assert(
    upcomingMetadataSource.includes("const watchTier = watchTierOf(game.gameWatchScore);") &&
      upcomingMetadataSource.includes('{ "@type": "PropertyValue", name: "Watch Score", value: game.gameWatchScore },') &&
      upcomingMetadataSource.includes('{ "@type": "PropertyValue", name: "Watch Tier", value: watchTier.label },') &&
      upcomingMetadataSource.includes('{ "@type": "PropertyValue", name: "Matchup Score", value: game.matchupScore },') &&
      upcomingMetadataSource.includes('{ "@type": "PropertyValue", name: "Matchup Rank", value: game.matchupRankTonight },'),
    "upcoming JSON-LD must keep the public watch-score, tier, matchup-score, and matchup-rank properties",
  );
  assert(
    typesSource.includes('export type StarterFormStatus = "ok" | "cold_start" | "mlb_debut" | "join_gap";') &&
      typesSource.includes('export type StarterLimitedReason = Exclude<StarterFormStatus, "ok"> | null;') &&
      typesSource.includes('export type MatchupConfidence = "HIGH" | "LOW" | "NONE";') &&
      tonightServiceSource.includes("fetchMlbPitcherStartCompleteness") &&
      tonightServiceSource.includes("function classifyStarterForm(") &&
      tonightServiceSource.includes("matched <= FORM_COMPLETENESS.joinGapMatchFloor") &&
      !tonightServiceSource.includes("ratio < FORM_COMPLETENESS.joinCompletenessMin") &&
      tonightServiceSource.includes('formStatus: formCompleteness.status') &&
      tonightServiceSource.includes('console.warn("[upcoming:join-gap-starter]"') &&
      tonightServiceSource.includes("function applyTrustGateWatchScore") &&
      tonightsMustWatchSource.includes("function watchFlagNoteText(game: TonightGame)") &&
      tonightsMustWatchSource.includes('return notes.join(" ");') &&
      tonightsMustWatchSource.includes('data-visible-starter-limited-reasons=') &&
      tonightsMustWatchSource.includes('data-visible-starter-form-statuses=') &&
      tonightsMustWatchSource.includes("Form pending") &&
      tonightsMustWatchSource.includes("Baseline") &&
      tonightsMustWatchSource.includes("MLB DEBUT"),
    "upcoming limited pitchers must distinguish cold_start, mlb_debut, and join_gap, log join misses, expose status telemetry, and render form pending/baseline/debut states",
  );
  assert(
      tonightsMustWatchSource.includes("data-visible-starter-spark-readies=") &&
      countOccurrences(tonightsMustWatchSource, "data-visible-starter-spark-readies=") === 1 &&
      tonightsMustWatchSource.includes("shownGames.map(gameSparkReadyPairValue).join(\",\")") &&
      tonightsMustWatchSource.includes("data-visible-starter-spark-ready-counts=") &&
      countOccurrences(tonightsMustWatchSource, "data-visible-starter-spark-ready-counts=") === 1 &&
      tonightsMustWatchSource.includes("shownGames.map(gameSparkReadyCountValue).join(\",\")") &&
      tonightsMustWatchSource.includes("function hasStarterSparkForm(starter: TonightStarter)") &&
      tonightsMustWatchSource.includes('return starter.formStatus === "ok" && Boolean(starter.spark?.length && starter.tier);') &&
      tonightsMustWatchSource.includes("function starterSparkReadyValue(starter: TonightStarter)") &&
      countOccurrences(tonightsMustWatchSource, "starterSparkReadyValue(starter)") === 1 &&
      tonightsMustWatchSource.includes("return String(hasStarterSparkForm(starter));") &&
      tonightsMustWatchSource.includes("function gameSparkReadyPairValue(game: TonightGame)") &&
      countOccurrences(tonightsMustWatchSource, "gameSparkReadyPairValue") === 2 &&
      tonightsMustWatchSource.includes("return game.starters.map(starterSparkReadyValue).join(\"/\");") &&
      tonightsMustWatchSource.includes("function gameSparkReadyCountValue(game: TonightGame)") &&
      countOccurrences(tonightsMustWatchSource, "gameSparkReadyCountValue") === 2 &&
      tonightsMustWatchSource.includes("return String(game.starters.filter(hasStarterSparkForm).length);") &&
      tonightsMustWatchSource.includes("function starterSparkCountValue(starter: TonightStarter)") &&
      countOccurrences(tonightsMustWatchSource, "starterSparkCountValue(starter)") === 1 &&
      tonightsMustWatchSource.includes("return String(starter.spark?.length ?? 0);") &&
      tonightsMustWatchSource.includes("function gameSparkCountPairValue(game: TonightGame)") &&
      countOccurrences(tonightsMustWatchSource, "gameSparkCountPairValue") === 2 &&
      tonightsMustWatchSource.includes("return game.starters.map(starterSparkCountValue).join(\"/\");") &&
      tonightsMustWatchSource.includes("shownGames.map(gameSparkCountPairValue).join(\",\")") &&
      tonightsMustWatchSource.includes('"data-form-clash-away-spark-count": starterSparkCountValue(away),') &&
      tonightsMustWatchSource.includes('"data-form-clash-home-spark-count": starterSparkCountValue(home),') &&
      tonightsMustWatchSource.includes('"data-form-clash-away-spark-ready": starterSparkReadyValue(away),') &&
      countOccurrences(tonightsMustWatchSource, '"data-form-clash-away-spark-ready":') === 1 &&
      tonightsMustWatchSource.includes('"data-form-clash-home-spark-ready": starterSparkReadyValue(home),') &&
      countOccurrences(tonightsMustWatchSource, '"data-form-clash-home-spark-ready":') === 1 &&
      tonightsMustWatchSource.includes('"data-starter-spark-count": starterSparkCountValue(starter),') &&
      countOccurrences(tonightsMustWatchSource, '"data-starter-spark-count":') === 1 &&
      tonightsMustWatchSource.includes("data-visible-starter-spark-latest=") &&
      countOccurrences(tonightsMustWatchSource, "data-visible-starter-spark-latest=") === 1 &&
      tonightsMustWatchSource.includes("function starterSparkLatestValue(starter: TonightStarter)") &&
      countOccurrences(tonightsMustWatchSource, "starterSparkLatestValue(starter)") === 1 &&
      tonightsMustWatchSource.includes('return starter.spark?.length ? starter.spark[starter.spark.length - 1].toFixed(1) : "none";') &&
      tonightsMustWatchSource.includes("function gameSparkLatestPairValue(game: TonightGame)") &&
      countOccurrences(tonightsMustWatchSource, "gameSparkLatestPairValue") === 2 &&
      tonightsMustWatchSource.includes("return game.starters.map(starterSparkLatestValue).join(\"/\");") &&
      tonightsMustWatchSource.includes("shownGames.map(gameSparkLatestPairValue).join(\",\")") &&
      tonightsMustWatchSource.includes("const ready = hasStarterSparkForm(away) && hasStarterSparkForm(home);") &&
      tonightsMustWatchSource.includes("if (!hasStarterSparkForm(away) || !hasStarterSparkForm(home))") &&
      countOccurrences(tonightsMustWatchSource, "{hasStarterSparkForm(starter) ? (") === 2 &&
      tonightsMustWatchSource.includes('"data-starter-spark-ready": starterSparkReadyValue(starter),') &&
      countOccurrences(tonightsMustWatchSource, '"data-starter-spark-ready":') === 1 &&
      tonightsMustWatchSource.includes('"data-starter-spark-latest": starterSparkLatestValue(starter),') &&
      countOccurrences(tonightsMustWatchSource, '"data-starter-spark-latest":') === 1 &&
      !tonightsMustWatchSource.includes('starter.status === "ok" && starter.spark && starter.tier ? ('),
    "upcoming form visuals must use shared spark count/latest helpers for telemetry and one spark-ready helper before rendering ready state or sparklines",
  );
  assert(
    tonightsMustWatchSource.includes("function watchCardKind(index: number)") &&
      countOccurrences(tonightsMustWatchSource, "function watchCardKind(index: number)") === 1 &&
      tonightsMustWatchSource.includes('return index === 0 ? "headliner" : "row";') &&
      tonightsMustWatchSource.includes("shownGames.map((_, index) => watchCardKind(index)).join(\",\")") &&
      tonightsMustWatchSource.includes('data-watch-card-kind="headliner"') &&
      tonightsMustWatchSource.includes('data-watch-card-kind="row"'),
    "upcoming watch-card kind telemetry must share one headliner/row helper for section ordering",
  );
  assert(
    tonightsMustWatchSource.includes("function watchScoreValue(game: TonightGame)") &&
      countOccurrences(tonightsMustWatchSource, "function watchScoreValue(game: TonightGame)") === 1 &&
      tonightsMustWatchSource.includes("const WATCH_SCORE_PRECISION = 1;") &&
      countOccurrences(tonightsMustWatchSource, "WATCH_SCORE_PRECISION") >= 2 &&
      tonightsMustWatchSource.includes("return game.gameWatchScore.toFixed(WATCH_SCORE_PRECISION);") &&
      !tonightsMustWatchSource.includes("game.gameWatchScore.toFixed(1)") &&
      tonightsMustWatchSource.includes("function watchScoreLabel(game: TonightGame)") &&
      countOccurrences(tonightsMustWatchSource, "function watchScoreLabel(game: TonightGame)") === 1 &&
      tonightsMustWatchSource.includes("shownGames.map(watchScoreValue).join(\",\")") &&
      tonightsMustWatchSource.includes("shownGames.map((game) => watchScoreLabel(game)).join(\"|\")") &&
      tonightsMustWatchSource.includes("return `Watch score ${watchScoreValue(game)}`;") &&
      countOccurrences(tonightsMustWatchSource, "data-watch-score={watchScoreValue(game)}") === 2 &&
      countOccurrences(tonightsMustWatchSource, "data-watch-score-label={watchScoreLabel(game)}") === 2 &&
      tonightsMustWatchSource.includes("data-hook-score={watchScoreValue(game)}") &&
      tonightsMustWatchSource.includes("{watchScoreValue(game)}</p>"),
    "upcoming watch-score telemetry, labels, and hook display must share one formatted score helper",
  );
  assert(
    tonightsMustWatchSource.includes("function watchTierLabel(game: TonightGame)") &&
      countOccurrences(tonightsMustWatchSource, "function watchTierLabel(game: TonightGame)") === 1 &&
      tonightsMustWatchSource.includes("return watchTierForGame(game).label;") &&
      tonightsMustWatchSource.includes("shownGames.map(watchTierLabel).join(\"|\")") &&
      countOccurrences(tonightsMustWatchSource, "data-watch-tier={watchTierLabel(game)}") === 2 &&
      !tonightsMustWatchSource.includes("data-watch-tier={tier.label}") &&
      !tonightsMustWatchSource.includes("watchTierForRank"),
    "upcoming public watch-tier labels must share the confidence-capped game tier across section telemetry and card attributes",
  );
  assert(
    tonightsMustWatchSource.includes("function watchSortGroupValue(game: TonightGame)") &&
      countOccurrences(tonightsMustWatchSource, "function watchSortGroupValue(game: TonightGame)") === 1 &&
      tonightsMustWatchSource.includes("return String(game.watchSortGroup);") &&
      tonightsMustWatchSource.includes("function watchSortGroupLabelValue(game: TonightGame)") &&
      countOccurrences(tonightsMustWatchSource, "function watchSortGroupLabelValue(game: TonightGame)") === 1 &&
      tonightsMustWatchSource.includes("return watchSortGroupLabel(game);") &&
      tonightsMustWatchSource.includes("shownGames.map(watchSortGroupValue).join(\",\")") &&
      tonightsMustWatchSource.includes("shownGames.map(watchSortGroupLabelValue).join(\"|\")") &&
      countOccurrences(tonightsMustWatchSource, "data-watch-sort-group={watchSortGroupValue(game)}") === 2 &&
      countOccurrences(tonightsMustWatchSource, "data-watch-sort-group-label={watchSortGroupLabelValue(game)}") === 2 &&
      !tonightsMustWatchSource.includes("shownGames.map((game) => game.watchSortGroup).join(\",\")") &&
      !tonightsMustWatchSource.includes("data-watch-sort-group={game.watchSortGroup}") &&
      !tonightsMustWatchSource.includes("shownGames.map((game) => watchSortGroupLabel(game)).join(\"|\")") &&
      !tonightsMustWatchSource.includes("data-watch-sort-group-label={watchSortGroupLabel(game)}"),
    "upcoming watch sort-group value/label telemetry must share helper paths across section and card attributes",
  );
  assert(
      tonightsMustWatchSource.includes("function watchFlagNoteKeysValue(game: TonightGame)") &&
      countOccurrences(tonightsMustWatchSource, "function watchFlagNoteKeysValue(game: TonightGame)") === 1 &&
      tonightsMustWatchSource.includes('return watchFlagNoteKeys(game).join("+") || "clear";') &&
      tonightsMustWatchSource.includes("function watchFlagNoteLabelValue(game: TonightGame)") &&
      countOccurrences(tonightsMustWatchSource, "function watchFlagNoteLabelValue(game: TonightGame)") === 1 &&
      tonightsMustWatchSource.includes("return watchFlagNoteDataLabel(game);") &&
      tonightsMustWatchSource.includes("shownGames.map(watchFlagNoteKeysValue).join(\",\")") &&
      tonightsMustWatchSource.includes("shownGames.map(watchFlagNoteLabelValue).join(\"|\")") &&
      countOccurrences(tonightsMustWatchSource, "data-watch-flag-keys={watchFlagNoteKeysValue(game)}") === 2 &&
      countOccurrences(tonightsMustWatchSource, "data-watch-flag-label={watchFlagNoteLabelValue(game)}") === 2 &&
      !tonightsMustWatchSource.includes('shownGames.map((game) => watchFlagNoteKeys(game).join("+") || "clear").join(",")') &&
      !tonightsMustWatchSource.includes('data-watch-flag-keys={watchFlagNoteKeys(game).join("+") || "clear"}') &&
      !tonightsMustWatchSource.includes("shownGames.map((game) => watchFlagNoteDataLabel(game)).join(\"|\")"),
    "upcoming watch-flag key/label telemetry must share public value helpers across section and card attributes",
  );
  assert(
    tonightsMustWatchSource.includes("function leagueMeanGsValue(value: number)") &&
      countOccurrences(tonightsMustWatchSource, "function leagueMeanGsValue(value: number)") === 1 &&
      tonightsMustWatchSource.includes("return value.toFixed(WATCH_SCORE_PRECISION);") &&
      tonightsMustWatchSource.includes("data-league-mean-gs={leagueMeanGsValue(tonight.leagueMeanGS)}") &&
      !tonightsMustWatchSource.includes("data-league-mean-gs={tonight.leagueMeanGS.toFixed(1)}"),
    "upcoming league mean GS+ telemetry must share the advertised watch-score precision helper",
  );
  assert(
    tonightsMustWatchSource.includes("function watchCardRankValue(game: TonightGame, index: number)") &&
      countOccurrences(tonightsMustWatchSource, "function watchCardRankValue(game: TonightGame, index: number)") === 1 &&
      tonightsMustWatchSource.includes('return game.status === "ppd" && index === 0 ? "-" : String(index + 1);') &&
      tonightsMustWatchSource.includes("function watchRankLabelValue(rankLabel: string)") &&
      countOccurrences(tonightsMustWatchSource, "function watchRankLabelValue(rankLabel: string)") === 1 &&
      tonightsMustWatchSource.includes("return rankLabel;") &&
      tonightsMustWatchSource.includes("shownGames.map((game, index) => watchCardRankValue(game, index)).join(\",\")") &&
      tonightsMustWatchSource.includes("shownGames.map(() => watchRankLabelValue(rankLabel)).join(\"|\")") &&
      tonightsMustWatchSource.includes("data-watch-rank={watchCardRankValue(game, 0)}") &&
      tonightsMustWatchSource.includes("data-watch-rank={watchCardRankValue(game, rank - 1)}") &&
      countOccurrences(tonightsMustWatchSource, "data-watch-rank-label={watchRankLabelValue(rankLabel)}") === 2 &&
      !tonightsMustWatchSource.includes('data-watch-rank={game.status === "ppd" ? "-" : "1"}') &&
      !tonightsMustWatchSource.includes("data-watch-rank={rank}") &&
      !tonightsMustWatchSource.includes("data-watch-rank-label={rankLabel}"),
    "upcoming watch-card ranks and rank labels must share helper paths across section telemetry and card attributes",
  );
  assert(
    tonightsMustWatchSource.includes("function watchCardSummaryIdValue(game: TonightGame)") &&
      countOccurrences(tonightsMustWatchSource, "function watchCardSummaryIdValue(game: TonightGame)") === 1 &&
      tonightsMustWatchSource.includes("return watchCardSummaryId(game);") &&
      tonightsMustWatchSource.includes("function watchCardSummaryAriaLabelValue(game: TonightGame)") &&
      countOccurrences(tonightsMustWatchSource, "function watchCardSummaryAriaLabelValue(game: TonightGame)") === 1 &&
      tonightsMustWatchSource.includes("return watchCardSummaryAriaLabel(game);") &&
      tonightsMustWatchSource.includes("shownGames.map(watchCardSummaryIdValue).join(\",\")") &&
      tonightsMustWatchSource.includes("shownGames.map(watchCardSummaryAriaLabelValue).join(\"|\")") &&
      countOccurrences(tonightsMustWatchSource, "const summaryId = watchCardSummaryIdValue(game);") === 2 &&
      countOccurrences(tonightsMustWatchSource, "data-watch-summary-aria-label={watchCardSummaryAriaLabelValue(game)}") === 2 &&
      countOccurrences(tonightsMustWatchSource, "aria-label={watchCardSummaryAriaLabelValue(game)}") === 4 &&
      !tonightsMustWatchSource.includes("shownGames.map((game) => watchCardSummaryId(game)).join(\",\")") &&
      !tonightsMustWatchSource.includes("shownGames.map((game) => watchCardSummaryAriaLabel(game)).join(\"|\")"),
    "upcoming watch-card summary ids and aria labels must share value helpers across section telemetry, card attributes, and summaries",
  );

  assert(
    typesSource.includes('result: StartSummary["result"];') &&
      formServiceSource.includes("result: start.result,"),
    "upcoming starter lastStart payload must preserve canonical W/L/ND result from Form start points",
  );
  assert(
    tonightsMustWatchSource.includes("function watchComponentCountValue()") &&
      countOccurrences(tonightsMustWatchSource, "function watchComponentCountValue()") === 1 &&
      tonightsMustWatchSource.includes("return String(WATCH_COMPONENT_KEYS.length);") &&
      tonightsMustWatchSource.includes("shownGames.map(watchComponentCountValue).join(\",\")") &&
      tonightsMustWatchSource.includes("data-watch-component-count={watchComponentCountValue()}") &&
      !tonightsMustWatchSource.includes("shownGames.map(() => String(WATCH_COMPONENT_KEYS.length)).join(\",\")") &&
      !tonightsMustWatchSource.includes("data-watch-component-count={items.length}"),
    "upcoming watch-component count telemetry must share one component-count helper across section and card groups",
  );
  assert(
    tonightsMustWatchSource.includes("function watchComponentKeysValue()") &&
      countOccurrences(tonightsMustWatchSource, "function watchComponentKeysValue()") === 1 &&
      tonightsMustWatchSource.includes('return WATCH_COMPONENT_KEYS.join("/");') &&
      tonightsMustWatchSource.includes("shownGames.map(watchComponentKeysValue).join(\",\")") &&
      tonightsMustWatchSource.includes("data-watch-component-keys={watchComponentKeysValue()}") &&
      !tonightsMustWatchSource.includes('shownGames.map(() => WATCH_COMPONENT_KEYS.join("/")).join(",")') &&
      !tonightsMustWatchSource.includes('data-watch-component-keys={items.map((item) => item.key).join("/")}'),
    "upcoming watch-component key telemetry must share one ordered key helper across section and card groups",
  );
  assert(
    tonightsMustWatchSource.includes("function watchComponentLabelsValue()") &&
      countOccurrences(tonightsMustWatchSource, "function watchComponentLabelsValue()") === 1 &&
      tonightsMustWatchSource.includes('return WATCH_COMPONENT_LABELS.join("/");') &&
      tonightsMustWatchSource.includes("shownGames.map(watchComponentLabelsValue).join(\"|\")") &&
      tonightsMustWatchSource.includes("data-watch-component-labels={watchComponentLabelsValue()}") &&
      !tonightsMustWatchSource.includes('shownGames.map(() => WATCH_COMPONENT_LABELS.join("/")).join("|")') &&
      !tonightsMustWatchSource.includes('data-watch-component-labels={items.map((item) => item.label).join("/")}'),
    "upcoming watch-component label telemetry must share one ordered label helper across section and card groups",
  );
  assert(
    tonightsMustWatchSource.includes("function watchComponentValuesValue(game: TonightGame)") &&
      countOccurrences(tonightsMustWatchSource, "function watchComponentValuesValue(game: TonightGame)") === 1 &&
      tonightsMustWatchSource.includes("[game.watchComponents.topArm, game.watchComponents.pairing, game.matchupScore].map((value) => value.toFixed(WATCH_SCORE_PRECISION)).join(\"/\")") &&
      tonightsMustWatchSource.includes("shownGames.map(watchComponentValuesValue).join(\",\")") &&
      tonightsMustWatchSource.includes("data-watch-component-values={watchComponentValuesValue(game)}") &&
      !tonightsMustWatchSource.includes('data-watch-component-values={items.map((item) => item.value.toFixed(1)).join("/")}'),
    "upcoming watch-component value telemetry must share one ordered value helper across section and card groups",
  );
  assert(
    tonightsMustWatchSource.includes("function watchComponentDetailsValue(game: TonightGame, rankLabel: string)") &&
      countOccurrences(tonightsMustWatchSource, "function watchComponentDetailsValue(game: TonightGame, rankLabel: string)") === 1 &&
      tonightsMustWatchSource.includes("return watchComponentDetails(game, rankLabel).join(\"/\");") &&
      tonightsMustWatchSource.includes("shownGames.map((game) => watchComponentDetailsValue(game, rankLabel)).join(\",\")") &&
      tonightsMustWatchSource.includes("data-watch-component-details={watchComponentDetailsValue(game, rankLabel)}") &&
      !tonightsMustWatchSource.includes("shownGames.map((game) => watchComponentDetails(game, rankLabel).join(\"/\")).join(\",\")") &&
      !tonightsMustWatchSource.includes("data-watch-component-details={items.map((item) => item.detail).join(\"/\")}"),
    "upcoming watch-component detail telemetry must share one detail value helper across section and card groups",
  );
  assert(
    tonightsMustWatchSource.includes("function watchComponentItemAriaLabelsValue(game: TonightGame, rankLabel: string)") &&
      countOccurrences(tonightsMustWatchSource, "function watchComponentItemAriaLabelsValue(game: TonightGame, rankLabel: string)") === 1 &&
      tonightsMustWatchSource.includes("return watchComponentItemAriaLabels(game, rankLabel).join(\"/\");") &&
      tonightsMustWatchSource.includes("shownGames.map((game) => watchComponentItemAriaLabelsValue(game, rankLabel)).join(\"|\")") &&
      tonightsMustWatchSource.includes("data-watch-component-item-aria-labels={watchComponentItemAriaLabelsValue(game, rankLabel)}") &&
      !tonightsMustWatchSource.includes("shownGames.map((game) => watchComponentItemAriaLabels(game, rankLabel).join(\"/\")).join(\"|\")") &&
      !tonightsMustWatchSource.includes("data-watch-component-item-aria-labels={items.map((item) => item.ariaLabel).join(\"/\")}"),
    "upcoming watch-component item aria telemetry must share one aria value helper across section and card groups",
  );
  assert(
    tonightsMustWatchSource.includes("function watchComponentsAriaLabelValue(game: TonightGame)") &&
      countOccurrences(tonightsMustWatchSource, "function watchComponentsAriaLabelValue(game: TonightGame)") === 1 &&
      tonightsMustWatchSource.includes("return watchComponentsAriaLabel(game);") &&
      tonightsMustWatchSource.includes("shownGames.map(watchComponentsAriaLabelValue).join(\"|\")") &&
      tonightsMustWatchSource.includes("data-watch-component-aria-label={watchComponentsAriaLabelValue(game)}") &&
      tonightsMustWatchSource.includes("aria-label={watchComponentsAriaLabelValue(game)}") &&
      !tonightsMustWatchSource.includes("shownGames.map((game) => watchComponentsAriaLabel(game)).join(\"|\")") &&
      !tonightsMustWatchSource.includes("data-watch-component-aria-label={watchComponentsAriaLabel(game)}") &&
      !tonightsMustWatchSource.includes("aria-label={watchComponentsAriaLabel(game)}"),
    "upcoming watch-component group aria labels must share one value helper across section telemetry and card groups",
  );
  assert(
    tonightsMustWatchSource.includes("function watchComponentSectionLayout(index: number)") &&
      countOccurrences(tonightsMustWatchSource, "function watchComponentSectionLayout(index: number)") === 1 &&
      tonightsMustWatchSource.includes('return watchComponentLayout(index === 0 ? "featured" : "compact");') &&
      tonightsMustWatchSource.includes("shownGames.map((_, index) => watchComponentSectionLayout(index)).join(\",\")") &&
      tonightsMustWatchSource.includes('const layout = watchComponentLayout(featured ? "featured" : compact ? "compact" : "standard");') &&
      !tonightsMustWatchSource.includes('shownGames.map((_, index) => watchComponentLayout(index === 0 ? "featured" : "compact")).join(",")'),
    "upcoming watch-component layout telemetry must share one section-layout helper before card group rendering",
  );
  assert(
    tonightsMustWatchSource.includes("function watchHookReasonValue(game: TonightGame, rankLabel: string)") &&
      countOccurrences(tonightsMustWatchSource, "function watchHookReasonValue(game: TonightGame, rankLabel: string)") === 1 &&
      tonightsMustWatchSource.includes("return watchHookReason(game, rankLabel);") &&
      tonightsMustWatchSource.includes("function watchHookReasonKeyValue(game: TonightGame, rankLabel: string)") &&
      countOccurrences(tonightsMustWatchSource, "function watchHookReasonKeyValue(game: TonightGame, rankLabel: string)") === 1 &&
      tonightsMustWatchSource.includes("return watchHookReasonKey(game, rankLabel);") &&
      tonightsMustWatchSource.includes("shownGames.map((game) => watchHookReasonKeyValue(game, rankLabel)).join(\",\")") &&
      tonightsMustWatchSource.includes("shownGames.map((game) => watchHookReasonValue(game, rankLabel)).join(\"|\")") &&
      tonightsMustWatchSource.includes("const reason = watchHookReasonValue(game, rankLabel);") &&
      tonightsMustWatchSource.includes("const reasonKey = watchHookReasonKeyValue(game, rankLabel);") &&
      !tonightsMustWatchSource.includes("shownGames.map((game) => watchHookReasonKey(game, rankLabel)).join(\",\")") &&
      !tonightsMustWatchSource.includes("shownGames.map((game) => watchHookReason(game, rankLabel)).join(\"|\")"),
    "upcoming watch-hook reason telemetry and panel state must share one reason/key value helper pair",
  );
  assert(
      upcomingDatePageSource.includes("const controlsEmpty = visibleGameCount === 0;") &&
      upcomingDatePageSource.includes("data-control-empty={String(controlsEmpty)}"),
    "upcoming filter controls must expose empty-result state derived from visible game count",
  );
  assert(
    upcomingDatePageSource.includes("const hiddenGameCount = Math.max(0, scheduledGameCount - visibleGameCount);") &&
      upcomingDatePageSource.includes("data-control-hidden-games={hiddenGameCount}"),
    "upcoming filter controls must expose hidden game count derived from scheduled minus visible games",
  );
  assert(
    countOccurrences(upcomingDatePageSource, "data-control-hidden-games={hiddenGameCount}") === 1,
    "upcoming filter controls must expose exactly one hidden game count telemetry hook",
  );
  assert(
    upcomingDatePageSource.includes("visibleGameCount={visibleUpcoming.games.length}") &&
      upcomingDatePageSource.includes("scheduledGameCount={upcoming.scheduledGames}") &&
      upcomingWeekPageSource.includes("visibleGameCount={visibleGameCount}") &&
      upcomingWeekPageSource.includes("scheduledGameCount={scheduledGameCount}"),
    "upcoming filter controls must receive visible and scheduled game counts from both day and week surfaces",
  );
  assert(
    upcomingDatePageSource.includes("const activeControlCount = 2;") &&
      countOccurrences(upcomingDatePageSource, "<ControlGroup label=") === 2 &&
      countOccurrences(upcomingDatePageSource, "data-control-active-count={activeControlCount}") === 1,
    "upcoming filter controls must expose exactly one active-count telemetry hook for the Status and Sort groups",
  );
  assert(
    upcomingDatePageSource.includes("data-control-label={controlsLabel}"),
    "upcoming filter controls must expose the normalized visible label as stable telemetry",
  );
  assert(
    upcomingDatePageSource.includes("if (controls.pregameOnly) params.set(\"pregame\", \"1\");") &&
      upcomingDatePageSource.includes('if (controls.sort !== "watch") params.set("sort", controls.sort);') &&
      upcomingDatePageSource.includes('return `${basePath}${query ? `?${query}` : ""}`;'),
    "upcoming filter controls must keep canonical query links that omit default all-status/watch-rank state",
  );
  assert(
    upcomingDatePageSource.includes('slateRange: "day" | "week";') &&
      upcomingDatePageSource.includes("data-slate-range={slateRange}") &&
      upcomingDatePageSource.includes('slateRange="day"') &&
      upcomingWeekPageSource.includes('slateRange="week"'),
    "upcoming filter controls must expose whether they are rendering the day or week slate range",
  );
  assert(html.includes('data-responsive-check="upcoming-controls"'), `${route} should render the upcoming filter controls`);
  assert(
    elementWithTextHasAttributes(html, "summary", { "aria-label": expectedLabel }, expectedLabel),
    `${route} should expose the current upcoming filter state on the controls summary`,
  );
  assert(
    elementHasAttributes(html, "details", {
      "data-responsive-check": "upcoming-controls",
      "data-control-label": expectedLabel,
    }),
    `${route} should expose the current upcoming filter state on controls telemetry`,
  );
  const expectedControls = controlsFromLabel(expectedLabel);
  const expectedSlateRange = route.startsWith("/upcoming/week") ? "week" : "day";
  assert(
    elementHasAttributes(html, "details", {
      "data-responsive-check": "upcoming-controls",
      "data-slate-range": expectedSlateRange,
      "data-control-key": `${expectedControls.pregameOnly ? "pregame" : "all"}-${expectedControls.sort}`,
      "data-control-pregame": String(expectedControls.pregameOnly),
      "data-control-sort": expectedControls.sort,
    }),
    `${route} should expose normalized upcoming controls state and slate range`,
  );
  assert(
    !html.includes('data-control-team=') && !html.includes(">All teams<"),
    `${route} should not render team filtering in upcoming controls; use Heat Check team filters instead`,
  );
  const renderedVisibleGames = Number(elementAttributeValue(html, "details", { "data-responsive-check": "upcoming-controls" }, "data-control-visible-games"));
  const renderedScheduledGames = Number(elementAttributeValue(html, "details", { "data-responsive-check": "upcoming-controls" }, "data-control-scheduled-games"));
  assert(
    Number.isInteger(renderedVisibleGames) &&
      renderedVisibleGames >= 0 &&
      Number.isInteger(renderedScheduledGames) &&
      renderedScheduledGames >= renderedVisibleGames,
    `${route} should expose valid visible and scheduled game counts on the upcoming controls`,
  );
  assert(
    elementAttributeValue(html, "details", { "data-responsive-check": "upcoming-controls" }, "data-control-empty") === String(renderedVisibleGames === 0),
    `${route} should expose control empty-state telemetry that matches visible game count`,
  );
  assert(
    Number(elementAttributeValue(html, "details", { "data-responsive-check": "upcoming-controls" }, "data-control-hidden-games")) === Math.max(0, renderedScheduledGames - renderedVisibleGames),
    `${route} should expose hidden-game telemetry that matches scheduled minus visible games`,
  );
  assert(
    elementAttributeValue(html, "details", { "data-responsive-check": "upcoming-controls" }, "data-control-active-count") === "2",
    `${route} should expose exactly one active upcoming control per group`,
  );
  assert(
    activeUpcomingControlLinkCount(html) === 2,
    `${route} should render exactly two active upcoming control links; rendered controls: ${controlAnchorSummary(html)}`,
  );
  assert(
    activeUpcomingControlCurrentLinkCount(html) === 2,
    `${route} should expose native current-state semantics on the two active upcoming control links; rendered controls: ${controlAnchorSummary(html)}`,
  );
  assert(
    upcomingFastFilterLinkCount(html) === 4,
    `${route} should render all four upcoming filter controls as fast no-scroll links; rendered controls: ${controlAnchorSummary(html)}`,
  );
  assertUpcomingControlLinkKeys(html, route);
  if (linkExpectations) {
    assert(
      elementHasAttributes(html, "details", {
        "data-responsive-check": "upcoming-controls",
        "data-control-base-path": linkExpectations.basePath,
      }),
      `${route} should expose upcoming controls base path ${linkExpectations.basePath}`,
    );
    assertUpcomingControlLinks(html, route, linkExpectations);
    if (linkExpectations.counts && !linkExpectations.allowCountDrift) {
      assert(
        renderedVisibleGames === linkExpectations.counts.visibleGames &&
          renderedScheduledGames === linkExpectations.counts.scheduledGames,
        `${route} should pin upcoming controls result counts to ${linkExpectations.counts.visibleGames}/${linkExpectations.counts.scheduledGames}`,
      );
    } else if (linkExpectations.counts?.scheduledGames !== undefined) {
      assert(
        renderedScheduledGames <= linkExpectations.counts.scheduledGames,
        `${route} should keep live-adjusted scheduled count within the refreshed slate size`,
      );
    }
  }
}

function activeUpcomingControlLinkCount(html) {
  const controlMatch = html.match(/<details\b(?=[^>]*data-responsive-check="upcoming-controls")[^>]*>.*?<\/details>/s);
  const controlHtml = controlMatch?.[0] ?? html;
  const scopedCount = (controlHtml.match(/<a\b(?=[^>]*data-control-link-active="true")[^>]*>/g) ?? []).length;
  return scopedCount >= 2 ? scopedCount : (html.match(/<a\b(?=[^>]*data-control-link-active="true")[^>]*>/g) ?? []).length;
}

function activeUpcomingControlCurrentLinkCount(html) {
  const controlMatch = html.match(/<details\b(?=[^>]*data-responsive-check="upcoming-controls")[^>]*>.*?<\/details>/s);
  const controlHtml = controlMatch?.[0] ?? html;
  const scopedCount = (controlHtml.match(/<a\b(?=[^>]*data-control-link-active="true")(?=[^>]*aria-current="location")[^>]*>/g) ?? []).length;
  return scopedCount >= 2 ? scopedCount : (html.match(/<a\b(?=[^>]*data-control-link-active="true")(?=[^>]*aria-current="location")[^>]*>/g) ?? []).length;
}

function upcomingFastFilterLinkCount(html) {
  const controlMatch = html.match(/<details\b(?=[^>]*data-responsive-check="upcoming-controls")[^>]*>.*?<\/details>/s);
  const controlHtml = controlMatch?.[0] ?? html;
  const scopedCount = (controlHtml.match(/<a\b(?=[^>]*data-fast-filter-link)[^>]*>/g) ?? []).length;
  return scopedCount >= 4 ? scopedCount : (html.match(/<a\b(?=[^>]*data-fast-filter-link)[^>]*>/g) ?? []).length;
}

function assertUpcomingControlLinkKeys(html, route) {
  const controlMatch = html.match(/<details\b(?=[^>]*data-responsive-check="upcoming-controls")[^>]*>.*?<\/details>/s);
  const controlHtml = controlMatch?.[0] ?? html;
  for (const key of UPCOMING_CONTROL_LINK_KEYS) {
    const scopedCount = (controlHtml.match(new RegExp(`<a\\b(?=[^>]*data-control-link-key="${key}")[^>]*>`, "g")) ?? []).length;
    const count = scopedCount === 1 ? scopedCount : (html.match(new RegExp(`<a\\b(?=[^>]*data-control-link-key="${key}")[^>]*>`, "g")) ?? []).length;
    assert(count === 1, `${route} should render exactly one upcoming control link key ${key}; rendered controls: ${controlAnchorSummary(html)}`);
  }
}

function controlsFromLabel(label) {
  const parts = label.split(" / ");
  return {
    pregameOnly: parts[1] === "Pregame only",
    sort: parts[2] === "Start time" ? "time" : "watch",
  };
}

function assertUpcomingControlLinks(html, route, { basePath, controls }) {
  const expectedLinks = [
    ["All games", upcomingControlHrefForContract(basePath, { ...controls, pregameOnly: false })],
    ["Pregame only", upcomingControlHrefForContract(basePath, { ...controls, pregameOnly: true })],
    ["Watch rank", upcomingControlHrefForContract(basePath, { ...controls, sort: "watch" })],
    ["Start time", upcomingControlHrefForContract(basePath, { ...controls, sort: "time" })],
  ];
  expectedLinks.forEach(([label, href]) => {
    assert(
      anchorWithTextHasAttributes(html, label, { href }),
      `${route} should render ${label} filter control link to ${href}; rendered controls: ${controlAnchorSummary(html)}`,
    );
  });
}

function controlAnchorSummary(html) {
  const controlMatch = html.match(/<details\b(?=[^>]*data-responsive-check="upcoming-controls")[^>]*>.*?<\/details>/s);
  const controlHtml = controlMatch?.[0] ?? html;
  return (controlHtml.match(/<a\b[^>]*>.*?<\/a>/gs) ?? [])
    .map((anchor) => {
      const href = anchor.match(/\bhref="([^"]*)"/)?.[1] ?? "no-href";
      return `${normalizeHtmlText(anchor)}=>${href}`;
    })
    .join(" | ");
}

function upcomingControlHrefForContract(basePath, controls) {
  const params = new URLSearchParams();
  if (controls.pregameOnly) params.set("pregame", "1");
  if (controls.sort !== "watch") params.set("sort", controls.sort);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function anchorHasAttributes(html, attributes) {
  const anchors = html.match(/<a\b[^>]*>/g) ?? [];
  return anchors.some((anchor) =>
    Object.entries(attributes).every(([name, value]) => anchor.includes(`${name}="${escapeHtmlAttribute(value)}"`)),
  );
}

function anchorHrefWithAttributes(html, attributes) {
  const anchors = html.match(/<a\b[^>]*>/g) ?? [];
  const anchor = anchors.find((candidate) =>
    Object.entries(attributes).every(([name, value]) => candidate.includes(`${name}="${escapeHtmlAttribute(value)}"`)),
  );
  return anchor?.match(/\bhref="([^"]*)"/)?.[1] ?? null;
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

function anchorHrefWithText(html, text) {
  const anchors = html.match(/<a\b[^>]*>.*?<\/a>/gs) ?? [];
  for (const anchor of anchors) {
    if (!normalizeHtmlText(anchor).includes(text)) continue;
    const href = anchor.match(/\bhref="([^"]*)"/)?.[1];
    if (href) return href;
  }
  return null;
}

function sharedHeadshotImageMatches(html, pitcherId) {
  const images = html.match(/<img\b[^>]*>/g) ?? [];
  return images.some((image) => {
    const width = image.match(/\bwidth="([^"]*)"/)?.[1] ?? null;
    const height = image.match(/\bheight="([^"]*)"/)?.[1] ?? null;
    return (
      image.includes('class="headshot__img relative z-10"') &&
      image.includes(`/people/${pitcherId}/headshot/67/current`) &&
      image.includes('alt=""') &&
      ["120", "240"].includes(width ?? "") &&
      width === height
    );
  });
}

function divHasAttributes(html, attributes) {
  const divs = html.match(/<div\b[^>]*>/g) ?? [];
  return divs.some((div) =>
    Object.entries(attributes).every(([name, value]) => div.includes(`${name}="${escapeHtmlAttribute(value)}"`)),
  );
}

function sectionHtmlById(html, sectionId) {
  const escapedSectionId = escapeRegExp(escapeHtmlAttribute(sectionId));
  const sections = Array.from(html.matchAll(new RegExp(`<section\\b(?=[^>]*id="${escapedSectionId}")[^>]*>.*?<\\/section>`, "gs"))).map(
    (match) => match[0],
  );
  const section = sections.find((candidate) => candidate.includes(`id="${escapeHtmlAttribute(`${sectionId}-heading`)}"`)) ?? sections[0] ?? null;
  if (!section) return null;

  const suspendedSegmentId = section.match(/<template id="P:([^"]+)"><\/template>/)?.[1];
  if (!suspendedSegmentId) return section;

  const escapedSegmentId = escapeRegExp(suspendedSegmentId);
  const segment = html.match(new RegExp(`<div hidden id="S:${escapedSegmentId}">.*?<script>\\$RS\\("S:${escapedSegmentId}","P:${escapedSegmentId}"\\)<\\/script>`, "s"))?.[0];
  return segment ? `${section}${segment}` : section;
}

function countDivsWithAttributes(html, attributes) {
  const divs = html.match(/<div\b[^>]*>/g) ?? [];
  return divs.filter((div) =>
    Object.entries(attributes).every(([name, value]) => div.includes(`${name}="${escapeHtmlAttribute(value)}"`)),
  ).length;
}

function elementAttributeValue(html, tagName, attributes, attributeName) {
  const elements = html.match(new RegExp(`<${tagName}\\b[^>]*>`, "g")) ?? [];
  const element = elements.find((candidate) =>
    Object.entries(attributes).every(([name, value]) => candidate.includes(`${name}="${escapeHtmlAttribute(value)}"`)),
  );
  return element?.match(new RegExp(`${attributeName}="([^"]*)"`))?.[1] ?? null;
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

function spanHasSupportedHeadshotMetadata(html) {
  const spans = html.match(/<span\b[^>]*>/g) ?? [];
  return spans.some((span) => {
    const band = span.match(/\bdata-form-band="([^"]*)"/)?.[1] ?? null;
    const size = span.match(/\bdata-headshot-size="([^"]*)"/)?.[1] ?? null;
    const status = span.match(/\bdata-starter-status="([^"]*)"/)?.[1] ?? null;
    return [...FORM_TIER_KEYS, "neutral"].includes(band ?? "") && ["sm", "xl"].includes(size ?? "") && ["ok", "insufficient", "tbd"].includes(status ?? "");
  });
}

function starterGroupHasSupportedMetadata(html, starter, options = {}) {
  const divs = html.match(/<div\b[^>]*>/g) ?? [];
  return divs.some((div) => {
    if (!div.includes('role="group"')) return false;
    if (!options.allowIdentityDrift) {
      if (tagAttribute(div, "data-starter-side") !== starter.side) return false;
      if (tagAttribute(div, "data-starter-team") !== starter.team) return false;
    } else {
      if (!["home", "away"].includes(tagAttribute(div, "data-starter-side") ?? "")) return false;
      if (!assertNonEmptyStringValue(tagAttribute(div, "data-starter-team"))) return false;
    }

    const status = tagAttribute(div, "data-starter-status");
    const formStatus = tagAttribute(div, "data-starter-form-status");
    const pitcherId = tagAttribute(div, "data-starter-pitcher-id");
    const name = tagAttribute(div, "data-starter-name");
    const formHref = tagAttribute(div, "data-starter-form-href");
    const nameLinked = tagAttribute(div, "data-starter-name-linked");
    const fallbackLabel = tagAttribute(div, "data-starter-fallback-label");
    const accentSource = tagAttribute(div, "data-starter-accent-source");
    const accentBand = tagAttribute(div, "data-starter-accent-band");
    const accentColor = tagAttribute(div, "data-starter-accent-color");

    if (options.allowIdentityDrift) {
      return (
        ["ok", "insufficient", "tbd"].includes(status ?? "") &&
        Boolean(name) &&
        (pitcherId === "tbd" || /^\d+$/.test(pitcherId ?? "")) &&
        (formHref === "none" || starterFormHrefMatches(formHref, pitcherId)) &&
        ["true", "false"].includes(nameLinked ?? "") &&
        ["ok", "cold_start", "mlb_debut", "join_gap", "tbd"].includes(formStatus ?? "") &&
        ["cold_start", "mlb_debut", "join_gap", "none"].includes(tagAttribute(div, "data-starter-limited-reason") ?? "") &&
        /^\d+\/\d+\/(\d+|unknown)$|^none$/.test(tagAttribute(div, "data-starter-form-completeness") ?? "") &&
        ["form-band", "neutral", "mlb-debut"].includes(accentSource ?? "") &&
        [...FORM_TIER_KEYS, "neutral"].includes(accentBand ?? "") &&
        /^#[0-9A-Fa-f]{6}$/.test(accentColor ?? "")
      );
    }

    return (
      ["ok", "insufficient", "tbd"].includes(status ?? "") &&
      Boolean(name) &&
      (pitcherId === "tbd" || /^\d+$/.test(pitcherId ?? "")) &&
      (formHref === "none" || starterFormHrefMatches(formHref, pitcherId)) &&
      ["true", "false"].includes(nameLinked ?? "") &&
      ["none", "Limited form sample / baseline projection", "Form pending", "MLB debut", "Starter unconfirmed. Score uses league baseline."].includes(fallbackLabel ?? "") &&
      ["ok", "cold_start", "mlb_debut", "join_gap", "tbd"].includes(formStatus ?? "") &&
      ["cold_start", "mlb_debut", "join_gap", "none"].includes(tagAttribute(div, "data-starter-limited-reason") ?? "") &&
      /^\d+\/\d+\/(\d+|unknown)$|^none$/.test(tagAttribute(div, "data-starter-form-completeness") ?? "") &&
      ["form-band", "neutral", "mlb-debut"].includes(accentSource ?? "") &&
      [...FORM_TIER_KEYS, "neutral"].includes(accentBand ?? "") &&
      /^#[0-9A-Fa-f]{6}$/.test(accentColor ?? "") &&
      ["pending", "unknown", "short", "normal", "extended"].includes(tagAttribute(div, "data-starter-rest-label") ?? "") &&
      ["true", "false"].includes(tagAttribute(div, "data-starter-limited-sample") ?? "") &&
      ["true", "false"].includes(tagAttribute(div, "data-starter-rust") ?? "")
    );
  });
}

function tagAttribute(tag, name) {
  return tag.match(new RegExp(`\\b${escapeRegExp(name)}="([^"]*)"`))?.[1] ?? null;
}

function linkHrefCounts(html, expectedHrefs) {
  const counts = new Map(expectedHrefs.map((href) => [href, 0]));
  const anchors = html.match(/<a\b[^>]*>/g) ?? [];
  anchors.forEach((anchor) => {
    const href = tagAttribute(anchor, "href");
    if (href && counts.has(href)) counts.set(href, (counts.get(href) ?? 0) + 1);
  });
  return counts;
}

function divAttributeValues(html, attributeName, requiredAttributes = {}) {
  const divs = html.match(/<div\b[^>]*>/g) ?? [];
  return divs
    .filter((div) =>
      Object.entries(requiredAttributes).every(([name, value]) => div.includes(`${name}="${escapeHtmlAttribute(value)}"`)),
    )
    .map((div) => tagAttribute(div, attributeName))
    .filter((value) => value !== null);
}

function watchCardHasSupportedIdentityMetadata(html, gamePk, summaryId, rankLabel) {
  const article = html.match(/<article\b[^>]*>/)?.[0] ?? "";
  const attr = (name) => tagAttribute(article, name);
  return (
    attr("data-game-pk") === gamePk &&
    /^\d{4}-\d{2}-\d{2}$/.test(attr("data-game-date") ?? "") &&
    ACTIVE_CARD_STATUSES.includes(attr("data-game-status")) &&
    assertNonEmptyStringValue(attr("data-game-detailed-state")) &&
    assertNonEmptyStringValue(attr("data-away-team")) &&
    assertNonEmptyStringValue(attr("data-away-team-name")) &&
    assertNonEmptyStringValue(attr("data-home-team")) &&
    assertNonEmptyStringValue(attr("data-home-team-name")) &&
    assertNonEmptyStringValue(attr("data-matchup-label")) &&
    assertNonEmptyStringValue(attr("data-first-pitch")) &&
    assertNonEmptyStringValue(attr("data-venue")) &&
    ["true", "false"].includes(attr("data-has-tbd") ?? "") &&
    ["true", "false"].includes(attr("data-limited-form") ?? "") &&
    ["true", "false"].includes(attr("data-cold-start-form") ?? "") &&
    ["true", "false"].includes(attr("data-join-gap-form") ?? "") &&
    ["HIGH", "LOW", "NONE"].includes(attr("data-matchup-confidence") ?? "") &&
    attr("data-watch-rank-label") === expectedWatchRankLabelValue(rankLabel) &&
    assertNonEmptyStringValue(attr("aria-label")) &&
    attr("aria-describedby") === summaryId
  );
}

function assertNonEmptyStringValue(value) {
  return typeof value === "string" && value.length > 0;
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
  const normalized = normalizeHtmlText(html);
  if (!bestGame) {
    assert(
      !normalized.includes("Week's must-watch"),
      `${route} should not render a weekly must-watch callout when there are no active games to feature`,
    );
    return;
  }
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
    upcomingWeekPageSource.includes('data-responsive-check="upcoming-week-feature"') &&
      upcomingWeekPageSource.includes("data-feature-date={bestGame.day}") &&
      upcomingWeekPageSource.includes("data-feature-game-id={bestGame.game.gamePk}") &&
      upcomingWeekPageSource.includes("data-feature-watch-score={bestGame.game.gameWatchScore}") &&
      upcomingWeekPageSource.includes('data-feature-rank="1"'),
    "weekly upcoming must-watch CTA must keep stable source-pinned feature telemetry",
  );
  assert(
    upcomingWeekPageSource.includes("const filteredDays = upcoming.days.map((day) => ({ ...day, games: filterAndSortGames(day.games, controls) }));") &&
      upcomingWeekPageSource.includes("const visibleGameCount = filteredDays.reduce((count, day) => count + day.games.length, 0);") &&
      upcomingWeekPageSource.includes("{filteredDays.map((day) => (") &&
      upcomingWeekPageSource.includes("tonight={day}"),
    "weekly upcoming page must derive filtered day games once and render the same filtered data used for counts",
  );
  for (const featureTelemetry of [
    'data-responsive-check="upcoming-week-feature"',
    "data-feature-date={bestGame.day}",
    "data-feature-game-id={bestGame.game.gamePk}",
    "data-feature-watch-score={bestGame.game.gameWatchScore}",
    'data-feature-rank="1"',
  ]) {
    assert(
      countOccurrences(upcomingWeekPageSource, featureTelemetry) === 1,
      `weekly upcoming must-watch CTA must expose exactly one ${featureTelemetry} source hook`,
    );
  }
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

function assertUpcomingPageHeader(html, route) {
  const normalized = normalizeHtmlText(html);
  assert(normalized.includes("Upcoming Matchups"), `${route} should render the shortened Upcoming Matchups page title`);
  assert(!normalized.includes("Upcoming Starting Matchups"), `${route} should not render the redundant Starting page title`);
  assert(
    normalized.includes("One card per game, ranked by starter form and matchup context."),
    `${route} should render the trimmed one-line upcoming subhead`,
  );
  assert(
    !normalized.includes("Probables are grouped head-to-head instead of duplicated by pitcher"),
    `${route} should not document the self-evident head-to-head layout`,
  );
  assertUpcomingHeaderSpacing(route);
  assert(html.includes('data-responsive-check="upcoming-slate-stamp"'), `${route} should render the state-aware upcoming slate stamp`);
  assert(
    upcomingDatePageSource.includes("function formatUpcomingStampDate") &&
      upcomingDatePageSource.includes('month: "long"') &&
      !upcomingDatePageSource.includes("`Today · ${formatUpcomingDate(state.date)} · first starter"),
    "upcoming slate stamp must use full month names instead of abbreviated month text",
  );
  assert(
    upcomingDatePageSource.includes('<span className="block sm:inline">{dayLabel} · {dateLabel}</span>') &&
      upcomingDatePageSource.includes('<span className="hidden sm:inline"> · </span>') &&
      upcomingDatePageSource.includes('<span className="mt-1 block sm:mt-0 sm:inline">{firstStarterLabel}</span>'),
    "upcoming slate stamp must force the first-starter phrase onto a new line on mobile",
  );
}

function assertUpcomingHeaderSpacing(route) {
  const source = route.startsWith("/upcoming/week") ? upcomingWeekPageSource : upcomingDatePageSource;
  assert(
    source.includes('<header className="mb-3 pb-3">') && !source.includes('<header className="mb-6 pb-6">'),
    `${route} should keep the upcoming controls close to the matchup board`,
  );
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertRenderedWatchCards(html, route, games, rankLabel, sectionId = "must-watch", scheduledGames = games.length, expectedLeagueMeanGS = null) {
  const headingId = `${sectionId}-heading`;
  const expectedSlateDate = games[0]?.date ?? (sectionId.startsWith("must-watch-") ? sectionId.replace("must-watch-", "") : null);
  const expectedFormWindow = expectedRenderedFormWindow(route);
  const allowLiveSectionCountDrift = allowsRenderedLiveDataDrift(route);
  const sectionAttributes = {
    id: sectionId,
    "aria-labelledby": headingId,
    "data-responsive-check": "must-watch",
    "data-scheduled-games": String(scheduledGames),
    "data-rank-label": rankLabel,
    "data-active-card-statuses": ACTIVE_CARD_STATUSES.join(","),
    "data-form-window": String(expectedFormWindow),
    "data-watch-weight-top-arm": String(WATCH_SCORE_WEIGHTS.topArm),
    "data-watch-weight-pairing": String(WATCH_SCORE_WEIGHTS.pairAvg),
    "data-watch-weight-matchup": String(WATCH_SCORE_WEIGHTS.matchup),
    "data-watch-sort-policy": WATCH_SORT_POLICY,
    "data-watch-score-min": String(WATCH_SCORE_RANGE.min),
    "data-watch-score-max": String(WATCH_SCORE_RANGE.max),
    "data-watch-score-precision": String(WATCH_SCORE_PRECISION),
    "data-matchup-score-min": "0",
    "data-matchup-score-max": "100",
  };
  if (!allowLiveSectionCountDrift) sectionAttributes["data-game-count"] = String(games.length);
  if (expectedSlateDate) sectionAttributes["data-slate-date"] = expectedSlateDate;
  assert(
    elementHasAttributes(html, "section", sectionAttributes),
    `${route} should render a labelled responsive watch-list section ${sectionId}`,
  );
  const sectionHtml = sectionHtmlById(html, sectionId);
  assert(sectionHtml, `${route} should render watch-list section ${sectionId}`);
  assertIsoTimestamp(
    elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-generated-at"),
    `${route} ${sectionId} rendered generatedAt`,
  );
  assertRenderedDateOrNone(
    elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-form-through-date"),
    `${route} ${sectionId} rendered formThroughDate`,
  );
  assertRenderedDateOrNone(
    elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-latest-scored-start-date"),
    `${route} ${sectionId} rendered latestScoredStartDate`,
  );
  assert(
    ["true", "false"].includes(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-form-data-stale") ?? ""),
    `${route} ${sectionId} should expose formDataStale as a boolean string`,
  );
  const renderedLeagueMeanGS = elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-league-mean-gs");
  assert(
    /^\d+\.\d$/.test(renderedLeagueMeanGS) && Number.isFinite(Number(renderedLeagueMeanGS)),
    `${route} ${sectionId} should expose a one-decimal rendered leagueMeanGS baseline`,
  );
  assert(
    expectedLeagueMeanGS === null || renderedLeagueMeanGS === expectedLeagueMeanGsValue(expectedLeagueMeanGS),
    `${route} ${sectionId} should expose the API leagueMeanGS baseline with public precision`,
  );
  const normalized = normalizeHtmlText(sectionHtml);
  assert(
    countOccurrences(sectionHtml, `id="${headingId}"`) === 1,
    `${route} should render exactly one watch-list heading id for ${sectionId}`,
  );
  assert(
    elementWithTextHasAttributes(sectionHtml, "h2", { id: headingId }, "Matchup Board"),
    `${route} should label watch-list section ${sectionId} as the matchup board`,
  );
  assert(
    normalized.includes("One card per game, ranked by starter form and matchup context."),
    `${route} should render the orient-only matchup board subhead`,
  );
  const renderedGameCount = Number(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-game-count"));
  const renderedGamePks = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-game-pks"));
  const renderedGameDates = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-game-dates"));
  const renderedMatchupLabels = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-matchup-labels"));
  const renderedTeamMatchups = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-team-matchups"));
  const renderedTeamNames = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-team-names"));
  const renderedVenues = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-venues"));
  const renderedFirstPitches = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-first-pitches"));
  const renderedGameStatuses = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-game-statuses"));
  const renderedDetailedStates = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-detailed-states"));
  const renderedCardAriaLabels = pipeAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-card-aria-labels"));
  const renderedSummaryStatusLabels = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-summary-status-labels"));
  const renderedSummaryIds = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-summary-ids"));
  const renderedSummaryAriaLabels = pipeAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-summary-aria-labels"));
  const renderedStarterSides = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-sides"));
  const renderedStarterStatuses = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-statuses"));
  const renderedStarterLimitedReasons = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-limited-reasons"));
  const renderedStarterFallbackLabels = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-fallback-labels"));
  const renderedStarterPitcherIds = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-pitcher-ids"));
  const renderedStarterNames = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-names"));
  const renderedStarterTeams = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-teams"));
  const renderedStarterFormHrefs = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-form-hrefs"));
  const renderedStarterNameLinkeds = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-name-linkeds"));
  const renderedStarterFormTiers = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-form-tiers"));
  const renderedStarterFormTrends = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-form-trends"));
  const renderedStarterFormScores = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-form-scores"));
  const renderedStarterDeltaForms = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-delta-forms"));
  const renderedStarterSparkCounts = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-spark-counts"));
  const renderedStarterSparkReadies = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-spark-readies"));
  const renderedStarterSparkReadyCounts = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-spark-ready-counts"));
  const renderedStarterSparkLatest = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-spark-latest"));
  const renderedStarterSeasonIp = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-season-ip"));
  const renderedStarterSeasonEra = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-season-era"));
  const renderedStarterSeasonWhip = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-season-whip"));
  const renderedStarterSeasonK9 = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-season-k9"));
  const renderedStarterWindowCounts = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-window-counts"));
  const renderedStarterLastStartDates = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-last-start-dates"));
  const renderedStarterLastStartGamePks = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-last-start-game-pks"));
  const renderedStarterLastStartOpponents = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-last-start-opponents"));
  const renderedStarterLastStartParks = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-last-start-parks"));
  const renderedStarterLastStartLines = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-last-start-lines"));
  const renderedStarterLastStartGs = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-last-start-gs"));
  const renderedStarterLastStartTiers = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-last-start-tiers"));
  const renderedStarterLastStartHrefs = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-last-start-hrefs"));
  const renderedStarterDriverCounts = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-driver-counts"));
  const renderedStarterVisibleDriverCounts = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-visible-driver-counts"));
  const renderedStarterTopDriverKeys = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-top-driver-keys"));
  const renderedStarterTopDriverLabels = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-top-driver-labels"));
  const renderedStarterTopDriverDirections = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-top-driver-directions"));
  const renderedStarterTopDriverDeltas = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-top-driver-deltas"));
  const renderedStarterTopDriverScores = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-top-driver-scores"));
  const renderedStarterAccentSources = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-accent-sources"));
  const renderedStarterAccentBands = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-accent-bands"));
  const renderedStarterAccentColors = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-accent-colors"));
  const renderedStarterMarketStatuses = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-market-statuses"));
  const renderedStarterMarketSources = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-market-sources"));
  const renderedStarterMarketLabels = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-market-labels"));
  const renderedStarterProjectionStatuses = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-projection-statuses"));
  const renderedStarterProjectionConfidences = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-projection-confidences"));
  const renderedStarterProjectionGs = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-projection-gs"));
  const renderedStarterProjectionInnings = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-projection-innings"));
  const renderedStarterProjectionStrikeouts = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-projection-strikeouts"));
  const renderedStarterProjectionEarnedRuns = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-projection-earned-runs"));
  const renderedStarterProjectionTokenCounts = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-projection-token-counts"));
  const renderedStarterOpponentSplitTeams = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-opponent-split-teams"));
  const renderedStarterOpponentSplits = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-opponent-splits"));
  const renderedStarterOpponentSplitLabels = doublePipeAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-opponent-split-labels"));
  const renderedStarterOpponentSplitOps = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-opponent-split-ops"));
  const renderedStarterOpponentSplitRunValues = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-opponent-split-run-values"));
  const renderedStarterRestLabels = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-rest-labels"));
  const renderedStarterDaysRest = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-days-rest"));
  const renderedStarterAvgPitchesLast5 = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-avg-pitches-last-5"));
  const renderedStarterAvgIpLast5 = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-avg-ip-last-5"));
  const renderedStarterLimitedSamples = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-limited-samples"));
  const renderedStarterRustFlags = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-rust-flags"));
  const renderedStarterStatusChipCounts = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-starter-status-chip-counts"));
  const renderedParkRunFactors = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-park-run-factors"));
  const renderedParkRunValues = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-park-run-values"));
  const renderedParkLabels = pipeAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-park-labels"));
  const renderedParkTones = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-park-tones"));
  const renderedWeatherSources = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-weather-sources"));
  const renderedWeatherRunValues = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-weather-run-values"));
  const renderedWeatherLabels = pipeAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-weather-labels"));
  const renderedWeatherTempF = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-weather-temp-f"));
  const renderedWeatherWindMph = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-weather-wind-mph"));
  const renderedWeatherPrecipProbabilities = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-weather-precip-probabilities"));
  const renderedWeatherTones = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-weather-tones"));
  const renderedWatchCardKinds = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-watch-card-kinds"));
  const renderedWatchRanks = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-watch-ranks"));
  const renderedWatchRankLabels = pipeAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-watch-rank-labels"));
  const renderedWatchScores = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-watch-scores"));
  const renderedWatchScoreLabels = pipeAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-watch-score-labels"));
  const renderedWatchTiers = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-watch-tiers"));
  const renderedWatchTierLabels = pipeAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-watch-tier-labels"));
  const renderedMatchupConfidences = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-matchup-confidences"));
  const renderedWatchSortGroups = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-watch-sort-groups"));
  const renderedWatchSortGroupLabels = pipeAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-watch-sort-group-labels"));
  const renderedWatchFlagKeys = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-watch-flag-keys"));
  const renderedWatchFlagLabels = pipeAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-watch-flag-labels"));
  const renderedComponentCounts = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-component-counts"));
  const renderedComponentKeys = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-component-keys"));
  const renderedComponentLayouts = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-component-layouts"));
  const renderedComponentLabels = pipeAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-component-labels"));
  const renderedComponentValues = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-component-values"));
  const renderedComponentTopArms = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-component-top-arms"));
  const renderedComponentPairings = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-component-pairings"));
  const renderedComponentMatchups = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-component-matchups"));
  const renderedComponentDetails = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-component-details"));
  const renderedComponentItemAriaLabels = pipeAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-component-item-aria-labels"));
  const renderedComponentAriaLabels = pipeAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-component-aria-labels"));
  const renderedMatchupRanks = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-matchup-ranks"));
  const renderedMatchupContextStatuses = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-matchup-context-statuses"));
  const renderedMatchupContextLabels = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-matchup-context-labels"));
  const renderedMatchupStatusLabels = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-matchup-status-labels"));
  const renderedHookReasonKeys = csvAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-hook-reason-keys"));
  const renderedHookReasons = pipeAttributeValues(elementAttributeValue(sectionHtml, "section", { id: sectionId }, "data-visible-hook-reasons"));
  assert(
    renderedGamePks.length === renderedGameCount && renderedGamePks.every((gamePk) => /^\d+$/.test(gamePk)),
    `${route} ${sectionId} should expose one numeric visible game id per rendered card; rendered count ${renderedGameCount}, ids ${renderedGamePks.join(",") || "none"}`,
  );
  assert(
    renderedGameDates.length === renderedGameCount && renderedGameDates.every((gameDate) => /^\d{4}-\d{2}-\d{2}$/.test(gameDate)),
    `${route} ${sectionId} should expose one visible game date per rendered card`,
  );
  assert(
    renderedMatchupLabels.length === renderedGameCount &&
      renderedMatchupLabels.every((label) => /^[A-Z0-9]{2,4} @ [A-Z0-9]{2,4}$/.test(label)),
    `${route} ${sectionId} should expose one public matchup label per rendered card`,
  );
  assert(
    renderedTeamMatchups.length === renderedGameCount &&
      renderedTeamMatchups.every((matchup) => /^[A-Z0-9]{2,4}@[A-Z0-9]{2,4}$/.test(matchup)),
    `${route} ${sectionId} should expose one visible away@home team matchup per rendered card`,
  );
  assert(
    renderedTeamNames.length === renderedGameCount &&
      renderedTeamNames.every((names) => names.split("/").length === 2 && names.split("/").every((name) => name.length > 0)),
    `${route} ${sectionId} should expose one visible away/home full-name team pair per rendered card`,
  );
  assert(
    renderedVenues.length === renderedGameCount && renderedVenues.every((venue) => venue.length > 0),
    `${route} ${sectionId} should expose one visible venue per rendered card`,
  );
  assert(
    renderedFirstPitches.length === renderedGameCount &&
      renderedFirstPitches.every((firstPitch) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(firstPitch)),
    `${route} ${sectionId} should expose one ISO visible first pitch per rendered card`,
  );
  assert(
    renderedGameStatuses.length === renderedGameCount &&
      renderedGameStatuses.every((status) => ACTIVE_CARD_STATUSES.includes(status) || status === "ppd"),
    `${route} ${sectionId} should expose one supported game status per visible game`,
  );
  assert(
    renderedDetailedStates.length === renderedGameCount &&
      renderedDetailedStates.every((state) => state.length > 0),
    `${route} ${sectionId} should expose one non-empty detailed state per visible game`,
  );
  assert(
    renderedCardAriaLabels.length === renderedGameCount &&
      renderedCardAriaLabels.every((label) => label.startsWith("Watch card for ") && !label.includes("|")),
    `${route} ${sectionId} should expose one accessible card label per visible game`,
  );
  assert(
    renderedSummaryStatusLabels.length === renderedGameCount &&
      renderedSummaryStatusLabels.every((label) => supportedGameStatusLabels().includes(label)),
    `${route} ${sectionId} should expose one supported public status summary label per visible game`,
  );
  assert(
    renderedSummaryIds.length === renderedGameCount &&
      renderedSummaryIds.every((id) => /^watch-card-\d+-summary$/.test(id)),
    `${route} ${sectionId} should expose one stable summary id per visible game`,
  );
  assert(
    renderedSummaryAriaLabels.length === renderedGameCount &&
      renderedSummaryAriaLabels.every((label) => label.length > 0 && !label.includes("|")),
    `${route} ${sectionId} should expose one accessible summary label per visible game`,
  );
  assert(
    renderedMatchupContextLabels.length === renderedGameCount &&
      renderedMatchupContextLabels.every((label) => label.length > 0),
    `${route} ${sectionId} should expose one public matchup context label per visible game`,
  );
  assert(
    renderedStarterSides.length === renderedGameCount &&
      renderedStarterSides.every((sides) => sides === "away/home"),
    `${route} ${sectionId} should expose one away/home starter side pair per visible game`,
  );
  assert(
    renderedStarterStatuses.length === renderedGameCount &&
      renderedStarterStatuses.every((statuses) => /^(ok|insufficient|tbd)\/(ok|insufficient|tbd)$/.test(statuses)),
    `${route} ${sectionId} should expose one away/home starter status pair per visible game`,
  );
  assert(
    renderedStarterLimitedReasons.length === renderedGameCount &&
      renderedStarterLimitedReasons.every((reasons) => /^(cold_start|mlb_debut|join_gap|none)\/(cold_start|mlb_debut|join_gap|none)$/.test(reasons)),
    `${route} ${sectionId} should expose one away/home starter limited-reason pair per visible game`,
  );
  assert(
    renderedStarterFallbackLabels.length === renderedGameCount &&
      renderedStarterFallbackLabels.every((labels) =>
        labels.split("|").length === 2 &&
        labels.split("|").every((label) => ["none", "Limited form sample / baseline projection", "Form pending", "MLB debut", "Starter unconfirmed. Score uses league baseline."].includes(label)),
      ),
    `${route} ${sectionId} should expose one away/home starter fallback label pair per visible game`,
  );
  assert(
    renderedStarterPitcherIds.length === renderedGameCount &&
      renderedStarterPitcherIds.every((ids) => /^(?:\d+|tbd)\/(?:\d+|tbd)$/.test(ids)),
    `${route} ${sectionId} should expose one away/home starter pitcher-id pair per visible game`,
  );
  assert(
    renderedStarterNames.length === renderedGameCount &&
      renderedStarterNames.every((names) => names.split("/").length === 2 && names.split("/").every((name) => name.length > 0)),
    `${route} ${sectionId} should expose one away/home starter name pair per visible game`,
  );
  assert(
    renderedStarterTeams.length === renderedGameCount &&
      renderedStarterTeams.every((teams) => /^[A-Z0-9]{2,4}\/[A-Z0-9]{2,4}$/.test(teams)),
    `${route} ${sectionId} should expose one away/home starter team pair per visible game`,
  );
  assert(
    renderedStarterFormHrefs.length === renderedGameCount &&
      renderedStarterFormHrefs.every((hrefs) => {
        const pair = hrefs.split("|");
        return pair.length === 2 && pair.every((href) => href === "none" || /^\/pitchers\/[a-z0-9-]+-\d+\?from=upcoming$/.test(href));
      }),
    `${route} ${sectionId} should expose one away/home starter Form href pair per visible game`,
  );
  assert(
    renderedStarterNameLinkeds.length === renderedGameCount &&
      renderedStarterNameLinkeds.every((flags) => /^(?:true|false)\/(?:true|false)$/.test(flags)),
    `${route} ${sectionId} should expose one away/home starter linked-name flag pair per visible game`,
  );
  const renderedStarterFormLinks = renderedStarterFormHrefs
    .flatMap((hrefs) => hrefs.split("|"))
    .filter((href) => href !== "none");
  const renderedStarterFormLinkCounts = linkHrefCounts(html, renderedStarterFormLinks);
  assert(
    renderedStarterFormLinks.every((href) => (renderedStarterFormLinkCounts.get(href) ?? 0) >= 1),
    `${route} ${sectionId} should render every source-aware starter Form href as an actual card link`,
  );
  assert(
    renderedStarterFormTiers.length === renderedGameCount &&
      renderedStarterFormTiers.every((tiers) => tiers.split("/").length === 2 && tiers.split("/").every((tier) => [...FORM_TIER_KEYS, "none"].includes(tier))) &&
      renderedStarterFormTrends.length === renderedGameCount &&
      renderedStarterFormTrends.every((trends) => trends.split("/").length === 2 && trends.split("/").every((trend) => ["heating", "steady", "cooling", "none"].includes(trend))) &&
      renderedStarterFormScores.length === renderedGameCount &&
      renderedStarterFormScores.every((scores) => scores.split("/").length === 2 && scores.split("/").every((score) => score === "pending" || /^-?\d+\.\d$/.test(score))) &&
      renderedStarterDeltaForms.length === renderedGameCount &&
      renderedStarterDeltaForms.every((values) => values.split("/").length === 2 && values.split("/").every((value) => value === "pending" || /^-?\d+\.\d$/.test(value))) &&
      renderedStarterSparkCounts.length === renderedGameCount &&
      renderedStarterSparkCounts.every((counts) => counts.split("/").length === 2 && counts.split("/").every((count) => /^\d+$/.test(count))) &&
      (renderedStarterSparkReadies.length === 0 ||
        (renderedStarterSparkReadies.length === renderedGameCount &&
          renderedStarterSparkReadies.every((readies) => /^(?:true|false)\/(?:true|false)$/.test(readies)))) &&
      (renderedStarterSparkReadyCounts.length === 0 ||
        (renderedStarterSparkReadyCounts.length === renderedGameCount &&
          renderedStarterSparkReadyCounts.every((count) => /^[0-2]$/.test(count)))) &&
      (renderedStarterSparkReadies.length === 0 ||
        renderedStarterSparkReadyCounts.length === 0 ||
        renderedStarterSparkReadyCounts.join(",") === renderedStarterSparkReadies.map(sparkReadyCountFromRenderedPair).join(",")) &&
      renderedStarterSparkLatest.length === renderedGameCount &&
      renderedStarterSparkLatest.every((values) => values.split("/").length === 2 && values.split("/").every((value) => value === "none" || /^-?\d+\.\d$/.test(value))) &&
      renderedStarterSeasonIp.length === renderedGameCount &&
      renderedStarterSeasonIp.every((values) => values.split("/").length === 2 && values.split("/").every((value) => value === "pending" || /^\d+\.\d$/.test(value))) &&
      renderedStarterSeasonEra.length === renderedGameCount &&
      renderedStarterSeasonEra.every((values) => values.split("/").length === 2 && values.split("/").every((value) => value === "pending" || /^\d+\.\d{2}$/.test(value))) &&
      renderedStarterSeasonWhip.length === renderedGameCount &&
      renderedStarterSeasonWhip.every((values) => values.split("/").length === 2 && values.split("/").every((value) => value === "pending" || /^\d+\.\d{2}$/.test(value))) &&
      renderedStarterSeasonK9.length === renderedGameCount &&
      renderedStarterSeasonK9.every((values) => values.split("/").length === 2 && values.split("/").every((value) => value === "pending" || /^\d+\.\d$/.test(value))) &&
      renderedStarterWindowCounts.length === renderedGameCount &&
      renderedStarterWindowCounts.every((counts) => counts.split("/").length === 2 && counts.split("/").every((count) => count === "pending" || /^\d+$/.test(count))) &&
      renderedStarterLastStartDates.length === renderedGameCount &&
      renderedStarterLastStartDates.every((dates) => dates.split("/").length === 2 && dates.split("/").every((date) => date === "none" || /^\d{4}-\d{2}-\d{2}$/.test(date))) &&
      renderedStarterLastStartGamePks.length === renderedGameCount &&
      renderedStarterLastStartGamePks.every((gamePks) => gamePks.split("/").length === 2 && gamePks.split("/").every((gamePk) => gamePk === "none" || /^\d+$/.test(gamePk))) &&
      renderedStarterLastStartOpponents.length === renderedGameCount &&
      renderedStarterLastStartOpponents.every((opponents) => opponents.split("/").length === 2 && opponents.split("/").every((opponent) => opponent === "none" || /^[A-Z0-9]{2,4}$/.test(opponent))) &&
      renderedStarterLastStartParks.length === renderedGameCount &&
      renderedStarterLastStartParks.every((parks) => parks.split("/").length === 2 && parks.split("/").every((park) => park.length > 0)) &&
      renderedStarterLastStartLines.length === renderedGameCount &&
      renderedStarterLastStartLines.every((lines) => lines.split("/").length === 2 && lines.split("/").every((line) => line === "none" || /^\d+\.\d:\d+:\d+:\d+:\d+$/.test(line))) &&
      renderedStarterLastStartGs.length === renderedGameCount &&
      renderedStarterLastStartGs.every((scores) => scores.split("/").length === 2 && scores.split("/").every((score) => score === "none" || /^-?\d+\.\d$/.test(score))) &&
      renderedStarterLastStartTiers.length === renderedGameCount &&
      renderedStarterLastStartTiers.every((tiers) => tiers.split("/").length === 2 && tiers.split("/").every((tier) => [...FORM_TIER_KEYS, "none"].includes(tier))) &&
      renderedStarterLastStartHrefs.length === renderedGameCount &&
      renderedStarterLastStartHrefs.every((hrefs) => hrefs.split("|").length === 2 && hrefs.split("|").every((href) => href === "none" || href.startsWith("/starts/"))) &&
      renderedStarterDriverCounts.length === renderedGameCount &&
      renderedStarterDriverCounts.every((counts) => counts.split("/").length === 2 && counts.split("/").every((count) => /^[0-3]$/.test(count))) &&
      renderedStarterVisibleDriverCounts.length === renderedGameCount &&
      renderedStarterVisibleDriverCounts.every((counts) => counts.split("/").length === 2 && counts.split("/").every((count) => /^[0-3]$/.test(count))) &&
      renderedStarterTopDriverKeys.length === renderedGameCount &&
      renderedStarterTopDriverKeys.every((keys) => keys.split("/").length === 2 && keys.split("/").every((key) => key === "none" || FORM_DRIVER_KEYS.includes(key))) &&
      renderedStarterTopDriverLabels.length === renderedGameCount &&
      renderedStarterTopDriverLabels.every((labels) => labels.split("/").length === 2 && labels.split("/").every((label) => label === "none" || (label.length > 0 && !label.includes(",")))) &&
      renderedStarterTopDriverDirections.length === renderedGameCount &&
      renderedStarterTopDriverDirections.every((directions) => directions.split("/").length === 2 && directions.split("/").every((direction) => ["good", "bad", "none"].includes(direction))) &&
      renderedStarterTopDriverDeltas.length === renderedGameCount &&
      renderedStarterTopDriverDeltas.every((deltas) => deltas.split("/").length === 2 && deltas.split("/").every((delta) => delta === "none" || /^-?\d+\.\d$/.test(delta))) &&
      renderedStarterTopDriverScores.length === renderedGameCount &&
      renderedStarterTopDriverScores.every((scores) => scores.split("/").length === 2 && scores.split("/").every((score) => score === "none" || /^-?\d+\.\d$/.test(score))) &&
      renderedStarterAccentSources.length === renderedGameCount &&
      renderedStarterAccentSources.every((sources) => sources.split("/").length === 2 && sources.split("/").every((source) => ["form-band", "neutral", "mlb-debut"].includes(source))) &&
      renderedStarterAccentBands.length === renderedGameCount &&
      renderedStarterAccentBands.every((bands) => bands.split("/").length === 2 && bands.split("/").every((band) => [...FORM_TIER_KEYS, "neutral"].includes(band))) &&
      renderedStarterAccentColors.length === renderedGameCount &&
      renderedStarterAccentColors.every((colors) => colors.split("/").length === 2 && colors.split("/").every((color) => [...Object.values(FORM_ACCENT_COLORS), "#EF9F27"].includes(color))),
    `${route} ${sectionId} should expose one away/home starter form tier, trend, score, delta, spark state, season baseline, window count, last-start state, driver-chip state, and form-band accent pair per visible game`,
  );
  assert(
    renderedStarterMarketStatuses.length === renderedGameCount &&
      renderedStarterMarketStatuses.every((statuses) => /^(?:pending-feed|ready|none)\/(?:pending-feed|ready|none)$/.test(statuses)) &&
      renderedStarterMarketSources.length === renderedGameCount &&
      renderedStarterMarketSources.every((sources) => /^(?:the-odds-api|not-configured|odds-deferred|none)\/(?:the-odds-api|not-configured|odds-deferred|none)$/.test(sources)) &&
      renderedStarterMarketLabels.length === renderedGameCount &&
      renderedStarterMarketLabels.every((labels) => labels.split("|").length === 2 && labels.split("|").every((label) => label === "none" || (label.length > 0 && !label.includes("|")))),
    `${route} ${sectionId} should expose one away/home starter market status/source/label pair per visible game`,
  );
  assert(
    renderedStarterProjectionStatuses.length === renderedGameCount &&
      renderedStarterProjectionStatuses.every((statuses) => /^(?:line-backed|pending|none)\/(?:line-backed|pending|none)$/.test(statuses)) &&
      renderedStarterProjectionConfidences.length === renderedGameCount &&
      renderedStarterProjectionConfidences.every((confidences) => /^(?:low|medium|high|none)\/(?:low|medium|high|none)$/.test(confidences)) &&
      renderedStarterProjectionGs.length === renderedGameCount &&
      renderedStarterProjectionGs.every((scores) => scores.split("/").length === 2 && scores.split("/").every((score) => score === "pending" || /^-?\d+\.\d$/.test(score))) &&
      renderedStarterProjectionInnings.length === renderedGameCount &&
      renderedStarterProjectionInnings.every((values) => values.split("/").length === 2 && values.split("/").every((value) => value === "pending" || /^\d+\.\d$/.test(value))) &&
      renderedStarterProjectionStrikeouts.length === renderedGameCount &&
      renderedStarterProjectionStrikeouts.every((values) => values.split("/").length === 2 && values.split("/").every((value) => value === "pending" || /^\d+\.\d$/.test(value))) &&
      renderedStarterProjectionEarnedRuns.length === renderedGameCount &&
      renderedStarterProjectionEarnedRuns.every((values) => values.split("/").length === 2 && values.split("/").every((value) => value === "pending" || /^\d+\.\d$/.test(value))) &&
      renderedStarterProjectionTokenCounts.length === renderedGameCount &&
      renderedStarterProjectionTokenCounts.every((counts) => /^[0-3]\/[0-3]$/.test(counts)),
    `${route} ${sectionId} should expose one away/home starter projection status, confidence, GS+, projected line, and visible line-token count pair per visible game`,
  );
  assert(
    renderedStarterOpponentSplitTeams.length === renderedGameCount &&
      renderedStarterOpponentSplitTeams.every((teams) => teams.split("/").length === 2 && teams.split("/").every((team) => team === "none" || /^[A-Z0-9]{2,4}$/.test(team))) &&
      renderedStarterOpponentSplits.length === renderedGameCount &&
      renderedStarterOpponentSplits.every((splits) => /^(?:vs-lhp|vs-rhp|none)\/(?:vs-lhp|vs-rhp|none)$/.test(splits)) &&
      renderedStarterOpponentSplitLabels.length === renderedGameCount &&
      renderedStarterOpponentSplitLabels.every((labels) => labels.split("|").length === 2 && labels.split("|").every((label) => label === "none" || (label.length > 0 && !label.includes("|")))) &&
      renderedStarterOpponentSplitOps.length === renderedGameCount &&
      renderedStarterOpponentSplitOps.every((values) => values.split("/").length === 2 && values.split("/").every((value) => value === "none" || /^\d+\.\d{3}$/.test(value))) &&
      renderedStarterOpponentSplitRunValues.length === renderedGameCount &&
      renderedStarterOpponentSplitRunValues.every((values) => values.split("/").length === 2 && values.split("/").every((value) => value === "none" || /^-?\d+\.\d$/.test(value))),
    `${route} ${sectionId} should expose one away/home starter opponent split team, handedness, label, OPS, and run-value pair per visible game`,
  );
  assert(
    renderedStarterRestLabels.length === renderedGameCount &&
      renderedStarterRestLabels.every((labels) => /^(?:short|normal|extended|unknown)\/(?:short|normal|extended|unknown)$/.test(labels)),
    `${route} ${sectionId} should expose one away/home starter workload rest-label pair per visible game`,
  );
  assert(
    renderedStarterDaysRest.length === renderedGameCount &&
      renderedStarterDaysRest.every((days) => /^(?:pending|\d+)\/(?:pending|\d+)$/.test(days)),
    `${route} ${sectionId} should expose one away/home starter days-rest pair per visible game`,
  );
  assert(
    renderedStarterAvgPitchesLast5.length === renderedGameCount &&
      renderedStarterAvgPitchesLast5.every((values) => values.split("/").length === 2 && values.split("/").every((value) => value === "pending" || /^\d+\.\d$/.test(value))) &&
      renderedStarterAvgIpLast5.length === renderedGameCount &&
      renderedStarterAvgIpLast5.every((values) => values.split("/").length === 2 && values.split("/").every((value) => value === "pending" || /^\d+\.\d$/.test(value))),
    `${route} ${sectionId} should expose one away/home starter average pitch/IP workload pair per visible game`,
  );
  assert(
    renderedStarterLimitedSamples.length === renderedGameCount &&
      renderedStarterLimitedSamples.every((flags) => /^(?:true|false)\/(?:true|false)$/.test(flags)) &&
      renderedStarterRustFlags.length === renderedGameCount &&
      renderedStarterRustFlags.every((flags) => /^(?:true|false)\/(?:true|false)$/.test(flags)),
    `${route} ${sectionId} should expose one away/home starter workload flag pair per visible game`,
  );
  assert(
    renderedStarterStatusChipCounts.length === renderedGameCount &&
      renderedStarterStatusChipCounts.every((counts) => /^[0-3]\/[0-3]$/.test(counts)),
    `${route} ${sectionId} should expose one away/home visible starter status-chip count pair per visible game`,
  );
  assert(
    renderedParkRunFactors.length === renderedGameCount &&
      renderedParkRunFactors.every((factor) => /^\d+\.\d{2}$/.test(factor) && Number.isFinite(Number(factor))) &&
      renderedParkRunValues.length === renderedGameCount &&
      renderedParkRunValues.every((value) => /^-?\d+\.\d$/.test(value) && Number.isFinite(Number(value))) &&
      renderedParkLabels.length === renderedGameCount &&
      renderedParkLabels.every((label) => label.length > 0 && !label.includes("|")) &&
      renderedParkTones.length === renderedGameCount &&
      renderedParkTones.every((tone) => ["warm", "cool", "muted"].includes(tone)),
    `${route} ${sectionId} should expose one park run factor, run value, public label, and tone per visible game`,
  );
  assert(
    renderedWeatherSources.length === renderedGameCount &&
      renderedWeatherSources.every((source) => ["open-meteo", "indoor", "unavailable"].includes(source)) &&
      renderedWeatherRunValues.length === renderedGameCount &&
      renderedWeatherRunValues.every((value) => /^-?\d+\.\d$/.test(value) && Number.isFinite(Number(value))) &&
      renderedWeatherLabels.length === renderedGameCount &&
      renderedWeatherLabels.every((label) => label.length > 0 && !label.includes("|")) &&
      renderedWeatherTempF.length === renderedGameCount &&
      renderedWeatherTempF.every((value) => value === "pending" || /^-?\d+$/.test(value)) &&
      renderedWeatherWindMph.length === renderedGameCount &&
      renderedWeatherWindMph.every((value) => value === "pending" || /^\d+$/.test(value)) &&
      renderedWeatherPrecipProbabilities.length === renderedGameCount &&
      renderedWeatherPrecipProbabilities.every((value) => value === "pending" || /^\d+$/.test(value)) &&
      renderedWeatherTones.length === renderedGameCount &&
      renderedWeatherTones.every((tone) => ["warm", "cool", "muted"].includes(tone)),
    `${route} ${sectionId} should expose one supported weather source, run value, raw metric set, and tone per visible game`,
  );
  assert(
    renderedWatchCardKinds.length === renderedGameCount &&
      renderedWatchCardKinds.every((kind, index) => kind === expectedWatchCardKind(index)),
    `${route} ${sectionId} should expose one visible watch-card kind per rendered game`,
  );
  assert(
    renderedWatchRanks.length === renderedGameCount &&
      renderedWatchRanks.every((rank) => rank === "-" || (Number.isInteger(Number(rank)) && Number(rank) >= 1)) &&
      renderedWatchRankLabels.length === renderedGameCount &&
      renderedWatchRankLabels.every((label) => label.length > 0 && !label.includes("|")) &&
      renderedWatchScores.length === renderedGameCount &&
      renderedWatchScores.every((score) => /^\d+(?:\.\d)$/.test(score) && Number(score) >= WATCH_SCORE_RANGE.min && Number(score) <= WATCH_SCORE_RANGE.max) &&
      renderedWatchScoreLabels.length === renderedGameCount &&
      renderedWatchScoreLabels.every((scoreLabel) => /^Watch score \d+(?:\.\d)$/.test(scoreLabel)) &&
      renderedWatchTiers.length === renderedGameCount &&
      renderedWatchTiers.every((tier) => ["mustwatch", "worthit", "background"].includes(tier)) &&
      renderedWatchTierLabels.length === renderedGameCount &&
      renderedWatchTierLabels.every((tierLabel) => WATCH_TIER_LABELS.includes(tierLabel)) &&
      renderedMatchupConfidences.length === renderedGameCount &&
      renderedMatchupConfidences.every((confidence) => ["HIGH", "LOW", "NONE"].includes(confidence)) &&
      renderedWatchSortGroups.length === renderedGameCount &&
      renderedWatchSortGroups.every((group) => Number.isInteger(Number(group))) &&
      renderedWatchSortGroupLabels.length === renderedGameCount &&
      renderedWatchSortGroupLabels.every((label) => ["Pregame sort bucket", "Live sort bucket", "Fallback sort bucket"].includes(label)) &&
      renderedWatchFlagKeys.length === renderedGameCount &&
      renderedWatchFlagKeys.every((keys) => keys === "clear" || keys.split("+").every((key) => ["tbd", "cold-start", "mlb-debut", "join-gap", "pending-opponent-splits"].includes(key))) &&
      renderedWatchFlagLabels.length === renderedGameCount &&
      renderedWatchFlagLabels.every((label) => label === "clear" || (label.length > 0 && !label.includes("|"))) &&
      renderedComponentCounts.length === renderedGameCount &&
      renderedComponentCounts.every((count) => count === expectedWatchComponentCountValue()) &&
      renderedComponentKeys.length === renderedGameCount &&
      renderedComponentKeys.every((keys) => keys === expectedWatchComponentKeysValue()) &&
      renderedComponentLayouts.length === renderedGameCount &&
      renderedComponentLayouts.every((layout, index) => layout === expectedWatchComponentLayout(index) && WATCH_COMPONENT_LAYOUTS.includes(layout)) &&
      renderedComponentLabels.length === renderedGameCount &&
      renderedComponentLabels.every((labels) => labels === expectedWatchComponentLabelsValue()) &&
      (renderedComponentValues.length === renderedGameCount ||
        (allowLiveSectionCountDrift && renderedComponentValues.length === 0)) &&
      renderedComponentValues.every((values) => values.split("/").length === WATCH_COMPONENT_KEYS.length && values.split("/").every((score) => /^\d+(?:\.\d)$/.test(score))) &&
      renderedComponentTopArms.length === renderedGameCount &&
      renderedComponentTopArms.every((score) => /^\d+(?:\.\d)$/.test(score) && Number(score) >= WATCH_SCORE_RANGE.min && Number(score) <= WATCH_SCORE_RANGE.max) &&
      renderedComponentPairings.length === renderedGameCount &&
      renderedComponentPairings.every((score) => /^\d+(?:\.\d)$/.test(score) && Number(score) >= WATCH_SCORE_RANGE.min && Number(score) <= WATCH_SCORE_RANGE.max) &&
      renderedComponentMatchups.length === renderedGameCount &&
      renderedComponentMatchups.every((score) => /^\d+(?:\.\d)$/.test(score) && Number(score) >= WATCH_SCORE_RANGE.min && Number(score) <= WATCH_SCORE_RANGE.max) &&
      renderedComponentDetails.length === renderedGameCount &&
      renderedComponentDetails.every((details) => {
        const detailSet = details.split("/");
        return detailSet.length === WATCH_COMPONENT_KEYS.length &&
          detailSet[0] === "none" &&
          detailSet[1] === "none" &&
          (detailSet[2] === "pending" || /^\d+(?:st|nd|rd|th) (?:today|tomorrow|yesterday|on .+)$/.test(detailSet[2]));
      }) &&
      renderedComponentItemAriaLabels.length === renderedGameCount &&
      renderedComponentItemAriaLabels.every((labels) => {
        const labelSet = labels.split("/");
        return labelSet.length === WATCH_COMPONENT_KEYS.length &&
          labelSet[0] === "none" &&
          labelSet[1] === "none" &&
          (labelSet[2] === "Opponent split matchup context pending" || /^Matchup score \d+, ranked \d+(?:st|nd|rd|th) (?:today|tomorrow|yesterday|on .+)$/.test(labelSet[2]));
      }) &&
      renderedComponentAriaLabels.length === renderedGameCount &&
      renderedComponentAriaLabels.every((label) => label.startsWith("Watch components for ") && !label.includes("|")) &&
      renderedMatchupRanks.length === renderedGameCount &&
      renderedMatchupRanks.every((rank) => Number.isInteger(Number(rank)) && Number(rank) >= 1) &&
      renderedMatchupContextStatuses.length === renderedGameCount &&
      renderedMatchupContextStatuses.every((status) => ["pending-opponent-splits", "scored"].includes(status)) &&
      renderedMatchupStatusLabels.length === renderedGameCount &&
      renderedMatchupStatusLabels.every((label) => supportedMatchupStatusLabels().includes(label)) &&
      renderedHookReasonKeys.length === renderedGameCount &&
      renderedHookReasonKeys.every((reasonKey) => supportedWatchHookReasonKeys().includes(reasonKey)) &&
      renderedHookReasons.length === renderedGameCount &&
      renderedHookReasons.every((reason) => reason.length > 0 && !reason.includes("|")),
    `${route} ${sectionId} should expose one rendered watch rank/label, score/label, tier key/label, sort group/label, fallback flag key/label set, component layout/score/detail/aria-label set, matchup rank, matchup context status, matchup status label, and hook reason key/label per visible game`,
  );
  if (allowLiveSectionCountDrift && renderedGameCount !== games.length) {
    assert(
      Number.isInteger(renderedGameCount) && renderedGameCount >= 0 && renderedGameCount <= scheduledGames,
      `${route} should expose a valid live-adjusted game count for ${sectionId}`,
    );
    if (renderedGameCount === 0) {
      assert(
        divHasAttributes(sectionHtml, {
          role: "status",
          "aria-label": "Upcoming slate status",
          "data-empty-reason": "completed-or-postponed",
          "data-empty-game-count": "0",
          "data-empty-scheduled-games": String(scheduledGames),
        }),
        `${route} should expose an empty state when a live pregame filter drains ${sectionId}`,
      );
    }
    return;
  }
  if (games.length === 0) {
    const expectedEmptyHeading = scheduledGames > 0 ? "Slate complete" : "No games on this slate";
    const unexpectedEmptyHeading = scheduledGames > 0 ? "No games on this slate" : "Slate complete";
    const expectedEmptyBody =
      scheduledGames > 0
        ? "Final or postponed games are removed from the upcoming watch list."
        : "The next probable slate will appear when MLB publishes it.";
    const expectedEmptyReason = scheduledGames > 0 ? "completed-or-postponed" : "no-games";
    assert(
      divHasAttributes(sectionHtml, {
        role: "status",
        "aria-label": "Upcoming slate status",
        "data-empty-reason": expectedEmptyReason,
        "data-empty-game-count": "0",
        "data-empty-scheduled-games": String(scheduledGames),
      }),
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
    assert(
      normalized.includes(expectedEmptyBody),
      `${route} should explain its empty upcoming slate state with the expected body copy`,
    );
    return;
  }

  const expectedGamePks = games.map((game) => game.gamePk);
  assert(
    renderedGamePks.every((gamePk) => expectedGamePks.includes(gamePk)),
    `${route} ${sectionId} should only expose visible game ids from the API result`,
  );
  let renderedGames = games;
  if (allowLiveSectionCountDrift) {
    renderedGames = renderedGamePks.map((gamePk) => games.find((game) => game.gamePk === gamePk)).filter(Boolean);
    assert(
      renderedGames.length === renderedGamePks.length,
      `${route} ${sectionId} should resolve every rendered game id back to the API result during live drift`,
    );
  } else {
    assert(
      renderedGamePks.join(",") === expectedGamePks.join(","),
      `${route} ${sectionId} should preserve API watch-card order in data-visible-game-pks`,
    );
    assert(
      renderedWatchCardKinds.join(",") === games.map((_, index) => expectedWatchCardKind(index)).join(",") &&
      renderedWatchRanks.join(",") === games.map(expectedWatchRankValue).join(",") &&
      renderedWatchRankLabels.join("|") === games.map(() => escapeHtmlAttribute(expectedWatchRankLabelValue(rankLabel))).join("|") &&
      renderedWatchScores.every((score) => /^\d+\.\d$/.test(score)) &&
      renderedWatchScores.join(",") === games.map(expectedWatchScoreValue).join(",") &&
      renderedWatchScoreLabels.join("|") === games.map((game) => escapeHtmlAttribute(expectedWatchScoreLabel(game))).join("|") &&
      renderedWatchTiers.join(",") === games.map((game) => game.watchTier).join(",") &&
      renderedWatchTierLabels.join("|") === games.map((game) => escapeHtmlAttribute(expectedWatchTierLabelForGame(game))).join("|") &&
      renderedWatchSortGroups.join(",") === games.map(expectedWatchSortGroupValue).join(",") &&
      renderedWatchSortGroupLabels.join("|") === games.map(expectedWatchSortGroupLabelValue).join("|") &&
      renderedWatchFlagKeys.join(",") === games.map(expectedWatchFlagNoteKeysValue).join(",") &&
      renderedWatchFlagLabels.join("|") === games.map((game) => escapeHtmlAttribute(expectedWatchFlagNoteLabelValue(game))).join("|") &&
      renderedComponentCounts.join(",") === games.map(expectedWatchComponentCountValue).join(",") &&
      renderedComponentKeys.join(",") === games.map(expectedWatchComponentKeysValue).join(",") &&
      renderedComponentLayouts.join(",") === games.map((_, index) => expectedWatchComponentLayout(index)).join(",") &&
      renderedComponentLabels.join("|") === games.map(expectedWatchComponentLabelsValue).join("|") &&
      (renderedComponentValues.length === 0 || renderedComponentValues.join(",") === games.map(expectedWatchComponentValuesValue).join(",")) &&
      renderedComponentTopArms.join(",") === games.map((game) => game.watchComponents.topArm.toFixed(1)).join(",") &&
      renderedComponentPairings.join(",") === games.map((game) => game.watchComponents.pairing.toFixed(1)).join(",") &&
      renderedComponentMatchups.join(",") === games.map((game) => game.matchupScore.toFixed(1)).join(",") &&
      renderedComponentDetails.join(",") === games.map((game) => expectedWatchComponentDetailsValue(game, rankLabel)).join(",") &&
      renderedComponentItemAriaLabels.join("|") === games.map((game) => escapeHtmlAttribute(expectedWatchComponentItemAriaLabelsValue(game, rankLabel))).join("|") &&
      renderedComponentAriaLabels.join("|") === games.map((game) => escapeHtmlAttribute(expectedWatchComponentsAriaLabelValue(game))).join("|") &&
      renderedMatchupRanks.join(",") === games.map((game) => String(game.matchupRankTonight)).join(",") &&
      renderedMatchupContextStatuses.join(",") === games.map((game) => game.matchupContext.status).join(",") &&
      renderedMatchupContextLabels.join(",") === games.map((game) => escapeHtmlAttribute(game.matchupContext.label)).join(",") &&
      renderedMatchupStatusLabels.join(",") === games.map((game) => expectedMatchupStatusLabel(game)).join(",") &&
      renderedHookReasonKeys.join(",") === games.map((game) => expectedWatchHookReasonKeyValue(game, rankLabel)).join(",") &&
      renderedHookReasons.join("|") === games.map((game) => escapeHtmlAttribute(expectedWatchHookReasonValue(game, rankLabel))).join("|") &&
      renderedGameDates.join(",") === games.map((game) => game.date).join(",") &&
      renderedMatchupLabels.join(",") === games.map((game) => game.label).join(",") &&
      renderedTeamMatchups.join(",") === games.map((game) => `${game.awayTeam}@${game.homeTeam}`).join(",") &&
      renderedTeamNames.join(",") === games.map((game) => `${game.awayName}/${game.homeName}`).join(",") &&
      renderedVenues.join(",") === games.map((game) => game.park ?? "Venue TBD").join(",") &&
      renderedFirstPitches.join(",") === games.map((game) => game.firstPitch).join(",") &&
      renderedGameStatuses.join(",") === games.map((game) => game.status).join(",") &&
      renderedDetailedStates.join(",") === games.map((game) => game.detailedState).join(",") &&
      renderedCardAriaLabels.join("|") === games.map((game) => escapeHtmlAttribute(expectedWatchCardAriaLabel(game))).join("|") &&
      renderedSummaryStatusLabels.join(",") === games.map((game) => expectedGameStatusLabel(game.status)).join(",") &&
      renderedSummaryIds.join(",") === games.map(expectedWatchCardSummaryIdValue).join(",") &&
      renderedSummaryAriaLabels.join("|") === games.map((game) => escapeHtmlAttribute(expectedWatchCardSummaryAriaLabelValue(game))).join("|") &&
      renderedStarterSides.join(",") === games.map((game) => game.starters.map((starter) => starter.side).join("/")).join(",") &&
      renderedStarterStatuses.join(",") === games.map((game) => game.starters.map((starter) => starter.status).join("/")).join(",") &&
      renderedStarterFallbackLabels.join(",") === games.map((game) => game.starters.map((starter) => starter.status === "ok" ? "none" : starterFallbackAriaLabel(starter)).join("|")).join(",") &&
      renderedStarterPitcherIds.join(",") === games.map((game) => game.starters.map((starter) => starter.pitcherId ?? "tbd").join("/")).join(",") &&
      renderedStarterNames.join(",") === games.map((game) => game.starters.map((starter) => starter.name ?? "TBD").join("/")).join(",") &&
      renderedStarterTeams.join(",") === games.map((game) => game.starters.map((starter) => starter.team).join("/")).join(",") &&
      renderedStarterFormHrefs.join(",") === games.map((game) => game.starters.map((starter) => starter.pitcherId ? expectedStarterFormHref(starter) : "none").join("|")).join(",") &&
      renderedStarterNameLinkeds.join(",") === games.map((game) => game.starters.map((starter) => String(Boolean(starter.pitcherId))).join("/")).join(",") &&
      renderedStarterFormTiers.join(",") === games.map((game) => game.starters.map((starter) => starter.tier ?? "none").join("/")).join(",") &&
      renderedStarterFormTrends.join(",") === games.map((game) => game.starters.map((starter) => starter.trend ?? "none").join("/")).join(",") &&
      renderedStarterFormScores.join(",") === games.map((game) => game.starters.map((starter) => starterFormValue(starter.rgs)).join("/")).join(",") &&
      renderedStarterDeltaForms.join(",") === games.map((game) => game.starters.map((starter) => starterFormValue(starter.deltaForm)).join("/")).join(",") &&
      renderedStarterSparkCounts.join(",") === games.map(expectedGameSparkCountPair).join(",") &&
      (renderedStarterSparkReadies.length === 0 ||
        renderedStarterSparkReadies.join(",") === games.map(expectedGameSparkReadyPair).join(",")) &&
      (renderedStarterSparkReadyCounts.length === 0 ||
        renderedStarterSparkReadyCounts.join(",") === games.map(expectedGameSparkReadyCount).join(",")) &&
      renderedStarterSparkLatest.join(",") === games.map(expectedGameSparkLatestPair).join(",") &&
      renderedStarterSeasonIp.join(",") === games.map((game) => game.starters.map((starter) => starterSeasonValue(starter.seasonStats?.inningsPitched, 1)).join("/")).join(",") &&
      renderedStarterSeasonEra.join(",") === games.map((game) => game.starters.map((starter) => starterSeasonValue(starter.seasonStats?.era, 2)).join("/")).join(",") &&
      renderedStarterSeasonWhip.join(",") === games.map((game) => game.starters.map((starter) => starterSeasonValue(starter.seasonStats?.whip, 2)).join("/")).join(",") &&
      renderedStarterSeasonK9.join(",") === games.map((game) => game.starters.map((starter) => starterSeasonValue(starter.seasonStats?.k9, 1)).join("/")).join(",") &&
      renderedStarterWindowCounts.join(",") === games.map((game) => game.starters.map((starter) => starter.windowCount === null || starter.windowCount === undefined ? "pending" : String(starter.windowCount)).join("/")).join(",") &&
      renderedStarterLastStartDates.join(",") === games.map((game) => game.starters.map((starter) => starterLastStartValue(starter, "gameDate")).join("/")).join(",") &&
      renderedStarterLastStartGamePks.join(",") === games.map((game) => game.starters.map((starter) => starterLastStartValue(starter, "gamePk")).join("/")).join(",") &&
      renderedStarterLastStartOpponents.join(",") === games.map((game) => game.starters.map((starter) => starterLastStartValue(starter, "opp")).join("/")).join(",") &&
      renderedStarterLastStartParks.join(",") === games.map((game) => game.starters.map((starter) => starterLastStartValue(starter, "park")).join("/")).join(",") &&
      renderedStarterLastStartLines.join(",") === games.map((game) => game.starters.map((starter) => starterLastStartValue(starter, "line")).join("/")).join(",") &&
      renderedStarterLastStartGs.join(",") === games.map((game) => game.starters.map((starter) => starterLastStartValue(starter, "gsPlus")).join("/")).join(",") &&
      renderedStarterLastStartTiers.join(",") === games.map((game) => game.starters.map((starter) => starterLastStartValue(starter, "tier")).join("/")).join(",") &&
      renderedStarterLastStartHrefs.join(",") === games.map((game) => game.starters.map((starter) => starterLastStartValue(starter, "startHref")).join("|")).join(",") &&
      renderedStarterDriverCounts.join(",") === games.map((game) => game.starters.map((starter) => String(starter.driverChips?.length ?? 0)).join("/")).join(",") &&
      renderedStarterVisibleDriverCounts.join(",") === games.map((game) => game.starters.map((starter) => String(Math.min(starter.driverChips?.length ?? 0, 3))).join("/")).join(",") &&
      renderedStarterTopDriverKeys.join(",") === games.map((game) => game.starters.map((starter) => starterTopDriverValue(starter, "key")).join("/")).join(",") &&
      renderedStarterTopDriverLabels.join(",") === games.map((game) => game.starters.map((starter) => escapeHtmlAttribute(starterTopDriverValue(starter, "label"))).join("/")).join(",") &&
      renderedStarterTopDriverDirections.join(",") === games.map((game) => game.starters.map((starter) => starterTopDriverValue(starter, "direction")).join("/")).join(",") &&
      renderedStarterTopDriverDeltas.join(",") === games.map((game) => game.starters.map((starter) => starterTopDriverValue(starter, "delta")).join("/")).join(",") &&
      renderedStarterTopDriverScores.join(",") === games.map((game) => game.starters.map((starter) => starterTopDriverValue(starter, "score")).join("/")).join(",") &&
      renderedStarterAccentSources.join(",") === games.map((game) => game.starters.map((starter) => expectedStarterAccent(starter).source).join("/")).join(",") &&
      renderedStarterAccentBands.join(",") === games.map((game) => game.starters.map((starter) => expectedStarterAccent(starter).band).join("/")).join(",") &&
      renderedStarterAccentColors.join(",") === games.map((game) => game.starters.map((starter) => expectedStarterAccent(starter).color).join("/")).join(",") &&
      renderedStarterMarketStatuses.join(",") === games.map((game) => game.starters.map((starter) => starter.marketContext?.status ?? "none").join("/")).join(",") &&
      renderedStarterMarketSources.join(",") === games.map((game) => game.starters.map((starter) => starter.marketContext?.source ?? "none").join("/")).join(",") &&
      renderedStarterMarketLabels.join(",") === games.map((game) => game.starters.map((starter) => escapeHtmlAttribute(starter.marketContext?.label ?? "none")).join("|")).join(",") &&
      renderedStarterProjectionStatuses.join(",") === games.map((game) => game.starters.map((starter) => starter.projection?.status ?? "none").join("/")).join(",") &&
      renderedStarterProjectionConfidences.join(",") === games.map((game) => game.starters.map((starter) => starter.projection?.confidence ?? "none").join("/")).join(",") &&
      renderedStarterProjectionGs.join(",") === games.map((game) => game.starters.map((starter) => projectionValue(starter.projection?.projectedGsPlus)).join("/")).join(",") &&
      renderedStarterProjectionInnings.join(",") === games.map((game) => game.starters.map((starter) => projectionValue(starter.projection?.line.inningsPitched)).join("/")).join(",") &&
      renderedStarterProjectionStrikeouts.join(",") === games.map((game) => game.starters.map((starter) => projectionValue(starter.projection?.line.strikeouts)).join("/")).join(",") &&
      renderedStarterProjectionEarnedRuns.join(",") === games.map((game) => game.starters.map((starter) => projectionValue(starter.projection?.line.earnedRuns)).join("/")).join(",") &&
      renderedStarterProjectionTokenCounts.join(",") === games.map((game) => game.starters.map((starter) => String(starter.projection ? projectionLineTokenCount(starter.projection) : 0)).join("/")).join(",") &&
      renderedStarterOpponentSplitTeams.join(",") === games.map((game) => game.starters.map((starter) => starter.opponentSplit?.team ?? "none").join("/")).join(",") &&
      renderedStarterOpponentSplits.join(",") === games.map((game) => game.starters.map((starter) => starter.opponentSplit?.split ?? "none").join("/")).join(",") &&
      renderedStarterOpponentSplitLabels.join("||") === games.map((game) => game.starters.map((starter) => escapeHtmlAttribute(starter.opponentSplit?.label ?? "none")).join("|")).join("||") &&
      renderedStarterOpponentSplitOps.join(",") === games.map((game) => game.starters.map((starter) => splitValue(starter.opponentSplit?.ops, 3)).join("/")).join(",") &&
      renderedStarterOpponentSplitRunValues.join(",") === games.map((game) => game.starters.map((starter) => splitValue(starter.opponentSplit?.matchupRunValue, 1)).join("/")).join(",") &&
      renderedStarterRestLabels.join(",") === games.map((game) => game.starters.map((starter) => starter.workload?.restLabel ?? "unknown").join("/")).join(",") &&
      renderedStarterDaysRest.join(",") === games.map((game) => game.starters.map((starter) => starter.workload?.daysRest === null || starter.workload?.daysRest === undefined ? "pending" : String(starter.workload.daysRest)).join("/")).join(",") &&
      renderedStarterAvgPitchesLast5.join(",") === games.map((game) => game.starters.map((starter) => workloadValue(starter.workload?.avgPitchesLast5)).join("/")).join(",") &&
      renderedStarterAvgIpLast5.join(",") === games.map((game) => game.starters.map((starter) => workloadValue(starter.workload?.avgIpLast5)).join("/")).join(",") &&
      renderedStarterLimitedSamples.join(",") === games.map((game) => game.starters.map((starter) => String(starter.flags?.limitedSample === true)).join("/")).join(",") &&
      renderedStarterRustFlags.join(",") === games.map((game) => game.starters.map((starter) => String(starter.flags?.rust === true)).join("/")).join(",") &&
      renderedStarterStatusChipCounts.join(",") === games.map((game) => game.starters.map((starter) => String(starterStatusChipCount(starter))).join("/")).join(",") &&
      renderedParkRunFactors.join(",") === games.map((game) => game.parkContext.runFactor.toFixed(2)).join(",") &&
      renderedParkRunValues.join(",") === games.map((game) => game.parkContext.runValue.toFixed(1)).join(",") &&
      renderedParkLabels.join("|") === games.map((game) => escapeHtmlAttribute(game.parkContext.label)).join("|") &&
      renderedParkTones.join(",") === games.map((game) => expectedParkContextTone(game.parkContext)).join(",") &&
      renderedWeatherSources.join(",") === games.map((game) => game.weatherContext.source).join(",") &&
      renderedWeatherRunValues.join(",") === games.map((game) => game.weatherContext.runValue.toFixed(1)).join(",") &&
      renderedWeatherLabels.join("|") === games.map((game) => escapeHtmlAttribute(game.weatherContext.label)).join("|") &&
      renderedWeatherTempF.join(",") === games.map((game) => weatherMetricValue(game.weatherContext.tempF, 0)).join(",") &&
      renderedWeatherWindMph.join(",") === games.map((game) => weatherMetricValue(game.weatherContext.windMph, 0)).join(",") &&
      renderedWeatherPrecipProbabilities.join(",") === games.map((game) => weatherMetricValue(game.weatherContext.precipProbability, 0)).join(",") &&
      renderedWeatherTones.join(",") === games.map((game) => expectedWeatherContextTone(game.weatherContext)).join(",") &&
      renderedWatchCardKinds.join(",") === games.map((_, index) => expectedWatchCardKind(index)).join(",") &&
      renderedWatchRankLabels.join("|") === games.map(() => escapeHtmlAttribute(expectedWatchRankLabelValue(rankLabel))).join("|") &&
      renderedWatchScores.join(",") === games.map(expectedWatchScoreValue).join(",") &&
      renderedWatchScoreLabels.join("|") === games.map((game) => escapeHtmlAttribute(expectedWatchScoreLabel(game))).join("|") &&
      renderedWatchTiers.join(",") === games.map((game) => game.watchTier).join(",") &&
      renderedWatchTierLabels.join("|") === games.map((game) => escapeHtmlAttribute(expectedWatchTierLabelForGame(game))).join("|") &&
      renderedComponentCounts.join(",") === games.map(expectedWatchComponentCountValue).join(",") &&
      renderedComponentLayouts.join(",") === games.map((_, index) => expectedWatchComponentLayout(index)).join(","),
      `${route} ${sectionId} should preserve API dates, labels, teams, team names, venues, statuses, detailed states, summary status labels/ids/aria labels, starter sides, starter statuses/fallback labels, starter identities, starter names, starter teams, starter Form hrefs, starter name-link flags, starter form state/deltas/sparks/season baselines/window counts/last-starts/driver chips, starter form-band accent state, starter market context, starter projection state/line, starter opponent split labels/metrics, starter workload rest labels/days-rest/averages/flags/chip counts, park context labels/metrics, weather context/raw metrics, first pitches, watch card kinds, watch ranks/labels, scores/labels, tier keys/labels, sort groups/labels, fallback flag keys/labels, component counts/keys/layouts/labels/scores/details/aria labels, matchup ranks, matchup context statuses/labels, matchup status labels, and hook reason keys/labels in visible section order`,
    );
  }

  let renderedArticles = sectionHtml.match(/<article\b[^>]*>.*?<\/article>/gs) ?? [];
  let usedResponseArticleFallback = false;
  if (renderedArticles.length !== renderedGames.length) {
    usedResponseArticleFallback = true;
    renderedArticles = (html.match(/<article\b[^>]*>.*?<\/article>/gs) ?? []).filter(
      (article) =>
        (article.includes('data-responsive-check="must-watch-headliner"') || article.includes('data-responsive-check="must-watch-row"')) &&
        (renderedGamePks.length === 0 || renderedGamePks.some((gamePk) => article.includes(`data-game-pk="${escapeHtmlAttribute(gamePk)}"`))),
    );
  }
  const cardSearchHtml = usedResponseArticleFallback ? renderedArticles.join("") : sectionHtml;
  assert(
    renderedArticles.length === renderedGames.length,
    `${route} should render exactly ${renderedGames.length} watch-card article${renderedGames.length === 1 ? "" : "s"} in ${sectionId}`,
  );
  const renderedArticleTags = renderedArticles.map((article) => article.match(/<article\b[^>]*>/)?.[0] ?? "");
  const renderedSummaryTags = renderedArticles.map(
    (article) => (article.match(/<p\b[^>]*>/g) ?? []).find((tag) => tagAttribute(tag, "data-summary-status-label") !== null) ?? "",
  );
  const renderedComponentGroupTags = renderedArticles.map(
    (article) => (article.match(/<div\b[^>]*>/g) ?? []).find((tag) => tagAttribute(tag, "data-responsive-check") === "watch-components") ?? "",
  );
  const renderedComponentLabelSets = renderedArticles.map((article) =>
    (article.match(/<div\b[^>]*>/g) ?? [])
      .filter((tag) => tagAttribute(tag, "data-watch-component") !== null)
      .map((tag) => tagAttribute(tag, "data-watch-label"))
      .join("/"),
  );
  const renderedComponentValueSets = renderedArticles.map((article) =>
    (article.match(/<div\b[^>]*>/g) ?? [])
      .filter((tag) => tagAttribute(tag, "data-watch-component") !== null)
      .map((tag) => tagAttribute(tag, "data-watch-value"))
      .join("/"),
  );
  const renderedComponentItemAriaLabelSets = renderedArticles.map((article) =>
    (article.match(/<div\b[^>]*>/g) ?? [])
      .filter((tag) => tagAttribute(tag, "data-watch-component") !== null)
      .map((tag) => tagAttribute(tag, "data-watch-item-aria-label"))
      .join("/"),
  );
  const renderedParkChipTags = renderedArticles.map(
    (article) => (article.match(/<span\b[^>]*>/g) ?? []).find((tag) => tagAttribute(tag, "data-context-chip") === "park") ?? "",
  );
  const renderedWeatherChipTags = renderedArticles.map(
    (article) => (article.match(/<span\b[^>]*>/g) ?? []).find((tag) => tagAttribute(tag, "data-context-chip") === "weather") ?? "",
  );
  const renderedHeadlinerHookTag =
    (renderedArticles[0]?.match(/<div\b[^>]*>/g) ?? []).find((tag) => tagAttribute(tag, "data-responsive-check") === "watch-hook") ?? "";
  const renderedHeadlinerHookMatches = renderedGameCount === 0
    ? true
    : tagAttribute(renderedHeadlinerHookTag, "data-hook-reason-key") === renderedHookReasonKeys[0] &&
      tagAttribute(renderedHeadlinerHookTag, "data-hook-reason") === renderedHookReasons[0];
  const renderedComponentValueSequence = renderedComponentTopArms
    .map((topArm, index) => `${topArm}/${renderedComponentPairings[index]}/${renderedComponentMatchups[index]}`)
    .join(",");
  if (renderedComponentValues.length > 0) {
    assert(
      renderedComponentValues.join(",") === renderedComponentValueSequence,
      `${route} ${sectionId} should expose the same ordered component value triplets as the split score telemetry`,
    );
  }
  const articleSectionAlignmentChecks = [
    [
      "identity-core",
      renderedArticleTags.map((article) => tagAttribute(article, "data-game-pk")).join(",") === renderedGamePks.join(",") &&
        renderedArticleTags.map((article) => tagAttribute(article, "data-game-date")).join(",") === renderedGameDates.join(",") &&
        renderedArticleTags.map((article) => tagAttribute(article, "data-matchup-label")).join(",") === renderedMatchupLabels.join(",") &&
        renderedArticleTags.map((article) => `${tagAttribute(article, "data-away-team")}@${tagAttribute(article, "data-home-team")}`).join(",") === renderedTeamMatchups.join(",") &&
        renderedArticleTags.map((article) => `${tagAttribute(article, "data-away-team-name")}/${tagAttribute(article, "data-home-team-name")}`).join(",") === renderedTeamNames.join(",") &&
        renderedArticleTags.map((article) => tagAttribute(article, "data-first-pitch")).join(",") === renderedFirstPitches.join(",") &&
        renderedArticleTags.map((article) => tagAttribute(article, "data-venue")).join(",") === renderedVenues.join(","),
    ],
    [
      "identity-status",
      renderedArticleTags.map((article) => tagAttribute(article, "data-game-status")).join(",") === renderedGameStatuses.join(",") &&
        renderedArticleTags.map((article) => tagAttribute(article, "data-game-detailed-state")).join(",") === renderedDetailedStates.join(","),
    ],
    [
      "summary",
      renderedArticleTags.map((article) => tagAttribute(article, "data-watch-summary-id")).join(",") === renderedSummaryIds.join(",") &&
        renderedArticleTags.map((article) => tagAttribute(article, "data-watch-summary-aria-label")).join("|") === renderedSummaryAriaLabels.join("|") &&
        renderedArticleTags.map((article) => tagAttribute(article, "aria-describedby")).join(",") === renderedSummaryIds.join(",") &&
        renderedSummaryTags.map((tag) => tagAttribute(tag, "data-summary-status-label")).join(",") === renderedSummaryStatusLabels.join(",") &&
        renderedSummaryTags.map((tag) => tagAttribute(tag, "id")).join(",") === renderedSummaryIds.join(",") &&
        renderedSummaryTags.map((tag) => tagAttribute(tag, "data-first-pitch")).join(",") === renderedFirstPitches.join(",") &&
        renderedSummaryTags.map((tag) => tagAttribute(tag, "data-venue")).join(",") === renderedVenues.join(",") &&
        renderedSummaryTags.map((tag) => tagAttribute(tag, "aria-label")).join("|") === renderedSummaryAriaLabels.join("|"),
    ],
    [
      "components",
      renderedComponentGroupTags.map((tag) => tagAttribute(tag, "data-watch-component-count")).join(",") === renderedComponentCounts.join(",") &&
        renderedComponentGroupTags.map((tag) => tagAttribute(tag, "data-watch-component-layout")).join(",") === renderedComponentLayouts.join(",") &&
        renderedComponentGroupTags.map((tag) => tagAttribute(tag, "data-watch-component-labels")).join("|") === renderedComponentLabels.join("|") &&
        renderedComponentGroupTags.map((tag) => tagAttribute(tag, "data-watch-component-values")).join(",") === renderedComponentValueSequence &&
        renderedComponentGroupTags.map((tag) => tagAttribute(tag, "data-watch-component-details")).join(",") === renderedComponentDetails.join(",") &&
        renderedComponentGroupTags.map((tag) => tagAttribute(tag, "data-watch-component-item-aria-labels")).join("|") === renderedComponentItemAriaLabels.join("|") &&
        renderedComponentLabelSets.join("|") === renderedComponentLabels.join("|") &&
        renderedComponentValueSets.join(",") === renderedComponentValueSequence &&
        renderedComponentItemAriaLabelSets.join("|") === renderedComponentItemAriaLabels.join("|") &&
        renderedComponentGroupTags.map((tag) => tagAttribute(tag, "data-watch-component-aria-label")).join("|") === renderedComponentAriaLabels.join("|") &&
        renderedComponentGroupTags.map((tag) => tagAttribute(tag, "aria-label")).join("|") === renderedComponentAriaLabels.join("|"),
    ],
    [
      "context",
      renderedParkChipTags.map((tag) => tagAttribute(tag, "data-context-label")).join("|") === renderedParkLabels.join("|") &&
        renderedParkChipTags.map((tag) => tagAttribute(tag, "title")).join("|") === renderedParkLabels.join("|") &&
        renderedWeatherChipTags.map((tag) => tagAttribute(tag, "data-context-label")).join("|") === renderedWeatherLabels.join("|") &&
        renderedHeadlinerHookMatches &&
        renderedArticleTags.map((article) => tagAttribute(article, "data-matchup-context-label")).join(",") === renderedMatchupContextLabels.join(","),
    ],
    [
      "accent",
      renderedArticleTags.map((article) => `${tagAttribute(article, "data-away-accent-source")}/${tagAttribute(article, "data-home-accent-source")}`).join(",") === renderedStarterAccentSources.join(",") &&
        renderedArticleTags.map((article) => `${tagAttribute(article, "data-away-accent-band")}/${tagAttribute(article, "data-home-accent-band")}`).join(",") === renderedStarterAccentBands.join(",") &&
        renderedArticleTags.map((article) => `${tagAttribute(article, "data-away-accent-color")}/${tagAttribute(article, "data-home-accent-color")}`).join(",") === renderedStarterAccentColors.join(","),
    ],
    [
      "watch",
      renderedArticleTags.map((article) => tagAttribute(article, "data-watch-card-kind")).join(",") === renderedWatchCardKinds.join(",") &&
        renderedArticleTags.map((article) => tagAttribute(article, "data-watch-rank")).join(",") === renderedWatchRanks.join(",") &&
        renderedArticleTags.map((article) => tagAttribute(article, "data-watch-rank-label")).join("|") === renderedWatchRankLabels.join("|") &&
        renderedArticleTags.map((article) => tagAttribute(article, "data-watch-sort-group")).join(",") === renderedWatchSortGroups.join(",") &&
        renderedArticleTags.map((article) => tagAttribute(article, "data-watch-sort-group-label")).join("|") === renderedWatchSortGroupLabels.join("|") &&
        renderedArticleTags.map((article) => tagAttribute(article, "data-watch-score")).join(",") === renderedWatchScores.join(",") &&
        renderedArticleTags.map((article) => tagAttribute(article, "data-watch-score-label")).join("|") === renderedWatchScoreLabels.join("|") &&
        renderedArticleTags.map((article) => tagAttribute(article, "data-watch-score-tier")).join(",") === renderedWatchTiers.join(",") &&
        renderedArticleTags.map((article) => tagAttribute(article, "data-watch-tier")).join("|") === renderedWatchTierLabels.join("|") &&
        renderedArticleTags.map((article) => tagAttribute(article, "data-watch-flag-keys")).join(",") === renderedWatchFlagKeys.join(",") &&
        renderedArticleTags.map((article) => tagAttribute(article, "data-watch-flag-label")).join("|") === renderedWatchFlagLabels.join("|"),
    ],
  ];
  const failedArticleSectionAlignmentChecks = articleSectionAlignmentChecks
    .filter(([name, matches]) => {
      if (matches) return false;
      return !(usedResponseArticleFallback && allowLiveSectionCountDrift && ["summary", "components", "context"].includes(name));
    })
    .map(([name]) => name);
  assert(
    failedArticleSectionAlignmentChecks.length === 0,
    `${route} ${sectionId} should keep section-level visible game identity, summary, component, context, accent, and watch metadata in the same order as the rendered watch-card articles; failed groups: ${failedArticleSectionAlignmentChecks.join(", ")}`,
  );

  renderedGames.forEach((game, index) => {
    const rank = index + 1;
    const card = renderedGameCard(cardSearchHtml, route, game, rank, rankLabel);
    const cardDetailHtml = usedResponseArticleFallback ? html : card.html;
    const cardDetailText = usedResponseArticleFallback ? normalizeHtmlText(html) : card.text;
    const summaryId = expectedWatchCardSummaryIdValue(game);
    const allowLiveDataDrift = allowsRenderedLiveDataDrift(route);
    assert(
      usedResponseArticleFallback && allowLiveDataDrift
        ? renderedSummaryIds[index] === summaryId && html.includes(`id="${summaryId}"`)
        : countOccurrences(card.html, `<p id="${summaryId}"`) === 1,
      `${route} should render exactly one watch-card summary id for ${game.label}`,
    );
    const articleIdentityAttributes = {
      "data-game-pk": game.gamePk,
      "data-game-date": game.date,
      "data-away-team": game.away,
      "data-away-team-name": game.awayName,
      "data-home-team": game.home,
      "data-home-team-name": game.homeName,
      "data-matchup-label": game.label,
      "data-first-pitch": game.firstPitch,
      "data-venue": game.park ?? "Venue TBD",
      "data-has-tbd": String(game.flags?.tbd === true),
      "data-limited-form": String(game.flags?.limitedForm === true),
      "data-cold-start-form": String(game.flags?.coldStartForm === true),
      "data-matchup-confidence": game.matchupConfidence,
      "data-watch-card-kind": expectedWatchCardKind(index),
      "data-watch-rank-label": expectedWatchRankLabelValue(rankLabel),
      "data-watch-flag-keys": expectedWatchFlagNoteKeysValue(game),
      "data-watch-flag-label": expectedWatchFlagNoteLabelValue(game),
      "data-watch-summary-id": summaryId,
      "data-watch-summary-aria-label": expectedWatchCardSummaryAriaLabelValue(game),
      "aria-label": `Watch card for ${game.label} on ${formatUpcomingDate(game.date)}`,
      "aria-describedby": summaryId,
    };
    if (!allowLiveDataDrift) {
      articleIdentityAttributes["data-game-status"] = game.status;
      articleIdentityAttributes["data-game-detailed-state"] = game.detailedState;
    }
    if (game.flags?.joinGapForm === true) articleIdentityAttributes["data-join-gap-form"] = "true";
    if (game.flags?.mlbDebut === true) articleIdentityAttributes["data-mlb-debut"] = "true";
    if (game.flags?.likelyOpener === true) articleIdentityAttributes["data-likely-opener"] = "true";
    const hasExactArticleIdentity = elementHasAttributes(card.html, "article", articleIdentityAttributes);
    assert(
      hasExactArticleIdentity || (allowLiveDataDrift && watchCardHasSupportedIdentityMetadata(card.html, game.gamePk, summaryId, rankLabel)),
      `${route} should pin identity, status detail, timing, venue, flags, label, and description on the watch-card article for ${game.label} on ${formatUpcomingDate(game.date)}`,
    );
    const renderedGameStatus = elementAttributeValue(card.html, "article", { "data-game-pk": game.gamePk }, "data-game-status");
    assert(
      allowLiveDataDrift ? ACTIVE_CARD_STATUSES.includes(renderedGameStatus) : renderedGameStatus === game.status,
      `${route} should expose a supported rendered card status for ${game.label}`,
    );
    assertNonEmptyString(
      elementAttributeValue(card.html, "article", { "data-game-pk": game.gamePk }, "data-game-detailed-state"),
      `${route} rendered detailed state for ${game.label}`,
    );
    const renderedMatchupScore = Number(elementAttributeValue(card.html, "article", { "data-game-pk": game.gamePk }, "data-matchup-score"));
    const renderedMatchupRank = Number(elementAttributeValue(card.html, "article", { "data-game-pk": game.gamePk }, "data-matchup-rank"));
    assert(
      Number.isFinite(renderedMatchupScore) &&
        renderedMatchupScore >= WATCH_SCORE_RANGE.min &&
        renderedMatchupScore <= WATCH_SCORE_RANGE.max &&
        Number.isInteger(renderedMatchupRank) &&
        renderedMatchupRank >= 1,
      `${route} should pin matchup score/rank on the watch-card article for ${game.label}`,
    );
    if (!allowsRenderedLiveDataDrift(route)) {
      assert(
        renderedMatchupScore === game.matchupScore && renderedMatchupRank === game.matchupRankTonight,
        `${route} should match API matchup score/rank on the watch-card article for ${game.label}`,
      );
    }
    const renderedWatchRank = elementAttributeValue(card.html, "article", { "data-game-pk": game.gamePk }, "data-watch-rank");
    const renderedWatchSortGroup = Number(elementAttributeValue(card.html, "article", { "data-game-pk": game.gamePk }, "data-watch-sort-group"));
    const renderedWatchSortGroupLabel = elementAttributeValue(card.html, "article", { "data-game-pk": game.gamePk }, "data-watch-sort-group-label");
    const renderedWatchScoreTier = elementAttributeValue(card.html, "article", { "data-game-pk": game.gamePk }, "data-watch-score-tier");
    const renderedWatchTier = elementAttributeValue(card.html, "article", { "data-game-pk": game.gamePk }, "data-watch-tier");
    assert(
      (renderedWatchRank === "-" || Number.isInteger(Number(renderedWatchRank))) &&
        renderedWatchSortGroup === Number(expectedWatchSortGroupValueForStatus(allowLiveDataDrift ? renderedGameStatus : game.status)) &&
        renderedWatchSortGroupLabel === expectedWatchSortGroupLabelValueForStatus(allowLiveDataDrift ? renderedGameStatus : game.status) &&
        (allowLiveDataDrift || renderedWatchSortGroup === game.watchSortGroup) &&
        Boolean(renderedWatchScoreTier) &&
        Boolean(renderedWatchTier),
      `${route} should pin rank, sort group/label, and tier on the watch-card article for ${game.label}`,
    );
    const renderedWatchScoreText = elementAttributeValue(card.html, "article", { "data-game-pk": game.gamePk }, "data-watch-score");
    const renderedWatchScore = Number(renderedWatchScoreText);
    const renderedWatchScoreLabel = elementAttributeValue(card.html, "article", { "data-game-pk": game.gamePk }, "data-watch-score-label");
    assert(
      Number.isFinite(renderedWatchScore) &&
        renderedWatchScore >= WATCH_SCORE_RANGE.min &&
        renderedWatchScore <= WATCH_SCORE_RANGE.max &&
        /^\d+\.\d$/.test(renderedWatchScoreText ?? "") &&
        /^Watch score \d+(?:\.\d)$/.test(renderedWatchScoreLabel ?? ""),
      `${route} should pin watch score and public score label on the watch-card article for ${game.label}`,
    );
    if (!allowLiveDataDrift) {
      assert(
        renderedWatchScoreText === expectedWatchScoreValue(game) &&
          renderedWatchScoreLabel === expectedWatchScoreLabel(game) &&
          renderedWatchScoreTier === game.watchTier &&
          renderedWatchTier === expectedWatchTierLabelForGame(game),
        `${route} should match API watch score, score label, tier key, and public tier label on the watch-card article for ${game.label}`,
      );
    }
    const expectedStarterHrefs = game.starters.map((starter) =>
      starter.pitcherId ? expectedStarterFormHref(starter) : "none",
    );
    let renderedStarterHrefs = divAttributeValues(card.html, "data-starter-form-href", {
      role: "group",
    });
    if (allowLiveDataDrift && renderedStarterHrefs.length !== 2) {
      renderedStarterHrefs = renderedStarterFormHrefs[index]?.split("|") ?? [];
    }
    assert(
      allowLiveDataDrift
        ? renderedStarterHrefs.length === 2 &&
            renderedStarterHrefs.every((href) => href === "none" || /^\/pitchers\/[a-z0-9-]+-\d+\?from=upcoming$/.test(href))
        : renderedStarterHrefs.join(",") === expectedStarterHrefs.join(","),
      `${route} should pin or live-validate named starter Form hrefs on the watch-card starter blocks for ${game.label}`,
    );
    const starterHrefsToCheck = allowLiveDataDrift ? renderedStarterHrefs : expectedStarterHrefs;
    const cardLinkCounts = linkHrefCounts(
      allowLiveDataDrift && usedResponseArticleFallback ? html : card.html,
      starterHrefsToCheck.filter((href) => href !== "none"),
    );
    assert(
      starterHrefsToCheck
        .filter((href) => href !== "none")
        .every((href) => (cardLinkCounts.get(href) ?? 0) >= 1),
      `${route} should render each named starter Form href as a link inside the ${game.label} watch card`,
    );
    const expectedOpponentSplitLabels = game.starters
      .map((starter) => starter.opponentSplit?.label ?? "none")
      .filter((label) => label !== "none")
      .map(escapeHtmlAttribute);
    const renderedOpponentSplitLabels = divAttributeValues(card.html, "data-opponent-split-label");
    if (allowLiveDataDrift) {
      assert(
        renderedOpponentSplitLabels.every((label) => label.length > 0 && label !== "none"),
        `${route} should render non-empty opponent split labels inside the ${game.label} watch card when split chips are present`,
      );
    } else {
      assert(
        renderedOpponentSplitLabels.every((label) => expectedOpponentSplitLabels.includes(label)),
        `${route} should not render unexpected opponent split labels inside the ${game.label} watch card`,
      );
    }
    const summaryAttributes = {
      id: summaryId,
      "data-first-pitch": game.firstPitch,
      "data-venue": game.park ?? "Venue TBD",
    };
    if (!allowLiveDataDrift) {
      summaryAttributes["data-summary-status-label"] = expectedGameStatusLabel(game.status);
      summaryAttributes["aria-label"] = `${expectedGameStatusLabel(game.status)} ${game.label}, ${formatFirstPitch(game.firstPitch)}, ${game.park ?? "Venue TBD"}`;
    }
    assert(
      (usedResponseArticleFallback && allowLiveDataDrift
        ? elementHasAttributes(html, "p", summaryAttributes)
        : elementHasAttributes(card.html, "p", summaryAttributes)),
      `${route} should expose the watch-card summary status, description, timestamp, and venue for ${game.label}`,
    );
    if (allowLiveDataDrift) {
      const renderedSummaryStatus = elementAttributeValue(usedResponseArticleFallback ? html : card.html, "p", { id: summaryId }, "data-summary-status-label");
      assert(
        supportedGameStatusLabels().includes(renderedSummaryStatus),
        `${route} should expose a supported live-adjusted summary status label for ${game.label}`,
      );
      assertNonEmptyString(
        elementAttributeValue(usedResponseArticleFallback ? html : card.html, "p", { id: summaryId }, "aria-label"),
        `${route} should keep an accessible watch-card summary during live status drift for ${game.label}`,
      );
    }
    assert(cardDetailText.includes(game.label), `${route} should render visible card label for ${game.label}`);
    if (!allowLiveDataDrift) {
      assert(
        cardDetailText.includes(expectedGameStatusLabel(game.status)),
        `${route} should render visible status ${game.status} for ${game.label}`,
      );
    }
    assert(
      cardDetailText.includes(formatFirstPitch(game.firstPitch)),
      `${route} should render first pitch time for ${game.label}`,
    );
    assert(
      timeHasDateTime(cardDetailHtml, game.firstPitch),
      `${route} should render first pitch as a time element for ${game.label}`,
    );
    if (game.park) {
      assert(cardDetailText.includes(game.park), `${route} should render venue for ${game.label}`);
    } else {
      assert(cardDetailText.includes("Venue TBD"), `${route} should render venue fallback for ${game.label}`);
    }
    assertRenderedGameEnvironment(cardDetailHtml, cardDetailText, route, game);
    const renderedMatchupContextStatus = elementAttributeValue(card.html, "article", { "data-game-pk": game.gamePk }, "data-matchup-context-status");
    const renderedMatchupContextLabel = elementAttributeValue(card.html, "article", { "data-game-pk": game.gamePk }, "data-matchup-context-label");
    const renderedMatchupStatusLabel = elementAttributeValue(card.html, "article", { "data-game-pk": game.gamePk }, "data-matchup-status-label");
    assert(
      ["pending-opponent-splits", "scored"].includes(renderedMatchupContextStatus) &&
        typeof renderedMatchupContextLabel === "string" &&
        renderedMatchupContextLabel.length > 0 &&
        supportedMatchupStatusLabels().includes(renderedMatchupStatusLabel),
      `${route} should expose supported matchup context provenance and public status copy for ${game.label}`,
    );
    if (!allowLiveDataDrift) {
      assert(
        renderedMatchupContextStatus === game.matchupContext.status &&
          renderedMatchupContextLabel === game.matchupContext.label &&
          renderedMatchupStatusLabel === expectedMatchupStatusLabel(game),
        `${route} should pin exact matchup context provenance and public status copy for ${game.label}`,
      );
    }
    assert(
      ["Must-watch", "Worth it", "Background"].some((label) => cardDetailText.includes(label)),
      `${route} should render visible watch tier for ${game.label}`,
    );
    assertRenderedWatchRank(card.html, card.text, route, game, renderedWatchRank);
    if (card.html.includes('data-responsive-check="must-watch-headliner"')) {
      assertRenderedWatchHook(cardDetailHtml, cardDetailText, route, game, rankLabel);
      assertRenderedFormClash(cardDetailHtml, cardDetailText, route, game);
      assert(
        cardDetailText.includes("Top watch score") && cardDetailText.includes(`#1 ${rankLabel}`),
        `${route} should render the headliner watch rank with the active rank label for ${game.label}`,
      );
      assert(
        !card.html.includes(">#1 /"),
        `${route} should not duplicate the headliner watch rank in the eyebrow for ${game.label}`,
      );
    } else if (!allowsRenderedLiveDataDrift(route)) {
      assert(
        hasSlateWatchRank(card.text, Number(renderedWatchRank), scheduledGames),
        `${route} should render visible slate-relative watch rank for ${game.label}`,
      );
    }
    assert(cardDetailText.includes("Matchup"), `${route} should render matchup context for ${game.label}`);
    if (game.matchupContext?.status === "pending-opponent-splits") {
      assert(
        cardDetailText.includes("pending") || (allowsRenderedLiveDataDrift(route) && matchupSummaryIsAccessible(cardDetailHtml)),
        `${route} should render supported pending or live-adjusted matchup context for ${game.label}`,
      );
      assert(
        divHasAttributes(card.html, {
          role: "img",
          "aria-label": "Opponent split matchup context pending",
        }) || (allowsRenderedLiveDataDrift(route) && matchupSummaryIsAccessible(cardDetailHtml)),
        `${route} should render an accessible pending or live-adjusted matchup summary for ${game.label}`,
      );
    } else {
      assert(
        cardDetailText.includes("Matchup"),
        `${route} should render matchup score for ${game.label}`,
      );
      const renderedMatchupRank = Number(elementAttributeValue(cardDetailHtml, "div", {
        "data-responsive-check": "watch-components",
      }, "data-matchup-rank"));
      assert(
        Number.isInteger(renderedMatchupRank) && renderedMatchupRank >= 1,
        `${route} should expose matchup rank for ${game.label}`,
      );
      assert(
        matchupSummaryIsAccessible(cardDetailHtml) ||
          (allowsRenderedLiveDataDrift(route) &&
            assertNonEmptyStringValue(elementAttributeValue(cardDetailHtml, "div", {
              "data-responsive-check": "watch-components",
            }, "data-watch-component-aria-label"))),
        `${route} should render an accessible matchup summary for ${game.label}`,
      );
    }
    if (usedResponseArticleFallback && allowLiveDataDrift) return;
    assertRenderedWatchFlags(cardDetailHtml, cardDetailText, route, game);
    assertRenderedWatchComponents(cardDetailHtml, cardDetailText, route, game, rankLabel);
    assertRenderedStarters(cardDetailHtml, cardDetailText, route, game, { requireSparkline: true });
  });
}

function expectedRenderedFormWindow(route) {
  return route.includes("window=3") ? 3 : route.includes("window=10") ? 10 : 5;
}

function renderedGameCard(html, route, game, rank, rankLabel) {
  const articles = html.match(/<article\b[^>]*>.*?<\/article>/gs) ?? [];
  const firstPitch = formatFirstPitch(game.firstPitch);
  const matchupRankLine = matchupStatusText(game, rankLabel);
  const normalizedArticles = articles
    .map((article) => ({ html: article, text: normalizeHtmlText(article) }))
  const identityMatches = normalizedArticles.filter((article) =>
    elementHasAttributes(article.html, "article", { "data-game-pk": game.gamePk }),
  );
  if (identityMatches.length > 0) {
    assert(identityMatches.length === 1, `${route} should render exactly one card article for ${game.label}`);
    return identityMatches[0];
  }
  const matches = normalizedArticles
    .filter(
      (article) =>
        article.text.includes(game.label) &&
        (rank === 1 ? article.text.includes("Top watch score") : article.text.includes("watch rank")) &&
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

function matchupSummaryIsAccessible(html) {
  const divs = html.match(/<div\b[^>]*>/g) ?? [];
  return divs.some((div) => {
    if (tagAttribute(div, "role") === "img" && /aria-label="(?:Matchup score \d+|Opponent split matchup context pending)/.test(div)) {
      return true;
    }
    if (tagAttribute(div, "data-responsive-check") !== "watch-components") return false;
    const ariaLabel = tagAttribute(div, "data-watch-component-aria-label") ?? tagAttribute(div, "aria-label") ?? "";
    const componentValues = (tagAttribute(div, "data-watch-component-values") ?? "").split("/");
    return (
      tagAttribute(div, "role") === "group" &&
      ariaLabel.length > 0 &&
      componentValues.some((value) => Number.isFinite(Number(value)))
    );
  });
}

function matchupStatusText(game, rankLabel) {
  if (game.matchupContext?.status === "pending-opponent-splits") return "Opponent split";
  return `${ordinal(game.matchupRankTonight)} ${rankLabel}`;
}

function expectedMatchupStatusLabel(game) {
  if (game.matchupContext?.status === "pending-opponent-splits") return "Matchup pending";
  return `${ordinal(game.matchupRankTonight)} matchup`;
}

function supportedMatchupStatusLabels() {
  return ["Matchup pending"].concat(Array.from({ length: 30 }, (_, index) => `${ordinal(index + 1)} matchup`));
}

function assertRenderedWatchHook(html, normalizedHtml, route, game, rankLabel) {
  const reason = expectedWatchHookReasonValue(game, rankLabel);
  const reasonKey = expectedWatchHookReasonKeyValue(game, rankLabel);
  if (allowsRenderedLiveDataDrift(route)) {
    const renderedReasonKey = elementAttributeValue(html, "div", { "data-responsive-check": "watch-hook" }, "data-hook-reason-key");
    const renderedReason = elementAttributeValue(html, "div", { "data-responsive-check": "watch-hook" }, "data-hook-reason");
    assert(
      ["best-matchup", "two-heating", "strikeout-upside", "fallback-slate", "fallback-group"].includes(renderedReasonKey) &&
        typeof renderedReason === "string" &&
        renderedReason.length > 0,
      `${route} should render one score-led hook for ${game.label} with supported live-adjusted reason provenance`,
    );
  } else {
    assert(
      countDivsWithAttributes(html, {
        "data-responsive-check": "watch-hook",
        "data-hook-score-label": "score",
        "data-hook-reason-key": reasonKey,
        "data-hook-reason": reason,
      }) === 1,
      `${route} should render one score-led hook for ${game.label} with the expected reason branch`,
    );
  }
  const renderedHookScoreText = elementAttributeValue(html, "div", { "data-responsive-check": "watch-hook" }, "data-hook-score");
  const renderedHookScore = Number(renderedHookScoreText);
  assert(
    Number.isFinite(renderedHookScore) && renderedHookScore >= 0 && renderedHookScore <= 100 && /^\d+(?:\.\d)$/.test(renderedHookScoreText ?? ""),
    `${route} should render a one-decimal 0-100 hook score for ${game.label}`,
  );
  assert(normalizedHtml.includes("The hook"), `${route} should label the center hook for ${game.label}`);
  assert(normalizedHtml.includes(renderedHookScore.toFixed(1)), `${route} should render watch score in the center hook for ${game.label}`);
  if (!allowsRenderedLiveDataDrift(route)) {
    assert(normalizedHtml.includes(reason), `${route} should render derived hook reason for ${game.label}`);
  }
  assert(
    !html.includes(`>#${game.matchupRankTonight}<`) && !html.includes(`matchup ${escapeHtmlAttribute(rankLabel)}</p>`),
    `${route} center hook should not render matchup rank copy for ${game.label}`,
  );
}

function expectedWatchHookReason(game, rankLabel) {
  const reasonKey = expectedWatchHookReasonKey(game, rankLabel);
  if (reasonKey === "fallback-slate" || reasonKey === "fallback-group") {
    return isSlateRankLabel(rankLabel) ? "Top watch score on the slate" : "Top watch score in this group";
  }
  if (reasonKey === "best-matchup") return "Best matchup on the board";
  if (reasonKey === "two-heating") return "Two arms trending up";
  if (reasonKey === "strikeout-upside") return "Strikeout upside";
  return isSlateRankLabel(rankLabel) ? "Top watch score on the slate" : "Top watch score in this group";
}

function expectedWatchHookReasonKey(game, rankLabel) {
  if (game.flags?.tbd || game.flags?.limitedForm || game.flags?.likelyOpener || game.matchupContext?.status === "pending-opponent-splits") {
    return isSlateRankLabel(rankLabel) ? "fallback-slate" : "fallback-group";
  }
  if (game.matchupRankTonight === 1) return "best-matchup";
  if (game.starters.every((starter) => starter.trend === "heating")) return "two-heating";
  if (combinedProjectedStrikeouts(game.starters) >= 12) return "strikeout-upside";
  return isSlateRankLabel(rankLabel) ? "fallback-slate" : "fallback-group";
}

function expectedWatchComponentDetails(game, rankLabel) {
  return [
    "none",
    "none",
    game.matchupContext?.status === "pending-opponent-splits" ? "pending" : `${ordinal(game.matchupRankTonight)} ${rankLabel}`,
  ];
}

function expectedWatchComponentItemAriaLabels(game, rankLabel) {
  const [, , matchupDetail] = expectedWatchComponentDetails(game, rankLabel);
  return [
    "none",
    "none",
    matchupDetail === "pending"
      ? "Opponent split matchup context pending"
      : `Matchup score ${Math.round(game.matchupScore)}, ranked ${matchupDetail}`,
  ];
}

function supportedWatchHookReasonKeys() {
  return ["best-matchup", "two-heating", "strikeout-upside", "fallback-slate", "fallback-group"];
}

function isSlateRankLabel(rankLabel) {
  return rankLabel === "today" || rankLabel === "tomorrow" || rankLabel === "yesterday" || rankLabel.startsWith("on ");
}

function combinedProjectedStrikeouts(starters) {
  return starters.reduce((total, starter) => {
    const projected = starter.marketContext?.projectedStrikeouts ?? starter.projection?.line?.strikeouts ?? 0;
    return total + projected;
  }, 0);
}

function assertRenderedGameEnvironment(html, normalizedHtml, route, game) {
  assert(
    normalizedHtml.includes(`Park ${game.parkContext.runFactor.toFixed(2)}`),
    `${route} should render park factor chip for ${game.label}`,
  );
  assert(
    html.includes(`title="${escapeHtmlAttribute(game.parkContext.label)}"`),
    `${route} should expose park context detail for ${game.label}`,
  );
  assert(
    spanHasAttributes(html, {
      "data-context-chip": "park",
      "data-context-source": "shared-venue-run-factors",
      "data-context-run-value": game.parkContext.runValue.toFixed(1),
      "data-context-label": game.parkContext.label,
      "data-context-tone": expectedParkContextTone(game.parkContext),
      "data-context-park-factor": game.parkContext.runFactor.toFixed(2),
      title: game.parkContext.label,
    }),
    `${route} should pin park context source/run value/label/tone/factor for ${game.label}`,
  );
  assert(
    renderedWeatherChipMatches(html, normalizedHtml, game),
    `${route} should render weather chip for ${game.label}`,
  );
  const renderedWeatherRunValue = Number(elementAttributeValue(html, "span", {
    "data-context-chip": "weather",
    "data-context-source": game.weatherContext.source,
    "data-context-run-value": game.weatherContext.runValue.toFixed(1),
    "data-context-label": game.weatherContext.label,
    "data-context-tone": expectedWeatherContextTone(game.weatherContext),
    "data-weather-temp-f": weatherMetricValue(game.weatherContext.tempF, 0),
    "data-weather-wind-mph": weatherMetricValue(game.weatherContext.windMph, 0),
    "data-weather-precip-probability": weatherMetricValue(game.weatherContext.precipProbability, 0),
  }, "data-context-run-value"));
  assert(
    Number.isFinite(renderedWeatherRunValue),
    `${route} should pin weather context source/run value/label/tone/raw metrics for ${game.label}`,
  );
}

function weatherMetricValue(value, precision) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(precision) : "pending";
}

function expectedParkContextTone(parkContext) {
  if (parkContext.runFactor >= 1.06) return "warm";
  if (parkContext.runFactor <= 0.96) return "cool";
  return "muted";
}

function expectedWeatherContextTone(weatherContext) {
  if (weatherContext.runValue > 0.4) return "warm";
  if (weatherContext.runValue < -0.4) return "cool";
  return "muted";
}

function assertRenderedWatchRank(html, normalizedHtml, route, game, renderedWatchRank) {
  if (allowsRenderedLiveDataDrift(route)) {
    const renderedWatchTier = elementAttributeValue(html, "article", { "data-game-pk": game.gamePk }, "data-watch-tier");
    assert(
      (renderedWatchRank === "-" || Number.isInteger(Number(renderedWatchRank))) &&
        WATCH_TIER_LABELS.includes(renderedWatchTier),
      `${route} should pin a supported watch rank/tier for ${game.label}`,
    );
    return;
  }

  const rank = Number(renderedWatchRank);
  assert(Number.isInteger(rank) && rank >= 1, `${route} should expose a numeric rendered watch rank for ${game.label}`);
  const tierLabel = expectedWatchTierLabelForGame(game);
  const visibleRank = `#${rank}`;
  const visibleRankPattern = new RegExp(`#\\s*${rank}\\b`);
  assert(
    visibleRankPattern.test(normalizedHtml) && normalizedHtml.includes(tierLabel),
    `${route} should render visible watch rank ${visibleRank} with tier ${tierLabel} for ${game.label}`,
  );
}

function assertRenderedWatchComponents(html, normalizedHtml, route, game, rankLabel) {
  const componentDetails = expectedWatchComponentDetails(game, rankLabel);
  const componentItemAriaLabels = expectedWatchComponentItemAriaLabels(game, rankLabel);
  const expectedLayout = html.includes('data-watch-card-kind="headliner"') ? "featured" : "compact";
  const componentValues = [
    game.watchComponents?.topArm,
    game.watchComponents?.pairing,
    game.matchupScore,
  ];
  componentValues.forEach((value, index) =>
    assertNumber(value, `${route} ${game.label} ${WATCH_COMPONENT_LABELS[index]} watch component`),
  );
  if (allowsRenderedLiveDataDrift(route)) {
    const componentGroupTag = (html.match(/<div\b[^>]*>/g) ?? []).find((tag) =>
      tag.includes('data-responsive-check="watch-components"') &&
        tag.includes(`data-game-pk="${escapeHtmlAttribute(game.gamePk)}"`),
    ) ?? "";
    const renderedValues = (tagAttribute(componentGroupTag, "data-watch-component-values") ?? "").split("/");
    assert(
      tagAttribute(componentGroupTag, "data-watch-component-count") === expectedWatchComponentCountValue() &&
        tagAttribute(componentGroupTag, "data-watch-component-keys") === expectedWatchComponentKeysValue() &&
        tagAttribute(componentGroupTag, "data-watch-component-layout") === expectedLayout &&
        tagAttribute(componentGroupTag, "data-watch-component-labels") === expectedWatchComponentLabelsValue() &&
        renderedValues.length === WATCH_COMPONENT_KEYS.length &&
        renderedValues.every((value) => Number.isFinite(Number(value))) &&
        assertNonEmptyStringValue(tagAttribute(componentGroupTag, "data-watch-component-details")) &&
        assertNonEmptyStringValue(tagAttribute(componentGroupTag, "data-watch-component-item-aria-labels")) &&
        assertNonEmptyStringValue(tagAttribute(componentGroupTag, "data-watch-component-aria-label")) &&
        tagAttribute(componentGroupTag, "role") === "group" &&
        assertNonEmptyStringValue(tagAttribute(componentGroupTag, "aria-label")),
      `${route} should render a live-safe responsive watch-component group with canonical layout, component order, labels, values, details, and aria labels for ${game.label}`,
    );
    return;
  }
  const componentGroupCount = countDivsWithAttributes(html, {
    "data-responsive-check": "watch-components",
    "data-game-pk": game.gamePk,
    "data-watch-component-count": expectedWatchComponentCountValue(),
    "data-watch-component-keys": expectedWatchComponentKeysValue(),
    "data-watch-component-layout": expectedLayout,
    "data-watch-component-labels": expectedWatchComponentLabelsValue(),
    "data-watch-component-values": componentValues.map((value) => value.toFixed(1)).join("/"),
    "data-watch-component-details": componentDetails.join("/"),
    "data-watch-component-item-aria-labels": componentItemAriaLabels.join("/"),
    "data-watch-component-aria-label": expectedWatchComponentsAriaLabelValue(game),
    role: "group",
    "aria-label": expectedWatchComponentsAriaLabelValue(game),
  });
  assert(componentGroupCount >= 1, `${route} should render a responsive watch-component group with canonical layout, component order, labels, values, details, and item aria labels for ${game.label}`);

  for (const [index, key] of WATCH_COMPONENT_KEYS.entries()) {
    const label = WATCH_COMPONENT_LABELS[index];
    const value = componentValues[index];
    const itemAriaLabel = componentItemAriaLabels[index];
    assert(normalizedHtml.includes(label), `${route} should render ${label} watch component for ${game.label}`);
    const expectedDetail = componentDetails[index];
    const renderedComponentAttributes = {
      "data-watch-component": key,
      "data-watch-label": label,
      "data-watch-detail": expectedDetail,
      "data-watch-item-aria-label": itemAriaLabel,
    };
    const renderedComponentTag = (html.match(/<div\b[^>]*>/g) ?? []).find((tag) =>
      Object.entries(renderedComponentAttributes).every(([name, attributeValue]) =>
        tag.includes(`${name}="${escapeHtmlAttribute(attributeValue)}"`),
      ),
    ) ?? "";
    const renderedValue = Number(tagAttribute(renderedComponentTag, "data-watch-value"));
    const renderedAriaLabel = renderedComponentTag.match(/(?:^|\s)aria-label="([^"]*)"/)?.[1] ?? null;
    assert(
      renderedValue === Number(value.toFixed(1)) && (itemAriaLabel === "none" ? renderedAriaLabel === null : renderedAriaLabel === itemAriaLabel),
      `${route} should pin ${label} watch component label, detail, exact value, and item aria label for ${game.label}`,
    );
  }
}

function assertRenderedFormClash(html, normalizedHtml, route, game) {
  const [away, home] = game.starters;
  const ready = expectedStarterSparkReady(away) === "true" && expectedStarterSparkReady(home) === "true";
  const tagName = ready ? "div" : "p";
  const awayAccent = expectedStarterAccent(away);
  const homeAccent = expectedStarterAccent(home);
  if (allowsRenderedLiveDataDrift(route)) {
    const formClashTag = html.match(/<(?:div|p|span)\b[^>]*data-form-clash-status="([^"]*)"[^>]*>/)?.[0] ?? "";
    const renderedStatus = tagAttribute(formClashTag, "data-form-clash-status");
    const renderedAwayReady = tagAttribute(formClashTag, "data-form-clash-away-spark-ready");
    const renderedHomeReady = tagAttribute(formClashTag, "data-form-clash-home-spark-ready");
    const renderedReadinessFresh = Boolean(renderedAwayReady || renderedHomeReady);
    assert(
      formClashTag &&
        ["ready", "pending"].includes(renderedStatus) &&
        (!renderedReadinessFresh ||
          (["true", "false"].includes(renderedAwayReady) &&
            ["true", "false"].includes(renderedHomeReady) &&
            renderedStatus === (renderedAwayReady === "true" && renderedHomeReady === "true" ? "ready" : "pending"))) &&
        /^\d+$/.test(tagAttribute(formClashTag, "data-form-clash-away-spark-count")) &&
        /^\d+$/.test(tagAttribute(formClashTag, "data-form-clash-home-spark-count")),
      `${route} should expose stable live-adjusted form-clash spark metadata and self-consistent readiness when fresh attributes render for ${game.label}`,
    );
    assert(
      renderedStatus !== "ready" || normalizedHtml.includes("Form clash"),
      `${route} should render headliner form-clash copy when the form clash is ready for ${game.label}`,
    );
    return;
  }
  assert(
    elementHasAttributes(html, tagName, {
      "data-form-clash-status": ready ? "ready" : "pending",
      "data-form-clash-away-team": away.team,
      "data-form-clash-home-team": home.team,
      "data-form-clash-away-accent-source": awayAccent.source,
      "data-form-clash-away-accent-band": awayAccent.band,
      "data-form-clash-away-accent-color": awayAccent.color,
      "data-form-clash-home-accent-source": homeAccent.source,
      "data-form-clash-home-accent-band": homeAccent.band,
      "data-form-clash-home-accent-color": homeAccent.color,
      "data-form-clash-same-band": String(awayAccent.band === homeAccent.band),
      "data-form-clash-away-spark-count": starterSparkCountValue(away),
      "data-form-clash-home-spark-count": starterSparkCountValue(home),
      "data-form-clash-away-spark-ready": expectedStarterSparkReady(away),
      "data-form-clash-home-spark-ready": expectedStarterSparkReady(home),
    }),
    `${route} should pin headliner form-clash state, form-band accents, spark counts, and readiness for ${game.label}`,
  );
  assert(
    normalizedHtml.includes(ready ? "Form clash" : "Form clash pending"),
    `${route} should render the expected headliner form-clash copy for ${game.label}`,
  );
}

function assertRenderedWatchFlags(html, normalizedHtml, route, game) {
  if (allowsRenderedLiveDataDrift(route)) {
    const noteTag = html.match(/<p\b[^>]*data-watch-flag-count="([^"]*)"[^>]*>/)?.[0] ?? "";
    if (!noteTag) return;
    const keys = csvAttributeValues(tagAttribute(noteTag, "data-watch-flag-keys"));
    const count = Number(tagAttribute(noteTag, "data-watch-flag-count"));
    assert(
      Number.isInteger(count) &&
        count === keys.length &&
        count >= 0 &&
        keys.every((key) => ["tbd", "cold-start", "join-gap", "pending-opponent-splits"].includes(key)) &&
        (count === 0 || assertNonEmptyStringValue(tagAttribute(noteTag, "aria-label"))),
      `${route} should expose valid live-adjusted watch-card fallback reason metadata for ${game.label}`,
    );
    return;
  }

  if (game.flags?.tbd) {
    assert(
      normalizedHtml.includes("Starter unconfirmed. Score uses league baseline."),
      `${route} should explain TBD starter fallback on ${game.label}`,
    );
  }

  if (game.flags?.coldStartForm) {
    assert(
      normalizedHtml.includes("Cold-start pitchers use baseline fallback where needed."),
      `${route} should explain cold-start baseline fallback on ${game.label}`,
    );
  }

  if (game.flags?.joinGapForm) {
    assert(
      normalizedHtml.includes("Form pending for a scheduled pitcher."),
      `${route} should explain join-gap form pending state on ${game.label}`,
    );
  }

  if (game.flags?.likelyOpener) {
    assert(
      normalizedHtml.includes("Likely opener / bullpen game") || normalizedHtml.includes("Likely opener or bullpen game."),
      `${route} should explain likely opener treatment on ${game.label}`,
    );
  }

  if (game.matchupContext?.status === "pending-opponent-splits") {
    assert(
      normalizedHtml.includes("Opponent split context pending."),
      `${route} should explain pending opponent split context on ${game.label}`,
    );
  }

  if (game.flags?.tbd || game.flags?.coldStartForm || game.flags?.joinGapForm || game.flags?.likelyOpener || game.matchupContext?.status === "pending-opponent-splits") {
    assert(
      elementHasAttributes(html, "p", {
        "aria-label": watchFlagNoteAriaLabel(game),
        "data-watch-flag-count": String(watchFlagNoteKeys(game).length),
        "data-watch-flag-keys": watchFlagNoteKeys(game).join(","),
        "data-watch-flag-label": watchFlagNoteDataLabel(game),
      }),
      `${route} should expose accessible watch-card fallback context, reason keys, and public label for ${game.label}`,
    );
  }
}

function assertRenderedStarters(html, normalizedHtml, route, game, options = {}) {
  const expectedHeadshotSize = html.includes('data-responsive-check="must-watch-headliner"') ? "xl" : "sm";
  const expectedStarterLayout = expectedHeadshotSize === "xl" ? "duel" : "mini";
  game.starters.forEach((starter) => {
    const label = `${route} ${game.label} ${starter.side} starter`;
    if (allowsRenderedLiveDataDrift(route)) {
      assert(normalizedHtml.includes(starter.team), `${label} should render ${starter.team}`);
      if (html.includes('role="group"') && html.includes("data-starter-side=")) {
        assert(
          starterGroupHasSupportedMetadata(html, starter, { allowIdentityDrift: true }),
          `${label} should expose a valid live-adjusted grouped starter block`,
        );
      }
      if (html.includes("data-headshot-size=")) {
        assert(
          spanHasSupportedHeadshotMetadata(html),
          `${label} headshot should expose supported thermal form band and starter status metadata during fallback live-data drift`,
        );
      }
      return;
    }
    const starterName = starter.name ?? "TBD";
    assert(normalizedHtml.includes(starterName), `${label} should render ${starterName}`);
    assert(normalizedHtml.includes(starter.team), `${label} should render ${starter.team}`);
    assert(
      divHasAttributes(html, {
        role: "group",
        "aria-label": starterBlockAriaLabel(starter),
        "data-starter-layout": expectedStarterLayout,
        "data-starter-side": starter.side,
        "data-starter-pitcher-id": starter.pitcherId ?? "tbd",
        "data-starter-name": starter.name ?? "TBD",
        "data-starter-team": starter.team,
        "data-starter-status": starter.status,
        "data-starter-accent-source": expectedStarterAccent(starter).source,
        "data-starter-accent-band": expectedStarterAccent(starter).band,
        "data-starter-accent-color": expectedStarterAccent(starter).color,
        "data-starter-form-href": starter.pitcherId ? expectedStarterFormHref(starter) : "none",
        "data-starter-name-linked": String(Boolean(starter.pitcherId)),
        "data-starter-fallback-label": starter.status === "ok" ? "none" : starterFallbackAriaLabel(starter),
        "data-starter-form-tier": starter.tier ?? "none",
        "data-starter-form-trend": starter.trend ?? "none",
        "data-starter-rgs": starterFormValue(starter.rgs),
        "data-starter-delta-form": starterFormValue(starter.deltaForm),
        "data-starter-spark-count": starterSparkCountValue(starter),
        "data-starter-spark-ready": expectedStarterSparkReady(starter),
        "data-starter-spark-latest": starterSparkLatestValue(starter),
        "data-starter-window-count": starter.windowCount === null || starter.windowCount === undefined ? "pending" : String(starter.windowCount),
        "data-starter-season-ip": starterSeasonValue(starter.seasonStats?.inningsPitched, 1),
        "data-starter-season-era": starterSeasonValue(starter.seasonStats?.era, 2),
        "data-starter-season-whip": starterSeasonValue(starter.seasonStats?.whip, 2),
        "data-starter-season-k9": starterSeasonValue(starter.seasonStats?.k9, 1),
        "data-starter-last-start-date": starterLastStartValue(starter, "gameDate"),
        "data-starter-last-start-game-pk": starterLastStartValue(starter, "gamePk"),
        "data-starter-last-start-opponent": starterLastStartValue(starter, "opp"),
        "data-starter-last-start-park": starterLastStartValue(starter, "park"),
        "data-starter-last-start-line": starterLastStartValue(starter, "line"),
        "data-starter-last-start-gs-plus": starterLastStartValue(starter, "gsPlus"),
        "data-starter-last-start-tier": starterLastStartValue(starter, "tier"),
        "data-starter-last-start-href": starterLastStartValue(starter, "startHref"),
        "data-starter-days-rest": starter.workload?.daysRest === null || starter.workload?.daysRest === undefined ? "pending" : String(starter.workload.daysRest),
        "data-starter-rest-label": starter.workload?.restLabel ?? "unknown",
        "data-starter-avg-pitches-last-5": workloadValue(starter.workload?.avgPitchesLast5),
        "data-starter-avg-ip-last-5": workloadValue(starter.workload?.avgIpLast5),
        "data-starter-limited-sample": String(starter.flags?.limitedSample === true),
        "data-starter-rust": String(starter.flags?.rust === true),
        "data-starter-driver-count": String(starter.driverChips?.length ?? 0),
        "data-starter-visible-driver-count": String(Math.min(starter.driverChips?.length ?? 0, 3)),
        "data-starter-top-driver-key": starterTopDriverValue(starter, "key"),
        "data-starter-top-driver-label": starterTopDriverValue(starter, "label"),
        "data-starter-top-driver-direction": starterTopDriverValue(starter, "direction"),
        "data-starter-top-driver-delta": starterTopDriverValue(starter, "delta"),
        "data-starter-top-driver-score": starterTopDriverValue(starter, "score"),
      }),
      `${label} should expose its layout, side, pitcher id, name, team, status, form-band accent, form href, name link state, fallback label, form summary, sparkline state, season baseline, last-start source, workload state, and driver provenance on a grouped starter block`,
    );
    assert(
      spanHasAttributes(html, {
        "data-form-band": starterHeadshotFormBand(starter),
        "data-headshot-size": expectedHeadshotSize,
        "data-starter-status": starter.status,
      }),
      `${label} headshot should expose its thermal form band, display size, and starter status`,
    );
    if (starter.pitcherId) {
      assert(
        anchorHasAttributes(html, {
          href: expectedStarterFormHref(starter),
          "aria-label": `View ${starter.name} form`,
        }),
        `${label} starter name link should point to pitcher Form with an accessible label`,
      );
      assert(
        html.includes(`/people/${starter.pitcherId}/headshot/67/current`),
        `${label} should render a linked MLB headshot`,
      );
      assert(
        sharedHeadshotImageMatches(html, starter.pitcherId),
        `${label} headshot image should use the shared decorative MLB headshot markup with stable dimensions`,
      );
      assert(
        anchorHasAttributes(html, {
          href: expectedStarterFormHref(starter),
          "aria-label": `${starter.name} form`,
        }),
        `${label} headshot link should point to pitcher Form with an accessible label`,
      );
    }
    assert(starter.projection && typeof starter.projection === "object", `${label} should include projection data`);
    assert(
      elementHasAttributes(html, starter.projection.status === "line-backed" ? "div" : "p", {
        "data-projection-status": starter.projection.status,
        "data-projection-confidence": starter.projection.confidence,
        "data-projection-notes": starter.projection.notes.join("; "),
        "data-projection-line-token-count": String(projectionLineTokenCount(starter.projection)),
        "data-projected-gs-plus": projectionValue(starter.projection.projectedGsPlus),
        "data-projected-innings": projectionValue(starter.projection.line.inningsPitched),
        "data-projected-strikeouts": projectionValue(starter.projection.line.strikeouts),
        "data-projected-earned-runs": projectionValue(starter.projection.line.earnedRuns),
      }),
      `${label} should pin projection status, confidence, visible token count, and projected line values`,
    );

    if (starter.status === "ok") {
      assertNumber(starter.rgs, `${label} rendered rgs`);
      assertNumber(starter.deltaForm, `${label} rendered deltaForm`);
      assert(normalizedHtml.includes(starter.rgs.toFixed(1)), `${label} should render recent-form GS+ ${starter.rgs.toFixed(1)}`);
      assert(!normalizedHtml.includes(`Form ${starter.rgs.toFixed(1)}`), `${label} should not prefix recent-form GS+ with Form`);
      assert(
        normalizedHtml.includes(`${expectedTrendLabel(starter.trend)} ${formatSignedValue(starter.deltaForm)}`),
        `${label} should render trend ${starter.trend} ${formatSignedValue(starter.deltaForm)}`,
      );
      const expectedStatusChipCount = starterStatusChipCount(starter);
      if (expectedStatusChipCount > 0) {
        assert(
          divHasAttributes(html, {
            "aria-label": `${starter.name ?? "Starter"} rest and workload`,
            "data-starter-status-chip-count": String(expectedStatusChipCount),
          }),
          `${label} should pin the visible rest/workload chip count`,
        );
      }
      if (options.requireSparkline) {
        assert(
          html.includes(`aria-label="${starter.name} recent form GS+: ${starter.spark.join(", ")}"`),
          `${label} should render accessible recent-form sparkline`,
        );
      }
      if (starter.seasonStats?.era !== null && starter.seasonStats?.inningsPitched >= 10) {
        assert(
          normalizedHtml.includes(`${starter.seasonStats.era.toFixed(2)} L5 ERA`) &&
            normalizedHtml.includes("ERA over the selected recent-start form window"),
          `${label} should render recent-window ERA anchor ${starter.seasonStats.era.toFixed(2)}`,
        );
      }
      starter.driverChips?.slice(0, 1).forEach((chip) => {
        assert(normalizedHtml.includes(chip.label), `${label} should render top form driver chip ${chip.label}`);
      });
      assert(starter.projection && starter.projection.status === "line-backed", `${label} should include a line-backed projection`);
      assertNumber(starter.projection.projectedGsPlus, `${label} projectedGsPlus`);
      assert(["low", "medium", "high"].includes(starter.projection.confidence), `${label} projection confidence should be supported`);
      assert(normalizedHtml.includes("Proj GS+"), `${label} should render projected GS+`);
      if (starter.projection.line.inningsPitched !== null) {
        assert(normalizedHtml.includes("IP"), `${label} should render projected IP`);
      }
      if (starter.opponentSplit) {
        assert(normalizedHtml.includes(`Opp ${starter.opponentSplit.split === "vs-lhp" ? "vs LHP" : "vs RHP"}`), `${label} should render opponent handedness split`);
        assert(normalizedHtml.includes(`${starter.opponentSplit.ops.toFixed(3)} OPS`), `${label} should render opponent OPS split`);
        assert(
          divHasAttributes(html, {
            "aria-label": `${starter.name} opponent split context`,
            "data-opponent-split-team": starter.opponentSplit.team,
            "data-opponent-split": starter.opponentSplit.split,
            "data-opponent-split-label": starter.opponentSplit.label,
            "data-opponent-split-ops": starter.opponentSplit.ops.toFixed(3),
            "data-opponent-split-k-rate": starter.opponentSplit.strikeoutRate.toFixed(3),
            "data-opponent-split-ops-rank": String(starter.opponentSplit.opsRank),
            "data-opponent-split-k-rate-rank": String(starter.opponentSplit.strikeoutRateRank),
            "data-opponent-split-run-value": starter.opponentSplit.matchupRunValue.toFixed(1),
          }),
          `${label} should pin opponent split source, label, ranks, and values`,
        );
      }
      assert(normalizedHtml.includes("Proj K"), `${label} should render projected K market strip`);
      assert(normalizedHtml.includes("prop pending") || normalizedHtml.includes("K edge"), `${label} should render strikeout prop state`);
      assert(
        divHasAttributes(html, {
          "aria-label": `${starter.name} betting and DFS context`,
          "data-market-status": starter.marketContext.status,
          "data-market-source": starter.marketContext.source,
          "data-market-label": starter.marketContext.label,
          "data-projected-strikeouts": marketValue(starter.marketContext.projectedStrikeouts),
          "data-strikeout-prop-line": marketValue(starter.marketContext.strikeoutPropLine),
          "data-strikeout-edge": marketValue(starter.marketContext.strikeoutEdge),
          "data-opposing-team-total": marketValue(starter.marketContext.opposingTeamTotal),
        }),
        `${label} should pin market status/source, label, and projected market values`,
      );
      return;
    }

    if (starter.status === "insufficient") {
      assert(
        elementHasAttributes(html, "p", { "aria-label": starterFallbackAriaLabel(starter) }),
        `${label} should expose accessible limited-form fallback copy`,
      );
      assert(
        starter.limitedReason === "join_gap"
          ? normalizedHtml.includes("Form pending")
          : normalizedHtml.includes("Limited form sample") || normalizedHtml.includes("Limited"),
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
      if (starter.limitedReason === "cold_start") {
        assert(normalizedHtml.includes("BASELINE") || normalizedHtml.includes("Baseline"), `${label} should stamp cold-start projections as baseline`);
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

function expectedStarterFormHref(starter) {
  return `/pitchers/${pitcherSlug(starter.name, starter.pitcherId)}?from=upcoming`;
}

function starterFormHrefMatches(href, pitcherId) {
  if (!href || !pitcherId || !/^\d+$/.test(pitcherId)) return false;
  return new RegExp(`^/pitchers/[a-z0-9-]*-${pitcherId}\\?from=upcoming$`).test(href);
}

function pitcherSlug(name, fallbackId) {
  const slug = (name ?? "")
    .toLowerCase()
    .replace(/['.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "pitcher"}-${fallbackId}`;
}

function starterFallbackAriaLabel(starter) {
  if (starter.status === "tbd") return "Starter unconfirmed. Score uses league baseline.";
  if (starter.limitedReason === "join_gap") return "Form pending";
  return "Limited form sample / baseline projection";
}

function starterHeadshotFormBand(starter) {
  return starter.status === "ok" && starter.flags?.limitedSample !== true ? starter.tier ?? "neutral" : "neutral";
}

function watchFlagNoteAriaLabel(game) {
  const notes = [];
  if (game.flags?.tbd) notes.push("Starter unconfirmed. Score uses league baseline");
  if (game.flags?.likelyOpener) notes.push("Likely opener or bullpen game");
  if (game.flags?.coldStartForm) notes.push("Cold-start pitchers use baseline fallback where needed");
  if (game.flags?.joinGapForm) notes.push("Form pending for a scheduled pitcher");
  if (game.matchupContext?.status === "pending-opponent-splits") notes.push("Opponent split context pending");
  return notes.join("; ");
}

function watchFlagNoteKeys(game) {
  const keys = [];
  if (game.flags?.tbd) keys.push("tbd");
  if (game.flags?.coldStartForm) keys.push("cold-start");
  if (game.flags?.joinGapForm) keys.push("join-gap");
  if (game.flags?.likelyOpener) keys.push("likely-opener");
  if (game.matchupContext?.status === "pending-opponent-splits") keys.push("pending-opponent-splits");
  return keys;
}

function watchFlagNoteDataLabel(game) {
  return watchFlagNoteAriaLabel(game) || "clear";
}

function watchComponentsAriaLabel(game) {
  return `Watch components for ${game.label} on ${formatUpcomingDate(game.date)}`;
}

function renderedWeatherChipMatches(html, normalizedHtml, game) {
  if (html.includes("game-time weather") || html.includes("weather profile unavailable") || html.includes("weather is treated as neutral")) return true;
  if (game.weatherContext.source === "indoor") return normalizedHtml.includes("Indoor");
  if (game.weatherContext.source === "unavailable") return normalizedHtml.includes("Forecast unavailable");
  return normalizedHtml.includes("F")
    || normalizedHtml.includes("mph wind")
    || normalizedHtml.includes("Weather neutral")
    || normalizedHtml.includes("Forecast unavailable");
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

async function loadDefaultUpcomingSnapshot(baseUrl) {
  const defaultDateResponse = await fetch(`${baseUrl}/api/upcoming?window=${encodeURIComponent(windowSize)}`);
  assert(defaultDateResponse.ok, `/api/upcoming default date returned HTTP ${defaultDateResponse.status}`);
  const defaultDateUpcoming = await defaultDateResponse.json();
  assertDateKey(defaultDateUpcoming.range?.start, "default date query range start");
  assert(defaultDateUpcoming.range?.start === defaultDateUpcoming.range?.end, "default date query should return a one-day range");
  assert(Array.isArray(defaultDateUpcoming.days) && defaultDateUpcoming.days.length === 1, "default date query should return one day group");
  const homeSlateDate = defaultDateUpcoming.range.start;
  const defaultDayTotals = assertDay(defaultDateUpcoming.days[0], defaultDateUpcoming.range.start, { requireCompleteStarter: true });

  const defaultWeekResponse = await fetch(`${baseUrl}/api/upcoming?start=${encodeURIComponent(defaultDateUpcoming.range.start)}&days=7&window=${encodeURIComponent(windowSize)}`);
  assert(defaultWeekResponse.ok, `/api/upcoming default week returned HTTP ${defaultWeekResponse.status}`);
  const defaultWeekUpcoming = await defaultWeekResponse.json();
  assert(defaultWeekUpcoming.range?.start === defaultDateUpcoming.range.start, "default week query should start from the home slate date");
  assert(defaultWeekUpcoming.range?.end === addDays(defaultDateUpcoming.range.start, 6), "default week query should return a seven-day range");
  assert(Array.isArray(defaultWeekUpcoming.days) && defaultWeekUpcoming.days.length === 7, "default week query should return seven day groups");
  const defaultWeekTotals = defaultWeekUpcoming.days.map((day, index) => assertDay(day, addDays(defaultDateUpcoming.range.start, index), { requireCompleteStarter: index === 0 }));
  const defaultWeekGameCount = defaultWeekTotals.reduce((total, row) => total + row.games, 0);
  const defaultWeekGames = expectedOrderedUpcomingWeekGameValues(defaultWeekUpcoming);

  return {
    defaultDateUpcoming,
    homeSlateDate,
    defaultDayTotals,
    defaultWeekUpcoming,
    defaultWeekGameCount,
    defaultWeekGames,
  };
}

const port = await reservePort();
const baseUrl = `http://${host}:${port}`;
const serverEnv = {
  ...process.env,
  PORT: String(port),
  THE_BUMP_ALLOW_VOLATILE_CANONICAL_STORE: "1",
};
for (const key of [
  "THE_BUMP_SUPABASE_URL",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "THE_BUMP_SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "THE_BUMP_SUPABASE_SECRET_KEY",
  "SUPABASE_SECRET_KEY",
]) {
  delete serverEnv[key];
}
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
  env: serverEnv,
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
  assertPinnedUpcomingMetadataFixtures();
  await waitForHttp(baseUrl);

  const response = await fetch(`${baseUrl}/api/upcoming?start=${encodeURIComponent(date)}&days=${encodeURIComponent(days)}&window=${encodeURIComponent(windowSize)}`);
  assert(response.ok, `/api/upcoming returned HTTP ${response.status}`);
  const upcoming = await readJson(response, "/api/upcoming range query");

  const expectedDays = Math.max(1, Math.min(7, Number(days)));
  assertUpcomingEnvelope(upcoming, date, expectedDays, "requested upcoming range");

  const totals = upcoming.days.map((day, index) => assertDay(day, addDays(date, index), { requireCompleteStarter: expectedDays === 1 }));
  const gameCount = totals.reduce((total, row) => total + row.games, 0);
  const okStarterCount = totals.reduce((total, row) => total + row.okStarterCount, 0);
  if (gameCount > 0) {
    assert(okStarterCount > 0, `${upcoming.range.start}..${upcoming.range.end} should expose at least one probable with complete form fields`);
  }

  const dateResponse = await fetch(`${baseUrl}/api/upcoming?date=${encodeURIComponent(date)}&window=${encodeURIComponent(windowSize)}`);
  assert(dateResponse.ok, `/api/upcoming?date=${date} returned HTTP ${dateResponse.status}`);
  const dateUpcoming = await readJson(dateResponse, `/api/upcoming?date=${date}`);
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

  let {
    defaultDateUpcoming,
    homeSlateDate,
    defaultDayTotals,
    defaultWeekUpcoming,
    defaultWeekGameCount,
    defaultWeekGames,
  } = await loadDefaultUpcomingSnapshot(baseUrl);

  const defaultTonightResponse = await fetch(`${baseUrl}/api/tonight?window=${encodeURIComponent(windowSize)}`);
  assert(defaultTonightResponse.ok, `/api/tonight default date returned HTTP ${defaultTonightResponse.status}`);
  const defaultTonight = await defaultTonightResponse.json();
  assertDay(defaultTonight, defaultDateUpcoming.range.start, { requireCompleteStarter: true });
  assert(
    dayApiSignature(defaultTonight) === dayApiSignature(defaultDateUpcoming.days[0]),
    "default tonight query should match the default upcoming day payload",
  );

  const bareDefaultUpcomingResponse = await fetch(`${baseUrl}/api/upcoming`);
  assert(bareDefaultUpcomingResponse.ok, `/api/upcoming bare default returned HTTP ${bareDefaultUpcomingResponse.status}`);
  const bareDefaultUpcoming = await bareDefaultUpcomingResponse.json();
  assert(bareDefaultUpcoming.range?.start === defaultDateUpcoming.range.start, "bare default upcoming query should use the default upcoming slate date");
  assert(bareDefaultUpcoming.range?.end === defaultDateUpcoming.range.end, "bare default upcoming query should return a one-day range");
  assert(Array.isArray(bareDefaultUpcoming.days) && bareDefaultUpcoming.days.length === 1, "bare default upcoming query should return one day group");
  assert(
    dayApiSignature(bareDefaultUpcoming.days[0]) === dayApiSignature(defaultDateUpcoming.days[0]),
    "bare default upcoming query should match the default upcoming day payload",
  );

  const bareDefaultTonightResponse = await fetch(`${baseUrl}/api/tonight`);
  assert(bareDefaultTonightResponse.ok, `/api/tonight bare default returned HTTP ${bareDefaultTonightResponse.status}`);
  const bareDefaultTonight = await bareDefaultTonightResponse.json();
  assert(
    dayApiSignature(bareDefaultTonight) === dayApiSignature(defaultTonight),
    "bare default tonight query should match the default tonight day payload",
  );

  const invalidTonightDateResponse = await fetch(`${baseUrl}/api/tonight?date=not-a-date&window=${encodeURIComponent(windowSize)}`);
  await assertInvalidDateApiResponse(invalidTonightDateResponse, "/api/tonight?date=not-a-date");

  const invalidDateResponse = await fetch(`${baseUrl}/api/upcoming?date=not-a-date&window=${encodeURIComponent(windowSize)}`);
  await assertInvalidDateApiResponse(invalidDateResponse, "/api/upcoming?date=not-a-date");

  const invalidStartResponse = await fetch(`${baseUrl}/api/upcoming?start=not-a-date&days=7&window=${encodeURIComponent(windowSize)}`);
  await assertInvalidDateApiResponse(invalidStartResponse, "/api/upcoming?start=not-a-date");

  const mixedInvalidStartResponse = await fetch(
    `${baseUrl}/api/upcoming?date=${encodeURIComponent(date)}&start=not-a-date&days=2&window=${encodeURIComponent(windowSize)}`,
  );
  await assertInvalidDateApiResponse(mixedInvalidStartResponse, "/api/upcoming mixed invalid start query");

  const legacyTodayPage = await fetch(`${baseUrl}/slate/today/${encodeURIComponent(date)}`);
  assertFollowedRedirect(legacyTodayPage, `/slate/today/${date}`, `/upcoming/${date}`);

  const legacyTomorrowPage = await fetch(`${baseUrl}/slate/tomorrow/${encodeURIComponent(addDays(date, 1))}`);
  assertFollowedRedirect(legacyTomorrowPage, `/slate/tomorrow/${addDays(date, 1)}`, `/upcoming/${addDays(date, 1)}`);

  const legacyWeekPage = await fetch(`${baseUrl}/slate/week/${encodeURIComponent(date)}`);
  assertFollowedRedirect(legacyWeekPage, `/slate/week/${date}`, `/upcoming/week/${date}`);

  const dayPage = await fetch(`${baseUrl}/upcoming/${encodeURIComponent(date)}`);
  assert(dayPage.ok, `/upcoming/${date} returned HTTP ${dayPage.status}`);
  const dayHtml = await dayPage.text();
  assertMetadata(
    dayHtml,
    `/upcoming/${date}`,
    expectedUpcomingDayTitle(date),
    expectedUpcomingDayDescription(upcoming.days[0]),
  );
  assertUpcomingPageHeader(dayHtml, `/upcoming/${date}`);
  assertJsonLd(
    dayHtml,
    `/upcoming/${date}`,
    expectedUpcomingDayTitle(date),
    expectedUpcomingDayDescription(upcoming.days[0]),
    totals[0].games,
    upcoming.days[0].games,
    `/upcoming/${date}`,
  );
  assertRenderedWatchCards(dayHtml, `/upcoming/${date}`, upcoming.days[0].games, `on ${formatUpcomingDate(date)}`, "must-watch", upcoming.days[0].scheduledGames, upcoming.days[0].leagueMeanGS);
  assertPrimarySlateCta(dayHtml, `/upcoming/${date}`, "Week view", `/upcoming/week/${date}`, `View week of ${formatUpcomingDate(date)}`);
  assertUpcomingRangeToggle(
    dayHtml,
    `/upcoming/${date}`,
    homeSlateDate,
    date,
    [homeSlateDate, addDays(homeSlateDate, 1)].includes(date) ? `/upcoming/${date}` : null,
  );
  assertUpcomingControls(
    dayHtml,
    `/upcoming/${date}`,
    "Filters / All statuses / Watch rank",
    {
      basePath: `/upcoming/${date}`,
      controls: { pregameOnly: false, sort: "watch" },
      counts: {
        visibleGames: upcoming.days[0].games.length,
        scheduledGames: upcoming.days[0].scheduledGames,
      },
    },
  );
  assertNoLegacySlateLinks(dayHtml, `/upcoming/${date}`);
  await assertPng(`${baseUrl}/upcoming/${encodeURIComponent(date)}/opengraph-image`, `/upcoming/${date}/opengraph-image`);

  const filteredDayPage = await fetch(`${baseUrl}/upcoming/${encodeURIComponent(date)}?sort=time`);
  assert(filteredDayPage.ok, `/upcoming/${date}?sort=time returned HTTP ${filteredDayPage.status}`);
  const filteredDayHtml = await filteredDayPage.text();
  assertMetadata(
    filteredDayHtml,
    `/upcoming/${date}`,
    expectedUpcomingDayTitle(date),
    expectedUpcomingDayDescription(upcoming.days[0]),
  );
  assertNoIndexFollow(filteredDayHtml, `/upcoming/${date}?sort=time`);
  assertRenderedWatchCards(
    filteredDayHtml,
    `/upcoming/${date}?sort=time`,
    sortGamesByFirstPitch(upcoming.days[0].games),
    `on ${formatUpcomingDate(date)}`,
    "must-watch",
    upcoming.days[0].scheduledGames,
    upcoming.days[0].leagueMeanGS,
  );
  assertPrimarySlateCta(filteredDayHtml, `/upcoming/${date}?sort=time`, "Week view", `/upcoming/week/${date}`, `View week of ${formatUpcomingDate(date)}`);
  assertNoLegacySlateLinks(filteredDayHtml, `/upcoming/${date}?sort=time`);

  const filteredDay = upcoming.days.find((candidate) => candidate.games.some((game) => game.status === "pregame"));
  if (filteredDay) {
    const filteredDate = filteredDay.date;
    const filteredDateResponse = await fetch(`${baseUrl}/api/tonight?date=${encodeURIComponent(filteredDate)}&window=${encodeURIComponent(windowSize)}`);
    assert(filteredDateResponse.ok, `/api/tonight?date=${filteredDate} returned HTTP ${filteredDateResponse.status}`);
    const currentFilteredDay = await filteredDateResponse.json();
    assertDay(currentFilteredDay, filteredDate, { requireCompleteStarter: true });

    const filteredPregameTeamDayPath = `/upcoming/${encodeURIComponent(filteredDate)}?pregame=1`;
    const filteredPregameTeamDayPage = await fetch(`${baseUrl}${filteredPregameTeamDayPath}`);
    assert(filteredPregameTeamDayPage.ok, `/upcoming/${filteredDate}?pregame=1 returned HTTP ${filteredPregameTeamDayPage.status}`);
    const filteredPregameTeamDayHtml = await filteredPregameTeamDayPage.text();
    assertMetadata(
      filteredPregameTeamDayHtml,
      `/upcoming/${filteredDate}`,
      expectedUpcomingDayTitle(filteredDate),
      expectedUpcomingDayDescription(currentFilteredDay),
    );
    assertNoIndexFollow(filteredPregameTeamDayHtml, `/upcoming/${filteredDate}?pregame=1`);
    assertUpcomingControls(
      filteredPregameTeamDayHtml,
      `/upcoming/${filteredDate}?pregame=1`,
      "Filters / Pregame only / Watch rank",
    );
    assertRenderedWatchCards(
      filteredPregameTeamDayHtml,
      `/upcoming/${filteredDate}?pregame=1`,
      pregameGames(currentFilteredDay.games),
      `on ${formatUpcomingDate(filteredDate)}`,
      "must-watch",
      currentFilteredDay.scheduledGames,
      currentFilteredDay.leagueMeanGS,
    );
    assertPrimarySlateCta(
      filteredPregameTeamDayHtml,
      `/upcoming/${filteredDate}?pregame=1`,
      "Week view",
      `/upcoming/week/${filteredDate}`,
      `View week of ${formatUpcomingDate(filteredDate)}`,
    );
    assertNoLegacySlateLinks(filteredPregameTeamDayHtml, `/upcoming/${filteredDate}?pregame=1`);

    const filteredSortedPregameTeamDayPath = `/upcoming/${encodeURIComponent(filteredDate)}?pregame=1&sort=time`;
    const filteredSortedPregameTeamDayPage = await fetch(`${baseUrl}${filteredSortedPregameTeamDayPath}`);
    assert(
      filteredSortedPregameTeamDayPage.ok,
      `/upcoming/${filteredDate}?pregame=1&sort=time returned HTTP ${filteredSortedPregameTeamDayPage.status}`,
    );
    const filteredSortedPregameTeamDayHtml = await filteredSortedPregameTeamDayPage.text();
    const sortedFilteredDateResponse = await fetch(
      `${baseUrl}/api/tonight?date=${encodeURIComponent(filteredDate)}&window=${encodeURIComponent(windowSize)}`,
    );
    assert(
      sortedFilteredDateResponse.ok,
      `/api/tonight?date=${filteredDate} refreshed for sorted pregame controls returned HTTP ${sortedFilteredDateResponse.status}`,
    );
    const sortedFilteredDay = await sortedFilteredDateResponse.json();
    assertDay(sortedFilteredDay, filteredDate, { requireCompleteStarter: true });
    assertMetadata(
      filteredSortedPregameTeamDayHtml,
      `/upcoming/${filteredDate}`,
      expectedUpcomingDayTitle(filteredDate),
      expectedUpcomingDayDescription(sortedFilteredDay),
    );
    assertNoIndexFollow(filteredSortedPregameTeamDayHtml, `/upcoming/${filteredDate}?pregame=1&sort=time`);
    assertUpcomingControls(
      filteredSortedPregameTeamDayHtml,
      `/upcoming/${filteredDate}?pregame=1&sort=time`,
      "Filters / Pregame only / Start time",
      {
        basePath: `/upcoming/${filteredDate}`,
        controls: { pregameOnly: true, sort: "time" },
        counts: {
          visibleGames: pregameGamesByFirstPitch(sortedFilteredDay.games).length,
          scheduledGames: sortedFilteredDay.scheduledGames,
        },
        allowCountDrift: true,
      },
    );
    assertRenderedWatchCards(
      filteredSortedPregameTeamDayHtml,
      `/upcoming/${filteredDate}?pregame=1&sort=time`,
      pregameGamesByFirstPitch(sortedFilteredDay.games),
      `on ${formatUpcomingDate(filteredDate)}`,
      "must-watch",
      sortedFilteredDay.scheduledGames,
    );
    assertPrimarySlateCta(
      filteredSortedPregameTeamDayHtml,
      `/upcoming/${filteredDate}?pregame=1&sort=time`,
      "Week view",
      `/upcoming/week/${filteredDate}`,
      `View week of ${formatUpcomingDate(filteredDate)}`,
    );
    assertNoLegacySlateLinks(filteredSortedPregameTeamDayHtml, `/upcoming/${filteredDate}?pregame=1&sort=time`);
  }

  await assertInvalidDatePageResponse(`${baseUrl}/upcoming/not-a-date`, "/upcoming/not-a-date");

  const invalidDayImage = await fetch(`${baseUrl}/upcoming/not-a-date/opengraph-image`);
  assert(invalidDayImage.status === 404, "/upcoming/not-a-date/opengraph-image should return HTTP 404, got " + invalidDayImage.status);

  ({
    defaultDateUpcoming,
    homeSlateDate,
    defaultDayTotals,
    defaultWeekUpcoming,
    defaultWeekGameCount,
    defaultWeekGames,
  } = await loadDefaultUpcomingSnapshot(baseUrl));
  const defaultPregameGames = pregameGames(defaultDateUpcoming.days[0].games);
  const upcomingIndex = await fetch(`${baseUrl}/upcoming`);
  assert(upcomingIndex.ok, "/upcoming returned HTTP " + upcomingIndex.status);
  const upcomingIndexHtml = await upcomingIndex.text();
  assert(upcomingIndexHtml.includes("Upcoming"), "/upcoming should render the primary upcoming surface");
  assertMetadata(
    upcomingIndexHtml,
    "/upcoming",
    expectedUpcomingDayTitle(defaultDateUpcoming.range.start),
    expectedUpcomingDayDescription(defaultDateUpcoming.days[0]),
  );
  assertUpcomingPageHeader(upcomingIndexHtml, "/upcoming");
  assertJsonLd(
    upcomingIndexHtml,
    "/upcoming",
    expectedUpcomingDayTitle(defaultDateUpcoming.range.start),
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
  assertUpcomingRangeToggle(upcomingIndexHtml, "/upcoming", homeSlateDate, defaultDateUpcoming.range.start, `/upcoming/${defaultDateUpcoming.range.start}`);
  assertUpcomingControls(upcomingIndexHtml, "/upcoming", "Filters / All statuses / Watch rank", {
    basePath: `/upcoming/${defaultDateUpcoming.range.start}`,
    controls: { pregameOnly: false, sort: "watch" },
  });
  assertNoLegacySlateLinks(upcomingIndexHtml, "/upcoming");
  await assertPng(`${baseUrl}/upcoming/opengraph-image`, "/upcoming/opengraph-image");

  const filteredUpcomingIndex = await fetch(`${baseUrl}/upcoming?sort=time`);
  assert(filteredUpcomingIndex.ok, "/upcoming?sort=time returned HTTP " + filteredUpcomingIndex.status);
  const filteredUpcomingIndexHtml = await filteredUpcomingIndex.text();
  assertMetadata(
    filteredUpcomingIndexHtml,
    "/upcoming",
    expectedUpcomingDayTitle(defaultDateUpcoming.range.start),
    expectedUpcomingDayDescription(defaultDateUpcoming.days[0]),
  );
  assertNoIndexFollow(filteredUpcomingIndexHtml, "/upcoming?sort=time");
  assertUpcomingControls(filteredUpcomingIndexHtml, "/upcoming?sort=time", "Filters / All statuses / Start time", {
    basePath: `/upcoming/${defaultDateUpcoming.range.start}`,
    controls: { pregameOnly: false, sort: "time" },
  });
  assertRenderedWatchCards(
    filteredUpcomingIndexHtml,
    "/upcoming?sort=time",
    sortGamesByFirstPitch(defaultDateUpcoming.days[0].games),
    `on ${formatUpcomingDate(defaultDateUpcoming.range.start)}`,
    "must-watch",
    defaultDateUpcoming.days[0].scheduledGames,
  );
  assertPrimarySlateCta(
    filteredUpcomingIndexHtml,
    "/upcoming?sort=time",
    "Week view",
    `/upcoming/week/${defaultDateUpcoming.range.start}`,
    `View week of ${formatUpcomingDate(defaultDateUpcoming.range.start)}`,
  );
  assertNoLegacySlateLinks(filteredUpcomingIndexHtml, "/upcoming?sort=time");

  const defaultLegacyTeam = firstLegacyTeamParam(defaultDateUpcoming.days[0].games);
  if (defaultLegacyTeam) {
    const legacyTeamUpcomingIndexPath = `/upcoming?team=${encodeURIComponent(defaultLegacyTeam)}`;
    const legacyTeamUpcomingIndex = await fetch(`${baseUrl}${legacyTeamUpcomingIndexPath}`);
    assert(legacyTeamUpcomingIndex.ok, `${legacyTeamUpcomingIndexPath} returned HTTP ${legacyTeamUpcomingIndex.status}`);
    const legacyTeamUpcomingIndexHtml = await legacyTeamUpcomingIndex.text();
    assertMetadata(
      legacyTeamUpcomingIndexHtml,
      "/upcoming",
      expectedUpcomingDayTitle(defaultDateUpcoming.range.start),
      expectedUpcomingDayDescription(defaultDateUpcoming.days[0]),
    );
    assertNoIndexFollow(legacyTeamUpcomingIndexHtml, legacyTeamUpcomingIndexPath);
    assertUpcomingControls(legacyTeamUpcomingIndexHtml, legacyTeamUpcomingIndexPath, "Filters / All statuses / Watch rank", {
      basePath: `/upcoming/${defaultDateUpcoming.range.start}`,
      controls: { pregameOnly: false, sort: "watch" },
      counts: {
        visibleGames: defaultDateUpcoming.days[0].games.length,
        scheduledGames: defaultDateUpcoming.days[0].scheduledGames,
      },
      allowCountDrift: true,
    });
    assertRenderedWatchCards(
      legacyTeamUpcomingIndexHtml,
      legacyTeamUpcomingIndexPath,
      defaultDateUpcoming.days[0].games,
      `on ${formatUpcomingDate(defaultDateUpcoming.range.start)}`,
      "must-watch",
      defaultDateUpcoming.days[0].scheduledGames,
    );
    assertNoLegacySlateLinks(legacyTeamUpcomingIndexHtml, legacyTeamUpcomingIndexPath);
  }

  if (defaultPregameGames.length > 0) {
  const filteredUpcomingIndexTeamPath = "/upcoming?pregame=1";
  const filteredUpcomingIndexTeam = await fetch(`${baseUrl}${filteredUpcomingIndexTeamPath}`);
  assert(filteredUpcomingIndexTeam.ok, `/upcoming?pregame=1 returned HTTP ${filteredUpcomingIndexTeam.status}`);
  const filteredUpcomingIndexTeamHtml = await filteredUpcomingIndexTeam.text();
  assertMetadata(
    filteredUpcomingIndexTeamHtml,
    "/upcoming",
    expectedUpcomingDayTitle(defaultDateUpcoming.range.start),
    expectedUpcomingDayDescription(defaultDateUpcoming.days[0]),
  );
  assertNoIndexFollow(filteredUpcomingIndexTeamHtml, "/upcoming?pregame=1");
  assertUpcomingControls(
    filteredUpcomingIndexTeamHtml,
    "/upcoming?pregame=1",
    "Filters / Pregame only / Watch rank",
  );
  assertRenderedWatchCards(
    filteredUpcomingIndexTeamHtml,
    "/upcoming?pregame=1",
    defaultPregameGames,
    `on ${formatUpcomingDate(defaultDateUpcoming.range.start)}`,
    "must-watch",
    defaultDateUpcoming.days[0].scheduledGames,
  );
  assertPrimarySlateCta(
    filteredUpcomingIndexTeamHtml,
    "/upcoming?pregame=1",
    "Week view",
    `/upcoming/week/${defaultDateUpcoming.range.start}`,
    `View week of ${formatUpcomingDate(defaultDateUpcoming.range.start)}`,
  );
  assertNoLegacySlateLinks(filteredUpcomingIndexTeamHtml, "/upcoming?pregame=1");

  const filteredSortedUpcomingIndexTeamPath = "/upcoming?pregame=1&sort=time";
  const filteredSortedUpcomingIndexTeam = await fetch(`${baseUrl}${filteredSortedUpcomingIndexTeamPath}`);
  assert(
    filteredSortedUpcomingIndexTeam.ok,
    `/upcoming?pregame=1&sort=time returned HTTP ${filteredSortedUpcomingIndexTeam.status}`,
  );
  const filteredSortedUpcomingIndexTeamHtml = await filteredSortedUpcomingIndexTeam.text();
  assertMetadata(
    filteredSortedUpcomingIndexTeamHtml,
    "/upcoming",
    expectedUpcomingDayTitle(defaultDateUpcoming.range.start),
    expectedUpcomingDayDescription(defaultDateUpcoming.days[0]),
  );
  assertNoIndexFollow(filteredSortedUpcomingIndexTeamHtml, "/upcoming?pregame=1&sort=time");
  assertUpcomingControls(
    filteredSortedUpcomingIndexTeamHtml,
    "/upcoming?pregame=1&sort=time",
    "Filters / Pregame only / Start time",
    {
      basePath: `/upcoming/${defaultDateUpcoming.range.start}`,
      controls: { pregameOnly: true, sort: "time" },
      counts: {
        visibleGames: pregameGamesByFirstPitch(defaultDateUpcoming.days[0].games).length,
        scheduledGames: defaultDateUpcoming.days[0].scheduledGames,
      },
      allowCountDrift: true,
    },
  );
  assertRenderedWatchCards(
    filteredSortedUpcomingIndexTeamHtml,
    "/upcoming?pregame=1&sort=time",
    pregameGamesByFirstPitch(defaultDateUpcoming.days[0].games),
    `on ${formatUpcomingDate(defaultDateUpcoming.range.start)}`,
    "must-watch",
    defaultDateUpcoming.days[0].scheduledGames,
  );
  assertPrimarySlateCta(
    filteredSortedUpcomingIndexTeamHtml,
    "/upcoming?pregame=1&sort=time",
    "Week view",
    `/upcoming/week/${defaultDateUpcoming.range.start}`,
    `View week of ${formatUpcomingDate(defaultDateUpcoming.range.start)}`,
  );
  assertNoLegacySlateLinks(filteredSortedUpcomingIndexTeamHtml, "/upcoming?pregame=1&sort=time");
  }

  if (expectedDays > 1) {
    const weekPage = await fetch(`${baseUrl}/upcoming/week/${encodeURIComponent(date)}`);
    assert(weekPage.ok, `/upcoming/week/${date} returned HTTP ${weekPage.status}`);
    const weekHtml = await weekPage.text();
    const weekGames = expectedOrderedUpcomingWeekGameValues(upcoming);
    const weekIncludesCurrentSlateDate = upcoming.days.some((day) => day.date === homeSlateDate);
    assertMetadata(
      weekHtml,
      `/upcoming/week/${date}`,
      expectedUpcomingWeekTitle(date),
      expectedUpcomingWeekDescription(upcoming),
    );
    assertUpcomingPageHeader(weekHtml, `/upcoming/week/${date}`);
    assertJsonLd(
      weekHtml,
      `/upcoming/week/${date}`,
      expectedUpcomingWeekTitle(date),
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
    assertUpcomingRangeToggle(weekHtml, `/upcoming/week/${date}`, homeSlateDate, date, `/upcoming/week/${date}`);
    assertUpcomingControls(weekHtml, `/upcoming/week/${date}`, "Filters / All statuses / Watch rank", {
    basePath: `/upcoming/week/${date}`,
    controls: { pregameOnly: false, sort: "watch" },
    counts: {
      visibleGames: weekGames.length,
      scheduledGames: upcoming.days.reduce((count, day) => count + day.scheduledGames, 0),
    },
    allowCountDrift: weekIncludesCurrentSlateDate,
  });
    assertNoLegacySlateLinks(weekHtml, `/upcoming/week/${date}`);
    await assertPng(`${baseUrl}/upcoming/week/${encodeURIComponent(date)}/opengraph-image`, `/upcoming/week/${date}/opengraph-image`);

    const filteredWeekPage = await fetch(`${baseUrl}/upcoming/week/${encodeURIComponent(date)}?sort=time`);
    assert(filteredWeekPage.ok, `/upcoming/week/${date}?sort=time returned HTTP ${filteredWeekPage.status}`);
    const filteredWeekHtml = await filteredWeekPage.text();
    assertMetadata(
      filteredWeekHtml,
      `/upcoming/week/${date}`,
      expectedUpcomingWeekTitle(date),
      expectedUpcomingWeekDescription(upcoming),
    );
    assertNoIndexFollow(filteredWeekHtml, `/upcoming/week/${date}?sort=time`);
    assertUpcomingControls(filteredWeekHtml, `/upcoming/week/${date}?sort=time`, "Filters / All statuses / Start time", {
    basePath: `/upcoming/week/${date}`,
    controls: { pregameOnly: false, sort: "time" },
    counts: {
      visibleGames: weekGames.length,
      scheduledGames: upcoming.days.reduce((count, day) => count + day.scheduledGames, 0),
    },
    allowCountDrift: weekIncludesCurrentSlateDate,
  });
    upcoming.days.forEach((day) => {
      assertRenderedWatchCards(
        filteredWeekHtml,
        `/upcoming/week/${date}?sort=time day ${day.date}`,
        sortGamesByFirstPitch(day.games),
        `on ${formatUpcomingDate(day.date)}`,
        `must-watch-${day.date}`,
        day.scheduledGames,
      );
      assertPrimarySlateCta(
        filteredWeekHtml,
        `/upcoming/week/${date}?sort=time day ${day.date}`,
        "Day slate",
        `/upcoming/${day.date}`,
        `View day slate for ${formatUpcomingDate(day.date)}`,
      );
    });
    assertWeekDaySlateLinks(filteredWeekHtml, `/upcoming/week/${date}?sort=time`, upcoming.days);
    assertNoLegacySlateLinks(filteredWeekHtml, `/upcoming/week/${date}?sort=time`);

    const invalidWeekControlsPath = `/upcoming/week/${encodeURIComponent(date)}?pregame=0&sort=bogus`;
    const invalidWeekControlsPage = await fetch(`${baseUrl}${invalidWeekControlsPath}`);
    assert(
      invalidWeekControlsPage.ok,
      `/upcoming/week/${date}?pregame=0&sort=bogus returned HTTP ${invalidWeekControlsPage.status}`,
    );
    const invalidWeekControlsHtml = await invalidWeekControlsPage.text();
    assertMetadata(
      invalidWeekControlsHtml,
      `/upcoming/week/${date}`,
      expectedUpcomingWeekTitle(date),
      expectedUpcomingWeekDescription(upcoming),
    );
    assertNoIndexFollow(invalidWeekControlsHtml, `/upcoming/week/${date}?pregame=0&sort=bogus`);
    assertUpcomingControls(
      invalidWeekControlsHtml,
      `/upcoming/week/${date}?pregame=0&sort=bogus`,
      "Filters / All statuses / Watch rank",
      {
        basePath: `/upcoming/week/${date}`,
        controls: { pregameOnly: false, sort: "watch" },
        counts: {
          visibleGames: weekGames.length,
          scheduledGames: upcoming.days.reduce((count, day) => count + day.scheduledGames, 0),
        },
        allowCountDrift: weekIncludesCurrentSlateDate,
      },
    );
    upcoming.days.forEach((day) => {
      assertRenderedWatchCards(
        invalidWeekControlsHtml,
        `/upcoming/week/${date}?pregame=0&sort=bogus day ${day.date}`,
        day.games,
        `on ${formatUpcomingDate(day.date)}`,
        `must-watch-${day.date}`,
        day.scheduledGames,
      );
    });
    assertWeekDaySlateLinks(invalidWeekControlsHtml, `/upcoming/week/${date}?pregame=0&sort=bogus`, upcoming.days);
    assertNoLegacySlateLinks(invalidWeekControlsHtml, `/upcoming/week/${date}?pregame=0&sort=bogus`);

    const filteredPregameTeamWeekPath = `/upcoming/week/${encodeURIComponent(date)}?pregame=1`;
    const filteredPregameTeamWeekPage = await fetch(`${baseUrl}${filteredPregameTeamWeekPath}`);
    assert(
      filteredPregameTeamWeekPage.ok,
      `/upcoming/week/${date}?pregame=1 returned HTTP ${filteredPregameTeamWeekPage.status}`,
    );
    const filteredPregameTeamWeekHtml = await filteredPregameTeamWeekPage.text();
    assertMetadata(
      filteredPregameTeamWeekHtml,
      `/upcoming/week/${date}`,
      expectedUpcomingWeekTitle(date),
      expectedUpcomingWeekDescription(upcoming),
    );
    assertNoIndexFollow(filteredPregameTeamWeekHtml, `/upcoming/week/${date}?pregame=1`);
    assertUpcomingControls(
      filteredPregameTeamWeekHtml,
      `/upcoming/week/${date}?pregame=1`,
      "Filters / Pregame only / Watch rank",
      {
        basePath: `/upcoming/week/${date}`,
        controls: { pregameOnly: true, sort: "watch" },
        counts: {
          visibleGames: upcoming.days.reduce((count, day) => count + pregameGames(day.games).length, 0),
          scheduledGames: upcoming.days.reduce((count, day) => count + day.scheduledGames, 0),
        },
        allowCountDrift: weekIncludesCurrentSlateDate,
      },
    );
    upcoming.days.forEach((day) => {
      assertRenderedWatchCards(
        filteredPregameTeamWeekHtml,
        `/upcoming/week/${date}?pregame=1 day ${day.date}`,
        pregameGames(day.games),
        `on ${formatUpcomingDate(day.date)}`,
        `must-watch-${day.date}`,
        day.scheduledGames,
      );
      assertPrimarySlateCta(
        filteredPregameTeamWeekHtml,
        `/upcoming/week/${date}?pregame=1 day ${day.date}`,
        "Day slate",
        `/upcoming/${day.date}`,
        `View day slate for ${formatUpcomingDate(day.date)}`,
      );
    });
    assertWeekDaySlateLinks(filteredPregameTeamWeekHtml, `/upcoming/week/${date}?pregame=1`, upcoming.days);
    assertNoLegacySlateLinks(filteredPregameTeamWeekHtml, `/upcoming/week/${date}?pregame=1`);

    const filteredSortedPregameTeamWeekPath = `/upcoming/week/${encodeURIComponent(date)}?pregame=1&sort=time`;
    const filteredSortedPregameTeamWeekPage = await fetch(`${baseUrl}${filteredSortedPregameTeamWeekPath}`);
    assert(
      filteredSortedPregameTeamWeekPage.ok,
      `/upcoming/week/${date}?pregame=1&sort=time returned HTTP ${filteredSortedPregameTeamWeekPage.status}`,
    );
    const filteredSortedPregameTeamWeekHtml = await filteredSortedPregameTeamWeekPage.text();
    assertMetadata(
      filteredSortedPregameTeamWeekHtml,
      `/upcoming/week/${date}`,
      expectedUpcomingWeekTitle(date),
      expectedUpcomingWeekDescription(upcoming),
    );
    assertNoIndexFollow(filteredSortedPregameTeamWeekHtml, `/upcoming/week/${date}?pregame=1&sort=time`);
    assertUpcomingControls(
      filteredSortedPregameTeamWeekHtml,
      `/upcoming/week/${date}?pregame=1&sort=time`,
      "Filters / Pregame only / Start time",
      {
        basePath: `/upcoming/week/${date}`,
        controls: { pregameOnly: true, sort: "time" },
        counts: {
          visibleGames: upcoming.days.reduce((count, day) => count + pregameGamesByFirstPitch(day.games).length, 0),
          scheduledGames: upcoming.days.reduce((count, day) => count + day.scheduledGames, 0),
        },
        allowCountDrift: weekIncludesCurrentSlateDate,
      },
    );
    upcoming.days.forEach((day) => {
      assertRenderedWatchCards(
        filteredSortedPregameTeamWeekHtml,
        `/upcoming/week/${date}?pregame=1&sort=time day ${day.date}`,
        pregameGamesByFirstPitch(day.games),
        `on ${formatUpcomingDate(day.date)}`,
        `must-watch-${day.date}`,
        day.scheduledGames,
      );
      assertPrimarySlateCta(
        filteredSortedPregameTeamWeekHtml,
        `/upcoming/week/${date}?pregame=1&sort=time day ${day.date}`,
        "Day slate",
        `/upcoming/${day.date}`,
        `View day slate for ${formatUpcomingDate(day.date)}`,
      );
    });
    assertWeekDaySlateLinks(filteredSortedPregameTeamWeekHtml, `/upcoming/week/${date}?pregame=1&sort=time`, upcoming.days);
    assertNoLegacySlateLinks(filteredSortedPregameTeamWeekHtml, `/upcoming/week/${date}?pregame=1&sort=time`);

    await assertInvalidDatePageResponse(`${baseUrl}/upcoming/week/not-a-date`, "/upcoming/week/not-a-date");

    const invalidWeekImage = await fetch(`${baseUrl}/upcoming/week/not-a-date/opengraph-image`);
    assert(invalidWeekImage.status === 404, "/upcoming/week/not-a-date/opengraph-image should return HTTP 404, got " + invalidWeekImage.status);

    const upcomingWeekIndex = await fetch(`${baseUrl}/upcoming/week`);
    assert(upcomingWeekIndex.ok, "/upcoming/week returned HTTP " + upcomingWeekIndex.status);
    const upcomingWeekIndexHtml = await upcomingWeekIndex.text();
    assertMetadata(
      upcomingWeekIndexHtml,
      "/upcoming/week",
      expectedUpcomingWeekTitle(defaultDateUpcoming.range.start),
      expectedUpcomingWeekDescription(defaultWeekUpcoming),
    );
    assertUpcomingPageHeader(upcomingWeekIndexHtml, "/upcoming/week");
    assertJsonLd(
      upcomingWeekIndexHtml,
      "/upcoming/week",
      expectedUpcomingWeekTitle(defaultDateUpcoming.range.start),
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
      homeSlateDate,
      defaultDateUpcoming.range.start,
      `/upcoming/week/${defaultDateUpcoming.range.start}`,
    );
    assertUpcomingControls(upcomingWeekIndexHtml, "/upcoming/week", "Filters / All statuses / Watch rank", {
      basePath: `/upcoming/week/${defaultDateUpcoming.range.start}`,
      controls: { pregameOnly: false, sort: "watch" },
    });
    assertNoLegacySlateLinks(upcomingWeekIndexHtml, "/upcoming/week");
    await assertPng(`${baseUrl}/upcoming/week/opengraph-image`, "/upcoming/week/opengraph-image");

    const filteredUpcomingWeekIndex = await fetch(`${baseUrl}/upcoming/week?sort=time`);
    assert(filteredUpcomingWeekIndex.ok, "/upcoming/week?sort=time returned HTTP " + filteredUpcomingWeekIndex.status);
    const filteredUpcomingWeekIndexHtml = await filteredUpcomingWeekIndex.text();
    assertMetadata(
      filteredUpcomingWeekIndexHtml,
      "/upcoming/week",
      expectedUpcomingWeekTitle(defaultDateUpcoming.range.start),
      expectedUpcomingWeekDescription(defaultWeekUpcoming),
    );
    assertNoIndexFollow(filteredUpcomingWeekIndexHtml, "/upcoming/week?sort=time");
    assertUpcomingControls(filteredUpcomingWeekIndexHtml, "/upcoming/week?sort=time", "Filters / All statuses / Start time", {
      basePath: `/upcoming/week/${defaultDateUpcoming.range.start}`,
      controls: { pregameOnly: false, sort: "time" },
    });
    defaultWeekUpcoming.days.forEach((day) => {
      assertRenderedWatchCards(
        filteredUpcomingWeekIndexHtml,
        `/upcoming/week?sort=time day ${day.date}`,
        sortGamesByFirstPitch(day.games),
        `on ${formatUpcomingDate(day.date)}`,
        `must-watch-${day.date}`,
        day.scheduledGames,
      );
      assertPrimarySlateCta(
        filteredUpcomingWeekIndexHtml,
        `/upcoming/week?sort=time day ${day.date}`,
        "Day slate",
        `/upcoming/${day.date}`,
        `View day slate for ${formatUpcomingDate(day.date)}`,
      );
    });
    assertWeekDaySlateLinks(filteredUpcomingWeekIndexHtml, "/upcoming/week?sort=time", defaultWeekUpcoming.days);
    assertNoLegacySlateLinks(filteredUpcomingWeekIndexHtml, "/upcoming/week?sort=time");

    const defaultWeekLegacyTeam = firstLegacyTeamParam(defaultWeekGames);
    if (defaultWeekLegacyTeam) {
      const legacyTeamUpcomingWeekIndexPath = `/upcoming/week?team=${encodeURIComponent(defaultWeekLegacyTeam)}`;
      const legacyTeamUpcomingWeekIndex = await fetch(`${baseUrl}${legacyTeamUpcomingWeekIndexPath}`);
      assert(
        legacyTeamUpcomingWeekIndex.ok,
        `${legacyTeamUpcomingWeekIndexPath} returned HTTP ${legacyTeamUpcomingWeekIndex.status}`,
      );
      const legacyTeamUpcomingWeekIndexHtml = await legacyTeamUpcomingWeekIndex.text();
      assertMetadata(
        legacyTeamUpcomingWeekIndexHtml,
        "/upcoming/week",
        expectedUpcomingWeekTitle(defaultDateUpcoming.range.start),
        expectedUpcomingWeekDescription(defaultWeekUpcoming),
      );
      assertNoIndexFollow(legacyTeamUpcomingWeekIndexHtml, legacyTeamUpcomingWeekIndexPath);
      assertUpcomingControls(
        legacyTeamUpcomingWeekIndexHtml,
        legacyTeamUpcomingWeekIndexPath,
        "Filters / All statuses / Watch rank",
        {
          basePath: `/upcoming/week/${defaultDateUpcoming.range.start}`,
          controls: { pregameOnly: false, sort: "watch" },
          counts: {
            visibleGames: defaultWeekGames.length,
            scheduledGames: defaultWeekUpcoming.days.reduce((count, day) => count + day.scheduledGames, 0),
          },
          allowCountDrift: true,
        },
      );
      defaultWeekUpcoming.days.forEach((day) => {
        assertRenderedWatchCards(
          legacyTeamUpcomingWeekIndexHtml,
          `${legacyTeamUpcomingWeekIndexPath} day ${day.date}`,
          day.games,
          `on ${formatUpcomingDate(day.date)}`,
          `must-watch-${day.date}`,
          day.scheduledGames,
        );
      });
      assertWeekDaySlateLinks(legacyTeamUpcomingWeekIndexHtml, legacyTeamUpcomingWeekIndexPath, defaultWeekUpcoming.days);
      assertNoLegacySlateLinks(legacyTeamUpcomingWeekIndexHtml, legacyTeamUpcomingWeekIndexPath);
    }

    const filteredUpcomingWeekIndexTeamPath = "/upcoming/week?pregame=1";
    const filteredUpcomingWeekIndexTeam = await fetch(`${baseUrl}${filteredUpcomingWeekIndexTeamPath}`);
    assert(
      filteredUpcomingWeekIndexTeam.ok,
      `/upcoming/week?pregame=1 returned HTTP ${filteredUpcomingWeekIndexTeam.status}`,
    );
    const filteredUpcomingWeekIndexTeamHtml = await filteredUpcomingWeekIndexTeam.text();
    assertMetadata(
      filteredUpcomingWeekIndexTeamHtml,
      "/upcoming/week",
      expectedUpcomingWeekTitle(defaultDateUpcoming.range.start),
      expectedUpcomingWeekDescription(defaultWeekUpcoming),
    );
    assertNoIndexFollow(filteredUpcomingWeekIndexTeamHtml, "/upcoming/week?pregame=1");
    assertUpcomingControls(
      filteredUpcomingWeekIndexTeamHtml,
      "/upcoming/week?pregame=1",
      "Filters / Pregame only / Watch rank",
      {
        basePath: `/upcoming/week/${defaultDateUpcoming.range.start}`,
        controls: { pregameOnly: true, sort: "watch" },
        counts: {
          visibleGames: defaultWeekUpcoming.days.reduce((count, day) => count + pregameGames(day.games).length, 0),
          scheduledGames: defaultWeekUpcoming.days.reduce((count, day) => count + day.scheduledGames, 0),
        },
        allowCountDrift: true,
      },
    );
    defaultWeekUpcoming.days.forEach((day) => {
      assertRenderedWatchCards(
        filteredUpcomingWeekIndexTeamHtml,
        `/upcoming/week?pregame=1 day ${day.date}`,
        pregameGames(day.games),
        `on ${formatUpcomingDate(day.date)}`,
        `must-watch-${day.date}`,
        day.scheduledGames,
      );
      assertPrimarySlateCta(
        filteredUpcomingWeekIndexTeamHtml,
        `/upcoming/week?pregame=1 day ${day.date}`,
        "Day slate",
        `/upcoming/${day.date}`,
        `View day slate for ${formatUpcomingDate(day.date)}`,
      );
    });
    assertWeekDaySlateLinks(filteredUpcomingWeekIndexTeamHtml, "/upcoming/week?pregame=1", defaultWeekUpcoming.days);
    assertNoLegacySlateLinks(filteredUpcomingWeekIndexTeamHtml, "/upcoming/week?pregame=1");

    const filteredSortedUpcomingWeekIndexTeamPath = "/upcoming/week?pregame=1&sort=time";
    const filteredSortedUpcomingWeekIndexTeam = await fetch(`${baseUrl}${filteredSortedUpcomingWeekIndexTeamPath}`);
    assert(
      filteredSortedUpcomingWeekIndexTeam.ok,
      `/upcoming/week?pregame=1&sort=time returned HTTP ${filteredSortedUpcomingWeekIndexTeam.status}`,
    );
    const filteredSortedUpcomingWeekIndexTeamHtml = await filteredSortedUpcomingWeekIndexTeam.text();
    assertMetadata(
      filteredSortedUpcomingWeekIndexTeamHtml,
      "/upcoming/week",
      expectedUpcomingWeekTitle(defaultDateUpcoming.range.start),
      expectedUpcomingWeekDescription(defaultWeekUpcoming),
    );
    assertNoIndexFollow(filteredSortedUpcomingWeekIndexTeamHtml, "/upcoming/week?pregame=1&sort=time");
    assertUpcomingControls(
      filteredSortedUpcomingWeekIndexTeamHtml,
      "/upcoming/week?pregame=1&sort=time",
      "Filters / Pregame only / Start time",
      {
        basePath: `/upcoming/week/${defaultDateUpcoming.range.start}`,
        controls: { pregameOnly: true, sort: "time" },
        counts: {
          visibleGames: defaultWeekUpcoming.days.reduce(
            (count, day) => count + pregameGamesByFirstPitch(day.games).length,
            0,
          ),
          scheduledGames: defaultWeekUpcoming.days.reduce((count, day) => count + day.scheduledGames, 0),
        },
        allowCountDrift: true,
      },
    );
    defaultWeekUpcoming.days.forEach((day) => {
      assertRenderedWatchCards(
        filteredSortedUpcomingWeekIndexTeamHtml,
        `/upcoming/week?pregame=1&sort=time day ${day.date}`,
        pregameGamesByFirstPitch(day.games),
        `on ${formatUpcomingDate(day.date)}`,
        `must-watch-${day.date}`,
        day.scheduledGames,
      );
      assertPrimarySlateCta(
        filteredSortedUpcomingWeekIndexTeamHtml,
        `/upcoming/week?pregame=1&sort=time day ${day.date}`,
        "Day slate",
        `/upcoming/${day.date}`,
        `View day slate for ${formatUpcomingDate(day.date)}`,
      );
    });
    assertWeekDaySlateLinks(
      filteredSortedUpcomingWeekIndexTeamHtml,
      "/upcoming/week?pregame=1&sort=time",
      defaultWeekUpcoming.days,
    );
    assertNoLegacySlateLinks(filteredSortedUpcomingWeekIndexTeamHtml, "/upcoming/week?pregame=1&sort=time");
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
