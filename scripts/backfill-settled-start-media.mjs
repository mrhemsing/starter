import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadProjectTs} from './lib/load-project-ts.mjs';
import {mediaTier,assertSettledMediaCoverage} from './lib/settled-media-targets.mjs';
import {createDiscoveryFetch} from './lib/discovery-http.mjs';
const output='outputs/off131';await mkdir(output,{recursive:true});
let records=JSON.parse(await readFile('data/season-reviews/2026-canonical.json','utf8'));
const schedule=JSON.parse(await readFile(`${output}/postseason-schedule.json`,'utf8'));
const postseason=new Set(schedule.dates.flatMap(d=>d.games).map(g=>g.gamePk));
if(process.argv.includes('--postseason-only')) records=records.filter(r=>postseason.has(r.gamePk));
const {canonicalRecordToFormStart}=loadProjectTs('src/lib/canonical-start-summary.ts');
const {resolveMlbGameContentHighlight,resolveYouTubeHighlight,resolveMlbChannelId}=loadProjectTs('src/lib/data/highlight-discovery.ts');
const {resolveMlbGameContentActionImageFromContent}=loadProjectTs('src/lib/data/top-performer-image-service.ts');
const {fetch,log}=await createDiscoveryFetch(output,{reuse:['../starter-highlight-backfill/outputs/off13'],offlineHosts:process.argv.includes('--cached-youtube')?['www.googleapis.com']:[]});globalThis.fetch=fetch;
const frozenPaths=['src/data/season-review-2026.json','data/season-reviews/2026-canonical.json','data/season-reviews/2026-receipt.json'];
const hashes=await Promise.all(frozenPaths.map(async p=>createHash('sha256').update(await readFile(p)).digest('hex')));
const games=new Map();for(const r of records){if(!games.has(r.gamePk))games.set(r.gamePk,[]);games.get(r.gamePk).push(r);}
assert.equal(games.size,process.argv.includes('--postseason-only')?40:2205,'approved game-content lookup scope');
const tier=r=>mediaTier(r,postseason);
const order=[...games].sort((a,b)=>Number(postseason.has(b[0]))-Number(postseason.has(a[0])));
const outcomes=[],assets={};let channel=null;
for(const [gamePk,rows] of order) {
 const startIndex=log.length;
 const response=await fetch(`https://statsapi.mlb.com/api/v1/game/${gamePk}/content`);
 assert.equal(response.status,200,`game ${gamePk} lookup failed, not an absence`);
 const content=await response.json();const gameLookup=log.slice(startIndex);
 for(const record of rows) {
  const start=canonicalRecordToFormStart(record,1),group=tier(record);
  const image=resolveMlbGameContentActionImageFromContent(start,content);
  const contentHighlight=resolveMlbGameContentHighlight(start,content);
  let highlight=contentHighlight,youtubeError=null;const ytIndex=log.length;
  if(!highlight && group!=='other' && !process.argv.includes('--content-only')) {
   try {
   if(!process.env.YOUTUBE_API_KEY) throw new Error('YOUTUBE_API_KEY required for approved fallback');
   channel??=await resolveMlbChannelId(process.env.YOUTUBE_API_KEY);assert(channel,'Official channel required');
   const found=await resolveYouTubeHighlight({start,youtubeApiKey:process.env.YOUTUBE_API_KEY,mlbChannelId:channel});
   if(found) highlight={videoId:found.videoId,source:'youtube-search',isShort:found.durationSeconds!==null&&found.durationSeconds<60,embedUrl:`https://www.youtube-nocookie.com/embed/${found.videoId}?rel=0`,thumbnailUrl:`https://img.youtube.com/vi/${found.videoId}/maxresdefault.jpg`,watchUrl:`https://www.youtube.com/watch?v=${found.videoId}`};
   } catch(error) { if(!process.argv.includes('--cached-youtube')) throw error;youtubeError=error.message; }
  }
  if(highlight){const {title,...stored}=highlight;highlight=stored;}
  assets[start.id]={gamePk,image,highlight};
  outcomes.push({startId:start.id,gamePk,date:start.date,pitcher:start.pitcher.name,tier:group,score:start.gameScorePlus,
   contentHighlight:Boolean(contentHighlight),imageOutcome:image?'resolved':'no_matching_approved_action',highlightOutcome:highlight?'resolved':youtubeError?'deferred_quota':process.argv.includes('--content-only')&&group!=='other'?'fallback_pending':'no_matching_official_highlight',youtubeError,
   youtubeEligible:!contentHighlight&&group!=='other',youtubeAttempted:!contentHighlight&&group!=='other'&&!process.argv.includes('--content-only'),selected:assets[start.id],lookups:[...gameLookup,...log.slice(ytIndex)]});
 }
 if(outcomes.length%50<rows.length||outcomes.length===records.length){await writeFile(`${output}/sweep-log.json`,JSON.stringify({outcomes}));await writeFile(`${output}/assets.json`,JSON.stringify(assets));}
 console.log(`${new Set(outcomes.map(x=>x.gamePk)).size}/${games.size} games; ${outcomes.length}/${records.length} starts; gamePk ${gamePk}`);
}
const summary={games:games.size,starts:records.length,tiers:{},frozenFiles:Object.fromEntries(frozenPaths.map((p,i)=>[p,hashes[i]]))};
for(const group of ['postseason','gem','other']){const rows=outcomes.filter(x=>x.tier===group);summary.tiers[group]={starts:rows.length,games:new Set(rows.map(x=>x.gamePk)).size,contentHighlights:rows.filter(x=>x.contentHighlight).length,images:rows.filter(x=>x.selected.image).length,youtubeFallbackLookups:rows.filter(x=>x.youtubeAttempted).length,youtubeResolved:rows.filter(x=>x.selected.highlight?.source==='youtube-search').length,deferredQuota:rows.filter(x=>x.youtubeError).length,highlights:rows.filter(x=>x.selected.highlight).length};}
assertSettledMediaCoverage(records,outcomes,postseason);assert.equal(outcomes.length,records.length);assert.equal(new Set(outcomes.map(x=>x.startId)).size,records.length);
const after=await Promise.all(frozenPaths.map(async p=>createHash('sha256').update(await readFile(p)).digest('hex')));assert.deepEqual(after,hashes);
await writeFile(`${output}/summary.json`,JSON.stringify(summary,null,2));
await writeFile(`${output}/postseason-log.json`,JSON.stringify({outcomes:outcomes.filter(x=>x.tier==='postseason')},null,2));
console.log(JSON.stringify(summary,null,2));
if(process.argv.includes('--publish')) await writeFile('src/data/start-media-2026.json',JSON.stringify(assets,null,2)+'\n');
