import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const review=JSON.parse(readFileSync('src/data/season-review-2026.json'));
const log=JSON.parse(readFileSync('data/season-reviews/2026-highlight-backfill-log.json'));
const out=[];
for(const index of [3,4,5,6,7]) {
 const start=review.topStarts[index],o=log.outcomes.find(o=>o.startId===start.id),v=o.selected;
 const lookup=o.lookups.find(l=>l.candidates?.some(c=>c.id===v.videoId&&c.channelId));const c=lookup.candidates.find(c=>c.id===v.videoId);
 assert.equal(c.channelId,log.channel);assert(c.title.toLowerCase().includes(start.pitcher.name.split(' ').at(-1).toLowerCase()));
 const hours=(Date.parse(c.publishedAt)-Date.parse(start.date+'T00:00:00Z'))/3600000;assert(hours>=0&&hours<=42);
 const response=execFileSync('curl.exe',['-sS','--fail','--max-time','45','https://www.youtube.com/oembed?url='+encodeURIComponent(v.watchUrl)+'&format=json'],{encoding:'utf8'});const live=JSON.parse(response);assert.equal(live.author_name,'MLB');assert.equal(live.title,c.title);
 out.push({rank:index+1,pitcher:start.pitcher.name,date:start.date,gamePk:start.gamePk,url:v.watchUrl,title:c.title,publishedAt:c.publishedAt,officialChannel:c.channelId,liveOembed:live,originalMetadataReceipt:lookup.responseFile,result:'PASS'});
}
writeFileSync('outputs/off14/link-sample.json',JSON.stringify(out,null,2));console.log('PASS five live official MLB links with matching pitcher/title and game-date publication window, ranks 4-8.');
