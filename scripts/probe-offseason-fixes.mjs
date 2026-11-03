import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {loadProjectTs} from './lib/load-project-ts.mjs';
const require=createRequire(import.meta.url); require('next/cache').unstable_cache=(fn)=>fn;
const store=loadProjectTs('src/lib/data/canonical-start-store.ts');
const service=loadProjectTs('src/lib/data/start-service.ts');
const dates=await store.readCompleteCanonicalSlateStateDates('2026');
const result={dates,slates:[]};
for(const date of ['2026-09-27','2026-10-28']) {
 const rows=await service.getDailySlate({date,allowDemoFallback:false});
 const records=await store.readCanonicalStartRecords(date);
 const context=await service.getRankedSlateContextForStarts(date,'2026-11-03',rows);
 result.slates.push({date,rows:rows.length,records:records.length,finalRecords:records.filter(r=>r.status==='final').length,completion:context.completionState,progress:context.slateProgress,sources:rows.map(s=>s.source)});
}
await mkdir('../../reports/OFF-1.2',{recursive:true});
await writeFile('../../reports/OFF-1.2/diagnosis.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
