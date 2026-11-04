import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {createElement} from 'react';
import {renderToStaticMarkup as render} from 'react-dom/server';
import {loadProjectTs} from './lib/load-project-ts.mjs';
const {ImageConfigContext}=await import('next/dist/shared/lib/image-config-context.shared-runtime.js');
const {imageConfigDefault}=await import('next/dist/shared/lib/image-config.js');
const config={...imageConfigDefault,...loadProjectTs('next.config.ts').default.images};
const renderToStaticMarkup=node=>render(createElement(ImageConfigContext.Provider,{value:config},node));
const require=createRequire(import.meta.url);require('next/cache').unstable_cache=fn=>fn;
const file='src/app/starts/[id]/page.tsx';
const source=readFileSync(file,'utf8');
const mocks={
 '@/lib/data/featured-highlight-service':{resolveFeaturedStartHighlight:async()=>null},
 '@/lib/data/top-performer-image-service':{resolveTopPerformerImage:async()=>null},
 '@/lib/data/top-performer-metrics':{resolveTopPerformerMetrics:async()=>null},
};
const mod={exports:{}};
new Function('require','module','exports',ts.transpileModule(source+'\nexport {resolveArchivedStartOfDayHero, RankedStartCard};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText)(id=>mocks[id]??(id.startsWith('@/')?loadProjectTs('src/'+id.slice(2)+(id.includes('components/')?'.tsx':'.ts')):require(id)),mod,mod.exports);
const {canonicalRecordToFormStart}=loadProjectTs('src/lib/canonical-start-summary.ts');
const {TopPerformerCard}=loadProjectTs('src/components/top-performer-card.tsx');
const {startMatchupLabel}=loadProjectTs('src/lib/start-matchup-label.ts');
const records=JSON.parse(readFileSync('data/season-reviews/2026-canonical.json','utf8'));
for(const record of records.filter(r=>r.date==='2026-10-28')) {
 const start=canonicalRecordToFormStart(record,1),props=await mod.exports.resolveArchivedStartOfDayHero(start,2);
 assert.equal(props.team,record.team);assert.equal(props.side,record.side);
 const hero=renderToStaticMarkup(createElement(TopPerformerCard,{...props,fallbackPitcherId:undefined}));
 const row=renderToStaticMarkup(createElement(mod.exports.RankedStartCard,{start,displayRank:1}));
 const expected=startMatchupLabel(start);
 assert(hero.includes(expected.toUpperCase()));assert(row.includes(expected));
 console.log(`PASS ${record.side}: ${record.pitcherName}: hero = row = ${expected}`);
}
for(const file of ['src/components/top-performer-card.tsx','src/components/season-review.tsx','src/app/starts/[id]/page.tsx']) assert(readFileSync(file,'utf8').includes('from "@/lib/start-matchup-label"'));
assert(!readFileSync('src/components/season-review.tsx','utf8').includes('{start.pitcher.team} vs {start.opponent}'));
console.log('PASS shared orientation imports and offseason award-label sweep');
