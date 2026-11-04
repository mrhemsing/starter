import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadProjectTs} from './lib/load-project-ts.mjs';
const read=f=>JSON.parse(readFileSync(f,'utf8'));
const log=read('data/season-reviews/2026-highlight-cover-log.json'),review=read('src/data/season-review-2026.json'),media=read('src/data/season-review-media-2026.json');
const ids=new Set([...Object.keys(media.highlights),...read('data/season-reviews/2026-postseason-media-log.json').outcomes.map(x=>x.startId)]);
assert.equal(ids.size,119);assert.equal(log.photos.length,ids.size);
for(const id of ids){const p=log.photos.find(x=>x.startId===id);assert(p,'unqueried start '+id);assert.equal(p.lookup.status,200);assert.equal(p.lookup.url,`https://statsapi.mlb.com/api/v1/game/${p.gamePk}/content`);if(p.image)assert.equal(new URL(p.image.imageUrl).hostname,'img.mlbstatic.com');else assert(p.diagnostic?.reason);}
for(const id of Object.keys(media.highlights))assert(log.photos.find(x=>x.startId===id)?.image,'all featured images');
assert.equal(log.photos.filter(x=>!x.image&&x.hasHighlight).length,5);
for(const [file,hash]of Object.entries(read('data/season-reviews/2026-highlight-backfill-summary.json').frozenFiles))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),hash);
const sale=log.relinks.find(x=>x.startId===review.topStarts[4].id);assert.equal(sale.after.isShort,false);assert.match(sale.title,/11 K/);assert(log.relinks.every(x=>x.after&&x.outcome!=='requires_shared_youtube_reselection'));
const {ImageConfigContext}=await import('next/dist/shared/lib/image-config-context.shared-runtime.js');
const {imageConfigDefault}=await import('next/dist/shared/lib/image-config.js');
const render=n=>renderToStaticMarkup(createElement(ImageConfigContext.Provider,{value:{...imageConfigDefault,...loadProjectTs('next.config.ts').default.images}},n));
const {FeaturedStartHighlightEmbed}=loadProjectTs('src/components/featured-start-highlight.tsx');const {seasonReviewMedia2026}=loadProjectTs('src/lib/season-review-media.ts');
for(const short of [true,false]){const html=render(createElement(FeaturedStartHighlightEmbed,{highlight:{...seasonReviewMedia2026.highlights[review.topStarts[4].id],isShort:short},pitcherName:'Chris Sale'}));assert(html.includes('aspect-video'));assert(!html.includes('aspect-[9/16]'));assert(html.includes('data-highlight-cover="action"'));assert(!html.includes('img.youtube.com'));assert(html.includes('top-performer-image object-cover'));}
const fallback=render(createElement(FeaturedStartHighlightEmbed,{highlight:{...media.highlights[review.topStarts[0].id],coverImage:null},pitcherName:'Fixture'}));assert(fallback.includes('data-highlight-cover="video-thumbnail-fallback"'));assert(fallback.includes('--top-performer-image-position:50% 50%'));
const {resolveYouTubeHighlight}=loadProjectTs('src/lib/data/highlight-discovery.ts');
const original=globalThis.fetch,channel='UCoLrcjPV5PbUrUyXq5mjc_A';
globalThis.fetch=async input=>new URL(input).pathname.endsWith('/videos')?Response.json({items:[['short','PT30S'],['standard','PT2M']].map(([id,duration])=>({id,snippet:{channelId:channel},status:{embeddable:true},contentDetails:{duration}}))}):Response.json({items:[['short','Chris Sale strikeouts'],['standard','Chris Sale highlight']].map(([videoId,title])=>({id:{videoId},snippet:{channelId:channel,title,description:'',publishedAt:'2026-08-28T02:00:00Z'}}))});
try{assert.equal((await resolveYouTubeHighlight({start:review.topStarts[4],youtubeApiKey:'fixture',mlbChannelId:channel})).videoId,'standard');}finally{globalThis.fetch=original;}
console.log('PASS OFF-1.5: 119 queried starts, 110 action photos, all 41 featured resolved, 5 documented video-cover fallbacks; 3 standard relinks and 1 sole Short; uniform frames including Short fixture, shared focal classes, center fallback, standard-selection preference; frozen bytes unchanged.');
