import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadProjectTs} from './lib/load-project-ts.mjs';
process.loadEnvFile('../starter/.env.local');
const [base='http://localhost:3026',out='outputs/p07/built-sweep']=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const {readCanonicalPitcherRegistry,readCanonicalPitcherSeasonRecords}=loadProjectTs('src/lib/data/canonical-start-store.ts');
const {compareRenderedPitcher}=loadProjectTs('src/lib/pitcher-rendered-integrity.ts');
const {pitcherHref}=loadProjectTs('src/lib/routes.ts');
const pitchers=await readCanonicalPitcherRegistry('2026');
const results=existsSync(`${out}/results.json`)?JSON.parse(readFileSync(`${out}/results.json`)):[];
const done=new Set(results.filter(r=>r.ok).map(r=>r.pitcherId));let cursor=0;
const hash=records=>createHash('sha256').update(JSON.stringify(records.map(({id,line,gameScorePlus,gameScoreV2,narrativeNotables})=>({id,line,gameScorePlus,gameScoreV2,narrativeNotables})))).digest('hex');
async function worker(){while(cursor<pitchers.length){const {pitcherId}=pitchers[cursor++];if(done.has(pitcherId))continue;
 let result;
 try{
  const records=await readCanonicalPitcherSeasonRecords(pitcherId,'2026');
  const url=base+pitcherHref({pitcherId,name:records.at(-1).pitcherName});
  const response=await fetch(url,{signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  const html=await response.text();
  result={pitcherId,name:records.at(-1).pitcherName,url,...compareRenderedPitcher(html,records),frozenSemanticsSha256:hash(records)};
 }catch(error){result={pitcherId,ok:false,error:String(error)};}
 const previous=results.findIndex(r=>r.pitcherId===pitcherId);if(previous>=0)results[previous]=result;else results.push(result);
 writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));
 writeFileSync(`${out}/summary.json`,JSON.stringify({checked:results.length,total:pitchers.length,passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length}));
 console.log(`${results.length}/${pitchers.length} ${pitcherId} ${result.ok?'PASS':'FAIL'}`);
}}
await Promise.all([worker(),worker(),worker()]);
if(results.some(r=>!r.ok)||results.length!==pitchers.length)process.exitCode=1;
