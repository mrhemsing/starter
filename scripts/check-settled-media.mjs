import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadProjectTs} from './lib/load-project-ts.mjs';
import {assertSettledMediaCoverage,mediaTier} from './lib/settled-media-targets.mjs';
const {resolveMlbGameContentHighlight}=loadProjectTs('src/lib/data/highlight-discovery.ts');
const {resolveMlbGameContentActionImageFromContent}=loadProjectTs('src/lib/data/top-performer-image-service.ts');
const {canonicalRecordToFormStart}=loadProjectTs('src/lib/canonical-start-summary.ts');
const records=JSON.parse(readFileSync('data/season-reviews/2026-canonical.json','utf8'));
const start=canonicalRecordToFormStart(records.find(x=>x.id==='2026-10-28-mil-tb-694819'),1);
const item={id:'fixture',slug:'jacob-misiorowski-strikes-out',type:'video',title:'Jacob Misiorowski strikes out a batter',
 keywordsAll:[{value:'in-game-highlight'},{value:'playerid-694819'},{value:'gamepk-849799'}],
 image:{cuts:[{src:'https://img.mlbstatic.com/mlb-images/image/upload/fixture.jpg',aspectRatio:'16:9',width:1280}]},
 playbacks:[{name:'mp4Avc',url:'https://mlb-cuts-diamond.mlb.com/FORGE/fixture.mp4'}]};
const content=x=>({highlights:{highlights:{items:[x]}}});
const typo={...item,slug:'jacob-missiorowski-strikes-out',title:'Jacob Missiorowski strikes out a batter',keywordsAll:[{type:'player',value:'playerid-694819'},{value:'gamepk-849799'},{value:'in-game-highlight'}]};
assert(resolveMlbGameContentHighlight(start,content(typo)));assert(resolveMlbGameContentActionImageFromContent(start,content(typo)));
assert.equal(resolveMlbGameContentHighlight(start,content({...typo,keywordsAll:[...typo.keywordsAll,{type:'player',value:'playerid-123'}]})),null,'Ambiguous caption identity must not match');
for(const title of ['Jacob Misiorowski strikes out a batter','Jacob Misiorowski gets a batter swinging','Jacob Misiorowski tosses scoreless innings']){
 const c=content({...item,title});assert(resolveMlbGameContentHighlight(start,c));assert(resolveMlbGameContentActionImageFromContent(start,c));
}
for(const bad of [
 {...item,keywordsAll:item.keywordsAll.filter(x=>x.value!=='playerid-694819')},
 {...item,keywordsAll:item.keywordsAll.map(x=>x.value==='gamepk-849799'?{value:'gamepk-1'}:x)},
 {...item,title:'Jacob Misiorowski interview after scoreless innings'},
 {...item,title:'Another pitcher strikes out Jacob Misiorowski'},
 {...item,image:{cuts:[{src:'https://unapproved.example/photo.jpg',aspectRatio:'16:9'}]}},
]) {assert.equal(resolveMlbGameContentHighlight(start,content(bad)),null);assert.equal(resolveMlbGameContentActionImageFromContent(start,content(bad)),null);}
// Official montage pitching taxonomy plus action in description must promote the image.
const montage={...item,title:"Jacob Misiorowski's five innings",description:'Jacob Misiorowski strikes out two batters',keywordsAll:[{value:'highlight-reel-starting-pitching'}]};
assert.equal(resolveMlbGameContentActionImageFromContent(start,content(montage)),null,'Unreviewed reel graphic is not an action photo');
assert(resolveMlbGameContentActionImageFromContent(start,content({...montage,image:{...montage.image,title:'GettyImages-123456'}})));
const postseason=new Set([start.gamePk]);const record=records.find(x=>x.id===start.id);
const row={startId:record.id,gamePk:record.gamePk,tier:'postseason',youtubeAttempted:false,selected:{image:null,highlight:null},lookups:[{url:`https://statsapi.mlb.com/api/v1/game/${record.gamePk}/content`,status:200}]};
assertSettledMediaCoverage([record],[row],postseason);
for(const bad of [[],[{...row,gamePk:0}],[{...row,lookups:[]}],[{...row,lookups:[{...row.lookups[0],status:500}]}]])assert.throws(()=>assertSettledMediaCoverage([record],bad,postseason));
assert.equal(mediaTier({...record,gamePk:1,gameScorePlus:70},postseason),'gem');assert.equal(mediaTier({...record,gamePk:1,gameScorePlus:69},postseason),'other');
assert.throws(()=>assertSettledMediaCoverage([{...record,gamePk:1,gameScorePlus:69}],[{...row,gamePk:1,tier:'other',youtubeAttempted:true,lookups:[{url:'https://statsapi.mlb.com/api/v1/game/1/content',status:200}]}],postseason));
for(const [file,shared] of [['scripts/backfill-settled-start-media.mjs','src/lib/data/highlight-discovery.ts'],['scripts/backfill-settled-start-media.mjs','src/lib/data/top-performer-image-service.ts']])assert(readFileSync(file,'utf8').includes(shared));
console.log('PASS shared selectors: postseason taxonomy, exact pitcher/game identity, action copy, montage description, source rejection');
console.log('PASS coverage: missing/unqueried/wrong-game/error outcomes fail; YouTube forbidden below GS+70 outside postseason');
const log=JSON.parse(readFileSync('data/season-reviews/2026-postseason-media-log.json','utf8')).outcomes;
const published=JSON.parse(readFileSync('src/data/start-media-2026.json','utf8'));
const postGames=new Set(log.map(x=>x.gamePk));assert.equal(postGames.size,40);assert.equal(log.length,80);
assertSettledMediaCoverage(records.filter(x=>postGames.has(x.gamePk)),log,postGames);
for(const row of log) assert.deepEqual(published[row.startId],row.selected);
for(const [file,hash] of Object.entries({
 'src/data/season-review-2026.json':'20e7f7a42fc8d56c8dae65cf774bb606ad8c80542ea5509325953c55836fba55',
 'data/season-reviews/2026-canonical.json':'9a7a97f0b6b0722604388c744eb68f745838ad43c11a98abf93d56ccd07784a5',
 'data/season-reviews/2026-receipt.json':'a9aa8743f0d1a95edc4bb110db0ea8c7b9c0a9f2d1dffdf035e99a3a7f9fdf81',
})) assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),hash,`Frozen content ${file}`);
console.log(`PASS 80/80 postseason content lookups; ${log.filter(x=>x.selected.image).length} images; ${log.filter(x=>x.selected.highlight).length} highlights; ${log.filter(x=>x.youtubeError).length} explicit quota deferrals; frozen bytes unchanged`);
const {resolveFeaturedStartHighlight}=loadProjectTs('src/lib/data/featured-highlight-service.ts');
const {resolveTopPerformerImage}=loadProjectTs('src/lib/data/top-performer-image-service.ts');
const existingHighlights=JSON.parse(readFileSync('src/data/season-review-media-2026.json','utf8')).highlights;
const oldFetch=globalThis.fetch;let requests=0;
globalThis.fetch=async()=>{requests++;throw new Error('Published media must not rediscover');};
try {for(const row of log){const start=canonicalRecordToFormStart(records.find(x=>x.id===row.startId),1);if(row.selected.highlight)assert.deepEqual(await resolveFeaturedStartHighlight(start),existingHighlights[start.id]??row.selected.highlight);assert.deepEqual(await resolveTopPerformerImage(start,null,{exactGameOnly:true}),row.selected.image);}}finally{globalThis.fetch=oldFetch;}
assert.equal(requests,0);console.log('PASS all postseason exact-game image reads and resolved highlight reads reuse stored references without network');
