import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path, deps, fetchImpl) {
  const code = ts.transpileModule(readFileSync(path, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports = {};
  vm.runInNewContext(code, {exports, require: id => { if (id in deps) return deps[id]; throw new Error('Unexpected dependency '+id); }, fetch:fetchImpl, console, URLSearchParams, Date, Map, Set, process, AbortSignal});
  return exports;
}
const policy=load('src/lib/mlb-game-types.ts', {});
const requests=[];
const kinds=['R','F','D','L','W','S','E','A'];
const games=kinds.map((gameType,i)=>({gamePk:i+1,gameType,gameDate:'2026-09-29T18:00:00Z',status:{abstractGameState:'Preview',detailedState:'Scheduled'},teams:{away:{team:{name:'Chicago Cubs',abbreviation:'CHC'}},home:{team:{name:'San Diego Padres',abbreviation:'SD'}}}}));
let schedulePayload={dates:[{date:'2026-09-29',games}]};
const nativeFetch=globalThis.fetch;
const client=load('src/lib/data/mlb-stats-client.ts',{
 '@/lib/mlb-game-types':policy,
 '@/lib/data/demo':{demoProbableStarts:[]},
 '@/lib/data/runtime-state-store':{readRuntimeStates:async()=>new Map(),writeRuntimeStates:async()=>{}},
 '@/lib/innings':{inningsFromIP:()=>0},
},async url=>{requests.push(String(url));return {ok:true,json:async()=>String(url).includes('statsapi.mlb.com/api/v1/schedule')?schedulePayload:{events:[]}};});
const result=await client.fetchMlbSchedule('2026-09-29',{fetchLive:true,signal:AbortSignal.timeout(10000)});
assert.equal(result.source,'live');
assert.equal(result.games.map(g=>g.gameType).join(','),'R,F,D,L,W');
assert.equal(result.games.length,5,'Games with unannounced starters remain visible');
assert.equal(new URL(requests[0]).searchParams.get('gameTypes'),'R,F,D,L,W');
assert.equal(policy.isMlbBoardGameType(undefined),false);
const response=await nativeFetch('https://statsapi.mlb.com/api/v1/schedule?sportId=1&gameTypes=R,F,D,L,W&date=2026-09-29&hydrate=probablePitcher,team');
assert(response.ok);
schedulePayload=await response.json();
const live=await client.fetchMlbSchedule('2026-09-29',{fetchLive:true,signal:AbortSignal.timeout(10000)});
assert.equal(live.games.length,4,'All four September 29 Wild Card games survive the actual parser');
assert(live.games.every(g=>g.gameType==='F'));
console.log('Postseason schedule PASS: all five supported types; exhibitions excluded; TBD starters retained; all four real Wild Card matchups parsed.');
console.log(live.games.map(g=>g.awayTeam.abbreviation+' @ '+g.homeTeam.abbreviation).join(', '));
