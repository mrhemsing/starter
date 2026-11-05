import {readFileSync,writeFileSync} from 'node:fs';
import {loadProjectTs} from './lib/load-project-ts.mjs';
process.loadEnvFile('../starter/.env.local');
const dir='outputs/p07/reconciliation';
const rows=JSON.parse(readFileSync(`${dir}/existing-hole-rows.json`)).filter(r=>!r.frozen&&r.status!=='final');
const summaries=JSON.parse(readFileSync(`${dir}/new-summaries.json`));
const {settleMissingCanonicalProjection}=loadProjectTs('src/lib/data/canonical-start-store.ts');
const settled=[];let cursor=0;
async function worker(){while(cursor<rows.length){const row=rows[cursor++];const start=summaries.find(s=>s.id===row.start_id);settled.push(await settleMissingCanonicalProjection(row.record,start,'Matt authorized P0-7 normal settle of missing final starts, preserving all existing frozen records'));writeFileSync(`${dir}/settled-projections.json`,JSON.stringify(settled));console.log('Settled',settled.length,'/',rows.length);}}
await Promise.all([worker(),worker(),worker()]);
