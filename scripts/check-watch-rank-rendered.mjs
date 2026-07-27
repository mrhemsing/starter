import assert from "node:assert/strict";
import { once } from "node:events";
import net from "node:net";
import { spawn } from "node:child_process";

const host = "127.0.0.1";
const port = await reservePort();
const baseUrl = `http://${host}:${port}`;
const date = process.env.THE_BUMP_WATCH_RANK_DATE ?? "2026-07-27";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", host, "-p", String(port)], {
  env: {
    ...process.env,
    PORT: String(port),
    THE_BUMP_ALLOW_VOLATILE_CANONICAL_STORE: "1",
    THE_BUMP_DISABLE_PROBABLE_CONFIDENCE_LOG: "1",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });

try {
  await waitForServer();
  const [api, timeHtml, watchHtml] = await Promise.all([
    fetch(`${baseUrl}/api/upcoming?date=${date}&days=1`).then(json),
    fetch(`${baseUrl}/upcoming/${date}`).then(html),
    fetch(`${baseUrl}/upcoming/${date}?sort=watch`).then(html),
  ]);
  const games = api.days[0]?.games ?? [];
  assert(games.length > 0, `expected a populated ${date} slate`);
  assert.equal(new Set(games.map((game) => game.watchRank)).size, games.length);
  assert(games.every((game) => Number.isInteger(game.watchRank) && game.watchRank >= 1 && game.watchRank <= games.length));
  assert(games.every((game) => game.watchRankOf === games.length));

  const timeCards = detailedCards(timeHtml);
  const watchCards = detailedCards(watchHtml);
  assert(timeHtml.includes('data-watch-rank-sort-mode="time"'), "default route must render the detailed board in time sort mode");
  assert(watchHtml.includes('data-watch-rank-sort-mode="watch"'), "watch route must render the detailed board in watch sort mode");
  assert.deepEqual(rankMap(timeCards), rankMap(watchCards));
  assert.equal(timeCards.filter((card) => card.kind === "headliner").length, 0);
  assert.equal(timeCards.filter((card) => card.gold).length, 1);
  assert.equal(timeCards.find((card) => card.gold)?.rank, 1);
  assert.equal(watchCards.filter((card) => card.kind === "headliner").length, 1);
  assert.equal(watchCards.filter((card) => card.gold).length, 1);
  assert.equal(watchCards[0]?.kind, "headliner");
  assert.equal(watchCards[0]?.rank, 1);

  console.log(`watch rank rendered ok: ${games.length} ${date} matchups across time and watch sorts`);
} finally {
  server.kill();
  await Promise.race([once(server, "exit"), new Promise((resolve) => setTimeout(resolve, 2000))]);
}

function detailedCards(markup) {
  return (markup.match(/<article\b[^>]*data-responsive-check="must-watch-(?:headliner|row)"[^>]*>/g) ?? [])
    .map((tag) => ({
      gamePk: attribute(tag, "data-game-pk"),
      rank: Number(attribute(tag, "data-watch-rank")),
      kind: attribute(tag, "data-responsive-check") === "must-watch-headliner" ? "headliner" : "row",
      gold: attribute(tag, "data-watch-rank-gold") === "true",
    }))
    .filter((card) => card.gamePk.length > 0);
}

function rankMap(cards) {
  return Object.fromEntries(cards.map((card) => [card.gamePk, card.rank]).sort(([a], [b]) => a.localeCompare(b)));
}

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? "";
}

async function json(response) {
  assert(response.ok, `${response.url} returned ${response.status}`);
  return response.json();
}

async function html(response) {
  assert(response.ok, `${response.url} returned ${response.status}`);
  return response.text();
}

async function waitForServer() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/404`);
      if (response.status > 0) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`server did not become ready\n${output}`);
}

async function reservePort() {
  const socket = net.createServer();
  socket.listen(0, host);
  await once(socket, "listening");
  const address = socket.address();
  const value = typeof address === "object" && address ? address.port : 0;
  socket.close();
  await once(socket, "close");
  return value;
}
