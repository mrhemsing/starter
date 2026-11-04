import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {loadProjectTs} from './lib/load-project-ts.mjs';
const [sha]=process.argv.slice(2);assert(sha,'Expected deployed SHA required');
const output='outputs/off131/production';await mkdir(output,{recursive:true});
const records=JSON.parse(await readFile('data/season-reviews/2026-canonical.json','utf8'));
const assets=JSON.parse(await readFile('src/data/start-media-2026.json','utf8'));
const existingHighlights=JSON.parse(await readFile('src/data/season-review-media-2026.json','utf8')).highlights;
const logs=JSON.parse(await readFile('outputs/off131/postseason-log.json','utf8')).outcomes;
const baseline=JSON.parse(await readFile('outputs/off131/baseline.json','utf8'));
const {startMatchupLabel}=loadProjectTs('src/lib/start-matchup-label.ts');
const base='https://www.toetheslab.com';
const result={pages:[],images:[],videos:[],links:[],freeze:[]};
function approvedImage(value){const u=new URL(value,base);if(u.pathname==='/_next/image')return approvedImage(u.searchParams.get('url'));return u.origin===base||['img.mlbstatic.com','img.youtube.com'].includes(u.hostname);}
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
 for(const date of Object.keys(baseline).filter(date=>records.some(r=>r.date===date)))for(const width of ['2026-10-28','2026-10-24'].includes(date)?[1440,390]:[1440]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'});const page=await context.newPage();
  page.on('request',r=>{if(r.resourceType()==='image')result.images.push({date,width,url:r.url(),approved:approvedImage(r.url())});if(r.resourceType()==='media')result.videos.push({date,width,url:r.url()});});
  const response=await page.goto(`${base}/starts/${date}`,{waitUntil:'networkidle',timeout:120000});assert.equal(response.status(),200);assert.equal(new URL(page.url()).search,'');
  const build=await page.locator('meta[name="tts-build"]').getAttribute('content');assert(build.startsWith(sha.slice(0,12)),`Stale dated page ${date}: ${build}`);
  const rows=await page.evaluate(()=>[...document.querySelectorAll('[data-responsive-check="ranked-start-card"], [data-responsive-check="short-start-card"]')].map(el=>{const clone=el.cloneNode(true);clone.querySelectorAll('button,video,iframe').forEach(x=>x.remove());return{name:el.getAttribute('data-pitcher-name'),text:clone.textContent.replace(/\s+/g,' ').trim()};}));
  assert.deepEqual(rows,baseline[date].rows,`Frozen ranked rows changed: ${date}`);result.freeze.push({date,width,rows:rows.length,unchanged:true});
  for(const card of await page.locator('[data-responsive-check="ranked-start-card"]').all()) {
   const pitcher=await card.getAttribute('data-pitcher-name');const r=records.find(x=>x.date===date&&x.pitcherName===pitcher);assert(r);
   assert(assets[r.id],`Unqueried rendered row ${r.id}`);
   if(existingHighlights[r.id]||assets[r.id].highlight)assert.equal(await card.getByRole('button',{name:`Open ${pitcher} MLB highlight`,includeHidden:true}).count(),1,`Missing row reference ${r.id}`);
  }
  const hero=page.locator('[data-top-performer-pitcher]');assert.equal(await hero.count(),1);
  const name=await hero.getAttribute('data-top-performer-pitcher');const start=records.find(x=>x.date===date&&x.pitcherName===name);assert(start);
  const expected=startMatchupLabel({pitcher:{team:start.team},opponent:start.opponent,side:start.side});
  assert((await hero.innerText()).includes(expected.toUpperCase()));assert(rows.find(x=>x.name===name)?.text.includes(expected));
  const stored=assets[start.id];const media=stored&&{...stored,highlight:existingHighlights[start.id]??stored.highlight};assert(media,`Unqueried hero ${start.id}`);
  assert.equal(await hero.getAttribute('data-top-performer-photo'),media.image?'action':'headshot');
  if(!media.image)assert(logs.some(x=>x.startId===start.id&&x.imageOutcome==='no_matching_approved_action'),'Fallback needs documented lookup');
  const img=hero.locator('img');await img.evaluate(img=>img.decode());assert(await img.evaluate(img=>img.naturalWidth>0));
  const focal=await img.evaluate(img=>getComputedStyle(img).objectPosition);
  if(media.image)assert.equal(focal,width<1024?media.image.mobileObjectPosition:media.image.objectPosition);
  const link=hero.getByRole('link',{name:'Game log',exact:true});const href=await link.getAttribute('href');const linked=await page.request.get(base+href);assert.equal(linked.status(),200);assert(!(await linked.text()).includes('NEXT_HTTP_ERROR_FALLBACK;404'));result.links.push({date,href,status:linked.status()});
  if(media.highlight){await hero.getByRole('button',{name:`Open ${name} MLB highlight`}).filter({hasText:"Video highlights"}).click();const dialog=page.getByRole('dialog');if(media.highlight.source==='mlb-game-content'){const video=dialog.locator('video');await video.waitFor();await video.evaluate(v=>new Promise((resolve,reject)=>{if(v.readyState>=1)return resolve();v.addEventListener('loadedmetadata',resolve,{once:true});v.addEventListener('error',()=>reject(Error('Video metadata failed')),{once:true});setTimeout(()=>reject(Error('Video metadata timeout')),30000);}));assert.equal(await video.getAttribute('src'),media.highlight.embedUrl);if(['2026-10-28','2026-10-24'].includes(date)){await video.evaluate(v=>{v.muted=true;return v.play();});await page.waitForFunction(()=>document.querySelector('[role=dialog] video')?.currentTime>0.1);await video.evaluate(v=>v.pause());}}else assert((await dialog.locator('iframe').getAttribute('src')).includes(media.highlight.videoId));await page.getByRole('button',{name:'Close highlight',exact:true}).click();}
  for(const image of await page.locator('main img:visible').all()){await image.scrollIntoViewIfNeeded();await image.evaluate(img=>img.decode());}
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');
  if(['2026-10-28','2026-10-24'].includes(date)){await hero.scrollIntoViewIfNeeded();await hero.screenshot({path:`${output}/${date}-hero-${width}.png`});}
  result.pages.push({date,width,build,pitcher:name,team:expected,photo:media.image?'action':'documented-headshot',highlight:!!media.highlight,focal});
  await writeFile(`${output}/dom-network-results.json`,JSON.stringify(result,null,2));console.log(`PASS ${date} ${width}: ${expected}, frozen rows ${rows.length}`);await context.close();
 }
 assert(result.images.length>0&&result.images.every(x=>x.approved),'Unapproved image request');
 assert(result.videos.length>0&&result.videos.every(x=>['mlb-cuts-diamond.mlb.com','bdata-producedclips.mlb.com'].includes(new URL(x.url).hostname)),'Unapproved video request');
 result.passed=true;console.log(`PASS ${result.pages.length} production viewports; ${result.images.length} approved images; ${result.videos.length} approved media requests`);
}finally{await writeFile(`${output}/dom-network-results.json`,JSON.stringify(result,null,2));await browser.close();}
