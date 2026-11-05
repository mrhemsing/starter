import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {loadProjectTs} from './lib/load-project-ts.mjs';
process.loadEnvFile('../starter/.env.local');
const dir='outputs/p07/reconciliation';
const before=JSON.parse(readFileSync(`${dir}/canonical-before.json`));
const added=JSON.parse(readFileSync(`${dir}/new-records.json`));
const official=JSON.parse(readFileSync(`${dir}/official-ledgers.json`));
const {insertMissingSettledCanonicalRecords,readRawCanonicalPitcherSeasonRecords}=loadProjectTs('src/lib/data/canonical-start-store.ts');
const {selectCanonicalStarts}=loadProjectTs('src/lib/canonical-start-selection.ts');
const {compareCanonicalOfficial}=loadProjectTs('src/lib/pitcher-rendered-integrity.ts');
const known=new Set(before.map(r=>`${r.gamePk}:${r.pitcherMlbId}`));
assert(added.every(r=>!known.has(`${r.gamePk}:${r.pitcherMlbId}`)));
assert.equal(new Set(added.map(r=>`${r.gamePk}:${r.pitcherMlbId}`)).size,added.length);
for(const [id,ledger] of Object.entries(official))assert(compareCanonicalOfficial(selectCanonicalStarts([...before,...added].filter(r=>String(r.pitcherMlbId)===id)),ledger).ok,`Proposed official parity ${id}`);
if(!process.argv.includes('--apply')){console.log('PASS additive plan',added.length,'new records; all official ledgers match. Use --apply to insert.');process.exit(0);}
const inserted=[];
for(let i=0;i<added.length;i+=50){inserted.push(...await insertMissingSettledCanonicalRecords(added.slice(i,i+50),{reason:'Matt authorized P0-7 missing starts additive repair; existing frozen records must not change',allowedStartIds:added.map(r=>r.id)}));console.log('Inserted',inserted.length);}
const after=[],results=[];
for(const [id,ledger] of Object.entries(official)){
 const rows=await readRawCanonicalPitcherSeasonRecords(id,'2026');after.push(...rows);
 const result=compareCanonicalOfficial(selectCanonicalStarts(rows),ledger);results.push({pitcherId:id,...result});
 assert(result.ok,`Official parity after insert ${id}`);
}
const byId=new Map(after.map(r=>[r.id,r]));
for(const record of before)assert.deepEqual(byId.get(record.id),record,`Existing frozen record changed ${record.id}`);
writeFileSync(`${dir}/canonical-after.json`,JSON.stringify(after));
writeFileSync(`${dir}/ingest-receipt.json`,JSON.stringify({existingUnchanged:before.length,inserted:inserted.length,ids:inserted,results},null,2));
console.log('PASS existing frozen records unchanged',before.length,'official pitchers matched',results.length,'total',after.length);
