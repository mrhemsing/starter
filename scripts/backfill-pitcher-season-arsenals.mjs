import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {loadProjectTs} from './lib/load-project-ts.mjs';
const out='outputs/p07';mkdirSync(`${out}/feeds`,{recursive:true});
const records=JSON.parse(readFileSync(process.argv[2]??'data/season-reviews/2026-canonical.json'));
const {fetchMlbStartPitchDetails,summarizePitchEvents}=loadProjectTs('src/lib/data/mlb-stats-client.ts');
const {buildPitcherVelocityByStart,buildPitcherPitchMixByStart,buildPitcherSkillProfile}=loadProjectTs('src/lib/data/start-service.ts');
const {startPath}=loadProjectTs('src/lib/routes.ts');
const nativeFetch=globalThis.fetch,inflight=new Map();let nextRequest=0;
globalThis.fetch=async(url,options)=>{
 const match=String(url).match(/\/game\/(\d+)\/feed\/live$/);if(!match)throw new Error('Unexpected backfill endpoint');
 const key=match[1],path=`${out}/feeds/${key}.json`;
 if(existsSync(path))return new Response(readFileSync(path),{status:200});
 if(!inflight.has(key))inflight.set(key,(async()=>{
  const delay=Math.max(0,nextRequest-Date.now());nextRequest=Math.max(nextRequest,Date.now())+250;
  await new Promise(r=>setTimeout(r,delay));
  for(let attempt=0;attempt<3;attempt++){
   const response=await nativeFetch(url,{...options,signal:AbortSignal.timeout(30000)});
   if(response.ok){const body=await response.text();writeFileSync(path,body);return body;}
   await new Promise(r=>setTimeout(r,1000*(attempt+1)));
  }throw new Error(`Game feed failed ${key}`);
 })());
 return new Response(await inflight.get(key),{status:200});
};
const groups=[...Map.groupBy(records,r=>r.pitcherMlbId)],result={year:2026,through:records.map(r=>r.date).sort().at(-1),pitchers:{}};
let cursor=0,completed=0;
async function worker(){while(cursor<groups.length){const [id,rows]=groups[cursor++];const events=[],covered=[],missing=[],starts=[];
 for(const row of rows){const detail=await fetchMlbStartPitchDetails(row.gamePk,id,{fetchLive:true});starts.push({...row,pitchEvents:detail?.pitchEvents??[],startHref:startPath(row.id)});if(detail?.pitchEvents.length){events.push(...detail.pitchEvents);covered.push(row.id);}else missing.push(row.id);}
 result.pitchers[id]={arsenal:summarizePitchEvents(events),expected:rows.length,covered:covered.length,startIds:covered,missing,pitches:events.length,firstDate:rows.map(r=>r.date).sort()[0],lastDate:rows.map(r=>r.date).sort().at(-1)};
 starts.sort((a,b)=>b.date.localeCompare(a.date));
 Object.assign(result.pitchers[id],{velocityByStart:buildPitcherVelocityByStart(starts),pitchMixByStart:buildPitcherPitchMixByStart(starts),skillProfile:buildPitcherSkillProfile(starts,'canonical')});
 completed++;writeFileSync(`${out}/arsenal-backfill-progress.json`,JSON.stringify({completed,total:groups.length}));
 writeFileSync(`${out}/season-arsenals.json`,JSON.stringify(result));console.log(`${completed}/${groups.length} ${id}: ${covered.length}/${rows.length} starts`);
}}
await Promise.all([worker(),worker(),worker()]);
console.log('DONE',completed);
