import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadProjectTs} from './lib/load-project-ts.mjs';
const out='outputs/off21';mkdirSync(out,{recursive:true});
const review=JSON.parse(readFileSync('src/data/season-review-2026.json'));
const {teamLogoUrl}=loadProjectTs('src/lib/team-metadata.ts');
const logos=[];
for(const row of review.rotation){
 const url=teamLogoUrl(row.team);assert.equal(new URL(url).hostname,'www.mlbstatic.com');assert(url.endsWith('.svg'));
 const response=await fetch(url);assert.equal(response.status,200);assert(response.headers.get('content-type').includes('image/svg+xml'));
 const body=await response.text();assert(body.includes('<svg'));assert(!/<image\b|data:image\/(?:png|jpeg|webp)/i.test(body),'SVG must be vector, not a raster wrapper');
 logos.push({team:row.team,url,status:response.status,type:response.headers.get('content-type'),vector:true});
}
writeFileSync(`${out}/logo-source-checks.json`,JSON.stringify(logos,null,2));
const {ArchiveType}=loadProjectTs('src/components/archive-type.tsx');
const text="Tatsuya Imai's 6.0 hitless innings on 2026-05-25.";
const typed=renderToStaticMarkup(createElement(ArchiveType,{text,names:['Tatsuya Imai']}));
assert(typed.includes('data-archive-name'));assert.equal((typed.match(/data-archive-number/g)||[]).length,4);
assert.equal(typed.replace(/<[^>]+>/g,'').replaceAll('&#x27;',"'"),text);
const {SeasonRotationRow}=loadProjectTs('src/components/season-rotation-row.tsx');
const winner=renderToStaticMarkup(createElement(SeasonRotationRow,{row:review.rotation[0],winner:true}));
assert(winner.includes('data-rotation-treatment="winner"'));assert.equal((winner.match(/data-rotation-logo=/g)||[]).length,2);
const dense=renderToStaticMarkup(createElement(SeasonRotationRow,{row:review.rotation[0],winner:true,dense:true}));assert(dense.includes('data-rotation-treatment="dense"'));assert(!dense.includes('archive-rotation-ghost'));
const source=readFileSync('src/components/season-review.tsx','utf8');assert(source.includes('className="archive-start-grid"'));assert(source.includes('row={row} winner={row.rank === 1} dense'));assert(source.includes('FeaturedStartHighlightEmbed'));
for(const path of ['src/components/offseason-home.tsx','src/app/2026/page.tsx'])assert(readFileSync(path,'utf8').includes('from "@/components/season-review"'));
const frozenFiles=execFileSync('git',['ls-files','src/data','data/season-reviews'],{encoding:'utf8'}).trim().split(/\r?\n/);
const hashes={};
for(const path of frozenFiles){const before=execFileSync('git',['show',`HEAD:${path}`],{maxBuffer:80*1024*1024});const after=readFileSync(path);assert(before.equals(after),path);hashes[path]=createHash('sha256').update(after).digest('hex');}
writeFileSync(`${out}/frozen-hashes.json`,JSON.stringify(hashes,null,2));
console.log(`OFF-2.1 PASS: ${logos.length} official real SVGs; shared grid/rows; dense disclosure; numeric/name typography preserves copy; ${frozenFiles.length} frozen data files byte-identical.`);
