import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadProjectTs} from './lib/load-project-ts.mjs';
const rows=JSON.parse(readFileSync('data/season-reviews/2026-canonical.json'));
const {compareRenderedPitcher,checkRenderedPitchers}=loadProjectTs('src/lib/pitcher-rendered-integrity.ts');
const {outsFromIP}=loadProjectTs('src/lib/innings.ts');
const ids=['647336','694819','660271'];
const samples=ids.map(pitcherId=>({pitcherId,records:rows.filter(r=>String(r.pitcherMlbId)===pitcherId)}));
const html=(records,omit=false)=>{
 const outs=records.reduce((sum,r)=>sum+outsFromIP(r.line.inningsPitched),0),ip=(Math.floor(outs/3)+outs%3/10).toFixed(1);
 return `<p data-pitcher-season-stats="">ERA 3.41 · IP ${ip} · W-L 9-5</p>`+records.slice(omit?1:0).map(r=>`<details data-responsive-check="pitcher-game-log-row"><summary><a>${r.date}</a></summary></details>`).join('');
};
for(const sample of samples){assert(compareRenderedPitcher(html(sample.records),sample.records).ok);assert(!compareRenderedPitcher(html(sample.records,true),sample.records).ok);}
const alerts=[];
assert.equal((await checkRenderedPitchers(samples,async id=>html(samples.find(s=>s.pitcherId===id).records,true),(...args)=>alerts.push(args))).ok,false);
assert.equal(alerts.length,1);
const state=loadProjectTs('src/lib/season-state.ts'),store=loadProjectTs('src/lib/data/canonical-start-store.ts');
const client=loadProjectTs('src/lib/data/mlb-stats-client.ts');
client.fetchMlbPitcherSeasonStartLedger=async id=>({starts:samples.find(s=>s.pitcherId===String(id)).records.map(r=>({gamePk:r.gamePk}))});
state.getSeasonState=async()=>({status:'season_complete',year:2026,finalSlateDate:'2026-10-28'});
store.readCanonicalPitcherSeasonRecords=async id=>samples.find(s=>s.pitcherId===id).records;
const savedFetch=globalThis.fetch,savedError=console.error,savedSecret=process.env.CRON_SECRET;
process.env.CRON_SECRET='test-secret';console.error=(...args)=>alerts.push(args);
try {
 const {GET}=loadProjectTs('src/app/api/cron/pitcher-integrity/route.ts');
 const request=()=>new Request('https://example.test/api/cron/pitcher-integrity',{headers:{authorization:'Bearer test-secret'}});
 assert.equal((await GET(new Request('https://example.test/api/cron/pitcher-integrity'))).status,401);
 globalThis.fetch=async url=>new Response(html(samples.find(s=>url.endsWith(s.pitcherId)).records));
 const pass=await GET(request());assert.equal(pass.status,200);assert.equal((await pass.json()).seasonState,'season_complete');
 globalThis.fetch=async url=>new Response(html(samples.find(s=>url.endsWith(s.pitcherId)).records,true));
 assert.equal((await GET(request())).status,500);assert.equal(alerts.length,2);
 globalThis.fetch=async url=>new Response(html(samples.find(s=>url.endsWith(s.pitcherId)).records));
 client.fetchMlbPitcherSeasonStartLedger=async id=>({starts:[...samples.find(s=>s.pitcherId===String(id)).records.map(r=>({gamePk:r.gamePk})),{gamePk:999999999}]});
 assert.equal((await GET(request())).status,500);assert.equal(alerts.length,3);
}finally{globalThis.fetch=savedFetch;console.error=savedError;if(savedSecret===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=savedSecret;}
assert(JSON.parse(readFileSync('vercel.json')).crons.some(job=>job.path==='/api/cron/pitcher-integrity'&&job.schedule==='30 10 * * *'));
console.log('PASS: heavy/postseason + LTD + Soroka samples; count/date/IP parity; seeded missing row fails and alerts; actual nightly route returns 500; season_complete executes; unauthorized request rejected.');
