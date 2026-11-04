import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {loadProjectTs} from './lib/load-project-ts.mjs';
import {createDiscoveryFetch} from './lib/discovery-http.mjs';
const read=async f=>JSON.parse(await readFile(f,'utf8'));
const media=await read('src/data/season-review-media-2026.json'),assets=await read('src/data/start-media-2026.json'),records=await read('data/season-reviews/2026-canonical.json'),post=await read('data/season-reviews/2026-postseason-media-log.json');
const ids=new Set([...Object.keys(media.highlights),...post.outcomes.map(o=>o.startId)]);
const {canonicalRecordToFormStart}=loadProjectTs('src/lib/canonical-start-summary.ts');
const {resolveMlbGameContentActionImageFromContent,selectMlbGameContentActionCandidate}=loadProjectTs('src/lib/data/top-performer-image-service.ts');
const {resolveMlbGameContentHighlight,resolveYouTubeHighlight,resolveMlbChannelId}=loadProjectTs('src/lib/data/highlight-discovery.ts');
const {fetch,log}=await createDiscoveryFetch('outputs/off15',{reuse:['../starter-postseason-media/outputs/off131','../starter-highlight-backfill/outputs/off13']});
const previous=await read('data/season-reviews/2026-highlight-cover-log.json').catch(()=>null);
globalThis.fetch=fetch;
const photos=[],relinks=[];const games=new Map();
for(const id of ids){const record=records.find(r=>r.id===id);assert(record,id);const start=canonicalRecordToFormStart(record,1);let content=games.get(start.gamePk);const before=log.length;if(!content){const response=await fetch(`https://statsapi.mlb.com/api/v1/game/${start.gamePk}/content`);assert.equal(response.status,200);content=await response.json();games.set(start.gamePk,content);}
const selected=resolveMlbGameContentActionImageFromContent(start,content);const image=id===media.startId?media.image:assets[id]?.image??selected;
assert(!image||new URL(image.imageUrl).hostname==='img.mlbstatic.com');assets[id].image=image;
const lookup=log.find(l=>l.url===`https://statsapi.mlb.com/api/v1/game/${start.gamePk}/content`);const diagnostic=image?null:selectMlbGameContentActionCandidate(content,start)?.item;
photos.push({startId:id,gamePk:start.gamePk,date:start.date,pitcher:start.pitcher.name,imageOutcome:image?'action_photo':(media.highlights[id]??assets[id].highlight)?'center_cropped_video_thumbnail_fallback':'no_action_photo_no_highlight',image,lookup,diagnostic:image?null:{reason:diagnostic?'Matching content exists, but no image passed the shared action-photo policy (identity, action content, graphics exclusion).':'No matching pitching action candidate in exact-game content.',candidateTitle:diagnostic?.title??null},hasHighlight:Boolean(media.highlights[id]??assets[id].highlight)});
const old=previous?.relinks.find(r=>r.startId===id)?.before??media.highlights[id]??assets[id].highlight;
if(old?.isShort){const candidate=resolveMlbGameContentHighlight(start,content);if(candidate){const {title,...h}=candidate;assets[id].highlight=h;if(media.highlights[id])media.highlights[id]=h;relinks.push({startId:id,date:start.date,pitcher:start.pitcher.name,gamePk:start.gamePk,before:old,after:h,title,lookup,outcome:'standard_mlb_content_selected'});}else{assert(process.env.YOUTUBE_API_KEY,'YouTube validation key required for unresolved vertical assets');const begin=log.length;const channel=await resolveMlbChannelId(process.env.YOUTUBE_API_KEY);const found=await resolveYouTubeHighlight({start,youtubeApiKey:process.env.YOUTUBE_API_KEY,mlbChannelId:channel});assert(found,'Existing vertical reference needs an explicit valid lookup outcome');const after={videoId:found.videoId,source:'youtube-search',isShort:found.durationSeconds<60,embedUrl:`https://www.youtube-nocookie.com/embed/${found.videoId}?rel=0`,thumbnailUrl:`https://img.youtube.com/vi/${found.videoId}/maxresdefault.jpg`,watchUrl:`https://www.youtube.com/watch?v=${found.videoId}`};assets[id].highlight=after;if(media.highlights[id])media.highlights[id]=after;relinks.push({startId:id,date:start.date,pitcher:start.pitcher.name,gamePk:start.gamePk,before:old,after,lookup,youtubeResult:found,youtubeLookups:log.slice(begin),outcome:found.durationSeconds>=60?'standard_youtube_selected':'short_only_in_shared_official_lookup'});}}
}
await writeFile('data/season-reviews/2026-highlight-cover-log.json',JSON.stringify({starts:ids.size,games:games.size,photos,relinks},null,2)+'\n');
await writeFile('src/data/start-media-2026.json',JSON.stringify(assets,null,2)+'\n');await writeFile('src/data/season-review-media-2026.json',JSON.stringify(media,null,2)+'\n');
console.log(JSON.stringify({starts:ids.size,games:games.size,photos:photos.filter(p=>p.image).length,fallbacks:photos.filter(p=>!p.image).map(p=>({id:p.startId,hasHighlight:p.hasHighlight,reason:p.diagnostic})),relinks},null,2));
