import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {loadProjectTs} from './lib/load-project-ts.mjs';
const require=createRequire(import.meta.url);require('next/cache').unstable_cache=fn=>fn;
function load(file,deps={},extra='') {
 const module={exports:{}};const source=ts.transpileModule(readFileSync(file,'utf8')+extra,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',source)(id=>deps[id]??(id.startsWith('@/')?loadProjectTs('src/'+id.slice(2)+(id.includes('components/')?'.tsx':'.ts')):require(id)),module,module.exports);return module.exports;
}
const review=JSON.parse(readFileSync('src/data/season-review-2026.json','utf8'));
const {canonicalStartRecordFromSummary}=loadProjectTs('src/lib/canonical-start-record.ts');
const records=Array.from({length:30},(_,i)=>({...canonicalStartRecordFromSummary({...review.topStarts[i%25],id:`fixture-${i}`,date:'2026-09-27'}),status:i<28?'final':'live',source:{line:'live-gamefeed',lineStatus:i<28?'final':'live',schedule:'live',ranking:'schedule-derived-gamefeed-line'}}));
let status='season_complete',reads=0;
const season={getSeasonState:async()=>({status,year:2026})};
const dates=['2026-03-25','2026-09-27','2026-10-28'];
const archive=load('src/lib/data/season-archive-service.ts',{'@/lib/data/canonical-start-store':{readCanonicalSettledSlateDates:async()=>dates}});
const empty=date=>({date,source:'fixture',games:[]});
const service=load('src/lib/data/start-service.ts',{
 '@/lib/season-state':season,'@/lib/data/season-archive-service':archive,
 '@/lib/data/canonical-start-store':{readCanonicalStartRecords:async()=>{reads++;return records;},readCanonicalSlateState:async()=>({state:'active',counts:{totalStarts:30}})},
 '@/lib/data/mlb-archive':{readArchivedSchedule:async()=>null},
 '@/lib/data/mlb-stats-client':{fetchMlbSchedule:async date=>empty(date)},
});
const a=await service.getDailySlate({date:'2026-09-27',allowDemoFallback:false});status='in_season';
const b=await service.getDailySlate({date:'2026-09-27',allowDemoFallback:false});assert.deepEqual(a,b);assert.equal(a.length,30);assert.equal(reads,2);
const context=await service.getRankedSlateContextForStarts('2026-09-27','2026-11-03',a);assert.equal(context.completionState.totalStarts,30);assert.equal(context.slateProgress.totalStarts,30);assert.equal(context.completionState.completedStarts,28);assert.equal(context.slateProgress.state,'reconciling');
// Actual Sep27 conflict: two scheduled fixture records for a cancelled game must not become fake starts.
records[28].status='scheduled'; records[28].source={line:'fixture',schedule:'live',ranking:'schedule-derived-fixture-line'};
records[29].status='scheduled'; records[29].source={line:'fixture',schedule:'live',ranking:'schedule-derived-fixture-line'};
const cancelled=await service.getDailySlate({date:'2026-09-27',allowDemoFallback:false});assert.equal(cancelled.length,28);
const cancelledContext=await service.getRankedSlateContextForStarts('2026-09-27','2026-11-03',cancelled);assert.equal(cancelledContext.completionState.totalStarts,28);assert.equal(cancelledContext.completionState.isFinal,true);
status='season_complete';assert.equal(await service.getRankedStartsDefaultDate('2026-11-03'),'2026-10-28');assert.deepEqual((await service.getRankedStartsArchiveNavigation('2026-09-27','2026-11-03')).availableDates,dates);
const proxy=load('src/proxy.ts',{'@/lib/data/runtime-state-store':{readRuntimeState:async()=>({status,year:2026,finalSlateDate:'2026-10-28'})}});
for(const path of ['/live','/upcoming','/live/2026-10-28']) {
 const req={url:'https://test.example'+path,nextUrl:new URL('https://test.example'+path)};
 status='season_complete';assert.equal((await proxy.proxy(req)).status,302);
 status='in_season';assert.equal((await proxy.proxy(req)).status,200);
}
assert.equal((await proxy.proxy({url:'https://test.example/starts/2026-02-30',nextUrl:new URL('https://test.example/starts/2026-02-30')})).status,404);
const nav=load('src/components/site-nav.tsx',{'@/lib/season-state':season,'@/components/primary-nav-link':{PrimaryNavLink:({children,...props})=>createElement('a',props,children)},'@/components/live-nav-label':{LiveNavLabel:()=>createElement('span',{},'Live')}});
for(const [state,count] of [['season_complete',4],['in_season',6]]) {const html=render(await nav.SiteNav({active:'starts',today:'2026-11-03',liveSnapshot:{liveStarts:0,warmingStarts:0},seasonState:{status:state}}));assert.equal((html.match(/<a /g)||[]).length,count);}
const page=load('src/app/starts/[id]/page.tsx',{},'\nexport { RankedStartsEmptyState, resolveRankedStartsEmptyCause };');
const offday=render(createElement(page.RankedStartsEmptyState,{seasonComplete:true,cause:'off-day',completionState:{date:'2026-10-22'},date:'2026-10-22',settledStartsCount:0}));assert(offday.includes('season archive'));assert(!/Check upcoming|No starts scheduled|href="\/upcoming/.test(offday));
assert.equal(page.resolveRankedStartsEmptyCause({date:'2026-09-27',today:'2026-11-03',completionState:context.completionState,slateProgress:context.slateProgress,qualifiedStartsCount:30,visibleStartsCount:30}),null);
for(const file of ['src/components/offseason-home.tsx','src/components/season-complete.tsx','src/lib/data/start-service.ts']) assert(readFileSync(file,'utf8').includes('from "@/lib/data/season-archive-service"'));
console.log('OFF-1.2 PASS: identical season-flip canonical reads, 30-row Sep27 fixture, honest28final, matching chip/list, postseason default/dates, offday render, 302 redirects and in-season restore, four/six nav, invalid date404, shared final-slate imports.');
