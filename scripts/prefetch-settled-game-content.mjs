import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createDiscoveryFetch} from './lib/discovery-http.mjs';
const records=JSON.parse(await readFile('data/season-reviews/2026-canonical.json','utf8'));
const gamePks=[...new Set(records.map(x=>x.gamePk))];assert.equal(gamePks.length,2205);
const {fetch,log}=await createDiscoveryFetch('outputs/off131',{reuse:['../starter-highlight-backfill/outputs/off13']});
let index=0,completed=0;
async function worker(){while(index<gamePks.length){const gamePk=gamePks[index++];const response=await fetch(`https://statsapi.mlb.com/api/v1/game/${gamePk}/content`);assert.equal(response.status,200,`Lookup failed ${gamePk}`);completed++;if(completed%25===0||completed===2205){console.log(`${completed}/2205 exact-game responses`);await writeFile('outputs/off131/prefetch-progress.json',JSON.stringify({completed,total:2205}));}}}
await Promise.all([worker(),worker(),worker()]);
await writeFile('outputs/off131/game-content-lookups.json',JSON.stringify(log,null,2));
