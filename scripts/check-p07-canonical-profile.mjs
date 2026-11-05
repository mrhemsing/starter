import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {loadProjectTs} from './lib/load-project-ts.mjs';
const {selectCanonicalStarts}=loadProjectTs('src/lib/canonical-start-selection.ts');
const storedRecords=JSON.parse(readFileSync('data/season-reviews/2026-canonical.json'));
const records=selectCanonicalStarts(storedRecords);
const {canonicalPitcherProfile}=loadProjectTs('src/lib/canonical-pitcher-profile.ts');
const {outsFromIP}=loadProjectTs('src/lib/innings.ts');
const manifest=JSON.parse(readFileSync('src/data/pitcher-arsenals-2026.json'));
for(const [id,rows] of Map.groupBy(records,r=>r.pitcherMlbId)){
 const profile=canonicalPitcherProfile(rows);
 assert.equal(profile.starts.length,rows.length);
 assert.equal(outsFromIP(profile.seasonLine.inningsPitched),rows.reduce((sum,r)=>sum+outsFromIP(r.line.inningsPitched),0));
 for(const start of profile.starts){const source=rows.find(r=>r.id===start.id);assert.deepEqual(start.line,source.line);assert.equal(start.gameScorePlus,source.gameScorePlus);}
 const arsenal=manifest.pitchers[id];assert(arsenal);assert.equal(arsenal.covered,rows.length);assert.deepEqual(arsenal.startIds.slice().sort(),rows.map(r=>r.id).sort());assert.equal(arsenal.missing.length,0);
 assert(arsenal.pitches>0);
 assert.equal(arsenal.velocityByStart.length,rows.length);assert.equal(arsenal.pitchMixByStart.length,rows.length);
 assert.deepEqual(arsenal.pitchMixByStart.map(s=>s.id).sort(),rows.map(r=>r.id).sort());
}
const authorized=new Set(['data/season-reviews/2026-canonical.json','data/season-reviews/2026-receipt.json','data/season-reviews/2026-no-hitter-audit.json','src/data/season-review-2026.json','src/data/season-recap-corrections-2026.json','src/data/season-no-hitters-2026.json']);
for(const path of execFileSync('git',['ls-tree','-r','--name-only','a2ee00d','src/data','data/season-reviews'],{encoding:'utf8'}).trim().split('\n')){
 if(authorized.has(path))continue;
 const old=execFileSync('git',['show',`a2ee00d:${path}`],{maxBuffer:80_000_000});assert(old.equals(readFileSync(path)),path+' frozen bytes');
}
const old=JSON.parse(execFileSync('git',['show','a2ee00d:data/season-reviews/2026-canonical.json'],{maxBuffer:80_000_000}));
for(const row of old)assert.deepEqual(storedRecords.find(r=>r.id===row.id),row,'Existing frozen record '+row.id);
const oldRecaps=JSON.parse(execFileSync('git',['show','a2ee00d:src/data/season-recap-corrections-2026.json']));
const recaps=JSON.parse(readFileSync('src/data/season-recap-corrections-2026.json'));
for(const [id,recap] of Object.entries(oldRecaps))assert.deepEqual(recaps[id],recap);
assert.equal(records.length,4938);assert.equal(storedRecords.length,4956);
const {settleMissingCanonicalProjection,insertMissingSettledCanonicalRecords}=loadProjectTs('src/lib/data/canonical-start-store.ts');
await assert.rejects(()=>settleMissingCanonicalProjection(old[0],{id:old[0].id},'seed'),/only settle an unfrozen projection/);
await assert.rejects(()=>insertMissingSettledCanonicalRecords([old[0]],{reason:'seed',allowedStartIds:[]}),/authorization/);
console.log('PASS: 380 canonical profiles, 4938 distinct starts, 4425 original frozen records and existing recaps unchanged, full pitch coverage; only authorized derived fields updated.');
