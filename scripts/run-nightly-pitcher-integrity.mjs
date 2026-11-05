import {mkdirSync,writeFileSync} from 'node:fs';
import {loadProjectTs} from './lib/load-project-ts.mjs';
if(process.env.P07_ENV_FILE)process.loadEnvFile(process.env.P07_ENV_FILE);
const base=process.env.THE_BUMP_BASE_URL??'https://www.toetheslab.com';
const {resolveSeasonState}=loadProjectTs('src/lib/season-state.ts');
const {readRuntimeState}=loadProjectTs('src/lib/data/runtime-state-store.ts');
const {readCanonicalPitcherRegistry,readCanonicalPitcherSeasonRecords}=loadProjectTs('src/lib/data/canonical-start-store.ts');
const {fetchMlbSeasonStartingPitcherIds,fetchMlbPitcherSeasonStartLedger}=loadProjectTs('src/lib/data/mlb-stats-client.ts');
const {compareCanonicalOfficial,checkRenderedPitchers}=loadProjectTs('src/lib/pitcher-rendered-integrity.ts');
const {pitcherHref}=loadProjectTs('src/lib/routes.ts');
// CLI jobs have no Next incremental cache. Use the same resolver with the uncached store reader.
const state=resolveSeasonState(await readRuntimeState('season-state',true)),year=String(state.year);
const officialIds=await fetchMlbSeasonStartingPitcherIds(year,{fetchLive:true,signal:AbortSignal.timeout(30000)});
const canonicalIds=await readCanonicalPitcherRegistry(year);
const ids=[...new Set([...officialIds.map(String),...canonicalIds.map(p=>p.pitcherId)])];
const samples=[],results=[];let cursor=0;
async function worker(){while(cursor<ids.length){const pitcherId=ids[cursor++];const records=await readCanonicalPitcherSeasonRecords(pitcherId,year);const official=await fetchMlbPitcherSeasonStartLedger(Number(pitcherId),year,{fetchLive:true,signal:AbortSignal.timeout(30000)});results.push({pitcherId,...compareCanonicalOfficial(records,official)});if(['647336','694819','660271'].includes(pitcherId))samples.push({pitcherId,records});}}
await Promise.all([worker(),worker(),worker()]);
const rendered=await checkRenderedPitchers(samples,async id=>{const sample=samples.find(s=>s.pitcherId===id);const url=base+pitcherHref({pitcherId:id,name:sample.records.at(-1).pitcherName});const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error(`Rendered page HTTP ${response.status}`);return response.text();});
const failed=results.filter(r=>!r.ok),ok=!failed.length&&rendered.ok&&samples.length===3;
mkdirSync('outputs/p07/nightly',{recursive:true});writeFileSync('outputs/p07/nightly/latest.json',JSON.stringify({at:new Date().toISOString(),seasonState:state.status,ok,results,rendered},null,2));
if(!ok)throw Error(`P0-7 integrity alert: ${failed.length} official count mismatches; rendered=${rendered.ok}. See outputs/p07/nightly/latest.json`);
console.log(`PASS nightly integrity: ${results.length} official/canonical counts, ${samples.length} rendered count/date/IP samples, state=${state.status}`);
