import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { loadProjectTs } from './lib/load-project-ts.mjs';
const { outsFromIP } = loadProjectTs('src/lib/innings.ts');
const records = JSON.parse(await readFile('data/season-reviews/2026-canonical.json', 'utf8'));
if (records.some(r => r.status !== 'final' || !r.frozen)) throw Error('Unsettled canonical input');
const dir = 'outputs/off2/linescores';
await mkdir(dir, { recursive: true });
async function get(url, path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch {}
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const value = await response.json();
      await writeFile(path, JSON.stringify(value));
      return value;
    } catch (error) { if (attempt === 3) throw error; await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); }
  }
}
const games = [...new Set(records.map(r => r.gamePk))];
const outcomes = [], combined = [], shortened = [];
let cursor = 0;
await Promise.all(Array.from({ length: 2 }, async () => {
  while (cursor < games.length) {
    const gamePk = games[cursor++];
    const url = `https://statsapi.mlb.com/api/v1/game/${gamePk}/linescore`;
    const line = await get(url, `${dir}/${gamePk}.json`);
    if (!line.teams || !Number.isInteger(line.teams.home.hits) || !Number.isInteger(line.teams.away.hits)) throw Error(`Missing linescore ${gamePk}`);
    const starts = records.filter(r => r.gamePk === gamePk);
    const outcome = { gamePk, date: starts[0].date, source: url, homeHits: line.teams.home.hits, awayHits: line.teams.away.hits, checked: true };
    for (const battingSide of ['home', 'away']) {
      if (line.teams[battingSide].hits !== 0) continue;
      const side = battingSide === 'home' ? 'away' : 'home';
      const box = await get(`https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`, `${dir}/${gamePk}-box.json`);
      const defense = box.teams[side];
      const pitchers = defense.pitchers.map(id => ({ id, name: defense.players[`ID${id}`].person.fullName, ...defense.players[`ID${id}`].stats.pitching })).filter(p => outsFromIP(p.inningsPitched ?? '0') > 0);
      const outs = pitchers.reduce((n,p) => n + outsFromIP(p.inningsPitched), 0);
      const starter = starts.find(r => r.side === side && r.pitcherMlbId === pitchers[0]?.id);
      if (!starter || pitchers.some(p => p.hits !== 0) || starter.line.hits !== 0 || outsFromIP(starter.line.inningsPitched) !== outsFromIP(pitchers[0].inningsPitched)) throw Error(`Canonical / boxscore mismatch ${gamePk}`);
      const entry = { gamePk, date: starter.date, team: starter.team, opponent: starter.opponent, startId: starter.id, pitcher: starter.pitcherName, starterIP: starter.line.inningsPitched, starterHits: starter.line.hits, outs, pitchers, source: url, boxscoreSource: `https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore` };
      if (outs >= 27 && pitchers.length > 1) combined.push(entry);
      if (outs < 27 && pitchers.length === 1) shortened.push(entry);
    }
    outcomes.push(outcome);
    if (outcomes.length % 100 === 0) console.log(`Linescores verified ${outcomes.length}/${games.length}`);
    await new Promise(r => setTimeout(r, 100));
  }
}));
const individual = records.filter(r => r.line.hits === 0 && outsFromIP(r.line.inningsPitched) >= 27).map(r => ({ id: r.id, pitcher: r.pitcherName, date: r.date, line: r.line }));
const result = { year: 2026, verifiedAt: new Date().toISOString(), canonicalStarts: records.length, expectedGames: games.length, checkedGames: outcomes.length, individual, shortened, combined: combined.sort((a,b) => a.date.localeCompare(b.date)), outcomes: outcomes.sort((a,b) => a.gamePk-b.gamePk) };
await writeFile('data/season-reviews/2026-no-hitter-audit.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ checkedGames: outcomes.length, individual, shortened, combined }, null, 2));
