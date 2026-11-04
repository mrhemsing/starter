import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { loadProjectTs } from './lib/load-project-ts.mjs';
import { featuredHighlightTargets, assertBackfillCoverage } from './lib/season-highlight-targets.mjs';
const json=async file=>JSON.parse(await readFile(file,'utf8'));
const review=await json('src/data/season-review-2026.json');
const media=await json('src/data/season-review-media-2026.json');
const records=await json('data/season-reviews/2026-canonical.json');
const log=await json('data/season-reviews/2026-highlight-backfill-log.json');
const summary=await json('data/season-reviews/2026-highlight-backfill-summary.json');
const coverLog=await json('data/season-reviews/2026-highlight-cover-log.json');
const targets=featuredHighlightTargets(review,records);
assertBackfillCoverage(targets,log.outcomes,review.topStarts);
assert.throws(()=>assertBackfillCoverage(targets,log.outcomes.slice(1),review.topStarts),/Unqueried/);
const wrong=structuredClone(log.outcomes);wrong[0].gamePk=0;
assert.throws(()=>assertBackfillCoverage(targets,wrong,review.topStarts),/identity/);
const errors=structuredClone(log.outcomes);errors[0].outcome='lookup_error';
assert.throws(()=>assertBackfillCoverage(targets,errors,review.topStarts),/error/);
const low=structuredClone(log.outcomes);for(const row of low) if(review.topStarts.slice(0,6).some(s=>s.id===row.startId))row.outcome='no_match';
assert.throws(()=>assertBackfillCoverage(targets,low,review.topStarts),/DISCOVERY BUG/);
for(const [file,hash] of Object.entries(summary.frozenFiles))assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),hash,`Frozen ${file}`);
const {highlights,...nonHighlight}=media;
assert.equal(createHash('sha256').update(JSON.stringify(nonHighlight)).digest('hex'),'89cdb8a56193ae48f4b01ea8b28d254b3d8a594a4fd378e7c842c6d9c1debff8','Frozen hero/image metadata');
for(const row of log.outcomes) {
 const asset=highlights[row.startId];assert(asset,'All discovered references published');
 assert.equal(asset.videoId,(coverLog.relinks.find(r=>r.startId===row.startId)?.after??row.selected).videoId);
 if(asset.source==='mlb-game-content') {
  assert.match(asset.embedUrl,/^https:\/\/(mlb-cuts-diamond\.mlb\.com\/FORGE\/.+|bdata-producedclips\.mlb\.com\/[a-f0-9-]+)\.mp4$/);
  assert.equal(new URL(asset.thumbnailUrl).hostname,'img.mlbstatic.com');
 } else {assert.equal(new URL(asset.embedUrl).hostname,'www.youtube-nocookie.com');assert.equal(new URL(asset.thumbnailUrl).hostname,'img.youtube.com');}
 assert(!/\u2014/.test(row.selected.title??''),'No new em dash');
}
const {resolveFeaturedStartHighlight}=loadProjectTs('src/lib/data/featured-highlight-service.ts');
const original=globalThis.fetch;
globalThis.fetch=()=>{throw new Error('Published detail lookup must not rediscover');};
try { for(const start of targets) { const {coverImage,...asset}=await resolveFeaturedStartHighlight(start); assert.deepEqual(asset,highlights[start.id]); } } finally {globalThis.fetch=original;}
console.log(`PASS ${targets.length} queried featured starts; ${review.topStarts.filter(s=>highlights[s.id]).length}/25 highlights; reject unqueried, wrong game, HTTP failure and <20 coverage; frozen bytes/hero unchanged; detail resolver reuses all stored references without network`);

const {resolveYouTubeHighlight,resolveMlbChannelId,resolveMlbGameContentHighlight}=loadProjectTs('src/lib/data/highlight-discovery.ts');
const channel='UCoLrcjPV5PbUrUyXq5mjc_A';
const start=review.topStarts[0];
const item=(id,title,channelId=channel)=>({id:{videoId:id},snippet:{title,channelId,description:'',publishedAt:`${start.date}T20:00:00Z`}});
let fail=false;
globalThis.fetch=async input=>{
 const url=new URL(input);
 if(fail)return new Response('{}',{status:403});
 if(url.pathname.endsWith('/channels'))return Response.json({items:[{id:channel}]});
 if(url.pathname.endsWith('/videos'))return Response.json({items:[{id:'good',snippet:{channelId:channel},status:{embeddable:true},contentDetails:{duration:'PT2M'}}]});
 return Response.json({items:[item('wrong-channel','Misiorowski strikeouts','unofficial'),item('recap','Misiorowski game highlights'),item('unrelated','Other Pitcher strikeouts'),item('disabled','Misiorowski strikeouts'),item('good','Jacob Misiorowski strikeouts')]});
};
try {
 assert.equal(await resolveMlbChannelId('fixture'),channel);
 assert.equal((await resolveYouTubeHighlight({start,youtubeApiKey:'fixture',mlbChannelId:channel})).videoId,'good');
 fail=true;await assert.rejects(resolveYouTubeHighlight({start,youtubeApiKey:'fixture',mlbChannelId:channel}),/403/);
}finally{globalThis.fetch=original;}
const clip={type:'video',title:'Jacob Misiorowski strikes out twelve',slug:'jacob-misiorowski-strikes-out-twelve',keywordsAll:[{value:'highlight-reel-starting-pitching',displayName:'highlight reel starting pitching'}],image:{cuts:[{aspectRatio:'16:9',width:1920,src:'https://img.mlbstatic.com/mlb-images/image/upload/test.jpg'}]},playbacks:[{name:'mp4Avc',url:'https://mlb-cuts-diamond.mlb.com/FORGE/test.mp4'}]};
const content={highlights:{highlights:{items:[clip]}}};
assert(resolveMlbGameContentHighlight(start,content),'Starting-pitching taxonomy regression');
assert.equal(resolveMlbGameContentHighlight(start,{highlights:{highlights:{items:[{...clip,title:'Other Pitcher strikeouts',slug:'other-pitcher'}]}}}),null);
assert.equal(resolveMlbGameContentHighlight(start,{highlights:{highlights:{items:[{...clip,playbacks:[{name:'mp4Avc',url:'https://unapproved.example/clip.mp4'}]}]}}}),null);
console.log('PASS shared discovery: official channel, recap/unrelated/unembeddable rejection, API failure is loud, starting-pitching tag, wrong pitcher and unapproved host rejection');
