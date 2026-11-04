import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const out='outputs/off22';mkdirSync(out,{recursive:true});
const source=readFileSync('src/components/season-review.tsx','utf8');
assert(source.includes('import { AwardPersonLayout } from "@/components/award-person-layout"'));
assert.equal((source.match(/<AwardPersonLayout /g)||[]).length,2);
for(const path of ['src/components/offseason-home.tsx','src/app/2026/page.tsx'])assert(readFileSync(path,'utf8').includes('from "@/components/season-review"'));
const layout=readFileSync('src/components/award-person-layout.tsx','utf8');
assert.equal((layout.match(/<Headshot /g)||[]).length,1);
assert(!layout.includes('use client'));assert(!layout.includes('innerWidth'));
const hashes={};
for(const path of execFileSync('git',['ls-files','src/data','data/season-reviews'],{encoding:'utf8'}).trim().split(/\r?\n/)){
 const before=execFileSync('git',['show',`c5ce5ac:${path}`],{maxBuffer:80*1024*1024}),after=readFileSync(path);
 assert(before.equals(after),path);hashes[path]=createHash('sha256').update(after).digest('hex');
}
writeFileSync(`${out}/frozen-hashes.json`,JSON.stringify(hashes,null,2));
console.log(`PASS: both surfaces import shared awards; podium and streak reuse one responsive layout and one Headshot, no mobile fork; ${Object.keys(hashes).length} frozen data files byte-identical to OFF-2.1.`);
