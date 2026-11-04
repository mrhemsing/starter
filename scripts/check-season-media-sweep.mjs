import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertSettledMediaCoverage} from './lib/settled-media-targets.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const records=read('data/season-reviews/2026-canonical.json');
assert(records.every(r=>r.status==='final'&&r.frozen&&r.source?.line!=='fixture'));
const rows=read('data/season-reviews/2026-settled-media-log.json').outcomes;
const media=read('src/data/start-media-2026.json');
const post=new Set(read('data/season-reviews/2026-postseason-media-log.json').outcomes.map(x=>x.gamePk));
assert.equal(new Set(rows.map(x=>x.gamePk)).size,2205);assert.equal(rows.length,4425);assert.equal(Object.keys(media).length,4425);
assertSettledMediaCoverage(records,rows,post);
for(const row of rows){assert.deepEqual(media[row.startId],row.selected);if(!row.selected.highlight&&row.youtubeError)assert.equal(row.highlightOutcome,'deferred_quota','API error cannot become an availability verdict');}
const summary={};for(const tier of ['postseason','gem','other']){const group=rows.filter(x=>x.tier===tier);summary[tier]={starts:group.length,contentHighlights:group.filter(x=>x.contentHighlight).length,images:group.filter(x=>x.selected.image).length,highlights:group.filter(x=>x.selected.highlight).length,youtubeResolved:group.filter(x=>x.selected.highlight?.source==='youtube-search').length,deferred:group.filter(x=>x.youtubeError).length};}
console.log('PASS 2,205/2,205 exact-game content lookups, 4,425/4,425 start outcomes, approved assets, frozen identity coverage, no bulk YouTube fallback');
console.log(JSON.stringify(summary,null,2));
if(process.argv.includes('--require-complete'))assert.equal(rows.filter(x=>x.youtubeError).length,0,'INCOMPLETE: YouTube quota-deferred eligible fallback lookups remain');
