import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { loadProjectTs } from './lib/load-project-ts.mjs';
import { featuredHighlightTargets, assertBackfillCoverage } from './lib/season-highlight-targets.mjs';

const run = promisify(execFile);
const output = 'outputs/off13';
await mkdir(`${output}/responses`, {recursive:true});
const review = JSON.parse(await readFile('src/data/season-review-2026.json','utf8'));
const media = JSON.parse(await readFile('src/data/season-review-media-2026.json','utf8'));
// Explicit featured IDs only. No date-range or full-season network scan.
const records = JSON.parse(await readFile('data/season-reviews/2026-canonical.json','utf8'));
const starts = featuredHighlightTargets(review, records);
const frozenPaths=['src/data/season-review-2026.json','data/season-reviews/2026-canonical.json','data/season-reviews/2026-receipt.json'];
const hashes=await Promise.all(frozenPaths.map(async file=>createHash('sha256').update(await readFile(file)).digest('hex')));
const apiKey = process.env.YOUTUBE_API_KEY;
if (!apiKey) throw new Error('YOUTUBE_API_KEY required');
let currentLog = [];
let lastRequest = 0;
globalThis.fetch = async (input) => {
  const url = new URL(input);
  if (!['www.googleapis.com','statsapi.mlb.com'].includes(url.hostname)) throw new Error('Unapproved discovery host');
  const safe = new URL(url); safe.searchParams.delete('key');
  const key = createHash('sha256').update(safe.href).digest('hex');
  const file = `${output}/responses/${key}.json`;
  let saved;
  try {saved=JSON.parse(await readFile(file,'utf8'));} catch {}
  if (!saved) {
    await delay(Math.max(0,750-(Date.now()-lastRequest)));
    lastRequest=Date.now();
    let stdout;
    try {({stdout}=await run('curl.exe',['--silent','--show-error','--max-time','30','--write-out','\n%{http_code}',url.href],{maxBuffer:20*1024*1024}));}
    catch {throw new Error(`Discovery transport failed for ${safe.href}`);}
    const split=stdout.lastIndexOf('\n');
    saved={url:safe.href,at:new Date().toISOString(),status:Number(stdout.slice(split+1)),body:JSON.parse(stdout.slice(0,split))};
    await writeFile(file,JSON.stringify(saved,null,2));
  }
  currentLog.push({url:safe.href,status:saved.status,at:saved.at,responseFile:file,
    candidates:saved.body.items?.map(item=>({id:item.id,title:item.snippet?.title,channelId:item.snippet?.channelId,publishedAt:item.snippet?.publishedAt})),
    error:saved.body.error ? {code:saved.body.error.code,message:saved.body.error.message} : undefined});
  return new Response(JSON.stringify(saved.body),{status:saved.status});
};
const {resolveMlbChannelId,resolveYouTubeHighlight,resolveMlbGameContentHighlight}=loadProjectTs('src/lib/data/highlight-discovery.ts');
const mlbChannelId=await resolveMlbChannelId(apiKey);
if (!mlbChannelId) throw new Error('Official MLB channel resolution failed');
const channelLog=currentLog;
const outcomes=[];
for(const start of starts) {
  currentLog=[];
  try {
    // Exact-game source request is recorded even for a previously stored asset.
    const gameResponse=await fetch(`https://statsapi.mlb.com/api/v1/game/${start.gamePk}/content`);
    if(!gameResponse.ok) throw new Error(`MLB game content HTTP ${gameResponse.status}`);
    const content=await gameResponse.json();
    let selected=null;
    const existing=media.highlights[start.id];
    if(existing && existing.source !== 'mlb-game-content') {
      const u=new URL('https://www.googleapis.com/youtube/v3/videos');
      u.search=new URLSearchParams({part:'snippet,status,contentDetails',id:existing.videoId,key:apiKey});
      const r=await fetch(u);const body=await r.json();const video=body.items?.[0];
      if(r.ok && video?.snippet?.channelId===mlbChannelId && video.status?.embeddable) selected={...existing,title:video.snippet.title,preserved:true};
    }
    if(!selected) {
      const match=await resolveYouTubeHighlight({start,youtubeApiKey:apiKey,mlbChannelId});
      if(match) selected={videoId:match.videoId,source:'youtube-search',isShort:match.durationSeconds!==null&&match.durationSeconds<60,
        embedUrl:`https://www.youtube-nocookie.com/embed/${match.videoId}?rel=0`,thumbnailUrl:`https://img.youtube.com/vi/${match.videoId}/maxresdefault.jpg`,
        watchUrl:`https://www.youtube.com/watch?v=${match.videoId}`,title:match.title,preserved:false};
    }
    if(!selected) selected=resolveMlbGameContentHighlight(start,content);
    const errors=currentLog.filter(row=>row.status!==200);
    outcomes.push({startId:start.id,gamePk:start.gamePk,date:start.date,pitcher:start.pitcher.name,rank:start.rank,
      outcome:errors.length?'lookup_error':selected?'resolved':'no_match',selected,lookups:currentLog});
  } catch(error) {
    outcomes.push({startId:start.id,gamePk:start.gamePk,outcome:'lookup_error',error:error.message,lookups:currentLog});
  }
  await writeFile(`${output}/backfill-log.json`,JSON.stringify({channel:mlbChannelId,channelLog,outcomes},null,2));
  console.log(`${outcomes.length}/${starts.length} ${start.gamePk} ${start.pitcher.name}: ${outcomes.at(-1).outcome} ${outcomes.at(-1).selected?.videoId??''}`);
}
const resolved=outcomes.filter(row=>row.outcome==='resolved').length;
const topResolved=outcomes.filter(row=>row.outcome==='resolved' && review.topStarts.some(start=>start.id===row.startId)).length;
console.log(JSON.stringify({queried:outcomes.length,resolved,misses:outcomes.filter(row=>row.outcome==='no_match').length,errors:outcomes.filter(row=>row.outcome==='lookup_error').length}));
if(topResolved<20) throw new Error('DISCOVERY BUG GATE: fewer than 20 Top 25 resolved. Diagnose before publication.');
if(outcomes.some(row=>row.outcome==='lookup_error')) throw new Error('Discovery errors are not valid no-highlight outcomes');
assertBackfillCoverage(starts,outcomes,review.topStarts);
const hashesAfter=await Promise.all(frozenPaths.map(async file=>createHash('sha256').update(await readFile(file)).digest('hex')));
if(JSON.stringify(hashes)!==JSON.stringify(hashesAfter)) throw new Error('Frozen review changed during backfill');
const summary={featured:starts.length,queried:outcomes.length,resolved,top25Resolved:topResolved,
  frozenFiles:Object.fromEntries(frozenPaths.map((file,i)=>[file,hashes[i]])),
  fullSeasonProposal:{starts:records.length,uniqueGamePks:new Set(records.map(row=>row.gamePk)).size,
    maximumYouTubeSearchCalls:records.length*2,executed:false}};
await writeFile(`${output}/summary.json`,JSON.stringify(summary,null,2));
if(process.argv.includes('--publish')) {
  for(const row of outcomes) {
    if(!row.selected) {media.highlights[row.startId]=null;continue;}
    const {title,preserved,...asset}=row.selected;
    media.highlights[row.startId]=asset;
  }
  await writeFile('src/data/season-review-media-2026.json',JSON.stringify(media,null,2)+'\n');
  console.log('Published presentation references only. Frozen data, prose and hero image unchanged.');
}
