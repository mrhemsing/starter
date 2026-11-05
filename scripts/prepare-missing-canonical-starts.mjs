import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadProjectTs} from './lib/load-project-ts.mjs';
process.loadEnvFile('../starter/.env.local');
const out='outputs/p07/reconciliation';mkdirSync(`${out}/settle-inputs`,{recursive:true});
const nativeFetch=globalThis.fetch;
globalThis.fetch=async(url,options)=>{
 if(!String(url).startsWith('https://statsapi.mlb.com/')) return nativeFetch(url,options);
 const game=String(url).match(/\/game\/(\d+)\/feed\/live$/);
 const file=game?`outputs/p07/feeds/${game[1]}.json`:`${out}/settle-inputs/${createHash('sha256').update(String(url)).digest('hex')}.json`;
 if(existsSync(file))return new Response(readFileSync(file),{status:200});
 const response=await nativeFetch(url,{...options,signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw new Error(`Official input ${response.status} ${url}`);
 const body=await response.text();writeFileSync(file,body);return new Response(body,{status:200});
};
const {prepareOfficialSettledStarts}=loadProjectTs('src/lib/data/start-service.ts');
const {canonicalStartRecordFromSummary}=loadProjectTs('src/lib/canonical-start-record.ts');
const {outsFromIP}=loadProjectTs('src/lib/innings.ts');
const holes=JSON.parse(readFileSync(`${out}/list.json`)).flatMap(p=>p.missing.map(s=>({...s,pitcherId:Number(p.pitcherId)})));
const records=[],summaries=[];
for(const [date,missing] of [...Map.groupBy(holes,s=>s.date)].sort()){
 const starts=await prepareOfficialSettledStarts(date,[...new Set(missing.map(s=>s.gamePk))]);
 for(const hole of missing){
  const start=starts.find(s=>s.gamePk===hole.gamePk&&s.pitcher.mlbId===hole.pitcherId);
  if(!start)throw new Error(`Settle builder missing ${JSON.stringify(hole)}`);
  if(outsFromIP(start.line.inningsPitched)!==hole.outs)throw new Error(`Official outs mismatch ${start.id}`);
  const record=canonicalStartRecordFromSummary(start);
  if(!record.frozen||record.status!=='final')throw new Error(`Unsettled ${record.id}`);
  records.push(record);summaries.push(start);
 }
 writeFileSync(`${out}/new-records.json`,JSON.stringify(records));
 writeFileSync(`${out}/new-summaries.json`,JSON.stringify(summaries));
 console.log(date,missing.length,'prepared',records.length,'/',holes.length);
}
if(records.length!==holes.length)throw new Error('Incomplete preparation');
console.log('PREPARED ONLY: no database writes',records.length);
