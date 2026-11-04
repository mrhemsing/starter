import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {loadProjectTs} from './lib/load-project-ts.mjs';
const require=createRequire(import.meta.url);
require('next/cache').unstable_cache=fn=>fn;
const all=JSON.parse(readFileSync('data/season-reviews/2026-canonical.json','utf8'));
const media=JSON.parse(readFileSync('src/data/season-review-media-2026.json','utf8'));
const before=JSON.stringify(all);
let state='season_complete';
const empty=async()=>[];
const deps={
 '@/lib/season-state':{getSeasonState:async()=>({status:state})},
 '@/lib/data/canonical-start-store':{readCanonicalStartRecords:async date=>all.filter(r=>r.date===date)},
 '@/lib/data/mlb-archive':{readArchivedStartByRouteId:async()=>null,readArchivedCompletedStarts:empty},
 '@/lib/data/supabase-archive':{readSupabaseArchivedCompletedStarts:empty},
 '@/lib/data/mlb-stats-client':{fetchMlbSchedule:()=>{throw new Error('Historical detail must not require live schedule');}},
};
const module={exports:{}};
const js=ts.transpileModule(readFileSync('src/lib/data/start-service.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
new Function('require','module','exports',js)(id=>deps[id]??(id.startsWith('@/')?loadProjectTs('src/'+id.slice(2)+'.ts'):require(id)),module,module.exports);
for(const id of Object.keys(media.highlights)) {
 const record=all.find(r=>r.id===id);state='season_complete';const winter=await module.exports.getStartDetail(id);
 state='in_season';const summer=await module.exports.getStartDetail(id);
 assert(winter,`Missing canonical detail ${id}`);assert.deepEqual(winter,summer);
 assert.deepEqual(winter.line,record.line);assert.equal(winter.gameScorePlus,record.gameScorePlus);
 assert.equal(winter.id,id);assert.equal(winter.gamePk,record.gamePk);
 assert.deepEqual(winter.pitchEvents,[]);assert.deepEqual(winter.arsenal,[]);
}
assert.equal(JSON.stringify(all),before);
console.log('PASS 41 canonical-only start details with missing archive shards, identical in both season states, no live schedule dependency, no fabricated pitch events, immutable lines/scores');
